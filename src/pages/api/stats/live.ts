import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
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
