import type { Client } from "@libsql/client";
import { HUMAN_SQL } from "./bot-verdict";
import { BLOG_PATH_SQL } from "./analytics-sql";
import { sqlTime } from "./analytics-sessions";

/**
 * "Analytics oggi" card of the admin home. Same day definition as the rest of
 * the analytics: the UTC day. Numbers are human visits only (unverified are not
 * counted, like the dashboard's main numbers).
 *
 * Comparisons are fair: "yesterday at the same time" cuts yesterday at the
 * same UTC time of day as `now`, so the card never compares a half day with a
 * full one.
 *
 * Spike rule: today's visitors so far are a spike when
 *   today >= SPIKE_MIN_VISITORS  AND  today > SPIKE_FACTOR * average(
 *     visitors in [00:00, same time of day] of each of the last 7 same
 *     weekdays (today - 7d, -14d, ... -49d))
 * The minimum keeps a quiet blog from "spiking" on 3 visitors vs 1.
 */
export const SPIKE_FACTOR = 2;
export const SPIKE_MIN_VISITORS = 10;
export const SPIKE_WEEKS = 7;

export interface TodaySummary {
  visitorsToday: number;
  visitorsYesterdaySoFar: number;
  visitorsYesterdayTotal: number;
  topPosts: Array<{ pathname: string; pageviews: number }>;
  spike: { active: boolean; baseline: number; factor: number } | null;
  /** ISO instant the numbers were computed for. */
  asOf: string;
}

const DAY_MS = 86_400_000;

function utcStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function visitorsBetween(db: Client, from: Date, toInclusive: Date): Promise<number> {
  const r = await db.execute({
    sql: `SELECT COALESCE(SUM(is_unique), 0) AS v FROM pageviews
          WHERE created_at >= ? AND created_at <= ? AND ${HUMAN_SQL}`,
    args: [sqlTime(from), sqlTime(toInclusive)],
  });
  return Number(r.rows[0]?.v) || 0;
}

export async function getTodaySummary(db: Client, now: Date = new Date()): Promise<TodaySummary> {
  const start = utcStart(now);
  const elapsed = now.getTime() - start.getTime();
  const sameTime = (daysBack: number) => {
    const s = new Date(start.getTime() - daysBack * DAY_MS);
    return [s, new Date(s.getTime() + elapsed)] as const;
  };

  const weeks = Array.from({ length: SPIKE_WEEKS }, (_, i) => sameTime(7 * (i + 1)));
  const [yS, yE] = sameTime(1);
  const [today, ySoFar, yTotal, posts, ...weekly] = await Promise.all([
    visitorsBetween(db, start, now),
    visitorsBetween(db, yS, yE),
    visitorsBetween(db, yS, new Date(start.getTime() - 1000)),
    db.execute({
      sql: `SELECT pathname, COUNT(*) AS pv FROM pageviews
            WHERE created_at >= ? AND created_at <= ? AND ${HUMAN_SQL} AND ${BLOG_PATH_SQL}
            GROUP BY pathname ORDER BY pv DESC, pathname ASC LIMIT 3`,
      args: [sqlTime(start), sqlTime(now)],
    }),
    ...weeks.map(([a, b]) => visitorsBetween(db, a, b)),
  ]);

  const baseline = weekly.reduce((a, b) => a + b, 0) / SPIKE_WEEKS;
  const active = today >= SPIKE_MIN_VISITORS && today > SPIKE_FACTOR * baseline;
  return {
    visitorsToday: today,
    visitorsYesterdaySoFar: ySoFar,
    visitorsYesterdayTotal: yTotal,
    topPosts: posts.rows.map((r) => ({ pathname: String(r.pathname), pageviews: Number(r.pv) || 0 })),
    spike: { active, baseline: Math.round(baseline * 10) / 10, factor: SPIKE_FACTOR },
    asOf: now.toISOString(),
  };
}

/** Never throws and never hangs the page: null = "dati non disponibili". */
export async function getTodaySummarySafe(
  db: () => Client,
  now: Date = new Date(),
  timeoutMs = 3000,
): Promise<TodaySummary | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getTodaySummary(db(), now),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** "+12%" / "-5%" / "=" ; null when the comparison base is 0. */
export function deltaPct(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}
