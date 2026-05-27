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

vi.mock("~/lib/whisper", () => ({
  transcribe: vi.fn().mockResolvedValue("idea trascritta dalla voce"),
}));

vi.mock("~/lib/image-processing", async () => {
  const sharp = (await import("sharp")).default;
  return {
    processUpload: vi.fn(async () => {
      const buf = await sharp({
        create: { width: 100, height: 100, channels: 3, background: "white" },
      })
        .jpeg()
        .toBuffer();
      return { buffer: buf, width: 100, height: 100, format: "jpeg" as const };
    }),
    buildUploadPath: vi.fn(() => ({
      dir: "public/img/uploads/2026-05-27",
      filename: "test123.jpg",
      webPath: "/img/uploads/2026-05-27/test123.jpg",
    })),
  };
});

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
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
import { __resetEnsured as resetMedia, listMedia } from "~/lib/media-library";

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

describe("voice message handler", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    resetIdeas();
    const { getFilePath, downloadFile } = await import("~/lib/telegram");
    (getFilePath as any).mockResolvedValue("voice/file_1.oga");
    (downloadFile as any).mockResolvedValue(new ArrayBuffer(100));
  });

  test("voice message is transcribed and saved as idea (source=voice)", async () => {
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            voice: { file_id: "AwACAg...", duration: 7, mime_type: "audio/ogg" },
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const { listIdeas } = await import("~/lib/editorial-ideas");
    const ideas = await listIdeas("idea");
    expect(ideas).toHaveLength(1);
    expect(ideas[0].text).toBe("idea trascritta dalla voce");
    expect(ideas[0].source).toBe("voice");
  });

  test("voice reply quotes the transcription in confirmation", async () => {
    const { sendMessage } = await import("~/lib/telegram");
    (sendMessage as any).mockClear();
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            voice: { file_id: "AwACAg...", duration: 7 },
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect((sendMessage as any).mock.calls[0][1]).toContain("idea trascritta dalla voce");
  });
});

describe("photo upload handler", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    resetIdeas();
    resetMedia();
    const { getFilePath, downloadFile } = await import("~/lib/telegram");
    (getFilePath as any).mockResolvedValue("photos/file_1.jpg");
    (downloadFile as any).mockResolvedValue(new ArrayBuffer(2000));
  });

  test("photo is processed and stored in media_library", async () => {
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            photo: [
              { file_id: "small", width: 100, height: 75 },
              { file_id: "medium", width: 800, height: 600 },
              { file_id: "large", width: 1600, height: 1200 },
            ],
            caption: "set di Falerone",
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const list = await listMedia(10);
    expect(list).toHaveLength(1);
    expect(list[0].caption).toBe("set di Falerone");
    expect(list[0].source).toBe("telegram");
    expect(list[0].filename).toBe("test123.jpg");
  });

  test("photo without caption is stored with null caption", async () => {
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            photo: [{ file_id: "x", width: 200, height: 200 }],
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const list = await listMedia(10);
    expect(list[0].caption).toBeNull();
  });

  test("photo handler picks the largest photo size from Telegram array", async () => {
    const { getFilePath } = await import("~/lib/telegram");
    (getFilePath as any).mockClear();
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            photo: [
              { file_id: "small", width: 100, height: 75 },
              { file_id: "large", width: 1600, height: 1200 },
            ],
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect((getFilePath as any).mock.calls[0][0]).toBe("large");
  });
});

describe("/media and /tag handlers", () => {
  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    resetIdeas();
    resetMedia();
  });

  test("/media list empty", async () => {
    const { sendMessage } = await import("~/lib/telegram");
    (sendMessage as any).mockClear();
    await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: "/media list" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect((sendMessage as any).mock.calls[0][1]).toContain("Nessuna foto");
  });

  test("/media list with entries", async () => {
    const { createMedia } = await import("~/lib/media-library");
    await createMedia({ filename: "a.jpg", path: "/img/uploads/2026-05-27/a.jpg", source: "telegram" });
    const { sendMessage } = await import("~/lib/telegram");
    (sendMessage as any).mockClear();
    await POST({
      request: makeRequest(
        { update_id: 1, message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: "/media list" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const reply = (sendMessage as any).mock.calls[0][1] as string;
    expect(reply).toContain("a.jpg");
  });

  test("/tag <id> <tags> updates the row", async () => {
    const { createMedia, getMedia } = await import("~/lib/media-library");
    const id = await createMedia({ filename: "a.jpg", path: "/x/a.jpg", source: "telegram" });
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: { message_id: 1, from: { id: 12345 }, chat: { id: 12345 }, text: `/tag ${id} set,falerone` },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const m = await getMedia(id);
    expect(m?.tags).toBe("set,falerone");
  });
});

describe("forward handler", () => {
  beforeEach(() => {
    db = createClient({ url: ":memory:" });
    resetIdeas();
  });

  test("forwarded message with URL is saved as idea source=forward", async () => {
    await POST({
      request: makeRequest(
        {
          update_id: 1,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345 },
            text: "Check this article: https://example.com/article",
            forward_from: { id: 999 },
            entities: [{ type: "url", offset: 21, length: 28, url: "https://example.com/article" }],
          },
        },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    const { listIdeas } = await import("~/lib/editorial-ideas");
    const ideas = await listIdeas("idea");
    expect(ideas).toHaveLength(1);
    expect(ideas[0].source).toBe("forward");
    expect(ideas[0].text).toContain("https://example.com/article");
  });
});
