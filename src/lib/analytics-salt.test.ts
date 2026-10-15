import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  getDailySalt,
  peekSalt,
  purgeOldSalts,
  maybePurgeOldSalts,
  shiftDay,
} from "./analytics-salt";
import { generateVisitorHash } from "./analytics";
import { migrateAnalyticsV2 } from "../../scripts/migrate-analytics-v2";

let db: Client;

async function freshDb() {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(
    `CREATE TABLE pageviews (id INTEGER PRIMARY KEY AUTOINCREMENT, visitor_hash TEXT, created_at TEXT);`,
  );
  await migrateAnalyticsV2(db);
}

beforeEach(freshDb);

describe("getDailySalt", () => {
  test("creates a 64-hex salt and returns the same one afterwards", async () => {
    const a = await getDailySalt(db, "2026-10-15");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await getDailySalt(db, "2026-10-15")).toBe(a);
    const rows = await db.execute("SELECT * FROM analytics_salts");
    expect(rows.rows).toHaveLength(1);
  });

  test("rotates: another day has a different salt", async () => {
    const a = await getDailySalt(db, "2026-10-15");
    const b = await getDailySalt(db, "2026-10-16");
    expect(a).not.toBe(b);
  });

  test("two instances without cache converge on the stored salt", async () => {
    await db.execute({
      sql: "INSERT INTO analytics_salts (day, salt) VALUES (?, ?)",
      args: ["2026-10-15", "stored-salt"],
    });
    expect(await getDailySalt(db, "2026-10-15")).toBe("stored-salt");
  });

  test("hash differs across days and with a different salt", async () => {
    const s1 = await getDailySalt(db, "2026-10-15");
    const s2 = await getDailySalt(db, "2026-10-16");
    const h1 = await generateVisitorHash(
      s1,
      "valerionarcisi.me",
      "1.1.1.1",
      "UA",
    );
    const h2 = await generateVisitorHash(
      s2,
      "valerionarcisi.me",
      "1.1.1.1",
      "UA",
    );
    const h3 = await generateVisitorHash(
      "other",
      "valerionarcisi.me",
      "1.1.1.1",
      "UA",
    );
    expect(new Set([h1, h2, h3]).size).toBe(3);
  });

  test("falls back to a process salt when the table is missing, never throws", async () => {
    const bare = createClient({ url: ":memory:" });
    const s = await getDailySalt(bare, "2026-10-15");
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(await getDailySalt(bare, "2026-10-15")).toBe(s);
  });

  test("falls back when the DB throws", async () => {
    const broken = {
      execute: async () => {
        throw new Error("down");
      },
    } as unknown as Client;
    expect(await getDailySalt(broken, "2026-10-15")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("peekSalt and purge", () => {
  test("peekSalt does not create anything", async () => {
    expect(await peekSalt(db, "2026-10-14")).toBeNull();
    const rows = await db.execute("SELECT * FROM analytics_salts");
    expect(rows.rows).toHaveLength(0);
  });

  test("purge deletes salts and ledger older than 2 days", async () => {
    for (const d of ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]) {
      await db.execute({
        sql: "INSERT INTO analytics_salts (day, salt) VALUES (?, 's')",
        args: [d],
      });
      await db.execute({
        sql: "INSERT INTO daily_visitors (day, visitor_hash) VALUES (?, 'h')",
        args: [d],
      });
    }
    await purgeOldSalts(db, "2026-10-15");
    const salts = await db.execute(
      "SELECT day FROM analytics_salts ORDER BY day",
    );
    expect(salts.rows.map((r) => r.day)).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
    ]);
    const ledger = await db.execute("SELECT day FROM daily_visitors");
    expect(ledger.rows).toHaveLength(3);
  });

  test("opportunistic purge only runs ~1% of the time", async () => {
    await db.execute(
      "INSERT INTO analytics_salts (day, salt) VALUES ('2020-01-01', 's')",
    );
    maybePurgeOldSalts(db, "2026-10-15", () => 0.5);
    await new Promise((r) => setTimeout(r, 20));
    expect(
      (await db.execute("SELECT * FROM analytics_salts")).rows,
    ).toHaveLength(1);
    maybePurgeOldSalts(db, "2026-10-15", () => 0.001);
    await new Promise((r) => setTimeout(r, 50));
    expect(
      (await db.execute("SELECT * FROM analytics_salts")).rows,
    ).toHaveLength(0);
  });

  test("shiftDay", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});
