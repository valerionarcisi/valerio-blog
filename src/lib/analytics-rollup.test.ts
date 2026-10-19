import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

const { GET: statsGET } = await import("~/pages/api/stats");
const { POST: rollupPOST } = await import("~/pages/api/admin/analytics-rollup");
const { POST: botPOST } = await import("~/pages/api/admin/bot");
const {
  rollupDay,
  rollupRange,
  pruneRaw,
  invalidateDays,
  runDailyJob,
  scopeSql,
  detectCaps,
} = await import("~/lib/analytics-rollup");
const { computeBlock } = await import("~/lib/stats-hybrid");
const { migrateAnalyticsV2 } = await import("../../scripts/migrate-analytics-v2");
const { BOT_SQL, HUMAN_SQL } = await import("~/lib/bot-verdict");

const PV_DDL = `
  CREATE TABLE pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL, hostname TEXT NOT NULL, pathname TEXT NOT NULL,
    referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
    is_unique INTEGER NOT NULL DEFAULT 0, visitor_hash TEXT,
    time_on_page INTEGER, scroll_depth INTEGER,
    browser TEXT, os TEXT, device_type TEXT, language TEXT, country TEXT, channel TEXT,
    human INTEGER DEFAULT 0, bot_score INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

type Pv = Record<string, string | number | null>;

async function insert(row: Pv) {
  const r: Pv = {
    page_id: "p" + Math.random().toString(36).slice(2, 10),
    hostname: "valerionarcisi.me",
    pathname: "/blog/a",
    referrer: null,
    utm_source: null,
    utm_campaign: null,
    is_unique: 1,
    visitor_hash: "h" + Math.random().toString(36).slice(2, 10),
    time_on_page: 60,
    scroll_depth: 50,
    browser: "Chrome",
    os: "macOS",
    device_type: "desktop",
    language: "it-IT",
    country: "IT",
    channel: "direct",
    human: 1,
    bot_score: 0,
    created_at: "2026-03-05 10:00:00",
    ...row,
  };
  const cols = Object.keys(r);
  await db.execute({
    sql: `INSERT INTO pageviews (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    args: cols.map((c) => r[c]),
  });
}

// Deterministic PRNG so failures are reproducible.
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function seedDataset() {
  const rnd = prng(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const paths = ["/", "/en", "/en/", "/blog/a", "/blog/b", "/blog/c", "/blog", "/en/blog/a", "/films/x", "/tag/t", "/chi-sono", "/note/1", "/musica", "/en/music", "/sport", "/zzz"];
  const hashes = Array.from({ length: 14 }, (_, i) => `hash${i}`);
  for (let day = 1; day <= 10; day++) {
    const d = `2026-03-${String(day).padStart(2, "0")}`;
    for (let i = 0; i < 45; i++) {
      const roll = rnd();
      await insert({
        pathname: pick(paths),
        referrer: pick([null, null, "google.com", "twitter.com", "news.ycombinator.com"]),
        utm_source: pick([null, null, null, "nl", "tw"]),
        utm_campaign: pick([null, null, null, "spring", "launch"]),
        is_unique: rnd() < 0.6 ? 1 : 0,
        visitor_hash: pick(hashes),
        time_on_page: rnd() < 0.3 ? null : Math.floor(rnd() * 200),
        scroll_depth: rnd() < 0.2 ? null : Math.floor(rnd() * 101),
        browser: pick([null, "Chrome", "Safari", "Firefox"]),
        os: pick([null, "macOS", "iOS", "Windows"]),
        device_type: pick([null, "desktop", "mobile", "tablet"]),
        language: pick([null, "it-IT", "it", "en-US", "en-GB", "de"]),
        country: pick([null, "IT", "IT", "US", "DE", "FR"]),
        channel: pick([null, "direct", "search", "social"]),
        human: rnd() < 0.6 ? 1 : 0,
        bot_score: roll < 0.1 ? 6 : roll < 0.14 ? 99 : 0,
        created_at: `${d} ${String(Math.floor(rnd() * 24)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:00`,
      });
    }
  }
  // legacy flagged hashes
  await db.execute("INSERT INTO bot_hashes (hash) VALUES ('hash3'), ('hash7')");
}

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(PV_DDL);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

function statsReq(params: Record<string, string>) {
  const url = new URL("https://example.com/api/stats?" + new URLSearchParams(params));
  return {
    url,
    request: new Request(url, { headers: { Authorization: "Bearer test-token" } }),
  };
}
async function stats(params: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await statsGET(statsReq(params) as any);
  expect(res.status).toBe(200);
  return res.json();
}
function post(handler: typeof rollupPOST, body: unknown, token = "test-token") {
  return handler({
    request: new Request("https://example.com/api/admin/x", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

async function snapshot() {
  const out: Record<string, unknown[]> = {};
  for (const t of ["daily_stats", "daily_pages", "daily_dims"]) {
    const r = await db.execute(`SELECT * FROM ${t} ORDER BY 1,2,3,4`);
    out[t] = r.rows.map((x) => ({ ...x }));
  }
  const log = await db.execute("SELECT day, rows_in FROM rollup_log ORDER BY day");
  out.log = log.rows.map((x) => ({ ...x }));
  return out;
}

describe("equivalence: rollups vs raw", () => {
  beforeEach(async () => {
    await seedDataset();
    await rollupRange(db, "2026-03-01", "2026-03-09");
  });

  const base = { today: "2026-03-10", groupBy: "day" } as const;
  test.each([
    ["human", false],
    ["all", true],
  ])("computeBlock, scope %s: every field identical (closed days)", async (_n, includeAll) => {
    const o = { ...base, from: "2026-03-01", to: "2026-03-09", includeAll };
    const hybrid = await computeBlock(db, o);
    const raw = await computeBlock(db, { ...o, useRollup: false });
    expect(hybrid.source).toEqual({ rollup_days: 9, raw_days: 0 });
    expect(raw.source).toEqual({ rollup_days: 0, raw_days: 9 });
    expect({ ...hybrid, source: 0 }).toEqual({ ...raw, source: 0 });
    // sanity: the dataset actually exercises every breakdown
    expect(hybrid.totals.pageviews).toBeGreaterThan(50);
    for (const k of ["chart", "topPages", "referrers", "countries", "browsers", "os", "devices", "languages", "utmSources", "utmCampaigns", "sections", "topEngaged"] as const) {
      expect(hybrid[k].length, k).toBeGreaterThan(1);
    }
    expect(hybrid.referrers.some((r) => r.referrer === null)).toBe(true);
    expect(hybrid.totals.bounced).toBeGreaterThan(0);
  });

  test.each([false, true])("range spanning rollup days and today (raw), includeAll=%s", async (includeAll) => {
    const o = { ...base, from: "2026-03-01", to: "2026-03-10", includeAll };
    const hybrid = await computeBlock(db, o);
    const raw = await computeBlock(db, { ...o, useRollup: false });
    expect(hybrid.source).toEqual({ rollup_days: 9, raw_days: 1 });
    expect({ ...hybrid, source: 0 }).toEqual({ ...raw, source: 0 });
  });

  test("monthly grouping merges rollup and raw days of the same month", async () => {
    const o = { ...base, groupBy: "month", from: "2026-03-01", to: "2026-03-10", includeAll: false };
    const hybrid = await computeBlock(db, o);
    const raw = await computeBlock(db, { ...o, useRollup: false });
    expect(hybrid.chart).toHaveLength(1);
    expect({ ...hybrid, source: 0 }).toEqual({ ...raw, source: 0 });
  });

  test("non-contiguous gaps (an invalidated day in the middle) are read from raw", async () => {
    await invalidateDays(db, ["2026-03-04", "2026-03-05"]);
    const o = { ...base, from: "2026-03-01", to: "2026-03-10", includeAll: false };
    const hybrid = await computeBlock(db, o);
    const raw = await computeBlock(db, { ...o, useRollup: false });
    expect(hybrid.source).toEqual({ rollup_days: 7, raw_days: 3 });
    expect({ ...hybrid, source: 0 }).toEqual({ ...raw, source: 0 });
  });

  test.each<Record<string, string>>([{}, { include: "all" }])("/api/stats JSON identical to the raw-only computation %j", async (extra) => {
    for (const range of [
      { from: "2026-03-01", to: "2026-03-09" },
      { from: "2026-03-01", to: "2026-03-10" },
      { from: "2026-03-04", to: "2026-03-10" },
    ]) {
      const params = { period: "custom", ...range, ...extra };
      const viaRollup = await stats(params);
      expect(viaRollup.source.rollup_days).toBeGreaterThan(0);
      await db.execute("ALTER TABLE rollup_log RENAME TO rollup_log_off");
      const rawOnly = await stats(params);
      await db.execute("ALTER TABLE rollup_log_off RENAME TO rollup_log");
      expect(rawOnly.source.rollup_days).toBe(0);
      const strip = (b: Record<string, unknown>) => ({ ...b, source: 0 });
      expect(strip(viaRollup)).toEqual(strip(rawOnly));
      expect(viaRollup.summary.prev_period).toBeDefined();
    }
  });

  test("with a pathname filter stats reads raw only", async () => {
    const body = await stats({ period: "custom", from: "2026-03-01", to: "2026-03-09", pathname: "/blog/a" });
    expect(body.source).toEqual({ rollup_days: 0, raw_days: 9 });
  });

  test("one-day (hourly) range reads raw only", async () => {
    const body = await stats({ period: "custom", from: "2026-03-05", to: "2026-03-05" });
    expect(body.source.rollup_days).toBe(0);
    expect(body.period.groupBy).toBe("hour");
  });
});

describe("rollupDay", () => {
  test("is idempotent when run twice", async () => {
    await seedDataset();
    await rollupDay(db, "2026-03-03");
    const first = await snapshot();
    await rollupDay(db, "2026-03-03");
    expect(await snapshot()).toEqual(first);
    expect(first.daily_stats.length).toBe(2);
  });

  test("empty day: logged with rows_in 0, no daily rows, stats still equal raw", async () => {
    await insert({ created_at: "2026-03-04 09:00:00" });
    const r = await rollupDay(db, "2026-03-03");
    expect(r.rowsIn).toBe(0);
    expect((await snapshot()).daily_stats).toEqual([]);
    expect((await snapshot()).log).toEqual([{ day: "2026-03-03", rows_in: 0 }]);
    const o = { today: "2026-03-10", groupBy: "day", from: "2026-03-01", to: "2026-03-05", includeAll: false };
    const hybrid = await computeBlock(db, o);
    expect(hybrid.source.rollup_days).toBe(1);
    expect({ ...hybrid, source: 0 }).toEqual({ ...(await computeBlock(db, { ...o, useRollup: false })), source: 0 });
  });

  test("a bot flagged after the rollup: re-rollup fixes the numbers", async () => {
    await insert({ visitor_hash: "evil", created_at: "2026-03-03 10:00:00" });
    await insert({ visitor_hash: "good", created_at: "2026-03-03 11:00:00" });
    await rollupDay(db, "2026-03-03");
    const q = () => stats({ period: "custom", from: "2026-03-01", to: "2026-03-05" });
    expect((await q()).summary.pageviews).toBe(2);
    await db.execute("INSERT INTO bot_hashes (hash) VALUES ('evil')");
    expect((await q()).summary.pageviews).toBe(2); // stale until recomputed
    await rollupDay(db, "2026-03-03");
    expect((await q()).summary.pageviews).toBe(1);
  });

  test("legacy /api/admin/bot flag invalidates the past days' rollups", async () => {
    await insert({ visitor_hash: "evil", created_at: "2026-03-03 10:00:00" });
    await insert({ visitor_hash: "good", created_at: "2026-03-04 11:00:00" });
    await rollupRange(db, "2026-03-03", "2026-03-04");
    const res = await post(botPOST, { hash: "evil" });
    expect(res.status).toBe(200);
    const days = (await db.execute("SELECT day FROM rollup_log ORDER BY day")).rows.map((r) => r.day);
    expect(days).toEqual(["2026-03-04"]); // only the flagged hash's day dropped
    const body = await stats({ period: "custom", from: "2026-03-01", to: "2026-03-05" });
    expect(body.summary.pageviews).toBe(1);
    expect(body.source).toEqual({ rollup_days: 1, raw_days: 4 });
  });

  test("degrades without bot_score/human/bot_hashes/channel columns", async () => {
    const old = createClient({ url: ":memory:" });
    await old.executeMultiple(`
      CREATE TABLE pageviews (id INTEGER PRIMARY KEY AUTOINCREMENT, pathname TEXT NOT NULL,
        is_unique INTEGER NOT NULL DEFAULT 0, visitor_hash TEXT, time_on_page INTEGER, scroll_depth INTEGER,
        created_at TEXT NOT NULL);
      INSERT INTO pageviews (pathname, is_unique, created_at) VALUES ('/', 1, '2026-03-03 10:00:00');
    `);
    await expect(rollupDay(old, "2026-03-03")).resolves.toMatchObject({ rowsIn: 1 });
    const all = await old.execute("SELECT pageviews FROM daily_stats WHERE scope='all'");
    const human = await old.execute("SELECT pageviews FROM daily_stats WHERE scope='human'");
    expect(all.rows[0].pageviews).toBe(1);
    expect(human.rows).toHaveLength(0);
    const caps = await detectCaps(old);
    expect(scopeSql(caps).all).toBe("(NOT 0)");
  });

  test("scope SQL equals the Phase 4 verdict helpers with a full schema", async () => {
    const s = scopeSql(await detectCaps(db));
    expect(s.human).toBe(HUMAN_SQL);
    expect(s.all).toBe(`(NOT ${BOT_SQL})`);
  });

  test("page visitors are distinct visitors of that page, not entries", async () => {
    await insert({ visitor_hash: "v1", pathname: "/", is_unique: 1, created_at: "2026-03-03 10:00:00" });
    await insert({ visitor_hash: "v1", pathname: "/ascolti", is_unique: 0, created_at: "2026-03-03 10:01:00" });
    await insert({ visitor_hash: "v1", pathname: "/ascolti", is_unique: 0, created_at: "2026-03-03 10:02:00" });
    await insert({ visitor_hash: "v2", pathname: "/", is_unique: 1, created_at: "2026-03-03 11:00:00" });
    await insert({ visitor_hash: "v2", pathname: "/ascolti", is_unique: 0, created_at: "2026-03-03 11:01:00" });
    await rollupDay(db, "2026-03-03");
    const body = await stats({ period: "custom", from: "2026-03-01", to: "2026-03-05" });
    const ascolti = body.top_pages.find((p: { pathname: string }) => p.pathname === "/ascolti");
    expect(ascolti).toMatchObject({ pageviews: 3, visitors: 2 });
  });

  test("rejects an invalid day", async () => {
    await expect(rollupDay(db, "2026-3-3")).rejects.toThrow();
  });
});

describe("pruneRaw", () => {
  test("deletes old raw rows only for days with a rollup_log entry", async () => {
    await insert({ created_at: "2025-11-01 10:00:00" }); // old, rolled
    await insert({ created_at: "2025-11-02 10:00:00" }); // old, NOT rolled
    await insert({ created_at: "2026-03-05 10:00:00" }); // recent
    await rollupDay(db, "2025-11-01");
    const r = await pruneRaw(db, new Date("2026-03-10T00:20:00Z"), 90);
    expect(r.deletedPageviews).toBe(1);
    const left = (await db.execute("SELECT date(created_at) d FROM pageviews ORDER BY d")).rows.map((x) => x.d);
    expect(left).toEqual(["2025-11-02", "2026-03-05"]);
    // the rollup itself is kept forever
    expect((await db.execute("SELECT * FROM daily_stats WHERE day='2025-11-01'")).rows.length).toBeGreaterThan(0);
  });

  test("cleans short-lived tables when present and tolerates missing ones", async () => {
    await db.executeMultiple(`
      CREATE TABLE rate_limits (key TEXT, window_start INTEGER, count INTEGER);
      INSERT INTO rate_limits VALUES ('a', 1000, 1), ('b', ${Math.floor(Date.parse("2026-03-10T00:00:00Z") / 1000)}, 1);
      CREATE TABLE telegram_updates (update_id INTEGER PRIMARY KEY, seen_at TEXT);
      INSERT INTO telegram_updates VALUES (1, '2026-01-01T00:00:00.000Z'), (2, '2026-03-09T00:00:00.000Z');
      CREATE TABLE daily_visitors (day TEXT, visitor_hash TEXT);
      INSERT INTO daily_visitors VALUES ('2026-03-01', 'x'), ('2026-03-10', 'y');
    `);
    const r = await pruneRaw(db, new Date("2026-03-10T00:20:00Z"));
    expect(r.cleaned).toEqual(expect.arrayContaining(["rate_limits", "telegram_updates", "daily_visitors"]));
    expect((await db.execute("SELECT key FROM rate_limits")).rows).toHaveLength(1);
    expect((await db.execute("SELECT update_id FROM telegram_updates")).rows).toHaveLength(1);
    expect((await db.execute("SELECT day FROM daily_visitors")).rows).toHaveLength(1);
  });

  test("works before any rollup exists (deletes nothing)", async () => {
    await insert({ created_at: "2025-01-01 10:00:00" });
    expect((await pruneRaw(db, new Date("2026-03-10T00:20:00Z"))).deletedPageviews).toBe(0);
  });

  test("runDailyJob rolls up yesterday and the day before, then prunes", async () => {
    await insert({ created_at: "2026-03-09 10:00:00" });
    await insert({ created_at: "2026-03-08 10:00:00" });
    const r = await runDailyJob(db, new Date("2026-03-10T00:20:00Z"));
    expect(r.rolled.map((x) => x.day)).toEqual(["2026-03-08", "2026-03-09"]);
  });
});

describe("POST /api/admin/analytics-rollup", () => {
  test("requires admin auth", async () => {
    expect((await post(rollupPOST, { from: "2026-03-01", to: "2026-03-02" }, "wrong")).status).toBe(401);
  });
  test.each([
    [{ from: "nope", to: "2026-03-02" }],
    [{ from: "2026-03-01" }],
    [{ from: "2026-02-30", to: "2026-03-02" }],
    [{ from: "2026-03-05", to: "2026-03-02" }],
    [{ from: "2026-03-01", to: "2026-03-10" }], // today is not closed
    [{ from: "2025-01-01", to: "2026-03-05" }], // > 400 days
    ["not json"],
  ])("rejects %j", async (body) => {
    expect((await post(rollupPOST, body)).status).toBe(400);
  });
  test("accepts exactly 400 days and rolls them up", async () => {
    await insert({ created_at: "2026-03-05 10:00:00" });
    const res = await post(rollupPOST, { from: "2025-02-03", to: "2026-03-09" });
    expect(res.status).toBe(200);
    expect((await res.json()).days).toBe(400);
  });
  test("rolls up a valid range", async () => {
    await insert({ created_at: "2026-03-05 10:00:00" });
    const res = await post(rollupPOST, { from: "2026-03-05", to: "2026-03-06" });
    expect(await res.json()).toEqual({ ok: true, days: 2, rows_in: 1 });
  });
});

describe("migration", () => {
  test("creates the rollup tables and is idempotent (run twice)", async () => {
    const m = createClient({ url: ":memory:" });
    await m.executeMultiple(PV_DDL);
    await migrateAnalyticsV2(m);
    await migrateAnalyticsV2(m);
    const t = (
      await m.execute(
        "SELECT name FROM sqlite_master WHERE name IN ('daily_stats','daily_pages','daily_dims','rollup_log') ORDER BY name",
      )
    ).rows.map((r) => r.name);
    expect(t).toEqual(["daily_dims", "daily_pages", "daily_stats", "rollup_log"]);
  });
});
