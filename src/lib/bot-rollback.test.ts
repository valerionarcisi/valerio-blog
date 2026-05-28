import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

const { POST, DELETE } = await import("~/pages/api/admin/bot");

async function seedDb() {
  await db.executeMultiple(`
    CREATE TABLE pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL,
      hostname TEXT NOT NULL,
      pathname TEXT NOT NULL,
      is_unique INTEGER NOT NULL DEFAULT 0,
      visitor_hash TEXT,
      time_on_page INTEGER,
      scroll_depth INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE bot_hashes (
      hash TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

async function insertPv(opts: {
  hash: string;
  pathname?: string;
  is_unique?: number;
  created_at?: string;
}) {
  await db.execute({
    sql: `INSERT INTO pageviews (page_id, hostname, pathname, is_unique, visitor_hash, created_at)
          VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
    args: [
      Math.random().toString(36).slice(2, 10),
      "valerionarcisi.me",
      opts.pathname ?? "/",
      opts.is_unique ?? 0,
      opts.hash,
      opts.created_at ?? null,
    ],
  });
}

async function statsCount() {
  const r = await db.execute({
    sql: `SELECT COUNT(*) AS pageviews, SUM(is_unique) AS visitors
          FROM pageviews
          WHERE visitor_hash IS NULL OR visitor_hash NOT IN (SELECT hash FROM bot_hashes)`,
    args: [],
  });
  return {
    pageviews: Number(r.rows[0].pageviews) || 0,
    visitors: Number(r.rows[0].visitors) || 0,
  };
}

function req(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://x/api/admin/bot", {
    method,
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("bot flag + rollback round-trip", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  afterEach(() => {
    db.close();
  });

  test("matches the user scenario: 4 pageviews / 2 visitors → flag both → 0/0 → unflag → back to 4/2", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // h1 visited twice today, first row is_unique=1
    await insertPv({ hash: "h1", is_unique: 1, created_at: `${today} 08:00:00` });
    await insertPv({ hash: "h1", is_unique: 0, created_at: `${today} 09:00:00` });
    // h2 visited twice today, first row is_unique=1
    await insertPv({ hash: "h2", is_unique: 1, created_at: `${today} 10:00:00` });
    await insertPv({ hash: "h2", is_unique: 0, created_at: `${today} 11:00:00` });

    expect(await statsCount()).toEqual({ pageviews: 4, visitors: 2 });

    // user flags both visitors (one at a time, like the UI does)
    const r1 = await POST({ request: req("POST", { hash: "h1" }) } as any);
    expect(r1.status).toBe(200);
    const r2 = await POST({ request: req("POST", { hash: "h2" }) } as any);
    expect(r2.status).toBe(200);

    // both excluded, stats go to 0/0
    expect(await statsCount()).toEqual({ pageviews: 0, visitors: 0 });

    // user clicks "Annulla flag fatti oggi" (24h window)
    const u = await DELETE!({ request: req("DELETE", { recentMinutes: 1440 }) } as any);
    expect(u.status).toBe(200);
    const json = await u.json();
    expect(json.unflagged).toBe(2);

    // stats should be restored to 4 pageviews / 2 visitors
    expect(await statsCount()).toEqual({ pageviews: 4, visitors: 2 });
  });

  test("{ all: true } removes every flagged hash regardless of timestamp", async () => {
    await insertPv({ hash: "old", is_unique: 1 });
    await insertPv({ hash: "fresh", is_unique: 1 });
    await db.execute({
      sql: "INSERT INTO bot_hashes (hash, created_at) VALUES (?, datetime('now', '-5 days'))",
      args: ["old"],
    });
    await POST({ request: req("POST", { hash: "fresh" }) } as any);
    expect(await statsCount()).toEqual({ pageviews: 0, visitors: 0 });

    const u = await DELETE!({ request: req("DELETE", { all: true }) } as any);
    const json = await u.json();
    expect(json.unflagged).toBe(2);
    expect(await statsCount()).toEqual({ pageviews: 2, visitors: 2 });
  });

  test("recentMinutes window only catches recently flagged hashes", async () => {
    await insertPv({ hash: "old", is_unique: 1 });
    await insertPv({ hash: "fresh", is_unique: 1 });

    // simulate an OLD flag (2 days ago) by inserting directly with backdated created_at
    await db.execute({
      sql: "INSERT INTO bot_hashes (hash, created_at) VALUES (?, datetime('now', '-2 days'))",
      args: ["old"],
    });
    // and a fresh flag now (via the endpoint)
    await POST({ request: req("POST", { hash: "fresh" }) } as any);

    expect(await statsCount()).toEqual({ pageviews: 0, visitors: 0 });

    // 24h window: should only unflag "fresh", not "old"
    const u = await DELETE!({
      request: req("DELETE", { recentMinutes: 1440 }),
    } as any);
    const json = await u.json();
    expect(json.unflagged).toBe(1);

    // "fresh" restored, "old" still flagged
    const stats = await statsCount();
    expect(stats.pageviews).toBe(1);
    expect(stats.visitors).toBe(1);
  });
});
