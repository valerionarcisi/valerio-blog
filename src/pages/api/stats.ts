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
import { computeBlock, computeSessions } from "~/lib/stats-hybrid";
import { computeSlowPages, computeVitals } from "~/lib/analytics-vitals-stats";
import {
  clampRange,
  filterSql,
  filtersActive,
  parseFilters,
  retentionFrom,
} from "~/lib/analytics-filters";

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

  const parsedFilters = parseFilters(url.searchParams);
  if (!parsedFilters.ok) {
    return new Response(JSON.stringify({ error: parsedFilters.error }), {
      status: 400,
    });
  }
  const filters = parsedFilters.value;
  const filtered = filtersActive(filters);

  const today = isoDate(new Date());
  const baseRange = getDateRange(period, customFrom, customTo);
  // Filters exist only on raw rows: the range is clamped to the raw retention window.
  const clamp = clampRange(baseRange.from, baseRange.to, today, filters);
  const range = { ...baseRange, from: clamp.from, to: clamp.to };
  const db = getDb();

  // Coexistence period: default = human visits only; include=all = human + unverified
  // (everything except bots, the rollup scope 'all').
  // Main numbers/breakdowns come from computeBlock (rollups for closed days, raw for
  // the rest). recent_visitors, suspicious, quality, review and summary_legacy need raw
  // rows and keep reading raw.
  const includeAll = url.searchParams.get("include") === "all";
  const rangeWhere = `WHERE created_at >= ? AND created_at < datetime(?, '+1 day')${pathnameFilter ? " AND pathname = ?" : ""}${filterSql(filters)}`;
  const baseWhere = `${rangeWhere} AND ${includeAll ? `(NOT ${BOT_SQL})` : HUMAN_SQL}`;
  const legacyWhere = `${rangeWhere} AND ${NOT_LEGACY_BOT_SQL}`;
  const baseArgs = pathnameFilter
    ? [range.from, range.to, pathnameFilter]
    : [range.from, range.to];

  // LEGACY zero-engagement heuristic behind the old "Flag come bot" button.
  const suspectWhere = `${legacyWhere} AND visitor_hash IS NOT NULL AND (time_on_page IS NULL OR time_on_page <= 5) AND (scroll_depth IS NULL OR scroll_depth = 0)`;

  // First path segment + "*": '/blog/foo' -> '/blog/*', so scanners/crawlers hitting many posts group together.
  const pathPattern = `CASE WHEN instr(substr(pathname, 2), '/') > 0 THEN substr(pathname, 1, instr(substr(pathname, 2), '/') + 1) || '*' ELSE pathname END`;

  const blockOpts = {
    from: range.from,
    to: range.to,
    groupBy: range.groupBy,
    pathname: pathnameFilter,
    includeAll,
    today,
    filters,
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
  // Same length as the current range: for a single day (period=today) the span is 0 and the
  // previous period is exactly yesterday.
  const spanMs = prevToDate.getTime() - prevFromDate.getTime();
  const prevFrom = new Date(prevFromDate.getTime() - spanMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prevTo = new Date(prevFromDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prevOpts = { ...blockOpts, from: prevFrom, to: prevTo, groupBy: "day", totalsOnly: true };
  // With a filter the previous period is only comparable while it is still inside the raw
  // retention window; otherwise the comparison is omitted (never shown as a misleading zero).
  const prevComparable = !filtered || prevFrom >= retentionFrom(today);
  const prevBlock = prevComparable
    ? await computeBlock(db, prevOpts)
    : await computeBlock(db, { ...prevOpts, from: prevTo, to: prevFrom }); // empty range: zeros
  const [sess, prevSess, vitals, slowPages] = await Promise.all([
    computeSessions(db, blockOpts),
    prevComparable ? computeSessions(db, prevOpts) : computeSessions(db, { ...prevOpts, from: prevTo, to: prevFrom }),
    computeVitals(db, blockOpts),
    computeSlowPages(db, {
      from: range.from > retentionFrom(today) ? range.from : retentionFrom(today),
      to: range.to,
      includeAll,
      filters,
    }),
  ]);
  const prevPv = prevBlock.totals.pageviews;
  const prevVis = prevBlock.totals.visitors;
  function pctChange(curr: number, prev: number): number | null {
    if (!prevComparable) return null;
    if (prev === 0) return curr > 0 ? null : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  const totalVisitors = block.totals.visitors;
  const bounceRate =
    totalVisitors > 0
      ? Math.round((block.totals.bounced / totalVisitors) * 1000) / 10
      : 0;

  const rate1 = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const sessionsBounceRate = rate1(sess.bounced, sess.count);
  const prevBounceRate = rate1(prevSess.bounced, prevSess.count);
  const prevGoals = new Map(prevSess.goals.map((g) => [g.id, g.conversions]));

  return new Response(
    JSON.stringify({
      period: { from: range.from, to: range.to, groupBy: range.groupBy },
      // Active filters force raw reads and a range inside the retention window (90 days).
      filters: {
        active: filtered,
        ...filters,
        clamped: clamp.clamped,
        requested_from: baseRange.from,
        retention_days: 90,
      },
      // Phase 5. p75 exact for one day / raw reads; across rolled days the n-weighted
      // average of the daily p75 (approximation). cls in CLS units (0.1 = good limit).
      vitals,
      vitals_pages: slowPages,
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
      // Phase 2. REAL bounce = sessions with 1 pageview and < 10 s engaged / sessions;
      // summary.bounce_rate above is the legacy per-visit approximation and stays as is.
      sessions: {
        available: sess.available,
        count: sess.count,
        bounce_rate: sessionsBounceRate,
        pages_per_session: sess.count > 0 ? round1(sess.pageviews / sess.count) : 0,
        avg_engaged_seconds: sess.count > 0 ? Math.round(sess.engagedSeconds / sess.count) : 0,
        by_channel: sess.channels,
        // per-bucket series for the dashboard sparklines (sessions, bounced, engaged_seconds, events per day)
        daily: sess.daily,
        events_total: sess.eventsTotal,
        count_delta_pct: pctChange(sess.count, prevSess.count),
        // difference in percentage points vs the previous period (null when it has no sessions)
        bounce_rate_delta_pp: prevSess.count > 0 ? round1(sessionsBounceRate - prevBounceRate) : null,
        prev_period: {
          count: prevSess.count,
          bounce_rate: prevBounceRate,
          avg_engaged_seconds: prevSess.count > 0 ? Math.round(prevSess.engagedSeconds / prevSess.count) : 0,
          events_total: prevSess.eventsTotal,
        },
      },
      channels: block.channels,
      entry_pages: sess.entryPages,
      exit_pages: sess.exitPages,
      events: sess.events,
      goals: sess.goals.map((g) => ({
        ...g,
        conversions_delta_pct: pctChange(g.conversions, prevGoals.get(g.id) ?? 0),
      })),
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
