import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../../scripts/migrate-analytics-v2";
import { invalidateRulesCache } from "~/lib/bot-rules";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

vi.mock("~/lib/env", () => ({
  env: () => "",
}));

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
    headers?: Record<string, string>;
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
    ...opts.headers,
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

const beacon = (t: number, s: number, over: Record<string, unknown> = {}) => ({
  type: "beacon",
  page_id: PAGE_ID,
  hostname: "valerionarcisi.me",
  time_on_page: t,
  scroll_depth: s,
  ...over,
});

async function rows() {
  return (await db.execute("SELECT * FROM pageviews ORDER BY id")).rows;
}

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(OLD_SCHEMA);
  await migrateAnalyticsV2(db);
  invalidateRulesCache();
});

describe("POST /api/e - pageview", () => {
  test("stores a validated, normalised pageview with channel and hashed visitor", async () => {
    const res = await call(
      pageview({ utm_source: "Newsletter", utm_medium: "Email" }),
    );
    expect(res.status).toBe(204);
    const [r] = await rows();
    expect(r.pathname).toBe("/blog/ciao");
    expect(r.referrer).toBe("www.google.com");
    expect(r.utm_source).toBe("newsletter");
    expect(r.channel).toBe("email");
    expect(r.visitor_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(r.is_unique).toBe(1);
    expect(r.country).toBe("IT");
    expect(JSON.stringify(r)).not.toContain("203.0.113.7");
  });

  test("search channel; own-site referrer is dropped", async () => {
    await call(pageview());
    await call(
      pageview({
        page_id: "b".repeat(16),
        referrer: "https://valerionarcisi.me/blog",
      }),
    );
    const rs = await rows();
    expect(rs[0].channel).toBe("search");
    expect(rs[1].referrer).toBeNull();
    expect(rs[1].channel).toBe("direct");
  });

  test("country prefers the Netlify geo header over the timezone", async () => {
    const geo = Buffer.from(
      JSON.stringify({ country: { code: "FR" } }),
    ).toString("base64");
    await call(pageview(), { headers: { "x-nf-geo": geo } });
    expect((await rows())[0].country).toBe("FR");
  });

  test("rejected: bad host, bad path, short page_id -> 204 and nothing stored", async () => {
    for (const bad of [
      pageview({ hostname: "evil.com" }),
      pageview({ pathname: "nope" }),
      pageview({ page_id: "short" }),
    ]) {
      expect((await call(bad)).status).toBe(204);
    }
    expect(await rows()).toHaveLength(0);
  });

  test("rejected: foreign origin and missing origin/referer -> 403", async () => {
    expect(
      (await call(pageview(), { origin: "https://evil.com" })).status,
    ).toBe(403);
    expect((await call(pageview(), { origin: null })).status).toBe(403);
    expect(await rows()).toHaveLength(0);
  });

  test("Referer is accepted when Origin is absent", async () => {
    const res = await call(pageview(), {
      origin: null,
      headers: { referer: "https://valerionarcisi.me/blog/ciao" },
    });
    expect(res.status).toBe(204);
    expect(await rows()).toHaveLength(1);
  });

  test("bots and malformed bodies", async () => {
    expect((await call(pageview(), { ua: "Googlebot/2.1" })).status).toBe(204);
    expect(await rows()).toHaveLength(0);
    expect((await call({ type: "nope" })).status).toBe(400);
  });

  test("uniqueness: first visit of the day only", async () => {
    await call(pageview());
    await call(pageview({ page_id: "c".repeat(16) }));
    await call(pageview({ page_id: "d".repeat(16) }), { ip: "198.51.100.9" });
    expect((await rows()).map((r) => r.is_unique)).toEqual([1, 0, 1]);
  });

  test("uniqueness is atomic under concurrent requests", async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        call(
          pageview({
            page_id: `e${String(i).padStart(2, "0")}`.padEnd(16, "x"),
          }),
        ),
      ),
    );
    const rs = await rows();
    expect(rs).toHaveLength(12);
    expect(rs.filter((r) => r.is_unique === 1)).toHaveLength(1);
  });

  test("rate limit: 429 after 60 events per visitor per minute", async () => {
    let last = 0;
    for (let i = 0; i < 62; i++) {
      last = (await call(pageview({ page_id: `r${i}`.padEnd(16, "x") })))
        .status;
    }
    expect(last).toBe(429);
    expect((await rows()).length).toBe(60);
  });
});

describe("POST /api/e - beacon", () => {
  test("cumulative with MAX semantics", async () => {
    await call(pageview());
    await call(beacon(10, 25));
    expect(
      await rows().then((r) => [r[0].time_on_page, r[0].scroll_depth]),
    ).toEqual([10, 25]);
    await call(beacon(5, 10)); // lower values never overwrite
    expect(
      await rows().then((r) => [r[0].time_on_page, r[0].scroll_depth]),
    ).toEqual([10, 25]);
    await call(beacon(42, 80));
    expect(
      await rows().then((r) => [r[0].time_on_page, r[0].scroll_depth]),
    ).toEqual([42, 80]);
  });

  test("clamps to 3600s / 100%", async () => {
    await call(pageview());
    await call(beacon(99999, 500));
    expect(
      await rows().then((r) => [r[0].time_on_page, r[0].scroll_depth]),
    ).toEqual([3600, 100]);
  });

  test("a beacon from a different visitor (ip or ua) cannot touch the row", async () => {
    await call(pageview());
    expect((await call(beacon(30, 50), { ip: "198.51.100.77" })).status).toBe(
      204,
    );
    expect((await call(beacon(30, 50), { ua: UA + " Other" })).status).toBe(
      204,
    );
    expect(
      await rows().then((r) => [r[0].time_on_page, r[0].scroll_depth]),
    ).toEqual([null, null]);
  });

  test("unknown page_id changes nothing", async () => {
    await call(pageview());
    await call(beacon(30, 50, { page_id: "z".repeat(16) }));
    expect((await rows())[0].time_on_page).toBeNull();
  });

  test("beacon right after midnight still matches yesterday's hash", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-15T23:59:50Z"));
      await call(pageview());
      vi.setSystemTime(new Date("2026-10-16T00:00:30Z"));
      await call(beacon(40, 60));
      expect((await rows())[0].time_on_page).toBe(40);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("POST /api/e - migration not applied", () => {
  test("degrades gracefully on the legacy schema", async () => {
    db = createClient({ url: ":memory:" });
    await db.executeMultiple(OLD_SCHEMA);
    expect((await call(pageview())).status).toBe(204);
    expect((await call(pageview({ page_id: "f".repeat(16) }))).status).toBe(
      204,
    );
    const rs = await rows();
    expect(rs).toHaveLength(2);
    expect(rs.map((r) => r.is_unique)).toEqual([1, 1]); // no visitor_hash fallback column -> unique
  });

  test("engage, rules and score degrade silently without the phase 4 columns/tables", async () => {
    db = createClient({ url: ":memory:" });
    await db.executeMultiple(OLD_SCHEMA);
    invalidateRulesCache();
    expect((await call(pageview(), { bare: true })).status).toBe(204);
    expect((await call(engage())).status).toBe(204);
    expect(await rows()).toHaveLength(1);
  });
});

const engage = (over: Record<string, unknown> = {}) => ({
  type: "engage",
  page_id: PAGE_ID,
  hostname: "valerionarcisi.me",
  ...over,
});

describe("POST /api/e - engage (human signal)", () => {
  test("sets human = 1 on the pageview, idempotently; new rows start at 0", async () => {
    await call(pageview());
    expect((await rows())[0].human).toBe(0);
    expect((await call(engage())).status).toBe(204);
    expect((await call(engage())).status).toBe(204);
    const rs = await rows();
    expect(rs).toHaveLength(1);
    expect(rs[0].human).toBe(1);
  });

  test("an engage from a different visitor (ip or ua) is ignored", async () => {
    await call(pageview());
    await call(engage(), { ip: "198.51.100.77" });
    await call(engage(), { ua: UA + " Other" });
    expect((await rows())[0].human).toBe(0);
  });

  test("unknown page_id, foreign host, bad origin: nothing changes", async () => {
    await call(pageview());
    await call(engage({ page_id: "z".repeat(16) }));
    await call(engage({ hostname: "evil.com" }));
    expect((await call(engage(), { origin: "https://evil.com" })).status).toBe(
      403,
    );
    expect((await rows())[0].human).toBe(0);
  });

  test("engage right after midnight still matches yesterday's hash", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-15T23:59:50Z"));
      await call(pageview());
      vi.setSystemTime(new Date("2026-10-16T00:00:30Z"));
      await call(engage());
      expect((await rows())[0].human).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test("human status covers the whole visitor-day: earlier and later pageviews", async () => {
    await call(pageview());
    await call(pageview({ page_id: "q".repeat(16) }));
    await call(engage({ page_id: "q".repeat(16) }));
    await call(pageview({ page_id: "r".repeat(16) }));
    expect((await rows()).map((r) => r.human)).toEqual([1, 1, 1]);
  });

  test("another visitor is never touched by someone else's engage", async () => {
    await call(pageview(), { ip: "203.0.113.9" });
    await call(pageview({ page_id: "q".repeat(16) }));
    await call(engage({ page_id: "q".repeat(16) }));
    expect((await rows()).map((r) => r.human)).toEqual([0, 1]);
  });
});

describe("POST /api/e - bot score and scanner paths", () => {
  test("scanner paths are dropped: 204 and nothing stored", async () => {
    for (const pathname of [
      "/wp-login.php",
      "/.env",
      "/xmlrpc.php",
      "/wp-admin/x",
      "/a/b.php",
    ]) {
      expect((await call(pageview({ pathname }))).status).toBe(204);
    }
    expect(await rows()).toHaveLength(0);
  });

  test("a regular browser request is stored with score 0", async () => {
    await call(pageview());
    expect((await rows())[0].bot_score).toBe(0);
  });

  test("missing Accept-Language and Sec-Fetch on Chrome: 6; plus viewport 0 on top", async () => {
    await call(pageview(), { bare: true });
    await call(pageview({ page_id: "v".repeat(16), viewport_width: 0 }), {
      bare: true,
      ip: "198.51.100.1",
    });
    expect((await rows()).map((r) => r.bot_score)).toEqual([6, 8]);
  });

  test("more than 20 pageviews in a minute from one hash adds the rate signal", async () => {
    for (let i = 0; i < 22; i++) {
      await call(pageview({ page_id: `p${i}`.padEnd(16, "x") }));
    }
    const scores = (await rows()).map((r) => r.bot_score);
    expect(scores.slice(0, 21).every((s) => s === 0)).toBe(true);
    expect(scores[21]).toBe(3);
  });
});

describe("POST /api/e - bot rules at ingest", () => {
  const FF = { ua: "Mozilla/5.0 Firefox/130.0" };

  async function addRule(kind: string, value: string, expires?: string) {
    await db.execute({
      sql: "INSERT INTO bot_rules (kind, value, expires_at) VALUES (?, ?, ?)",
      args: [kind, value, expires ?? null],
    });
    invalidateRulesCache();
  }

  test("ua_contains / referrer_host / path_prefix mark the row 99 and count hits", async () => {
    await addRule("ua_contains", "chrome/120");
    await call(pageview());
    await addRule("referrer_host", "spam.example");
    await call(
      pageview({
        page_id: "r".repeat(16),
        referrer: "https://Spam.example/x",
      }),
      FF,
    );
    await addRule("path_prefix", "/private");
    await call(
      pageview({ page_id: "s".repeat(16), pathname: "/private/area" }),
      FF,
    );
    await call(pageview({ page_id: "t".repeat(16) }), FF);
    expect((await rows()).map((r) => r.bot_score)).toEqual([99, 99, 99, 0]);
    const hits = (
      await db.execute("SELECT hits FROM bot_rules ORDER BY id")
    ).rows.map((r) => r.hits);
    expect(hits).toEqual([1, 1, 1]);
  });

  test("disabled and expired rules are ignored", async () => {
    await addRule("ua_contains", "chrome/120");
    await db.execute("UPDATE bot_rules SET enabled = 0");
    invalidateRulesCache();
    await call(pageview());
    await addRule("path_prefix", "/blog", "2000-01-01 00:00:00");
    await call(pageview({ page_id: "u".repeat(16) }), { ip: "198.51.100.2" });
    expect((await rows()).map((r) => r.bot_score)).toEqual([0, 0]);
  });

  test("rules are cached in memory between requests", async () => {
    await call(pageview());
    await db.execute(
      "INSERT INTO bot_rules (kind, value) VALUES ('ua_contains', 'chrome/120')",
    );
    await call(pageview({ page_id: "w".repeat(16) }));
    expect((await rows()).map((r) => r.bot_score)).toEqual([0, 0]);
    invalidateRulesCache();
    await call(pageview({ page_id: "y".repeat(16) }));
    expect((await rows())[2].bot_score).toBe(99);
  });

  test("a broken rules table never breaks ingest", async () => {
    await db.execute("DROP TABLE bot_rules");
    invalidateRulesCache();
    expect((await call(pageview())).status).toBe(204);
    expect(await rows()).toHaveLength(1);
  });
});
