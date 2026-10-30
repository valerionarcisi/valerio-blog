// ═══════════════════════════════════════════════════════════════
// Radar contatti — letture e azioni dell'admin sul DB del motore radar (NAS).
// Il sito non spedisce mai email: "approva" mette la bozza in coda, spedisce il NAS.
// Spec: docs/radar-contatti-spec.md
// ═══════════════════════════════════════════════════════════════
import type { Client, InValue } from "@libsql/client";
import {
  type Result,
  ok,
  err,
  isNonEmptyString,
  isValidEmail,
} from "~/lib/result";

export const PROJECTS = ["non-fa-ridere", "walkie-talkie"] as const;
export type Project = (typeof PROJECTS)[number];

// Fasi di contact_projects.stage, nell'ordine della pipeline.
export const STAGES = [
  "to-contact",
  "draft",
  "contacted",
  "followup",
  "replied",
  "warm",
  "on-hold",
  "discarded",
] as const;
export type Stage = (typeof STAGES)[number];

// Impostazioni del motore modificabili dall'admin, con i limiti ammessi.
const SETTINGS: Record<string, { min: number; max: number }> = {
  send_enabled: { min: 0, max: 1 },
  paused: { min: 0, max: 1 },
  daily_cap: { min: 0, max: 60 },
  window_start: { min: 0, max: 23 },
  window_end: { min: 1, max: 24 },
  followup_days: { min: 3, max: 60 },
  max_followups: { min: 0, max: 3 },
  no_repeat_days: { min: 14, max: 365 },
  drafts_per_run: { min: 0, max: 20 },
  llm_daily_calls: { min: 0, max: 500 },
};

const PLACEHOLDER = /\[[^\]]{1,80}\]/;

type Row = Record<string, unknown>;

async function rows(
  db: Client,
  sql: string,
  args: InValue[] = [],
): Promise<Row[]> {
  const res = await db.execute({ sql, args });
  return res.rows.map((r) => ({ ...r }) as Row);
}

const isProject = (v: unknown): v is Project => PROJECTS.includes(v as Project);
const isStage = (v: unknown): v is Stage => STAGES.includes(v as Stage);
const isId = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

// ─── Letture ───────────────────────────────────────────────────

export async function loadToday(db: Client) {
  const [drafts, warm, counts, runs, settings, requests] = await Promise.all([
    rows(
      db,
      `SELECT o.id, o.contact_id, o.project, o.kind, o.subject, o.hook, o.lang, o.status, o.error,
              c.name, cp.score, cp.shortlist
       FROM radar_outbox o
       JOIN contacts c ON c.id = o.contact_id
       LEFT JOIN contact_projects cp ON cp.contact_id = o.contact_id AND cp.project = o.project
       WHERE o.status IN ('draft', 'approved')
       ORDER BY o.status = 'approved', o.kind = 'followup' DESC, cp.score DESC, o.id`,
    ),
    rows(
      db,
      `SELECT c.id, c.name, cp.project, cp.stage, cp.updated_at
       FROM contact_projects cp JOIN contacts c ON c.id = cp.contact_id
       WHERE cp.stage IN ('replied', 'warm') ORDER BY cp.updated_at DESC LIMIT 10`,
    ),
    rows(
      db,
      `SELECT
         (SELECT count(*) FROM radar_outbox WHERE status = 'draft') AS drafts,
         (SELECT count(*) FROM radar_outbox WHERE status = 'approved') AS queued,
         (SELECT count(*) FROM radar_outbox WHERE status = 'sent' AND date(sent_at) = date('now', 'localtime')) AS sent_today,
         (SELECT count(*) FROM contact_projects WHERE stage IN ('contacted', 'followup')) AS waiting,
         (SELECT count(*) FROM contacts WHERE created_at >= datetime('now', '-7 days')) AS new_week`,
    ),
    rows(
      db,
      `SELECT job, started_at, status, found, errors, note FROM radar_runs ORDER BY id DESC LIMIT 6`,
    ),
    loadSettings(db),
    loadRequests(db),
  ]);
  const due = await loadDueFollowups(db, settings);
  return {
    drafts,
    warm,
    counts: counts[0] ?? {},
    runs,
    settings,
    requests,
    due,
  };
}

// Richieste in corso e quelle finite da poco: l'admin le mostra e rilegge finché ce ne sono di aperte.
async function loadRequests(
  db: Client,
  where = "",
  args: InValue[] = [],
): Promise<Row[]> {
  return rows(
    db,
    `SELECT id, kind, contact_id, project, outbox_id, status, note, created_at FROM radar_requests
     WHERE (status IN ('pending', 'running') OR done_at >= datetime('now', '-15 minutes')) ${where} ORDER BY id DESC LIMIT 30`,
    args,
  );
}

// Contattate da più di `followup_days` senza risposta e senza bozza in sospeso. Conta anche i follow-up già fatti
// da Hermes (contacts.status = follow-up-N) e quelli del motore, fino a `max_followups`.
export async function loadDueFollowups(
  db: Client,
  settings: Record<string, string>,
): Promise<Row[]> {
  const days = Number(settings.followup_days) || 10;
  const max = Number(settings.max_followups) || 2;
  return rows(
    db,
    `SELECT * FROM (
       SELECT c.id, c.name, c.email, cp.project, cp.stage,
         coalesce((SELECT max(coalesce(o.sent_at, o.created_at)) FROM radar_outbox o
                   WHERE o.contact_id = c.id AND o.project = cp.project AND o.status IN ('sent', 'done')),
                  c.contacted_at, cp.updated_at) AS last_contact,
         max(CASE c.status WHEN 'follow-up-1' THEN 1 WHEN 'follow-up-2' THEN 2 ELSE 0 END,
             (SELECT count(*) FROM radar_outbox o WHERE o.contact_id = c.id AND o.project = cp.project
                   AND o.kind = 'followup' AND o.status IN ('sent', 'done'))) AS followups,
         (SELECT count(*) FROM radar_outbox o WHERE o.contact_id = c.id AND o.project = cp.project AND o.status IN ('draft', 'approved')) AS open_drafts
       FROM contact_projects cp JOIN contacts c ON c.id = cp.contact_id
       WHERE cp.stage IN ('contacted', 'followup') AND c.email LIKE '%@%')
     WHERE last_contact <= datetime('now', ?) AND followups < ? AND open_drafts = 0
     ORDER BY last_contact LIMIT 15`,
    [`-${days} days`, max],
  );
}

export async function loadPipeline(db: Client, project: Project, minScore = 0) {
  const list = await rows(
    db,
    `SELECT c.id, c.name, c.country, c.city, c.email, c.verification_level,
            cp.stage, cp.score, cp.shortlist, cp.reason
     FROM contact_projects cp JOIN contacts c ON c.id = cp.contact_id
     WHERE cp.project = ? AND coalesce(cp.score, 0) >= ?
     ORDER BY cp.shortlist DESC, cp.score DESC NULLS LAST, c.id DESC`,
    [project, minScore],
  );
  const columns = STAGES.map((stage) => {
    const all = list.filter((r) => (r.stage ?? "to-contact") === stage);
    return { stage, count: all.length, cards: all.slice(0, 40) };
  });
  return { project, columns };
}

export async function loadContact(db: Client, id: number) {
  const contact = (
    await rows(db, "SELECT * FROM contacts WHERE id = ?", [id])
  )[0];
  if (!contact) return null;
  const domain = domainOf(String(contact.official_url ?? ""));
  const [projects, outbox, events, duplicates, requests, people] =
    await Promise.all([
      rows(db, "SELECT * FROM contact_projects WHERE contact_id = ?", [id]),
      rows(
        db,
        "SELECT id, project, kind, to_email, subject, status, created_at, sent_at FROM radar_outbox WHERE contact_id = ? ORDER BY id DESC",
        [id],
      ),
      rows(
        db,
        "SELECT kind, project, detail, at FROM radar_events WHERE contact_id = ? ORDER BY id DESC LIMIT 30",
        [id],
      ),
      rows(
        db,
        `SELECT id, name, project, status FROM contacts
       WHERE id <> ? AND ((? <> '' AND official_url LIKE ?) OR (email IS NOT NULL AND ? <> '' AND lower(email) = lower(?)))
       LIMIT 10`,
        [
          id,
          domain,
          `%${domain}%`,
          String(contact.email ?? ""),
          String(contact.email ?? ""),
        ],
      ),
      loadRequests(db, "AND contact_id = ?", [id]),
      rows(
        db,
        "SELECT name, role, email, email_confidence, linkedin_search, instagram_search FROM people WHERE contact_id = ? ORDER BY id LIMIT 20",
        [id],
      ),
    ]);
  return { contact, projects, outbox, events, duplicates, requests, people };
}

export async function loadDraft(db: Client, id: number) {
  const draft = (
    await rows(
      db,
      `SELECT o.*, c.name, c.official_url, c.verification_level, c.contact_proof, cp.score, cp.reason
       FROM radar_outbox o JOIN contacts c ON c.id = o.contact_id
       LEFT JOIN contact_projects cp ON cp.contact_id = o.contact_id AND cp.project = o.project
       WHERE o.id = ?`,
      [id],
    )
  )[0];
  if (!draft) return null;
  const [requests, next] = await Promise.all([
    loadRequests(db, "AND outbox_id = ?", [id]),
    rows(
      db,
      "SELECT id FROM radar_outbox WHERE status = 'draft' AND id <> ? ORDER BY id > ? DESC, id LIMIT 1",
      [id, id],
    ),
  ]);
  return { ...draft, requests, next_id: next[0]?.id ?? null };
}

export async function loadEngine(db: Client) {
  const [runs, sources, settings] = await Promise.all([
    rows(db, "SELECT * FROM radar_runs ORDER BY id DESC LIMIT 40"),
    rows(
      db,
      "SELECT name, url, project, active, last_run, found_total FROM radar_sources ORDER BY name",
    ),
    loadSettings(db),
  ]);
  return { runs, sources, settings };
}

async function loadSettings(db: Client): Promise<Record<string, string>> {
  const r = await rows(db, "SELECT key, value FROM radar_settings");
  return Object.fromEntries(r.map((x) => [String(x.key), String(x.value)]));
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// ─── Azioni ────────────────────────────────────────────────────

export type Action =
  | {
      type: "draft_update";
      id: number;
      subject: string;
      body: string;
      to_email: string;
    }
  | { type: "draft_approve"; id: number }
  | { type: "draft_unapprove"; id: number }
  | { type: "draft_discard"; id: number }
  | { type: "stage"; contact_id: number; project: Project; stage: Stage }
  | { type: "shortlist"; contact_id: number; project: Project; value: boolean }
  | { type: "note"; contact_id: number; text: string }
  | { type: "setting"; key: string; value: number }
  | {
      type: "request";
      kind: RequestKind;
      contact_id?: number;
      project?: Project;
      outbox_id?: number;
    };

// Cose che il motore sul NAS esegue per conto dell'admin (il sito non chiama il modello).
export const REQUEST_KINDS = [
  "draft",
  "followup",
  "shorten",
  "translate",
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export function parseAction(body: unknown): Result<Action> {
  if (!body || typeof body !== "object") return err("Corpo non valido");
  const b = body as Record<string, unknown>;
  switch (b.action) {
    case "draft_update": {
      if (!isId(b.id)) return err("id mancante");
      if (!isNonEmptyString(b.subject) || b.subject.length > 200)
        return err("Oggetto mancante o troppo lungo");
      if (!isNonEmptyString(b.body) || b.body.length > 5000)
        return err("Testo mancante o troppo lungo");
      if (!isValidEmail(b.to_email)) return err("Destinatario non valido");
      return ok({
        type: "draft_update",
        id: b.id,
        subject: b.subject.trim(),
        body: b.body.trim(),
        to_email: b.to_email.trim(),
      });
    }
    case "draft_approve":
    case "draft_unapprove":
    case "draft_discard":
      return isId(b.id) ? ok({ type: b.action, id: b.id }) : err("id mancante");
    case "stage":
      if (!isId(b.contact_id) || !isProject(b.project))
        return err("Contatto o progetto non validi");
      if (!isStage(b.stage)) return err("Fase non valida");
      return ok({
        type: "stage",
        contact_id: b.contact_id,
        project: b.project,
        stage: b.stage,
      });
    case "shortlist":
      if (!isId(b.contact_id) || !isProject(b.project))
        return err("Contatto o progetto non validi");
      return ok({
        type: "shortlist",
        contact_id: b.contact_id,
        project: b.project,
        value: b.value === true,
      });
    case "note":
      if (!isId(b.contact_id)) return err("Contatto non valido");
      if (!isNonEmptyString(b.text) || b.text.length > 2000)
        return err("Nota vuota o troppo lunga");
      return ok({
        type: "note",
        contact_id: b.contact_id,
        text: b.text.trim(),
      });
    case "setting": {
      const rule = typeof b.key === "string" ? SETTINGS[b.key] : undefined;
      if (!rule) return err("Impostazione sconosciuta");
      const v = Number(b.value);
      if (!Number.isInteger(v) || v < rule.min || v > rule.max)
        return err(`Valore fuori intervallo (${rule.min}–${rule.max})`);
      return ok({ type: "setting", key: b.key as string, value: v });
    }
    case "request": {
      if (!REQUEST_KINDS.includes(b.kind as RequestKind))
        return err("Richiesta sconosciuta");
      const kind = b.kind as RequestKind;
      if (kind === "shorten" || kind === "translate") {
        return isId(b.outbox_id)
          ? ok({ type: "request", kind, outbox_id: b.outbox_id })
          : err("Bozza mancante");
      }
      if (!isId(b.contact_id) || !isProject(b.project))
        return err("Contatto o progetto non validi");
      return ok({
        type: "request",
        kind,
        contact_id: b.contact_id,
        project: b.project,
      });
    }
    default:
      return err("Azione sconosciuta");
  }
}

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

async function draftStatus(db: Client, id: number): Promise<Row | null> {
  return (
    (
      await rows(
        db,
        "SELECT id, status, body, contact_id, project FROM radar_outbox WHERE id = ?",
        [id],
      )
    )[0] ?? null
  );
}

export async function applyAction(
  db: Client,
  a: Action,
): Promise<Result<{ done: string }>> {
  switch (a.type) {
    case "draft_update": {
      const d = await draftStatus(db, a.id);
      if (!d) return err("Bozza non trovata");
      if (d.status !== "draft")
        return err("Si modificano solo le bozze non ancora in coda");
      await db.execute({
        sql: "UPDATE radar_outbox SET subject = ?, body = ?, to_email = ?, error = NULL WHERE id = ?",
        args: [a.subject, a.body, a.to_email, a.id],
      });
      return ok({ done: "Bozza salvata" });
    }
    case "draft_approve": {
      const d = await draftStatus(db, a.id);
      if (!d) return err("Bozza non trovata");
      if (d.status !== "draft") return err("La bozza non è più modificabile");
      if (PLACEHOLDER.test(String(d.body)))
        return err(
          "Nel testo restano segnaposto tra parentesi quadre: completali prima di approvare",
        );
      await db.execute({
        sql: "UPDATE radar_outbox SET status = 'approved', approved_at = ? WHERE id = ?",
        args: [now(), a.id],
      });
      return ok({
        done: "In coda: partirà dal NAS nella prossima fascia di invio",
      });
    }
    case "draft_unapprove": {
      const d = await draftStatus(db, a.id);
      if (!d || d.status !== "approved") return err("La bozza non è in coda");
      await db.execute({
        sql: "UPDATE radar_outbox SET status = 'draft', approved_at = NULL WHERE id = ?",
        args: [a.id],
      });
      return ok({ done: "Tolta dalla coda" });
    }
    case "draft_discard": {
      const d = await draftStatus(db, a.id);
      if (!d || (d.status !== "draft" && d.status !== "approved"))
        return err("Bozza non trovata");
      await db.batch([
        {
          sql: "UPDATE radar_outbox SET status = 'discarded' WHERE id = ?",
          args: [a.id],
        },
        // In attesa: il motore non riscrive finché non la rimetti "da contattare".
        {
          sql: "UPDATE contact_projects SET stage = 'on-hold', updated_at = ? WHERE contact_id = ? AND project = ? AND stage = 'draft'",
          args: [now(), d.contact_id as number, d.project as string],
        },
      ]);
      return ok({ done: "Bozza scartata, contatto in attesa" });
    }
    case "stage": {
      if (a.stage === "draft")
        return err(
          "Le bozze le prepara il motore: la fase «Bozza pronta» non si imposta a mano",
        );
      const stmts = [
        {
          sql: "UPDATE contact_projects SET stage = ?, updated_at = ? WHERE contact_id = ? AND project = ?",
          args: [a.stage, now(), a.contact_id, a.project],
        },
        {
          sql: "INSERT INTO radar_events(contact_id, project, kind, detail) VALUES(?, ?, 'stage', ?)",
          args: [a.contact_id, a.project, a.stage],
        },
      ];
      if (a.stage === "replied" || a.stage === "discarded") {
        stmts.push({
          sql: "UPDATE contacts SET status = ? WHERE id = ?",
          args: [a.stage, a.contact_id],
        });
        stmts.push({
          sql: "UPDATE radar_outbox SET status = 'cancelled' WHERE contact_id = ? AND project = ? AND status IN ('draft', 'approved')",
          args: [a.contact_id, a.project],
        });
      }
      await db.batch(stmts);
      return ok({ done: "Fase aggiornata" });
    }
    case "shortlist":
      await db.execute({
        sql: "UPDATE contact_projects SET shortlist = ?, updated_at = ? WHERE contact_id = ? AND project = ?",
        args: [a.value ? 1 : 0, now(), a.contact_id, a.project],
      });
      return ok({
        done: a.value ? "Aggiunta alla shortlist" : "Tolta dalla shortlist",
      });
    case "note":
      await db.execute({
        sql: "UPDATE contacts SET notes = coalesce(notes, '') || char(10) || ? WHERE id = ?",
        args: [`[${now().slice(0, 10)} admin] ${a.text}`, a.contact_id],
      });
      return ok({ done: "Nota aggiunta" });
    case "setting":
      await db.execute({
        sql: "UPDATE radar_settings SET value = ? WHERE key = ?",
        args: [String(a.value), a.key],
      });
      return ok({ done: "Impostazione salvata" });
    case "request":
      return queueRequest(db, a);
  }
}

async function queueRequest(
  db: Client,
  a: Extract<Action, { type: "request" }>,
): Promise<Result<{ done: string }>> {
  if (a.kind === "shorten" || a.kind === "translate") {
    const o = await draftStatus(db, a.outbox_id!);
    if (!o) return err("Bozza non trovata");
    if (o.status !== "draft")
      return err("Si riscrivono solo le bozze non ancora in coda");
  } else {
    const c = (
      await rows(db, "SELECT email FROM contacts WHERE id = ?", [a.contact_id!])
    )[0];
    if (!c) return err("Contatto non trovato");
    if (!String(c.email ?? "").includes("@"))
      return err("La casa non ha un'email: aggiungila prima");
    const open = await rows(
      db,
      "SELECT id FROM radar_outbox WHERE contact_id = ? AND project = ? AND status IN ('draft', 'approved') LIMIT 1",
      [a.contact_id!, a.project!],
    );
    if (open.length)
      return err("C'è già una bozza per questa casa e questo film");
  }
  const dup = await rows(
    db,
    `SELECT id FROM radar_requests WHERE kind = ? AND status IN ('pending', 'running')
       AND coalesce(contact_id, 0) = ? AND coalesce(project, '') = ? AND coalesce(outbox_id, 0) = ? LIMIT 1`,
    [a.kind, a.contact_id ?? 0, a.project ?? "", a.outbox_id ?? 0],
  );
  if (dup.length) return ok({ done: "Richiesta già in corso" });
  await db.execute({
    sql: "INSERT INTO radar_requests(kind, contact_id, project, outbox_id) VALUES(?, ?, ?, ?)",
    args: [
      a.kind,
      a.contact_id ?? null,
      a.project ?? null,
      a.outbox_id ?? null,
    ],
  });
  return ok({
    done: "Richiesta inviata al motore: di solito è pronta entro un minuto",
  });
}
