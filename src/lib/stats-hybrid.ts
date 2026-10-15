import type { Client } from "@libsql/client";
import { BOT_SQL, HUMAN_SQL } from "./bot-verdict";
import { BLOG_PATH_SQL, SECTION_SQL } from "./analytics-sql";
import { filterSql, filtersActive, type Filters } from "./analytics-filters";
import { NULL_VALUE, eachDay, tableExists } from "./analytics-rollup";
import {
  computeSessionStats,
  emptySessionStats,
  type SessionStats,
} from "./analytics-session-stats";

/**
 * Hybrid stats: days strictly before today that have a rollup_log row are read
 * from the daily_* tables, every other day of the range from raw pageviews
 * (same queries as before, restricted to those days); the two are merged here.
 * Sums/counts are merged, averages are recomputed at the end (never averaged).
 *
 * Not rolled-up reads: `pathname` filter (rollups have no per-path breakdowns),
 * hourly charts (period=today / one-day range). Both read raw only.
 */

export interface BlockOpts {
  from: string;
  to: string;
  groupBy: string;
  pathname?: string;
  includeAll: boolean;
  /** UTC day, "YYYY-MM-DD". Days >= today are never read from rollups. */
  today: string;
  useRollup?: boolean;
  /** Only totals (used for the previous-period comparison). */
  totalsOnly?: boolean;
  /** Country / device / channel. Any active filter => raw rows only (no rollup has those cross-dimensions). */
  filters?: Filters;
  /** Do not truncate the lists (CSV export). */
  full?: boolean;
}

interface Totals {
  pageviews: number;
  visitors: number;
  bounced: number;
  sumTime: number;
  nTime: number;
  sumScroll: number;
  nScroll: number;
}
type Row = Record<string, string | number | null>;

export interface StatsBlock {
  totals: Totals;
  avgTime: number;
  avgScroll: number;
  chart: Row[];
  topPages: Row[];
  referrers: Row[];
  countries: Row[];
  browsers: Row[];
  os: Row[];
  devices: Row[];
  languages: Row[];
  utmSources: Row[];
  utmCampaigns: Row[];
  topEngaged: Row[];
  sections: Row[];
  channels: Row[];
  source: { rollup_days: number; raw_days: number };
}

const n = (v: unknown) => Number(v) || 0;
const NONE = -1; // SQLite: LIMIT -1 = no limit

function emptyTotals(): Totals {
  return { pageviews: 0, visitors: 0, bounced: 0, sumTime: 0, nTime: 0, sumScroll: 0, nScroll: 0 };
}

/** Contiguous runs of days -> [startDay, endDay]. */
function segments(days: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let prev = "";
  for (const d of days) {
    const last = out[out.length - 1];
    const next = prev
      ? new Date(new Date(prev + "T00:00:00Z").getTime() + 86_400_000).toISOString().slice(0, 10)
      : "";
    if (last && next === d) last[1] = d;
    else out.push([d, d]);
    prev = d;
  }
  return out;
}

export async function rolledDays(db: Client, o: BlockOpts): Promise<string[]> {
  if (o.useRollup === false || o.pathname || o.groupBy === "hour" || filtersActive(o.filters)) return [];
  try {
    const r = await db.execute({
      sql: "SELECT day FROM rollup_log WHERE day >= ? AND day <= ? AND day < ? ORDER BY day",
      args: [o.from, o.to, o.today],
    });
    return r.rows.map((x) => String(x.day));
  } catch {
    return []; // migration not applied yet: raw only
  }
}

/** value -> sums, merged across the raw and rollup parts. */
class Acc {
  private m = new Map<string, number[]>();
  constructor(private width: number) {}
  add(key: string, ...vals: number[]) {
    const cur = this.m.get(key) ?? new Array<number>(this.width).fill(0);
    vals.forEach((v, i) => (cur[i] += v));
    this.m.set(key, cur);
  }
  entries(): Array<[string, number[]]> {
    return [...this.m.entries()];
  }
}

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export async function computeBlock(db: Client, o: BlockOpts): Promise<StatsBlock> {
  const scope = o.includeAll ? "all" : "human";
  const rolled = await rolledDays(db, o);
  const rolledSet = new Set(rolled);
  const rawDays = eachDay(o.from, o.to).filter((d) => !rolledSet.has(d));
  const lim = (k: number) => (rolled.length === 0 && !o.full ? k : NONE);
  const top = (k: number) => (o.full ? 1e9 : k);

  const totals = emptyTotals();
  const chart = new Acc(2);
  const pages = new Acc(2);
  const sections = new Acc(2);
  const dimAcc: Record<string, Acc> = {};
  for (const d of ["referrer", "channel", "country", "browser", "os", "device", "lang", "utm_source", "utm_campaign"])
    dimAcc[d] = new Acc(1);
  const engaged = new Acc(5); // pv, visitors, sumTime, sumScroll, nScroll

  const monthly = o.groupBy === "month";
  const dateExpr =
    o.groupBy === "hour"
      ? "strftime('%Y-%m-%d %H:00', created_at)"
      : monthly
        ? "strftime('%Y-%m', created_at)"
        : "date(created_at)";

  // ---- raw part ----
  if (rawDays.length > 0) {
    const segs = segments(rawDays);
    const rangeSql = segs
      .map(() => "(created_at >= ? AND created_at < datetime(?, '+1 day'))")
      .join(" OR ");
    const rangeArgs = segs.flatMap(([a, b]) => [a, b]);
    const scopeSql = o.includeAll ? `(NOT ${BOT_SQL})` : HUMAN_SQL;
    const where = `WHERE (${rangeSql})${o.pathname ? " AND pathname = ?" : ""} AND ${scopeSql}${filterSql(o.filters)}`;
    const args = o.pathname ? [...rangeArgs, o.pathname] : rangeArgs;
    const q = (sql: string) => db.execute({ sql, args });
    const dimQuery = (expr: string, notNull: boolean, order: string, limit: number) =>
      q(
        `SELECT ${expr} as v, COALESCE(SUM(is_unique), 0) as visitors FROM pageviews ${where}${notNull ? ` AND ${expr} IS NOT NULL` : ""} GROUP BY v ORDER BY visitors DESC, v ${order} LIMIT ${limit}`,
      );

    const tot = await q(
      `SELECT COUNT(*) as pv, COALESCE(SUM(is_unique), 0) as vis,
         COALESCE(SUM(CASE WHEN is_unique = 1 AND (time_on_page IS NULL OR time_on_page < 5) THEN 1 ELSE 0 END), 0) as bounced,
         COALESCE(SUM(time_on_page), 0) as st, COUNT(time_on_page) as nt,
         COALESCE(SUM(scroll_depth), 0) as ss, COUNT(scroll_depth) as ns
       FROM pageviews ${where}`,
    );
    const t = tot.rows[0];
    totals.pageviews += n(t.pv);
    totals.visitors += n(t.vis);
    totals.bounced += n(t.bounced);
    totals.sumTime += n(t.st);
    totals.nTime += n(t.nt);
    totals.sumScroll += n(t.ss);
    totals.nScroll += n(t.ns);

    if (!o.totalsOnly) {
      const [c, p, ref, chn, cou, bro, osr, dev, lan, us, uc, sec, eng] = await Promise.all([
        q(`SELECT ${dateExpr} as d, COUNT(*) as pv, COALESCE(SUM(is_unique), 0) as vis FROM pageviews ${where} GROUP BY d`),
        q(`SELECT pathname as v, COUNT(*) as pv, COALESCE(SUM(is_unique), 0) as vis FROM pageviews ${where} GROUP BY v ORDER BY pv DESC, v ASC LIMIT ${lim(20)}`),
        dimQuery("referrer", false, "ASC", lim(20)),
        dimQuery("channel", true, "ASC", NONE).catch(() => ({ rows: [] })), // column absent pre-migration
        dimQuery("country", true, "ASC", lim(20)),
        dimQuery("browser", true, "ASC", lim(10)),
        dimQuery("os", true, "ASC", lim(10)),
        dimQuery("device_type", true, "ASC", NONE),
        dimQuery("SUBSTR(language, 1, 2)", true, "ASC", lim(10)),
        dimQuery("utm_source", true, "ASC", lim(10)),
        dimQuery("utm_campaign", true, "ASC", lim(10)),
        q(`SELECT ${SECTION_SQL} as v, COUNT(*) as pv, COALESCE(SUM(is_unique), 0) as vis FROM pageviews ${where} GROUP BY v`),
        q(
          `SELECT pathname as v, COUNT(*) as pv, COALESCE(SUM(is_unique), 0) as vis, COALESCE(SUM(time_on_page), 0) as st,
             COALESCE(SUM(scroll_depth), 0) as ss, COUNT(scroll_depth) as ns
           FROM pageviews ${where} AND ${BLOG_PATH_SQL} AND time_on_page IS NOT NULL GROUP BY v`,
        ),
      ]);
      for (const r of c.rows) chart.add(String(r.d), n(r.pv), n(r.vis));
      for (const r of p.rows) pages.add(String(r.v), n(r.pv), n(r.vis));
      const feed = (acc: Acc, rows: typeof ref.rows) => {
        for (const r of rows) acc.add(r.v === null ? NULL_VALUE : String(r.v), n(r.visitors));
      };
      feed(dimAcc.referrer, ref.rows);
      feed(dimAcc.channel, chn.rows);
      feed(dimAcc.country, cou.rows);
      feed(dimAcc.browser, bro.rows);
      feed(dimAcc.os, osr.rows);
      feed(dimAcc.device, dev.rows);
      feed(dimAcc.lang, lan.rows);
      feed(dimAcc.utm_source, us.rows);
      feed(dimAcc.utm_campaign, uc.rows);
      for (const r of sec.rows) sections.add(String(r.v), n(r.pv), n(r.vis));
      for (const r of eng.rows) engaged.add(String(r.v), n(r.pv), n(r.vis), n(r.st), n(r.ss), n(r.ns));
    }
  }

  // ---- rollup part ----
  if (rolled.length > 0) {
    const inLog = "day IN (SELECT day FROM rollup_log WHERE day >= ? AND day <= ? AND day < ?)";
    const logArgs = [o.from, o.to, o.today];
    const rq = (sql: string, extra: Array<string | number> = []) =>
      db.execute({ sql, args: [scope, ...logArgs, ...extra] });

    const tot = await rq(
      `SELECT COALESCE(SUM(pageviews), 0) as pv, COALESCE(SUM(visitors), 0) as vis, COALESCE(SUM(bounced), 0) as bounced,
         COALESCE(SUM(sum_time), 0) as st, COALESCE(SUM(n_time), 0) as nt,
         COALESCE(SUM(sum_scroll), 0) as ss, COALESCE(SUM(n_scroll), 0) as ns
       FROM daily_stats WHERE scope = ? AND ${inLog}`,
    );
    const t = tot.rows[0];
    totals.pageviews += n(t.pv);
    totals.visitors += n(t.vis);
    totals.bounced += n(t.bounced);
    totals.sumTime += n(t.st);
    totals.nTime += n(t.nt);
    totals.sumScroll += n(t.ss);
    totals.nScroll += n(t.ns);

    if (!o.totalsOnly) {
      const key = monthly ? "substr(day, 1, 7)" : "day";
      const [c, p, dims, sec, eng] = await Promise.all([
        rq(`SELECT ${key} as d, SUM(pageviews) as pv, SUM(visitors) as vis FROM daily_stats WHERE scope = ? AND ${inLog} GROUP BY d`),
        rq(`SELECT pathname as v, SUM(pageviews) as pv, SUM(visitors) as vis FROM daily_pages WHERE scope = ? AND ${inLog} GROUP BY v`),
        rq(
          `SELECT dim, value as v, SUM(visitors) as vis FROM daily_dims WHERE scope = ? AND ${inLog} AND dim <> 'section' GROUP BY dim, v`,
        ),
        rq(`SELECT value as v, SUM(pageviews) as pv, SUM(visitors) as vis FROM daily_dims WHERE scope = ? AND ${inLog} AND dim = 'section' GROUP BY v`),
        rq(
          `SELECT pathname as v, SUM(n_time) as pv, SUM(tp_visitors) as vis, SUM(sum_time) as st, SUM(tp_sum_scroll) as ss, SUM(tp_n_scroll) as ns
           FROM daily_pages WHERE scope = ? AND ${inLog} AND ${BLOG_PATH_SQL} GROUP BY v HAVING SUM(n_time) > 0`,
        ),
      ]);
      for (const r of c.rows) chart.add(String(r.d), n(r.pv), n(r.vis));
      for (const r of p.rows) pages.add(String(r.v), n(r.pv), n(r.vis));
      for (const r of dims.rows) dimAcc[String(r.dim)]?.add(String(r.v), n(r.vis));
      for (const r of sec.rows) sections.add(String(r.v), n(r.pv), n(r.vis));
      for (const r of eng.rows) engaged.add(String(r.v), n(r.pv), n(r.vis), n(r.st), n(r.ss), n(r.ns));
    }
  }

  const empty: Row[] = [];
  const source = { rollup_days: rolled.length, raw_days: rawDays.length };
  const avgTime = totals.nTime > 0 ? Math.round(totals.sumTime / totals.nTime) : 0;
  const avgScroll = totals.nScroll > 0 ? Math.round(totals.sumScroll / totals.nScroll) : 0;
  if (o.totalsOnly) {
    return {
      totals, avgTime, avgScroll, source,
      chart: empty, topPages: empty, referrers: empty, countries: empty, browsers: empty, os: empty,
      devices: empty, channels: empty, languages: empty, utmSources: empty, utmCampaigns: empty, topEngaged: empty, sections: empty,
    };
  }

  // Order: metric DESC, then key ASC with NULL first (as SQLite does).
  const rank = (acc: Acc, idx: number, limit: number) =>
    acc
      .entries()
      .sort((a, b) => b[1][idx] - a[1][idx] || (a[0] === NULL_VALUE ? -1 : b[0] === NULL_VALUE ? 1 : cmpStr(a[0], b[0])))
      .slice(0, limit);
  const dimRows = (name: string, col: string, limit: number): Row[] =>
    rank(dimAcc[name], 0, limit).map(([v, [vis]]) => ({ [col]: v === NULL_VALUE ? null : v, visitors: vis }));

  const topEngaged = engaged
    .entries()
    .filter(([, [pv]]) => pv >= 2)
    .map(([v, [pv, vis, st, ss, ns]]) => ({
      pathname: v,
      pageviews: pv,
      visitors: vis,
      avg_time: Math.round(st / pv),
      avg_scroll: ns > 0 ? Math.round(ss / ns) : null,
    }))
    .sort(
      (a, b) =>
        (b.avg_time || 0) * (b.avg_scroll || 0) - (a.avg_time || 0) * (a.avg_scroll || 0) ||
        cmpStr(a.pathname, b.pathname),
    )
    .slice(0, 10);

  return {
    totals,
    avgTime,
    avgScroll,
    source,
    chart: chart
      .entries()
      .sort((a, b) => cmpStr(a[0], b[0]))
      .map(([d, [pv, vis]]) => ({ date: d, pageviews: pv, visitors: vis })),
    topPages: rank(pages, 0, top(20)).map(([v, [pv, vis]]) => ({ pathname: v, pageviews: pv, visitors: vis })),
    referrers: dimRows("referrer", "referrer", top(20)),
    countries: dimRows("country", "country", 20),
    browsers: dimRows("browser", "browser", 10),
    os: dimRows("os", "os", 10),
    devices: dimRows("device", "device_type", 1e9),
    channels: dimRows("channel", "channel", 1e9),
    languages: dimRows("lang", "lang", 10),
    utmSources: dimRows("utm_source", "utm_source", top(10)),
    utmCampaigns: dimRows("utm_campaign", "utm_campaign", top(10)),
    topEngaged,
    sections: rank(sections, 0, 1e9)
      .sort((a, b) => b[1][0] - a[1][0] || cmpStr(a[0], b[0]))
      .map(([v, [pv, vis]]) => ({ section: v, pageviews: pv, visitors: vis })),
  };
}

/**
 * Sessions / entry-exit / events / goals for the same range, hybrid like
 * computeBlock. Not filtered by `pathname` (sessions span pages): with that
 * filter, or an hourly chart, it simply reads raw for every day.
 * Returns available=false when the phase-2 migration was not applied.
 */
export async function computeSessions(
  db: Client,
  o: BlockOpts,
): Promise<SessionStats> {
  try {
    if (!(await tableExists(db, "sessions"))) return emptySessionStats();
    const hasEvents = await tableExists(db, "events");
    const rolled = await rolledDays(db, o);
    const rolledSet = new Set(rolled);
    const rawDays = eachDay(o.from, o.to).filter((d) => !rolledSet.has(d));
    return await computeSessionStats(db, {
      rolledDays: rolled,
      rawRanges: segments(rawDays),
      scope: o.includeAll ? "all" : "human",
      scopeExpr: `${o.includeAll ? `(NOT ${BOT_SQL})` : HUMAN_SQL}${filterSql(o.filters)}`,
      hasEvents,
      totalsOnly: o.totalsOnly,
    });
  } catch {
    return emptySessionStats();
  }
}
