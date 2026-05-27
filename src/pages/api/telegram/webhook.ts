import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "~/lib/env";
import { sendMessage, getFilePath, downloadFile } from "~/lib/telegram";
import { transcribe } from "~/lib/whisper";
import { createIdea, listIdeas, markIdeaStatus } from "~/lib/editorial-ideas";
import { processUpload, buildUploadPath } from "~/lib/image-processing";
import { createMedia, listMedia, tagMedia } from "~/lib/media-library";

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
    return new Response("ok", { status: 200 });
  }

  try {
    await handleMessage(message);
  } catch (err) {
    console.error("[telegram-webhook]", err);
    try {
      await sendMessage(message.chat.id, `⚠️ Errore: ${(err as Error).message}`);
    } catch {
      // ignored
    }
  }
  return new Response("ok", { status: 200 });
};

async function handleMessage(message: TelegramMessage): Promise<void> {
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

  if (!text.startsWith("/")) {
    const id = await createIdea({ text, source: "manual" });
    await sendMessage(message.chat.id, `✅ Idea #${id} salvata (testo libero).`);
    return;
  }
}
