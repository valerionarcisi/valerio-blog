import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { aiCrawlStats } from "~/lib/ai-crawlers-stats";
import { isValidDate, jsonErr } from "~/lib/result";

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isValidDate(from) || !isValidDate(to) || from > to) return jsonErr("invalid_range", 400);

  const stats = await aiCrawlStats(getDb(), from, to);
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
