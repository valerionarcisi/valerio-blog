import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { verifyBearerToken } from "~/lib/auth";

export const prerender = false;

function getDateRange(period: string, from?: string, to?: string): { from: string; to: string; groupBy: string } {
  const now = new Date();
  const toDate = to || now.toISOString().slice(0, 10);
  let fromDate: string;
  let groupBy = "day";

  switch (period) {
    case "today":
      fromDate = toDate;
      groupBy = "hour";
      break;
    case "7d":
      fromDate = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      break;
    case "30d":
      fromDate = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      break;
    case "90d":
      fromDate = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
      break;
    case "12m":
      fromDate = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
      groupBy = "month";
      break;
    case "custom":
      fromDate = from || new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      break;
    default:
      fromDate = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  }

  return { from: fromDate, to: toDate, groupBy };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async ({ request, url }) => {
  if (!verifyBearerToken(request, import.meta.env.ANALYTICS_ADMIN_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const period = url.searchParams.get("period") || "30d";
  const customFrom = url.searchParams.get("from") || undefined;
  const customTo = url.searchParams.get("to") || undefined;
  const pathnameFilter = url.searchParams.get("pathname") || undefined;

  if (customFrom && !DATE_RE.test(customFrom)) {
    return new Response(JSON.stringify({ error: "Invalid from date" }), { status: 400 });
  }
  if (customTo && !DATE_RE.test(customTo)) {
    return new Response(JSON.stringify({ error: "Invalid to date" }), { status: 400 });
  }

  const range = getDateRange(period, customFrom, customTo);
  const db = getDb();

  const baseWhere = `WHERE created_at >= ? AND created_at < datetime(?, '+1 day')${pathnameFilter ? " AND pathname = ?" : ""}`;
  const baseArgs = pathnameFilter ? [range.from, range.to, pathnameFilter] : [range.from, range.to];

  const dateExpr = range.groupBy === "hour"
    ? "strftime('%Y-%m-%d %H:00', created_at)"
    : range.groupBy === "month"
      ? "strftime('%Y-%m', created_at)"
      : "date(created_at)";

  const [summary, chart, topPages, referrers, countries, browsers, os, devices, languages, utmSources, utmCampaigns] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) as pageviews, SUM(is_unique) as visitors, ROUND(AVG(time_on_page)) as avg_time, ROUND(AVG(scroll_depth)) as avg_scroll FROM pageviews ${baseWhere}`, args: baseArgs }),
    db.execute({ sql: `SELECT ${dateExpr} as date, COUNT(*) as pageviews, SUM(is_unique) as visitors FROM pageviews ${baseWhere} GROUP BY date ORDER BY date`, args: baseArgs }),
    db.execute({ sql: `SELECT pathname, COUNT(*) as pageviews, SUM(is_unique) as visitors FROM pageviews ${baseWhere} GROUP BY pathname ORDER BY pageviews DESC LIMIT 20`, args: baseArgs }),
    db.execute({ sql: `SELECT referrer, SUM(is_unique) as visitors FROM pageviews ${baseWhere} GROUP BY referrer ORDER BY visitors DESC LIMIT 20`, args: baseArgs }),
    db.execute({ sql: `SELECT country, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND country IS NOT NULL GROUP BY country ORDER BY visitors DESC LIMIT 20`, args: baseArgs }),
    db.execute({ sql: `SELECT browser, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND browser IS NOT NULL GROUP BY browser ORDER BY visitors DESC LIMIT 10`, args: baseArgs }),
    db.execute({ sql: `SELECT os, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND os IS NOT NULL GROUP BY os ORDER BY visitors DESC LIMIT 10`, args: baseArgs }),
    db.execute({ sql: `SELECT device_type, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND device_type IS NOT NULL GROUP BY device_type ORDER BY visitors DESC`, args: baseArgs }),
    db.execute({ sql: `SELECT SUBSTR(language, 1, 2) as lang, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND language IS NOT NULL GROUP BY lang ORDER BY visitors DESC LIMIT 10`, args: baseArgs }),
    db.execute({ sql: `SELECT utm_source, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND utm_source IS NOT NULL GROUP BY utm_source ORDER BY visitors DESC LIMIT 10`, args: baseArgs }),
    db.execute({ sql: `SELECT utm_campaign, SUM(is_unique) as visitors FROM pageviews ${baseWhere} AND utm_campaign IS NOT NULL GROUP BY utm_campaign ORDER BY visitors DESC LIMIT 10`, args: baseArgs }),
  ]);

  const s = summary.rows[0];
  const totalVisitors = Number(s.visitors) || 0;
  const bounceResult = totalVisitors > 0
    ? await db.execute({ sql: `SELECT COUNT(*) as bounced FROM pageviews ${baseWhere} AND is_unique = 1 AND (time_on_page IS NULL OR time_on_page < 5)`, args: baseArgs })
    : null;
  const bounceRate = bounceResult && totalVisitors > 0
    ? Math.round((Number(bounceResult.rows[0].bounced) / totalVisitors) * 1000) / 10
    : 0;

  return new Response(JSON.stringify({
    period: { from: range.from, to: range.to },
    summary: {
      pageviews: Number(s.pageviews) || 0,
      visitors: totalVisitors,
      avg_time_on_page: Number(s.avg_time) || 0,
      avg_scroll_depth: Number(s.avg_scroll) || 0,
      bounce_rate: bounceRate,
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
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
