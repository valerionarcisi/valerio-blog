import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { env } from "~/lib/env";
import { runWeeklyReport } from "~/lib/analytics-report";
import { jsonErr, jsonOk } from "~/lib/result";

export const prerender = false;

/**
 * POST {send?: boolean}. Default is a DRY RUN: returns the report text and sends
 * nothing. `send: true` delivers it to Telegram (ANALYTICS_REPORT_CHAT_ID, else
 * the first id of TELEGRAM_USER_ID_WHITELIST); skipped when
 * ANALYTICS_REPORT_DISABLED=1 or when no target is configured.
 */
export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: unknown = {};
  const raw = await request.text();
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonErr("Invalid JSON", 400);
    }
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.send !== undefined && typeof b.send !== "boolean") {
    return jsonErr("send must be a boolean", 400);
  }

  try {
    const result = await runWeeklyReport(getDb(), (k) => env(k), { send: b.send === true });
    return jsonOk(result);
  } catch (e) {
    console.error("[admin/analytics-report]", e instanceof Error ? e.message : "failed");
    return jsonErr("Report failed", 500);
  }
};
