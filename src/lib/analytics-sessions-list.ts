import type { Client, InValue } from "@libsql/client";
import { BOT_SQL, HUMAN_SQL, UNVERIFIED_SQL, VERDICT_SQL } from "./bot-verdict";
import { filterSql, parseFilters, type Filters } from "./analytics-filters";
import { tableExists } from "./analytics-rollup";
import { err, ok, type Result } from "./result";

/**
 * Admin-only read side for the "Utenti" view: recent SESSIONS (one row = one
 * visit of one anonymous, daily-rotating visitor) and the timeline of one
 * session. Raw `sessions` only (kept 180 days).
 *
 * Privacy: the visitor hash never leaves this module. Callers only see
 * `user` = its first USER_ID_LEN hex chars, enough to tell rows apart inside
 * one day, useless to identify anyone (the hash rotates every UTC day).
 */

export const USER_ID_LEN = 6;
export const SESSIONS_RETENTION_DAYS = 180;
export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 100;
export const VERDICT_FILTERS = ["human", "unverified", "bot", "all"] as const;
export type VerdictFilter = (typeof VERDICT_FILTERS)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURSOR_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\|(\d{1,15})$/;
const LIVE_WINDOW = "-5 minutes";
const LIVE_MAX = 20;

export interface SessionsQuery {
  from: string;
  to: string;
  limit: number;
  cursor: { startedAt: string; id: number } | null;
  verdict: VerdictFilter;
  filters: Filters;
  withEvents: boolean;
}

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function encodeCursor(startedAt: string, id: number): string {
  return Buffer.from(`${startedAt}|${id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): { startedAt: string; id: number } | null {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(raw)) return null;
  const m = CURSOR_RE.exec(Buffer.from(raw, "base64url").toString("utf8"));
  return m ? { startedAt: m[1], id: Number(m[2]) } : null;
}

export function parseSessionsQuery(params: URLSearchParams, now = new Date()): Result<SessionsQuery> {
  const today = now.toISOString().slice(0, 10);
  const to = params.get("to") || today;
  if (!isRealDate(to)) return err("Invalid to date");
  const from = params.get("from") || shiftDay(to, -29);
  if (!isRealDate(from)) return err("Invalid from date");
  if (from > to) return err("from must not be after to");

  const rawLimit = params.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    if (!/^\d{1,4}$/.test(rawLimit)) return err("Invalid limit");
    limit = Number(rawLimit);
    if (limit < 1 || limit > MAX_LIMIT) return err(`limit must be 1..${MAX_LIMIT}`);
  }

  let cursor: SessionsQuery["cursor"] = null;
  const rawCursor = params.get("cursor");
  if (rawCursor) {
    cursor = decodeCursor(rawCursor);
    if (!cursor) return err("Invalid cursor");
  }

  const verdict = params.get("verdict") ?? "human";
  if (!(VERDICT_FILTERS as readonly string[]).includes(verdict)) return err("Invalid verdict");

  const filters = parseFilters(params);
  if (!filters.ok) return err(filters.error);

  const withEventsRaw = params.get("with_events");
  if (withEventsRaw !== null && withEventsRaw !== "0" && withEventsRaw !== "1") return err("Invalid with_events");

  return ok({
    from: from < shiftDay(today, -SESSIONS_RETENTION_DAYS) ? shiftDay(today, -SESSIONS_RETENTION_DAYS) : from,
    to,
    limit,
    cursor,
    verdict: verdict as VerdictFilter,
    filters: filters.value,
    withEvents: withEventsRaw === "1",
  });
}

const VERDICT_WHERE: Record<VerdictFilter, string> = {
  human: HUMAN_SQL,
  unverified: UNVERIFIED_SQL,
  bot: BOT_SQL,
  all: "1 = 1",
};

export interface SessionRow {
  id: number;
  user: string;
  started_at: string;
  last_seen_at: string;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  channel: string | null;
  referrer: string | null;
  entry_path: string | null;
  exit_path: string | null;
  pageviews: number;
  engaged_seconds: number;
  verdict: "human" | "unverified" | "bot";
  human: boolean;
  events_count: number;
}

export interface SessionsPage {
  sessions: SessionRow[];
  next_cursor: string | null;
  available: boolean;
}

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

// Browser/OS live on pageviews: the session's first pageview. The (visitor_hash, created_at)
// index serves the lookup, session_id only narrows it to the one visit.
const firstPageviewCol = (col: string) =>
  `(SELECT p.${col} FROM pageviews p WHERE p.visitor_hash = sessions.visitor_hash AND p.session_id = sessions.id ORDER BY p.id LIMIT 1)`;

export async function listSessions(db: Client, q: SessionsQuery): Promise<SessionsPage> {
  const empty: SessionsPage = { sessions: [], next_cursor: null, available: false };
  try {
    if (!(await tableExists(db, "sessions"))) return empty;
    const hasEvents = await tableExists(db, "events");
    const hasPageviews = await tableExists(db, "pageviews");
    if (q.withEvents && !hasEvents) return { ...empty, available: true };

    const where = [`day >= ? AND day <= ?`, VERDICT_WHERE[q.verdict]];
    const args: InValue[] = [q.from, q.to];
    if (q.cursor) {
      where.push(`(started_at < ? OR (started_at = ? AND id < ?))`);
      args.push(q.cursor.startedAt, q.cursor.startedAt, q.cursor.id);
    }
    if (q.withEvents) where.push(`EXISTS (SELECT 1 FROM events e WHERE e.session_id = sessions.id)`);

    const res = await db.execute({
      sql: `SELECT id, substr(visitor_hash, 1, ${USER_ID_LEN}) AS user, started_at, last_seen_at, country,
                   device_type AS device, channel, referrer, entry_path, exit_path, pageviews, engaged_seconds,
                   ${VERDICT_SQL} AS verdict,
                   ${hasPageviews ? firstPageviewCol("browser") : "NULL"} AS browser,
                   ${hasPageviews ? firstPageviewCol("os") : "NULL"} AS os,
                   ${hasEvents ? "(SELECT COUNT(*) FROM events e WHERE e.session_id = sessions.id)" : "0"} AS events_count
            FROM sessions
            WHERE ${where.join(" AND ")}${filterSql(q.filters)}
            ORDER BY started_at DESC, id DESC
            LIMIT ${q.limit + 1}`,
      args,
    });

    const page = res.rows.slice(0, q.limit);
    const sessions: SessionRow[] = page.map((r) => ({
      id: Number(r.id),
      user: String(r.user),
      started_at: String(r.started_at),
      last_seen_at: String(r.last_seen_at),
      country: str(r.country),
      device: str(r.device),
      browser: str(r.browser),
      os: str(r.os),
      channel: str(r.channel),
      referrer: str(r.referrer),
      entry_path: str(r.entry_path),
      exit_path: str(r.exit_path),
      pageviews: Number(r.pageviews) || 0,
      engaged_seconds: Number(r.engaged_seconds) || 0,
      verdict: String(r.verdict) as SessionRow["verdict"],
      human: String(r.verdict) === "human",
      events_count: Number(r.events_count) || 0,
    }));
    const last = sessions[sessions.length - 1];
    return {
      sessions,
      next_cursor: res.rows.length > q.limit && last ? encodeCursor(last.started_at, last.id) : null,
      available: true,
    };
  } catch (e) {
    console.error("[stats/sessions] query failed", e);
    return empty;
  }
}

export interface SessionDetail {
  session: SessionRow & { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; language: string | null };
  pageviews: Array<{
    path: string;
    at: string;
    time_on_page: number | null;
    scroll_depth: number | null;
    lcp_ms: number | null;
    inp_ms: number | null;
    cls: number | null;
  }>;
  events: Array<{ name: string; prop: string | null; path: string | null; at: string }>;
}

async function pageviewColumns(db: Client): Promise<Set<string>> {
  const res = await db.execute("PRAGMA table_info(pageviews)");
  return new Set(res.rows.map((r) => String(r.name)));
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** null = no such session (or no sessions table). */
export async function getSessionDetail(db: Client, id: number): Promise<SessionDetail | null> {
  try {
    if (!(await tableExists(db, "sessions"))) return null;
    const hasEvents = await tableExists(db, "events");
    const cols = await pageviewColumns(db);
    const col = (c: string) => (cols.has(c) ? `p.${c}` : "NULL");

    const head = await db.execute({
      sql: `SELECT id, substr(visitor_hash, 1, ${USER_ID_LEN}) AS user, visitor_hash, started_at, last_seen_at, country, device_type AS device,
                   channel, referrer, entry_path, exit_path, pageviews, engaged_seconds, ${VERDICT_SQL} AS verdict
            FROM sessions WHERE id = ?`,
      args: [id],
    });
    const s = head.rows[0];
    if (!s) return null;
    const hash = String(s.visitor_hash);

    const [pv, ev] = await Promise.all([
      db.execute({
        sql: `SELECT p.pathname, p.created_at, p.time_on_page, p.scroll_depth, ${col("lcp_ms")} AS lcp_ms, ${col("inp_ms")} AS inp_ms,
                     ${col("cls_milli")} AS cls_milli, p.browser, p.os, p.language, p.utm_source, p.utm_medium, p.utm_campaign
              FROM pageviews p WHERE p.visitor_hash = ? AND p.session_id = ? ORDER BY p.created_at, p.id`,
        args: [hash, id],
      }),
      hasEvents
        ? db.execute({
            sql: `SELECT name, prop, path, created_at FROM events WHERE session_id = ? ORDER BY created_at, id`,
            args: [id],
          })
        : Promise.resolve({ rows: [] }),
    ]);

    const first = pv.rows[0];
    return {
      session: {
        id: Number(s.id),
        user: String(s.user),
        started_at: String(s.started_at),
        last_seen_at: String(s.last_seen_at),
        country: str(s.country),
        device: str(s.device),
        browser: str(first?.browser),
        os: str(first?.os),
        channel: str(s.channel),
        referrer: str(s.referrer),
        entry_path: str(s.entry_path),
        exit_path: str(s.exit_path),
        pageviews: Number(s.pageviews) || 0,
        engaged_seconds: Number(s.engaged_seconds) || 0,
        verdict: String(s.verdict) as SessionRow["verdict"],
        human: String(s.verdict) === "human",
        events_count: ev.rows.length,
        utm_source: str(first?.utm_source),
        utm_medium: str(first?.utm_medium),
        utm_campaign: str(first?.utm_campaign),
        language: str(first?.language),
      },
      pageviews: pv.rows.map((r) => ({
        path: String(r.pathname),
        at: String(r.created_at),
        time_on_page: num(r.time_on_page),
        scroll_depth: num(r.scroll_depth),
        lcp_ms: num(r.lcp_ms),
        inp_ms: num(r.inp_ms),
        cls: r.cls_milli == null ? null : Number(r.cls_milli) / 1000,
      })),
      events: ev.rows.map((r) => ({ name: String(r.name), prop: str(r.prop), path: str(r.path), at: String(r.created_at) })),
    };
  } catch (e) {
    console.error("[stats/sessions/:id] query failed", e);
    return null;
  }
}

export interface ActiveSession {
  user: string;
  country: string | null;
  device: string | null;
  path: string | null;
  last_seen_at: string;
}

/** Sessions seen in the last 5 minutes, bots excluded (humans + unverified), most recent first. */
export async function listActiveSessions(db: Client): Promise<ActiveSession[]> {
  const res = await db.execute({
    sql: `SELECT substr(visitor_hash, 1, ${USER_ID_LEN}) AS user, country, device_type AS device, exit_path AS path, last_seen_at
          FROM sessions
          WHERE last_seen_at > datetime('now', '${LIVE_WINDOW}') AND NOT ${BOT_SQL}
          ORDER BY last_seen_at DESC, id DESC LIMIT ${LIVE_MAX}`,
    args: [],
  });
  return res.rows.map((r) => ({
    user: String(r.user),
    country: str(r.country),
    device: str(r.device),
    path: str(r.path),
    last_seen_at: String(r.last_seen_at),
  }));
}
