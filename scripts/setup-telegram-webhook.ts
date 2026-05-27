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
