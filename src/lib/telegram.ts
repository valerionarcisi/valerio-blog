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
