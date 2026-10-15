import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
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

function call(
  body: unknown,
  opts: {
    ip?: string;
    ua?: string;
    origin?: string | null;
    bare?: boolean;
  } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": opts.ua ?? UA,
    "x-nf-client-connection-ip": opts.ip ?? "203.0.113.7",
    ...(opts.bare
      ? {}
      : { "accept-language": "it-IT,it;q=0.9", "sec-fetch-site": "same-origin" }),
    ...(opts.origin === null
      ? {}
      : { origin: opts.origin ?? "https://valerionarcisi.me" }),
  };
  const request = new Request("https://valerionarcisi.me/api/e", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST({ request, locals: {} } as unknown as Parameters<typeof POST>[0]);
}

const pageview = (over: Record<string, unknown> = {}) => ({
  type: "pageview",
  page_id: PAGE_ID,
  hostname: "valerionarcisi.me",
  pathname: "/blog/ciao/",
  referrer: "https://www.google.com/",
  timezone: "Europe/Rome",
  viewport_width: 1440,
  ...over,
});
const beacon = (t: number, s: number) => ({
  type: "beacon",
  page_id: PAGE_ID,
  hostname: "valerionarcisi.me",
  time_on_page: t,
  scroll_depth: s,
});
const ev = (name: string, prop?: unknown, over: Record<string, unknown> = {}) => ({
  type: "event",
  page_id: PAGE_ID,
  hostname: "valerionarcisi.me",
  pathname: "/blog/ciao/",
  name,
  ...(prop === undefined ? {} : { prop }),
  ...over,
});

const pvRows = async () =>
  (await db.execute("SELECT * FROM pageviews ORDER BY id")).rows;
const sessions = async () =>
  (await db.execute("SELECT * FROM sessions ORDER BY id")).rows;
const events = async () =>
  (await db.execute("SELECT * FROM events ORDER BY id")).rows;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(OLD_SCHEMA);
  await migrateAnalyticsV2(db);
  invalidateRulesCache();
});
afterEach(() => {
  vi.useRealTimers();
});

const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};
const pid = (c: string) => c.repeat(16);

describe("POST /api/e - sessions", () => {
  test("creates a session, links the pageview, then reuses it within 30 minutes", async () => {
    at("2026-03-05T10:00:00Z");
    await call(pageview({ pathname: "/blog/a" }));
    at("2026-03-05T10:29:00Z");
    await call(pageview({ page_id: pid("b"), pathname: "/blog/b" }));
    const ss = await sessions();
    expect(ss).toHaveLength(1);
    expect(ss[0]).toMatchObject({
      day: "2026-03-05",
      entry_path: "/blog/a",
      exit_path: "/blog/b",
      pageviews: 2,
      channel: "search",
      referrer: "www.google.com",
      country: "IT",
      device_type: "desktop",
      engaged_seconds: 0,
    });
    expect((await pvRows()).map((r) => r.session_id)).toEqual([
      ss[0].id,
      ss[0].id,
    ]);
  });

  test("a gap of 30 minutes or more starts a new session; the window slides with each pageview", async () => {
    at("2026-03-05T10:00:00Z");
    await call(pageview({ pathname: "/a" }));
    at("2026-03-05T10:25:00Z");
    await call(pageview({ page_id: pid("b"), pathname: "/b" }));
    at("2026-03-05T10:54:00Z"); // 29 min after the last one: same session
    await call(pageview({ page_id: pid("c"), pathname: "/c" }));
    at("2026-03-05T11:24:00Z"); // exactly 30 min: new session
    await call(pageview({ page_id: pid("d"), pathname: "/d" }));
    const ss = await sessions();
    expect(ss.map((s) => [s.entry_path, s.exit_path, s.pageviews])).toEqual([
      ["/a", "/c", 3],
      ["/d", "/d", 1],
    ]);
  });

  test("a different visitor gets a different session", async () => {
    at("2026-03-05T10:00:00Z");
    await call(pageview());
    await call(pageview({ page_id: pid("b") }), { ip: "198.51.100.9" });
    expect(await sessions()).toHaveLength(2);
  });

  test("crossing UTC midnight splits the session (hash rotates), day = start day", async () => {
    at("2026-03-05T23:50:00Z");
    await call(pageview({ pathname: "/a" }));
    at("2026-03-06T00:10:00Z");
    await call(pageview({ page_id: pid("b"), pathname: "/b" }));
    expect((await sessions()).map((s) => s.day)).toEqual([
      "2026-03-05",
      "2026-03-06",
    ]);
  });

  test("beacons add the DELTA of the cumulative time (never negative) and extend last_seen_at", async () => {
    at("2026-03-05T10:00:00Z");
    await call(pageview());
    at("2026-03-05T10:01:00Z");
    await call(beacon(8, 10));
    await call(beacon(20, 10));
    await call(beacon(5, 10)); // out-of-order: no change, no negative delta
    const [s] = await sessions();
    expect(s.engaged_seconds).toBe(20);
    expect(s.last_seen_at).toBe("2026-03-05 10:01:00");
  });

  test("engage marks the session human; bot_score keeps the max of its pageviews", async () => {
    at("2026-03-05T10:00:00Z");
    await call(pageview());
    expect((await sessions())[0].human).toBe(0);
    await call({
      type: "engage",
      page_id: PAGE_ID,
      hostname: "valerionarcisi.me",
    });
    expect((await sessions())[0].human).toBe(1);
    await call(pageview({ page_id: pid("b") }), { bare: true });
    expect(Number((await sessions())[0].bot_score)).toBeGreaterThanOrEqual(5);
    expect((await sessions())[0].human).toBe(1);
  });

  test("an engage from another visitor does not touch the session", async () => {
    at("2026-03-05T10:00:00Z");
    await call(pageview());
    await call(
      { type: "engage", page_id: PAGE_ID, hostname: "valerionarcisi.me" },
      { ip: "198.51.100.77" },
    );
    expect((await sessions())[0].human).toBe(0);
  });

  test("without the phase 2 migration pageviews are still stored, beacons and events are dropped", async () => {
    db = createClient({ url: ":memory:" });
    await db.executeMultiple(OLD_SCHEMA);
    invalidateRulesCache();
    expect((await call(pageview())).status).toBe(204);
    expect((await call(beacon(5, 5))).status).toBe(204);
    expect((await call(ev("clap"))).status).toBe(204);
    expect(await pvRows()).toHaveLength(1);
  });
});

describe("POST /api/e - events", () => {
  beforeEach(async () => {
    await call(pageview());
  });

  test("stores a whitelisted event bound to the visitor's page, with the server-side path", async () => {
    expect(
      (await call(ev("clap", undefined, { pathname: "/spoofed" }))).status,
    ).toBe(204);
    const [e] = await events();
    const [s] = await sessions();
    expect(e).toMatchObject({
      name: "clap",
      path: "/blog/ciao",
      prop: null,
      session_id: s.id,
      page_id: PAGE_ID,
    });
    expect(e.visitor_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(e.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("validates and normalises props per event", async () => {
    await call(ev("outbound_click", "Example.COM"));
    await call(ev("download", ".PDF"));
    await call(ev("share", "linkedin"));
    await call(ev("not_found", "www.google.com"));
    await call(ev("not_found"));
    await call(ev("copy_code", "ignored"));
    expect((await events()).map((e) => [e.name, e.prop])).toEqual([
      ["outbound_click", "example.com"],
      ["download", "pdf"],
      ["share", "linkedin"],
      ["not_found", "www.google.com"],
      ["not_found", null],
      ["copy_code", null],
    ]);
  });

  test("unknown names and invalid props are dropped with 204", async () => {
    for (const bad of [
      ev("hacked"),
      ev("outbound_click", "https://x.com/a?b=c"),
      ev("outbound_click", "a".repeat(101) + ".com"),
      ev("outbound_click"),
      ev("download", "exe"),
      ev("share", "myspace"),
      ev("not_found", "<script>"),
    ]) {
      expect((await call(bad)).status).toBe(204);
    }
    expect(await events()).toHaveLength(0);
  });

  test("an event from another visitor, unknown page_id, bad origin or a bot is dropped", async () => {
    await call(ev("clap"), { ip: "198.51.100.77" });
    await call(ev("clap", undefined, { page_id: pid("z") }));
    expect((await call(ev("clap"), { origin: "https://evil.com" })).status).toBe(
      403,
    );
    expect((await call(ev("clap"), { ua: "Googlebot/2.1" })).status).toBe(204);
    expect(await events()).toHaveLength(0);
  });

  test("scroll_75 / scroll_100 are stored once per page_id; clap is repeatable", async () => {
    await call(ev("scroll_75"));
    await call(ev("scroll_75"));
    await call(ev("scroll_100"));
    await call(ev("scroll_100"));
    await call(ev("clap"));
    await call(ev("clap"));
    expect((await events()).map((e) => e.name)).toEqual([
      "scroll_75",
      "scroll_100",
      "clap",
      "clap",
    ]);
  });

  test("an event right after midnight still matches yesterday's hash", async () => {
    at("2026-03-05T23:59:30Z");
    const id = pid("m");
    await call(pageview({ page_id: id }));
    at("2026-03-06T00:00:30Z");
    await call(ev("clap", undefined, { page_id: id }));
    expect((await events()).find((x) => x.page_id === id)).toBeDefined();
  });
});
