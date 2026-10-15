import type { Client, InStatement, InValue } from "@libsql/client";
import { GOALS, SESSIONS_GOAL_ID, type Goal } from "./analytics-goals";
import { BOUNCE_MAX_ENGAGED_SECONDS } from "./analytics-sessions";

/**
 * SQL for sessions / events / entry-exit / goals, shared by the daily rollup
 * (INSERT ... SELECT for one day) and by the raw reads of /api/stats (same
 * SELECT over several day ranges). One source => the two cannot drift apart.
 *
 * Every SELECT returns rows starting with (day, scope, ...) so callers can
 * either insert them as they are or fold them in JS.
 * `scopeExpr` is a predicate over the `sessions` columns (bot_score, human,
 * visitor_hash): an event belongs to the scope of its session.
 */

export type Range = [string, string];

export interface SessionQuery {
  table: "daily_sessions" | "daily_events" | "daily_entry_exit" | "daily_goals";
  columns: string[];
  sql: string;
  args: InValue[];
}

function dayCond(col: string, ranges: Range[]): { sql: string; args: string[] } {
  return {
    sql: `(${ranges.map(() => `(${col} >= ? AND ${col} <= ?)`).join(" OR ")})`,
    args: ranges.flat(),
  };
}

function goalEventCond(g: Goal): { sql: string; args: string[] } {
  const parts = ["e.name = ?"];
  const args = [g.event as string];
  if (g.pathPrefixes?.length) {
    parts.push(`(${g.pathPrefixes.map(() => "e.path LIKE ?").join(" OR ")})`);
    args.push(...g.pathPrefixes.map((p) => `${p}%`));
  }
  return { sql: parts.join(" AND "), args };
}

export function sessionQueries(opts: {
  scope: string;
  scopeExpr: string;
  ranges: Range[];
  hasEvents: boolean;
  goals?: Goal[];
}): SessionQuery[] {
  const { scope, scopeExpr, ranges } = opts;
  const goals = opts.goals ?? GOALS;
  const sd = dayCond("day", ranges);
  const out: SessionQuery[] = [];
  const S = `'${scope}'`;

  out.push({
    table: "daily_sessions",
    columns: ["day", "scope", "sessions", "bounced_sessions", "pageviews", "engaged_seconds"],
    sql: `SELECT day, ${S}, COUNT(*),
            COALESCE(SUM(CASE WHEN pageviews = 1 AND engaged_seconds < ${BOUNCE_MAX_ENGAGED_SECONDS} THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(pageviews), 0), COALESCE(SUM(engaged_seconds), 0)
          FROM sessions WHERE ${sd.sql} AND ${scopeExpr} GROUP BY day`,
    args: sd.args,
  });

  for (const [kind, col] of [
    ["entry", "entry_path"],
    ["exit", "exit_path"],
  ] as const) {
    out.push({
      table: "daily_entry_exit",
      columns: ["day", "scope", "kind", "path", "sessions"],
      sql: `SELECT day, ${S}, '${kind}', ${col} AS p, COUNT(*)
            FROM sessions WHERE ${sd.sql} AND ${scopeExpr} AND ${col} IS NOT NULL GROUP BY day, p`,
      args: sd.args,
    });
  }

  // Sessions per channel / entry page: denominators of the goal rates.
  for (const [dim, expr] of [
    ["channel", "COALESCE(channel, '(none)')"],
    ["entry", "COALESCE(entry_path, '(none)')"],
  ] as const) {
    out.push({
      table: "daily_goals",
      columns: ["day", "scope", "goal", "dim", "value", "conversions"],
      sql: `SELECT day, ${S}, '${SESSIONS_GOAL_ID}', '${dim}', ${expr} AS v, COUNT(*)
            FROM sessions WHERE ${sd.sql} AND ${scopeExpr} GROUP BY day, v`,
      args: sd.args,
    });
  }

  if (opts.hasEvents) {
    const ed = dayCond("day", ranges);
    out.push({
      table: "daily_events",
      columns: ["day", "scope", "name", "prop", "count", "visitors"],
      sql: `SELECT day, ${S}, name, COALESCE(prop, '') AS p, COUNT(*), COUNT(DISTINCT visitor_hash)
            FROM events
            WHERE ${ed.sql}
              AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = events.session_id AND ${scopeExpr})
            GROUP BY day, name, p`,
      args: ed.args,
    });
    for (const g of goals) {
      const gc = goalEventCond(g);
      const exists = `EXISTS (SELECT 1 FROM events e WHERE e.session_id = sessions.id AND ${gc.sql})`;
      for (const [dim, expr] of [
        ["total", "''"],
        ["channel", "COALESCE(channel, '(none)')"],
        ["entry", "COALESCE(entry_path, '(none)')"],
      ] as const) {
        out.push({
          table: "daily_goals",
          columns: ["day", "scope", "goal", "dim", "value", "conversions"],
          sql: `SELECT day, ${S}, '${g.id}', '${dim}', ${expr} AS v, COUNT(*)
                FROM sessions WHERE ${sd.sql} AND ${scopeExpr} AND ${exists} GROUP BY day, v`,
          args: [...sd.args, ...gc.args],
        });
      }
    }
  }
  return out;
}

/** Statements that (re)build one day of the session rollups for one scope. */
export function rollupStatements(opts: {
  day: string;
  scope: string;
  scopeExpr: string;
  hasEvents: boolean;
}): InStatement[] {
  return sessionQueries({
    scope: opts.scope,
    scopeExpr: opts.scopeExpr,
    ranges: [[opts.day, opts.day]],
    hasEvents: opts.hasEvents,
  }).map((q) => ({
    sql: `INSERT INTO ${q.table} (${q.columns.join(", ")}) ${q.sql}`,
    args: q.args,
  }));
}

export const SESSION_ROLLUP_TABLES = [
  "daily_sessions",
  "daily_events",
  "daily_entry_exit",
  "daily_goals",
] as const;

// ---------------------------------------------------------------------------
// Read side (hybrid: rolled-up days from daily_*, the rest from raw).
// ---------------------------------------------------------------------------

export interface SessionStatsOpts {
  /** Days read from rollups (closed + rolled) and days read from raw. */
  rolledDays: string[];
  rawRanges: Range[];
  scope: "human" | "all";
  /** Predicate over `sessions` columns for the raw read. */
  scopeExpr: string;
  hasEvents: boolean;
  totalsOnly?: boolean;
}

export interface GoalStats {
  id: string;
  label: string;
  conversions: number;
  rate: number;
  by_channel: Array<{ channel: string; conversions: number; sessions: number; rate: number }>;
  by_entry: Array<{ path: string; conversions: number; sessions: number; rate: number }>;
}

export interface SessionStats {
  available: boolean;
  count: number;
  bounced: number;
  pageviews: number;
  engagedSeconds: number;
  channels: Array<{ channel: string; sessions: number }>;
  entryPages: Array<{ path: string; sessions: number }>;
  exitPages: Array<{ path: string; sessions: number }>;
  events: Array<{ name: string; prop: string | null; count: number; visitors: number }>;
  goals: GoalStats[];
}

const n = (v: unknown) => Number(v) || 0;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const emptySessionStats = (): SessionStats => ({
  available: false,
  count: 0,
  bounced: 0,
  pageviews: 0,
  engagedSeconds: 0,
  channels: [],
  entryPages: [],
  exitPages: [],
  events: [],
  goals: [],
});

function bump(m: Map<string, number[]>, key: string, ...vals: number[]) {
  const cur = m.get(key) ?? new Array<number>(vals.length).fill(0);
  vals.forEach((v, i) => (cur[i] += v));
  m.set(key, cur);
}

export async function computeSessionStats(
  db: Client,
  o: SessionStatsOpts,
): Promise<SessionStats> {
  const goals = GOALS;
  const totals = { count: 0, bounced: 0, pv: 0, eng: 0 };
  const entry = new Map<string, number[]>();
  const exit = new Map<string, number[]>();
  const events = new Map<string, number[]>();
  const chanSessions = new Map<string, number[]>();
  const entrySessions = new Map<string, number[]>();
  const goalTotal = new Map<string, number>();
  const goalChan = new Map<string, Map<string, number[]>>();
  const goalEntry = new Map<string, Map<string, number[]>>();

  // Both sources are folded through the same function, whatever their shape.
  const fold = (table: SessionQuery["table"], r: Record<string, unknown>) => {
    if (table === "daily_sessions") {
      totals.count += n(r.sessions);
      totals.bounced += n(r.bounced_sessions);
      totals.pv += n(r.pageviews);
      totals.eng += n(r.engaged_seconds);
    } else if (table === "daily_entry_exit") {
      if (!o.totalsOnly) bump(r.kind === "entry" ? entry : exit, String(r.path), n(r.sessions));
    } else if (table === "daily_events") {
      if (!o.totalsOnly) bump(events, `${String(r.name)}\u0000${String(r.prop ?? "")}`, n(r.count), n(r.visitors));
    } else {
      const goal = String(r.goal);
      const dim = String(r.dim);
      const value = String(r.value);
      const c = n(r.conversions);
      if (goal === SESSIONS_GOAL_ID) {
        if (o.totalsOnly) return;
        bump(dim === "channel" ? chanSessions : entrySessions, value, c);
      } else if (dim === "total") {
        goalTotal.set(goal, (goalTotal.get(goal) ?? 0) + c);
      } else if (!o.totalsOnly) {
        const target = dim === "channel" ? goalChan : goalEntry;
        const m = target.get(goal) ?? new Map<string, number[]>();
        bump(m, value, c);
        target.set(goal, m);
      }
    }
  };

  if (o.rawRanges.length > 0) {
    const qs = sessionQueries({
      scope: o.scope,
      scopeExpr: o.scopeExpr,
      ranges: o.rawRanges,
      hasEvents: o.hasEvents,
      goals,
    });
    const rs = await Promise.all(qs.map((q) => db.execute({ sql: q.sql, args: q.args })));
    qs.forEach((q, i) => {
      for (const row of rs[i].rows) {
        const rec: Record<string, unknown> = {};
        q.columns.forEach((c, j) => (rec[c] = row[j]));
        fold(q.table, rec);
      }
    });
  }

  if (o.rolledDays.length > 0) {
    const inDays = `day IN (${o.rolledDays.map(() => "?").join(",")})`;
    const base = [o.scope, ...o.rolledDays];
    const q = (sql: string) => db.execute({ sql, args: base });
    const [s, ee, ev, gl] = await Promise.all([
      q(`SELECT SUM(sessions) AS sessions, SUM(bounced_sessions) AS bounced_sessions, SUM(pageviews) AS pageviews, SUM(engaged_seconds) AS engaged_seconds FROM daily_sessions WHERE scope = ? AND ${inDays}`),
      o.totalsOnly
        ? Promise.resolve({ rows: [] })
        : q(`SELECT kind, path, SUM(sessions) AS sessions FROM daily_entry_exit WHERE scope = ? AND ${inDays} GROUP BY kind, path`),
      o.totalsOnly || !o.hasEvents
        ? Promise.resolve({ rows: [] })
        : q(`SELECT name, prop, SUM(count) AS count, SUM(visitors) AS visitors FROM daily_events WHERE scope = ? AND ${inDays} GROUP BY name, prop`),
      q(`SELECT goal, dim, value, SUM(conversions) AS conversions FROM daily_goals WHERE scope = ? AND ${inDays}${o.totalsOnly ? " AND dim = 'total'" : ""} GROUP BY goal, dim, value`),
    ]);
    fold("daily_sessions", s.rows[0] as Record<string, unknown>);
    for (const r of ee.rows) fold("daily_entry_exit", r as Record<string, unknown>);
    for (const r of ev.rows) fold("daily_events", r as Record<string, unknown>);
    for (const r of gl.rows) fold("daily_goals", r as Record<string, unknown>);
  }

  const ranked = (m: Map<string, number[]>, limit: number) =>
    [...m.entries()].sort((a, b) => b[1][0] - a[1][0] || cmp(a[0], b[0])).slice(0, limit);

  const goalStats: GoalStats[] = goals.map((g) => {
    const conversions = goalTotal.get(g.id) ?? 0;
    const rows = (target: Map<string, Map<string, number[]>>, denom: Map<string, number[]>) =>
      ranked(target.get(g.id) ?? new Map(), 10).map(([value, [c]]) => {
        const sessions = denom.get(value)?.[0] ?? 0;
        return { value, conversions: c, sessions, rate: pct(c, sessions) };
      });
    return {
      id: g.id,
      label: g.label,
      conversions,
      rate: pct(conversions, totals.count),
      by_channel: rows(goalChan, chanSessions).map(({ value, ...x }) => ({ channel: value, ...x })),
      by_entry: rows(goalEntry, entrySessions).map(({ value, ...x }) => ({ path: value, ...x })),
    };
  });

  return {
    available: true,
    count: totals.count,
    bounced: totals.bounced,
    pageviews: totals.pv,
    engagedSeconds: totals.eng,
    channels: ranked(chanSessions, 1e9).map(([channel, [sessions]]) => ({ channel, sessions })),
    entryPages: ranked(entry, 10).map(([path, [sessions]]) => ({ path, sessions })),
    exitPages: ranked(exit, 10).map(([path, [sessions]]) => ({ path, sessions })),
    events: ranked(events, 50).map(([k, [count, visitors]]) => {
      const [name, prop] = k.split("\u0000");
      return { name, prop: prop === "" ? null : prop, count, visitors };
    }),
    goals: goalStats,
  };
}
