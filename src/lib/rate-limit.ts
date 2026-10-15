import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";

const ready = new WeakSet<Client>();

async function ensureTable(db: Client): Promise<void> {
  if (ready.has(db)) return;
  await db.execute(
    `CREATE TABLE IF NOT EXISTS rate_limits (
       key TEXT NOT NULL,
       window_start INTEGER NOT NULL,
       count INTEGER NOT NULL,
       PRIMARY KEY (key, window_start)
     )`,
  );
  ready.add(db);
}

/** Hashed key from client IP + route (no raw IP stored). */
export function rateKey(request: Request, route: string): string {
  const ip =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return createHash("sha256").update(`${ip}|${route}`).digest("hex").slice(0, 32);
}

/**
 * Fixed-window limiter. Returns true if the request is allowed.
 * Fails OPEN: any DB error allows the request.
 */
export async function checkRate(
  db: Client,
  key: string,
  limit: number,
  windowSec: number,
  nowMs: number = Date.now(),
): Promise<boolean> {
  try {
    await ensureTable(db);
    const windowStart = Math.floor(nowMs / 1000 / windowSec) * windowSec;
    await db.execute({
      sql: `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
            ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`,
      args: [key, windowStart],
    });
    const res = await db.execute({
      sql: "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?",
      args: [key, windowStart],
    });
    const count = Number(res.rows[0]?.count ?? 1);
    // opportunistic cleanup of old windows
    if (Math.random() < 0.01) {
      db.execute({
        sql: "DELETE FROM rate_limits WHERE window_start < ?",
        args: [windowStart - 3600],
      }).catch(() => {});
    }
    return count <= limit;
  } catch {
    return true;
  }
}
