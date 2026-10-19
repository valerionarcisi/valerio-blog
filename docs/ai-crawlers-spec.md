# Bot AI — contatore dei crawler AI

## Perché

I crawler AI (OpenAI, Anthropic, Perplexity, Meta...) scaricano l'HTML senza eseguire JavaScript: il tracker delle analytics non li vede e non deve vederli. Il sito resta aperto all'indicizzazione AI (`robots.txt` permette tutto tranne `/admin/` e `/api/`, c'è `public/llms.txt`), ma serviva sapere **cosa leggono** e **se portano persone**, senza sporcare le visite.

## Come funziona

- **Edge Function** `netlify/edge-functions/ai-crawlers.ts`, `path: "/*"` (esclusi `/api`, `/admin`, `/_astro`, `/img`, `/videos`, `/fonts`). Edge e non Function: le pagine statiche le serve la CDN e non arrivano mai a una funzione serverless.
- Per i visitatori normali ritorna subito (`return` senza risposta = la richiesta prosegue): costo = un confronto di stringhe.
- Se lo user agent contiene un token di `AI_BOTS` (`src/lib/ai-crawlers.ts`) e il percorso è una pagina (o `robots.txt`, `llms.txt`, `sitemap*.xml`, `rss.xml`), aspetta la risposta e, **solo se lo status è < 400**, incrementa `ai_crawls(day, bot, pathname, hits)` in background (`context.waitUntil`). Così uno user agent falso che prova URL a caso non crea righe.
- Scrittura via **Turso HTTP** (`POST https://<db>/v2/pipeline`): l'edge (Deno) non ha il client libsql. La pipeline fa `CREATE TABLE IF NOT EXISTS` + upsert: nessuna migrazione da lanciare.
- Env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` letti con `Netlify.env` (devono essere disponibili allo scope Functions). Senza URL non scrive niente.
- Nessun IP, nessun hash, nessun dato personale: solo bot, pagina normalizzata (senza `/` finale), giorno UTC, conteggio.

## Categorie

| kind | significato | esempi |
|---|---|---|
| `user` | l'assistente apre la pagina perché qualcuno gliel'ha chiesto in quel momento | ChatGPT-User, Claude-User, Perplexity-User |
| `search` | indice delle risposte con citazione | OAI-SearchBot, Claude-SearchBot, PerplexityBot |
| `training` | dataset per addestrare i modelli | GPTBot, ClaudeBot, CCBot, meta-externalagent |

## Dashboard

Scheda **Bot AI** in `/admin/analytics` (`public/admin/analytics/aibots.js`, feed proprio `GET /api/stats/ai-bots?from&to`, logica in `src/lib/ai-crawlers-stats.ts`): richieste per bot, pagine più lette (con quali bot), giorno per giorno e, accanto, le **sessioni umane del canale `ai`** (referrer chatgpt.com, perplexity.ai, claude.ai...) per fonte e pagina di ingresso. Segue il periodo scelto in alto; i filtri paese/dispositivo/canale non si applicano.

## Limiti

- Lo user agent si può falsificare; non verifichiamo gli IP dei vendor. Il filtro sullo status < 400 limita i danni.
- Google (Gemini/AI Overviews) usa Googlebot: non distinguibile, non contato. `Google-Extended` e `Applebot-Extended` sono token di `robots.txt`, non user agent.
- Nessuna retention: le righe sono poche (bot × pagine × giorni). Se crescono, aggiungere una pulizia a `runDailyJob`.
- In locale non gira (`devFeatures.edgeFunctions: false`, Deno non installato): testata con un harness Node e con `src/lib/ai-crawlers.test.ts`.
