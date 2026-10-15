import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { getDateRange, isoDate } from "~/lib/date-range";
import {
  BOT_SQL,
  HUMAN_SQL,
  NOT_LEGACY_BOT_SQL,
  UNVERIFIED_SQL,
  VERDICT_SQL,
} from "~/lib/bot-verdict";
import { computeBlock } from "~/lib/stats-hybrid";

export const prerender = false;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async ({ url, request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const period = url.searchParams.get("period") || "30d";
  const customFrom = url.searchParams.get("from") || undefined;
  const customTo = url.searchParams.get("to") || undefined;
  const pathnameFilter = url.searchParams.get("pathname") || undefined;

  if (customFrom && !DATE_RE.test(customFrom)) {
    return new Response(JSON.stringify({ error: "Invalid from date" }), {
      status: 400,
    });
  }
  if (customTo && !DATE_RE.test(customTo)) {
    return new Response(JSON.stringify({ error: "Invalid to date" }), {
      status: 400,
    });
  }

  const range = getDateRange(period, customFrom, customTo);
  const db = getDb();

  // Coexistence period: default = human visits only; include=all = human + unverified
  // (everything except bots, the rollup scope 'all').
  // Main numbers/breakdowns come from computeBlock (rollups for closed days, raw for
  // the rest). recent_visitors, suspicious, quality, review and summary_legacy need raw
  // rows and keep reading raw.
  const includeAll = url.searchParams.get("include") === "all";
  const rangeWhere = `WHERE created_at >= ? AND created_at < datetime(?, '+1 day')${pathnameFilter ? " AND pathname = ?" : ""}`;
  const baseWhere = `${rangeWhere} AND ${includeAll ? `(NOT ${BOT_SQL})` : HUMAN_SQL}`;
  const legacyWhere = `${rangeWhere} AND ${NOT_LEGACY_BOT_SQL}`;
  const baseArgs = pathnameFilter
    ? [range.from, range.to, pathnameFilter]
    : [range.from, range.to];

  // LEGACY zero-engagement heuristic behind the old "Flag come bot" button.
  const suspectWhere = `${legacyWhere} AND visitor_hash IS NOT NULL AND (time_on_page IS NULL OR time_on_page <= 5) AND (scroll_depth IS NULL OR scroll_depth = 0)`;

  // First path segment + "*": '/blog/foo' -> '/blog/*', so scanners/crawlers hitting many posts group together.
  const pathPattern = `CASE WHEN instr(substr(pathname, 2), '/') > 0 THEN substr(pathname, 1, instr(substr(pathname, 2), '/') + 1) || '*' ELSE pathname END`;

  const today = isoDate(new Date());
  const blockOpts = {
    from: range.from,
    to: range.to,
    groupBy: range.groupBy,
    pathname: pathnameFilter,
    includeAll,
    today,
  };

  const [
    block,
    recentVisitors,
    suspectCount,
    suspectCountries,
    legacySummary,
    quality,
    review,
  ] = await Promise.all([
    computeBlock(db, blockOpts),
    db.execute({
      sql: `SELECT pathname, country, device_type, browser, os, referrer, time_on_page, scroll_depth, created_at, visitor_hash, ${VERDICT_SQL} as verdict FROM pageviews ${baseWhere} AND is_unique = 1 ORDER BY created_at DESC LIMIT 30`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT COUNT(DISTINCT visitor_hash) as count FROM pageviews ${suspectWhere}`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT country, COUNT(DISTINCT visitor_hash) as suspects FROM pageviews ${suspectWhere} AND country IS NOT NULL GROUP BY country ORDER BY suspects DESC`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT COUNT(*) as pageviews, SUM(is_unique) as visitors, ROUND(AVG(time_on_page)) as avg_time, ROUND(AVG(scroll_depth)) as avg_scroll FROM pageviews ${legacyWhere}`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT ${VERDICT_SQL} as verdict, COALESCE(SUM(is_unique), 0) as visits, COUNT(*) as pageviews FROM pageviews ${rangeWhere} GROUP BY verdict`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT browser, os, device_type, country, referrer, ${pathPattern} as path_pattern,
              COUNT(*) as pageviews,
              COALESCE(SUM(is_unique), 0) as visits,
              MAX(bot_score) as max_score,
              MAX(created_at) as last_seen
            FROM pageviews ${rangeWhere} AND ${UNVERIFIED_SQL}
            GROUP BY browser, os, device_type, country, referrer, path_pattern
            ORDER BY pageviews DESC
            LIMIT 15`,
      args: baseArgs,
    }),
  ]);

  const verdictCounts = { human: 0, unverified: 0, bot: 0 };
  for (const r of quality.rows) {
    const v = String(r.verdict) as keyof typeof verdictCounts;
    if (v in verdictCounts) verdictCounts[v] = Number(r.visits) || 0;
  }
  const nonBot = verdictCounts.human + verdictCounts.unverified;
  const ls = legacySummary.rows[0];

  const prevFromDate = new Date(range.from + "T00:00:00Z");
  const prevToDate = new Date(range.to + "T00:00:00Z");
  const spanMs = Math.max(prevToDate.getTime() - prevFromDate.getTime(), 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevFromDate.getTime() - spanMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prevTo = new Date(prevFromDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prevBlock = await computeBlock(db, {
    ...blockOpts,
    from: prevFrom,
    to: prevTo,
    groupBy: "day",
    totalsOnly: true,
  });
  const prevPv = prevBlock.totals.pageviews;
  const prevVis = prevBlock.totals.visitors;
  function pctChange(curr: number, prev: number): number | null {
    if (prev === 0) return curr > 0 ? null : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  const totalVisitors = block.totals.visitors;
  const bounceRate =
    totalVisitors > 0
      ? Math.round((block.totals.bounced / totalVisitors) * 1000) / 10
      : 0;

  return new Response(
    JSON.stringify({
      period: { from: range.from, to: range.to, groupBy: range.groupBy },
      summary: {
        pageviews: block.totals.pageviews,
        visitors: totalVisitors,
        avg_time_on_page: block.avgTime,
        avg_scroll_depth: block.avgScroll,
        bounce_rate: bounceRate,
        pageviews_delta_pct: pctChange(block.totals.pageviews, prevPv),
        visitors_delta_pct: pctChange(totalVisitors, prevVis),
        prev_period: { from: prevFrom, to: prevTo, pageviews: prevPv, visitors: prevVis },
      },
      mode: includeAll ? "all" : "human",
      // Old numbers (all but legacy bot_hashes), kept side by side during the coexistence period.
      summary_legacy: {
        pageviews: Number(ls.pageviews) || 0,
        visitors: Number(ls.visitors) || 0,
        avg_time_on_page: Number(ls.avg_time) || 0,
        avg_scroll_depth: Number(ls.avg_scroll) || 0,
      },
      // Visits (first hit of the day per visitor) by verdict. unverified_pct is over non-bot visits.
      quality: {
        ...verdictCounts,
        unverified_pct:
          nonBot > 0
            ? Math.round((verdictCounts.unverified / nonBot) * 1000) / 10
            : 0,
      },
      review: review.rows,
      // Debug: days of the range read from daily rollups vs live raw rows.
      source: block.source,
      chart: block.chart,
      top_pages: block.topPages,
      referrers: block.referrers,
      countries: block.countries,
      browsers: block.browsers,
      os: block.os,
      devices: block.devices,
      languages: block.languages,
      utm_sources: block.utmSources,
      utm_campaigns: block.utmCampaigns,
      recent_visitors: recentVisitors.rows,
      top_engaged_posts: block.topEngaged,
      sections: block.sections,
      suspicious: {
        count: Number(suspectCount.rows[0].count) || 0,
        countries: suspectCountries.rows,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
