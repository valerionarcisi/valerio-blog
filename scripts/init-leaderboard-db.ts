import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

await client.execute(`
  CREATE TABLE IF NOT EXISTS game_scores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id      TEXT NOT NULL,
    name         TEXT NOT NULL,
    score        INTEGER NOT NULL,
    visitor_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

await client.execute(
  `CREATE INDEX IF NOT EXISTS idx_game_scores_top ON game_scores(game_id, score DESC)`,
);

console.log("Leaderboard table initialized.");
