import { createClient } from "@libsql/client/web";
// Relative imports on purpose: Netlify bundles functions with esbuild, which does not
// know the Astro `~/` alias.
import { runDailyJob } from "../../src/lib/analytics-rollup";

/**
 * Netlify Scheduled Function: daily analytics rollup + retention.
 * Runs at 00:20 UTC, rolls up yesterday AND the day before (late beacons), then
 * prunes raw rows older than 90 days (only for days that have a rollup).
 *
 * Env: src/lib/env.ts reads a value injected by Vite at build time (`__ENCODED_ENV__`),
 * which does not exist in this separately bundled function, so TURSO_* are read from the
 * function's runtime environment (Netlify env vars must be available to "Functions").
 */
function runtimeEnv(key: string): string {
  const netlify = (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } })
    .Netlify;
  return netlify?.env?.get(key) ?? process.env[key] ?? "";
}

export default async (): Promise<Response> => {
  const url = runtimeEnv("TURSO_DATABASE_URL");
  if (!url) {
    console.error("[analytics-rollup] TURSO_DATABASE_URL missing");
    return new Response("missing TURSO_DATABASE_URL", { status: 500 });
  }
  const db = createClient({ url, authToken: runtimeEnv("TURSO_AUTH_TOKEN") });
  try {
    const { rolled, pruned } = await runDailyJob(db);
    console.log("[analytics-rollup]", JSON.stringify({ rolled, pruned }));
    return new Response(JSON.stringify({ ok: true, rolled, pruned }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analytics-rollup] failed", e);
    return new Response("rollup failed", { status: 500 });
  } finally {
    db.close();
  }
};

export const config = { schedule: "20 0 * * *" };
