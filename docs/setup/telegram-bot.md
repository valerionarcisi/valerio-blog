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

Da locale. **Importante**: `tsx` non è installato nel progetto, lancialo via `npx` (o `pnpm dlx`):

```bash
nvm use 20
TELEGRAM_BOT_TOKEN=xxx \
TELEGRAM_SECRET_TOKEN=yyy \
WEBHOOK_URL=https://valerionarcisi.me/api/telegram/webhook \
npx tsx scripts/setup-telegram-webhook.ts
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
TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL="" npx tsx scripts/setup-telegram-webhook.ts
```

## Troubleshooting

- **401 dal webhook**: secret token sbagliato (verifica match esatto tra Netlify env e quanto passato a `setWebhook`)
- **200 ma niente risposta**: user id non in whitelist, oppure errore interno (vedi log Netlify Functions)
- **Whisper errore**: `OPENAI_API_KEY` mancante o quota esaurita
- **Foto non salvate in production**: vedi *Limitazione importante* sotto

## Limitazione importante: filesystem read-only in production

Netlify Functions girano in un container con filesystem read-only eccetto `/tmp`. Il salvataggio diretto in `public/img/uploads/` (che funziona in dev locale) NON funziona quando deployato in production.

**Soluzioni** (in ordine di preferenza):

1. **Salvare in `/tmp` + upload a Netlify Blobs** (storage gratuito Netlify, accessibile via URL pubblico)
2. **Upload diretto a un bucket S3 / Cloudflare R2** e salvare l'URL in `media_library.path`
3. **Salvare base64 in DB** (cattiva idea, esplode rapidamente)

Implementazione consigliata: Netlify Blobs. Il task di follow-up dovrà sostituire `fs.writeFile` con `getStore(...).set(...)`. Per la Fase 1 in dev locale, fs.writeFile funziona; per il deploy production servono Netlify Blobs.

Questo task di refactor è registrato come **follow-up** e non blocca la chiusura della Fase 1 in dev.
