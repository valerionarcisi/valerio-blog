import { createClient } from "@libsql/client";
import { buildRollupStatements } from "../src/lib/analytics-rollup";
import {
  getSessionDetail,
  listActiveSessions,
  listSessions,
  parseSessionsQuery,
} from "../src/lib/analytics-sessions-list";

// Dry-runs the rollup SQL against a REAL database to find statements its server cannot parse or run
// (local SQLite is more permissive than the Turso server). Every statement runs on its own inside ONE
// transaction that is ALWAYS rolled back, so nothing is written. Prints every failure, not just the first.
// Phase 2 also runs the read queries behind the "Utenti" dashboard (session list, detail, who is online).
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx -y tsx scripts/analytics-sql-check.ts [--day YYYY-MM-DD]

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}
const day = arg("day") ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const stmts = await buildRollupStatements(db, day);
console.log(`Checking ${stmts.length} rollup statements for ${day} (nothing is written)...`);

const tx = await db.transaction("write");
let failed = 0;
try {
  for (const [i, st] of stmts.entries()) {
    const sql = typeof st === "string" ? st : st.sql;
    const args = typeof st === "string" ? [] : (st.args ?? []);
    try {
      await tx.execute({ sql, args: args as never });
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`\n#${i} FAILED: ${msg.slice(0, 220)}\n   ${sql.replace(/\s+/g, " ").slice(0, 200)}`);
    }
  }
} finally {
  await tx.rollback();
  tx.close();
}
console.log(failed === 0 ? "\nAll rollup statements ran fine (rolled back)." : `\n${failed} rollup statement(s) failed. Nothing was written.`);

console.log("\nChecking the read queries of the Utenti dashboard...");
let readFailed = 0;
const attempt = async (label: string, fn: () => Promise<string>) => {
  try {
    console.log(`  ok   ${label}: ${await fn()}`);
  } catch (e) {
    readFailed++;
    console.log(`  FAIL ${label}: ${(e instanceof Error ? e.message : String(e)).slice(0, 220)}`);
  }
};
const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
const to = new Date().toISOString().slice(0, 10);
let firstId: number | null = null;
for (const verdict of ["human", "all", "unverified", "bot"]) {
  const parsed = parseSessionsQuery(new URLSearchParams({ from, to, verdict, limit: "5" }));
  if (!parsed.ok) {
    console.log(`  FAIL parse ${verdict}: ${parsed.error}`);
    readFailed++;
    continue;
  }
  await attempt(`listSessions verdict=${verdict}`, async () => {
    const page = await listSessions(db, parsed.value);
    if (page.sessions[0] && firstId == null) firstId = page.sessions[0].id;
    return `${page.sessions.length} sessions, available=${page.available}`;
  });
}
const withFilters = parseSessionsQuery(
  new URLSearchParams({ from, to, verdict: "all", limit: "5", country: "IT", device: "mobile", channel: "direct", with_events: "1" }),
);
if (withFilters.ok) await attempt("listSessions + filters + events", async () => `${(await listSessions(db, withFilters.value)).sessions.length} sessions`);
if (firstId != null) await attempt("getSessionDetail", async () => `${(await getSessionDetail(db, firstId as number))?.pageviews.length ?? 0} pageviews`);
await attempt("listActiveSessions", async () => `${(await listActiveSessions(db)).length} online`);
console.log(readFailed === 0 ? "\nAll read queries ran fine." : `\n${readFailed} read query/queries failed.`);

db.close();
process.exit(failed + readFailed === 0 ? 0 : 2);
