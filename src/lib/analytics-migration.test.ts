import { describe, test, expect } from "vitest";
import { createClient } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../scripts/migrate-analytics-v2";

async function legacyDb() {
  const db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL, hostname TEXT NOT NULL, pathname TEXT NOT NULL,
      visitor_hash TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO pageviews (page_id, hostname, pathname, visitor_hash)
      VALUES ('p1', 'valerionarcisi.me', '/', 'abc');
  `);
  return db;
}

async function schemaSnapshot(db: Awaited<ReturnType<typeof legacyDb>>) {
  const cols = (await db.execute("PRAGMA table_info(pageviews)")).rows.map(
    (r) => r.name,
  );
  const objs = (
    await db.execute(
      "SELECT type, name FROM sqlite_master WHERE name IN ('analytics_salts','daily_visitors','idx_pv_visitor_day') ORDER BY name",
    )
  ).rows.map((r) => `${r.type}:${r.name}`);
  return { cols, objs };
}

describe("migrateAnalyticsV2", () => {
  test("adds channel, tables and index to a legacy database, keeping data", async () => {
    const db = await legacyDb();
    await migrateAnalyticsV2(db);
    const { cols, objs } = await schemaSnapshot(db);
    expect(cols).toContain("channel");
    expect(objs).toEqual([
      "table:analytics_salts",
      "table:daily_visitors",
      "index:idx_pv_visitor_day",
    ]);
    const rows = await db.execute("SELECT page_id, channel FROM pageviews");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].channel).toBeNull();
  });

  test("is idempotent: running twice changes nothing and does not throw", async () => {
    const db = await legacyDb();
    await migrateAnalyticsV2(db);
    const first = await schemaSnapshot(db);
    await db.execute(
      "INSERT INTO analytics_salts (day, salt) VALUES ('2026-10-15', 's')",
    );
    await expect(migrateAnalyticsV2(db)).resolves.toBeDefined();
    expect(await schemaSnapshot(db)).toEqual(first);
    expect(
      (await db.execute("SELECT * FROM analytics_salts")).rows,
    ).toHaveLength(1);
  });

  test("daily_visitors enforces (day, visitor_hash) uniqueness", async () => {
    const db = await legacyDb();
    await migrateAnalyticsV2(db);
    const ins = () =>
      db.execute(
        "INSERT OR IGNORE INTO daily_visitors (day, visitor_hash) VALUES ('2026-10-15', 'h')",
      );
    expect((await ins()).rowsAffected).toBe(1);
    expect((await ins()).rowsAffected).toBe(0);
  });
});
