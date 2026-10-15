import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;
vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

const { rollupDay, rollupRange } = await import("~/lib/analytics-rollup");
const { computeVitals, computeSlowPages } = await import("~/lib/analytics-vitals-stats");
const { buildVitalsRows } = await import("~/lib/analytics-vitals");
const { migrateAnalyticsV2 } = await import("../../scripts/migrate-analytics-v2");
const { GET: statsGET } = await import("~/pages/api/stats");

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

type Row = Record<string, string | number | null>;
let seq = 0;
async function insert(row: Row) {
  const r: Row = {
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
    created_at: "2026-03-02 10:00:00",
    ...row,
  };
  const cols = Object.keys(r);
  await db.execute({
    sql: `INSERT INTO pageviews (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    args: cols.map((c) => r[c]),
  });
}

// Deterministic PRNG
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function seed() {
  const rnd = prng(42);
  const days = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"];
  for (const day of days) {
    const n = 20 + Math.floor(rnd() * 20);
    for (let i = 0; i < n; i++) {
      const roll = rnd();
      await insert({
        created_at: `${day} 1${i % 10}:00:00`,
        device_type: roll < 0.5 ? "mobile" : roll < 0.9 ? "desktop" : null,
        human: rnd() < 0.85 ? 1 : 0,
        bot_score: rnd() < 0.05 ? 9 : 0,
        pathname: rnd() < 0.5 ? "/blog/a" : "/blog/b",
        lcp_ms: rnd() < 0.8 ? Math.round(500 + rnd() * 6000) : null,
        cls_milli: rnd() < 0.7 ? Math.round(rnd() * 400) : null,
        inp_ms: rnd() < 0.4 ? Math.round(50 + rnd() * 700) : null,
      });
    }
  }
}

const base = { groupBy: "day", today: "2026-03-10" };

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(OLD);
  await migrateAnalyticsV2(db);
  seq = 0;
});

/** p75 is approximate across days by design; every other field must match exactly. */
function withoutP75<T extends { p75?: unknown }>(v: T): Omit<T, "p75"> {
  const copy = { ...v };
  delete copy.p75;
  return copy;
}

describe("daily_vitals rollup", () => {
  test("rollupDay stores exact buckets and p75 per scope/device/metric", async () => {
    await seed();
    await rollupDay(db, "2026-03-02");
    const raw = await db.execute(
      `SELECT device_type AS d, lcp_ms, cls_milli, inp_ms FROM pageviews
       WHERE date(created_at) = '2026-03-02' AND human = 1 AND bot_score < 5`,
    );
    const expected = buildVitalsRows(
      raw.rows.map((r) => ({
        device: r.d as string | null,
        lcp: r.lcp_ms as number | null,
        cls: r.cls_milli as number | null,
        inp: r.inp_ms as number | null,
      })),
    );
    const got = (
      await db.execute(
        "SELECT device, metric, n, good, ni, poor, p75 FROM daily_vitals WHERE day = '2026-03-02' AND scope = 'human'",
      )
    ).rows;
    expect(got).toHaveLength(expected.length);
    for (const e of expected) {
      expect(got.find((g) => g.device === e.device && g.metric === e.metric)).toMatchObject(e);
    }
  });

  test("is idempotent (re-run replaces, never duplicates)", async () => {
    await seed();
    await rollupDay(db, "2026-03-02");
    const a = (await db.execute("SELECT COUNT(*) c FROM daily_vitals")).rows[0].c;
    await rollupDay(db, "2026-03-02");
    expect((await db.execute("SELECT COUNT(*) c FROM daily_vitals")).rows[0].c).toBe(a);
  });

  test("rollup works on a database without the vitals columns", async () => {
    const old = createClient({ url: ":memory:" });
    await old.executeMultiple(OLD);
    await old.execute("INSERT INTO pageviews (page_id, hostname, pathname) VALUES ('a','h','/')");
    await expect(rollupDay(old, "2026-03-02")).resolves.toBeDefined();
    expect((await old.execute("SELECT COUNT(*) c FROM daily_vitals")).rows[0].c).toBe(0);
  });
});

describe("computeVitals: rollup vs raw", () => {
  const cases = [false, true];
  test.each(cases)("buckets exact over several days, includeAll=%s", async (includeAll) => {
    await seed();
    await rollupRange(db, "2026-03-01", "2026-03-05");
    const o = { ...base, from: "2026-03-01", to: "2026-03-05", includeAll };
    const hybrid = await computeVitals(db, o);
    const raw = await computeVitals(db, { ...o, useRollup: false });
    expect(hybrid.available).toBe(true);
    for (const m of ["lcp", "inp", "cls"] as const) {
      const h = withoutP75(hybrid[m]);
      const r = withoutP75(raw[m]);
      expect(h).toEqual(r);
      expect(h.n).toBeGreaterThan(0);
      for (const dev of ["mobile", "desktop"]) {
        const hd = withoutP75(hybrid.by_device[dev][m]);
        const rd = withoutP75(raw.by_device[dev][m]);
        expect(hd).toEqual(rd);
      }
    }
  });

  test("a single rolled-up day has the EXACT p75 of the raw read", async () => {
    await seed();
    await rollupDay(db, "2026-03-03");
    const o = { ...base, from: "2026-03-03", to: "2026-03-03", includeAll: false, groupBy: "day" };
    expect(await computeVitals(db, o)).toEqual(await computeVitals(db, { ...o, useRollup: false }));
  });

  test("multi-day p75 is the n-weighted average of the daily p75 (documented approximation)", async () => {
    await seed();
    await rollupRange(db, "2026-03-01", "2026-03-05");
    const hybrid = await computeVitals(db, { ...base, from: "2026-03-01", to: "2026-03-05", includeAll: false });
    let w = 0;
    let n = 0;
    for (const day of ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"]) {
      const d = await computeVitals(db, { ...base, from: day, to: day, includeAll: false, useRollup: false });
      w += (d.lcp.p75 as number) * d.lcp.n;
      n += d.lcp.n;
    }
    // p75 values are rounded to integer ms per day before weighting
    expect(Math.abs((hybrid.lcp.p75 as number) - w / n)).toBeLessThan(1);
    const raw = await computeVitals(db, { ...base, from: "2026-03-01", to: "2026-03-05", includeAll: false, useRollup: false });
    // approximation stays close to the exact value
    expect(Math.abs((hybrid.lcp.p75 as number) - (raw.lcp.p75 as number))).toBeLessThan(800);
  });

  test("today (never rolled up) is read from raw and merged with rolled days", async () => {
    await seed();
    await rollupRange(db, "2026-03-01", "2026-03-05");
    await insert({ created_at: "2026-03-10 09:00:00", lcp_ms: 9000, device_type: "mobile" });
    const o = { ...base, from: "2026-03-05", to: "2026-03-10", includeAll: false };
    const hybrid = await computeVitals(db, o);
    const raw = await computeVitals(db, { ...o, useRollup: false });
    expect(hybrid.lcp.n).toBe(raw.lcp.n);
    expect(hybrid.lcp.poor).toBe(raw.lcp.poor);
    expect(hybrid.lcp.good + hybrid.lcp.ni + hybrid.lcp.poor).toBe(hybrid.lcp.n);
  });

  test("filters read raw only and apply to vitals", async () => {
    await seed();
    await rollupRange(db, "2026-03-01", "2026-03-05");
    const o = { ...base, from: "2026-03-01", to: "2026-03-05", includeAll: false };
    const filtered = await computeVitals(db, { ...o, filters: { device: "desktop" } });
    const all = await computeVitals(db, o);
    expect(filtered.lcp.n).toBeLessThan(all.lcp.n);
    const direct = await db.execute(
      `SELECT COUNT(lcp_ms) c FROM pageviews WHERE device_type = 'desktop' AND human = 1 AND bot_score < 5 AND created_at >= '2026-03-01' AND created_at < '2026-03-06'`,
    );
    expect(filtered.lcp.n).toBe(Number(direct.rows[0].c));
    const none = await computeVitals(db, { ...o, filters: { country: "ZZ" } });
    expect(none.lcp.n).toBe(0);
    expect(none.lcp.p75).toBeNull();
  });

  test("available=false when the columns are missing", async () => {
    const old = createClient({ url: ":memory:" });
    await old.executeMultiple(OLD);
    const v = await computeVitals(old, { ...base, from: "2026-03-01", to: "2026-03-05", includeAll: false });
    expect(v.available).toBe(false);
    expect(v.lcp.n).toBe(0);
  });
});

describe("computeSlowPages", () => {
  test("worst pages by LCP p75, n >= 5 only, ordered desc", async () => {
    const ins = (path: string, vals: number[]) =>
      Promise.all(vals.map((v) => insert({ pathname: path, lcp_ms: v, created_at: "2026-03-04 10:00:00" })));
    await ins("/blog/slow", [5000, 5200, 5100, 4900, 5300]);
    await ins("/blog/fast", [1000, 1100, 900, 1200, 1000]);
    await ins("/blog/few", [9000, 9000, 9000, 9000]); // n = 4: excluded
    const rows = await computeSlowPages(db, { from: "2026-03-01", to: "2026-03-05", includeAll: false });
    expect(rows.map((r) => r.pathname)).toEqual(["/blog/slow", "/blog/fast"]);
    expect(rows[0]).toMatchObject({ n: 5, lcp_p75: 5200 });
  });
  test("returns [] without the columns", async () => {
    const old = createClient({ url: ":memory:" });
    await old.executeMultiple(OLD);
    expect(await computeSlowPages(old, { from: "2026-03-01", to: "2026-03-05", includeAll: false })).toEqual([]);
  });
});

describe("GET /api/stats vitals + filters", () => {
  const call = (params: Record<string, string>) => {
    const url = new URL("https://valerionarcisi.me/api/stats");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const request = new Request(url, { headers: { authorization: "Bearer test-token" } });
    return statsGET({ url, request } as never);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  test("exposes vitals and vitals_pages", async () => {
    await seed();
    for (let i = 0; i < 6; i++) await insert({ pathname: "/blog/slow", lcp_ms: 6000, created_at: "2026-03-08 10:00:00" });
    const res = await call({ period: "custom", from: "2026-03-01", to: "2026-03-09" });
    const body = await res.json();
    expect(body.vitals.available).toBe(true);
    expect(body.vitals.lcp.n).toBeGreaterThan(0);
    expect(body.vitals.by_device.mobile).toBeDefined();
    expect(body.vitals_pages[0]).toMatchObject({ pathname: "/blog/slow", lcp_p75: 6000, n: 6 });
    expect(body.filters.active).toBe(false);
  });

  test("a filter forces raw reads, narrows the numbers and flags the response", async () => {
    await seed();
    await rollupRange(db, "2026-03-01", "2026-03-05");
    const plain = await (await call({ period: "custom", from: "2026-03-01", to: "2026-03-09" })).json();
    const f = await (await call({ period: "custom", from: "2026-03-01", to: "2026-03-09", device: "desktop" })).json();
    expect(plain.source.rollup_days).toBeGreaterThan(0);
    expect(f.source.rollup_days).toBe(0);
    expect(f.filters).toMatchObject({ active: true, device: "desktop", clamped: false });
    expect(f.summary.pageviews).toBeLessThan(plain.summary.pageviews);
    const direct = await db.execute(
      `SELECT COUNT(*) c FROM pageviews WHERE device_type = 'desktop' AND human = 1 AND bot_score < 5 AND created_at >= '2026-03-01' AND created_at < '2026-03-10'`,
    );
    expect(f.summary.pageviews).toBe(Number(direct.rows[0].c));
    expect(f.top_pages.reduce((a: number, r: { pageviews: number }) => a + r.pageviews, 0)).toBe(f.summary.pageviews);
  });

  test("with a filter the range is clamped to the 90-day retention window", async () => {
    const res = await call({ period: "custom", from: "2025-01-01", to: "2026-03-09", country: "IT" });
    const body = await res.json();
    expect(body.filters.clamped).toBe(true);
    expect(body.period.from).toBe("2025-12-10"); // 2026-03-10 minus 90 days
    expect(body.filters.requested_from).toBe("2025-01-01");
    expect(body.summary.pageviews_delta_pct).toBeNull(); // previous period fell out of the window
  });

  test("no clamp without filters", async () => {
    const body = await (await call({ period: "custom", from: "2025-01-01", to: "2026-03-09" })).json();
    expect(body.period.from).toBe("2025-01-01");
    expect(body.filters.clamped).toBe(false);
  });

  test.each<Record<string, string>>([
    { country: "ITA" },
    { country: "1" },
    { device: "watch" },
    { channel: "x'; DROP TABLE pageviews;--" },
  ])("rejects invalid filter %j with 400", async (extra) => {
    const res = await call({ period: "30d", ...extra });
    expect(res.status).toBe(400);
    expect((await db.execute("SELECT COUNT(*) c FROM pageviews")).rows).toHaveLength(1);
  });

  test("sessions are filtered too (channel/country/device live on sessions)", async () => {
    await db.executeMultiple(`
      INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path, pageviews, engaged_seconds, channel, country, device_type, human, bot_score)
      VALUES ('2026-03-08','a','2026-03-08 10:00:00','2026-03-08 10:01:00','/','/',1,30,'search','IT','mobile',1,0),
             ('2026-03-08','b','2026-03-08 11:00:00','2026-03-08 11:01:00','/','/',1,30,'social','US','desktop',1,0);
    `);
    const all = await (await call({ period: "custom", from: "2026-03-01", to: "2026-03-09" })).json();
    const only = await (await call({ period: "custom", from: "2026-03-01", to: "2026-03-09", channel: "search" })).json();
    expect(all.sessions.count).toBe(2);
    expect(only.sessions.count).toBe(1);
    const us = await (await call({ period: "custom", from: "2026-03-01", to: "2026-03-09", country: "us" })).json();
    expect(us.sessions.count).toBe(1);
  });
});
