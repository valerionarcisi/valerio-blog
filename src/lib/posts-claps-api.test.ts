import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "ADMIN_TOKEN" ? "test-token" : ""),
}));

async function seedDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS post_claps (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id      TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      count        INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_id, visitor_hash)
    )
  `);
}

function makePostRequest(
  body: unknown,
  opts: { ip?: string; ua?: string } = {},
): Request {
  return new Request("https://example.com/api/posts/claps", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": opts.ip ?? "1.2.3.4",
      "user-agent": opts.ua ?? "Mozilla/5.0 Test",
    },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(
  postId: string | null,
  opts: { ip?: string; ua?: string } = {},
): { url: URL; request: Request } {
  const url = new URL(
    `https://example.com/api/posts/claps${postId ? `?postId=${postId}` : ""}`,
  );
  const request = new Request(url.toString(), {
    headers: {
      "x-forwarded-for": opts.ip ?? "1.2.3.4",
      "user-agent": opts.ua ?? "Mozilla/5.0 Test",
    },
  });
  return { url, request };
}

describe("POST /api/posts/claps", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  test("first click inserts and returns count=1, mine=1", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    const res = await POST({
      request: makePostRequest({ postId: "it/blog/foo" }),
    } as never);
    const data = (await res.json()) as { total: number; mine: number };
    expect(data.total).toBe(1);
    expect(data.mine).toBe(1);
  });

  test("second click from same hash increments mine and total", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    await POST({
      request: makePostRequest({ postId: "it/blog/foo" }),
    } as never);
    const res = await POST({
      request: makePostRequest({ postId: "it/blog/foo" }),
    } as never);
    const data = (await res.json()) as { total: number; mine: number };
    expect(data.mine).toBe(2);
    expect(data.total).toBe(2);
  });

  test("clamps to 50 max claps per visitor", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    let last;
    for (let i = 0; i < 60; i++) {
      const res = await POST({
        request: makePostRequest({ postId: "it/blog/foo" }),
      } as never);
      last = (await res.json()) as { mine: number; total: number; capped?: boolean };
    }
    expect(last?.mine).toBe(50);
    expect(last?.total).toBe(50);
  });

  test("different visitor hashes accumulate independently", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    await POST({
      request: makePostRequest({ postId: "it/blog/foo" }, { ip: "1.1.1.1" }),
    } as never);
    await POST({
      request: makePostRequest({ postId: "it/blog/foo" }, { ip: "1.1.1.1" }),
    } as never);
    const res = await POST({
      request: makePostRequest({ postId: "it/blog/foo" }, { ip: "2.2.2.2" }),
    } as never);
    const data = (await res.json()) as { total: number; mine: number };
    expect(data.total).toBe(3);
    expect(data.mine).toBe(1);
  });

  test("rejects empty postId", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    const res = await POST({
      request: makePostRequest({ postId: "" }),
    } as never);
    expect(res.status).toBe(400);
  });

  test("rejects missing postId", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    const res = await POST({
      request: makePostRequest({}),
    } as never);
    expect(res.status).toBe(400);
  });

  test("rejects invalid JSON body", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    const res = await POST({
      request: new Request("https://example.com/api/posts/claps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    } as never);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/posts/claps", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  test("returns 0/0 for empty post", async () => {
    const { GET } = await import("~/pages/api/posts/claps");
    const { url, request } = makeGetRequest("it/blog/empty");
    const res = await GET({ url, request } as never);
    const data = (await res.json()) as { total: number; mine: number };
    expect(data.total).toBe(0);
    expect(data.mine).toBe(0);
  });

  test("returns total and per-visitor mine", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    await POST({
      request: makePostRequest({ postId: "it/blog/foo" }, { ip: "9.9.9.9" }),
    } as never);
    await POST({
      request: makePostRequest({ postId: "it/blog/foo" }, { ip: "9.9.9.9" }),
    } as never);
    await POST({
      request: makePostRequest({ postId: "it/blog/foo" }, { ip: "8.8.8.8" }),
    } as never);

    const { GET } = await import("~/pages/api/posts/claps");
    const { url: u1, request: r1 } = makeGetRequest("it/blog/foo", {
      ip: "9.9.9.9",
    });
    const res1 = await GET({ url: u1, request: r1 } as never);
    const data1 = (await res1.json()) as { total: number; mine: number };
    expect(data1.total).toBe(3);
    expect(data1.mine).toBe(2);

    const { url: u2, request: r2 } = makeGetRequest("it/blog/foo", {
      ip: "8.8.8.8",
    });
    const res2 = await GET({ url: u2, request: r2 } as never);
    const data2 = (await res2.json()) as { total: number; mine: number };
    expect(data2.total).toBe(3);
    expect(data2.mine).toBe(1);
  });

  test("returns 400 without postId", async () => {
    const { GET } = await import("~/pages/api/posts/claps");
    const { url, request } = makeGetRequest(null);
    const res = await GET({ url, request } as never);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/claps", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  function adminGet(token = "test-token"): Request {
    return new Request("https://example.com/api/admin/claps", {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  test("returns 401 without valid token", async () => {
    const { GET } = await import("~/pages/api/admin/claps");
    const res = await GET({ request: adminGet("wrong") } as never);
    expect(res.status).toBe(401);
  });

  test("returns recap with totals and per_post sorted desc", async () => {
    const { POST } = await import("~/pages/api/posts/claps");
    for (let i = 0; i < 3; i++)
      await POST({
        request: makePostRequest({ postId: "it/blog/A" }),
      } as never);
    await POST({
      request: makePostRequest({ postId: "it/blog/B" }),
    } as never);

    const { GET } = await import("~/pages/api/admin/claps");
    const res = await GET({ request: adminGet() } as never);
    const data = (await res.json()) as {
      totals: { total: number; posts: number; unique_clappers: number };
      per_post: Array<{ post_id: string; total_claps: number }>;
    };
    expect(Number(data.totals.total)).toBe(4);
    expect(Number(data.totals.posts)).toBe(2);
    expect(data.per_post[0].post_id).toBe("it/blog/A");
    expect(Number(data.per_post[0].total_claps)).toBe(3);
  });

  test("returns empty recap when no claps", async () => {
    const { GET } = await import("~/pages/api/admin/claps");
    const res = await GET({ request: adminGet() } as never);
    const data = (await res.json()) as {
      totals: { total: number };
      per_post: unknown[];
    };
    expect(Number(data.totals.total)).toBe(0);
    expect(data.per_post.length).toBe(0);
  });
});
