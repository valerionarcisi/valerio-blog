import type { APIRoute } from "astro";

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

  const importMeta: Record<string, string> = {};
  const processEnv: Record<string, string> = {};
  // Use bracket notation to prevent Vite from statically replacing process.env
  const env = globalThis["process"]?.["env"] ?? {};
  for (const key of keys) {
    const val = (import.meta as any).env?.[key];
    importMeta[key] = val ? `set (${val.length} chars)` : "NOT SET";
    const pVal = env[key];
    processEnv[key] = pVal ? `set (${pVal.length} chars)` : "NOT SET";
  }

  // Also list all available env var keys (not values) to see what's actually available
  const allEnvKeys = Object.keys(env).sort();

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
    JSON.stringify({ importMeta, processEnv, allEnvKeys, dbTest }, null, 2),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
