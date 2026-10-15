import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../../scripts/migrate-analytics-v2";

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
  } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": opts.ua ?? UA,
    "x-nf-client-connection-ip": opts.ip ?? "203.0.113.7",
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
});
