import { createClient } from "@libsql/client";
import { rollupRange } from "../src/lib/analytics-rollup";

// Backfill daily rollups from raw pageviews. Idempotent (safe to re-run).
// Run AFTER scripts/migrate-analytics-v2.ts:
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/analytics-backfill.ts --from 2026-07-01 --to 2026-10-14
// Days are UTC, inclusive; `--to` defaults to yesterday. Raw rows older than 90 days
// are pruned by the nightly job ONLY for days that have a rollup, so backfill first.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const from = arg("from");
const to =
  arg("to") ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
  console.error("Usage: analytics-backfill.ts --from YYYY-MM-DD [--to YYYY-MM-DD]");
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const res = await rollupRange(db, from, to);
for (const r of res) console.log(`${r.day}: ${r.rowsIn} raw rows`);
console.log(`Backfilled ${res.length} days.`);
db.close();
