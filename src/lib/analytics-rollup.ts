import type { Client, InStatement } from "@libsql/client";
import { BOT_SCORE_THRESHOLD } from "./bot-score";
import { BOT_SQL, HUMAN_SQL } from "./bot-verdict";
import { SECTION_SQL } from "./analytics-sql";
import { ROLLUP_DDL } from "./analytics-rollup-schema";
import { isoDate, subtractDays } from "./date-range";
import { buildVitalsRows } from "./analytics-vitals";
import { SESSION_ROLLUP_TABLES, rollupStatements } from "./analytics-session-stats";

export type Scope = "human" | "all";
export const SCOPES: Scope[] = ["human", "all"];
/** daily_dims.value for a NULL referrer (PK columns cannot be NULL). */
export const NULL_VALUE = "\u0001null";
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 1000;

export interface Caps {
  columns: Set<string>;
  botHashes: boolean;
  /** Phase 2 raw tables (absent until the migration is applied). */
  sessions: boolean;
  events: boolean;
}

const ensured = new WeakSet<Client>();
export async function ensureRollupTables(db: Client): Promise<void> {
  if (ensured.has(db)) return;
  await db.executeMultiple(ROLLUP_DDL);
  ensured.add(db);
}

export async function tableExists(db: Client, name: string): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

async function tableColumns(db: Client, table: string): Promise<Set<string>> {
  const r = await db.execute(`PRAGMA table_info(${table})`);
  return new Set(r.rows.map((x) => String(x.name)));
}

export async function detectCaps(db: Client): Promise<Caps> {
  return {
    columns: await tableColumns(db, "pageviews"),
    botHashes: await tableExists(db, "bot_hashes"),
    sessions: await tableExists(db, "sessions"),
    events: await tableExists(db, "events"),
  };
}

/**
 * Scope predicates. With every phase-4 column present they are EXACTLY the
 * verdict helpers of bot-verdict.ts; when a later migration is missing they
 * degrade (no bot_score -> nobody is a bot by score, no human column -> the
 * human scope is empty, no bot_hashes -> no legacy flags).
 */
export function scopeSql(caps: Caps): Record<Scope, string> {
  const hasScore = caps.columns.has("bot_score");
  const hasHuman = caps.columns.has("human");
  if (hasScore && hasHuman && caps.botHashes) {
    return { human: HUMAN_SQL, all: `(NOT ${BOT_SQL})` };
  }
  const parts: string[] = [];
  if (hasScore) parts.push(`COALESCE(bot_score, 0) >= ${BOT_SCORE_THRESHOLD}`);
  if (caps.botHashes)
    parts.push(
      "(visitor_hash IS NOT NULL AND visitor_hash IN (SELECT hash FROM bot_hashes))",
    );
  const bot = parts.length ? `(${parts.join(" OR ")})` : "0";
  return {
    human: hasHuman ? `(NOT ${bot} AND COALESCE(human, 0) = 1)` : "0",
    all: `(NOT ${bot})`,
  };
}

/** dim -> SQL expression (+ whether NULL values are skipped) and required column. */
const DIMS: Array<{ dim: string; expr: string; column: string; skipNull: boolean }> = [
  { dim: "referrer", expr: `COALESCE(referrer, '${NULL_VALUE}')`, column: "referrer", skipNull: false },
  { dim: "channel", expr: "channel", column: "channel", skipNull: true },
  { dim: "country", expr: "country", column: "country", skipNull: true },
  { dim: "browser", expr: "browser", column: "browser", skipNull: true },
  { dim: "os", expr: "os", column: "os", skipNull: true },
  { dim: "device", expr: "device_type", column: "device_type", skipNull: true },
  { dim: "lang", expr: "SUBSTR(language, 1, 2)", column: "language", skipNull: true },
  { dim: "utm_source", expr: "utm_source", column: "utm_source", skipNull: true },
  { dim: "utm_campaign", expr: "utm_campaign", column: "utm_campaign", skipNull: true },
  { dim: "section", expr: `(${SECTION_SQL})`, column: "pathname", skipNull: false },
];

const DAY_WHERE = "created_at >= ? AND created_at < datetime(?, '+1 day')";

export interface RollupResult {
  day: string;
  rowsIn: number;
}

/**
 * (Re)computes one UTC day from raw pageviews. Idempotent: old rollup rows of
 * the day are deleted and the new ones inserted in ONE write batch. A day with
 * no rows (in a scope) gets no daily_* rows; rollup_log still records it, so
 * readers know the day is closed and the chart simply has no point for it.
 */
export async function rollupDay(
  db: Client,
  day: string,
  caps?: Caps,
): Promise<RollupResult> {
  const stmts = await buildRollupStatements(db, day, caps);
  await db.batch(stmts, "write");
  const log = await db.execute({
    sql: "SELECT rows_in FROM rollup_log WHERE day = ?",
    args: [day],
  });
  return { day, rowsIn: Number(log.rows[0]?.rows_in) || 0 };
}

/**
 * The statements rollupDay runs, in order (the first ones delete the day's old rows). Exposed so
 * scripts/analytics-sql-check.ts can dry-run them one by one against a real database.
 */
export async function buildRollupStatements(
  db: Client,
  day: string,
  caps?: Caps,
): Promise<InStatement[]> {
  if (!DAY_RE.test(day)) throw new Error(`Invalid day: ${day}`);
  await ensureRollupTables(db);
  const c = caps ?? (await detectCaps(db));
  const scopes = scopeSql(c);
  const has = (col: string) => c.columns.has(col);
  const sel = (col: string) => (has(col) ? col : "NULL");

  const stmts: InStatement[] = [
    { sql: "DELETE FROM daily_stats WHERE day = ?", args: [day] },
    { sql: "DELETE FROM daily_pages WHERE day = ?", args: [day] },
    { sql: "DELETE FROM daily_dims WHERE day = ?", args: [day] },
    ...SESSION_ROLLUP_TABLES.map((t) => ({ sql: `DELETE FROM ${t} WHERE day = ?`, args: [day] })),
    { sql: "DELETE FROM daily_vitals WHERE day = ?", args: [day] },
    { sql: "DELETE FROM rollup_log WHERE day = ?", args: [day] },
  ];

  const time = sel("time_on_page");
  const scroll = sel("scroll_depth");
  for (const scope of SCOPES) {
    const where = `${DAY_WHERE} AND ${scopes[scope]}`;
    const args = [day, scope, day, day];
    stmts.push({
      // No "HAVING COUNT(*) > 0" without GROUP BY: the Turso server's SQL parser rejects it (local SQLite accepts it).
      sql: `INSERT INTO daily_stats (day, scope, pageviews, visitors, bounced, sum_time, n_time, sum_scroll, n_scroll)
            SELECT d, s, pv, vis, bounced, st, nt, ss, ns FROM (
              SELECT ? AS d, ? AS s, COUNT(*) AS pv, COALESCE(SUM(is_unique), 0) AS vis,
                COALESCE(SUM(CASE WHEN is_unique = 1 AND (${time} IS NULL OR ${time} < 5) THEN 1 ELSE 0 END), 0) AS bounced,
                COALESCE(SUM(${time}), 0) AS st, COUNT(${time}) AS nt,
                COALESCE(SUM(${scroll}), 0) AS ss, COUNT(${scroll}) AS ns
              FROM pageviews WHERE ${where}
            ) WHERE pv > 0`,
      args,
    });
    stmts.push({
      sql: `INSERT INTO daily_pages (day, scope, pathname, pageviews, visitors, sum_time, n_time, sum_scroll, n_scroll, tp_visitors, tp_sum_scroll, tp_n_scroll)
            SELECT ?, ?, pathname, COUNT(*), COALESCE(SUM(is_unique), 0),
              COALESCE(SUM(${time}), 0), COUNT(${time}), COALESCE(SUM(${scroll}), 0), COUNT(${scroll}),
              COALESCE(SUM(CASE WHEN ${time} IS NOT NULL THEN is_unique END), 0),
              COALESCE(SUM(CASE WHEN ${time} IS NOT NULL THEN ${scroll} END), 0),
              COUNT(CASE WHEN ${time} IS NOT NULL THEN ${scroll} END)
            FROM pageviews WHERE ${where} GROUP BY pathname`,
      args,
    });
    for (const d of DIMS) {
      if (!has(d.column)) continue;
      stmts.push({
        sql: `INSERT INTO daily_dims (day, scope, dim, value, pageviews, visitors)
              SELECT ?, ?, '${d.dim}', ${d.expr} AS v, COUNT(*), COALESCE(SUM(is_unique), 0)
              FROM pageviews WHERE ${where}${d.skipNull ? ` AND ${d.expr} IS NOT NULL` : ""} GROUP BY v`,
        args,
      });
    }
    // Phase 5: Web Vitals. p75 needs the sorted values of the day, so they are read here
    // (exact) and the resulting rows are inserted in the same batch.
    if (has("lcp_ms") && has("cls_milli") && has("inp_ms")) {
      const raw = await db.execute({
        sql: `SELECT ${sel("device_type")} AS d, lcp_ms, cls_milli, inp_ms FROM pageviews
              WHERE ${where} AND (lcp_ms IS NOT NULL OR cls_milli IS NOT NULL OR inp_ms IS NOT NULL)`,
        args: [day, day],
      });
      const rows = buildVitalsRows(
        raw.rows.map((r) => ({
          device: r.d == null ? null : String(r.d),
          lcp: r.lcp_ms == null ? null : Number(r.lcp_ms),
          inp: r.inp_ms == null ? null : Number(r.inp_ms),
          cls: r.cls_milli == null ? null : Number(r.cls_milli),
        })),
      );
      for (const v of rows) {
        stmts.push({
          sql: `INSERT INTO daily_vitals (day, scope, device, metric, n, good, ni, poor, p75) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [day, scope, v.device, v.metric, v.n, v.good, v.ni, v.poor, v.p75],
        });
      }
    }
    // Phase 2: sessions are scoped by their own bot_score/human (inherited from their pageviews).
    if (c.sessions) {
      stmts.push(
        ...rollupStatements({ day, scope, scopeExpr: scopes[scope], hasEvents: c.events }),
      );
    }
  }
  stmts.push({
    sql: `INSERT INTO rollup_log (day, computed_at, rows_in)
          SELECT ?, datetime('now'), COUNT(*) FROM pageviews WHERE ${DAY_WHERE}`,
    args: [day, day, day],
  });

  return stmts;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const end = new Date(to + "T00:00:00Z");
  for (
    let d = new Date(from + "T00:00:00Z");
    d <= end && out.length <= MAX_RANGE_DAYS;
    d = subtractDays(d, -1)
  ) {
    out.push(isoDate(d));
  }
  return out;
}

/** Rolls up every day in [from, to] (inclusive), sequentially. */
export async function rollupRange(
  db: Client,
  from: string,
  to: string,
): Promise<RollupResult[]> {
  if (!DAY_RE.test(from) || !DAY_RE.test(to)) throw new Error("Invalid date");
  const days = eachDay(from, to);
  if (days.length > MAX_RANGE_DAYS) throw new Error("Range too large");
  const caps = await detectCaps(db);
  const out: RollupResult[] = [];
  for (const day of days) out.push(await rollupDay(db, day, caps));
  return out;
}

/**
 * Best-effort: forget that these days were rolled up, so /api/stats reads them
 * from raw again (while raw exists) until the next rollup. Never throws.
 */
export async function invalidateDays(db: Client, days: string[]): Promise<number> {
  const valid = [...new Set(days.filter((d) => DAY_RE.test(d)))];
  if (valid.length === 0) return 0;
  try {
    const r = await db.execute({
      sql: `DELETE FROM rollup_log WHERE day IN (${valid.map(() => "?").join(",")})`,
      args: valid,
    });
    return r.rowsAffected;
  } catch {
    return 0;
  }
}

export interface PruneResult {
  deletedPageviews: number;
  deletedEvents: number;
  cleaned: string[];
}

const PRUNE_CHUNK = 5000;
const PRUNE_MAX_CHUNKS = 200;

/**
 * Retention: raw pageviews older than keepDays are deleted ONLY for days that
 * have a rollup_log entry (data that was never rolled up is never deleted).
 * Also purges short-lived tables when they exist. Sessions (phase 2) are kept
 * 180 days: the hook is ready and is a no-op until the table exists.
 */
export async function pruneRaw(
  db: Client,
  now: Date = new Date(),
  keepDays = 90,
): Promise<PruneResult> {
  const cleaned: string[] = [];
  let deleted = 0;
  if (await tableExists(db, "rollup_log")) {
    const cutoff = isoDate(subtractDays(now, keepDays));
    for (let i = 0; i < PRUNE_MAX_CHUNKS; i++) {
      const r = await db.execute({
        sql: `DELETE FROM pageviews WHERE id IN (
                SELECT id FROM pageviews
                WHERE created_at < ? AND date(created_at) IN (SELECT day FROM rollup_log)
                LIMIT ${PRUNE_CHUNK})`,
        args: [cutoff],
      });
      deleted += r.rowsAffected;
      if (r.rowsAffected < PRUNE_CHUNK) break;
    }
  }

  let deletedEvents = 0;
  try {
    // Events: 90 days like raw pageviews, and only for days that were rolled up.
    if ((await tableExists(db, "events")) && (await tableExists(db, "rollup_log"))) {
      const cutoff = isoDate(subtractDays(now, keepDays));
      const r = await db.execute({
        sql: "DELETE FROM events WHERE day < ? AND day IN (SELECT day FROM rollup_log)",
        args: [cutoff],
      });
      deletedEvents = r.rowsAffected;
      cleaned.push("events");
    }
  } catch {
    // best effort
  }

  const sec7 = Math.floor(subtractDays(now, 7).getTime() / 1000);
  const iso7 = subtractDays(now, 7).toISOString();
  const day2 = isoDate(subtractDays(now, 2));
  const day180 = isoDate(subtractDays(now, 180));
  const jobs: Array<{ table: string; sql: string; arg: string | number }> = [
    // same 2-day rule as purgeOldSalts (analytics-salt.ts)
    { table: "analytics_salts", sql: "DELETE FROM analytics_salts WHERE day < ?", arg: day2 },
    { table: "daily_visitors", sql: "DELETE FROM daily_visitors WHERE day < ?", arg: day2 },
    { table: "rate_limits", sql: "DELETE FROM rate_limits WHERE window_start < ?", arg: sec7 },
    { table: "telegram_updates", sql: "DELETE FROM telegram_updates WHERE seen_at < ?", arg: iso7 },
    // sessions: 180 days, only days that were rolled up (the goals/entry rollups need them closed)
    {
      table: "sessions",
      sql: "DELETE FROM sessions WHERE day < ? AND day IN (SELECT day FROM rollup_log)",
      arg: day180,
    },
  ];
  for (const j of jobs) {
    try {
      if (!(await tableExists(db, j.table))) continue;
      await db.execute({ sql: j.sql, args: [j.arg] });
      cleaned.push(j.table);
    } catch {
      // best effort: never fail the job over housekeeping
    }
  }
  return { deletedPageviews: deleted, deletedEvents, cleaned };
}

/** What the scheduled job runs: yesterday + the day before (late beacons), then retention. */
export async function runDailyJob(db: Client, now: Date = new Date()) {
  const yesterday = isoDate(subtractDays(now, 1));
  const dayBefore = isoDate(subtractDays(now, 2));
  const rolled = await rollupRange(db, dayBefore, yesterday);
  const pruned = await pruneRaw(db, now, 90);
  return { rolled, pruned };
}
