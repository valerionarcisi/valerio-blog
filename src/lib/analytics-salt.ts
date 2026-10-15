import type { Client } from "@libsql/client";

const FALLBACK_TTL_MS = 60_000;

interface CacheEntry {
  salt: string;
  expiresAt: number | null;
}

const cache = new WeakMap<Client, Map<string, CacheEntry>>();
let processSalt: string | null = null;

function randomHex(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function entries(db: Client): Map<string, CacheEntry> {
  let m = cache.get(db);
  if (!m) {
    m = new Map();
    cache.set(db, m);
  }
  return m;
}

export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDay(day: string, deltaDays: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return utcDay(d);
}

/**
 * Secret salt for the given UTC day, shared by all instances through the DB.
 * Never throws: if the DB is unreachable (or the migration is not applied)
 * a short-lived per-process random salt is used so tracking keeps working.
 */
export async function getDailySalt(db: Client, day: string): Promise<string> {
  const map = entries(db);
  const hit = map.get(day);
  if (hit && (hit.expiresAt === null || hit.expiresAt > Date.now())) {
    return hit.salt;
  }
  try {
    await db.execute({
      sql: "INSERT OR IGNORE INTO analytics_salts (day, salt) VALUES (?, ?)",
      args: [day, randomHex()],
    });
    const res = await db.execute({
      sql: "SELECT salt FROM analytics_salts WHERE day = ?",
      args: [day],
    });
    const salt = String(res.rows[0]?.salt ?? "");
    if (!salt) throw new Error("salt not found");
    map.set(day, { salt, expiresAt: null });
    return salt;
  } catch {
    processSalt ??= randomHex();
    map.set(day, {
      salt: processSalt,
      expiresAt: Date.now() + FALLBACK_TTL_MS,
    });
    return processSalt;
  }
}

/** Read-only lookup, used to validate beacons that cross midnight. */
export async function peekSalt(
  db: Client,
  day: string,
): Promise<string | null> {
  const hit = entries(db).get(day);
  if (hit && hit.expiresAt === null) return hit.salt;
  try {
    const res = await db.execute({
      sql: "SELECT salt FROM analytics_salts WHERE day = ?",
      args: [day],
    });
    return res.rows[0]?.salt ? String(res.rows[0].salt) : null;
  } catch {
    return null;
  }
}

/** Deletes salts (and the unique-visitor ledger) older than 2 days. */
export async function purgeOldSalts(db: Client, today: string): Promise<void> {
  const cutoff = shiftDay(today, -2);
  try {
    await db.execute({
      sql: "DELETE FROM analytics_salts WHERE day < ?",
      args: [cutoff],
    });
    await db.execute({
      sql: "DELETE FROM daily_visitors WHERE day < ?",
      args: [cutoff],
    });
  } catch {
    // tables may not exist yet
  }
}

export function maybePurgeOldSalts(
  db: Client,
  today: string,
  random: () => number = Math.random,
): void {
  if (random() < 0.01) void purgeOldSalts(db, today);
}
