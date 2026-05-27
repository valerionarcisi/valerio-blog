import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/env", () => ({
  env: (key: string) => (key === "OPENAI_API_KEY" ? "sk-test" : ""),
}));

import { transcribe } from "./whisper";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("whisper", () => {
  test("transcribe POSTs multipart to OpenAI endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "buongiorno mondo" }), { status: 200 }),
    );
    const audio = new Uint8Array([0xff, 0xd8, 0x00]).buffer;
    const text = await transcribe(audio, "voice.oga", "it");
    expect(text).toBe("buongiorno mondo");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    expect(init.body).toBeInstanceOf(FormData);
  });

  test("transcribe throws if OpenAI returns error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 }),
    );
    const audio = new ArrayBuffer(10);
    await expect(transcribe(audio, "voice.oga")).rejects.toThrow("rate limited");
  });
});
