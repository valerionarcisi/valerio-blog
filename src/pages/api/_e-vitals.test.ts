import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../../scripts/migrate-analytics-v2";
import { invalidateRulesCache } from "~/lib/bot-rules";

let db: Client;
vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({ env: () => "" }));

const { POST } = await import("~/pages/api/e");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PAGE_ID = "a1b2c3d4e5f6a7b8c9d0e1f2";

const OLD_SCHEMA = `
  CREATE TABLE pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL, hostname TEXT NOT NULL, pathname TEXT NOT NULL,
    referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
    is_unique INTEGER NOT NULL DEFAULT 0, visitor_hash TEXT,
    time_on_page INTEGER, scroll_depth INTEGER,
    browser TEXT, os TEXT, device_type TEXT,
    screen_width INTEGER, screen_height INTEGER, viewport_width INTEGER, viewport_height INTEGER,
    language TEXT, country TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

function call(body: unknown) {
  const request = new Request("https://valerionarcisi.me/api/e", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": UA,
      "x-nf-client-connection-ip": "203.0.113.7",
      "accept-language": "it-IT,it;q=0.9",
      "sec-fetch-site": "same-origin",
      origin: "https://valerionarcisi.me",
    },
    body: JSON.stringify(body),
  });
  return POST({ request, locals: {} } as unknown as Parameters<typeof POST>[0]);
}

const pageview = {
  type: "pageview",
  page_id: PAGE_ID,
  hostname: "valerionarcisi.me",
  pathname: "/blog/ciao/",
  timezone: "Europe/Rome",
  viewport_width: 1440,
};
const beacon = (over: Record<string, unknown>) => ({
  type: "beacon",
  page_id: PAGE_ID,
  hostname: "valerionarcisi.me",
  ...over,
});
const row = async () => (await db.execute("SELECT * FROM pageviews")).rows[0];

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(OLD_SCHEMA);
  await migrateAnalyticsV2(db);
  invalidateRulesCache();
});

describe("POST /api/e - beacon web vitals", () => {
  test("stores lcp / inp / cls (thousandths)", async () => {
    await call(pageview);
    expect((await call(beacon({ time_on_page: 5, scroll_depth: 10, lcp_ms: 1800.4, inp_ms: 120, cls: 0.0456 }))).status).toBe(204);
    expect(await row()).toMatchObject({ lcp_ms: 1800, inp_ms: 120, cls_milli: 46, time_on_page: 5 });
  });

  test("LCP and INP: latest non-null wins; CLS: MAX; absent values never erase", async () => {
    await call(pageview);
    await call(beacon({ time_on_page: 5, lcp_ms: 3000, inp_ms: 300, cls: 0.2 }));
    await call(beacon({ time_on_page: 9, lcp_ms: 2000, inp_ms: 100, cls: 0.05 }));
    expect(await row()).toMatchObject({ lcp_ms: 2000, inp_ms: 100, cls_milli: 200 });
    await call(beacon({ time_on_page: 12 })); // no vitals in this beacon
    expect(await row()).toMatchObject({ lcp_ms: 2000, inp_ms: 100, cls_milli: 200 });
    await call(beacon({ time_on_page: 14, cls: 0.31 }));
    expect(await row()).toMatchObject({ lcp_ms: 2000, cls_milli: 310 });
  });

  test("out-of-range vitals are ignored but time/scroll still stored", async () => {
    await call(pageview);
    await call(beacon({ time_on_page: 7, scroll_depth: 40, lcp_ms: 99999, inp_ms: -5, cls: 11 }));
    const r = await row();
    expect(r).toMatchObject({ time_on_page: 7, scroll_depth: 40, lcp_ms: null, inp_ms: null, cls_milli: null });
  });

  test("a vitals-only beacon is accepted", async () => {
    await call(pageview);
    await call(beacon({ lcp_ms: 2100 }));
    expect((await row()).lcp_ms).toBe(2100);
  });

  test("degrades on a database without the vitals columns (time/scroll still saved)", async () => {
    const old = createClient({ url: ":memory:" });
    await old.executeMultiple(OLD_SCHEMA);
    await migrateAnalyticsV2(old);
    for (const c of ["lcp_ms", "cls_milli", "inp_ms"]) await old.execute(`ALTER TABLE pageviews DROP COLUMN ${c}`);
    db = old;
    await call(pageview);
    expect((await call(beacon({ time_on_page: 11, scroll_depth: 33, lcp_ms: 2000, cls: 0.1 }))).status).toBe(204);
    expect(await row()).toMatchObject({ time_on_page: 11, scroll_depth: 33 });
  });
});
