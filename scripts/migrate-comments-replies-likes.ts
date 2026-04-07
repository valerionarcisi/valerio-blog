import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function columnExists(table: string, column: string): Promise<boolean> {
  const res = await client.execute({
    sql: `SELECT 1 FROM pragma_table_info(?) WHERE name = ?`,
    args: [table, column],
  });
  return res.rows.length > 0;
}

async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (await columnExists(table, column)) {
    console.log(`  ↳ ${table}.${column} already exists, skipping`);
    return;
  }
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  ↳ added ${table}.${column}`);
}

console.log("Migrating comments table for replies + likes...");

await addColumnIfMissing("comments", "parent_id", "INTEGER REFERENCES comments(id) ON DELETE CASCADE");
await addColumnIfMissing("comments", "likes_count", "INTEGER NOT NULL DEFAULT 0");
await addColumnIfMissing("comments", "notified_approved", "INTEGER NOT NULL DEFAULT 0");
await addColumnIfMissing("comments", "lang", "TEXT NOT NULL DEFAULT 'it'");

await client.execute(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)`);
console.log("  ↳ idx_comments_parent ensured");

await client.execute(`
  CREATE TABLE IF NOT EXISTS comment_likes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id   INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    visitor_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(comment_id, visitor_hash)
  )
`);
console.log("  ↳ comment_likes table ensured");

await client.execute(`CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)`);
await client.execute(`CREATE INDEX IF NOT EXISTS idx_comment_likes_hash ON comment_likes(visitor_hash)`);
console.log("  ↳ comment_likes indexes ensured");

console.log("Migration complete.");
