import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../scripts/migrate-analytics-v2";

let db: Client;

vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

const rules = await import("~/pages/api/admin/bot-rules");
const preview = await import("~/pages/api/admin/bot-rules/preview");
const live = await import("~/pages/api/stats/live");

function req(
  method: string,
  body?: unknown,
  opts: { token?: string | null; origin?: string } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token !== null)
    headers.Authorization = `Bearer ${opts.token ?? "test-token"}`;
  if (opts.origin) headers.Origin = opts.origin;
  return new Request("https://example.com/api/admin/bot-rules", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const call = (h: unknown, r: Request) =>
  (h as (c: { request: Request }) => Promise<Response>)({ request: r });

async function insertPv(o: {
  pathname?: string;
  referrer?: string | null;
  human?: number;
  hash?: string;
  daysAgo?: number;
  bot_score?: number;
  createdAt?: string;
}) {
  await db.execute({
    sql: `INSERT INTO pageviews (page_id, hostname, pathname, referrer, visitor_hash, human, bot_score, created_at)
          VALUES (?, 'valerionarcisi.me', ?, ?, ?, ?, ?, COALESCE(?, datetime('now', ?)))`,
    args: [
      Math.random().toString(36).slice(2, 12),
      o.pathname ?? "/blog/x",
      o.referrer ?? null,
      o.hash ?? "h" + Math.random().toString(16).slice(2, 10),
      o.human ?? 0,
      o.bot_score ?? 0,
      o.createdAt ?? null,
      `-${o.daysAgo ?? 0} days`,
    ],
  });
}

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT, page_id TEXT NOT NULL, hostname TEXT NOT NULL,
      pathname TEXT NOT NULL, referrer TEXT, is_unique INTEGER NOT NULL DEFAULT 0,
      visitor_hash TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
  await migrateAnalyticsV2(db);
});

describe("auth", () => {
  test("401 without credentials on every method", async () => {
    for (const [h, m] of [
      [rules.GET, "GET"],
      [rules.POST, "POST"],
      [rules.PATCH, "PATCH"],
      [rules.DELETE, "DELETE"],
      [preview.POST, "POST"],
    ] as const) {
      const r = await call(
        h,
        req(m, m === "GET" ? undefined : {}, { token: null }),
      );
      expect(r.status).toBe(401);
    }
  });
});

describe("POST /api/admin/bot-rules", () => {
  test("creates and lists a rule; hash_today expires at the end of the UTC day", async () => {
    const r = await call(
      rules.POST,
      req("POST", {
        kind: "ua_contains",
        value: "HeadlessChrome",
        note: "crawler",
      }),
    );
    expect(r.status).toBe(201);
    const h = await call(
      rules.POST,
      req("POST", { kind: "hash_today", value: "ABCDEF0123456789" }),
    );
    const hb = await h.json();
    expect(hb.expires_at).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);

    const list = await (await call(rules.GET, req("GET"))).json();
    expect(list.rules).toHaveLength(2);
    expect(
      list.rules.find((x: { kind: string }) => x.kind === "ua_contains"),
    ).toMatchObject({
      value: "HeadlessChrome",
      note: "crawler",
      hits: 0,
      enabled: 1,
    });
  });

  test.each([
    [{ kind: "nope", value: "abcd" }],
    [{ kind: "ua_contains", value: "bot" }],
    [{ kind: "ua_contains", value: "" }],
    [{ kind: "path_prefix", value: "/" }],
    [{ kind: "path_prefix", value: "wp" }],
    [{ kind: "referrer_host", value: "valerionarcisi.me" }],
    [{ kind: "hash_today", value: "zz" }],
  ])("rejects %j with 400", async (body) => {
    expect((await call(rules.POST, req("POST", body))).status).toBe(400);
    expect(
      (await db.execute("SELECT COUNT(*) AS n FROM bot_rules")).rows[0].n,
    ).toBe(0);
  });

  test("duplicate -> 409", async () => {
    const b = { kind: "path_prefix", value: "/wp-admin" };
    expect((await call(rules.POST, req("POST", b))).status).toBe(201);
    expect(
      (await call(rules.POST, req("POST", { ...b, value: "/WP-ADMIN" })))
        .status,
    ).toBe(409);
  });
});

describe("PATCH / DELETE", () => {
  test("toggle enabled, 404 on unknown id, 400 on bad payload, delete", async () => {
    const created = await (
      await call(
        rules.POST,
        req("POST", { kind: "ua_contains", value: "scrapy" }),
      )
    ).json();
    expect(
      (
        await call(
          rules.PATCH,
          req("PATCH", { id: created.id, enabled: false }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await db.execute("SELECT enabled FROM bot_rules")).rows[0].enabled,
    ).toBe(0);
    expect(
      (await call(rules.PATCH, req("PATCH", { id: 999, enabled: true })))
        .status,
    ).toBe(404);
    expect(
      (
        await call(
          rules.PATCH,
          req("PATCH", { id: created.id, enabled: "yes" }),
        )
      ).status,
    ).toBe(400);
    expect((await call(rules.DELETE, req("DELETE", { id: "1" }))).status).toBe(
      400,
    );
    expect(
      (await call(rules.DELETE, req("DELETE", { id: created.id }))).status,
    ).toBe(200);
    expect(
      (await call(rules.DELETE, req("DELETE", { id: created.id }))).status,
    ).toBe(404);
  });
});

describe("POST /api/admin/bot-rules/preview", () => {
  test("counts last-7-days pageviews hit by the rule and how many carry human=1", async () => {
    await insertPv({ pathname: "/wp-admin/x", human: 0 });
    await insertPv({ pathname: "/WP-admin", human: 1 });
    await insertPv({ pathname: "/wp-admin/y", human: 0, daysAgo: 10 }); // too old
    await insertPv({ pathname: "/blog/other", human: 1 });
    const r = await call(
      preview.POST,
      req("POST", { kind: "path_prefix", value: "/wp-admin" }),
    );
    expect(await r.json()).toMatchObject({
      supported: true,
      excluded: 2,
      human: 1,
    });
  });

  test("LIKE wildcards in the value are literal", async () => {
    await insertPv({ pathname: "/a_b/1" });
    await insertPv({ pathname: "/aXb/1" });
    await insertPv({ pathname: "/a%b/1" });
    const one = await call(
      preview.POST,
      req("POST", { kind: "path_prefix", value: "/a_b" }),
    );
    expect((await one.json()).excluded).toBe(1);
    const two = await call(
      preview.POST,
      req("POST", { kind: "path_prefix", value: "/a%" }),
    );
    expect((await two.json()).excluded).toBe(1);
  });

  test("referrer_host and hash_today; ua_contains is unsupported", async () => {
    await insertPv({ referrer: "Spam.Example.com", human: 1 });
    await insertPv({ referrer: "spam.example.com" });
    await insertPv({ referrer: "ok.com", hash: "abcdef0123456789" });
    const ref = await call(
      preview.POST,
      req("POST", { kind: "referrer_host", value: "spam.example.com" }),
    );
    expect(await ref.json()).toMatchObject({ excluded: 2, human: 1 });
    const hash = await call(
      preview.POST,
      req("POST", { kind: "hash_today", value: "abcdef0123456789" }),
    );
    expect((await hash.json()).excluded).toBe(1);
    const ua = await call(
      preview.POST,
      req("POST", { kind: "ua_contains", value: "headless" }),
    );
    expect(await ua.json()).toMatchObject({ supported: false, excluded: null });
  });

  test("validates like create", async () => {
    expect(
      (
        await call(
          preview.POST,
          req("POST", { kind: "path_prefix", value: "/" }),
        )
      ).status,
    ).toBe(400);
  });
});

describe("GET /api/stats/live", () => {
  async function seedVisits() {
    await insertPv({ hash: "human1", human: 1 });
    await insertPv({ hash: "unver1", human: 0 });
    await insertPv({ hash: "bot1", human: 0, bot_score: 6 });
    await insertPv({ hash: "legacy1", human: 1 });
    await db.execute("INSERT INTO bot_hashes (hash) VALUES ('legacy1')");
  }
  const addSession = (hash: string, o: { human?: number; bot_score?: number; seen?: string } = {}) =>
    db.execute({
      sql: `INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, exit_path, human, bot_score)
            VALUES (date('now'), ?, datetime('now'), COALESCE(?, datetime('now')), '/x', '/x', ?, ?)`,
      args: [hash, o.seen ?? null, o.human ?? 0, o.bot_score ?? 0],
    });

  test("counts human and unverified, not bots (fallback: pageviews, no sessions table)", async () => {
    await seedVisits();
    await db.execute("DROP TABLE sessions");
    const r = await call(live.GET, req("GET"));
    expect(await r.json()).toEqual({ active: 2, pageviews5m: 2, active_sessions: [] });
  });

  test("with the sessions table: sessions seen in the last 5 minutes, bots excluded", async () => {
    await seedVisits();
    await addSession("human1", { human: 1 });
    await addSession("unver1");
    await addSession("bot1", { bot_score: 6 });
    await addSession("legacy1", { human: 1 });
    await addSession("old1", { human: 1, seen: "2000-01-01 00:00:00" });
    const r = await call(live.GET, req("GET"));
    const body = await r.json();
    expect(body).toMatchObject({ active: 2, pageviews5m: 2 });
    expect(body.active_sessions.map((a: { user: string }) => a.user).sort()).toEqual(["human1", "unver1"]);
  });
});
