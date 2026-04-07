import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

await client.execute(`
  CREATE TABLE IF NOT EXISTS comments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL,
    text              TEXT NOT NULL,
    approved          INTEGER NOT NULL DEFAULT 0,
    parent_id         INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    likes_count       INTEGER NOT NULL DEFAULT 0,
    notified_approved INTEGER NOT NULL DEFAULT 0,
    lang              TEXT NOT NULL DEFAULT 'it',
    is_author         INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

await client.execute(`
  CREATE INDEX IF NOT EXISTS idx_comments_page_approved
  ON comments(page_id, approved)
`);

await client.execute(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS comment_likes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id   INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    visitor_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(comment_id, visitor_hash)
  )
`);

await client.execute(`CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)`);
await client.execute(`CREATE INDEX IF NOT EXISTS idx_comment_likes_hash ON comment_likes(visitor_hash)`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS post_claps (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id      TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(post_id, visitor_hash)
  )
`);

await client.execute(`CREATE INDEX IF NOT EXISTS idx_post_claps_post ON post_claps(post_id)`);
await client.execute(`CREATE INDEX IF NOT EXISTS idx_post_claps_hash ON post_claps(visitor_hash)`);

console.log("Database initialized.");
