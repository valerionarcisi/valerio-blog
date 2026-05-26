import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";
import { getDateRange } from "~/lib/date-range";

export const prerender = false;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async ({ url, request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

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

  const baseWhere = `WHERE created_at >= ? AND created_at < datetime(?, '+1 day')${pathnameFilter ? " AND pathname = ?" : ""}`;
  const baseArgs = pathnameFilter
    ? [range.from, range.to, pathnameFilter]
    : [range.from, range.to];

  const dateExpr =
    range.groupBy === "hour"
      ? "strftime('%Y-%m-%d %H:00', created_at)"
      : range.groupBy === "month"
        ? "strftime('%Y-%m', created_at)"
        : "date(created_at)";

  const suspectWhere = `WHERE created_at >= ? AND created_at < datetime(?, '+1 day') AND visitor_hash IS NOT NULL AND (time_on_page IS NULL OR time_on_page <= 5) AND (scroll_depth IS NULL OR scroll_depth = 0)${pathnameFilter ? " AND pathname = ?" : ""}`;

  const [
    summary,
    chart,
    topPages,
    referrers,
    countries,
    browsers,
    os,
    devices,
    languages,
    utmSources,
    utmCampaigns,
    recentVisitors,
    suspectCount,
    suspectCountries,
    topEngagedPosts,
    sectionBreakdown,
  ] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) as pageviews, SUM(is_unique) as visitors, ROUND(AVG(time_on_page)) as avg_time, ROUND(AVG(scroll_depth)) as avg_scroll FROM pageviews ${baseWhere}`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT ${dateExpr} as date, COUNT(*) as pageviews, SUM(is_unique) as visitors FROM pageviews ${baseWhere} GROUP BY date ORDER BY date`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT pathname, COUNT(*) as pageviews, SUM(is_unique) as visitors FROM pageviews ${baseWhere} GROUP BY pathname ORDER BY pageviews DESC LIMIT 20`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT referrer, SUM(is_unique) as visitors FROM pageviews ${baseWhere} GROUP BY referrer ORDER BY visitors DESC LIMIT 20`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT country, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND country IS NOT NULL GROUP BY country ORDER BY visitors DESC LIMIT 20`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT browser, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND browser IS NOT NULL GROUP BY browser ORDER BY visitors DESC LIMIT 10`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT os, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND os IS NOT NULL GROUP BY os ORDER BY visitors DESC LIMIT 10`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT device_type, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND device_type IS NOT NULL GROUP BY device_type ORDER BY visitors DESC`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT SUBSTR(language, 1, 2) as lang, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND language IS NOT NULL GROUP BY lang ORDER BY visitors DESC LIMIT 10`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT utm_source, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND utm_source IS NOT NULL GROUP BY utm_source ORDER BY visitors DESC LIMIT 10`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT utm_campaign, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND utm_campaign IS NOT NULL GROUP BY utm_campaign ORDER BY visitors DESC LIMIT 10`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT pathname, country, device_type, browser, os, referrer, time_on_page, scroll_depth, created_at, visitor_hash FROM pageviews ${baseWhere} AND is_unique = 1 ORDER BY created_at DESC LIMIT 30`,
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
      sql: `SELECT pathname,
              COUNT(*) as pageviews,
              SUM(is_unique) as visitors,
              ROUND(AVG(time_on_page)) as avg_time,
              ROUND(AVG(scroll_depth)) as avg_scroll
            FROM pageviews ${baseWhere}
              AND (pathname LIKE '/blog/%' OR pathname LIKE '/en/blog/%')
              AND time_on_page IS NOT NULL
            GROUP BY pathname
            HAVING COUNT(*) >= 2
            ORDER BY (COALESCE(avg_time, 0) * COALESCE(avg_scroll, 0)) DESC
            LIMIT 10`,
      args: baseArgs,
    }),
    db.execute({
      sql: `SELECT
              CASE
                WHEN pathname = '/' OR pathname = '/en' OR pathname = '/en/' THEN 'home'
                WHEN pathname LIKE '/blog/%' OR pathname LIKE '/en/blog/%' OR pathname = '/blog' OR pathname = '/en/blog' THEN 'blog'
                WHEN pathname LIKE '/films/%' OR pathname LIKE '/en/films/%' OR pathname = '/films' OR pathname = '/en/films' THEN 'films'
                WHEN pathname LIKE '/tag/%' OR pathname LIKE '/en/tag/%' THEN 'tag'
                WHEN pathname LIKE '/chi-sono%' OR pathname LIKE '/en/about%' THEN 'about'
                WHEN pathname LIKE '/visti%' OR pathname LIKE '/en/visti%' THEN 'visti'
                WHEN pathname LIKE '/musica%' OR pathname LIKE '/en/music%' THEN 'musica'
                WHEN pathname LIKE '/sport%' OR pathname LIKE '/en/sport%' THEN 'sport'
                WHEN pathname LIKE '/note%' OR pathname LIKE '/en/notes%' THEN 'note'
                ELSE 'altro'
              END as section,
              COUNT(*) as pageviews,
              SUM(is_unique) as visitors
            FROM pageviews ${baseWhere}
            GROUP BY section
            ORDER BY pageviews DESC`,
      args: baseArgs,
    }),
  ]);

  const prevFromDate = new Date(range.from + "T00:00:00Z");
  const prevToDate = new Date(range.to + "T00:00:00Z");
  const spanMs = Math.max(prevToDate.getTime() - prevFromDate.getTime(), 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevFromDate.getTime() - spanMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prevTo = new Date(prevFromDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prevArgs = pathnameFilter ? [prevFrom, prevTo, pathnameFilter] : [prevFrom, prevTo];
  const prevSummary = await db.execute({
    sql: `SELECT COUNT(*) as pageviews, SUM(is_unique) as visitors FROM pageviews ${baseWhere}`,
    args: prevArgs,
  });
  const prevS = prevSummary.rows[0];
  const prevPv = Number(prevS.pageviews) || 0;
  const prevVis = Number(prevS.visitors) || 0;
  function pctChange(curr: number, prev: number): number | null {
    if (prev === 0) return curr > 0 ? null : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  const s = summary.rows[0];
  const totalVisitors = Number(s.visitors) || 0;
  const bounceResult =
    totalVisitors > 0
      ? await db.execute({
          sql: `SELECT COUNT(*) as bounced FROM pageviews ${baseWhere} AND is_unique = 1 AND (time_on_page IS NULL OR time_on_page < 5)`,
          args: baseArgs,
        })
      : null;
  const bounceRate =
    bounceResult && totalVisitors > 0
      ? Math.round(
          (Number(bounceResult.rows[0].bounced) / totalVisitors) * 1000,
        ) / 10
      : 0;

  return new Response(
    JSON.stringify({
      period: { from: range.from, to: range.to, groupBy: range.groupBy },
      summary: {
        pageviews: Number(s.pageviews) || 0,
        visitors: totalVisitors,
        avg_time_on_page: Number(s.avg_time) || 0,
        avg_scroll_depth: Number(s.avg_scroll) || 0,
        bounce_rate: bounceRate,
        pageviews_delta_pct: pctChange(Number(s.pageviews) || 0, prevPv),
        visitors_delta_pct: pctChange(totalVisitors, prevVis),
        prev_period: { from: prevFrom, to: prevTo, pageviews: prevPv, visitors: prevVis },
      },
      chart: chart.rows,
      top_pages: topPages.rows,
      referrers: referrers.rows,
      countries: countries.rows,
      browsers: browsers.rows,
      os: os.rows,
      devices: devices.rows,
      languages: languages.rows,
      utm_sources: utmSources.rows,
      utm_campaigns: utmCampaigns.rows,
      recent_visitors: recentVisitors.rows,
      top_engaged_posts: topEngagedPosts.rows,
      sections: sectionBreakdown.rows,
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
