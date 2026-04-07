import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";
import { jsonOk } from "~/lib/result";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDb();
  const perPost = await db.execute(
    `SELECT post_id,
            SUM(count) AS total_claps,
            COUNT(DISTINCT visitor_hash) AS unique_clappers,
            MAX(updated_at) AS last_clap_at
     FROM post_claps
     GROUP BY post_id
     ORDER BY total_claps DESC`,
  );

  const totals = await db.execute(
    `SELECT COALESCE(SUM(count), 0) AS total,
            COUNT(DISTINCT post_id) AS posts,
            COUNT(DISTINCT visitor_hash) AS unique_clappers
     FROM post_claps`,
  );

  return jsonOk({
    totals: totals.rows[0],
    per_post: perPost.rows,
  });
};
