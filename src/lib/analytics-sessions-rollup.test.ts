import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

const { GET: statsGET } = await import("~/pages/api/stats");
const { rollupRange, rollupDay, pruneRaw, invalidateDays, detectCaps } =
  await import("~/lib/analytics-rollup");
const { computeSessions, computeBlock } = await import("~/lib/stats-hybrid");
const { migrateAnalyticsV2 } = await import(
  "../../scripts/migrate-analytics-v2"
);
const { GOALS } = await import("~/lib/analytics-goals");

const PV_DDL = `
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

function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NAMES = [
  "clap",
  "comment_submit",
  "comment_like",
  "contact_submit",
  "outbound_click",
  "download",
  "not_found",
  "scroll_75",
  "scroll_100",
  "copy_code",
  "share",
];
const PROPS: Record<string, Array<string | null>> = {
  outbound_click: ["github.com", "twitter.com", null],
  download: ["pdf", "zip"],
  share: ["x", "linkedin"],
};

async function seed() {
  const rnd = prng(7);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const paths = ["/", "/blog/a", "/blog/b", "/en/blog/c", "/films/x", "/chi-sono", "/contatti"];
  for (let day = 1; day <= 10; day++) {
    const d = `2026-03-${String(day).padStart(2, "0")}`;
    const next = `2026-03-${String(day + 1).padStart(2, "0")}`;
    for (let i = 0; i < 30; i++) {
      const roll = rnd();
      const hash = `hash${Math.floor(rnd() * 14)}`;
      const pageviews = rnd() < 0.5 ? 1 : 1 + Math.floor(rnd() * 4);
      const engaged = rnd() < 0.4 ? Math.floor(rnd() * 10) : Math.floor(rnd() * 200);
      const entry = pick(paths);
      // ~1 in 8 sessions crosses midnight: day = start day, events may land on the next day
      const crosses = rnd() < 0.125;
      const res = await db.execute({
        sql: `INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path,
                pageviews, engaged_seconds, channel, referrer, country, device_type, human, bot_score)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          d,
          hash,
          crosses ? `${d} 23:50:00` : `${d} 10:00:00`,
          crosses ? `${next} 00:20:00` : `${d} 10:20:00`,
          entry,
          pageviews === 1 ? entry : pick(paths),
          pageviews,
          engaged,
          pick([null, "direct", "search", "social", "email"]),
          pick([null, "google.com"]),
          pick(["IT", "US", null]),
          pick(["desktop", "mobile"]),
          rnd() < 0.6 ? 1 : 0,
          roll < 0.1 ? 6 : roll < 0.14 ? 99 : 0,
        ],
      });
      const sid = Number(res.lastInsertRowid);
      const n = Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const name = pick(NAMES);
        const eventDay = crosses && rnd() < 0.5 ? next : d;
        await db.execute({
          sql: `INSERT INTO events (day, session_id, visitor_hash, name, path, prop, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            eventDay,
            sid,
            hash,
            name,
            pick(["/blog/a", "/blog/b", "/en/blog/c", "/", "/contatti"]),
            PROPS[name] ? pick(PROPS[name]) : null,
            `${eventDay} 10:05:00`,
          ],
        });
      }
    }
    // a few orphan events (no session): never counted in any scope
    await db.execute({
      sql: "INSERT INTO events (day, session_id, visitor_hash, name, path) VALUES (?, NULL, 'x', 'clap', '/')",
      args: [d],
    });
    // one raw pageview per day so rollup_log gets rows_in > 0
    await db.execute({
      sql: "INSERT INTO pageviews (page_id, hostname, pathname, is_unique, visitor_hash, human, bot_score, created_at) VALUES (?, 'valerionarcisi.me', '/', 1, 'hash1', 1, 0, ?)",
      args: [`p${day}`, `${d} 10:00:00`],
    });
  }
  await db.execute("INSERT INTO bot_hashes (hash) VALUES ('hash3'), ('hash7')");
}

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(PV_DDL);
  await migrateAnalyticsV2(db);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const base = { today: "2026-03-10", groupBy: "day" } as const;

describe("equivalence: session rollups vs raw", () => {
  beforeEach(async () => {
    await seed();
    await rollupRange(db, "2026-03-01", "2026-03-09");
  });

  test.each([
    ["human", false],
    ["all", true],
  ])("sessions, entry/exit, events and goals identical, scope %s", async (_n, includeAll) => {
    const o = { ...base, from: "2026-03-01", to: "2026-03-09", includeAll };
    const hybrid = await computeSessions(db, o);
    const raw = await computeSessions(db, { ...o, useRollup: false });
    expect(hybrid).toEqual(raw);
    // the dataset really exercises everything
    expect(hybrid.available).toBe(true);
    expect(hybrid.count).toBeGreaterThan(20);
    expect(hybrid.bounced).toBeGreaterThan(0);
    expect(hybrid.bounced).toBeLessThan(hybrid.count);
    expect(hybrid.entryPages.length).toBeGreaterThan(3);
    expect(hybrid.exitPages.length).toBeGreaterThan(3);
    expect(hybrid.channels.length).toBeGreaterThan(2);
    expect(hybrid.events.length).toBeGreaterThan(5);
    expect(hybrid.events.some((e) => e.prop !== null)).toBe(true);
    expect(hybrid.goals.map((g) => g.id)).toEqual(GOALS.map((g) => g.id));
    expect(hybrid.goals.filter((g) => g.conversions > 0).length).toBeGreaterThan(1);
    for (const g of hybrid.goals) {
      expect(g.rate).toBeLessThanOrEqual(100);
      expect(g.by_channel.length).toBeLessThanOrEqual(10);
      for (const c of g.by_channel) expect(c.conversions).toBeLessThanOrEqual(c.sessions);
    }
  });

  test("the all scope is a superset of the human scope; bots and legacy-flagged hashes are excluded", async () => {
    const o = { ...base, from: "2026-03-01", to: "2026-03-09" };
    const human = await computeSessions(db, { ...o, includeAll: false });
    const all = await computeSessions(db, { ...o, includeAll: true });
    expect(all.count).toBeGreaterThan(human.count);
    const total = await db.execute("SELECT COUNT(*) AS n FROM sessions WHERE day <= '2026-03-09'");
    expect(all.count).toBeLessThan(Number(total.rows[0].n));
    const manual = await db.execute(
      `SELECT COUNT(*) AS n FROM sessions WHERE day <= '2026-03-09' AND human = 1 AND bot_score < 5
         AND visitor_hash NOT IN (SELECT hash FROM bot_hashes)`,
    );
    expect(human.count).toBe(Number(manual.rows[0].n));
  });

  test("goal conversions count distinct sessions, not events", async () => {
    // two contact_submit events in the same human session count once
    const r = await db.execute(
      "INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path, pageviews, engaged_seconds, channel, human) VALUES ('2026-03-02', 'zz', '2026-03-02 09:00:00', '2026-03-02 09:01:00', '/contatti', '/contatti', 1, 30, 'search', 1)",
    );
    const sid = Number(r.lastInsertRowid);
    for (let i = 0; i < 3; i++)
      await db.execute({
        sql: "INSERT INTO events (day, session_id, visitor_hash, name, path) VALUES ('2026-03-02', ?, 'zz', 'contact_submit', '/contatti')",
        args: [sid],
      });
    const o = { ...base, from: "2026-03-02", to: "2026-03-02", includeAll: false, useRollup: false };
    const before = (await computeSessions(db, o)).goals.find((g) => g.id === "contact")!;
    const manual = await db.execute(
      `SELECT COUNT(DISTINCT s.id) AS n FROM sessions s JOIN events e ON e.session_id = s.id
       WHERE s.day = '2026-03-02' AND e.name = 'contact_submit' AND s.human = 1 AND s.bot_score < 5
         AND s.visitor_hash NOT IN (SELECT hash FROM bot_hashes)`,
    );
    expect(before.conversions).toBe(Number(manual.rows[0].n));
    expect(before.by_entry.find((e) => e.path === "/contatti")?.conversions).toBeGreaterThanOrEqual(1);
  });

  test("engaged_read only counts scroll_75 on blog posts", async () => {
    const r = await db.execute(
      "INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path, pageviews, engaged_seconds, channel, human) VALUES ('2026-03-03', 'qq', '2026-03-03 09:00:00', '2026-03-03 09:01:00', '/', '/', 1, 30, 'direct', 1)",
    );
    const sid = Number(r.lastInsertRowid);
    await db.execute({
      sql: "INSERT INTO events (day, session_id, visitor_hash, name, path) VALUES ('2026-03-03', ?, 'qq', 'scroll_75', '/chi-sono')",
      args: [sid],
    });
    const o = { ...base, from: "2026-03-03", to: "2026-03-03", includeAll: false, useRollup: false };
    const a = (await computeSessions(db, o)).goals.find((g) => g.id === "engaged_read")!;
    await db.execute({
      sql: "INSERT INTO events (day, session_id, visitor_hash, name, path) VALUES ('2026-03-03', ?, 'qq', 'scroll_75', '/blog/a')",
      args: [sid],
    });
    const b = (await computeSessions(db, o)).goals.find((g) => g.id === "engaged_read")!;
    expect(b.conversions).toBe(a.conversions + 1);
  });

  test("range spanning rolled days and today (raw), includeAll=%s", async () => {
    for (const includeAll of [false, true]) {
      const o = { ...base, from: "2026-03-01", to: "2026-03-10", includeAll };
      const hybrid = await computeSessions(db, o);
      const raw = await computeSessions(db, { ...o, useRollup: false });
      expect(hybrid).toEqual(raw);
    }
  });

  test("non-contiguous gap (invalidated day) and totalsOnly stay consistent", async () => {
    await invalidateDays(db, ["2026-03-04"]);
    const o = { ...base, from: "2026-03-01", to: "2026-03-09", includeAll: true };
    const hybrid = await computeSessions(db, o);
    const raw = await computeSessions(db, { ...o, useRollup: false });
    expect(hybrid).toEqual(raw);
    const t = await computeSessions(db, { ...o, totalsOnly: true });
    expect(t.count).toBe(raw.count);
    expect(t.bounced).toBe(raw.bounced);
    expect(t.goals.map((g) => g.conversions)).toEqual(raw.goals.map((g) => g.conversions));
  });

  test("a pathname filter or hourly range reads raw (same numbers)", async () => {
    const o = { ...base, from: "2026-03-01", to: "2026-03-09", includeAll: true };
    const raw = await computeSessions(db, { ...o, useRollup: false });
    expect(await computeSessions(db, { ...o, pathname: "/blog/a" })).toEqual(raw);
  });

  test("rollupDay is idempotent for the session tables", async () => {
    const snap = async () => {
      const out: unknown[] = [];
      for (const t of ["daily_sessions", "daily_events", "daily_entry_exit", "daily_goals"]) {
        out.push((await db.execute(`SELECT * FROM ${t} ORDER BY 1,2,3,4,5`)).rows.map((r) => ({ ...r })));
      }
      return out;
    };
    const first = await snap();
    await rollupRange(db, "2026-03-01", "2026-03-09");
    expect(await snap()).toEqual(first);
    expect(first.every((rows) => (rows as unknown[]).length > 0)).toBe(true);
  });

  test("/api/stats exposes the new fields and keeps the legacy ones", async () => {
    const url = new URL("https://example.com/api/stats?period=custom&from=2026-03-01&to=2026-03-09&include=all");
    const request = new Request(url, { headers: { Authorization: "Bearer test-token" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await statsGET({ url, request } as any);
    expect(res.status).toBe(200);
    const j = await res.json();
    const raw = await computeSessions(db, { ...base, from: "2026-03-01", to: "2026-03-09", includeAll: true, useRollup: false });
    expect(j.sessions.count).toBe(raw.count);
    expect(j.sessions.bounce_rate).toBe(Math.round((raw.bounced / raw.count) * 1000) / 10);
    expect(j.sessions.pages_per_session).toBeGreaterThan(1);
    expect(j.sessions.avg_engaged_seconds).toBeGreaterThan(0);
    expect(j.sessions.by_channel.length).toBeGreaterThan(1);
    expect(j.entry_pages).toEqual(raw.entryPages);
    expect(j.exit_pages).toEqual(raw.exitPages);
    expect(j.events).toEqual(raw.events);
    expect(j.goals).toHaveLength(GOALS.length);
    expect(j.goals[0]).toHaveProperty("conversions_delta_pct");
    expect(Array.isArray(j.channels)).toBe(true);
    expect(j.summary).toHaveProperty("bounce_rate");
    expect(j.summary).toHaveProperty("visitors_delta_pct");
    expect(j).toHaveProperty("top_pages");
    expect(j).toHaveProperty("quality");
  });

  test("channels block (visitors per channel) is identical from rollups and raw", async () => {
    const o = { ...base, from: "2026-03-01", to: "2026-03-09", includeAll: true };
    // pageviews carry no channel in this fixture's DDL: the block must degrade to empty, equally
    const h = await computeBlock(db, o);
    const r = await computeBlock(db, { ...o, useRollup: false });
    expect(h.channels).toEqual(r.channels);
  });
});

describe("retention", () => {
  test("events: 90 days, rolled days only; sessions: 180 days, rolled days only", async () => {
    const now = new Date("2026-10-15T00:30:00Z");
    const old90 = "2026-06-01"; // > 90 days before now
    const old180 = "2026-03-01"; // > 180 days
    const recent = "2026-10-10";
    const ins = async (day: string) => {
      const r = await db.execute({
        sql: "INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at) VALUES (?, 'h', ?, ?)",
        args: [day, `${day} 10:00:00`, `${day} 10:00:00`],
      });
      await db.execute({
        sql: "INSERT INTO events (day, session_id, visitor_hash, name) VALUES (?, ?, 'h', 'clap')",
        args: [day, Number(r.lastInsertRowid)],
      });
    };
    for (const d of [old90, old180, recent, "2026-05-20"]) await ins(d);
    // roll up everything except 2026-05-20 (never rolled: must survive)
    for (const d of [old90, old180, recent]) await rollupDay(db, d);
    const res = await pruneRaw(db, now);
    expect(res.cleaned).toContain("events");
    const ev = (await db.execute("SELECT day FROM events ORDER BY day")).rows.map((r) => r.day);
    expect(ev).toEqual(["2026-05-20", recent]);
    const ss = (await db.execute("SELECT day FROM sessions ORDER BY day")).rows.map((r) => r.day);
    expect(ss).toEqual(["2026-05-20", old90, recent]);
  });
});

describe("migration (phase 2)", () => {
  test("is idempotent and creates the phase 2 tables, indexes and column", async () => {
    const m = createClient({ url: ":memory:" });
    await m.executeMultiple(PV_DDL);
    await migrateAnalyticsV2(m);
    const second = await migrateAnalyticsV2(m);
    expect(second.some((l) => l.startsWith("added pageviews.session_id"))).toBe(false);
    const names = (await m.execute("SELECT name FROM sqlite_master WHERE type IN ('table','index') ORDER BY name")).rows.map((r) => String(r.name));
    for (const n of [
      "sessions", "events", "daily_sessions", "daily_events", "daily_entry_exit", "daily_goals",
      "idx_sessions_visitor_seen", "idx_sessions_day", "idx_events_day_name",
    ]) expect(names).toContain(n);
    const cols = (await m.execute("PRAGMA table_info(pageviews)")).rows.map((r) => r.name);
    expect(cols).toContain("session_id");
    expect(await detectCaps(m)).toMatchObject({ sessions: true, events: true });
  });

  test("rollup degrades without the raw session tables", async () => {
    const m = createClient({ url: ":memory:" });
    await m.executeMultiple(PV_DDL);
    await m.execute("CREATE TABLE rollup_log (day TEXT PRIMARY KEY, computed_at TEXT NOT NULL, rows_in INTEGER NOT NULL DEFAULT 0)");
    await expect(rollupDay(m, "2026-03-01")).resolves.toMatchObject({ day: "2026-03-01" });
    expect((await computeSessions(m, { ...base, from: "2026-03-01", to: "2026-03-09", includeAll: false })).available).toBe(false);
  });
});
