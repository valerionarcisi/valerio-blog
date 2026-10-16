import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../scripts/migrate-analytics-v2";
import {
  backfillLegacyHuman,
  detectCutover,
  parseCutover,
} from "./analytics-legacy-human";

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
  CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')));
`;

let db: Client;

async function add(
  at: string,
  o: { hash?: string; human?: number; bot_score?: number } = {},
) {
  await db.execute({
    sql: `INSERT INTO pageviews (page_id, hostname, pathname, is_unique, visitor_hash, human, bot_score, created_at)
          VALUES (?, 'valerionarcisi.me', '/blog', 1, ?, ?, ?, ?)`,
    args: [`p${Math.random()}`, o.hash ?? `h${Math.random()}`, o.human ?? 0, o.bot_score ?? 0, at],
  });
}
const humans = async () =>
  Number((await db.execute("SELECT COUNT(*) n FROM pageviews WHERE human = 1")).rows[0].n);

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(OLD_SCHEMA);
  await migrateAnalyticsV2(db); // existing rows get human = 0, exactly like production after the migration
});

describe("parseCutover", () => {
  test("accepts the documented formats and always returns UTC database format", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    expect(parseCutover("2026-10-15", now)).toBe("2026-10-15 00:00:00");
    expect(parseCutover("2026-10-15T14:46", now)).toBe("2026-10-15 14:46:00");
    expect(parseCutover("2026-10-15T14:46:30Z", now)).toBe("2026-10-15 14:46:30");
    expect(parseCutover("2026-10-15 14:46:30", now)).toBe("2026-10-15 14:46:30");
  });
  test("rejects garbage and the future", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    expect(() => parseCutover("yesterday", now)).toThrow();
    expect(() => parseCutover("2026-13-45", now)).toThrow();
    expect(() => parseCutover("2026-10-21", now)).toThrow(/future/);
  });
});

describe("detectCutover", () => {
  test("is the first real engage signal, or null when there is none", async () => {
    await add("2026-10-14 10:00:00");
    expect(await detectCutover(db)).toBeNull();
    await add("2026-10-15 15:00:00", { human: 1 });
    await add("2026-10-15 14:50:00", { human: 1 });
    expect(await detectCutover(db)).toBe("2026-10-15 14:50:00");
  });
});

describe("backfillLegacyHuman", () => {
  test("dry run reports the plan and changes nothing", async () => {
    await add("2026-10-12 09:00:00");
    await add("2026-10-13 09:00:00");
    await add("2026-10-13 10:00:00");
    const plan = await backfillLegacyHuman(db, { before: "2026-10-15 14:50:00", apply: false });
    expect(plan).toMatchObject({ rows: 3, applied: false, updated: 0, firstDay: "2026-10-12", lastDay: "2026-10-13" });
    expect(plan.perDay).toEqual([
      { day: "2026-10-12", rows: 1 },
      { day: "2026-10-13", rows: 2 },
    ]);
    expect(await humans()).toBe(0);
  });

  test("apply marks only rows before the cutover", async () => {
    await add("2026-10-14 09:00:00");
    await add("2026-10-15 14:49:59");
    await add("2026-10-15 14:50:00"); // at the cutover: stays as recorded
    await add("2026-10-16 09:00:00");
    const plan = await backfillLegacyHuman(db, { before: "2026-10-15 14:50:00", apply: true });
    expect(plan).toMatchObject({ rows: 2, applied: true, updated: 2 });
    const left = await db.execute("SELECT created_at FROM pageviews WHERE human = 0 ORDER BY created_at");
    expect(left.rows.map((r) => r.created_at)).toEqual(["2026-10-15 14:50:00", "2026-10-16 09:00:00"]);
  });

  test("bots stay out: scored bots and hashes flagged by hand", async () => {
    await add("2026-10-13 09:00:00", { hash: "scored", bot_score: 6 });
    await add("2026-10-13 09:00:00", { hash: "flagged" });
    await db.execute("INSERT INTO bot_hashes (hash) VALUES ('flagged')");
    await add("2026-10-13 09:00:00", { hash: "normal" });
    await add("2026-10-13 09:00:00", { hash: "low-score", bot_score: 3 });
    const plan = await backfillLegacyHuman(db, { before: "2026-10-15 00:00:00", apply: true });
    expect(plan).toMatchObject({ rows: 2, keptAsBot: 2, updated: 2 });
    const marked = await db.execute("SELECT visitor_hash FROM pageviews WHERE human = 1 ORDER BY visitor_hash");
    expect(marked.rows.map((r) => r.visitor_hash)).toEqual(["low-score", "normal"]);
  });

  test("rows already human are untouched and a second run changes nothing", async () => {
    await add("2026-10-13 09:00:00", { human: 1 });
    await add("2026-10-13 10:00:00");
    const first = await backfillLegacyHuman(db, { before: "2026-10-15 00:00:00", apply: true });
    expect(first.updated).toBe(1);
    const second = await backfillLegacyHuman(db, { before: "2026-10-15 00:00:00", apply: true });
    expect(second).toMatchObject({ rows: 0, updated: 0, applied: false });
    expect(await humans()).toBe(2);
  });

  test("a cutover that was not produced by parseCutover is refused", async () => {
    await expect(backfillLegacyHuman(db, { before: "2026-10-15", apply: true })).rejects.toThrow();
  });

  test("an old database without human/bot_score columns is not touched by mistake", async () => {
    const legacy = createClient({ url: ":memory:" });
    await legacy.executeMultiple(OLD_SCHEMA); // migration NOT applied
    await expect(
      backfillLegacyHuman(legacy, { before: "2026-10-15 00:00:00", apply: true }),
    ).rejects.toThrow();
  });
});
