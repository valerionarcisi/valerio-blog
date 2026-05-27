import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const db = getDb();
  const [active, pageviews] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(DISTINCT visitor_hash) as n FROM pageviews
            WHERE created_at > datetime('now', '-5 minutes')
            AND (visitor_hash IS NULL OR visitor_hash NOT IN (SELECT hash FROM bot_hashes))`,
      args: [],
    }),
    db.execute({
      sql: `SELECT COUNT(*) as n FROM pageviews
            WHERE created_at > datetime('now', '-5 minutes')
            AND (visitor_hash IS NULL OR visitor_hash NOT IN (SELECT hash FROM bot_hashes))`,
      args: [],
    }),
  ]);

  return new Response(
    JSON.stringify({
      active: Number(active.rows[0].n) || 0,
      pageviews5m: Number(pageviews.rows[0].n) || 0,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
};
