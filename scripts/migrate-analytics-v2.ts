import { createClient, type Client } from "@libsql/client";
import { pathToFileURL } from "node:url";
import { ROLLUP_DDL } from "../src/lib/analytics-rollup-schema";
import { SESSIONS_DDL } from "../src/lib/analytics-sessions";

// Analytics v2 / phase 1. Fully idempotent: safe to run any number of times.
// Run: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-analytics-v2.ts

async function columnExists(
  db: Client,
  table: string,
  column: string,
): Promise<boolean> {
  const res = await db.execute(`PRAGMA table_info(${table})`);
  return res.rows.some((r) => r.name === column);
}

export async function migrateAnalyticsV2(db: Client): Promise<string[]> {
  const log: string[] = [];

  if (!(await columnExists(db, "pageviews", "channel"))) {
    await db.execute("ALTER TABLE pageviews ADD COLUMN channel TEXT");
    log.push("added pageviews.channel");
  }

  // Phase 4: bot detection model.
  if (!(await columnExists(db, "pageviews", "human"))) {
    await db.execute(
      "ALTER TABLE pageviews ADD COLUMN human INTEGER DEFAULT 0",
    );
    log.push("added pageviews.human");
  }
  if (!(await columnExists(db, "pageviews", "bot_score"))) {
    await db.execute(
      "ALTER TABLE pageviews ADD COLUMN bot_score INTEGER DEFAULT 0",
    );
    log.push("added pageviews.bot_score");
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS bot_rules (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      kind       TEXT NOT NULL,
      value      TEXT NOT NULL,
      note       TEXT,
      enabled    INTEGER NOT NULL DEFAULT 1,
      hits       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_salts (
      day  TEXT PRIMARY KEY,
      salt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_visitors (
      day          TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      PRIMARY KEY (day, visitor_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_pv_visitor_day ON pageviews(visitor_hash, created_at);
  `);
  log.push("ensured bot_rules, analytics_salts, daily_visitors, idx_pv_visitor_day");

  // Phase 3: daily rollups.
  await db.executeMultiple(ROLLUP_DDL);
  log.push("ensured daily_stats, daily_pages, daily_dims, rollup_log");

  // Phase 2: cookieless sessions + custom events (raw tables; their rollups are in ROLLUP_DDL).
  await db.executeMultiple(SESSIONS_DDL);
  if (!(await columnExists(db, "pageviews", "session_id"))) {
    await db.execute("ALTER TABLE pageviews ADD COLUMN session_id INTEGER");
    log.push("added pageviews.session_id");
  }
  log.push(
    "ensured sessions, events, daily_sessions, daily_events, daily_entry_exit, daily_goals",
  );

  // Phase 5: Core Web Vitals (daily_vitals itself is in ROLLUP_DDL above).
  for (const [col, type] of [
    ["lcp_ms", "INTEGER"],
    ["cls_milli", "INTEGER"],
    ["inp_ms", "INTEGER"],
  ] as const) {
    if (!(await columnExists(db, "pageviews", col))) {
      await db.execute(`ALTER TABLE pageviews ADD COLUMN ${col} ${type}`);
      log.push(`added pageviews.${col}`);
    }
  }
  log.push("ensured daily_vitals");

  return log;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const log = await migrateAnalyticsV2(db);
  for (const line of log) console.log(line);
  console.log("Analytics v2 migration complete.");
}
