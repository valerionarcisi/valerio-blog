import type { Client } from "@libsql/client";

/**
 * Cookieless sessions (Analytics v2 / phase 2).
 *
 * A session = pageviews of the SAME visitor_hash with a gap < 30 minutes.
 * The hash rotates every UTC day (daily secret salt), so a visit that crosses
 * UTC midnight legitimately SPLITS into two sessions: this is the price of not
 * having a persistent identifier. `day` is the UTC day the session STARTED.
 *
 * Bounce (the "real" one, unlike the legacy summary.bounce_rate): a session
 * with exactly 1 pageview and engaged_seconds < 10.
 */
export const SESSION_GAP_MS = 30 * 60 * 1000;
export const BOUNCE_MAX_ENGAGED_SECONDS = 10;

/** Raw tables + indexes (idempotent). Used by the migration script and tests. */
export const SESSIONS_DDL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    day             TEXT NOT NULL,
    visitor_hash    TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    last_seen_at    TEXT NOT NULL,
    entry_path      TEXT,
    exit_path       TEXT,
    pageviews       INTEGER NOT NULL DEFAULT 1,
    engaged_seconds INTEGER NOT NULL DEFAULT 0,
    channel         TEXT,
    referrer        TEXT,
    country         TEXT,
    device_type     TEXT,
    human           INTEGER DEFAULT 0,
    bot_score       INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_visitor_seen ON sessions(visitor_hash, last_seen_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(day);

  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT DEFAULT (datetime('now')),
    day          TEXT,
    session_id   INTEGER,
    visitor_hash TEXT,
    name         TEXT NOT NULL,
    path         TEXT,
    prop         TEXT,
    page_id      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_day_name ON events(day, name);
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
`;

/** SQLite `datetime('now')` format, UTC: "YYYY-MM-DD HH:MM:SS". */
export function sqlTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** A session whose last_seen_at is after this is still open. */
export function sessionCutoff(now: Date): string {
  return sqlTime(new Date(now.getTime() - SESSION_GAP_MS));
}

/** Beacons carry the CUMULATIVE visible time: only the increase counts, never negative. */
export function engagedDelta(
  previous: number | null | undefined,
  next: number | null | undefined,
): number {
  const p = Number(previous) || 0;
  const n = Number(next) || 0;
  return Math.max(0, n - p);
}

export function isBounce(pageviews: number, engagedSeconds: number): boolean {
  return pageviews === 1 && engagedSeconds < BOUNCE_MAX_ENGAGED_SECONDS;
}

export interface SessionPageview {
  visitorHash: string;
  pathname: string;
  channel: string | null;
  referrer: string | null;
  country: string | null;
  deviceType: string | null;
  botScore: number;
  now: Date;
}

/**
 * Finds the visitor's open session (last seen < 30 min ago) or creates one, and
 * records this pageview on it. Returns the session id. Throws when the sessions
 * table does not exist (caller degrades). Two near-simultaneous first pageviews
 * can create two sessions: accepted, no cross-request locking on purpose.
 */
export async function recordSessionPageview(
  db: Client,
  p: SessionPageview,
): Promise<number> {
  const now = sqlTime(p.now);
  const open = await db.execute({
    sql: `SELECT id FROM sessions
          WHERE visitor_hash = ? AND last_seen_at > ?
          ORDER BY last_seen_at DESC LIMIT 1`,
    args: [p.visitorHash, sessionCutoff(p.now)],
  });
  if (open.rows.length > 0) {
    const id = Number(open.rows[0].id);
    await db.execute({
      sql: `UPDATE sessions
            SET pageviews = pageviews + 1, exit_path = ?, last_seen_at = ?,
                bot_score = MAX(COALESCE(bot_score, 0), ?)
            WHERE id = ?`,
      args: [p.pathname, now, p.botScore, id],
    });
    return id;
  }
  const res = await db.execute({
    sql: `INSERT INTO sessions
            (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path,
             pageviews, engaged_seconds, channel, referrer, country, device_type, human, bot_score)
          VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, 0, ?)`,
    args: [
      now.slice(0, 10),
      p.visitorHash,
      now,
      now,
      p.pathname,
      p.pathname,
      p.channel,
      p.referrer,
      p.country,
      p.deviceType,
      p.botScore,
    ],
  });
  return Number(res.lastInsertRowid);
}

/** The session inherits `human` when ANY of its pageviews is human (Phase 4 semantics). */
export async function markSessionHuman(
  db: Client,
  sessionId: number,
): Promise<void> {
  await db.execute({
    sql: "UPDATE sessions SET human = 1 WHERE id = ?",
    args: [sessionId],
  });
}

/** Adds the beacon's engaged-time delta and extends the session. */
export async function addSessionEngagement(
  db: Client,
  sessionId: number,
  deltaSeconds: number,
  now: Date,
): Promise<void> {
  await db.execute({
    sql: `UPDATE sessions
          SET engaged_seconds = engaged_seconds + ?,
              last_seen_at = MAX(last_seen_at, ?)
          WHERE id = ?`,
    args: [Math.max(0, Math.round(deltaSeconds)), sqlTime(now), sessionId],
  });
}
