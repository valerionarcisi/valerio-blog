import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

vi.mock("~/lib/env", () => ({
  env: (key: string) => {
    if (key === "ADMIN_TOKEN") return "test-token";
    if (key === "RESEND_API_KEY") return "";
    return "";
  },
}));

const emailMocks = vi.hoisted(() => ({
  notifyNewComment: vi.fn().mockResolvedValue(undefined),
  notifyCommentApproved: vi.fn().mockResolvedValue(undefined),
  notifyCommentRejected: vi.fn().mockResolvedValue(undefined),
  notifyReplyToYourComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/email", () => emailMocks);

async function seedDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS comments (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id           TEXT NOT NULL,
      name              TEXT NOT NULL,
      email             TEXT NOT NULL,
      text              TEXT NOT NULL,
      approved          INTEGER NOT NULL DEFAULT 0,
      parent_id         INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      likes_count       INTEGER NOT NULL DEFAULT 0,
      notified_approved INTEGER NOT NULL DEFAULT 0,
      lang              TEXT NOT NULL DEFAULT 'it',
      is_author         INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS comment_likes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id   INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      visitor_hash TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(comment_id, visitor_hash)
    );
  `);
  await db.execute("PRAGMA foreign_keys = ON");
}

function makeRequest(
  body: Record<string, unknown> | null,
  opts: { token?: string; ip?: string; ua?: string } = {},
): { url: URL; request: Request } {
  const url = new URL("https://example.com/api/comments");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forwarded-for": opts.ip ?? "1.2.3.4",
    "user-agent": opts.ua ?? "Mozilla/5.0 Test",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const request = new Request(url.toString(), {
    method: body !== null ? "POST" : "GET",
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  return { url, request };
}

function makeGet(
  pageId: string | null,
  opts: { ip?: string; ua?: string } = {},
): { url: URL; request: Request } {
  const url = new URL(
    `https://example.com/api/comments${pageId ? `?pageId=${pageId}` : ""}`,
  );
  const request = new Request(url.toString(), {
    method: "GET",
    headers: {
      "x-forwarded-for": opts.ip ?? "1.2.3.4",
      "user-agent": opts.ua ?? "Mozilla/5.0 Test",
    },
  });
  return { url, request };
}

async function insertComment(opts: {
  pageId: string;
  name: string;
  email: string;
  text: string;
  approved?: number;
  parent_id?: number | null;
  lang?: string;
}): Promise<number> {
  const res = await db.execute({
    sql: `INSERT INTO comments (page_id, name, email, text, approved, parent_id, lang)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      opts.pageId,
      opts.name,
      opts.email,
      opts.text,
      opts.approved ?? 0,
      opts.parent_id ?? null,
      opts.lang ?? "it",
    ],
  });
  return Number(res.lastInsertRowid);
}

describe("POST /api/comments", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
    emailMocks.notifyNewComment.mockClear();
    emailMocks.notifyCommentApproved.mockClear();
    emailMocks.notifyCommentRejected.mockClear();
    emailMocks.notifyReplyToYourComment.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("creates top-level comment", async () => {
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-1",
      name: "Mario",
      email: "mario@example.com",
      text: "Bel post",
      lang: "it",
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(201);
    const rows = await db.execute(
      "SELECT * FROM comments WHERE page_id = 'post-1'",
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].parent_id).toBeNull();
    expect(rows.rows[0].approved).toBe(0);
    expect(emailMocks.notifyNewComment).toHaveBeenCalledOnce();
  });

  test("rejects honeypot silently with 200", async () => {
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-1",
      name: "Bot",
      email: "bot@bot.com",
      text: "spam",
      website: "http://spam.com",
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(200);
    const rows = await db.execute("SELECT COUNT(*) as c FROM comments");
    expect(Number(rows.rows[0].c)).toBe(0);
    expect(emailMocks.notifyNewComment).not.toHaveBeenCalled();
  });

  test("rejects invalid email", async () => {
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-1",
      name: "Mario",
      email: "not-an-email",
      text: "ciao",
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(400);
  });

  test("creates reply when parent is approved", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "Original",
      approved: 1,
    });
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-1",
      name: "Bob",
      email: "bob@example.com",
      text: "Risposta",
      parentId,
      lang: "it",
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(201);
    const rows = await db.execute(
      "SELECT parent_id FROM comments WHERE name = 'Bob'",
    );
    expect(Number(rows.rows[0].parent_id)).toBe(parentId);
  });

  test("rejects reply to pending parent", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "Pending",
      approved: 0,
    });
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-1",
      name: "Bob",
      email: "bob@example.com",
      text: "Try reply",
      parentId,
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(400);
  });

  test("rejects reply to non-existent parent", async () => {
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-1",
      name: "Bob",
      email: "bob@example.com",
      text: "Try reply",
      parentId: 9999,
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(400);
  });

  test("rejects reply to parent on different page", async () => {
    const parentId = await insertComment({
      pageId: "post-A",
      name: "Alice",
      email: "alice@example.com",
      text: "On A",
      approved: 1,
    });
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-B",
      name: "Bob",
      email: "bob@example.com",
      text: "Try reply",
      parentId,
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(400);
  });

  test("rejects invalid parentId type", async () => {
    const { POST } = await import("~/pages/api/comments");
    const { request } = makeRequest({
      pageId: "post-1",
      name: "Bob",
      email: "bob@example.com",
      text: "Reply",
      parentId: "not-a-number",
    });
    const res = await POST({ request } as never);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/comments — author auto-login", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
    emailMocks.notifyNewComment.mockClear();
    emailMocks.notifyReplyToYourComment.mockClear();
  });

  function authorRequest(
    body: Record<string, unknown>,
    token = "test-token",
  ): Request {
    return new Request("https://example.com/api/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "Mozilla/5.0 Test",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  test("with valid bearer token: comment is approved and is_author=1", async () => {
    const { POST } = await import("~/pages/api/comments");
    const res = await POST({
      request: authorRequest({
        pageId: "post-1",
        text: "io sono Valerio",
        lang: "it",
      }),
    } as never);
    expect(res.status).toBe(201);
    const rows = await db.execute(
      "SELECT name, email, approved, is_author, notified_approved FROM comments WHERE page_id = 'post-1'",
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].name).toBe("Valerio");
    expect(rows.rows[0].email).toBe("valerio.narcisi@gmail.com");
    expect(rows.rows[0].approved).toBe(1);
    expect(rows.rows[0].is_author).toBe(1);
    expect(rows.rows[0].notified_approved).toBe(1);
  });

  test("ignores name/email in body and forces author identity", async () => {
    const { POST } = await import("~/pages/api/comments");
    await POST({
      request: authorRequest({
        pageId: "post-1",
        text: "ciao",
        lang: "it",
        name: "Spoofed",
        email: "spoof@example.com",
      }),
    } as never);
    const rows = await db.execute(
      "SELECT name, email FROM comments WHERE page_id = 'post-1'",
    );
    expect(rows.rows[0].name).toBe("Valerio");
    expect(rows.rows[0].email).toBe("valerio.narcisi@gmail.com");
  });

  test("does not call notifyNewComment when posting as author", async () => {
    const { POST } = await import("~/pages/api/comments");
    await POST({
      request: authorRequest({
        pageId: "post-1",
        text: "ciao",
        lang: "it",
      }),
    } as never);
    expect(emailMocks.notifyNewComment).not.toHaveBeenCalled();
  });

  test("with invalid bearer token: falls back to public flow (pending)", async () => {
    const { POST } = await import("~/pages/api/comments");
    const res = await POST({
      request: new Request("https://example.com/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "1.2.3.4",
          "user-agent": "Test",
          Authorization: "Bearer wrong-token",
        },
        body: JSON.stringify({
          pageId: "post-1",
          name: "Mario",
          email: "mario@example.com",
          text: "ciao",
        }),
      }),
    } as never);
    expect(res.status).toBe(201);
    const rows = await db.execute(
      "SELECT approved, is_author FROM comments WHERE page_id = 'post-1'",
    );
    expect(rows.rows[0].approved).toBe(0);
    expect(rows.rows[0].is_author).toBe(0);
  });

  test("author reply to approved parent: stored approved + notifies parent author", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "Original",
      approved: 1,
    });
    const { POST } = await import("~/pages/api/comments");
    await POST({
      request: authorRequest({
        pageId: "post-1",
        text: "grazie!",
        lang: "it",
        parentId,
      }),
    } as never);
    const rows = await db.execute(
      "SELECT parent_id, is_author, approved FROM comments WHERE name = 'Valerio'",
    );
    expect(Number(rows.rows[0].parent_id)).toBe(parentId);
    expect(rows.rows[0].is_author).toBe(1);
    expect(rows.rows[0].approved).toBe(1);
    expect(emailMocks.notifyReplyToYourComment).toHaveBeenCalledOnce();
    const call = emailMocks.notifyReplyToYourComment.mock.calls[0][0];
    expect(call.parentEmail).toBe("alice@example.com");
    expect(call.replyName).toBe("Valerio");
  });

  test("author reply to own parent (same email) does not self-notify", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Valerio",
      email: "valerio.narcisi@gmail.com",
      text: "self",
      approved: 1,
    });
    const { POST } = await import("~/pages/api/comments");
    await POST({
      request: authorRequest({
        pageId: "post-1",
        text: "self reply",
        lang: "it",
        parentId,
      }),
    } as never);
    expect(emailMocks.notifyReplyToYourComment).not.toHaveBeenCalled();
  });

  test("author reply to pending parent: rejected", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "Pending",
      approved: 0,
    });
    const { POST } = await import("~/pages/api/comments");
    const res = await POST({
      request: authorRequest({
        pageId: "post-1",
        text: "reply",
        lang: "it",
        parentId,
      }),
    } as never);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/comments exposes is_author", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  test("is_author=1 for author comments, 0 for others", async () => {
    await db.execute({
      sql: `INSERT INTO comments (page_id, name, email, text, approved, is_author)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["post-1", "Valerio", "valerio.narcisi@gmail.com", "hi", 1, 1],
    });
    await db.execute({
      sql: `INSERT INTO comments (page_id, name, email, text, approved)
            VALUES (?, ?, ?, ?, ?)`,
      args: ["post-1", "Mario", "mario@example.com", "ciao", 1],
    });
    const { GET } = await import("~/pages/api/comments");
    const { url, request } = makeGet("post-1");
    const res = await GET({ url, request } as never);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    const valerio = data.find((c) => c.name === "Valerio");
    const mario = data.find((c) => c.name === "Mario");
    expect(Number(valerio?.is_author)).toBe(1);
    expect(Number(mario?.is_author)).toBe(0);
  });
});

describe("GET /api/comments", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  test("returns 400 without pageId", async () => {
    const { GET } = await import("~/pages/api/comments");
    const { url, request } = makeGet(null);
    const res = await GET({ url, request } as never);
    expect(res.status).toBe(400);
  });

  test("returns approved comments only with parent_id and likes_count", async () => {
    await insertComment({
      pageId: "post-1",
      name: "A",
      email: "a@a.it",
      text: "approved",
      approved: 1,
    });
    await insertComment({
      pageId: "post-1",
      name: "B",
      email: "b@b.it",
      text: "pending",
      approved: 0,
    });

    const { GET } = await import("~/pages/api/comments");
    const { url, request } = makeGet("post-1");
    const res = await GET({ url, request } as never);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(data.length).toBe(1);
    expect(data[0].name).toBe("A");
    expect(data[0]).toHaveProperty("parent_id");
    expect(data[0]).toHaveProperty("likes_count");
    expect(data[0]).toHaveProperty("liked_by_me");
  });

  test("returns flat list including replies", async () => {
    const p = await insertComment({
      pageId: "post-1",
      name: "Parent",
      email: "p@p.it",
      text: "P",
      approved: 1,
    });
    await insertComment({
      pageId: "post-1",
      name: "Child",
      email: "c@c.it",
      text: "C",
      approved: 1,
      parent_id: p,
    });
    const { GET } = await import("~/pages/api/comments");
    const { url, request } = makeGet("post-1");
    const res = await GET({ url, request } as never);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(data.length).toBe(2);
    const child = data.find((c) => c.name === "Child");
    expect(child?.parent_id).toBe(p);
  });
});

describe("PATCH /api/admin/comments", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
    emailMocks.notifyCommentApproved.mockClear();
    emailMocks.notifyCommentRejected.mockClear();
    emailMocks.notifyReplyToYourComment.mockClear();
  });

  function adminPatch(body: unknown, token = "test-token"): Request {
    return new Request("https://example.com/api/admin/comments", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  test("returns 401 without valid token", async () => {
    const { PATCH } = await import("~/pages/api/admin/comments");
    const res = await PATCH({
      request: adminPatch({ id: 1, action: "approve" }, "wrong"),
    } as never);
    expect(res.status).toBe(401);
  });

  test("approve sets approved=1 and notifies author once", async () => {
    const id = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "ciao",
      approved: 0,
    });
    const { PATCH } = await import("~/pages/api/admin/comments");
    const res = await PATCH({
      request: adminPatch({ id, action: "approve" }),
    } as never);
    expect(res.status).toBe(200);
    const rows = await db.execute({
      sql: "SELECT approved, notified_approved FROM comments WHERE id = ?",
      args: [id],
    });
    expect(rows.rows[0].approved).toBe(1);
    expect(rows.rows[0].notified_approved).toBe(1);
    expect(emailMocks.notifyCommentApproved).toHaveBeenCalledOnce();
  });

  test("approve is idempotent for email notification", async () => {
    const id = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "ciao",
      approved: 0,
    });
    const { PATCH } = await import("~/pages/api/admin/comments");
    await PATCH({
      request: adminPatch({ id, action: "approve" }),
    } as never);
    await PATCH({
      request: adminPatch({ id, action: "approve" }),
    } as never);
    expect(emailMocks.notifyCommentApproved).toHaveBeenCalledOnce();
  });

  test("approving a reply notifies the parent author", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "Original",
      approved: 1,
    });
    const replyId = await insertComment({
      pageId: "post-1",
      name: "Bob",
      email: "bob@example.com",
      text: "Reply",
      approved: 0,
      parent_id: parentId,
    });
    const { PATCH } = await import("~/pages/api/admin/comments");
    await PATCH({
      request: adminPatch({ id: replyId, action: "approve" }),
    } as never);
    expect(emailMocks.notifyReplyToYourComment).toHaveBeenCalledOnce();
    const call = emailMocks.notifyReplyToYourComment.mock.calls[0][0];
    expect(call.parentEmail).toBe("alice@example.com");
    expect(call.replyName).toBe("Bob");
  });

  test("approving own reply does not notify self", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "Original",
      approved: 1,
    });
    const replyId = await insertComment({
      pageId: "post-1",
      name: "Alice",
      email: "alice@example.com",
      text: "Self reply",
      approved: 0,
      parent_id: parentId,
    });
    const { PATCH } = await import("~/pages/api/admin/comments");
    await PATCH({
      request: adminPatch({ id: replyId, action: "approve" }),
    } as never);
    expect(emailMocks.notifyReplyToYourComment).not.toHaveBeenCalled();
  });

  test("delete sends rejected notification and removes comment", async () => {
    const id = await insertComment({
      pageId: "post-1",
      name: "Mario",
      email: "mario@example.com",
      text: "spam",
      approved: 0,
    });
    const { PATCH } = await import("~/pages/api/admin/comments");
    await PATCH({
      request: adminPatch({ id, action: "delete" }),
    } as never);
    const rows = await db.execute("SELECT COUNT(*) as c FROM comments");
    expect(Number(rows.rows[0].c)).toBe(0);
    expect(emailMocks.notifyCommentRejected).toHaveBeenCalledOnce();
  });

  test("deleting parent cascades children", async () => {
    const parentId = await insertComment({
      pageId: "post-1",
      name: "Parent",
      email: "p@p.it",
      text: "P",
      approved: 1,
    });
    await insertComment({
      pageId: "post-1",
      name: "Child",
      email: "c@c.it",
      text: "C",
      approved: 1,
      parent_id: parentId,
    });
    const { PATCH } = await import("~/pages/api/admin/comments");
    await PATCH({
      request: adminPatch({ id: parentId, action: "delete" }),
    } as never);
    const rows = await db.execute("SELECT COUNT(*) as c FROM comments");
    expect(Number(rows.rows[0].c)).toBe(0);
  });

  test("returns 404 for non-existent comment", async () => {
    const { PATCH } = await import("~/pages/api/admin/comments");
    const res = await PATCH({
      request: adminPatch({ id: 999, action: "approve" }),
    } as never);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/comments/like", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  function likeRequest(
    commentId: unknown,
    opts: { ip?: string; ua?: string } = {},
  ): Request {
    return new Request("https://example.com/api/comments/like", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": opts.ip ?? "1.2.3.4",
        "user-agent": opts.ua ?? "Mozilla/5.0 Test",
      },
      body: JSON.stringify({ commentId }),
    });
  }

  test("first like inserts and returns count=1", async () => {
    const id = await insertComment({
      pageId: "p",
      name: "A",
      email: "a@a.it",
      text: "x",
      approved: 1,
    });
    const { POST } = await import("~/pages/api/comments/like");
    const res = await POST({ request: likeRequest(id) } as never);
    const data = (await res.json()) as { liked: boolean; count: number };
    expect(data.liked).toBe(true);
    expect(data.count).toBe(1);
    const counted = await db.execute({
      sql: "SELECT likes_count FROM comments WHERE id = ?",
      args: [id],
    });
    expect(Number(counted.rows[0].likes_count)).toBe(1);
  });

  test("same hash toggles to unliked", async () => {
    const id = await insertComment({
      pageId: "p",
      name: "A",
      email: "a@a.it",
      text: "x",
      approved: 1,
    });
    const { POST } = await import("~/pages/api/comments/like");
    await POST({ request: likeRequest(id) } as never);
    const res = await POST({ request: likeRequest(id) } as never);
    const data = (await res.json()) as { liked: boolean; count: number };
    expect(data.liked).toBe(false);
    expect(data.count).toBe(0);
  });

  test("different hashes accumulate", async () => {
    const id = await insertComment({
      pageId: "p",
      name: "A",
      email: "a@a.it",
      text: "x",
      approved: 1,
    });
    const { POST } = await import("~/pages/api/comments/like");
    await POST({
      request: likeRequest(id, { ip: "1.1.1.1" }),
    } as never);
    const res = await POST({
      request: likeRequest(id, { ip: "2.2.2.2" }),
    } as never);
    const data = (await res.json()) as { liked: boolean; count: number };
    expect(data.count).toBe(2);
  });

  test("rejects like on pending comment", async () => {
    const id = await insertComment({
      pageId: "p",
      name: "A",
      email: "a@a.it",
      text: "x",
      approved: 0,
    });
    const { POST } = await import("~/pages/api/comments/like");
    const res = await POST({ request: likeRequest(id) } as never);
    expect(res.status).toBe(400);
  });

  test("returns 404 for non-existent comment", async () => {
    const { POST } = await import("~/pages/api/comments/like");
    const res = await POST({ request: likeRequest(999) } as never);
    expect(res.status).toBe(404);
  });

  test("rejects invalid commentId", async () => {
    const { POST } = await import("~/pages/api/comments/like");
    const res = await POST({ request: likeRequest("nope") } as never);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/comments — liked_by_me", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await seedDb();
  });

  test("returns liked_by_me=1 for visitor who liked", async () => {
    const id = await insertComment({
      pageId: "p",
      name: "A",
      email: "a@a.it",
      text: "x",
      approved: 1,
    });
    const { POST: likePost } = await import("~/pages/api/comments/like");
    await likePost({
      request: new Request("https://example.com/api/comments/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "9.9.9.9",
          "user-agent": "TestUA",
        },
        body: JSON.stringify({ commentId: id }),
      }),
    } as never);

    const { GET } = await import("~/pages/api/comments");
    const url = new URL("https://example.com/api/comments?pageId=p");
    const requestSame = new Request(url.toString(), {
      headers: {
        "x-forwarded-for": "9.9.9.9",
        "user-agent": "TestUA",
      },
    });
    const resSame = await GET({ url, request: requestSame } as never);
    const dataSame = (await resSame.json()) as Array<Record<string, unknown>>;
    expect(Number(dataSame[0].liked_by_me)).toBe(1);

    const requestOther = new Request(url.toString(), {
      headers: {
        "x-forwarded-for": "8.8.8.8",
        "user-agent": "OtherUA",
      },
    });
    const resOther = await GET({ url, request: requestOther } as never);
    const dataOther = (await resOther.json()) as Array<Record<string, unknown>>;
    expect(Number(dataOther[0].liked_by_me)).toBe(0);
  });
});
