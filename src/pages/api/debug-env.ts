import type { APIRoute } from "astro";
import { env } from "~/lib/env";

export const prerender = false;

export const GET: APIRoute = async () => {
  const keys = [
    "ADMIN_TOKEN",
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",
    "STRAVA_CLIENT_ID",
    "STRAVA_CLIENT_SECRET",
    "STRAVA_REFRESH_TOKEN",
    "TMDB_API_KEY",
    "LASTFM_API_KEY",
    "RESEND_API_KEY",
  ];

  const result: Record<string, string> = {};
  for (const key of keys) {
    const val = env(key);
    result[key] = val ? `set (${val.length} chars)` : "NOT SET";
  }

  let dbTest = "not tested";
  try {
    const { default: getDb } = await import("~/lib/turso");
    const db = getDb();
    await db.execute("SELECT 1");
    dbTest = "OK";
  } catch (e: any) {
    dbTest = `ERROR: ${e.message}`;
  }

  return new Response(
    JSON.stringify({ env: result, dbTest }, null, 2),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
