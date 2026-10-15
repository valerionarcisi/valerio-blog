import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { BOT_SQL } from "~/lib/bot-verdict";
import { tableExists } from "~/lib/analytics-rollup";

export const prerender = false;

// Live = everyone who is NOT a bot (human OR unverified). A visitor who just arrived has not
// had time to scroll/click or sit 3 s yet, so requiring human = 1 would always undercount "now".
export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const db = getDb();
  const where = `created_at > datetime('now', '-5 minutes') AND NOT ${BOT_SQL}`;
  // Phase 2: with the sessions table, "active" = sessions seen in the last 5 minutes
  // (indexed on last_seen_at; bot sessions excluded). Falls back to the pageviews query.
  let activeSql = `SELECT COUNT(DISTINCT visitor_hash) as n FROM pageviews WHERE ${where}`;
  try {
    if (await tableExists(db, "sessions")) {
      activeSql = `SELECT COUNT(DISTINCT visitor_hash) as n FROM sessions WHERE last_seen_at > datetime('now', '-5 minutes') AND NOT ${BOT_SQL}`;
    }
  } catch {
    /* keep the fallback */
  }
  const [active, pageviews] = await Promise.all([
    db.execute({ sql: activeSql, args: [] }),
    db.execute({
      sql: `SELECT COUNT(*) as n FROM pageviews WHERE ${where}`,
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
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
};
