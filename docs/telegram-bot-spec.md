# Idea Catcher Telegram Bot — Spec

Phase 1 dell'**editorial agents system** (sistema editoriale automatizzato push-based). Bot Telegram personale di Valerio: riceve idee, vocali, foto, forward, li archivia in DB per uso futuro da parte degli altri agenti (Distributor, Curator, Drafter — Phase 2+).

> **Nota storica**: questa spec sostituisce una precedente proposta ("post-da-Telegram al blog") mai costruita. Il concetto attuale è **cattura** (input pipe), non pubblicazione diretta.

## Riferimenti

- System design completo: `docs/superpowers/specs/2026-05-27-editorial-agents-design.md`
- Implementation plan eseguito: `docs/superpowers/plans/2026-05-27-idea-catcher.md`
- Setup walkthrough: `docs/setup/telegram-bot.md`
- Strategia editoriale: `docs/editorial-strategy.md`
- Voice profile: `docs/voice-profile.md`

## Obiettivo

Abbassare a zero l'attrito di **cattura** di un'idea editoriale. Idea in testa → 4 secondi → salvata in DB. Nessun journaling app, nessun "ora apro il laptop". Telegram è sempre aperto sul telefono.

Le idee in coda alimentano poi gli altri agenti (Phase 2+) e/o vengono trasformate manualmente in post.

## Architettura

```
TELEGRAM CLIENT (Valerio's phone/desktop)
  │  voice / photo / text / forward
  ▼
TELEGRAM CLOUD
  │  HTTPS POST to webhook URL (with X-Telegram-Bot-Api-Secret-Token header)
  ▼
NETLIFY FUNCTION (Astro endpoint)
  src/pages/api/telegram/webhook.ts
  │  1. validate secret token (fail-closed if env empty)
  │  2. enforce TELEGRAM_USER_ID_WHITELIST
  │  3. route by message type:
  │     - voice/audio → Whisper transcribe → editorial_ideas
  │     - photo → sharp process → media_library
  │     - /idea, /list, /done, /media, /tag, /help, /start → text handler
  │     - forward (has forward_from*) → editorial_ideas source=forward
  │     - plain text → editorial_ideas source=manual
  │  4. always respond 200 to prevent Telegram retries
  ▼
TURSO (libsql)
  editorial_ideas, media_library
```

## Schema DB

### `editorial_ideas`

| Campo | Tipo | Note |
|---|---|---|
| `id` | INTEGER PK AUTOINC | |
| `text` | TEXT NOT NULL | Testo idea / trascrizione |
| `source` | TEXT NOT NULL | `manual` / `voice` / `forward` / `analyst-suggested` |
| `column` | TEXT NULL | Quoted name (riservata SQL). Colonna editoriale: `diari-set` / `note-codice` / `mestiere-doppio` / `letture-visioni` |
| `status` | TEXT NOT NULL DEFAULT `'idea'` | `idea` / `drafting` / `scheduled` / `published` / `archived` |
| `scheduled_for` | TEXT NULL | Data target di pubblicazione (YYYY-MM-DD) |
| `created_at` | TEXT NOT NULL DEFAULT `CURRENT_TIMESTAMP` | |
| `updated_at` | TEXT NULL | |

Indici: `status`, `created_at DESC`.

### `media_library`

| Campo | Tipo | Note |
|---|---|---|
| `id` | INTEGER PK AUTOINC | |
| `filename` | TEXT UNIQUE NOT NULL | es. `2026-05-27-abc123.jpg` |
| `path` | TEXT NOT NULL | Web path `/img/uploads/YYYY-MM-DD/<id>.jpg` |
| `caption` | TEXT NULL | Telegram caption se presente |
| `tags` | TEXT NULL | csv `set,falerone,non-fa-ridere` |
| `source` | TEXT NOT NULL | `telegram` / `manual` / `screenshot` |
| `used_count` | INTEGER DEFAULT 0 | Quante volte usata in un post |
| `created_at` | TEXT DEFAULT `CURRENT_TIMESTAMP` | |

Indici: `created_at DESC`. UNIQUE su `filename` previene doppi upload.

## Comandi

| Comando | Cosa | Esempio risposta |
|---|---|---|
| `/start` o `/help` | Mostra elenco comandi + flussi automatici | "Idea Catcher · comandi disponibili..." |
| `/idea <testo>` | Salva idea con source=manual | "✅ Idea #7 salvata." |
| `/idea` (no arg) | Help uso | "Uso: /idea <testo della tua idea>" |
| `/list` | Elenca prime 20 idee con status=idea | "#7 · ..." |
| `/done <id>` | Marca idea come published | "✅ Idea #7 archiviata come published." |
| `/media list` o `/media` | Elenca ultime 10 foto | "#3 · 2026-05-27-abc.jpg — caption" |
| `/tag <id> <tag1,tag2>` | Aggiunge tag a una foto | "🏷️ Foto #3 taggata: set, falerone" |

### Comandi sconosciuti

`/qualcosa-non-esistente` → reply "Comando *<x>* non riconosciuto. Usa /help per la lista." (NON silent ignore).

### Flussi automatici (no comando esplicito)

| Input | Cosa fa |
|---|---|
| Messaggio vocale / audio | Scarica file da Telegram → Whisper transcribe (lang=it) → salva idea source=voice + reply con trascrizione |
| Foto | Sceglie risoluzione più alta dal `photo[]` array → scarica → sharp (1600px, JPEG q82, strip EXIF) → salva in `public/img/uploads/YYYY-MM-DD/<id>.jpg` + record in `media_library` |
| Forward (ha `forward_from` o `forward_from_chat`) | Salva testo come idea source=forward |
| Testo libero (non `/`) | Salva come idea source=manual |

## Sicurezza

- **Webhook auth**: header `X-Telegram-Bot-Api-Secret-Token` deve eguagliare `env("TELEGRAM_SECRET_TOKEN")`. Se l'env è vuota → return 503 (fail-closed) prima del compare per evitare match con header vuoto da attaccante.
- **Whitelist user**: `TELEGRAM_USER_ID_WHITELIST` (comma-separated user IDs). User non whitelistato → return 200 silente (no retry storm da Telegram).
- **No PII in log**: errori loggati con messaggio ma senza body Telegram completo.
- **Telegram secret**: stored encrypted come Netlify env var "secret".

## Errori

Qualsiasi exception in `handleMessage` viene catchata e:

1. Loggata con `console.error("[telegram-webhook]", err)`
2. Inviata come messaggio Telegram all'utente (`⚠️ Errore: <message>`)
3. Webhook ritorna sempre 200 (no retry da Telegram)

Se `sendMessage` stesso fallisce, swallow silenziosamente per non bloccare la response.

## Test

`src/pages/api/telegram/_webhook.test.ts` — 23 test coprono:

- Auth: secret token mancante / wrong / corretto (4 test)
- Fail-closed: empty secret env → 503 (1 test)
- /idea: con/senza testo, plain text (3 test)
- /list: vuota e popolata (2 test)
- /done: id valido / invalido (2 test)
- Voice: trascrizione + idea + reply quote (2 test)
- Photo: storage in media_library, no-caption, sceglie largest (3 test)
- /media list + /tag (3 test)
- Forward: source=forward (1 test)
- /help: replies command list (1 test)
- Unknown command: catch-all (1 test)

Test file usa prefisso `_` per non essere riconosciuto come route Astro.

## Setup

Vedi `docs/setup/telegram-bot.md` per BotFather → env vars → webhook registration → smoke test.

## Limitazione nota (production)

**Photo upload via `fs.writeFile("public/img/uploads/...")` non funziona su Netlify Functions in production** — il filesystem è read-only fuori da `/tmp`. Codice ha TODO inline che punta a questa spec e a `docs/setup/telegram-bot.md`. Migrare a **Netlify Blobs** prima di affidare le foto al sistema in produzione.

Fix follow-up:

1. Sostituire `fs.writeFile` con `getStore(...).set(...)` in `webhook.ts:88`
2. Aggiornare `media_library.path` per puntare a URL Netlify Blobs invece che `/img/uploads/`
3. Servire le foto via redirect Netlify o endpoint API che proxy a Blobs

In **dev locale** (via `pnpm dev`) le foto funzionano normalmente — il file viene scritto in `public/img/uploads/`.

## Roadmap

Phase 1 chiusa con questa spec. Phase 2+ (Distributor, Curator, Analyst, Instagram Story Publisher, Drafter) sono nel system design generale: `docs/superpowers/specs/2026-05-27-editorial-agents-design.md`.

## Versioning

- **v2.0 — 2026-05-27** — Riscritta da zero per matchare il sistema effettivamente costruito (Idea Catcher, Phase 1 agents). La versione precedente (post-da-Telegram al blog) è archiviata in git history.
- v1.x — concept precedente, mai implementato.
