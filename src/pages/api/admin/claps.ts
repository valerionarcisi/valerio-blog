import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { jsonOk, jsonErr } from "~/lib/result";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const [perPost, totals] = await Promise.all([
      db.execute(
        `SELECT post_id,
            SUM(count) AS total_claps,
            COUNT(DISTINCT visitor_hash) AS unique_clappers,
            MAX(updated_at) AS last_clap_at
     FROM post_claps
     GROUP BY post_id
     ORDER BY total_claps DESC
     LIMIT 500`,
      ),
      db.execute(
        `SELECT COALESCE(SUM(count), 0) AS total,
            COUNT(DISTINCT post_id) AS posts,
            COUNT(DISTINCT visitor_hash) AS unique_clappers
     FROM post_claps`,
      ),
    ]);

    return jsonOk({
      totals: totals.rows[0],
      per_post: perPost.rows,
    });
  } catch (e) {
    console.error("[admin/claps GET]", e);
    return jsonErr("Internal error", 500);
  }
};
