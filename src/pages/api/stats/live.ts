import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { verifyAdminBearerToken } from "~/lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!verifyAdminBearerToken(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await getDb().execute({
    sql: "SELECT COUNT(DISTINCT page_id) as active FROM pageviews WHERE created_at > datetime('now', '-5 minutes')",
    args: [],
  });

  return new Response(
    JSON.stringify({ active: Number(result.rows[0].active) || 0 }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
