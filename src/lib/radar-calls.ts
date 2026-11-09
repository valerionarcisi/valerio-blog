// ═══════════════════════════════════════════════════════════════
// Bandi regionali — letture e azioni dell'admin sul DB del motore radar (NAS).
// Il sito legge, accoda richieste in radar_requests e cambia call_proposals.suitable: nient'altro.
// Spec: docs/radar-bandi-spec.md
// ═══════════════════════════════════════════════════════════════
import type { Client, InValue } from "@libsql/client";
import { type Result, ok, err } from "~/lib/result";
import { PROJECTS, type Project } from "~/lib/radar-contacts";
import { emailFlag, type EmailFlag } from "~/lib/radar-email";
import { regionName } from "~/lib/radar-regions";

export const CONFIDENCES = ["annunciata", "alta", "media", "bassa"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

// Finestra d'azione: da 150 a 45 giorni prima dell'apertura prevista.
export const WINDOW_FAR_DAYS = 150;
export const WINDOW_NEAR_DAYS = 45;
export const TIMELINE_DAYS = 365;

type Row = Record<string, unknown>;

async function rows(
  db: Client,
  sql: string,
  args: InValue[] = [],
): Promise<Row[]> {
  const res = await db.execute({ sql, args });
  return res.rows.map((r) => ({ ...r }) as Row);
}

// ─── Date (giorni interi, UTC) ─────────────────────────────────

const DAY_MS = 86_400_000;

export function dayNumber(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : Math.floor(t / DAY_MS);
}

export function isoDay(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export const todayIso = (d = new Date()): string =>
  d.toISOString().slice(0, 10);

// ─── JSON difensivo ────────────────────────────────────────────

function parseJson(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseStringList(raw: unknown): string[] {
  const v = parseJson(raw);
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

export type Target = {
  id: number;
  name: string;
  email: string | null;
  site: string | null;
  score: number | null;
  why: string;
};

export function parseTargets(raw: unknown): Target[] {
  const v = parseJson(raw);
  if (!Array.isArray(v)) return [];
  const out: Target[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    const score = typeof o.score === "number" && isFinite(o.score) ? o.score : null;
    out.push({
      id,
      name: o.name.trim(),
      email: typeof o.email === "string" && o.email.trim() ? o.email.trim() : null,
      site: typeof o.site === "string" && o.site.trim() ? o.site.trim() : null,
      score,
      why: typeof o.why === "string" ? o.why : "",
    });
  }
  return out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

// ─── Finestra d'azione e timeline ──────────────────────────────

export type WindowState = "future" | "now" | "closing" | "passed";

export function actionWindow(
  predictedOpens: unknown,
  today: string,
): { from: string; to: string; state: WindowState } | null {
  const o = dayNumber(predictedOpens);
  const t = dayNumber(today);
  if (o === null || t === null) return null;
  const from = o - WINDOW_FAR_DAYS;
  const to = o - WINDOW_NEAR_DAYS;
  const state: WindowState =
    t < from ? "future" : t <= to ? "now" : t < o ? "closing" : "passed";
  return { from: isoDay(from), to: isoDay(to), state };
}

export type Session = {
  id: number;
  call_id: number;
  opens: string | null;
  closes: string | null;
  status: string | null;
};

export type OpenCall = {
  call_id: number;
  title: string;
  region: string;
  region_name: string;
  closes: string | null;
  days_left: number | null;
  official_url: string | null;
};

// Aperto = oggi tra apertura (se nota) e chiusura. Senza chiusura non si può dire: non è "aperto".
export function sessionIsOpen(
  s: Pick<Session, "opens" | "closes">,
  today: string,
): boolean {
  const t = dayNumber(today);
  const c = dayNumber(s.closes);
  if (t === null || c === null || c < t) return false;
  const o = dayNumber(s.opens);
  return o === null || o <= t;
}

export function openNow(
  calls: Row[],
  sessions: Session[],
  today: string,
): OpenCall[] {
  const t = dayNumber(today)!;
  const out: OpenCall[] = [];
  for (const c of calls) {
    const open = sessions
      .filter((s) => s.call_id === c.id && sessionIsOpen(s, today))
      .sort((a, b) => String(a.closes).localeCompare(String(b.closes)))[0];
    if (!open) continue;
    out.push({
      call_id: Number(c.id),
      title: String(c.title ?? ""),
      region: String(c.region ?? ""),
      region_name: regionName(c.region),
      closes: open.closes,
      days_left: dayNumber(open.closes)! - t,
      official_url: (c.official_url as string) ?? null,
    });
  }
  return out.sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));
}

export type Proposal = {
  id: number;
  call_id: number;
  project: Project;
  predicted_opens: string | null;
  predicted_closes: string | null;
  confidence: Confidence | null;
  basis: string;
  suitable: boolean;
  title: string;
  region: string;
  region_name: string;
  window: ReturnType<typeof actionWindow>;
  days_to_open: number | null;
  targets_count: number;
};

const isConfidence = (v: unknown): v is Confidence =>
  CONFIDENCES.includes(v as Confidence);
const isProject = (v: unknown): v is Project => PROJECTS.includes(v as Project);

export function toProposal(r: Row, today: string): Proposal {
  const t = dayNumber(today);
  const o = dayNumber(r.predicted_opens);
  return {
    id: Number(r.id),
    call_id: Number(r.call_id),
    project: (isProject(r.project) ? r.project : "walkie-talkie") as Project,
    predicted_opens: (r.predicted_opens as string) ?? null,
    predicted_closes: (r.predicted_closes as string) ?? null,
    confidence: isConfidence(r.confidence) ? r.confidence : null,
    basis: String(r.basis ?? ""),
    suitable: Number(r.suitable ?? 1) !== 0,
    title: String(r.title ?? ""),
    region: String(r.region ?? ""),
    region_name: regionName(r.region),
    window: actionWindow(r.predicted_opens, today),
    days_to_open: o !== null && t !== null ? o - t : null,
    targets_count: parseTargets(r.targets_json).length,
  };
}

// In timeline: adatta, non ancora chiusa, apre entro 12 mesi.
export function inTimeline(p: Proposal, today: string): boolean {
  if (!p.suitable) return false;
  const t = dayNumber(today)!;
  const o = dayNumber(p.predicted_opens);
  if (o === null || o > t + TIMELINE_DAYS) return false;
  const end = dayNumber(p.predicted_closes) ?? o;
  return end >= t;
}

export type TimelineRow = Proposal & {
  /** 0–1 lungo i prossimi 12 mesi (apertura già passata = 0) */
  position: number;
  window_start: number;
  window_end: number;
  end_position: number;
  month: string;
};

export function buildTimeline(
  proposals: Proposal[],
  today: string,
): TimelineRow[] {
  const t = dayNumber(today)!;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  return proposals
    .filter((p) => inTimeline(p, today))
    .map((p) => {
      const o = dayNumber(p.predicted_opens)!;
      return {
        ...p,
        position: clamp((o - t) / TIMELINE_DAYS),
        window_start: clamp((o - WINDOW_FAR_DAYS - t) / TIMELINE_DAYS),
        window_end: clamp((o - WINDOW_NEAR_DAYS - t) / TIMELINE_DAYS),
        end_position: clamp(
          ((dayNumber(p.predicted_closes) ?? o + 30) - t) / TIMELINE_DAYS,
        ),
        month: isoDay(Math.max(o, t)).slice(0, 7),
      };
    })
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

export function groupByMonth<T extends { month: string }>(
  list: T[],
): { month: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const x of list) map.set(x.month, [...(map.get(x.month) ?? []), x]);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, items]) => ({ month, items }));
}

export type Filters = {
  project?: Project | null;
  region?: string | null;
  confidence?: Confidence | null;
  windowOnly?: boolean;
};

export function applyFilters<T extends Proposal>(list: T[], f: Filters): T[] {
  return list.filter(
    (p) =>
      (!f.project || p.project === f.project) &&
      (!f.region || p.region === f.region) &&
      (!f.confidence || p.confidence === f.confidence) &&
      (!f.windowOnly || p.window?.state === "now"),
  );
}

export function parseFilters(q: URLSearchParams): Filters {
  const project = q.get("progetto");
  const confidence = q.get("affidabilita");
  return {
    project: isProject(project) ? project : null,
    region: q.get("regione") || null,
    confidence: isConfidence(confidence) ? confidence : null,
    windowOnly: q.get("finestra") === "1",
  };
}

// ─── Contatti per regione ──────────────────────────────────────

export const BASIS_ORDER = [
  "fondo_regionale",
  "candidata_fondo",
  "film_commission",
  "sede",
] as const;

export const BASIS_LABEL: Record<string, string> = {
  fondo_regionale: "Hanno vinto il fondo",
  candidata_fondo: "Hanno partecipato al fondo",
  film_commission: "Film commission",
  sede: "Sede in regione",
};

export type RegionContact = {
  id: number;
  name: string;
  email: string | null;
  mail_kind: EmailFlag;
  basis: string;
  place: string | null;
  wins: { year: number | null; title: string; funds: string }[];
};

export function groupContactsByBasis(
  list: RegionContact[],
): { basis: string; label: string; contacts: RegionContact[] }[] {
  const rank = (b: string) => {
    const i = BASIS_ORDER.indexOf(b as (typeof BASIS_ORDER)[number]);
    return i === -1 ? BASIS_ORDER.length : i;
  };
  const map = new Map<string, RegionContact[]>();
  for (const c of list) map.set(c.basis, [...(map.get(c.basis) ?? []), c]);
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([basis, contacts]) => ({
      basis,
      label: BASIS_LABEL[basis] ?? basis,
      contacts: contacts.sort(
        (a, b) =>
          b.wins.length - a.wins.length || a.name.localeCompare(b.name, "it"),
      ),
    }));
}

// ─── Letture ───────────────────────────────────────────────────

const PROPOSAL_SELECT = `SELECT p.id, p.call_id, p.project, p.predicted_opens, p.predicted_closes, p.confidence,
       p.basis, p.suitable, p.targets_json, c.title, c.region
     FROM call_proposals p JOIN regional_calls c ON c.id = p.call_id`;

function sessionOf(r: Row): Session {
  return {
    id: Number(r.id),
    call_id: Number(r.call_id),
    opens: (r.opens as string) ?? null,
    closes: (r.closes as string) ?? null,
    status: (r.status as string) ?? null,
  };
}

export async function loadOverview(db: Client, today = todayIso()) {
  const [pr, calls, sessions] = await Promise.all([
    rows(db, `${PROPOSAL_SELECT} ORDER BY p.predicted_opens`),
    rows(db, "SELECT id, region, title, official_url FROM regional_calls WHERE sheet_kind = 'bando'"),
    rows(db, "SELECT id, call_id, opens, closes, status FROM call_sessions"),
  ]);
  const proposals = pr.map((r) => toProposal(r, today));
  return {
    today,
    open: openNow(calls, sessions.map(sessionOf), today),
    timeline: buildTimeline(proposals, today),
  };
}

export async function loadArchive(db: Client, today = todayIso()) {
  const [pr, calls] = await Promise.all([
    rows(db, `${PROPOSAL_SELECT} ORDER BY p.predicted_opens DESC`),
    rows(
      db,
      `SELECT c.id, c.region, c.title, c.official_url, c.status,
              (SELECT max(closes) FROM call_sessions s WHERE s.call_id = c.id) AS last_closes
       FROM regional_calls c WHERE c.sheet_kind = 'bando' AND c.status = 'chiuso'
       ORDER BY last_closes DESC`,
    ),
  ]);
  const all = pr.map((r) => toProposal(r, today));
  return {
    today,
    notSuitable: all.filter((p) => !p.suitable),
    past: all.filter((p) => p.suitable && !inTimeline(p, today)),
    closedCalls: calls.map((c) => ({
      id: Number(c.id),
      title: String(c.title ?? ""),
      region: String(c.region ?? ""),
      region_name: regionName(c.region),
      last_closes: (c.last_closes as string) ?? null,
      official_url: (c.official_url as string) ?? null,
    })),
  };
}

export async function loadRequestsFor(db: Client, proposalId: number) {
  return rows(
    db,
    `SELECT id, kind, payload, status, note, created_at, done_at FROM radar_requests
     WHERE kind = 'call_proposal' AND payload = ? ORDER BY id DESC LIMIT 5`,
    [`${proposalId} bozze`],
  );
}

export async function loadRequest(db: Client, id: number) {
  return (
    (
      await rows(
        db,
        "SELECT id, kind, payload, status, note, created_at, done_at FROM radar_requests WHERE id = ?",
        [id],
      )
    )[0] ?? null
  );
}

export async function loadProposal(
  db: Client,
  id: number,
  today = todayIso(),
) {
  const r = (
    await rows(
      db,
      `SELECT p.*, c.title, c.region, c.sheet_kind, c.works, c.phases, c.beneficiaries, c.budget_text,
              c.min_contribution, c.max_contribution, c.official_url, c.ifm_url, c.description
       FROM call_proposals p JOIN regional_calls c ON c.id = p.call_id WHERE p.id = ?`,
      [id],
    )
  )[0];
  if (!r) return null;
  const targets = parseTargets(r.targets_json);
  const project = String(r.project);
  const [sessions, pipeline, requests] = await Promise.all([
    rows(
      db,
      "SELECT id, call_id, opens, closes, status FROM call_sessions WHERE call_id = ? ORDER BY coalesce(opens, closes) DESC",
      [r.call_id as number],
    ),
    targets.length
      ? rows(
          db,
          `SELECT contact_id, stage, score, shortlist FROM contact_projects
           WHERE project = ? AND contact_id IN (${targets.map(() => "?").join(",")})`,
          [project, ...targets.map((t) => t.id)],
        )
      : Promise.resolve([] as Row[]),
    loadRequestsFor(db, id),
  ]);
  const byContact = new Map(pipeline.map((p) => [Number(p.contact_id), p]));
  return {
    today,
    proposal: {
      ...toProposal(r, today),
      angle: String(r.angle ?? ""),
      pitch: String(r.pitch ?? ""),
      prepare: parseStringList(r.prepare),
      warnings: parseStringList(r.warnings),
      created_at: (r.created_at as string) ?? null,
    },
    call: {
      title: String(r.title ?? ""),
      sheet_kind: r.sheet_kind,
      works: r.works,
      phases: r.phases,
      beneficiaries: r.beneficiaries,
      budget_text: r.budget_text,
      min_contribution: r.min_contribution,
      max_contribution: r.max_contribution,
      official_url: r.official_url,
      ifm_url: r.ifm_url,
      description: r.description,
    },
    sessions: sessions.map(sessionOf),
    targets: targets.map((t) => {
      const p = byContact.get(t.id);
      return {
        ...t,
        mail_kind: emailFlag(t.email),
        stage: (p?.stage as string) ?? null,
        shortlist: Number(p?.shortlist ?? 0) === 1,
      };
    }),
    requests,
  };
}

export async function loadRegion(db: Client, code: string, today = todayIso()) {
  const name = regionName(code);
  const [calls, sessions, contactRows, wins, pr] = await Promise.all([
    rows(
      db,
      `SELECT id, title, sheet_kind, status, budget_text, official_url, ifm_url, fits
       FROM regional_calls WHERE region = ? ORDER BY sheet_kind, title`,
      [code],
    ),
    rows(
      db,
      `SELECT s.id, s.call_id, s.opens, s.closes, s.status FROM call_sessions s
       JOIN regional_calls c ON c.id = s.call_id WHERE c.region = ? ORDER BY coalesce(s.opens, s.closes) DESC`,
      [code],
    ),
    rows(
      db,
      `SELECT cr.contact_id AS id, cr.basis, cr.place, c.name, c.email
       FROM contact_regions cr JOIN contacts c ON c.id = cr.contact_id WHERE cr.region = ?`,
      [code],
    ),
    rows(
      db,
      `SELECT cr.contact_id, cr.year, cr.title, cr.funds FROM credits cr
       WHERE cr.funds LIKE ? AND cr.contact_id IN (SELECT contact_id FROM contact_regions WHERE region = ?)
       ORDER BY cr.year DESC`,
      [`Fondo regionale ${name}:%`, code],
    ),
    rows(
      db,
      `${PROPOSAL_SELECT} WHERE c.region = ? ORDER BY p.predicted_opens`,
      [code],
    ),
  ]);
  const winsBy = new Map<number, RegionContact["wins"]>();
  for (const w of wins) {
    const k = Number(w.contact_id);
    winsBy.set(k, [
      ...(winsBy.get(k) ?? []),
      {
        year: w.year == null ? null : Number(w.year),
        title: String(w.title ?? ""),
        funds: String(w.funds ?? ""),
      },
    ]);
  }
  // Una casa può comparire con più basis: la tengo una volta per basis.
  const contacts: RegionContact[] = contactRows.map((c) => ({
    id: Number(c.id),
    name: String(c.name ?? ""),
    email: (c.email as string) ?? null,
    mail_kind: emailFlag(c.email),
    basis: String(c.basis ?? ""),
    place: (c.place as string) ?? null,
    wins: c.basis === "fondo_regionale" ? (winsBy.get(Number(c.id)) ?? []) : [],
  }));
  const sess = sessions.map(sessionOf);
  return {
    code,
    name,
    today,
    groups: groupContactsByBasis(contacts),
    calls: calls.map((c) => ({
      id: Number(c.id),
      title: String(c.title ?? ""),
      sheet_kind: String(c.sheet_kind ?? ""),
      status: (c.status as string) ?? null,
      budget_text: (c.budget_text as string) ?? null,
      official_url: (c.official_url as string) ?? null,
      ifm_url: (c.ifm_url as string) ?? null,
      sessions: sess.filter((s) => s.call_id === Number(c.id)),
    })),
    proposals: pr.map((r) => toProposal(r, today)),
  };
}

// ─── Azioni ────────────────────────────────────────────────────

export type Action =
  | { type: "prepare_drafts"; proposal_id: number }
  | { type: "set_suitable"; proposal_id: number; value: boolean };

const isId = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

export function parseAction(body: unknown): Result<Action> {
  if (!body || typeof body !== "object") return err("Corpo non valido");
  const b = body as Record<string, unknown>;
  if (!isId(b.proposal_id)) return err("Proposta non valida");
  switch (b.action) {
    case "prepare_drafts":
      return ok({ type: "prepare_drafts", proposal_id: b.proposal_id });
    case "set_suitable":
      if (typeof b.value !== "boolean") return err("Valore non valido");
      return ok({
        type: "set_suitable",
        proposal_id: b.proposal_id,
        value: b.value,
      });
    default:
      return err("Azione sconosciuta");
  }
}

export async function applyAction(
  db: Client,
  a: Action,
): Promise<Result<{ done: string; request_id?: number }>> {
  const p = (
    await rows(
      db,
      "SELECT id, suitable, targets_json FROM call_proposals WHERE id = ?",
      [a.proposal_id],
    )
  )[0];
  if (!p) return err("Proposta non trovata");

  if (a.type === "set_suitable") {
    await db.execute({
      sql: "UPDATE call_proposals SET suitable = ? WHERE id = ?",
      args: [a.value ? 1 : 0, a.proposal_id],
    });
    return ok({
      done: a.value
        ? "Di nuovo adatta"
        : "Segnata non adatta: il motore non manda più avvisi",
    });
  }

  if (Number(p.suitable) === 0)
    return err("La proposta è segnata non adatta: rimettila adatta prima");
  if (!parseTargets(p.targets_json).some((t) => t.email))
    return err("Nessuna casa bersaglio ha un'email: non ci sono bozze da preparare");

  const payload = `${a.proposal_id} bozze`;
  const open = await rows(
    db,
    `SELECT id FROM radar_requests WHERE kind = 'call_proposal' AND payload = ?
     AND status IN ('pending', 'running') LIMIT 1`,
    [payload],
  );
  if (open.length)
    return ok({ done: "Richiesta già in corso", request_id: Number(open[0].id) });
  const res = await db.execute({
    sql: "INSERT INTO radar_requests(kind, payload) VALUES('call_proposal', ?)",
    args: [payload],
  });
  return ok({
    done: "Richiesta inviata al motore: di solito è pronta entro un minuto",
    request_id: Number(res.lastInsertRowid),
  });
}
