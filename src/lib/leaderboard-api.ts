import type { Client } from "@libsql/client";
import { ok, err, type Result } from "~/lib/result";

// ═══════════════════════════════════════════════════════════════
// Leaderboard "Non Fa Ridere" — punteggi del mini-gioco arcade.
// Deep module: nasconde tabella, validazione e anti-cheat dietro
// submitScore() / topScores(). Gli endpoint non toccano mai SQL.
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = "non-fa-ridere";
const MAX_NAME_LENGTH = 24;
const MAX_PLAUSIBLE_SCORE = 1_000_000;
const TOP_LIMIT = 10;

export interface ScoreEntry {
  name: string;
  score: number;
  createdAt: string;
}

interface NewScore {
  name: string;
  score: number;
}

const _readyClients = new WeakSet<Client>();

async function ensureTable(db: Client): Promise<void> {
  if (_readyClients.has(db)) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS game_scores (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      score        INTEGER NOT NULL,
      visitor_hash TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_game_scores_top ON game_scores(game_id, score DESC)",
  );
  _readyClients.add(db);
}

function sanitizeName(raw: unknown): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length === 0) return "Anonimo";
  // Scarta i caratteri di controllo (code point < 0x20): spezzano il
  // rendering della leaderboard senza aggiungere informazione.
  const cleaned = Array.from(trimmed)
    .filter((ch) => ch.codePointAt(0)! >= 0x20)
    .join("");
  return cleaned.length === 0 ? "Anonimo" : cleaned.slice(0, MAX_NAME_LENGTH);
}

export function parseNewScore(body: unknown): Result<NewScore> {
  const record = (body ?? {}) as Record<string, unknown>;
  const rawScore = record.score;
  const score = typeof rawScore === "number" ? rawScore : Number(rawScore);

  if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    return err("score must be a non-negative integer");
  }
  if (score > MAX_PLAUSIBLE_SCORE) {
    return err("score out of range");
  }

  return ok({ name: sanitizeName(record.name), score });
}

export async function submitScore(
  db: Client,
  entry: NewScore,
  visitorHash: string,
): Promise<ScoreEntry> {
  await ensureTable(db);
  await db.execute({
    sql: "INSERT INTO game_scores (game_id, name, score, visitor_hash) VALUES (?, ?, ?, ?)",
    args: [GAME_ID, entry.name, entry.score, visitorHash],
  });
  return {
    name: entry.name,
    score: entry.score,
    createdAt: new Date().toISOString(),
  };
}

export async function topScores(
  db: Client,
  limit = TOP_LIMIT,
): Promise<ScoreEntry[]> {
  await ensureTable(db);
  const res = await db.execute({
    sql: `
      SELECT name, MAX(score) AS score, created_at
      FROM game_scores
      WHERE game_id = ?
      GROUP BY name
      ORDER BY score DESC, created_at ASC
      LIMIT ?
    `,
    args: [GAME_ID, limit],
  });
  return res.rows.map((row) => ({
    name: String(row.name),
    score: Number(row.score) || 0,
    createdAt: String(row.created_at),
  }));
}
