import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/env", () => ({
  env: (key: string) => {
    if (key === "TELEGRAM_BOT_TOKEN") return "TEST-TOKEN";
    return "";
  },
}));

import { sendMessage, getFilePath, downloadFile } from "./telegram";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("telegram", () => {
  test("sendMessage POSTs to bot API with chat_id and text", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 7, chat: { id: 12345 }, date: 1 } }), { status: 200 }),
    );
    const r = await sendMessage(12345, "ciao");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("https://api.telegram.org/botTEST-TOKEN/sendMessage");
    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe(12345);
    expect(body.text).toBe("ciao");
    expect(r.message_id).toBe(7);
  });

  test("sendMessage attaches reply_markup if provided", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1, chat: { id: 1 }, date: 1 } }), { status: 200 }),
    );
    await sendMessage(1, "scegli", {
      reply_markup: {
        inline_keyboard: [[{ text: "Sì", callback_data: "yes" }]],
      },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_markup.inline_keyboard[0][0].text).toBe("Sì");
  });

  test("sendMessage throws if API returns ok=false", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, description: "Forbidden" }), { status: 200 }),
    );
    await expect(sendMessage(1, "x")).rejects.toThrow("Forbidden");
  });

  test("getFilePath fetches file_path from getFile endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: true, result: { file_path: "voice/file_1.oga" } }),
        { status: 200 },
      ),
    );
    const path = await getFilePath("ABC123");
    expect(path).toBe("voice/file_1.oga");
  });

  test("downloadFile fetches the raw bytes", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([0xff, 0xd8]), { status: 200 }),
    );
    const buf = await downloadFile("voice/file_1.oga");
    expect(new Uint8Array(buf)[0]).toBe(0xff);
  });
});
