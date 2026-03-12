import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const cols = await db.execute("PRAGMA table_info(pageviews)");
const hasVisitorHash = cols.rows.some((r) => r.name === "visitor_hash");

if (!hasVisitorHash) {
  await db.execute(
    "ALTER TABLE pageviews ADD COLUMN visitor_hash TEXT",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_pv_visitor_hash ON pageviews(visitor_hash)",
  );
  console.log("Added visitor_hash column to pageviews.");
} else {
  console.log("visitor_hash column already exists.");
}

await db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS bot_hashes (
    hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
console.log("bot_hashes table ensured.");

console.log("Migration complete.");
