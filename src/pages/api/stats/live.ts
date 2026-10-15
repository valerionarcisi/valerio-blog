import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

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
