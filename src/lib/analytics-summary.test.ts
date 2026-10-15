import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  SPIKE_MIN_VISITORS,
  deltaPct,
  getTodaySummary,
  getTodaySummarySafe,
} from "./analytics-summary";

let db: Client;
let seq = 0;

const NOW = new Date("2026-10-14T12:00:00Z"); // Wednesday

async function visit(at: string, over: Record<string, string | number | null> = {}) {
  const r = {
    page_id: "p" + ++seq,
    hostname: "valerionarcisi.me",
    pathname: "/blog/a",
    is_unique: 1,
    visitor_hash: "h" + seq,
    human: 1,
    bot_score: 0,
    created_at: at,
    ...over,
  };
  const cols = Object.keys(r);
  await db.execute({
    sql: `INSERT INTO pageviews (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    args: cols.map((c) => (r as Record<string, string | number | null>)[c]),
  });
}
const many = async (n: number, at: string, over = {}) => {
  for (let i = 0; i < n; i++) await visit(at, over);
};

beforeEach(async () => {
  seq = 0;
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL, hostname TEXT NOT NULL, pathname TEXT NOT NULL,
      is_unique INTEGER NOT NULL DEFAULT 0, visitor_hash TEXT,
      human INTEGER DEFAULT 0, bot_score INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
});

describe("getTodaySummary", () => {
  test("empty database: zeros, no posts, no spike", async () => {
    const s = await getTodaySummary(db, NOW);
    expect(s).toMatchObject({ visitorsToday: 0, visitorsYesterdaySoFar: 0, visitorsYesterdayTotal: 0, topPosts: [] });
    expect(s.spike?.active).toBe(false);
  });

  test("today vs yesterday at the same time vs yesterday total (UTC)", async () => {
    await many(5, "2026-10-14 08:00:00");
    await many(1, "2026-10-14 12:00:00"); // exactly now: included
    await many(1, "2026-10-14 12:00:01"); // future: excluded
    await many(4, "2026-10-13 09:00:00"); // before the same time yesterday
    await many(3, "2026-10-13 18:00:00"); // after: only in the total
    await many(2, "2026-10-12 23:59:59"); // day before: ignored
    const s = await getTodaySummary(db, NOW);
    expect(s.visitorsToday).toBe(6);
    expect(s.visitorsYesterdaySoFar).toBe(4);
    expect(s.visitorsYesterdayTotal).toBe(7);
    expect(s.asOf).toBe(NOW.toISOString());
  });

  test("only human visits count: unverified and bots are excluded", async () => {
    await many(3, "2026-10-14 08:00:00");
    await many(5, "2026-10-14 08:00:00", { human: 0 });
    await many(5, "2026-10-14 08:00:00", { bot_score: 9 });
    await db.execute("INSERT INTO bot_hashes (hash) VALUES ('legacy')");
    await visit("2026-10-14 08:00:00", { visitor_hash: "legacy" });
    expect((await getTodaySummary(db, NOW)).visitorsToday).toBe(3);
  });

  test("visitors = first hit of the day, pageviews do not inflate it", async () => {
    await visit("2026-10-14 08:00:00", { is_unique: 1 });
    await visit("2026-10-14 08:05:00", { is_unique: 0 });
    expect((await getTodaySummary(db, NOW)).visitorsToday).toBe(1);
  });

  test("top 3 posts of today by pageviews, blog posts only", async () => {
    await many(5, "2026-10-14 08:00:00", { pathname: "/blog/uno" });
    await many(3, "2026-10-14 08:00:00", { pathname: "/en/blog/due" });
    await many(3, "2026-10-14 08:00:00", { pathname: "/blog/tre" });
    await many(1, "2026-10-14 08:00:00", { pathname: "/blog/quattro" });
    await many(9, "2026-10-14 08:00:00", { pathname: "/" });
    await many(9, "2026-10-13 08:00:00", { pathname: "/blog/ieri" });
    const s = await getTodaySummary(db, NOW);
    expect(s.topPosts).toEqual([
      { pathname: "/blog/uno", pageviews: 5 },
      { pathname: "/blog/tre", pageviews: 3 }, // tie broken by pathname
      { pathname: "/en/blog/due", pageviews: 3 },
    ]);
  });
});

describe("spike rule: today > 2x average of the last 7 same weekdays at the same time, min visitors", () => {
  async function weeklyBaseline(perWeek: number) {
    for (let w = 1; w <= 7; w++) {
      const d = new Date(NOW.getTime() - w * 7 * 86_400_000).toISOString().slice(0, 10);
      await many(perWeek, `${d} 09:00:00`);
      await many(50, `${d} 20:00:00`); // later in the day: must NOT count (same-time cut)
    }
  }

  test("spike when today exceeds 2x the baseline", async () => {
    await weeklyBaseline(10);
    await many(21, "2026-10-14 10:00:00");
    const s = await getTodaySummary(db, NOW);
    expect(s.spike).toEqual({ active: true, baseline: 10, factor: 2 });
  });

  test("exactly 2x is not a spike", async () => {
    await weeklyBaseline(10);
    await many(20, "2026-10-14 10:00:00");
    expect((await getTodaySummary(db, NOW)).spike?.active).toBe(false);
  });

  test("a quiet blog does not spike below the minimum", async () => {
    await weeklyBaseline(0);
    await many(SPIKE_MIN_VISITORS - 1, "2026-10-14 10:00:00");
    expect((await getTodaySummary(db, NOW)).spike?.active).toBe(false);
    await many(1, "2026-10-14 10:00:00");
    expect((await getTodaySummary(db, NOW)).spike?.active).toBe(true);
  });

  test("other weekdays are not part of the baseline", async () => {
    await many(100, "2026-10-13 09:00:00"); // yesterday (Tuesday)
    await many(12, "2026-10-14 10:00:00");
    expect((await getTodaySummary(db, NOW)).spike?.active).toBe(true);
  });
});

describe("soft failure", () => {
  test("getTodaySummarySafe returns null when the database throws", async () => {
    const broken = createClient({ url: ":memory:" }); // no pageviews table
    expect(await getTodaySummarySafe(() => broken, NOW)).toBeNull();
  });
  test("returns null when the client factory throws", async () => {
    expect(
      await getTodaySummarySafe(() => {
        throw new Error("no env");
      }, NOW),
    ).toBeNull();
  });
  test("returns null instead of hanging on a slow database", async () => {
    const slow = {
      execute: () => new Promise(() => {}),
    } as unknown as Client;
    expect(await getTodaySummarySafe(() => slow, NOW, 20)).toBeNull();
  });
  test("returns data when healthy", async () => {
    await many(2, "2026-10-14 08:00:00");
    expect((await getTodaySummarySafe(() => db, NOW))?.visitorsToday).toBe(2);
  });
});

describe("deltaPct", () => {
  test("rounded percentage, null on a zero base", () => {
    expect(deltaPct(15, 10)).toBe(50);
    expect(deltaPct(5, 10)).toBe(-50);
    expect(deltaPct(10, 10)).toBe(0);
    expect(deltaPct(3, 0)).toBeNull();
  });
});
