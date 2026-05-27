# Idea Catcher (Telegram bot) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 agent (Idea Catcher) from `docs/superpowers/specs/2026-05-27-editorial-agents-design.md`: a Telegram bot that captures editorial ideas via `/idea` commands, voice messages (Whisper-transcribed), and photo uploads (sharp-processed), storing them in Turso for later use by the other agents.

**Architecture:** Single Astro API route at `src/pages/api/telegram/webhook.ts` acts as Telegram webhook receiver. Webhook validates the `X-Telegram-Bot-Api-Secret-Token` header + a Telegram user-ID whitelist. Message routing branches to handlers (text command, plain text, voice, photo, forward). Two new Turso tables: `editorial_ideas` and `media_library`. Whisper for voice transcription. Sharp for photo processing.

**Tech Stack:** Astro 5 server endpoints (`export const prerender = false`), @libsql/client 0.14, Vitest 4 with in-memory libsql for tests, sharp for image processing, native `fetch` for Telegram and OpenAI APIs (no extra deps).

---

## File Structure

**New files:**
- `src/lib/telegram.ts` — Telegram Bot API client wrapper (sendMessage, getFile, downloadFile)
- `src/lib/telegram.test.ts`
- `src/lib/editorial-ideas.ts` — DB layer for `editorial_ideas` table
- `src/lib/editorial-ideas.test.ts`
- `src/lib/media-library.ts` — DB layer for `media_library` table
- `src/lib/media-library.test.ts`
- `src/lib/whisper.ts` — OpenAI Whisper transcription helper
- `src/lib/whisper.test.ts`
- `src/lib/image-processing.ts` — sharp helpers (resize + JPEG + strip EXIF)
- `src/lib/image-processing.test.ts`
- `src/pages/api/telegram/webhook.ts` — webhook endpoint (one file, dispatches to handlers inline)
- `scripts/setup-telegram-webhook.ts` — one-off CLI to register webhook URL with Telegram
- `docs/setup/telegram-bot.md` — setup instructions

**Modified files:**
- None — all code is additive. Env vars added to Netlify dashboard (documented in setup doc, not committed).

**No new dependencies.** sharp and @libsql/client already present. Vitest already configured.

---

## Task 1: Editorial Ideas DB layer

**Files:**
- Create: `src/lib/editorial-ideas.ts`
- Test: `src/lib/editorial-ideas.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/editorial-ideas.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

import {
  ensureTable,
  createIdea,
  listIdeas,
  markIdeaStatus,
  getIdea,
} from "./editorial-ideas";

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
});

describe("editorial-ideas", () => {
  test("ensureTable creates the table idempotently", async () => {
    await ensureTable();
    await ensureTable();
    const res = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='editorial_ideas'",
    );
    expect(res.rows).toHaveLength(1);
  });

  test("createIdea inserts and returns the id", async () => {
    await ensureTable();
    const id = await createIdea({ text: "Scrivere su Result Pattern", source: "manual" });
    expect(id).toBeGreaterThan(0);
  });

  test("listIdeas returns ideas with status idea by default", async () => {
    await ensureTable();
    await createIdea({ text: "uno", source: "manual" });
    await createIdea({ text: "due", source: "voice" });
    const ideas = await listIdeas();
    expect(ideas).toHaveLength(2);
    expect(ideas[0].text).toBe("due"); // most recent first
  });

  test("listIdeas can filter by status", async () => {
    await ensureTable();
    const id = await createIdea({ text: "uno", source: "manual" });
    await markIdeaStatus(id, "published");
    const open = await listIdeas("idea");
    const pub = await listIdeas("published");
    expect(open).toHaveLength(0);
    expect(pub).toHaveLength(1);
  });

  test("markIdeaStatus updates the row", async () => {
    await ensureTable();
    const id = await createIdea({ text: "x", source: "manual" });
    await markIdeaStatus(id, "drafting");
    const idea = await getIdea(id);
    expect(idea?.status).toBe("drafting");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
nvm use 20 && pnpm vitest run src/lib/editorial-ideas.test.ts
```

Expected: FAIL — module `./editorial-ideas` does not exist.

- [ ] **Step 3: Implement the module**

Create `src/lib/editorial-ideas.ts`:

```ts
import getDb from "~/lib/turso";

export type IdeaSource = "manual" | "voice" | "forward" | "analyst-suggested";
export type IdeaStatus = "idea" | "drafting" | "scheduled" | "published" | "archived";

export interface Idea {
  id: number;
  text: string;
  source: IdeaSource;
  column: string | null;
  status: IdeaStatus;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string | null;
}

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS editorial_ideas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  text          TEXT NOT NULL,
  source        TEXT NOT NULL,
  column        TEXT,
  status        TEXT NOT NULL DEFAULT 'idea',
  scheduled_for TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_editorial_ideas_status ON editorial_ideas(status);
CREATE INDEX IF NOT EXISTS idx_editorial_ideas_created_at ON editorial_ideas(created_at DESC);
`;

let ensured = false;

export async function ensureTable(): Promise<void> {
  if (ensured) return;
  await getDb().executeMultiple(TABLE_SQL);
  ensured = true;
}

export async function createIdea(input: {
  text: string;
  source: IdeaSource;
  column?: string | null;
}): Promise<number> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "INSERT INTO editorial_ideas (text, source, \"column\") VALUES (?, ?, ?) RETURNING id",
    args: [input.text, input.source, input.column ?? null],
  });
  return Number(r.rows[0].id);
}

export async function listIdeas(status: IdeaStatus = "idea", limit = 20): Promise<Idea[]> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM editorial_ideas WHERE status = ? ORDER BY created_at DESC LIMIT ?",
    args: [status, limit],
  });
  return r.rows as unknown as Idea[];
}

export async function getIdea(id: number): Promise<Idea | null> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM editorial_ideas WHERE id = ?",
    args: [id],
  });
  return (r.rows[0] as unknown as Idea) ?? null;
}

export async function markIdeaStatus(id: number, status: IdeaStatus): Promise<void> {
  await ensureTable();
  await getDb().execute({
    sql: "UPDATE editorial_ideas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [status, id],
  });
}
```

Note: `ensured` is module-level and short-circuits subsequent calls. In tests, each test gets a fresh in-memory db, so we reset it. Add this fix:

After the `let ensured = false;` line, expose a test-only reset:

```ts
// For testing only
export function __resetEnsured(): void {
  ensured = false;
}
```

And update test `beforeEach` to call it. Update the test file at the top of `beforeEach`:

```ts
beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  (await import("./editorial-ideas")).__resetEnsured();
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/editorial-ideas.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editorial-ideas.ts src/lib/editorial-ideas.test.ts
git commit -m "feat(agents): editorial_ideas DB layer

Tabella editorial_ideas + helpers createIdea, listIdeas, getIdea,
markIdeaStatus. ensureTable idempotente. Indici su status e created_at.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Media Library DB layer

**Files:**
- Create: `src/lib/media-library.ts`
- Test: `src/lib/media-library.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/media-library.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

import {
  ensureTable,
  createMedia,
  listMedia,
  tagMedia,
  deleteMedia,
  getMedia,
  __resetEnsured,
} from "./media-library";

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  __resetEnsured();
});

describe("media-library", () => {
  test("createMedia stores filename + path + source", async () => {
    await ensureTable();
    const id = await createMedia({
      filename: "2026-05-27-001.jpg",
      path: "public/img/uploads/2026-05-27/001.jpg",
      caption: "set di Falerone",
      source: "telegram",
    });
    expect(id).toBeGreaterThan(0);
    const m = await getMedia(id);
    expect(m?.filename).toBe("2026-05-27-001.jpg");
    expect(m?.caption).toBe("set di Falerone");
    expect(m?.tags).toBeNull();
  });

  test("listMedia returns latest first", async () => {
    await ensureTable();
    await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await createMedia({ filename: "b.jpg", path: "x/b.jpg", source: "telegram" });
    const list = await listMedia(10);
    expect(list[0].filename).toBe("b.jpg");
  });

  test("tagMedia appends tags", async () => {
    await ensureTable();
    const id = await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await tagMedia(id, ["set", "falerone"]);
    const m = await getMedia(id);
    expect(m?.tags).toBe("set,falerone");
  });

  test("deleteMedia removes the row", async () => {
    await ensureTable();
    const id = await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await deleteMedia(id);
    expect(await getMedia(id)).toBeNull();
  });

  test("createMedia rejects duplicate filename", async () => {
    await ensureTable();
    await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await expect(
      createMedia({ filename: "a.jpg", path: "y/a.jpg", source: "telegram" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/media-library.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/lib/media-library.ts`:

```ts
import getDb from "~/lib/turso";

export type MediaSource = "telegram" | "manual" | "screenshot";

export interface Media {
  id: number;
  filename: string;
  path: string;
  caption: string | null;
  tags: string | null;
  source: MediaSource;
  used_count: number;
  created_at: string;
}

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS media_library (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  filename    TEXT UNIQUE NOT NULL,
  path        TEXT NOT NULL,
  caption     TEXT,
  tags        TEXT,
  source      TEXT NOT NULL,
  used_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_library_created_at ON media_library(created_at DESC);
`;

let ensured = false;

export function __resetEnsured(): void {
  ensured = false;
}

export async function ensureTable(): Promise<void> {
  if (ensured) return;
  await getDb().executeMultiple(TABLE_SQL);
  ensured = true;
}

export async function createMedia(input: {
  filename: string;
  path: string;
  caption?: string | null;
  source: MediaSource;
}): Promise<number> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "INSERT INTO media_library (filename, path, caption, source) VALUES (?, ?, ?, ?) RETURNING id",
    args: [input.filename, input.path, input.caption ?? null, input.source],
  });
  return Number(r.rows[0].id);
}

export async function listMedia(limit = 10): Promise<Media[]> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM media_library ORDER BY created_at DESC LIMIT ?",
    args: [limit],
  });
  return r.rows as unknown as Media[];
}

export async function getMedia(id: number): Promise<Media | null> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM media_library WHERE id = ?",
    args: [id],
  });
  return (r.rows[0] as unknown as Media) ?? null;
}

export async function tagMedia(id: number, tags: string[]): Promise<void> {
  await ensureTable();
  const csv = tags.map((t) => t.trim().toLowerCase()).filter(Boolean).join(",");
  await getDb().execute({
    sql: "UPDATE media_library SET tags = ? WHERE id = ?",
    args: [csv, id],
  });
}

export async function deleteMedia(id: number): Promise<void> {
  await ensureTable();
  await getDb().execute({
    sql: "DELETE FROM media_library WHERE id = ?",
    args: [id],
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/media-library.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/media-library.ts src/lib/media-library.test.ts
git commit -m "feat(agents): media_library DB layer

Tabella media_library + helpers createMedia, listMedia, tagMedia,
deleteMedia, getMedia. filename UNIQUE per evitare duplicati.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Telegram API client

**Files:**
- Create: `src/lib/telegram.ts`
- Test: `src/lib/telegram.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/telegram.test.ts`:

```ts
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
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 }),
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
      new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }),
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/telegram.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/lib/telegram.ts`:

```ts
import { env } from "~/lib/env";

const API_BASE = "https://api.telegram.org";

function api(path: string): string {
  return `${API_BASE}/bot${env("TELEGRAM_BOT_TOKEN")}${path}`;
}

interface SendMessageOptions {
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  disable_web_page_preview?: boolean;
  reply_to_message_id?: number;
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  };
}

interface SendMessageResponse {
  message_id: number;
  chat: { id: number };
  date: number;
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: SendMessageOptions,
): Promise<SendMessageResponse> {
  const r = await fetch(api("/sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
  const data = (await r.json()) as { ok: boolean; result?: SendMessageResponse; description?: string };
  if (!data.ok) throw new Error(data.description ?? "Telegram API error");
  return data.result!;
}

export async function getFilePath(fileId: string): Promise<string> {
  const r = await fetch(api(`/getFile?file_id=${encodeURIComponent(fileId)}`));
  const data = (await r.json()) as { ok: boolean; result?: { file_path: string }; description?: string };
  if (!data.ok) throw new Error(data.description ?? "getFile failed");
  return data.result!.file_path;
}

export async function downloadFile(filePath: string): Promise<ArrayBuffer> {
  const url = `${API_BASE}/file/bot${env("TELEGRAM_BOT_TOKEN")}/${filePath}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`downloadFile HTTP ${r.status}`);
  return r.arrayBuffer();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/telegram.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram.ts src/lib/telegram.test.ts
git commit -m "feat(agents): Telegram Bot API client

Wrapper minimal su Bot API: sendMessage (con inline_keyboard support),
getFilePath, downloadFile. Niente dipendenze esterne, solo fetch.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Whisper transcription helper

**Files:**
- Create: `src/lib/whisper.ts`
- Test: `src/lib/whisper.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/whisper.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/whisper.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/lib/whisper.ts`:

```ts
import { env } from "~/lib/env";

export async function transcribe(
  audio: ArrayBuffer,
  filename: string,
  language: string = "it",
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio]), filename);
  form.append("model", "whisper-1");
  form.append("language", language);
  form.append("response_format", "json");

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}` },
    body: form,
  });
  const data = (await r.json()) as { text?: string; error?: { message: string } };
  if (!r.ok || data.error) throw new Error(data.error?.message ?? `Whisper HTTP ${r.status}`);
  return data.text!.trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/whisper.test.ts
```

Expected: Both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whisper.ts src/lib/whisper.test.ts
git commit -m "feat(agents): OpenAI Whisper transcription helper

Singola funzione transcribe(audio, filename, language). Default language=it.
Throw chiaro su errori API (rate limit, autenticazione).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Image processing helper

**Files:**
- Create: `src/lib/image-processing.ts`
- Test: `src/lib/image-processing.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/image-processing.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import sharp from "sharp";
import { processUpload } from "./image-processing";

async function makeTestPng(width: number, height: number): Promise<ArrayBuffer> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("image-processing", () => {
  test("processUpload resizes oversized images to maxWidth 1600", async () => {
    const input = await makeTestPng(3000, 2000);
    const { buffer, width, height } = await processUpload(input);
    expect(width).toBe(1600);
    expect(height).toBeLessThanOrEqual(1067);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("jpeg");
  });

  test("processUpload leaves smaller images alone", async () => {
    const input = await makeTestPng(800, 600);
    const { width, height } = await processUpload(input);
    expect(width).toBe(800);
    expect(height).toBe(600);
  });

  test("processUpload strips EXIF metadata", async () => {
    // sharp.metadata().exif is undefined when stripped
    const input = await makeTestPng(1000, 750);
    const { buffer } = await processUpload(input);
    const meta = await sharp(buffer).metadata();
    expect(meta.exif).toBeUndefined();
  });

  test("processUpload outputs JPEG at quality ~82", async () => {
    const input = await makeTestPng(2000, 1500);
    const { buffer } = await processUpload(input);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("jpeg");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/image-processing.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/lib/image-processing.ts`:

```ts
import sharp from "sharp";

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 82;

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: "jpeg";
}

export async function processUpload(input: ArrayBuffer | Buffer | Uint8Array): Promise<ProcessedImage> {
  const inputBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input as ArrayBuffer);
  const pipeline = sharp(inputBuffer).resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
  });

  const output = await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .withMetadata({ exif: {} }) // strip EXIF
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    width: output.info.width,
    height: output.info.height,
    format: "jpeg",
  };
}

export function buildUploadPath(now: Date = new Date()): { dir: string; filename: string; webPath: string } {
  const date = now.toISOString().slice(0, 10);
  const id = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
  const filename = `${id}.jpg`;
  const dir = `public/img/uploads/${date}`;
  const webPath = `/img/uploads/${date}/${filename}`;
  return { dir, filename, webPath };
}
```

Note on `.withMetadata({ exif: {} })`: this is the sharp pattern to keep orientation but strip user-added EXIF. If sharp >=0.33 the test for `meta.exif === undefined` should pass. If not, adjust to use `.withMetadata(false)` and accept that orientation is also stripped.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/image-processing.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image-processing.ts src/lib/image-processing.test.ts
git commit -m "feat(agents): image processing helper

processUpload(buf): resize 1600px max, JPEG q82 mozjpeg, strip EXIF.
buildUploadPath(): YYYY-MM-DD folder + base36 id filename, web path
in public/img/uploads/...

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Webhook skeleton with auth + whitelist

**Files:**
- Create: `src/pages/api/telegram/webhook.ts`
- Test: `src/pages/api/telegram/_webhook.test.ts`

> **Nota:** il file di test ha prefisso `_` perché Astro ignora i file con prefisso underscore in `src/pages/`. Un `webhook.test.ts` verrebbe altrimenti interpretato come route `/api/telegram/webhook.test`.

- [ ] **Step 1: Write failing tests**

Create `src/pages/api/telegram/_webhook.test.ts`:

```ts
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
  sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
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
        { update_id: 1, message: { from: { id: 99999 }, chat: { id: 99999 }, text: "ciao" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect(r.status).toBe(200); // we always return 200 to Telegram to prevent retries
  });

  test("accepts message from whitelisted user", async () => {
    const r = await POST({
      request: makeRequest(
        { update_id: 1, message: { from: { id: 12345 }, chat: { id: 12345 }, text: "/start" } },
        { "X-Telegram-Bot-Api-Secret-Token": "secret-abc" },
      ),
    } as any);
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the skeleton**

Create `src/pages/api/telegram/webhook.ts`:

```ts
import type { APIRoute } from "astro";
import { env } from "~/lib/env";
import { sendMessage } from "~/lib/telegram";

export const prerender = false;

interface TelegramUser {
  id: number;
}

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  voice?: { file_id: string; duration: number; mime_type?: string };
  audio?: { file_id: string };
  photo?: Array<{ file_id: string; width: number; height: number }>;
  caption?: string;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  entities?: Array<{ type: string; offset: number; length: number; url?: string }>;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

function isWhitelisted(userId: number): boolean {
  const whitelist = env("TELEGRAM_USER_ID_WHITELIST")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  return whitelist.includes(userId);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secret !== env("TELEGRAM_SECRET_TOKEN")) {
    return new Response("unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const message = update.message;
  if (!message?.from) return new Response("ok", { status: 200 });

  if (!isWhitelisted(message.from.id)) {
    // Silently ignore, return 200 so Telegram doesn't retry
    return new Response("ok", { status: 200 });
  }

  try {
    await handleMessage(message);
  } catch (err) {
    console.error("[telegram-webhook]", err);
    // still return 200 so Telegram doesn't retry; alert via sendMessage if possible
    try {
      await sendMessage(message.chat.id, `⚠️ Errore: ${(err as Error).message}`);
    } catch {
      // ignored
    }
  }
  return new Response("ok", { status: 200 });
};

async function handleMessage(message: TelegramMessage): Promise<void> {
  // Stub for now; handlers will be added in subsequent tasks.
  if (message.text === "/start") {
    await sendMessage(message.chat.id, "Idea Catcher attivo. /idea <testo> per salvare un'idea.");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): Telegram webhook skeleton with auth + whitelist

POST /api/telegram/webhook valida X-Telegram-Bot-Api-Secret-Token e
TELEGRAM_USER_ID_WHITELIST. Errori loggati ma sempre 200 a Telegram
(no retry). Handler /start stub. I command veri arrivano nei task
successivi.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: /idea command handler

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts`
- Modify: `src/pages/api/telegram/_webhook.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/pages/api/telegram/_webhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Update handler**

Replace the `handleMessage` function in `src/pages/api/telegram/webhook.ts` with:

```ts
import { createIdea } from "~/lib/editorial-ideas";

async function handleMessage(message: TelegramMessage): Promise<void> {
  const text = (message.text ?? "").trim();
  if (!text) return;

  if (text === "/start") {
    await sendMessage(
      message.chat.id,
      "Idea Catcher attivo.\n\n/idea <testo> — salva un'idea\n/list — vedi le idee in coda\nMessaggio vocale o foto → li gestisco anche da soli.",
    );
    return;
  }

  if (text === "/idea") {
    await sendMessage(message.chat.id, "Uso: /idea <testo della tua idea>");
    return;
  }

  if (text.startsWith("/idea ")) {
    const ideaText = text.slice(6).trim();
    const id = await createIdea({ text: ideaText, source: "manual" });
    await sendMessage(message.chat.id, `✅ Idea #${id} salvata.`);
    return;
  }

  // Plain text (no command) → save as idea
  if (!text.startsWith("/")) {
    const id = await createIdea({ text, source: "manual" });
    await sendMessage(message.chat.id, `✅ Idea #${id} salvata (testo libero).`);
    return;
  }
}
```

Add at top of file:

```ts
import { createIdea } from "~/lib/editorial-ideas";
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): /idea command + plain text idea capture

/idea <testo> salva un'idea source=manual.
Testo libero senza comando viene salvato come idea (capture senza fatica).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: /list command handler

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts`
- Modify: `src/pages/api/telegram/_webhook.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/pages/api/telegram/_webhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update handler**

Add to `src/pages/api/telegram/webhook.ts`:

```ts
import { listIdeas } from "~/lib/editorial-ideas";
```

And inside `handleMessage`, add this branch before the plain-text fallback:

```ts
  if (text === "/list") {
    const ideas = await listIdeas("idea", 20);
    if (!ideas.length) {
      await sendMessage(message.chat.id, "Nessuna idea in coda. Mandane una con /idea o testo libero.");
      return;
    }
    const lines = ideas.map((i) => `#${i.id} · ${i.text.slice(0, 80)}${i.text.length > 80 ? "…" : ""}`);
    await sendMessage(message.chat.id, lines.join("\n"));
    return;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): /list comando per vedere idee in coda

Lista idee con status=idea, ordinate per data desc, max 20.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: /done command handler

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts`
- Modify: `src/pages/api/telegram/_webhook.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/pages/api/telegram/_webhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update handler**

Add to imports in `src/pages/api/telegram/webhook.ts`:

```ts
import { listIdeas, createIdea, markIdeaStatus } from "~/lib/editorial-ideas";
```

(Replace the existing two separate imports with this consolidated one.)

Inside `handleMessage`, add this branch before the plain-text fallback:

```ts
  if (text.startsWith("/done ")) {
    const idStr = text.slice(6).trim();
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      await sendMessage(message.chat.id, "Uso: /done <id idea>");
      return;
    }
    await markIdeaStatus(id, "published");
    await sendMessage(message.chat.id, `✅ Idea #${id} archiviata come published.`);
    return;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): /done <id> command

Marca idea come published. Validazione id numerico.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Voice message → transcribe → idea

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts`
- Modify: `src/pages/api/telegram/_webhook.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/pages/api/telegram/_webhook.test.ts`:

```ts
vi.mock("~/lib/whisper", () => ({
  transcribe: vi.fn().mockResolvedValue("idea trascritta dalla voce"),
}));

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update handler**

Add to imports in `src/pages/api/telegram/webhook.ts`:

```ts
import { sendMessage, getFilePath, downloadFile } from "~/lib/telegram";
import { transcribe } from "~/lib/whisper";
```

Add this branch INSIDE `handleMessage` BEFORE the text-based branches (voice/audio is detected separately from text):

```ts
  if (message.voice || message.audio) {
    const fileId = (message.voice ?? message.audio)!.file_id;
    const filePath = await getFilePath(fileId);
    const audio = await downloadFile(filePath);
    const transcript = await transcribe(audio, "voice.oga", "it");
    const id = await createIdea({ text: transcript, source: "voice" });
    await sendMessage(
      message.chat.id,
      `🎙️ Trascritto: "${transcript}"\n\n✅ Idea #${id} salvata.`,
    );
    return;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): messaggi vocali → trascrizione Whisper → idea

Voce o audio in arrivo: download file da Telegram, trascrivi via
Whisper (lang=it), salva come idea source=voice, conferma mostrando
la trascrizione.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Photo upload → media_library

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts`
- Modify: `src/pages/api/telegram/_webhook.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/pages/api/telegram/_webhook.test.ts`:

```ts
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

import { __resetEnsured as resetMedia, listMedia } from "~/lib/media-library";

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Update handler**

Add imports to `src/pages/api/telegram/webhook.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { processUpload, buildUploadPath } from "~/lib/image-processing";
import { createMedia } from "~/lib/media-library";
```

Inside `handleMessage`, add this branch BEFORE the voice branch:

```ts
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
    const filePath = await getFilePath(largest.file_id);
    const raw = await downloadFile(filePath);
    const processed = await processUpload(raw);
    const { dir, filename, webPath } = buildUploadPath();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), processed.buffer);
    const id = await createMedia({
      filename,
      path: webPath,
      caption: message.caption ?? null,
      source: "telegram",
    });
    await sendMessage(
      message.chat.id,
      `📷 Foto #${id} salvata (${processed.width}×${processed.height}).\n\n` +
        `Aggiungi tag con /tag ${id} <tag1,tag2,...> o usala con /useimage ${id}.`,
    );
    return;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): foto upload → media_library

Riceve foto Telegram (sceglie la risoluzione più alta dell'array),
processa con sharp (1600px, q82, no EXIF), salva su disk
public/img/uploads/YYYY-MM-DD/<id>.jpg, registra in media_library.
Caption Telegram salvata come caption media.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: /media list + /tag commands

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts`
- Modify: `src/pages/api/telegram/_webhook.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/pages/api/telegram/_webhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Update handler**

Add imports to `src/pages/api/telegram/webhook.ts`:

```ts
import { createMedia, listMedia, tagMedia } from "~/lib/media-library";
```

(Replace the single `createMedia` import.)

Inside `handleMessage`, add these branches before the plain-text fallback:

```ts
  if (text === "/media list" || text === "/media") {
    const list = await listMedia(10);
    if (!list.length) {
      await sendMessage(message.chat.id, "Nessuna foto in libreria. Mandami uno scatto.");
      return;
    }
    const lines = list.map((m) => `#${m.id} · ${m.filename}${m.caption ? ` — ${m.caption.slice(0, 50)}` : ""}`);
    await sendMessage(message.chat.id, lines.join("\n"));
    return;
  }

  if (text.startsWith("/tag ")) {
    const rest = text.slice(5).trim();
    const m = rest.match(/^(\d+)\s+(.+)$/);
    if (!m) {
      await sendMessage(message.chat.id, "Uso: /tag <id media> <tag1,tag2,...>");
      return;
    }
    const id = Number(m[1]);
    const tags = m[2].split(/[,\s]+/).filter(Boolean);
    await tagMedia(id, tags);
    await sendMessage(message.chat.id, `🏷️ Foto #${id} taggata: ${tags.join(", ")}`);
    return;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): /media list + /tag <id> <tags>

/media list: ultime 10 foto della libreria.
/tag <id> <tags>: assegna tag csv-encoded a una foto esistente.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Forward (URL) → idea with source=forward

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts`
- Modify: `src/pages/api/telegram/_webhook.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/pages/api/telegram/_webhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: 1 new test FAILS (the plain-text fallback is saving it with source=manual).

- [ ] **Step 3: Update handler**

In `src/pages/api/telegram/webhook.ts`, replace the plain-text fallback in `handleMessage` with:

```ts
  // Plain text or forward → save as idea
  if (!text.startsWith("/")) {
    const isForward = !!(message.forward_from || message.forward_from_chat);
    const source = isForward ? "forward" : "manual";
    const id = await createIdea({ text, source });
    const label = isForward ? "📨 Forward salvato" : "✅ Idea salvata";
    await sendMessage(message.chat.id, `${label} #${id}.`);
    return;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/pages/api/telegram/_webhook.test.ts
```

Expected: All 20 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/telegram/webhook.ts src/pages/api/telegram/_webhook.test.ts
git commit -m "feat(agents): forward Telegram → idea source=forward

Distinzione tra plain text manuale e forward (Telegram setta
forward_from o forward_from_chat) per tracciare la provenienza.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Setup webhook script

**Files:**
- Create: `scripts/setup-telegram-webhook.ts`

- [ ] **Step 1: Create the script**

Create `scripts/setup-telegram-webhook.ts`:

```ts
#!/usr/bin/env -S node --import tsx
/**
 * One-off script: registra la webhook URL con Telegram + secret token.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_SECRET_TOKEN=yyy \
 *   WEBHOOK_URL=https://valerionarcisi.me/api/telegram/webhook \
 *   pnpm tsx scripts/setup-telegram-webhook.ts
 *
 * Per rimuovere: WEBHOOK_URL="" pnpm tsx scripts/setup-telegram-webhook.ts
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_SECRET_TOKEN;
const url = process.env.WEBHOOK_URL;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN mancante");
  process.exit(1);
}

const apiBase = `https://api.telegram.org/bot${token}`;

async function main(): Promise<void> {
  if (url === "" || url === undefined) {
    // Remove webhook
    const r = await fetch(`${apiBase}/deleteWebhook?drop_pending_updates=true`);
    const data = await r.json();
    console.log("deleteWebhook:", data);
    return;
  }
  if (!secret) {
    console.error("TELEGRAM_SECRET_TOKEN mancante. Generane uno: openssl rand -hex 32");
    process.exit(1);
  }
  const params = new URLSearchParams({
    url,
    secret_token: secret,
    allowed_updates: JSON.stringify(["message"]),
    drop_pending_updates: "true",
  });
  const r = await fetch(`${apiBase}/setWebhook?${params}`);
  const data = await r.json();
  console.log("setWebhook:", data);

  const info = await fetch(`${apiBase}/getWebhookInfo`);
  console.log("getWebhookInfo:", await info.json());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/setup-telegram-webhook.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-telegram-webhook.ts
git commit -m "feat(agents): scripts/setup-telegram-webhook.ts

CLI one-off per registrare/rimuovere la webhook Telegram.
Logga lo stato via getWebhookInfo dopo setWebhook.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: Setup documentation

**Files:**
- Create: `docs/setup/telegram-bot.md`

- [ ] **Step 1: Write the doc**

Create `docs/setup/telegram-bot.md`:

```markdown
# Telegram Idea Catcher — Setup

Setup one-time per attivare il bot Telegram Idea Catcher (Fase 1 agents).

## 1. Crea il bot con BotFather

1. Apri Telegram, cerca `@BotFather`, avvia chat
2. `/newbot`
3. Nome bot: "Valerio Editorial" (mostrato in chat)
4. Username: `valerio_editorial_bot` (deve finire in `_bot`)
5. BotFather ti dà il **token**, formato `123456:ABC-DEF...` → salvalo come `TELEGRAM_BOT_TOKEN`
6. Disabilita il join-to-group e privacy mode (irrilevanti, è solo per te):
   - `/setjoingroups` → `valerio_editorial_bot` → Disable
   - `/setprivacy` → `valerio_editorial_bot` → Enable (privacy mode ON = il bot vede solo i messaggi a lui diretti)

## 2. Trova il tuo Telegram user ID

1. In Telegram, cerca `@userinfobot`, avvia, ti risponde col tuo user ID numerico
2. Salvalo come `TELEGRAM_USER_ID_WHITELIST` (formato: `123456789`, separare con virgola se più di uno)

## 3. Genera un secret token

```bash
openssl rand -hex 32
```

Salvalo come `TELEGRAM_SECRET_TOKEN`. Serve a validare che le request al webhook siano davvero da Telegram.

## 4. Configura le env vars su Netlify

In `https://app.netlify.com/sites/<your-site>/settings/env`:

| Variabile | Valore |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456:ABC-DEF...` (da BotFather) |
| `TELEGRAM_SECRET_TOKEN` | output di `openssl rand -hex 32` |
| `TELEGRAM_USER_ID_WHITELIST` | il tuo user id numerico |
| `OPENAI_API_KEY` | da https://platform.openai.com/api-keys (serve per Whisper) |

Deploy il sito una volta (Netlify ridistribuirà con le nuove env).

## 5. Registra la webhook con Telegram

Da locale:

```bash
TELEGRAM_BOT_TOKEN=xxx \
TELEGRAM_SECRET_TOKEN=yyy \
WEBHOOK_URL=https://valerionarcisi.me/api/telegram/webhook \
pnpm tsx scripts/setup-telegram-webhook.ts
```

Output atteso:

```
setWebhook: { ok: true, result: true, description: 'Webhook was set' }
getWebhookInfo: { ok: true, result: { url: 'https://valerionarcisi.me/...', pending_update_count: 0, ... } }
```

## 6. Smoke test

Apri Telegram, scrivi al bot:

1. `/start` → risposta con elenco comandi
2. `/idea Scrivere un pezzo su X` → risposta `✅ Idea #1 salvata.`
3. `/list` → mostra `#1 · Scrivere un pezzo su X`
4. Messaggio vocale di 5 secondi → trascrizione + idea salvata
5. Foto qualsiasi → conferma con id media
6. `/done 1` → idea archiviata
7. `/media list` → mostra la foto
8. `/tag 1 set,test` → tag assegnati

## Rimuovere la webhook

```bash
TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL="" pnpm tsx scripts/setup-telegram-webhook.ts
```

## Troubleshooting

- **401 dal webhook**: secret token sbagliato (verifica match esatto tra Netlify env e quanto passato a `setWebhook`)
- **200 ma niente risposta**: user id non in whitelist, oppure errore interno (vedi log Netlify Functions)
- **Whisper errore**: `OPENAI_API_KEY` mancante o quota esaurita
- **Foto non salvate**: Netlify Functions hanno filesystem read-only — la writeFile in `public/img/uploads/` fallirà. Vedi *Limitazione importante* sotto.

## Limitazione importante: filesystem read-only

Netlify Functions girano in un container con filesystem read-only eccetto `/tmp`. Il salvataggio diretto in `public/img/uploads/` NON funziona in produzione.

**Soluzioni** (in ordine di preferenza):

1. **Salvare in `/tmp` + upload a Netlify Blobs** (storage gratuito Netlify, accessibile via URL pubblico)
2. **Upload diretto a un bucket S3/Cloudflare R2** e salvare l'URL in `media_library.path`
3. **Salvare base64 in DB** (cattiva idea, esplode rapidamente)

Implementazione consigliata: Netlify Blobs. Il task di follow-up dovrà sostituire `fs.writeFile` con `getStore(...).set(...)`. Per la Fase 1 locale, fs.writeFile funziona; per il deploy production servono Netlify Blobs.

Questo task di refactor è registrato come **follow-up** e non blocca la chiusura della Fase 1 in dev.
```

- [ ] **Step 2: Commit**

```bash
git add docs/setup/telegram-bot.md
git commit -m "docs(agents): setup guide per Telegram Idea Catcher

BotFather + user ID + secret token + Netlify env + setWebhook + smoke
test + troubleshooting. Limitazione filesystem read-only documentata
come follow-up obbligatorio prima del deploy production.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: Final integration test + cleanup

**Files:**
- Modify: `src/pages/api/telegram/webhook.ts` — verifica che tutto sia coerente
- Run full test suite

- [ ] **Step 1: Run the whole test suite**

```bash
pnpm vitest run
```

Expected: all tests pass, including pre-existing ones (analytics, comments, claps, meditation, etc.)

- [ ] **Step 2: Run `pnpm build` per essere sicuri che TypeScript sia happy**

```bash
nvm use 20 && pnpm build
```

Expected: build succeeds. Se ci sono errori TS in `src/pages/api/telegram/webhook.ts` (es. tipi mancanti), aggiusta.

- [ ] **Step 3: Verifica che nessun import sia rotto**

```bash
grep -rn "from \"~/lib/telegram\"\\|from \"~/lib/editorial-ideas\"\\|from \"~/lib/media-library\"\\|from \"~/lib/whisper\"\\|from \"~/lib/image-processing\"" src/
```

Aspettato: solo gli import che hai messo tu, niente import orfani.

- [ ] **Step 4: Commit finale (se sono serviti aggiustamenti)**

Se hai dovuto aggiustare qualcosa per il build:

```bash
git add -A
git commit -m "fix(agents): TypeScript build issues post integration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

Altrimenti salta questo step.

- [ ] **Step 5: Push & deploy**

```bash
git push origin main
```

Netlify build parte automaticamente. Aspetta che il deploy sia live, poi esegui il smoke test del Task 15 / Step 6.

---

## Out of scope per questa fase (follow-up tasks futuri)

- **Netlify Blobs storage** per le foto (filesystem read-only su Functions production). Documentato nel setup doc, da implementare prima del deploy production reale.
- **Comandi `/draft`, `/voice`-interpretation (intent NLP)**: questi sono Fase 6 della roadmap (Drafter), fuori scope.
- **Daily/Weekly digest cron**: questo è il ruolo di Analyst (Fase 4).
- **Distributor / Curator / Analyst / IG Story Publisher**: fasi successive.
- **OAuth setup per LinkedIn/Bluesky/Reddit**: Fase 2-3, fuori scope per Idea Catcher standalone.

## Verifica post-implementazione

Dopo aver completato tutti i task, il sistema dovrebbe:

- [x] Bot Telegram risponde a `/start`
- [x] `/idea <testo>` salva un'idea
- [x] Testo libero (senza `/`) salva un'idea
- [x] `/list` mostra le idee in coda
- [x] `/done <id>` archivia un'idea come published
- [x] Messaggio vocale viene trascritto e salvato
- [x] Foto viene processata (sharp) e salvata in media_library (in dev locale)
- [x] `/media list` mostra le foto in libreria
- [x] `/tag <id> <csv>` aggiunge tag a una foto
- [x] Forward Telegram salva idea con source=forward
- [x] Webhook rifiuta request senza secret token (401)
- [x] Webhook ignora messaggi da user fuori whitelist (200 silent)
- [x] Errori interni loggati ma webhook sempre 200 a Telegram (no retry storms)
- [x] Tutti i test verdi (`pnpm vitest run`)
- [x] Build verde (`pnpm build`)

Quando tutti i flag sono verdi, la Fase 1 è chiusa.
