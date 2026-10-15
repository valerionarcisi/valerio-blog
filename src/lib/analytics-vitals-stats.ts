import type { Client } from "@libsql/client";
import { BOT_SQL, HUMAN_SQL } from "./bot-verdict";
import { filterSql } from "./analytics-filters";
import { eachDay } from "./analytics-rollup";
import { rolledDays, type BlockOpts } from "./stats-hybrid";
import {
  buildVitalsRows,
  combineParts,
  emptySummary,
  p75Sorted,
  toApiP75,
  type Metric,
  type RawVital,
  type VitalSummary,
  type VitalsRow,
} from "./analytics-vitals";

/**
 * Web Vitals read side. Hybrid like computeBlock: closed + rolled days from
 * daily_vitals, the rest (today, filters, pathname, hourly) from raw rows.
 * Bucket counts are exact in every case. p75 is exact for a single day or for a
 * pure-raw read; across several rolled days it is the n-weighted average of the
 * daily p75 (approximation, documented in the spec).
 */
export interface VitalsStats {
  available: boolean;
  lcp: VitalSummary;
  inp: VitalSummary;
  cls: VitalSummary;
  by_device: Record<string, { lcp: VitalSummary; inp: VitalSummary; cls: VitalSummary }>;
}

const MAX_RAW_ROWS = 100_000;
const REPORT_DEVICES = ["mobile", "desktop"];

const emptyVitals = (available: boolean): VitalsStats => ({
  available,
  lcp: emptySummary(),
  inp: emptySummary(),
  cls: emptySummary(),
  by_device: Object.fromEntries(
    REPORT_DEVICES.map((d) => [d, { lcp: emptySummary(), inp: emptySummary(), cls: emptySummary() }]),
  ),
});

function segments(days: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && new Date(new Date(last[1] + "T00:00:00Z").getTime() + 86_400_000).toISOString().slice(0, 10) === d)
      last[1] = d;
    else out.push([d, d]);
  }
  return out;
}

export async function computeVitals(db: Client, o: BlockOpts): Promise<VitalsStats> {
  try {
    const cols = await db.execute("PRAGMA table_info(pageviews)");
    if (!cols.rows.some((r) => r.name === "lcp_ms")) return emptyVitals(false);
    const rolled = await rolledDays(db, o);
    const rolledSet = new Set(rolled);
    const rawDays = eachDay(o.from, o.to).filter((d) => !rolledSet.has(d));
    const scope = o.includeAll ? "all" : "human";
    // device|metric -> parts
    const parts = new Map<string, VitalsRow[]>();
    const add = (r: VitalsRow) => {
      const k = `${r.device}|${r.metric}`;
      parts.set(k, [...(parts.get(k) ?? []), r]);
    };

    if (rolled.length > 0) {
      const res = await db.execute({
        sql: `SELECT device, metric, SUM(n) AS n, SUM(good) AS good, SUM(ni) AS ni, SUM(poor) AS poor, SUM(p75 * n) AS w
              FROM daily_vitals WHERE scope = ? AND day IN (${rolled.map(() => "?").join(",")})
              GROUP BY device, metric`,
        args: [scope, ...rolled],
      });
      for (const r of res.rows) {
        const n = Number(r.n) || 0;
        if (n === 0) continue;
        add({
          device: String(r.device),
          metric: String(r.metric) as Metric,
          n,
          good: Number(r.good) || 0,
          ni: Number(r.ni) || 0,
          poor: Number(r.poor) || 0,
          p75: Math.round((Number(r.w) || 0) / n),
        });
      }
    }

    if (rawDays.length > 0) {
      const segs = segments(rawDays);
      const rangeSql = segs.map(() => "(created_at >= ? AND created_at < datetime(?, '+1 day'))").join(" OR ");
      const scopeSql = o.includeAll ? `(NOT ${BOT_SQL})` : HUMAN_SQL;
      const res = await db.execute({
        sql: `SELECT device_type AS d, lcp_ms, cls_milli, inp_ms FROM pageviews
              WHERE (${rangeSql})${o.pathname ? " AND pathname = ?" : ""} AND ${scopeSql}${filterSql(o.filters)}
                AND (lcp_ms IS NOT NULL OR cls_milli IS NOT NULL OR inp_ms IS NOT NULL)
              LIMIT ${MAX_RAW_ROWS}`,
        args: [...segs.flatMap(([a, b]) => [a, b]), ...(o.pathname ? [o.pathname] : [])],
      });
      const raw: RawVital[] = res.rows.map((r) => ({
        device: r.d == null ? null : String(r.d),
        lcp: r.lcp_ms == null ? null : Number(r.lcp_ms),
        inp: r.inp_ms == null ? null : Number(r.inp_ms),
        cls: r.cls_milli == null ? null : Number(r.cls_milli),
      }));
      buildVitalsRows(raw).forEach(add);
    }

    const summary = (device: string, metric: Metric): VitalSummary => {
      const c = combineParts(parts.get(`${device}|${metric}`) ?? []);
      return { p75: toApiP75(metric, c.p75), good: c.good, ni: c.ni, poor: c.poor, n: c.n };
    };
    const all = (device: string) => ({
      lcp: summary(device, "lcp"),
      inp: summary(device, "inp"),
      cls: summary(device, "cls"),
    });
    return {
      available: true,
      ...all("all"),
      by_device: Object.fromEntries(REPORT_DEVICES.map((d) => [d, all(d)])),
    };
  } catch {
    // vitals columns / daily_vitals missing (migration not applied)
    return emptyVitals(false);
  }
}

export interface SlowPage {
  pathname: string;
  lcp_p75: number;
  n: number;
}

export const SLOW_PAGES_MIN_N = 5;

/** Worst pages by LCP p75 (n >= 5). Raw only: caller passes a range inside the retention window. */
export async function computeSlowPages(
  db: Client,
  o: { from: string; to: string; includeAll: boolean; filters?: BlockOpts["filters"] },
  limit = 10,
): Promise<SlowPage[]> {
  try {
    const scopeSql = o.includeAll ? `(NOT ${BOT_SQL})` : HUMAN_SQL;
    const res = await db.execute({
      sql: `SELECT pathname, lcp_ms FROM pageviews
            WHERE created_at >= ? AND created_at < datetime(?, '+1 day') AND ${scopeSql}${filterSql(o.filters)}
              AND lcp_ms IS NOT NULL
            ORDER BY pathname, lcp_ms LIMIT ${MAX_RAW_ROWS}`,
      args: [o.from, o.to],
    });
    const byPath = new Map<string, number[]>();
    for (const r of res.rows) {
      const k = String(r.pathname);
      const arr = byPath.get(k) ?? [];
      arr.push(Number(r.lcp_ms));
      byPath.set(k, arr);
    }
    return [...byPath.entries()]
      .filter(([, v]) => v.length >= SLOW_PAGES_MIN_N)
      .map(([pathname, v]) => ({
        pathname,
        lcp_p75: p75Sorted(v.sort((a, b) => a - b)) as number,
        n: v.length,
      }))
      .sort((a, b) => b.lcp_p75 - a.lcp_p75 || (a.pathname < b.pathname ? -1 : 1))
      .slice(0, limit);
  } catch {
    return [];
  }
}
