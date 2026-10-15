import type { APIRoute } from "astro";
import { timeSafeEqual } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";
import { buildReportData, formatReport } from "~/lib/analytics-report";

export const prerender = false;

const HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

function reply(status: number, body: string): Response {
  return new Response(body, { status, headers: HEADERS });
}

/**
 * Read-only delivery endpoint for external senders (HAL on the NAS).
 * Auth: `Authorization: Bearer <ANALYTICS_REPORT_TOKEN>`. This is a dedicated, narrow token:
 * it can only read the weekly report text, never the admin API. Fails closed (503) when the
 * token is not configured. Returns the same plain-text report the Telegram sender uses.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const expected = env("ANALYTICS_REPORT_TOKEN");
  if (!expected) return reply(503, "not configured");

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !timeSafeEqual(given, expected)) return reply(401, "unauthorized");

  const period = url.searchParams.get("period") ?? "week";
  if (period !== "week") return reply(400, "unsupported period");

  try {
    const data = await buildReportData(getDb());
    return reply(200, formatReport(data));
  } catch (e) {
    console.error("[analytics-report]", e instanceof Error ? e.message : "failed");
    return reply(500, "report failed");
  }
};
