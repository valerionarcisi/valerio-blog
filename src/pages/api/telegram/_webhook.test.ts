import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/env", () => ({
  env: (key: string) => {
    if (key === "TELEGRAM_BOT_TOKEN") return "TEST-TOKEN";
    if (key === "TELEGRAM_SECRET_TOKEN") return "secret-abc";
    if (key === "TELEGRAM_USER_ID_WHITELIST") return "12345";
    return "";
  },
}));

vi.mock("~/lib/telegram", () => ({
  sendMessage: vi.fn().mockResolvedValue({ message_id: 1, chat: { id: 1 }, date: 1 }),
  getFilePath: vi.fn(),
  downloadFile: vi.fn(),
}));

import { POST } from "./webhook";

function makeRequest(body: object, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("telegram webhook auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects request without secret token header (401)", async () => {
    const r = await POST({ request: makeRequest({ update_id: 1 }) } as any);
    expect(r.status).toBe(401);
  });

  test("rejects request with wrong secret token (401)", async () => {
    const r = await POST({
      request: makeRequest({ update_id: 1 }, { "X-Telegram-Bot-Api-Secret-Token": "wrong" }),
    } as any);
    expect(r.status).toBe(401);
  });

  test("rejects message from non-whitelisted user (200, ignored)", async () => {
    const r = await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 99999 }, chat: { id: 99999 }, text: "ciao" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect(r.status).toBe(200); // we always return 200 to Telegram to prevent retries
  });

  test("accepts message from whitelisted user", async () => {
    const r = await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: "/start" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect(r.status).toBe(200);
  });
});

import { createClient, type Client } from "@libsql/client";

let db: Client;
vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

import { __resetEnsured as resetIdeas, listIdeas } from "~/lib/editorial-ideas";

describe("/idea handler", () => {
  beforeEach(() => {
    db = createClient({ url: ":memory:" });
    resetIdeas();
  });

  test("/idea <text> creates an idea and confirms", async () => {
    const r = await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            text: "/idea Scrivere su Result Pattern in TypeScript",
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect(r.status).toBe(200);

    const ideas = await listIdeas("idea");
    expect(ideas).toHaveLength(1);
    expect(ideas[0].text).toBe("Scrivere su Result Pattern in TypeScript");
    expect(ideas[0].source).toBe("manual");
  });

  test("/idea without text replies with help", async () => {
    const { sendMessage } = await import("~/lib/telegram");
    (sendMessage as any).mockClear();
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: "/idea" },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect((sendMessage as any).mock.calls[0][1]).toContain("Uso");
  });

  test("plain text without leading slash is saved as idea too", async () => {
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            text: "una bella idea sul mestiere doppio",
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const ideas = await listIdeas("idea");
    expect(ideas).toHaveLength(1);
    expect(ideas[0].text).toContain("mestiere doppio");
  });
});

describe("/list handler", () => {
  beforeEach(() => {
    db = createClient({ url: ":memory:" });
    resetIdeas();
  });

  test("/list with no ideas replies with empty state", async () => {
    const { sendMessage } = await import("~/lib/telegram");
    (sendMessage as any).mockClear();
    await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: "/list" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect((sendMessage as any).mock.calls[0][1]).toContain("Nessuna idea");
  });

  test("/list shows ideas with id and text", async () => {
    const { sendMessage } = await import("~/lib/telegram");
    const { createIdea } = await import("~/lib/editorial-ideas");
    await createIdea({ text: "scrivere su X", source: "manual" });
    await createIdea({ text: "altro pezzo", source: "voice" });
    (sendMessage as any).mockClear();
    await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: "/list" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const reply = (sendMessage as any).mock.calls[0][1] as string;
    expect(reply).toContain("scrivere su X");
    expect(reply).toContain("altro pezzo");
  });
});

describe("/done handler", () => {
  beforeEach(() => {
    db = createClient({ url: ":memory:" });
    resetIdeas();
  });

  test("/done <id> marks the idea as published", async () => {
    const { createIdea, getIdea } = await import("~/lib/editorial-ideas");
    const id = await createIdea({ text: "test", source: "manual" });
    await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: `/done ${id}` } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const idea = await getIdea(id);
    expect(idea?.status).toBe("published");
  });

  test("/done with invalid id replies with error", async () => {
    const { sendMessage } = await import("~/lib/telegram");
    (sendMessage as any).mockClear();
    await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: "/done abc" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect((sendMessage as any).mock.calls[0][1]).toContain("Uso");
  });
});
