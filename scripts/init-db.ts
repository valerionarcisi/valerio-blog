import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

await client.execute(`
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    text       TEXT NOT NULL,
    approved   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

await client.execute(`
  CREATE INDEX IF NOT EXISTS idx_comments_page_approved
  ON comments(page_id, approved)
`);

console.log("Database initialized.");
