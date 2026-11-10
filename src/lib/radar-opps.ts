// ═══════════════════════════════════════════════════════════════
// Opportunità, scadenze della settimana e salute del motore radar — solo letture.
// Le opportunità le cerca il motore (opportunities:watch) e le salva in `opportunities`.
// Spec: docs/radar-bandi-spec.md ("Opportunità e salute del motore")
// ═══════════════════════════════════════════════════════════════
import type { Client } from "@libsql/client";
import { dayNumber, openNow, todayIso, type Session } from "~/lib/radar-calls";
import { regionName } from "~/lib/radar-regions";

type Row = Record<string, unknown>;

async function rows(db: Client, sql: string, args: (string | number)[] = []): Promise<Row[]> {
  const res = await db.execute({ sql, args });
  return res.rows.map((r) => ({ ...r }) as Row);
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export type Opportunity = {
  id: number;
  title: string;
  kind: string | null;
  organizer: string | null;
  url: string | null;
  deadline: string | null;
  days_left: number | null;
  status: string;
  amount_text: string | null;
  location: string | null;
  eligibility: string | null;
  summary: string | null;
  fits: string | null;
};

export function toOpportunity(r: Row, today: string): Opportunity {
  const t = dayNumber(today);
  const d = dayNumber(r.deadline);
  return {
    id: Number(r.id),
    title: String(r.title ?? ""),
    kind: str(r.kind),
    organizer: str(r.organizer),
    url: str(r.url),
    deadline: d === null ? null : String(r.deadline).slice(0, 10),
    days_left: d !== null && t !== null ? d - t : null,
    status: String(r.status ?? "unknown"),
    amount_text: str(r.amount_text),
    location: str(r.location),
    eligibility: str(r.eligibility),
    summary: str(r.summary),
    fits: str(r.fits),
  };
}

// Aperte con scadenza futura per prime (la più vicina in alto), poi quelle senza data.
export function splitOpportunities(list: Opportunity[]) {
  const live = list.filter((o) => o.status === "open" && (o.days_left === null || o.days_left >= 0));
  const dated = live.filter((o) => o.days_left !== null).sort((a, b) => a.days_left! - b.days_left!);
  const undated = live.filter((o) => o.days_left === null);
  const past = list
    .filter((o) => !live.includes(o))
    .sort((a, b) => String(b.deadline ?? "").localeCompare(String(a.deadline ?? "")));
  return { open: [...dated, ...undated], past };
}

export async function loadOpportunities(db: Client, today = todayIso()) {
  const [opps, agenda] = await Promise.all([
    rows(
      db,
      `SELECT id, title, kind, organizer, url, deadline, status, amount_text, location, eligibility, summary, fits
       FROM opportunities`,
    ),
    rows(
      db,
      `SELECT id, name, type, deadline, project, url, cost FROM deadlines
       WHERE deadline >= ? ORDER BY deadline LIMIT 60`,
      [today],
    ),
  ]);
  const split = splitOpportunities(opps.map((r) => toOpportunity(r, today)));
  const openTitles = new Set(split.open.map((o) => o.title.toLowerCase()));
  return {
    today,
    ...split,
    // Agenda del motore: scadenze fuori da `opportunities`, senza doppioni per titolo.
    agenda: agenda
      .filter((d) => !openTitles.has(String(d.name ?? "").toLowerCase()))
      .map((d) => ({
        id: Number(d.id),
        name: String(d.name ?? ""),
        type: str(d.type),
        project: str(d.project),
        url: str(d.url),
        cost: str(d.cost),
        deadline: String(d.deadline).slice(0, 10),
        days_left: dayNumber(d.deadline)! - dayNumber(today)!,
      })),
  };
}

// ─── Scadenze della settimana (home admin) ─────────────────────

export type WeekItem = {
  kind: "opportunita" | "bando";
  title: string;
  detail: string;
  days_left: number;
  href: string;
};

export function mergeWeek(items: WeekItem[], limit = 6): WeekItem[] {
  return [...items].sort((a, b) => a.days_left - b.days_left).slice(0, limit);
}

export async function loadWeek(db: Client, today = todayIso(), horizon = 14) {
  const [opps, calls, sessions] = await Promise.all([
    rows(db, "SELECT id, title, kind, organizer, url, deadline, status FROM opportunities WHERE status = 'open'"),
    rows(db, "SELECT id, region, title, official_url FROM regional_calls WHERE sheet_kind = 'bando'"),
    rows(db, "SELECT id, call_id, opens, closes, status FROM call_sessions"),
  ]);
  const items: WeekItem[] = [];
  for (const o of opps.map((r) => toOpportunity(r, today))) {
    if (o.days_left !== null && o.days_left >= 0 && o.days_left <= horizon)
      items.push({
        kind: "opportunita",
        title: o.title,
        detail: [o.kind, o.organizer].filter(Boolean).join(" · "),
        days_left: o.days_left,
        href: "/admin/bandi/opportunita",
      });
  }
  const typed: Session[] = sessions.map((s) => ({
    id: Number(s.id),
    call_id: Number(s.call_id),
    opens: str(s.opens),
    closes: str(s.closes),
    status: str(s.status),
  }));
  for (const c of openNow(calls, typed, today)) {
    if (c.days_left !== null && c.days_left <= horizon)
      items.push({
        kind: "bando",
        title: c.title,
        detail: regionName(c.region),
        days_left: c.days_left,
        href: `/admin/bandi/regione/${c.region}`,
      });
  }
  return mergeWeek(items);
}

// ─── Salute del motore ─────────────────────────────────────────

// Cicli frequenti: se il battito è più vecchio di così, il motore (o il NAS) è fermo.
export const FAST_JOBS: Record<string, number> = { requests: 30, inbox: 60, send: 120 };

export type EngineProblem = { job: string; text: string };
export type EngineHealth = {
  ok: boolean;
  sending: "attivo" | "spento" | "in pausa";
  last_beat: string | null;
  problems: EngineProblem[];
  jobs: { job: string; status: string; at: string; note: string | null }[];
};

export const parseDbTime = (s: unknown): number | null => {
  if (typeof s !== "string" || !s.trim()) return null;
  const t = Date.parse(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(t) ? null : t;
};

export function summarizeHealth(
  latestRuns: Row[],
  settings: Record<string, string>,
  now = new Date(),
): EngineHealth {
  const problems: EngineProblem[] = [];
  const jobs = latestRuns.map((r) => ({
    job: String(r.job),
    status: String(r.status ?? ""),
    at: String(r.started_at ?? ""),
    note: str(r.note),
  }));
  for (const j of jobs) {
    // I cicli frequenti (send, inbox, requests) entrano nello storico solo se falliscono: un battito più
    // recente dell'errore vuol dire che i giri dopo sono andati bene.
    const beat = parseDbTime(settings[`hb_${j.job}`]);
    const recovered = beat !== null && beat > (parseDbTime(j.at) ?? Infinity);
    if (j.status === "error" && !recovered)
      problems.push({ job: j.job, text: `ultimo giro in errore${j.note ? `: ${j.note}` : ""}` });
  }
  for (const [job, maxMin] of Object.entries(FAST_JOBS)) {
    const beat = parseDbTime(settings[`hb_${job}`]);
    if (beat === null) continue;
    const age = Math.round((now.getTime() - beat) / 60000);
    if (age > maxMin) problems.push({ job, text: `nessun battito da ${age} minuti` });
  }
  const beats = Object.entries(settings)
    .filter(([k]) => k.startsWith("hb_"))
    .map(([, v]) => parseDbTime(v))
    .filter((v): v is number => v !== null);
  return {
    ok: problems.length === 0,
    sending: settings.paused === "1" ? "in pausa" : settings.send_enabled === "1" ? "attivo" : "spento",
    last_beat: beats.length ? new Date(Math.max(...beats)).toISOString() : null,
    problems,
    jobs,
  };
}

export async function loadHealth(db: Client, now = new Date()): Promise<EngineHealth> {
  const [runs, st] = await Promise.all([
    rows(
      db,
      `SELECT job, started_at, status, note FROM radar_runs
       WHERE id IN (SELECT max(id) FROM radar_runs GROUP BY job) ORDER BY job`,
    ),
    rows(db, "SELECT key, value FROM radar_settings"),
  ]);
  return summarizeHealth(runs, Object.fromEntries(st.map((x) => [String(x.key), String(x.value)])), now);
}

// Per la home: un database lento o spento non deve rompere la pagina.
export async function loadRadarGlanceSafe(db: Client, today = todayIso()) {
  try {
    const [week, health] = await Promise.all([loadWeek(db, today), loadHealth(db)]);
    return { week, health };
  } catch (e) {
    console.error("[admin/home] radar", e);
    return null;
  }
}
