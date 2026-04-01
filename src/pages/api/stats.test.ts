import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

async function seedDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS pageviews (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id         TEXT NOT NULL,
      hostname        TEXT NOT NULL,
      pathname        TEXT NOT NULL,
      referrer        TEXT,
      utm_source      TEXT,
      utm_medium      TEXT,
      utm_campaign    TEXT,
      utm_content     TEXT,
      is_unique       INTEGER NOT NULL DEFAULT 0,
      visitor_hash    TEXT,
      time_on_page    INTEGER,
      scroll_depth    INTEGER,
      browser         TEXT,
      os              TEXT,
      device_type     TEXT,
      screen_width    INTEGER,
      screen_height   INTEGER,
      viewport_width  INTEGER,
      viewport_height INTEGER,
      language        TEXT,
      country         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bot_hashes (
      hash TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pv_created ON pageviews(created_at);
    CREATE INDEX IF NOT EXISTS idx_pv_pathname ON pageviews(pathname);
    CREATE INDEX IF NOT EXISTS idx_pv_visitor_hash ON pageviews(visitor_hash);
  `);
}

function insertPageview(overrides: Record<string, unknown> = {}) {
  const defaults = {
    page_id: crypto.randomUUID().slice(0, 8),
    hostname: "valerionarcisi.me",
    pathname: "/blog/test",
    referrer: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    is_unique: 1,
    visitor_hash: crypto.randomUUID().slice(0, 16),
    time_on_page: 120,
    scroll_depth: 75,
    browser: "Chrome",
    os: "macOS",
    device_type: "desktop",
    screen_width: 1920,
    screen_height: 1080,
    viewport_width: 1920,
    viewport_height: 900,
    language: "it",
    country: "IT",
    created_at: "2026-03-05 10:00:00",
  };
  const row = { ...defaults, ...overrides };
  return db.execute({
    sql: `INSERT INTO pageviews (
      page_id, hostname, pathname, referrer,
      utm_source, utm_medium, utm_campaign, utm_content,
      is_unique, visitor_hash, time_on_page, scroll_depth,
      browser, os, device_type,
      screen_width, screen_height, viewport_width, viewport_height,
      language, country, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.page_id,
      row.hostname,
      row.pathname,
      row.referrer,
      row.utm_source,
      row.utm_medium,
      row.utm_campaign,
      row.utm_content,
      row.is_unique,
      row.visitor_hash,
      row.time_on_page,
      row.scroll_depth,
      row.browser,
      row.os,
      row.device_type,
      row.screen_width,
      row.screen_height,
      row.viewport_width,
      row.viewport_height,
      row.language,
      row.country,
      row.created_at,
    ],
  });
}

function makeRequest(
  period: string,
  opts: { token?: string; from?: string; to?: string; pathname?: string } = {},
): { url: URL; request: Request } {
  const token = opts.token ?? "test-token";
  const params = new URLSearchParams({ period });
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.pathname) params.set("pathname", opts.pathname);
  const url = new URL(`https://example.com/api/stats?${params}`);
  const request = new Request(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { url, request };
}

describe("GET /api/stats", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns 401 without valid token", async () => {
    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today", { token: "wrong" });
    const res = await GET({ url, request } as never);
    expect(res.status).toBe(401);
  });

  test("returns 400 for invalid from date", async () => {
    const { GET } = await import("./stats");
    const { url, request } = makeRequest("custom", { from: "not-a-date" });
    const res = await GET({ url, request } as never);
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid to date", async () => {
    const { GET } = await import("./stats");
    const { url, request } = makeRequest("custom", {
      from: "2026-03-01",
      to: "bad",
    });
    const res = await GET({ url, request } as never);
    expect(res.status).toBe(400);
  });

  test("returns empty summary when no data", async () => {
    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.pageviews).toBe(0);
    expect(body.summary.visitors).toBe(0);
    expect(body.summary.bounce_rate).toBe(0);
  });

  test("counts pageviews and visitors correctly", async () => {
    await insertPageview({
      is_unique: 1,
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({
      is_unique: 0,
      created_at: "2026-03-05 09:00:00",
    });
    await insertPageview({
      is_unique: 1,
      created_at: "2026-03-05 10:00:00",
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.summary.pageviews).toBe(3);
    expect(body.summary.visitors).toBe(2);
  });

  test("chart groups by hour for today", async () => {
    await insertPageview({ created_at: "2026-03-05 08:00:00" });
    await insertPageview({ created_at: "2026-03-05 08:30:00" });
    await insertPageview({ created_at: "2026-03-05 10:00:00" });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.period.groupBy).toBe("hour");
    const hours = body.chart.map((c: { date: string }) => c.date);
    expect(hours).toContain("2026-03-05 08:00");
    expect(hours).toContain("2026-03-05 10:00");
  });

  test("chart groups by day for 7d", async () => {
    await insertPageview({ created_at: "2026-03-03 08:00:00" });
    await insertPageview({ created_at: "2026-03-04 10:00:00" });
    await insertPageview({ created_at: "2026-03-05 10:00:00" });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("7d");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.period.groupBy).toBe("day");
    const days = body.chart.map((c: { date: string }) => c.date);
    expect(days).toContain("2026-03-03");
    expect(days).toContain("2026-03-04");
    expect(days).toContain("2026-03-05");
  });

  test("custom single day matches today period for same date", async () => {
    await insertPageview({ created_at: "2026-03-05 08:00:00" });
    await insertPageview({ created_at: "2026-03-05 14:00:00" });

    const { GET } = await import("./stats");

    const todayReq = makeRequest("today");
    const todayRes = await GET({ url: todayReq.url, request: todayReq.request } as never);
    const todayBody = await todayRes.json();

    const customReq = makeRequest("custom", {
      from: "2026-03-05",
      to: "2026-03-05",
    });
    const customRes = await GET({ url: customReq.url, request: customReq.request } as never);
    const customBody = await customRes.json();

    expect(customBody.summary.pageviews).toBe(todayBody.summary.pageviews);
    expect(customBody.summary.visitors).toBe(todayBody.summary.visitors);
  });

  test("excludes bot hashes from counts", async () => {
    const botHash = "bot-hash-123456";
    await insertPageview({
      visitor_hash: botHash,
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({ created_at: "2026-03-05 09:00:00" });

    await db.execute({
      sql: "INSERT INTO bot_hashes (hash) VALUES (?)",
      args: [botHash],
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.summary.pageviews).toBe(1);
  });

  test("filters by pathname when provided", async () => {
    await insertPageview({
      pathname: "/blog/post-a",
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({
      pathname: "/blog/post-b",
      created_at: "2026-03-05 09:00:00",
    });
    await insertPageview({
      pathname: "/blog/post-a",
      created_at: "2026-03-05 10:00:00",
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today", {
      pathname: "/blog/post-a",
    });
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.summary.pageviews).toBe(2);
  });

  test("top_pages ranks by pageview count", async () => {
    await insertPageview({
      pathname: "/popular",
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({
      pathname: "/popular",
      created_at: "2026-03-05 09:00:00",
    });
    await insertPageview({
      pathname: "/rare",
      created_at: "2026-03-05 10:00:00",
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.top_pages[0].pathname).toBe("/popular");
    expect(Number(body.top_pages[0].pageviews)).toBe(2);
  });

  test("countries aggregation works", async () => {
    await insertPageview({
      country: "IT",
      is_unique: 1,
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({
      country: "US",
      is_unique: 1,
      created_at: "2026-03-05 09:00:00",
    });
    await insertPageview({
      country: "IT",
      is_unique: 1,
      created_at: "2026-03-05 10:00:00",
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    const it = body.countries.find(
      (c: { country: string }) => c.country === "IT",
    );
    const us = body.countries.find(
      (c: { country: string }) => c.country === "US",
    );
    expect(Number(it.visitors)).toBe(2);
    expect(Number(us.visitors)).toBe(1);
  });

  test("bounce rate calculated from short visits", async () => {
    await insertPageview({
      is_unique: 1,
      time_on_page: 2,
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({
      is_unique: 1,
      time_on_page: 120,
      created_at: "2026-03-05 09:00:00",
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.summary.bounce_rate).toBe(50);
  });

  test("suspicious visitors detected by zero engagement", async () => {
    await insertPageview({
      is_unique: 1,
      time_on_page: null,
      scroll_depth: null,
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({
      is_unique: 1,
      time_on_page: null,
      scroll_depth: 0,
      created_at: "2026-03-05 09:00:00",
    });
    await insertPageview({
      is_unique: 1,
      time_on_page: 120,
      scroll_depth: 80,
      created_at: "2026-03-05 10:00:00",
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.suspicious.count).toBe(2);
  });

  test("devices aggregation works", async () => {
    await insertPageview({
      device_type: "mobile",
      is_unique: 1,
      created_at: "2026-03-05 08:00:00",
    });
    await insertPageview({
      device_type: "desktop",
      is_unique: 1,
      created_at: "2026-03-05 09:00:00",
    });
    await insertPageview({
      device_type: "mobile",
      is_unique: 1,
      created_at: "2026-03-05 10:00:00",
    });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    const mobile = body.devices.find(
      (d: { device_type: string }) => d.device_type === "mobile",
    );
    expect(Number(mobile.visitors)).toBe(2);
  });

  test("data outside period is excluded", async () => {
    await insertPageview({ created_at: "2026-03-04 23:59:59" });
    await insertPageview({ created_at: "2026-03-05 00:00:01" });

    const { GET } = await import("./stats");
    const { url, request } = makeRequest("today");
    const res = await GET({ url, request } as never);
    const body = await res.json();

    expect(body.summary.pageviews).toBe(1);
  });

  test("7d sum matches sum of individual custom days", async () => {
    const dates = [
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ];
    for (const d of dates) {
      await insertPageview({ created_at: `${d} 10:00:00` });
      await insertPageview({ created_at: `${d} 14:00:00`, is_unique: 0 });
    }

    const { GET } = await import("./stats");

    const weekReq = makeRequest("7d");
    const weekRes = await GET({ url: weekReq.url, request: weekReq.request } as never);
    const weekBody = await weekRes.json();

    let dayTotal = 0;
    for (const d of dates) {
      const req = makeRequest("custom", { from: d, to: d });
      const res = await GET({ url: req.url, request: req.request } as never);
      const body = await res.json();
      dayTotal += body.summary.pageviews;
    }

    expect(dayTotal).toBe(weekBody.summary.pageviews);
  });
});
