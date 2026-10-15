import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;
let envMap: Record<string, string> = {};
vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({ env: (k: string) => envMap[k] ?? "" }));

const {
  DASHBOARD_URL,
  buildReportData,
  formatReport,
  isReportDisabled,
  lastFullWeek,
  resolveTarget,
  runWeeklyReport,
  sendTelegramText,
} = await import("~/lib/analytics-report");
const { migrateAnalyticsV2 } = await import("../../scripts/migrate-analytics-v2");
const { POST } = await import("~/pages/api/admin/analytics-report");

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

// Monday 07:00 Rome (CEST)
const NOW = new Date("2026-10-19T05:00:00Z");
let seq = 0;
async function visit(day: string, over: Record<string, string | number | null> = {}) {
  const r = {
    page_id: "p" + ++seq,
    hostname: "valerionarcisi.me",
    pathname: "/blog/a",
    is_unique: 1,
    visitor_hash: "h" + seq,
    device_type: "mobile",
    channel: "search",
    human: 1,
    bot_score: 0,
    created_at: `${day} 10:00:00`,
    ...over,
  };
  const cols = Object.keys(r);
  await db.execute({
    sql: `INSERT INTO pageviews (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    args: cols.map((c) => (r as Record<string, string | number | null>)[c]),
  });
}
const many = async (n: number, day: string, over = {}) => {
  for (let i = 0; i < n; i++) await visit(day, over);
};

beforeEach(async () => {
  seq = 0;
  envMap = {};
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(OLD);
  await migrateAnalyticsV2(db);
});

describe("lastFullWeek (Mon-Sun, Europe/Rome)", () => {
  test.each([
    ["2026-10-19T05:00:00Z", "2026-10-12", "2026-10-18"], // Monday morning
    ["2026-10-21T12:00:00Z", "2026-10-12", "2026-10-18"], // Wednesday
    ["2026-10-25T10:00:00Z", "2026-10-12", "2026-10-18"], // Sunday: week not finished
    ["2026-10-25T23:30:00Z", "2026-10-19", "2026-10-25"], // Sunday 23:30 UTC = Monday 00:30 Rome (CET, DST ended that day)
    ["2026-01-05T06:00:00Z", "2025-12-29", "2026-01-04"], // year boundary
  ])("%s -> %s..%s", (now, from, to) => {
    const w = lastFullWeek(new Date(now));
    expect(w.from).toBe(from);
    expect(w.to).toBe(to);
    expect(new Date(w.from + "T00:00:00Z").getUTCDay()).toBe(1);
  });
  test("previous week is the 7 days before", () => {
    expect(lastFullWeek(NOW)).toEqual({
      from: "2026-10-12",
      to: "2026-10-18",
      prevFrom: "2026-10-05",
      prevTo: "2026-10-11",
    });
  });
});

describe("buildReportData / formatReport", () => {
  async function seed() {
    await many(10, "2026-10-13", { pathname: "/blog/uno", channel: "search" });
    await many(4, "2026-10-14", { pathname: "/blog/uno", channel: "social" });
    await many(6, "2026-10-15", { pathname: "/en/blog/due", channel: "search" });
    await many(2, "2026-10-15", { pathname: "/", channel: "direct" });
    await many(3, "2026-10-16", { pathname: "/blog/tre", channel: "direct", human: 0 }); // unverified
    await many(5, "2026-10-07", { pathname: "/blog/uno" }); // week before
    await many(2, "2026-10-08", { pathname: "/blog/uno", bot_score: 9 }); // bot: never counted
  }

  test("numbers, deltas, quality, top posts and channels", async () => {
    await seed();
    const d = await buildReportData(db, NOW);
    expect(d.week.from).toBe("2026-10-12");
    expect(d.visitors).toBe(22);
    expect(d.prevVisitors).toBe(5);
    expect(d.verdicts).toEqual({ human: 22, unverified: 3 });
    expect(d.topPosts).toEqual([
      { pathname: "/blog/uno", visitors: 14 },
      { pathname: "/en/blog/due", visitors: 6 },
    ]);
    expect(d.channels[0]).toEqual({ channel: "search", visitors: 16 });

    const text = formatReport(d);
    expect(text).toContain("Analytics - settimana 12-18 ottobre 2026");
    expect(text).toContain("Visitatori: 22 (+340,0% vs settimana prima)");
    expect(text).toContain("Pageview: 22 (+340,0%)");
    expect(text).toContain("22 visite umane verificate, 3 non verificate (12,0%");
    expect(text).toContain("1. /blog/uno - 14 visitatori");
    expect(text).toContain("2. /en/blog/due - 6 visitatori");
    expect(text).toContain("Canali: search 16, social 4, direct 2");
    expect(text.trim().endsWith(DASHBOARD_URL)).toBe(true);
    expect(text).not.toContain("token");
    expect(text).not.toMatch(/LCP/); // no vitals data
  });

  test("optional lines: goals and mobile LCP when available", async () => {
    await seed();
    await db.execute(
      "UPDATE pageviews SET lcp_ms = 2100 WHERE device_type = 'mobile' AND human = 1 AND bot_score = 0",
    );
    const d = await buildReportData(db, NOW);
    expect(d.lcpMobile).toMatchObject({ p75: 2100 });
    const text = formatReport({ ...d, goals: [{ label: "Contatto", conversions: 3, rate: 1.5 }] });
    expect(text).toContain("LCP mobile (p75): 2,1 s - buono");
    expect(text).toContain("Obiettivi: Contatto 3 (1,5%)");
  });

  test("empty week: still a valid message, no lists", async () => {
    const text = formatReport(await buildReportData(db, NOW));
    expect(text).toContain("Visitatori: 0 (=");
    expect(text).not.toContain("Top post");
    expect(text).not.toContain("Canali");
    expect(text).toContain("nessuna visita nel periodo");
  });

  test("month-crossing week label", async () => {
    const d = await buildReportData(db, new Date("2026-11-02T06:00:00Z"));
    expect(formatReport(d)).toContain("settimana 26 ottobre-1 novembre 2026");
  });

  test("plain text: hostile pathnames are emitted verbatim, no markup is interpreted", () => {
    const text = formatReport({
      week: lastFullWeek(NOW),
      visitors: 1,
      pageviews: 1,
      prevVisitors: 1,
      prevPageviews: 1,
      verdicts: null,
      topPosts: [{ pathname: "/blog/*_[x](http://evil)", visitors: 1 }],
      channels: [],
      goals: [],
      lcpMobile: null,
    });
    expect(text).toContain("/blog/*_[x](http://evil)");
  });
});

describe("delivery helpers", () => {
  test("resolveTarget: explicit chat id wins, whitelist fallback, none", () => {
    const get = (m: Record<string, string>) => (k: string) => m[k];
    expect(resolveTarget(get({ TELEGRAM_BOT_TOKEN: "t", ANALYTICS_REPORT_CHAT_ID: "42", TELEGRAM_USER_ID_WHITELIST: "1,2" }))).toEqual({ token: "t", chatId: "42" });
    expect(resolveTarget(get({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_USER_ID_WHITELIST: " 7 , 8" }))).toEqual({ token: "t", chatId: "7" });
    expect(resolveTarget(get({ TELEGRAM_BOT_TOKEN: "t" }))).toBeNull();
    expect(resolveTarget(get({ ANALYTICS_REPORT_CHAT_ID: "42" }))).toBeNull();
    expect(resolveTarget(get({}))).toBeNull();
  });
  test("isReportDisabled", () => {
    expect(isReportDisabled((k) => (k === "ANALYTICS_REPORT_DISABLED" ? "1" : undefined))).toBe(true);
    expect(isReportDisabled((k) => (k === "ANALYTICS_REPORT_DISABLED" ? "true" : undefined))).toBe(true);
    expect(isReportDisabled((k) => (k === "ANALYTICS_REPORT_DISABLED" ? "0" : undefined))).toBe(false);
    expect(isReportDisabled(() => undefined)).toBe(false);
  });
  test("sendTelegramText posts plain text with an 8 s abort signal", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await sendTelegramText({ token: "TKN", chatId: "42" }, "ciao", f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/botTKN/sendMessage");
    expect(JSON.parse(init.body as string)).toEqual({ chat_id: "42", text: "ciao", disable_web_page_preview: true });
    expect((init as { parse_mode?: string }).parse_mode).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  test("errors never leak the bot token", async () => {
    const boom = vi.fn(async () => {
      throw new Error("fetch failed https://api.telegram.org/botSECRET/sendMessage");
    });
    await expect(sendTelegramText({ token: "SECRET", chatId: "1" }, "x", boom as unknown as typeof fetch)).rejects.toThrow(
      /^Telegram request failed$/,
    );
    const bad = vi.fn(async () => new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 }));
    await expect(sendTelegramText({ token: "SECRET", chatId: "1" }, "x", bad as unknown as typeof fetch)).rejects.toThrow("chat not found");
  });
});

describe("runWeeklyReport", () => {
  const ok = () => vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const env = { TELEGRAM_BOT_TOKEN: "t", ANALYTICS_REPORT_CHAT_ID: "42" } as Record<string, string>;

  test("dry run returns the text and never calls fetch", async () => {
    const f = ok();
    const r = await runWeeklyReport(db, (k) => env[k], { send: false, now: NOW, fetchImpl: f });
    expect(r).toMatchObject({ sent: false, dryRun: true });
    expect(r.text).toContain("Analytics - settimana");
    expect(f).not.toHaveBeenCalled();
  });
  test("send delivers once", async () => {
    const f = ok();
    const r = await runWeeklyReport(db, (k) => env[k], { send: true, now: NOW, fetchImpl: f });
    expect(r).toMatchObject({ sent: true, dryRun: false });
    expect(f).toHaveBeenCalledTimes(1);
  });
  test("opt-out and missing target skip without calling fetch", async () => {
    const f = ok();
    const off = await runWeeklyReport(db, (k) => ({ ...env, ANALYTICS_REPORT_DISABLED: "1" })[k], { send: true, now: NOW, fetchImpl: f });
    expect(off).toMatchObject({ sent: false, skipped: "disabled" });
    const none = await runWeeklyReport(db, () => undefined, { send: true, now: NOW, fetchImpl: f });
    expect(none).toMatchObject({ sent: false, skipped: "no_target" });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/analytics-report", () => {
  const call = (body: unknown, headers: Record<string, string> = { authorization: "Bearer test-token" }, raw?: string) =>
    POST({
      request: new Request("https://valerionarcisi.me/api/admin/analytics-report", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      }),
    } as never);
  const fetchSpy = vi.fn();

  beforeEach(() => {
    envMap = { ADMIN_TOKEN: "test-token", TELEGRAM_BOT_TOKEN: "t", ANALYTICS_REPORT_CHAT_ID: "42" };
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  test("401 without credentials", async () => {
    expect((await call({}, {})).status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  test("default (no body, {} or send:false) is a dry run", async () => {
    for (const body of [undefined, {}, { send: false }]) {
      const res = await call(body);
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(j).toMatchObject({ sent: false, dryRun: true });
      expect(j.text).toContain("Analytics - settimana");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  test("send:true delivers via Telegram", async () => {
    const res = await call({ send: true });
    expect(await res.json()).toMatchObject({ sent: true, dryRun: false });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("api.telegram.org/bott/sendMessage");
  });
  test("send:true with ANALYTICS_REPORT_DISABLED=1 is skipped", async () => {
    envMap.ANALYTICS_REPORT_DISABLED = "1";
    expect(await (await call({ send: true })).json()).toMatchObject({ sent: false, skipped: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  test("400 for invalid JSON or non-boolean send", async () => {
    expect((await call(undefined, undefined, "{nope")).status).toBe(400);
    expect((await call({ send: "yes" })).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  test("Telegram failure -> 500 without leaking details", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: false, description: "boom" }), { status: 400 }));
    const res = await call({ send: true });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
