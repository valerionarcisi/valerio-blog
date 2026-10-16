import { createClient } from "@libsql/client";
import { buildRollupStatements } from "../src/lib/analytics-rollup";

// Dry-runs the rollup SQL against a REAL database to find statements its server cannot parse or run
// (local SQLite is more permissive than the Turso server). Every statement runs on its own inside ONE
// transaction that is ALWAYS rolled back, so nothing is written. Prints every failure, not just the first.
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
console.log(failed === 0 ? "\nAll statements ran fine (rolled back)." : `\n${failed} statement(s) failed. Nothing was written.`);
db.close();
process.exit(failed === 0 ? 0 : 2);
