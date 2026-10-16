import { createClient, type Client, type InStatement } from "@libsql/client";
import { migrateAnalyticsV2 } from "./migrate-analytics-v2";
import { rollupRange } from "../src/lib/analytics-rollup";

// Fills a LOCAL sqlite file with ~30 days of synthetic traffic so the admin
// analytics dashboard can be reviewed without touching production data.
//
//   TURSO_DATABASE_URL=file:/tmp/analytics-demo.db TURSO_AUTH_TOKEN=x npx -y tsx scripts/seed-analytics-demo.ts
//
// HARD SAFETY: it refuses to run unless TURSO_DATABASE_URL starts with "file:",
// because it WIPES every analytics table before inserting. The auth token is never read.
// Deterministic (seeded PRNG): the same run gives the same dataset, shifted to "now".

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  console.error(
    `Refusing to run: TURSO_DATABASE_URL must start with "file:" (got "${url.replace(/^(.{12}).*/, "$1…")}"). ` +
      "This script wipes analytics tables and is for local demo databases only.",
  );
  process.exit(1);
}

const DAYS = 30;
const WIPE = [
  "pageviews", "sessions", "events", "bot_hashes", "bot_rules", "daily_visitors", "analytics_salts",
  "daily_stats", "daily_pages", "daily_dims", "daily_sessions", "daily_events", "daily_entry_exit",
  "daily_goals", "daily_vitals", "rollup_log",
];

const BASE_DDL = `
  CREATE TABLE IF NOT EXISTS pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, page_id TEXT NOT NULL, hostname TEXT NOT NULL, pathname TEXT NOT NULL,
    referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
    is_unique INTEGER NOT NULL DEFAULT 0, visitor_hash TEXT, time_on_page INTEGER, scroll_depth INTEGER,
    browser TEXT, os TEXT, device_type TEXT, screen_width INTEGER, screen_height INTEGER,
    viewport_width INTEGER, viewport_height INTEGER, language TEXT, country TEXT, channel TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bot_hashes (hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE INDEX IF NOT EXISTS idx_pv_created ON pageviews(created_at);
`;

// mulberry32: tiny seeded PRNG
let seed = 20261016;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
function pick<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}
const hex = (n: number) => Array.from({ length: n }, () => int(0, 15).toString(16)).join("");
const sqlTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

const COUNTRIES: Array<[string, number]> = [
  ["IT", 46], ["US", 12], ["GB", 7], ["DE", 6], ["FR", 5], ["ES", 4], ["NL", 3], ["CH", 3], ["BR", 3],
  ["JP", 2], ["CA", 2], ["AU", 1], ["SE", 1], ["PL", 1], ["PT", 1], ["IN", 1], ["MX", 1], ["AR", 1],
];
const CLIENTS: Array<[{ device: string; browser: string; os: string; w: number; h: number }, number]> = [
  [{ device: "mobile", browser: "Safari", os: "iOS", w: 390, h: 844 }, 28],
  [{ device: "mobile", browser: "Chrome", os: "Android", w: 412, h: 915 }, 20],
  [{ device: "desktop", browser: "Chrome", os: "macOS", w: 1440, h: 900 }, 16],
  [{ device: "desktop", browser: "Chrome", os: "Windows", w: 1920, h: 1080 }, 12],
  [{ device: "desktop", browser: "Firefox", os: "Linux", w: 1600, h: 900 }, 5],
  [{ device: "desktop", browser: "Safari", os: "macOS", w: 1512, h: 982 }, 6],
  [{ device: "desktop", browser: "Edge", os: "Windows", w: 1536, h: 864 }, 4],
  [{ device: "tablet", browser: "Safari", os: "iPadOS", w: 820, h: 1180 }, 4],
];
interface Source { channel: string; referrer: string | null; utm?: [string, string, string] }
const SOURCES: Array<[Source, number]> = [
  [{ channel: "direct", referrer: null }, 28],
  [{ channel: "search", referrer: "google.com" }, 26],
  [{ channel: "search", referrer: "duckduckgo.com" }, 3],
  [{ channel: "social", referrer: "instagram.com" }, 8],
  [{ channel: "social", referrer: "t.co" }, 5],
  [{ channel: "social", referrer: "linkedin.com" }, 4],
  [{ channel: "ai", referrer: "chatgpt.com" }, 5],
  [{ channel: "ai", referrer: "perplexity.ai" }, 2],
  [{ channel: "referral", referrer: "news.ycombinator.com" }, 5],
  [{ channel: "referral", referrer: "letterboxd.com" }, 5],
  [{ channel: "email", referrer: "mail.google.com" }, 2],
  [{ channel: "campaign", referrer: null, utm: ["newsletter", "email", "autunno-2026"] }, 4],
  [{ channel: "campaign", referrer: "instagram.com", utm: ["instagram", "social", "festival-roma"] }, 3],
];
const PAGES: Array<[string, number]> = [
  ["/", 14], ["/blog/21-giorni-senza-alcol", 10], ["/blog/come-si-scrive-un-corto", 8], ["/blog/appunti-di-montaggio", 6],
  ["/blog/sceneggiatura-e-silenzio", 6], ["/blog/dove-vanno-i-film-che-non-vedi", 5], ["/films/caramella", 8], ["/films/il-vento-dentro", 5],
  ["/visti", 6], ["/ascolti", 4], ["/who-i-am", 5], ["/contatti", 3], ["/blog", 7], ["/en/blog/21-days-without-alcohol", 3],
];
const BOT_UAS = [
  { browser: "HeadlessChrome", os: "Linux" }, { browser: "Chrome", os: "Linux" }, { browser: "Python-requests", os: "Linux" },
];
const LANG_BY_COUNTRY: Record<string, string> = { IT: "it", US: "en", GB: "en", DE: "de", FR: "fr", ES: "es", NL: "nl", CH: "de", BR: "pt", JP: "ja", CA: "en", AU: "en", SE: "sv", PL: "pl", PT: "pt", IN: "en", MX: "es", AR: "es" };

interface Pv {
  page_id: string; path: string; at: Date; time: number; scroll: number; human: number; unique: number;
  lcp: number | null; inp: number | null; cls: number | null;
}
const rows: { pv: InStatement[]; sessions: Array<{ stmt: InStatement; events: InStatement[]; pvs: Pv[] }> } = { pv: [], sessions: [] };

const db: Client = createClient({ url });
await db.executeMultiple(BASE_DDL);
console.log((await migrateAnalyticsV2(db)).join("\n") || "schema already up to date");
for (const t of WIPE) await db.execute(`DELETE FROM ${t}`);
await db.execute("DELETE FROM sqlite_sequence WHERE name IN ('pageviews','sessions','events','bot_rules')").catch(() => undefined);

const now = new Date();
let sessionCount = 0;
const verdictTally = { human: 0, unverified: 0, bot: 0 };

async function addSession(start: Date, kind: "human" | "unverified" | "bot", opts: { lastSeen?: Date; pages?: number } = {}) {
  const country = kind === "bot" ? pick([["US", 4], ["DE", 2], ["NL", 1], ["SG", 1]]) : pick(COUNTRIES);
  const client = kind === "bot" ? { ...pick(BOT_UAS.map((b) => [b, 1] as [typeof b, number])), device: "desktop", w: 1280, h: 720 } : pick(CLIENTS);
  const src = kind === "bot" ? pick<Source>([[{ channel: "direct", referrer: null }, 3], [{ channel: "referral", referrer: "free-seo-traffic.example" }, 2]]) : pick(SOURCES);
  const hash = hex(16);
  const pageCount = opts.pages ?? (kind === "bot" ? int(1, 6) : pick([[1, 38], [2, 26], [3, 16], [4, 10], [5, 6], [6, 4]]));
  const botScore = kind === "bot" ? int(5, 9) : kind === "unverified" ? int(0, 3) : 0;
  const lang = kind === "bot" ? "en" : (LANG_BY_COUNTRY[country] ?? "en");

  const pvs: Pv[] = [];
  let at = start;
  for (let i = 0; i < pageCount; i++) {
    const engaged = kind === "human" && rnd() < 0.6;
    const time = kind === "bot" ? int(0, 2) : engaged ? int(8, 240) : int(0, 9);
    const path = kind === "bot" && rnd() < 0.5 ? `/blog/${pick([["a", 1], ["b", 1], ["c", 1]])}-${int(1, 30)}` : pick(PAGES);
    const withVitals = kind !== "bot" && rnd() < 0.4;
    pvs.push({
      page_id: hex(24), path, at, time,
      scroll: kind === "bot" ? 0 : engaged ? int(20, 100) : int(0, 15),
      human: kind === "human" && (i > 0 || engaged) ? 1 : 0,
      unique: i === 0 ? 1 : 0,
      lcp: withVitals ? Math.round((client.device === "mobile" ? 2600 : 1700) * (0.5 + rnd())) : null,
      inp: withVitals && rnd() < 0.7 ? int(60, 420) : null,
      cls: withVitals ? Math.round(rnd() * rnd() * 300) : null,
    });
    at = new Date(at.getTime() + (time + int(5, 40)) * 1000);
  }
  const end = new Date(Math.min(at.getTime(), now.getTime()));
  const lastSeen = opts.lastSeen ?? end;
  const sessionHuman = pvs.some((p) => p.human) ? 1 : 0;
  const engagedSeconds = pvs.reduce((s, p) => s + p.time, 0);
  const startStr = sqlTime(start);
  const day = startStr.slice(0, 10);

  const events: InStatement[] = [];
  if (kind === "human") {
    const ev = (name: string, p: Pv, prop: string | null, delay: number) =>
      events.push({ sql: "INSERT INTO events (created_at, day, visitor_hash, name, path, prop, page_id, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [sqlTime(new Date(p.at.getTime() + delay * 1000)), day, hash, name, p.path, prop, p.page_id, 0] });
    for (const p of pvs) {
      if (p.path.startsWith("/blog/") && p.scroll >= 75) ev("scroll_75", p, null, p.time);
      if (p.path.startsWith("/blog/") && p.scroll >= 99) ev("scroll_100", p, null, p.time);
      if (p.path.startsWith("/blog/") && rnd() < 0.07) ev("clap", p, String(int(1, 8)), 20);
      if (rnd() < 0.04) ev("outbound_click", p, pick([["letterboxd.com", 1], ["github.com", 1], ["youtube.com", 1]]), 12);
      if (rnd() < 0.02) ev("comment_submit", p, null, 60);
      if (p.path === "/contatti" && rnd() < 0.2) ev("contact_submit", p, null, 45);
      if (rnd() < 0.015) ev("share", p, pick([["whatsapp", 2], ["linkedin", 1]]), 15);
    }
  }

  const sessionHash = hash;
  const stmt: InStatement = {
    sql: `INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path, pageviews, engaged_seconds,
                                channel, referrer, country, device_type, human, bot_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [day, sessionHash, startStr, sqlTime(lastSeen), pvs[0].path, pvs[pvs.length - 1].path, pvs.length, engagedSeconds,
      src.channel, src.referrer, country, client.device, sessionHuman, botScore],
  };
  rows.sessions.push({ stmt, events, pvs });
  sessionCount++;
  verdictTally[kind]++;

  // pageviews are queued with a placeholder session id, resolved right after the session insert
  for (const p of pvs) {
    rows.pv.push({
      sql: `INSERT INTO pageviews (page_id, hostname, pathname, referrer, utm_source, utm_medium, utm_campaign, is_unique, visitor_hash,
                                   time_on_page, scroll_depth, browser, os, device_type, screen_width, screen_height, viewport_width,
                                   viewport_height, language, country, channel, human, bot_score, session_id, lcp_ms, cls_milli, inp_ms, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [p.page_id, "valerionarcisi.me", p.path, src.referrer, src.utm?.[0] ?? null, src.utm?.[1] ?? null, src.utm?.[2] ?? null,
        p.unique, sessionHash, p.time, p.scroll, client.browser, client.os, client.device, client.w, client.h, client.w, client.h - 80,
        lang, country, src.channel, p.human, botScore, 0, p.lcp, p.cls, p.inp, sqlTime(p.at)],
    });
  }
}

// ~30 days of traffic: weekday/weekend rhythm, gentle upward trend, evening peak.
for (let back = DAYS; back >= 0; back--) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
  const weekday = dayStart.getUTCDay();
  const base = (weekday === 0 || weekday === 6 ? 38 : 52) * (0.8 + ((DAYS - back) / DAYS) * 0.5);
  const n = Math.round(base * (0.85 + rnd() * 0.3));
  for (let i = 0; i < n; i++) {
    const hour = pick<number>([[8, 4], [9, 6], [10, 6], [12, 7], [13, 6], [17, 6], [19, 9], [21, 12], [22, 8], [23, 4], [15, 5], [11, 5], [14, 5], [20, 10]]);
    const start = new Date(dayStart.getTime() + hour * 3600_000 + int(0, 3599) * 1000);
    if (start.getTime() > now.getTime() - 6 * 60_000) continue; // the live window is seeded below
    const r = rnd();
    await addSession(start, r < 0.62 ? "human" : r < 0.88 ? "unverified" : "bot");
  }
}
// Realtime: a handful of sessions seen in the last minutes (2 bots excluded from the live list).
for (const [mins, kind, pages] of [[0.4, "human", 3], [1.2, "human", 2], [2, "unverified", 1], [2.5, "human", 4], [3.2, "unverified", 2], [4, "human", 1], [1.5, "bot", 3], [3, "bot", 2]] as const) {
  const lastSeen = new Date(now.getTime() - mins * 60_000);
  const started = new Date(lastSeen.getTime() - int(30, 240) * 1000);
  await addSession(started, kind, { lastSeen, pages });
}

// Insert in order; resolve session ids for pageviews and events.
let pvIndex = 0;
for (const s of rows.sessions) {
  const res = await db.execute(s.stmt);
  const id = Number(res.lastInsertRowid);
  const batch: InStatement[] = [];
  for (let i = 0; i < s.pvs.length; i++) {
    const stmt = rows.pv[pvIndex++];
    (stmt as { args: unknown[] }).args[23] = id;
    batch.push(stmt);
  }
  for (const e of s.events) {
    (e as { args: unknown[] }).args[7] = id;
    batch.push(e);
  }
  await db.batch(batch, "write");
}

await db.execute("INSERT OR IGNORE INTO daily_visitors (day, visitor_hash) SELECT date(created_at), visitor_hash FROM pageviews WHERE is_unique = 1");

await db.batch(
  [
    { sql: "INSERT INTO bot_rules (kind, value, note, hits) VALUES ('ua_contains', 'HeadlessChrome', 'crawler headless', 214)", args: [] },
    { sql: "INSERT INTO bot_rules (kind, value, note, hits) VALUES ('referrer_host', 'free-seo-traffic.example', 'spam referrer', 87)", args: [] },
    { sql: "INSERT INTO bot_rules (kind, value, note, enabled, hits) VALUES ('path_prefix', '/wp-', 'scanner', 0, 12)", args: [] },
  ],
  "write",
);

// Closed days read from the rollups, today from raw: exercises the hybrid path like production.
const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
const from = new Date(now.getTime() - DAYS * 86_400_000).toISOString().slice(0, 10);
await rollupRange(db, from, yesterday);

console.log(`Seeded ${sessionCount} sessions (${verdictTally.human} human, ${verdictTally.unverified} unverified, ${verdictTally.bot} bot) into ${url}`);
db.close();
