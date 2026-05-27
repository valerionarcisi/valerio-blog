# Editorial Agents — System Design

Sistema di agenti editoriali push-based che trasformano il piano editoriale in pubblicazioni distribuite, mantenendo Valerio Narcisi come unico decisore (approva/modifica/scarta via Telegram).

## Riferimenti

- Strategia (chi, cosa, perché): `docs/editorial-strategy.md`
- Voce (come): `docs/voice-profile.md`
- Spec questo doc (sistema): qui

Gli agenti caricano i primi due al runtime. Questo file (3) descrive solo il sistema che li ospita.

## Obiettivi

1. **Push, non pull**: agenti partono da soli su trigger (cron, webhook, messaggio Telegram). Valerio non ricorda di "lanciare" nulla.
2. **Approval obbligatoria**: ogni output passa per Telegram con bottoni `[Pubblica] [Modifica] [Scarta]`. Niente pubblicazione automatica senza il suo click.
3. **Voice-aware**: prima di ogni draft, l'agente carica `voice-profile.md` + il post anchor + esempi recenti.
4. **Auto-learning**: ogni modifica fatta da Valerio in Telegram viene salvata come "voice example" → l'agente migliora col tempo.
5. **Costo basso**: ~$5-15/mese tutto incluso (Anthropic API + infra free tier).

## Architettura

```
TRIGGER LAYER
  ─ Netlify deploy webhook (nuovo post pubblicato)
  ─ Scheduled function (cron: 6h, daily, weekly)
  ─ Telegram bot webhook (messaggio in arrivo, /idea, voice, forward)
                              │
                              ▼
AGENT RUNTIME (Netlify Function per agente)
  1. Trigger handler legge contesto rilevante
  2. Carica voice profile: docs/voice-profile.md + anchor post + ultimi N post
  3. Anthropic API call con system prompt voice-aware
  4. Salva bozza in Turso agent_queue (status=pending)
  5. Invia preview a Telegram con inline buttons (callback_data=queue_id)
                              │
                              ▼
APPROVAL LAYER (Telegram bot)
  Tu vedi: titolo + bozza + [Pubblica] [Modifica] [Scarta]
  Pubblica → POST a publish-router function
  Modifica → bot riceve risposta testuale → salva diff → riproduce
  Scarta → status=discarded, niente altro
                              │
                              ▼
PUBLISH LAYER (publish-router function)
  Switch su platform: linkedin | bluesky | reddit | letterboxd | clipboard
  LinkedIn  → LinkedIn API v2 (OAuth2 user-token, stored encrypted)
  Bluesky   → @atproto/api con app password
  Reddit    → snoowrap o fetch diretto (OAuth)
  Letterboxd → no API ufficiale → restituisce text in messaggio Telegram
  Salva published_at, platform_post_id in agent_queue
```

## Componenti (agenti)

Ogni agente è una Netlify Function indipendente in `netlify/functions/agents/`. Convenzione di naming: `agent-<role>.ts`.

### 1. Idea Catcher (Telegram bot)

| Aspetto | Dettaglio |
|---|---|
| Trigger | Telegram message webhook |
| Funzione file | `netlify/functions/telegram-webhook.ts` |
| Whitelist | Solo Valerio's `TELEGRAM_USER_ID` può scrivere; ogni altro mittente ignorato |
| Comandi | `/idea <testo>`, `/list`, `/done <id>`, `/draft <id>`, forward link, voice message |
| Voce → testo | Whisper API (OpenAI) on demand; alternativa Telegram built-in transcription |
| Storage | Tabella `editorial_ideas` |
| Output | Conferma Telegram dopo salvataggio |

### 2. Distributor

| Aspetto | Dettaglio |
|---|---|
| Trigger | Netlify build hook (post-deploy) + diff su `dist/sitemap-0.xml` per detection nuovo URL |
| Funzione | `netlify/functions/agents/distributor.ts` |
| Logica | Quando un nuovo blog post viene rilevato: legge HTML del post, genera 3 bozze (LinkedIn IT, Bluesky EN, Reddit r/italyinformatica solo se post è "Note di codice") |
| Voice loading | `voice-profile.md` + i 2 post più recenti dello stesso canale (LinkedIn/Bluesky/Reddit) come few-shot |
| Output | 3 messaggi Telegram separati, ognuno con bottoni di approvazione |

### 3. Curator (Letterboxd reviews)

| Aspetto | Dettaglio |
|---|---|
| Trigger | Cron ogni 6h, scan Letterboxd RSS |
| Funzione | `netlify/functions/agents/curator.ts` |
| Logica | Per ogni film nuovo non in `reviews_drafted`: notifica Telegram "Vuoi una review per X?". Attende risposta testuale/vocale di Valerio per 24h. Se risponde, genera bozza IT + EN (100-200 parole l'una) usando il suo input come anchor. Se non risponde, archivia. |
| Context | Voto da Letterboxd, anno e regista, descrizione TMDB, prompt utente, voice profile |
| Output | 2 messaggi Telegram (IT + EN) con bottoni `[Pubblica IT]` `[Pubblica EN]` `[Pubblica entrambe]` `[Modifica]` `[Scarta]`. "Pubblica" significa preparare testo + link Letterboxd film per copia-incolla manuale (no API scrittura). Cross-post automatico in `/visti` sul sito. |
| Note | Letterboxd non ha API scrittura ufficiale. Lo stato dell'arte è la copia-incolla. Se in futuro arriva l'API, sostituisce solo questo step. |

### 4. Analyst (weekly digest)

| Aspetto | Dettaglio |
|---|---|
| Trigger | Cron `0 20 * * 0` (domenica 20:00) |
| Funzione | `netlify/functions/agents/analyst.ts` |
| Logica | Aggrega: top 5 post settimana (GSC API + analytics interno), query in crescita, post non pubblicati da >14 giorni in `editorial_ideas`. Genera bullet list più 3 idee suggerite per la settimana che entra |
| Output | Singolo messaggio Telegram, formato fisso, nessun bottone (informativo) |

### 5. Instagram Story Publisher (opzionale)

| Aspetto | Dettaglio |
|---|---|
| Trigger | Foto in arrivo su Telegram con caption che inizia con `/story` |
| Funzione | `netlify/functions/agents/ig-story.ts` |
| Logica | Riceve foto + caption testuale, genera immagine Story 1080×1920 con overlay testo in EB Garamond + palette Foglio (sharp con SVG overlay). Pubblica via Instagram Graph API |
| Vincoli | Account IG convertito in Creator + Facebook Page collegata + Meta app review approvata |
| Output | Anteprima in Telegram + bottoni [Pubblica] [Modifica testo overlay] [Scarta] |
| Non-goal | Feed post e Reels: restano manuali. L'algoritmo IG penalizza AI-feel sui feed. |

### 6. Drafter (long-form on demand)

| Aspetto | Dettaglio |
|---|---|
| Trigger | Valerio scrive `/draft <idea_id>` o `/draft <testo libero>` al bot |
| Funzione | Inline nel `telegram-webhook.ts` (no func separata) |
| Logica | Carica idea dalla queue + voice profile + post anchor. Genera bozza Markdown 800-1500 parole. Salva in repo come `src/content/blog/it/drafts/<slug>.md`. Manda link al file in Telegram |
| Output | Bozza markdown nel repo (status `draft`, non visibile sul sito) |

## Dati / Schema DB

Nuove tabelle in Turso:

### `editorial_ideas`

| Campo | Tipo | Note |
|---|---|---|
| `id` | INTEGER PK AUTOINC | |
| `text` | TEXT NOT NULL | Idea raw (può essere lunga, voce trascritta o forward) |
| `source` | TEXT | `manual`, `voice`, `forward`, `analyst-suggested` |
| `column` | TEXT NULL | "diari-set" / "note-codice" / "mestiere-doppio" / "letture-visioni" / null |
| `status` | TEXT NOT NULL DEFAULT 'idea' | `idea`, `drafting`, `scheduled`, `published`, `archived` |
| `scheduled_for` | TEXT NULL | Data target |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TEXT | |

### `agent_queue`

| Campo | Tipo | Note |
|---|---|---|
| `id` | INTEGER PK AUTOINC | |
| `agent` | TEXT NOT NULL | `distributor`, `curator`, `drafter`, etc. |
| `platform` | TEXT NULL | `linkedin`, `bluesky`, `reddit`, `letterboxd`, `blog` |
| `source_ref` | TEXT NULL | Es. URL post originale, idea_id, film_id |
| `draft` | TEXT NOT NULL | Testo della bozza |
| `status` | TEXT NOT NULL DEFAULT 'pending' | `pending`, `approved`, `published`, `edited`, `discarded` |
| `telegram_message_id` | INTEGER | per editare il messaggio dopo approvazione |
| `published_at` | TEXT NULL | |
| `platform_post_id` | TEXT NULL | id ritornato dall'API piattaforma |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | |

### `voice_examples`

| Campo | Tipo | Note |
|---|---|---|
| `id` | INTEGER PK AUTOINC | |
| `queue_id` | INTEGER FK | Da quale draft proviene la correzione |
| `agent` | TEXT | quale agente ha generato l'originale |
| `original` | TEXT NOT NULL | Bozza AI |
| `corrected` | TEXT NOT NULL | Versione di Valerio dopo edit |
| `lesson` | TEXT NULL | Sintesi della correzione (auto-generata da LLM al next training) |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | |

### `media_library`

| Campo | Tipo | Note |
|---|---|---|
| `id` | INTEGER PK AUTOINC | |
| `filename` | TEXT UNIQUE NOT NULL | es. `2026-05-27-001.jpg` |
| `path` | TEXT NOT NULL | `public/img/uploads/2026-05-27/001.jpg` |
| `caption` | TEXT NULL | caption ricevuta col Telegram upload |
| `tags` | TEXT NULL | comma-separated, es. `"set,non-fa-ridere,falerone"` |
| `source` | TEXT | `telegram`, `manual`, `screenshot` |
| `used_count` | INTEGER DEFAULT 0 | quante volte usata in un post |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | |

### `reviews_drafted`

| Campo | Tipo | Note |
|---|---|---|
| `letterboxd_id` | TEXT PK | tmdb:movieId o letterboxd:filmTitle |
| `drafted_at` | TEXT NOT NULL | |
| `queue_id` | INTEGER FK NULL | |

## API endpoints (Netlify Functions)

| Path | Metodo | Scopo | Auth |
|---|---|---|---|
| `/api/telegram/webhook` | POST | Riceve update Telegram | Telegram secret token |
| `/api/agents/distributor` | POST | Esegue il distributor (build hook + manuale) | Internal token |
| `/api/agents/curator` | GET | Esegue il curator (cron e manuale) | Internal token |
| `/api/agents/analyst` | GET | Esegue l'analyst | Internal token |
| `/api/agents/festival-scout` | GET | Esegue il festival scout | Internal token |
| `/api/agents/publish-router` | POST | Pubblica un draft approvato | Internal token + queue_id |

Tutti gli `/api/agents/*` ricevono `Authorization: Bearer <INTERNAL_TOKEN>` per evitare invocazioni esterne.

## Scheduling

Netlify Scheduled Functions (config in `netlify.toml`):

```toml
[functions."agent-curator"]
schedule = "0 */6 * * *"  # ogni 6 ore

[functions."agent-analyst"]
schedule = "0 20 * * 0"  # domenica 20:00

[functions."agent-festival-scout"]
schedule = "0 9 * * *"  # ogni giorno alle 9:00
```

Tutti UTC. La gestione di timezone (per il digest "domenica sera ora italiana") è dentro la function: si calcola se è il momento giusto, se no exit early.

## OAuth e credenziali

Variabili di ambiente Netlify (mai committate):

```
TELEGRAM_BOT_TOKEN
TELEGRAM_SECRET_TOKEN          # per validare webhook
TELEGRAM_USER_ID_WHITELIST     # solo il tuo user id

ANTHROPIC_API_KEY
OPENAI_API_KEY                 # solo per Whisper (voice → text)

LINKEDIN_ACCESS_TOKEN          # refreshato manualmente ogni 60gg
LINKEDIN_PERSON_URN
BLUESKY_HANDLE
BLUESKY_APP_PASSWORD
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
REDDIT_USERNAME
REDDIT_PASSWORD                # o refresh token

INTERNAL_AGENT_TOKEN           # auth fra functions
```

Setup OAuth iniziale (mezza giornata):
- LinkedIn: app developer.linkedin.com → OAuth flow una volta → salva long-lived token. Refresh ogni 60gg via cron `agent-token-refresh`.
- Bluesky: app password generata in account settings, niente OAuth.
- Reddit: script applicativo, password-grant flow.

## Approval UX (Telegram)

Ogni messaggio bozza ha il formato:

```
🟧 LinkedIn IT — Distributor

[testo della bozza, fino a 4096 char]

📊 Fonte: blog/result-pattern... (pos 13 GSC)
🎯 Audience prevista: dev essayist + sceneggiatori curiosi

[Pubblica]  [Modifica]  [Scarta]
```

- **Pubblica**: callback fa POST a publish-router. Messaggio Telegram aggiornato a "✅ Pubblicato 14:32 — link"
- **Modifica**: bot risponde "Mandami la versione corretta in risposta a questo messaggio". Quando Valerio risponde, il bot salva `voice_examples`, ri-genera con prompt aggiornato (oppure pubblica direttamente la versione di Valerio se la modifica è completa)
- **Scarta**: status=discarded, status feedback nel messaggio

## Voice learning loop

Ogni 7 giorni una scheduled function `agent-voice-distill`:

1. Legge gli ultimi 20 record di `voice_examples`
2. Per ognuno chiede a Claude: "Cosa ha cambiato Valerio tra originale e corretto? Estrai una lezione in 1 frase."
3. Salva la lezione nel campo `lesson`
4. Le lezioni più ricorrenti vengono raccolte in `docs/voice-profile.md` sezione "Correzioni storiche" (auto-commit al repo o solo append a doc privato)

Risultato: il system prompt degli agenti col tempo include osservazioni concrete tratte dagli edit di Valerio.

## Error handling

- **API failure** (Anthropic, LinkedIn, etc.): retry con exponential backoff, max 3 tentativi. Dopo: log in tabella `agent_errors`, notifica Telegram "⚠️ <agente> ha fallito: <errore breve>".
- **Quote rate limit**: aspetta, riprovare al prossimo cron.
- **Token Telegram scaduto**: notifica e-mail di backup (env var `OWNER_EMAIL`).
- **Bozza vuota o degenerata**: pre-pubblica check minimo (lunghezza > 100 char, no `[INST]`, no `Lorem`), se fallisce skip + log.

## Testing

- **Unit tests**: ogni agente ha test in `netlify/functions/agents/__tests__/<agent>.test.ts`. Mock di Anthropic API e Telegram API. Vitest.
- **Integration tests**: end-to-end con Telegram bot di staging (token separato), Turso DB di test, account social di test (LinkedIn sandbox dove possibile, Bluesky free dev account).
- **Manual smoke test** post-deploy: per ogni agente, invoca manuale via Telegram (`/test distributor`) e verifica output.

## Sicurezza

- Telegram webhook validato via header `X-Telegram-Bot-Api-Secret-Token` (registrato all'`setWebhook` con `secret_token=<TELEGRAM_SECRET_TOKEN>`). Reject ogni request senza match.
- Solo `TELEGRAM_USER_ID_WHITELIST` (env var, singolo user id) può triggerare comandi
- Internal token per functions interne, validato in middleware
- OAuth tokens cifrati at rest in Turso (column-level encryption con sodium o equivalente)
- Logs degli output: niente PII di altri utenti, no credenziali

## Roadmap di build

| Settimana | Output | Effort stimato |
|---|---|---|
| 1 | Idea Catcher (Telegram bot, `/idea`, `/list`, voice w/ Whisper, forward) + tabelle `editorial_ideas` + `media_library` (upload foto basic) | 8-10h |
| 2 | Distributor v1: build hook + draft LinkedIn IT + approval flow + publish a LinkedIn (OAuth setup incluso) | 10-12h |
| 3 | Distributor estesa a Bluesky + Reddit, + Curator (Letterboxd RSS scan + IT/EN bozze) | 8-10h |
| 4 | Analyst (weekly digest GSC + analytics) + voice-distill cron | 6-8h |
| 5 (opzionale) | Instagram Story Publisher (richiede Meta setup pre-codice ~7-14gg) | 5-7h dopo approvazione Meta |
| 6 | Drafter (outline + opening da Telegram, full draft markdown salvato nel repo) | 6-8h |
| 7 | Polish: dashboard `/admin/editorial-queue` (vedi cosa è in coda, storia approvati/scartati), endpoint diagnostica errori | 4-6h |

Totale ~50-60h spalmate su 7 settimane = 7-9h/settimana. Realistico se metà di queste sono ore del development time (non extra Valerio's).

## Cost projection (mensile)

| Voce | Costo |
|---|---|
| Netlify Functions + Scheduled | $0 (free tier 125k invocazioni/mese, useremo ~5k) |
| Turso | $0 (free tier 9GB) |
| Telegram Bot API | $0 |
| Anthropic API (Claude Sonnet) | ~$5-12 (250-500 chiamate, ~$0.02 cad media) |
| OpenAI API (Whisper) | ~$1-2 (50 voice messages/mese) |
| LinkedIn / Bluesky / Reddit APIs | $0 (uso non commerciale) |
| **Totale** | **~$7-15/mese** |

## Non-goals

- Pubblicazione automatica senza approvazione umana (mai)
- Cross-posting blind (ogni piattaforma riceve un draft NATIVO, non lo stesso testo replicato)
- Engagement automation (no auto-reply, no auto-like, no follow growth bot)
- Multi-utente (sistema per il singolo Valerio, no permissioni)
- Newsletter management (out of scope per v1)
- Generazione di immagini AI (no DALL-E/Midjourney/Replicate). Le immagini sono o di Valerio (foto, screenshot) o template generati lato server con sharp (overlay testo su foto reali, es. Story IG)
- Festival Scout automatico (eliminato): vai a festival/eventi manualmente, mandi foto al bot, l'agente Instagram Story Publisher gestisce la pubblicazione
- Instagram Feed e Reels: troppo rischio AI-feel sul feed, l'algoritmo penalizza. Restano manuali.

## Immagini — flusso

```
TU: foto/screenshot a Telegram (chat col bot)
  ↓
BOT: processa con sharp:
  - resize 1600px lato lungo
  - JPEG q82
  - strip EXIF (privacy: niente GPS/timestamp/device)
  - salva in public/img/uploads/YYYY-MM-DD/<id>.jpg
  ↓
BOT: salva record in media_library, risponde con id + chiede tag opzionali
  ↓
USO: quando si genera un draft per un canale che usa immagini, l'agente
     cerca foto con tag pertinenti in media_library OR chiede esplicitamente
     "vuoi allegare un'immagine? /useimage <id> o salta"
  ↓
PUBBLICAZIONE: la foto viene allegata via API (LinkedIn supporta upload
               diretto, Bluesky idem, Reddit anche)
```

Comandi bot media:
- `/media list` — ultime 10 foto con thumbnail
- `/media tag <id> <tag>` — aggiunge tag a foto esistente
- `/media delete <id>` — rimuove dal library e dal disk
- `/useimage <id>` — durante un drafting per allegare a quel draft specifico
- `/story` — caption che precede una foto = trigger per Instagram Story Publisher

## Decisioni risolte (post brainstorming)

- **Drafter**: produce outline + opening (300-500 parole) via Telegram, poi salva markdown completo in `src/content/blog/it/drafts/<slug>.md`. Valerio completa il drafting da laptop.
- **Letterboxd**: copia-incolla manuale (no API ufficiale). Sempre genera IT + EN, Valerio sceglie quale pubblicare. Cross-post automatico in `/visti` sul sito.
- **Voce nativa Telegram**: messaggi vocali Telegram trascritti via Whisper. L'AI interpreta intent: salva idea / genera draft / risposta. Comando esplicito `/voice` non serve, basta il long-press microfono di Telegram.
- **Festival Scout**: eliminato. Approccio manuale via Instagram Story Publisher quando Valerio è a un evento.
- **Instagram**: solo Story via Graph API, dopo setup Meta. Feed e Reels restano manuali.
- **Generazione immagini AI**: no. Solo template server-side con sharp.

## Roadmap di build incrementale

In ordine, per validare ogni settimana che qualcosa serva davvero:

1. **Settimana 1 — Idea Catcher**. Se non lo usi (zero idee inserite in 7 giorni), tutto il resto è inutile. Stop e ripensa la strategia editoriale.
2. **Settimana 2 — Distributor**. Aspetta il primo blog post pubblicato dopo il deploy del Distributor. Se la prima bozza richiede più di 5 minuti di edit per essere usabile, fix voice profile prima di proseguire.
3. **Settimana 3+** — dipende da come Distributor performa.

## Versioning

**v1.0 — 2026-05-27** — Spec iniziale dopo brainstorming con Claude.
