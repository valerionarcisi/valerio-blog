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
  if (message.text === "/start") {
    await sendMessage(message.chat.id, "Idea Catcher attivo. /idea <testo> per salvare un'idea.");
  }
}
