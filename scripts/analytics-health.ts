import { createClient } from "@libsql/client";
import { BOT_SCORE_THRESHOLD } from "../src/lib/bot-score";

// Read-only health check of the analytics data. Prints aggregate indicators only (no visitor ids, no IPs).
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx -y tsx scripts/analytics-health.ts [--days 7]

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}
const days = Math.min(Math.max(Number(arg("days") ?? 7) || 7, 1), 60);
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const n = async (sql: string, args: (string | number)[] = []) =>
  Number((await db.execute({ sql, args })).rows[0]?.n ?? 0);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "n/a");
const safe = async <T>(label: string, fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (e) {
    console.log(`  ${label}: not available (${(e instanceof Error ? e.message : String(e)).slice(0, 80)})`);
    return null;
  }
};

console.log(`Analytics health, since ${since} (UTC), ${days} day(s)\n`);

const total = await n("SELECT COUNT(*) n FROM pageviews WHERE created_at >= ?", [since]);
console.log(`Pageviews stored: ${total}`);
if (total === 0) {
  console.log("Nothing recorded in this window: check that the tracker reaches /api/e.");
  process.exit(0);
}

console.log("\nPer day: pageviews / human / unverified / bot");
const perDay = await db.execute({
  sql: `SELECT date(created_at) d, COUNT(*) pv,
          SUM(CASE WHEN COALESCE(bot_score,0) >= ${BOT_SCORE_THRESHOLD} THEN 0 WHEN COALESCE(human,0) = 1 THEN 1 ELSE 0 END) human,
          SUM(CASE WHEN COALESCE(bot_score,0) >= ${BOT_SCORE_THRESHOLD} THEN 0 WHEN COALESCE(human,0) = 0 THEN 1 ELSE 0 END) unverified,
          SUM(CASE WHEN COALESCE(bot_score,0) >= ${BOT_SCORE_THRESHOLD} THEN 1 ELSE 0 END) bot
        FROM pageviews WHERE created_at >= ? GROUP BY d ORDER BY d`,
  args: [since],
});
for (const r of perDay.rows) console.log(`  ${r.d}  ${r.pv} / ${r.human} / ${r.unverified} / ${r.bot}`);

console.log("\nSignal quality, rows from the NEW tracker only (the ones with a channel; older rows predate the signals)");
const v2 = await n("SELECT COUNT(*) n FROM pageviews WHERE created_at >= ? AND channel IS NOT NULL", [since]);
const humans = await n("SELECT COUNT(*) n FROM pageviews WHERE created_at >= ? AND channel IS NOT NULL AND human = 1", [since]);
const withTime = await n("SELECT COUNT(*) n FROM pageviews WHERE created_at >= ? AND channel IS NOT NULL AND time_on_page IS NOT NULL", [since]);
const noCountry = await n("SELECT COUNT(*) n FROM pageviews WHERE created_at >= ? AND channel IS NOT NULL AND country IS NULL", [since]);
const noChannel = total - v2;
const noHash = await n("SELECT COUNT(*) n FROM pageviews WHERE created_at >= ? AND visitor_hash IS NULL", [since]);
console.log(`  rows from the new tracker:        ${v2} (${pct(v2, total)} of the window; the rest is older data)`);
console.log(`  marked human:                     ${humans} (${pct(humans, v2)} of new-tracker rows)`);
console.log(`  with time on page (beacon ok):    ${withTime} (${pct(withTime, v2)})`);
console.log(`  without country:                  ${noCountry} (${pct(noCountry, v2)})`);
console.log(`  older rows (no channel):          ${noChannel}`);
console.log(`  without visitor hash:             ${noHash} (${pct(noHash, total)})`);

await safe("sessions", async () => {
  const s = await n("SELECT COUNT(*) n FROM sessions WHERE day >= ?", [since]);
  const bounced = await n("SELECT COUNT(*) n FROM sessions WHERE day >= ? AND pageviews = 1 AND COALESCE(engaged_seconds,0) < 10", [since]);
  const humanS = await n("SELECT COUNT(*) n FROM sessions WHERE day >= ? AND human = 1 AND COALESCE(bot_score,0) < ?", [since, BOT_SCORE_THRESHOLD]);
  console.log(`\nSessions: ${s}, human ${humanS} (${pct(humanS, s)}), bounce ${pct(bounced, s)}`);
});

await safe("events", async () => {
  const ev = await db.execute({ sql: "SELECT name, COUNT(*) n FROM events WHERE day >= ? GROUP BY name ORDER BY n DESC", args: [since] });
  console.log(`\nEvents: ${ev.rows.length ? ev.rows.map((r) => `${r.name}=${r.n}`).join(", ") : "none yet"}`);
});

await safe("rules", async () => {
  const r = await db.execute("SELECT kind, value, hits, enabled FROM bot_rules ORDER BY hits DESC LIMIT 10");
  console.log(`\nBot rules: ${r.rows.length ? r.rows.map((x) => `${x.kind}:${x.value}(${x.hits}${x.enabled ? "" : ",off"})`).join(", ") : "none"}`);
});

await safe("rollups", async () => {
  const have = await db.execute({ sql: "SELECT day FROM rollup_log WHERE day >= ? ORDER BY day", args: [since] });
  const set = new Set(have.rows.map((r) => String(r.day)));
  const missing: string[] = [];
  for (let d = new Date(since + "T00:00:00Z"); d.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10); d = new Date(d.getTime() + 86_400_000)) {
    const day = d.toISOString().slice(0, 10);
    if (!set.has(day)) missing.push(day);
  }
  console.log(`\nRollups: ${set.size} closed day(s) computed; missing: ${missing.length ? missing.join(", ") : "none"}`);
});

await safe("salts", async () => {
  const s = await db.execute("SELECT COUNT(*) n, MIN(day) oldest FROM analytics_salts");
  console.log(`\nDaily salts kept: ${s.rows[0].n} (oldest ${s.rows[0].oldest ?? "-"}); should be at most 3`);
});
db.close();
