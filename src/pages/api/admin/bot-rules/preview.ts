import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { jsonErr, jsonOk, parseJsonBody } from "~/lib/result";
import { parseRuleInput, previewClause } from "~/lib/bot-rules";

export const prerender = false;

/**
 * POST {kind, value} -> how many stored pageviews of the last 7 days the candidate rule would
 * have excluded, and how many of those carry a human signal (false-positive warning).
 * ua_contains cannot be previewed: the raw User-Agent is never stored.
 */
export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await parseJsonBody(request);
  if (!body.ok) return jsonErr(body.error, 400);
  const parsed = parseRuleInput(body.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const clause = previewClause(parsed.kind, parsed.value);
  if (!clause) {
    return jsonOk({
      supported: false,
      reason: "User-Agent is not stored: ua_contains cannot be previewed",
      excluded: null,
      human: null,
    });
  }
  const res = await getDb().execute({
    sql: `SELECT COUNT(*) AS excluded, COALESCE(SUM(CASE WHEN COALESCE(human, 0) = 1 THEN 1 ELSE 0 END), 0) AS human
          FROM pageviews
          WHERE created_at >= datetime('now', '-7 days') AND ${clause.sql}`,
    args: clause.args,
  });
  return jsonOk({
    supported: true,
    days: 7,
    excluded: Number(res.rows[0].excluded) || 0,
    human: Number(res.rows[0].human) || 0,
  });
};
