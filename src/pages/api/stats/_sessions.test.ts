import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../../../scripts/migrate-analytics-v2";

let db: Client;

vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

const list = await import("~/pages/api/stats/sessions");
const detail = await import("~/pages/api/stats/sessions/[id]");
const live = await import("~/pages/api/stats/live");

const FULL_HASH = "deadbeefcafe1234";
const sqlTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const minutesAgo = (m: number) => sqlTime(new Date(Date.now() - m * 60_000));

function get(path: string, token: string | null = "test-token") {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = new URL("https://example.com" + path);
  return { url, request: new Request(url, { headers }) };
}
const call = (h: unknown, path: string, token: string | null = "test-token") =>
  (h as (c: unknown) => Promise<Response>)(get(path, token));
const callDetail = (id: string, token: string | null = "test-token") =>
  (detail.GET as unknown as (c: unknown) => Promise<Response>)({ ...get(`/api/stats/sessions/${id}`, token), params: { id } });

interface S {
  hash?: string;
  startedAt?: string;
  human?: number;
  botScore?: number;
  country?: string;
  device?: string;
  channel?: string;
  lastSeen?: string;
  pageviews?: number;
}
async function insertSession(o: S = {}): Promise<number> {
  const started = o.startedAt ?? minutesAgo(60);
  const r = await db.execute({
    sql: `INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path, pageviews, engaged_seconds,
                                channel, referrer, country, device_type, human, bot_score)
          VALUES (?, ?, ?, ?, '/blog/a', '/blog/b', ?, 42, ?, 'news.ycombinator.com', ?, ?, ?, ?)`,
    args: [
      started.slice(0, 10),
      o.hash ?? FULL_HASH,
      started,
      o.lastSeen ?? started,
      o.pageviews ?? 2,
      o.channel ?? "referral",
      o.country ?? "IT",
      o.device ?? "desktop",
      o.human ?? 1,
      o.botScore ?? 0,
    ],
  });
  return Number(r.lastInsertRowid);
}

async function insertPv(sessionId: number, o: { path: string; at: string; time?: number; scroll?: number; lcp?: number; hash?: string }) {
  await db.execute({
    sql: `INSERT INTO pageviews (page_id, hostname, pathname, visitor_hash, session_id, time_on_page, scroll_depth, lcp_ms, cls_milli, inp_ms,
                                 browser, os, language, utm_source, created_at)
          VALUES (?, 'valerionarcisi.me', ?, ?, ?, ?, ?, ?, 50, 120, 'Firefox', 'Linux', 'it', 'hn', ?)`,
    args: [Math.random().toString(36).slice(2, 12), o.path, o.hash ?? FULL_HASH, sessionId, o.time ?? 10, o.scroll ?? 50, o.lcp ?? null, o.at],
  });
}

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT, page_id TEXT NOT NULL, hostname TEXT NOT NULL,
      pathname TEXT NOT NULL, referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
      is_unique INTEGER NOT NULL DEFAULT 0, visitor_hash TEXT, time_on_page INTEGER, scroll_depth INTEGER,
      browser TEXT, os TEXT, device_type TEXT, language TEXT, country TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
  await migrateAnalyticsV2(db);
});

describe("auth", () => {
  test("401 without credentials on list, detail and live", async () => {
    expect((await call(list.GET, "/api/stats/sessions", null)).status).toBe(401);
    expect((await callDetail("1", null)).status).toBe(401);
    expect((await call(live.GET, "/api/stats/live", null)).status).toBe(401);
  });
});

describe("validation", () => {
  test.each([
    "from=2026-13-40",
    "to=yesterday",
    "from=2026-05-02&to=2026-05-01",
    "limit=0",
    "limit=101",
    "limit=abc",
    "cursor=not-a-cursor!!",
    `cursor=${Buffer.from("garbage").toString("base64url")}`,
    "verdict=robot",
    "country=ITA",
    "device=fridge",
    "channel=pigeon",
    "with_events=yes",
  ])("400 for %s", async (qs) => {
    const r = await call(list.GET, `/api/stats/sessions?${qs}`);
    expect(r.status).toBe(400);
  });

  test("detail rejects a non numeric id with 400 and an unknown one with 404", async () => {
    expect((await callDetail("abc")).status).toBe(400);
    expect((await callDetail("999")).status).toBe(404);
  });
});

describe("GET /api/stats/sessions", () => {
  test("returns the documented shape, newest first, browser/OS from the first pageview", async () => {
    const old = await insertSession({ startedAt: minutesAgo(120), hash: "aaaaaa1111111111" });
    const recent = await insertSession({ startedAt: minutesAgo(30), hash: "bbbbbb2222222222" });
    await insertPv(recent, { path: "/blog/a", at: minutesAgo(30), hash: "bbbbbb2222222222" });
    await db.execute({ sql: "INSERT INTO events (day, session_id, visitor_hash, name, path, created_at) VALUES (?, ?, 'bbbbbb2222222222', 'clap', '/blog/a', ?)", args: [minutesAgo(29).slice(0, 10), recent, minutesAgo(29)] });

    const body = await (await call(list.GET, "/api/stats/sessions")).json();
    expect(body.available).toBe(true);
    expect(body.next_cursor).toBeNull();
    expect(body.sessions.map((s: { id: number }) => s.id)).toEqual([recent, old]);
    const s = body.sessions[0];
    expect(s).toMatchObject({
      user: "bbbbbb",
      country: "IT",
      device: "desktop",
      browser: "Firefox",
      os: "Linux",
      channel: "referral",
      entry_path: "/blog/a",
      exit_path: "/blog/b",
      pageviews: 2,
      engaged_seconds: 42,
      verdict: "human",
      human: true,
      events_count: 1,
    });
    expect(body.sessions[1].browser).toBeNull();
  });

  test("keyset pagination: no duplicates or skips across pages with equal timestamps", async () => {
    const same = minutesAgo(10);
    const ids: number[] = [];
    for (let i = 0; i < 7; i++) ids.push(await insertSession({ startedAt: same, hash: `h${i}`.padEnd(16, "0") }));
    ids.push(await insertSession({ startedAt: minutesAgo(5) }));
    ids.push(await insertSession({ startedAt: minutesAgo(50) }));

    const seen: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const qs: string = `limit=3${cursor ? `&cursor=${cursor}` : ""}`;
      const body = await (await call(list.GET, `/api/stats/sessions?${qs}`)).json();
      seen.push(...body.sessions.map((s: { id: number }) => s.id));
      cursor = body.next_cursor;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
    // newest first; ties broken by id descending
    expect(seen[0]).toBe(ids[7]);
    expect(seen.slice(1, 8)).toEqual(ids.slice(0, 7).reverse());
    expect(seen[8]).toBe(ids[8]);
  });

  test("verdict filter: human by default, unverified, bot, all", async () => {
    const human = await insertSession({ human: 1 });
    const unverified = await insertSession({ human: 0, hash: "u".repeat(16) });
    const bot = await insertSession({ human: 1, botScore: 99, hash: "b".repeat(16) });
    const ids = async (qs: string) =>
      (await (await call(list.GET, `/api/stats/sessions?${qs}`)).json()).sessions.map((s: { id: number }) => s.id).sort();

    expect(await ids("")).toEqual([human]);
    expect(await ids("verdict=unverified")).toEqual([unverified]);
    expect(await ids("verdict=bot")).toEqual([bot]);
    expect(await ids("verdict=all")).toEqual([human, unverified, bot].sort());
  });

  test("a legacy-flagged hash counts as bot", async () => {
    const id = await insertSession({ hash: "f".repeat(16) });
    await db.execute({ sql: "INSERT INTO bot_hashes (hash) VALUES (?)", args: ["f".repeat(16)] });
    const body = await (await call(list.GET, "/api/stats/sessions?verdict=bot")).json();
    expect(body.sessions.map((s: { id: number }) => s.id)).toEqual([id]);
  });

  test("country, device, channel and with_events filters", async () => {
    const it = await insertSession({ country: "IT", device: "mobile", channel: "search" });
    await insertSession({ country: "US", device: "desktop", channel: "social", hash: "x".repeat(16) });
    await db.execute({ sql: "INSERT INTO events (day, session_id, visitor_hash, name, created_at) VALUES (date('now'), ?, ?, 'clap', datetime('now'))", args: [it, FULL_HASH] });

    const ids = async (qs: string) =>
      (await (await call(list.GET, `/api/stats/sessions?${qs}`)).json()).sessions.map((s: { id: number }) => s.id);
    expect(await ids("country=it")).toEqual([it]);
    expect(await ids("device=mobile")).toEqual([it]);
    expect(await ids("channel=search")).toEqual([it]);
    expect(await ids("channel=social&country=IT")).toEqual([]);
    expect(await ids("with_events=1")).toEqual([it]);
    expect((await ids("with_events=0")).length).toBe(2);
  });

  test("the date range bounds the result", async () => {
    await insertSession({ startedAt: minutesAgo(60 * 24 * 10) });
    const recent = await insertSession({ startedAt: minutesAgo(10) });
    const today = new Date().toISOString().slice(0, 10);
    const body = await (await call(list.GET, `/api/stats/sessions?from=${today}&to=${today}&verdict=all`)).json();
    expect(body.sessions.map((s: { id: number }) => s.id)).toEqual([recent]);
  });

  test("privacy: never exposes the full visitor hash or an IP, user is a short prefix", async () => {
    const id = await insertSession();
    await insertPv(id, { path: "/blog/a", at: minutesAgo(60) });
    const listText = await (await call(list.GET, "/api/stats/sessions")).text();
    const detailText = await (await callDetail(String(id))).text();
    const liveRes = await db.execute({ sql: "UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?", args: [id] });
    expect(liveRes.rowsAffected).toBe(1);
    const liveText = await (await call(live.GET, "/api/stats/live")).text();

    for (const text of [listText, detailText, liveText]) {
      expect(text).not.toContain(FULL_HASH);
      expect(text).not.toContain(FULL_HASH.slice(0, 10));
      expect(text).not.toMatch(/visitor_hash|"ip"|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
      expect(text).toContain(FULL_HASH.slice(0, 6));
    }
    expect(JSON.parse(listText).sessions[0].user).toHaveLength(6);
  });

  test("degrades to an empty list with available:false without the sessions table", async () => {
    await db.execute("DROP TABLE sessions");
    const r = await call(list.GET, "/api/stats/sessions");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ sessions: [], next_cursor: null, available: false });
  });

  test("works without the events table", async () => {
    await insertSession();
    await db.execute("DROP TABLE events");
    const body = await (await call(list.GET, "/api/stats/sessions")).json();
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].events_count).toBe(0);
    expect((await (await call(list.GET, "/api/stats/sessions?with_events=1")).json()).sessions).toEqual([]);
  });
});

describe("GET /api/stats/sessions/[id]", () => {
  test("pageviews and events come back in chronological order with vitals and utm", async () => {
    const id = await insertSession({ startedAt: minutesAgo(30) });
    await insertPv(id, { path: "/blog/second", at: minutesAgo(28), time: 20, scroll: 80 });
    await insertPv(id, { path: "/blog/first", at: minutesAgo(30), time: 5, scroll: 10, lcp: 2100 });
    // a different visit of the same hash must not leak into this timeline
    const other = await insertSession({ startedAt: minutesAgo(200) });
    await insertPv(other, { path: "/other", at: minutesAgo(200) });
    for (const [name, at] of [["scroll_75", minutesAgo(27)], ["clap", minutesAgo(29)]]) {
      await db.execute({ sql: "INSERT INTO events (day, session_id, visitor_hash, name, path, prop, created_at) VALUES (date('now'), ?, ?, ?, '/blog/first', 'x', ?)", args: [id, FULL_HASH, name, at] });
    }

    const body = await (await callDetail(String(id))).json();
    expect(body.pageviews.map((p: { path: string }) => p.path)).toEqual(["/blog/first", "/blog/second"]);
    expect(body.pageviews[0]).toMatchObject({ time_on_page: 5, scroll_depth: 10, lcp_ms: 2100, inp_ms: 120, cls: 0.05 });
    expect(body.events.map((e: { name: string }) => e.name)).toEqual(["clap", "scroll_75"]);
    expect(body.session).toMatchObject({ id, user: "deadbe", browser: "Firefox", os: "Linux", language: "it", utm_source: "hn", events_count: 2 });
  });

  test("works on a database without the Web Vitals columns", async () => {
    const id = await insertSession();
    await insertPv(id, { path: "/blog/a", at: minutesAgo(59) });
    await db.execute("ALTER TABLE pageviews DROP COLUMN lcp_ms");
    const body = await (await callDetail(String(id))).json();
    expect(body.pageviews[0].lcp_ms).toBeNull();
  });
});

describe("GET /api/stats/live", () => {
  test("keeps the numeric count and lists recent non-bot sessions only", async () => {
    await insertSession({ lastSeen: minutesAgo(1), startedAt: minutesAgo(3), hash: "aaaaaa0000000000" });
    await insertSession({ lastSeen: minutesAgo(2), startedAt: minutesAgo(4), human: 0, hash: "cccccc0000000000" });
    await insertSession({ lastSeen: minutesAgo(1), startedAt: minutesAgo(3), botScore: 99, hash: "bbbbbb0000000000" });
    await insertSession({ lastSeen: minutesAgo(20), startedAt: minutesAgo(25), hash: "dddddd0000000000" });

    const body = await (await call(live.GET, "/api/stats/live")).json();
    expect(body.active).toBe(2);
    expect(body.active_sessions.map((a: { user: string }) => a.user)).toEqual(["aaaaaa", "cccccc"]);
    expect(body.active_sessions[0]).toMatchObject({ country: "IT", device: "desktop", path: "/blog/b" });
  });

  test("caps the list at 20", async () => {
    for (let i = 0; i < 25; i++) await insertSession({ lastSeen: minutesAgo(1), hash: `u${i}`.padEnd(16, "0") });
    const body = await (await call(live.GET, "/api/stats/live")).json();
    expect(body.active_sessions).toHaveLength(20);
  });
});

describe("legacy flag by session id", () => {
  test("POST /api/admin/bot {sessionId} flags the session's hash without the client knowing it", async () => {
    const bot = await import("~/pages/api/admin/bot");
    const id = await insertSession({ hash: "9".repeat(16) });
    const post = (body: unknown) =>
      (bot.POST as unknown as (c: unknown) => Promise<Response>)({
        request: new Request("https://example.com/api/admin/bot", {
          method: "POST",
          headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      });
    expect((await post({ sessionId: 9999 })).status).toBe(404);
    expect((await post({ sessionId: id })).status).toBe(200);
    const flagged = await db.execute("SELECT hash FROM bot_hashes");
    expect(flagged.rows.map((r) => r.hash)).toEqual(["9".repeat(16)]);
  });
});
