import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;
vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

const { GET } = await import("~/pages/api/stats/export");
const { migrateAnalyticsV2 } = await import("../../scripts/migrate-analytics-v2");
const { createSessionValue } = await import("~/lib/admin-session");

const OLD = `
  CREATE TABLE pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL, hostname TEXT NOT NULL, pathname TEXT NOT NULL,
    referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
    is_unique INTEGER NOT NULL DEFAULT 0, visitor_hash TEXT,
    time_on_page INTEGER, scroll_depth INTEGER,
    browser TEXT, os TEXT, device_type TEXT, language TEXT, country TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let seq = 0;
async function pv(over: Record<string, string | number | null>) {
  const r = {
    page_id: "p" + ++seq,
    hostname: "valerionarcisi.me",
    pathname: "/blog/a",
    is_unique: 1,
    visitor_hash: "h" + seq,
    device_type: "mobile",
    country: "IT",
    channel: "direct",
    human: 1,
    bot_score: 0,
    created_at: "2026-03-05 10:00:00",
    ...over,
  };
  const cols = Object.keys(r);
  await db.execute({
    sql: `INSERT INTO pageviews (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    args: cols.map((c) => (r as Record<string, string | number | null>)[c]),
  });
}

function call(params: Record<string, string>, headers: Record<string, string> = { authorization: "Bearer test-token" }) {
  const url = new URL("https://valerionarcisi.me/api/stats/export");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return GET({ url, request: new Request(url, { headers }) } as never);
}
const range = { from: "2026-03-01", to: "2026-03-09" };

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(OLD);
  await migrateAnalyticsV2(db);
  seq = 0;
});
afterEach(() => vi.useRealTimers());

describe("GET /api/stats/export - auth", () => {
  test("401 without credentials, 401 with a wrong token", async () => {
    expect((await call({ kind: "daily", ...range }, {})).status).toBe(401);
    expect((await call({ kind: "daily", ...range }, { authorization: "Bearer nope" })).status).toBe(401);
  });
  test("accepts Bearer and the cookie session", async () => {
    expect((await call({ kind: "daily", ...range })).status).toBe(200);
    const cookie = `vb_admin=${createSessionValue("test-token")}`;
    expect((await call({ kind: "daily", ...range }, { cookie })).status).toBe(200);
  });
});

describe("GET /api/stats/export - validation", () => {
  test.each([
    { kind: "nope" },
    {},
    { kind: "daily", from: "2026-3-1" },
    { kind: "daily", from: "2026-03-09", to: "2026-03-01" },
    { kind: "daily", from: "2024-01-01", to: "2026-03-09" },
    { kind: "daily", device: "watch" },
  ])("400 for %j", async (p) => {
    expect((await call(p as Record<string, string>)).status).toBe(400);
  });
});

describe("GET /api/stats/export - content", () => {
  test("headers: csv, attachment, private no-store", async () => {
    const res = await call({ kind: "top_pages", ...range });
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="analytics-top_pages-2026-03-01_2026-03-09.csv"',
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("top_pages is untruncated (more than the 20 shown in the dashboard)", async () => {
    for (let i = 0; i < 25; i++) await pv({ pathname: `/blog/p${i}` });
    const lines = (await (await call({ kind: "top_pages", ...range })).text()).trim().split("\r\n");
    expect(lines[0]).toBe("pathname,pageviews,visitors");
    expect(lines).toHaveLength(26);
  });

  test("escapes commas, quotes and neutralises formula injection in cells", async () => {
    await pv({ pathname: "/blog/a,b" });
    await pv({ pathname: '/blog/"q"' });
    await db.execute("UPDATE pageviews SET referrer = '=cmd|calc' WHERE page_id = 'p1'");
    await db.execute("UPDATE pageviews SET referrer = '@evil' WHERE page_id = 'p2'");
    const pages = await (await call({ kind: "top_pages", ...range })).text();
    expect(pages).toContain('"/blog/a,b",1,1');
    expect(pages).toContain('"/blog/""q""",1,1');
    const refs = await (await call({ kind: "referrers", ...range })).text();
    expect(refs).toContain("'=cmd|calc,1");
    expect(refs).toContain("'@evil,1");
    expect(refs).not.toMatch(/(^|\r\n)[=@+-]/);
  });

  test("referrers: NULL referrer is labelled (direct)", async () => {
    await pv({});
    const refs = (await (await call({ kind: "referrers", ...range })).text()).split("\r\n");
    expect(refs[0]).toBe("referrer,visitors");
    expect(refs[1]).toBe("(direct),1");
  });

  test("daily, utm, channels, events, goals shapes", async () => {
    await pv({ utm_source: "newsletter", utm_campaign: "=x" });
    const daily = await (await call({ kind: "daily", ...range })).text();
    expect(daily).toBe("date,pageviews,visitors\r\n2026-03-05,1,1\r\n");
    const utm = await (await call({ kind: "utm", ...range })).text();
    expect(utm).toBe("kind,value,visitors\r\nsource,newsletter,1\r\ncampaign,'=x,1\r\n");
    expect(await (await call({ kind: "channels", ...range })).text()).toMatch(/^channel,sessions\r\n/);
    expect(await (await call({ kind: "events", ...range })).text()).toMatch(/^name,prop,count,visitors\r\n/);
    expect(await (await call({ kind: "goals", ...range })).text()).toMatch(/^goal,label,conversions,rate_pct\r\n/);
  });

  test("honours include=all and filters (raw only, clamped to retention)", async () => {
    await pv({ human: 0 });
    await pv({ country: "US" });
    const human = await (await call({ kind: "daily", ...range })).text();
    expect(human).toContain("2026-03-05,1,1"); // human=0 visit excluded from main numbers
    const all = await (await call({ kind: "daily", ...range, include: "all" })).text();
    expect(all).toContain("2026-03-05,2,2");
    const us = await call({ kind: "daily", ...range, country: "us" });
    expect(await us.text()).toContain("2026-03-05,1,1");
    expect(us.headers.get("content-disposition")).toContain("-filtered.csv");
    const old = await call({ kind: "daily", from: "2025-06-01", to: "2026-03-09", country: "US" });
    expect(old.headers.get("content-disposition")).toContain("analytics-daily-2025-12-10_2026-03-09");
  });
});
