import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { isoDate, subtractDays } from "~/lib/date-range";
import { computeBlock, computeSessions } from "~/lib/stats-hybrid";
import { clampRange, filtersActive, parseFilters } from "~/lib/analytics-filters";
import { toCsv, type CsvValue } from "~/lib/csv";

export const prerender = false;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;
const EXPORT_KINDS = [
  "top_pages",
  "referrers",
  "utm",
  "channels",
  "events",
  "goals",
  "daily",
] as const;
type Kind = (typeof EXPORT_KINDS)[number];

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ url, request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const kind = url.searchParams.get("kind") as Kind | null;
  if (!kind || !EXPORT_KINDS.includes(kind)) return json(400, "Invalid kind");

  const today = isoDate(new Date());
  const from = url.searchParams.get("from") || isoDate(subtractDays(new Date(), 30));
  const to = url.searchParams.get("to") || today;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return json(400, "Invalid date");
  if (from > to) return json(400, "from must be <= to");
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_DAYS) {
    return json(400, `Range too large (max ${MAX_DAYS} days)`);
  }
  const parsed = parseFilters(url.searchParams);
  if (!parsed.ok) return json(400, parsed.error);
  const filters = parsed.value;
  const range = clampRange(from, to, today, filters);
  const includeAll = url.searchParams.get("include") === "all";

  const opts = {
    from: range.from,
    to: range.to,
    groupBy: "day",
    includeAll,
    today,
    filters,
    full: true,
  };
  const db = getDb();

  let headers: string[];
  let rows: CsvValue[][];
  switch (kind) {
    case "top_pages": {
      const b = await computeBlock(db, opts);
      headers = ["pathname", "pageviews", "visitors"];
      rows = b.topPages.map((r) => [r.pathname, r.pageviews, r.visitors]);
      break;
    }
    case "referrers": {
      const b = await computeBlock(db, opts);
      headers = ["referrer", "visitors"];
      rows = b.referrers.map((r) => [r.referrer ?? "(direct)", r.visitors]);
      break;
    }
    case "utm": {
      const b = await computeBlock(db, opts);
      headers = ["kind", "value", "visitors"];
      rows = [
        ...b.utmSources.map((r): CsvValue[] => ["source", r.utm_source, r.visitors]),
        ...b.utmCampaigns.map((r): CsvValue[] => ["campaign", r.utm_campaign, r.visitors]),
      ];
      break;
    }
    case "daily": {
      const b = await computeBlock(db, opts);
      headers = ["date", "pageviews", "visitors"];
      rows = b.chart.map((r) => [r.date, r.pageviews, r.visitors]);
      break;
    }
    case "channels": {
      const s = await computeSessions(db, opts);
      headers = ["channel", "sessions"];
      rows = s.channels.map((r) => [r.channel, r.sessions]);
      break;
    }
    case "events": {
      const s = await computeSessions(db, opts);
      headers = ["name", "prop", "count", "visitors"];
      rows = s.events.map((r) => [r.name, r.prop, r.count, r.visitors]);
      break;
    }
    case "goals": {
      const s = await computeSessions(db, opts);
      headers = ["goal", "label", "conversions", "rate_pct"];
      rows = s.goals.map((g) => [g.id, g.label, g.conversions, g.rate]);
      break;
    }
  }

  const name = `analytics-${kind}-${range.from}_${range.to}${filtersActive(filters) ? "-filtered" : ""}.csv`;
  return new Response(toCsv(headers, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
