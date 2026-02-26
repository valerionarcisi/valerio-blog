import type { APIRoute } from "astro";
import getDb from "~/lib/turso";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== import.meta.env.ANALYTICS_ADMIN_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await getDb().execute({
    sql: "SELECT COUNT(DISTINCT page_id) as active FROM pageviews WHERE created_at > datetime('now', '-5 minutes')",
    args: [],
  });

  return new Response(JSON.stringify({ active: Number(result.rows[0].active) || 0 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
