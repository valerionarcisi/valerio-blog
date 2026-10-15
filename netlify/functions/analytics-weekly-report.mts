import { createClient } from "@libsql/client/web";
// Relative imports on purpose: Netlify bundles functions with esbuild, which does not
// know the Astro `~/` alias.
import { runWeeklyReport, resolveTarget, isReportDisabled } from "../../src/lib/analytics-report";

/**
 * Netlify Scheduled Function: weekly analytics report on Telegram (plain text).
 * Cron is UTC: `0 6 * * 1` = Monday 07:00 Europe/Rome in winter (CET), 08:00 in
 * summer (CEST). The drift of one hour with DST is accepted. Netlify cron has no timezone.
 *
 * Env (runtime, like analytics-rollup.mts: `env()` needs the Vite-injected build-time
 * values, which do not exist in this separately bundled function):
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, TELEGRAM_BOT_TOKEN,
 *   ANALYTICS_REPORT_CHAT_ID (fallback: first id of TELEGRAM_USER_ID_WHITELIST),
 *   ANALYTICS_REPORT_VIA_NETLIFY=1 to send from here (default: off, HAL delivers it),
 *   ANALYTICS_REPORT_DISABLED=1 to opt out.
 * Without a bot token or target it logs and does nothing.
 */
function runtimeEnv(key: string): string {
  const netlify = (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } })
    .Netlify;
  return netlify?.env?.get(key) ?? process.env[key] ?? "";
}

export default async (): Promise<Response> => {
  // Opt-in: by default HAL (the NAS bot) fetches GET /api/analytics-report and delivers the report,
  // so sending from here too would duplicate it.
  if (runtimeEnv("ANALYTICS_REPORT_VIA_NETLIFY") !== "1") {
    console.log("[analytics-weekly-report] delivery delegated (set ANALYTICS_REPORT_VIA_NETLIFY=1 to send from Netlify)");
    return new Response("delegated");
  }
  if (isReportDisabled(runtimeEnv)) {
    console.log("[analytics-weekly-report] disabled (ANALYTICS_REPORT_DISABLED)");
    return new Response("disabled");
  }
  if (!resolveTarget(runtimeEnv)) {
    console.log("[analytics-weekly-report] no TELEGRAM_BOT_TOKEN or chat id: nothing to do");
    return new Response("no target");
  }
  const url = runtimeEnv("TURSO_DATABASE_URL");
  if (!url) {
    console.error("[analytics-weekly-report] TURSO_DATABASE_URL missing");
    return new Response("missing TURSO_DATABASE_URL", { status: 500 });
  }
  const db = createClient({ url, authToken: runtimeEnv("TURSO_AUTH_TOKEN") });
  try {
    const r = await runWeeklyReport(db, runtimeEnv, { send: true });
    console.log("[analytics-weekly-report]", JSON.stringify({ sent: r.sent, skipped: r.skipped }));
    return new Response(JSON.stringify({ ok: true, sent: r.sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analytics-weekly-report] failed", e instanceof Error ? e.message : "error");
    return new Response("report failed", { status: 500 });
  } finally {
    db.close();
  }
};

export const config = { schedule: "0 6 * * 1" };
