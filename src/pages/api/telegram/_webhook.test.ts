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
