import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { listSessions, parseSessionsQuery } from "~/lib/analytics-sessions-list";
import { jsonErr } from "~/lib/result";

export const prerender = false;

// "Utenti" view: recent sessions, newest first, keyset-paginated on (started_at, id).
// Responses carry a 6-char user prefix only, never the visitor hash or any IP.
export const GET: APIRoute = async ({ url, request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const q = parseSessionsQuery(url.searchParams);
  if (!q.ok) return jsonErr(q.error, 400);

  const page = await listSessions(getDb(), q.value);
  return new Response(JSON.stringify(page), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
