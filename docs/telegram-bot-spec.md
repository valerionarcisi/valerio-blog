# Telegram Bot Spec — pubblicare note dal telefono

Spec per un bot Telegram che permette a Valerio di pubblicare note brevi sul sito personale direttamente da Telegram, senza passare per git né per l'editor markdown.

L'obiettivo è abbassare al massimo l'attrito di pubblicazione per i contenuti **non-saggio**: appunti, schizzi, riflessioni di getto, frammenti che oggi finiscono in note di telefono o quaderni e poi si perdono.

## Posizionamento

Il bot **non serve** a pubblicare saggi tecnici. Quelli restano file markdown nella content collection di Astro (`src/content/blog/{lang}/`), versionati in git, scritti in editor desktop con calma. Il bot serve a popolare la **sezione Note** del sito — l'analogo dei taccuini Field Notes, dei thread di Twitter di una volta, delle "stelle" su Are.na: materiale che nasce breve, vive breve, ma vuole comunque essere indicizzato e cercabile.

Modello mentale: **Telegram → Note (Turso) → site `/notes`**.

Saggi maturi vivono in markdown + git. Note volatili vivono in DB + endpoint Astro dynamic. Sono due tracce parallele con due velocità, due ritualità, due audience.

## Architettura

```
┌────────────────┐    webhook     ┌──────────────────────┐    insert      ┌────────────┐
│  Telegram Bot  │ ───────────────▶│ /api/bot/telegram    │ ───────────────▶│   Turso    │
│  (BotFather)   │                 │  (Astro endpoint)    │                 │  notes db  │
└────────────────┘                 └──────────────────────┘                 └────────────┘
                                              │                                    ▲
                                              │ reply                              │
                                              ▼                              read at runtime
                                   ┌──────────────────────┐                        │
                                   │     Telegram         │                ┌──────────────┐
                                   │     (Valerio)        │                │   /notes     │
                                   └──────────────────────┘                │  (SSR page)  │
                                                                            └──────────────┘
```

Flusso:
1. Valerio scrive un messaggio al bot Telegram da telefono.
2. Telegram invia webhook a `POST /api/bot/telegram`.
3. L'endpoint verifica auth (chat_id allow-list), interpreta il messaggio (comando vs testo libero), persiste in Turso.
4. Il bot risponde su Telegram con conferma + link/anteprima.
5. Il sito `/notes` legge da Turso a runtime (la pagina ha `prerender = false`) e mostra le note in ordine cronologico inverso.

## Dati / Schema DB

Tabella `notes` (Turso, schema additivo rispetto a `comments` e `post_claps`):

| Campo         | Tipo    | Note |
| ------------- | ------- | ---- |
| `id`          | INTEGER | PK, autoincrement |
| `slug`        | TEXT    | Generato dall'endpoint, formato `YYYY-MM-DD-<short-uuid>`. Usato come URL: `/notes/<slug>`. |
| `text`        | TEXT    | Corpo della nota in markdown. Sanitizzato lato render con marked + DOMPurify (stesso pattern dei commenti). |
| `title`       | TEXT    | Opzionale. Se assente, generato dal primo verso del testo (prime 60 char). |
| `lang`        | TEXT    | `it` / `en`. Inferito dal contenuto o esplicito via comando. Default `it`. |
| `status`      | TEXT    | `schizzo` (default) / `bozza` / `stabile`. Promuovibile via comando. |
| `tags`        | TEXT    | JSON array. Parsing automatico di hashtag nel messaggio (`#cinema`, `#codice`, etc.) + tag espliciti. |
| `source`      | TEXT    | `telegram` / `web` / `import`. Tracciamento provenienza. |
| `tg_msg_id`   | INTEGER | Telegram message ID, per idempotenza se Telegram ritrasmette. |
| `created_at`  | TEXT    | datetime('now'). |
| `updated_at`  | TEXT    | datetime('now'), aggiornato a ogni edit. |
| `published`   | INTEGER | `0` = bozza nascosta, `1` = visibile in `/notes`. Default `1` (le note nascono già pubbliche). |

Indici:
- `idx_notes_slug` su `slug` (lookup per URL)
- `idx_notes_published_created` su `(published, created_at DESC)` (listing)

## Endpoint Telegram → Astro

`POST /api/bot/telegram`

Riceve il webhook di Telegram. Schema input: standard Telegram Update object — interessano `update_id`, `message.chat.id`, `message.from.id`, `message.text`, `message.message_id`, `message.entities` (hashtag).

### Auth

L'endpoint verifica:
1. **Secret token** nell'header `X-Telegram-Bot-Api-Secret-Token` (impostato in fase di setup webhook). Reject 401 se assente o errato.
2. **Allow-list** di `chat_id`: solo Valerio. Hardcoded in `env("TELEGRAM_ALLOWED_CHAT_ID")` per evitare configurazione DB. Reject 403 silenzioso (Telegram non ritrasmette messaggi a chi è rejected).

### Idempotenza

Prima di scrivere, lookup su `tg_msg_id`. Se esiste, l'update è duplicato e l'endpoint risponde 200 senza scrivere.

### Parsing del messaggio

Il bot supporta **comandi slash** + **testo libero**.

**Testo libero** (caso d'uso primario): tutto il messaggio diventa il corpo della nota. Estrazione hashtag automatica. Titolo automatico (prime 60 char, troncate a parola). Status `schizzo`. Lingua `it`. Inserito subito.

Esempio:
```
Stamattina al bar mi è venuta l'idea che il vero parametro per
giudicare una buona sceneggiatura è la quantità di silenzio
che riesce a sostenere. #cinema #appunti
```
Risultato: nota con title="Stamattina al bar mi è venuta l'idea…", tags=`["cinema","appunti"]`, status=`schizzo`.

**Comandi slash**:

| Comando | Effetto |
| ------- | ------- |
| `/start` | Saluto + breve guida ai comandi. |
| `/help` | Stessa guida. |
| `/lang en` | Imposta lingua di default per i prossimi messaggi (persiste in una tabella `tg_state` o in memoria server). |
| `/stable <id>` | Promuove la nota `<id>` da `schizzo` → `stabile`. |
| `/draft <id>` | Promuove a `bozza` (intermedio). |
| `/delete <id>` | Imposta `published=0` (soft delete). Non cancella la riga. |
| `/title <id> <nuovo titolo>` | Sovrascrive il titolo. |
| `/list` | Restituisce le ultime 10 note con id, status, primo verso. |
| `/edit <id>` | Modalità edit: i messaggi successivi sostituiscono il body della nota indicata, fino a `/end`. Utile per espandere uno schizzo da telefono. |
| `/end` | Termina modalità edit. |

Tutti gli ID sono interi consecutivi (dalla DB).

### Reply al bot

Dopo ogni write, il bot risponde su Telegram con:
- 👍 conferma
- titolo generato
- tag rilevati
- link diretto: `https://valerionarcisi.me/notes/{slug}`
- ID per future operazioni (`/stable 42`)

Esempio:
```
✓ Salvato come "Stamattina al bar mi è venuta…"
  Tag: cinema, appunti
  ID 42 · schizzo
  → valerionarcisi.me/notes/2026-05-25-a8f
```

## Pagina `/notes`

Server-rendered (`prerender = false`), legge da Turso al request.

**Listing** `/notes`:
- Stesso layout di `/blog` (Mockup A) ma con:
  - colonna data più prominente
  - badge `schizzo` / `bozza` / `stabile` (riusa pattern del sito)
  - filtri per tag e per status
- Solo note con `published=1`
- Ordinato per `created_at DESC`
- Paginazione a 20

**Detail** `/notes/{slug}`:
- Layout uguale al blog post di Mockup A
- Niente ToC sticky (le note sono brevi)
- Markdown renderizzato con `marked` + sanitizzato con `DOMPurify` (stesso codepath dei commenti)
- Footer della nota: data, status, tag, link "modifica via Telegram" (mostra `/edit <id>` da copiare)
- Commenti abilitati (stessa tabella `comments`, page_id = `notes/{slug}`)

**RSS**: feed `/notes/rss.xml` aggregato con il blog principale.

## Setup operativo

1. **Crea il bot** con `@BotFather` su Telegram → ottieni `TELEGRAM_BOT_TOKEN`.
2. **Configura webhook**:
   ```
   curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" \
     -d "url=https://valerionarcisi.me/api/bot/telegram" \
     -d "secret_token=$WEBHOOK_SECRET" \
     -d "allowed_updates=[\"message\"]"
   ```
3. **Env vars** (Netlify):
   - `TELEGRAM_BOT_TOKEN` — per le risposte del bot via Bot API
   - `TELEGRAM_WEBHOOK_SECRET` — header di verifica
   - `TELEGRAM_ALLOWED_CHAT_ID` — chat_id di Valerio (CSV se più di uno)
4. **Migrazione DB**: script `scripts/init-notes-db.ts` che crea la tabella `notes` se non esiste.
5. **Test**: invia un messaggio al bot, controlla che appaia su `/notes`.

## Implementazione: file da creare/modificare

```
src/
  pages/
    api/bot/
      telegram.ts          # webhook endpoint
    notes/
      index.astro          # listing (prerender = false)
      [slug].astro         # detail (prerender = false)
      rss.xml.ts           # RSS feed
  lib/
    notes-store.ts         # CRUD su Turso
    telegram-bot.ts        # parsing comandi + reply via Bot API
    telegram-auth.ts       # verifica secret + chat_id
  content/
    (nessuna modifica — le note non sono content collection)

scripts/
  init-notes-db.ts         # crea tabella notes su Turso
  promote-note-to-post.ts  # opzionale: converte una nota in markdown content collection

docs/
  telegram-bot-spec.md     # questo file
```

## Modello di errore

Tutto il flusso adotta il pattern `Result<T, E>` già in uso nel resto della codebase. Errori espliciti:

| Codice | Significato | Cosa fa il bot |
| --- | --- | --- |
| `INVALID_SECRET` | Header secret assente o errato | Reject 401, nessuna reply. |
| `NOT_AUTHORIZED` | chat_id non in allow-list | Reject 403 silenzioso. |
| `EMPTY_MESSAGE` | Messaggio vuoto o solo whitespace | Reply con suggerimento. |
| `DUPLICATE_UPDATE` | tg_msg_id già visto | Reply 200, nessun side effect. |
| `DB_ERROR` | Turso failure | Reply con scusa, log su Netlify Functions logs. |
| `UNKNOWN_COMMAND` | Slash command non riconosciuto | Reply con `/help`. |
| `NOTE_NOT_FOUND` | `/stable 999` ma 999 non esiste | Reply con "Non trovo la nota 999". |

## Considerazioni di scope

**In scope (MVP)**:
- Pubblicazione testo + hashtag → nota
- Lettura listing + detail
- Comandi `/stable`, `/draft`, `/delete`, `/title`, `/list`
- Auth single-user
- Italiano default, EN via `/lang`

**Out of scope (per ora)**:
- **Immagini**: Telegram permette di mandare foto, ma il sito ora è completamente senza immagini per design. Se cambieremo idea, gli allegati Telegram diventeranno asset Netlify Blobs e si riferenziano in markdown.
- **Voce**: nessuna trascrizione di vocali. Se serve, integrazione con Whisper API.
- **Multi-utente**: solo Valerio. Se in futuro vuoi che amici contribuiscano, serve un'estensione del modello auth.
- **Editing collaborativo**: nessuna concorrenza. Last-write-wins.

## Tradeoff dichiarati

1. **Turso vs markdown commit**: le note vivono in DB, non in git. Pro: pubblicazione istantanea senza rebuild Netlify, possibilità di edit veloce. Contro: non hai cronologia git delle note, dipendi da Turso (già dipendenza esistente per commenti/claps, quindi non aumenta la superficie).

2. **`/notes` SSR vs static**: SSR permette pubblicazione immediata da Telegram senza rebuild. Pro: feedback istantaneo. Contro: ogni view è un round-trip a Turso. Mitigazione: cache HTTP `Cache-Control: public, max-age=60, stale-while-revalidate=300` sull'endpoint listing (le note non cambiano spesso).

3. **Promozione note → post**: lo script `promote-note-to-post.ts` permette di convertire una nota stabile in un saggio markdown vero (file in `src/content/blog/{lang}/`). Solo quando senti che la nota merita di diventare un saggio. È una decisione manuale, non automatica.

## Apertura per il futuro

Quando il pattern funziona bene, considerare:
- **Bot per pubblicare anche su `/films` "now shooting"**: messaggi tipo `/shoot Non fa ridere — giorno 2, abbiamo finito la scena del corridoio` → appaiono in una mini-timeline sulla pagina del film.
- **Bot per le claps su post specifici**: `/clap result-pattern` da Telegram → conta come una clap autenticata.
- **Bot per i commenti come Author**: invece di andare su `/admin/comments`, rispondi via Telegram. Le risposte vengono postate come Author sul sito.

Ma niente di questo è MVP. Prima si scrive il pezzo base, poi si vede se l'attrito basso che il bot abilita produce davvero più scrittura.
