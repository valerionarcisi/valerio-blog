import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { migrateAnalyticsV2 } from "../../../scripts/migrate-analytics-v2";

let db: Client;
let token = "secret-report-token";

vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (k: string) => (k === "ANALYTICS_REPORT_TOKEN" ? token : ""),
}));

const { GET } = await import("~/pages/api/analytics-report");

const PAGEVIEWS = `
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

function call(headers: Record<string, string> = {}, qs = "") {
  return GET({
    request: new Request(`http://localhost/api/analytics-report${qs}`, { headers }),
    url: new URL(`http://localhost/api/analytics-report${qs}`),
  } as never);
}

beforeEach(async () => {
  token = "secret-report-token";
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(PAGEVIEWS);
  await migrateAnalyticsV2(db);
});

describe("GET /api/analytics-report", () => {
  test("503 when the token is not configured (fails closed)", async () => {
    token = "";
    const res = await call({ authorization: "Bearer anything" });
    expect(res.status).toBe(503);
  });

  test("401 without credentials, with a wrong token and with a non-Bearer scheme", async () => {
    expect((await call()).status).toBe(401);
    expect((await call({ authorization: "Bearer nope" })).status).toBe(401);
    expect((await call({ authorization: "Basic secret-report-token" })).status).toBe(401);
  });

  test("200 plain text, never cached, with the right token", async () => {
    const res = await call({ authorization: "Bearer secret-report-token" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(20);
    expect(body.length).toBeLessThan(4000);
    expect(body).not.toContain("secret-report-token");
  });

  test("unsupported period is a 400", async () => {
    const res = await call({ authorization: "Bearer secret-report-token" }, "?period=year");
    expect(res.status).toBe(400);
  });
});
