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
