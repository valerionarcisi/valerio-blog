import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("~/lib/env", () => ({
  env: (key: string) => {
    if (key === "RESEND_API_KEY") return mockEnv.RESEND_API_KEY;
    if (key === "ADMIN_TOKEN") return mockEnv.ADMIN_TOKEN;
    return "";
  },
}));

const mockEnv = { RESEND_API_KEY: "test-key", ADMIN_TOKEN: "admin-secret" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockEnv.RESEND_API_KEY = "test-key";
  mockEnv.ADMIN_TOKEN = "admin-secret";
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function lastCallBody(): Record<string, unknown> {
  expect(fetchMock).toHaveBeenCalled();
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return JSON.parse(call[1].body);
}

describe("notifyNewComment", () => {
  test("sends email to admin with comment fields", async () => {
    const { notifyNewComment } = await import("./email");
    await notifyNewComment({
      pageId: "my-post",
      name: "John",
      email: "john@example.com",
      text: "Great post",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = lastCallBody();
    expect(body.to).toBe("valerio.narcisi@gmail.com");
    expect(body.subject).toContain("John");
    expect(body.subject).toContain("my-post");
    expect(body.html).toContain("Great post");
  });

  test("subject indicates reply when parentId is set", async () => {
    const { notifyNewComment } = await import("./email");
    await notifyNewComment({
      pageId: "my-post",
      name: "Jane",
      email: "jane@example.com",
      text: "I agree",
      parentId: 42,
      parentName: "John",
    });
    const body = lastCallBody();
    expect(body.subject).toContain("Reply");
    expect(body.subject).toContain("Jane");
    expect(body.html).toContain("In risposta a");
    expect(body.html).toContain("John");
  });

  test("graceful skip when RESEND_API_KEY missing", async () => {
    mockEnv.RESEND_API_KEY = "";
    const { notifyNewComment } = await import("./email");
    await notifyNewComment({
      pageId: "p",
      name: "X",
      email: "x@x.it",
      text: "y",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("escapes HTML in subject and body fields", async () => {
    const { notifyNewComment } = await import("./email");
    await notifyNewComment({
      pageId: "post",
      name: "<script>alert(1)</script>",
      email: "x@x.it",
      text: "Hello <b>world</b>",
    });
    const body = lastCallBody();
    expect(body.html).not.toContain("<script>alert(1)</script>");
    expect(body.html).toContain("&lt;script&gt;");
    expect(body.html).toContain("&lt;b&gt;world");
  });
});

describe("notifyCommentApproved", () => {
  test("sends email to author with post link (it)", async () => {
    const { notifyCommentApproved } = await import("./email");
    await notifyCommentApproved({
      pageId: "it/blog/my-post",
      name: "Jane",
      email: "jane@example.com",
      text: "Awesome",
      lang: "it",
    });
    const body = lastCallBody();
    expect(body.to).toBe("jane@example.com");
    expect(body.subject).toContain("pubblicato");
    expect(body.html).toContain("https://valerionarcisi.me/blog/my-post/");
  });

  test("uses /en/ link when lang is en", async () => {
    const { notifyCommentApproved } = await import("./email");
    await notifyCommentApproved({
      pageId: "en/blog/my-post",
      name: "Jane",
      email: "jane@example.com",
      text: "Cool",
      lang: "en",
    });
    const body = lastCallBody();
    expect(body.html).toContain("https://valerionarcisi.me/en/blog/my-post/");
    expect(body.subject).toContain("published");
  });

  test("films section pageId resolves correctly", async () => {
    const { notifyCommentApproved } = await import("./email");
    await notifyCommentApproved({
      pageId: "it/films/caramella",
      name: "X",
      email: "x@x.it",
      text: "ciao",
      lang: "it",
    });
    const body = lastCallBody();
    expect(body.html).toContain("https://valerionarcisi.me/films/caramella/");
  });

  test("graceful skip without API key", async () => {
    mockEnv.RESEND_API_KEY = "";
    const { notifyCommentApproved } = await import("./email");
    await notifyCommentApproved({
      pageId: "p",
      name: "X",
      email: "x@x.it",
      text: "y",
      lang: "it",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("notifyCommentRejected", () => {
  test("sends gentle rejection email in italian", async () => {
    const { notifyCommentRejected } = await import("./email");
    await notifyCommentRejected({
      pageId: "post",
      name: "Mario",
      email: "mario@example.com",
      lang: "it",
    });
    const body = lastCallBody();
    expect(body.to).toBe("mario@example.com");
    expect(String(body.subject).toLowerCase()).toContain("commento");
    expect(body.html).toContain("Mario");
  });

  test("english variant when lang is en", async () => {
    const { notifyCommentRejected } = await import("./email");
    await notifyCommentRejected({
      pageId: "post",
      name: "John",
      email: "john@example.com",
      lang: "en",
    });
    const body = lastCallBody();
    expect(String(body.subject).toLowerCase()).toContain("comment");
    expect(body.html).toContain("John");
  });
});

describe("notifyReplyToYourComment", () => {
  test("notifies parent author with reply excerpt", async () => {
    const { notifyReplyToYourComment } = await import("./email");
    await notifyReplyToYourComment({
      pageId: "it/blog/post",
      parentName: "Alice",
      parentEmail: "alice@example.com",
      replyName: "Bob",
      replyText: "Nice point",
      lang: "it",
    });
    const body = lastCallBody();
    expect(body.to).toBe("alice@example.com");
    expect(body.subject).toContain("Bob");
    expect(body.html).toContain("Nice point");
    expect(body.html).toContain("https://valerionarcisi.me/blog/post/");
  });

  test("english locale", async () => {
    const { notifyReplyToYourComment } = await import("./email");
    await notifyReplyToYourComment({
      pageId: "en/blog/post",
      parentName: "Alice",
      parentEmail: "alice@example.com",
      replyName: "Bob",
      replyText: "Nice point",
      lang: "en",
    });
    const body = lastCallBody();
    expect(body.subject).toContain("replied");
    expect(body.html).toContain("https://valerionarcisi.me/en/blog/post/");
  });
});
