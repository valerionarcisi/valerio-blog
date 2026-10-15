import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { isoDate } from "~/lib/date-range";
import { eachDay, rollupRange } from "~/lib/analytics-rollup";
import { jsonErr, jsonOk, parseJsonBody } from "~/lib/result";

export const prerender = false;

export const MAX_ROLLUP_DAYS = 400;

function validDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && isoDate(d) === v;
}

/**
 * POST {from, to} (YYYY-MM-DD, UTC, inclusive, max 400 days, `to` before today):
 * (re)computes the daily rollups. Idempotent; used for backfills and to refresh
 * days after bot flags/rule changes.
 */
export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const body = await parseJsonBody(request);
  if (!body.ok) return jsonErr(body.error, 400);
  const b = (body.value ?? {}) as Record<string, unknown>;
  if (!validDay(b.from) || !validDay(b.to)) return jsonErr("Invalid date", 400);
  if (b.from > b.to) return jsonErr("from must be <= to", 400);
  if (b.to >= isoDate(new Date())) return jsonErr("to must be before today (UTC)", 400);
  if (eachDay(b.from, b.to).length > MAX_ROLLUP_DAYS)
    return jsonErr(`Range too large (max ${MAX_ROLLUP_DAYS} days)`, 400);

  try {
    const rolled = await rollupRange(getDb(), b.from, b.to);
    return jsonOk({ ok: true, days: rolled.length, rows_in: rolled.reduce((a, r) => a + r.rowsIn, 0) });
  } catch (e) {
    console.error("[admin/analytics-rollup]", e);
    return jsonErr("Internal error", 500);
  }
};
