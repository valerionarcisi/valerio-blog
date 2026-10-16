import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { getSessionDetail } from "~/lib/analytics-sessions-list";
import { jsonErr } from "~/lib/result";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (!/^\d{1,15}$/.test(params.id ?? "")) return jsonErr("Invalid session id", 400);
  const detail = await getSessionDetail(getDb(), Number(params.id));
  if (!detail) return jsonErr("Not found", 404);

  return new Response(JSON.stringify(detail), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
