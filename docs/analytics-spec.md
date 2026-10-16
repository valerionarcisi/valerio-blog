# Self-Hosted Analytics — Spec

Clone privacy-first di Simple Analytics, self-hosted su Turso + Astro + Netlify Functions.

## Analytics v2 - Fase 1 (2026-10-15)

Piano: `docs/superpowers/plans/2026-10-15-analytics-v2.md`. Migrazione: `scripts/migrate-analytics-v2.ts` (idempotente).

- **Endpoint** `POST /api/e` (non `/api/collect`, che non esiste piu).
- **Hash visitatore con salt giornaliero segreto**: `HMAC-SHA256(salt_del_giorno, hostname:ip:ua)` troncato a 16 hex. Il salt (32 byte random) vive in `analytics_salts(day, salt)`, creato con `INSERT OR IGNORE` + rilettura, memoizzato per processo; i salt piu vecchi di 2 giorni vengono cancellati opportunisticamente (~1% delle richieste, `src/lib/analytics-salt.ts`). Se il DB non risponde si usa un salt casuale per processo (il tracking non si rompe mai). Gli hash dei giorni passati non sono piu riproducibili.
- **Paese da Netlify** (`x-nf-geo`, o `context.geo` se esposto; `src/lib/geo.ts`), fallback `countryFromTimezone`. IP e citta non vengono mai salvati.
- **Referrer pulito + canale**: i referrer con hostname del sito sono scartati; `channel` (`direct|search|social|ai|email|referral|campaign`) calcolato server-side da referrer + UTM (`src/lib/channels.ts`).
- **Validazione input** (`src/lib/analytics-input.ts`): `hostname` in allow-list, `pathname` che inizia con `/` (max 300, solo caratteri URL), UTM minuscoli max 100, `Origin` o `Referer` del sito obbligatorio (altrimenti 403), rate limit 60 eventi/minuto per hash visitatore (`rate-limit.ts`, fail-open, 429).
- **Beacon legato al pageview e cumulativo**: `page_id` = 24 hex da `crypto.getRandomValues`; l'UPDATE richiede anche `visitor_hash` uguale a quello calcolato dalla richiesta (accettato anche l'hash col salt di ieri, per i beacon a cavallo della mezzanotte UTC). `time_on_page = MAX(COALESCE(time_on_page,0), ?)`, `scroll_depth` idem.
- **Unicita atomica**: `daily_visitors(day, visitor_hash)` con `INSERT OR IGNORE`, `rowsAffected === 1` => `is_unique = 1`. Indice `idx_pv_visitor_day ON pageviews(visitor_hash, created_at)`.
- **localStorage**: resta solo il flag di opt-out `notrack` (dichiarato nella privacy policy IT/EN). Rimossa la coda di retry `_ae`.
- **Compatibilita pre-migrazione**: se mancano `channel`/`visitor_hash` l'INSERT riprova senza quelle colonne; se manca `daily_visitors` l'unicita ricade sul vecchio controllo; se manca `analytics_salts` si usa il salt di processo.

## Bot detection (Analytics v2 - Fase 4, 2026-10-15)

Sostituisce il flag manuale per `visitor_hash` con una **classificazione calcolata in lettura** (nessuna riga riscritta) piu **regole** che valgono anche nei giorni successivi. Migrazione: `scripts/migrate-analytics-v2.ts` (aggiunge `pageviews.human`, `pageviews.bot_score`, tabella `bot_rules`).

### Tre categorie

| Categoria | Quando (`src/lib/bot-verdict.ts`) | Nei numeri principali |
|---|---|---|
| **Bot** | `bot_score >= BOT_SCORE_THRESHOLD` (5) **oppure** `visitor_hash` in `bot_hashes` (LEGACY) | No |
| **Umano** | `human = 1` e non bot | Si |
| **Non verificato** | tutto il resto (nessun segnale umano, nessun indizio di bot) | No, mostrato a parte con la sua percentuale |

Il bot vince sull'umano: un client scriptato puo mandare anche `engage`. La percentuale `unverified_pct` e calcolata sulle visite non-bot (umani + non verificati).

### Segnale umano: `engage`

Il tracker invia `{type:"engage", page_id, hostname}` **una sola volta per pagina**: alla prima interazione reale (`scroll`, `pointerdown`, `keydown`, `touchstart`) oppure dopo 3 s di tempo visibile accumulato. `/api/e` fa `UPDATE pageviews SET human = 1 WHERE page_id = ? AND visitor_hash IN (hash di oggi, hash di ieri)`: stesso legame page_id + visitor_hash dei beacon, stessa tolleranza a cavallo della mezzanotte UTC. Non dipende dal beacon finale (che si perde spesso su iOS).

Limite noto: `human` e per riga (pageview). Un visitatore la cui *prima* pagina del giorno non ha prodotto engage ma la seconda si, ha `is_unique = 1` sulla riga non verificata: nei "visitatori" umani non compare (raro: bastano 3 s di lettura o un tocco sulla prima pagina).

### Punteggio al momento dell'ingest (`src/lib/bot-score.ts`, funzioni pure)

| Segnale | Peso |
|---|---|
| Manca `Accept-Language` | +3 |
| Mancano tutti gli header `Sec-Fetch-*` ma l'UA dichiara Chrome/Edge >= 90, Firefox >= 95, Safari >= 17 | +3 |
| Viewport 0, negativo o > 10000 (un viewport assente non conta) | +2 |
| Lingua con regione (`it-IT`, `ja-JP`...) e timezone di un altro continente (mappa ristretta, solo IT/DE/FR/ES/GB/JP/KR/CN/BR) | +2 |
| > 20 pageview nell'ultimo minuto per lo stesso hash (query su `pageviews` con `idx_pv_visitor_day`) | +3 |
| Percorso da scanner (`/wp-login.php`, `/.env`, `/xmlrpc.php`, `*.php`, `/wp-admin`, ...) | **scartato**: `204`, nulla salvato |

Soglia `BOT_SCORE_THRESHOLD = 5` (esportata): nessun segnale singolo la supera da solo, servono due indizi. I pesi sono un punto di partenza da tarare sui dati veri (`bot_score` e salvato per ogni riga). Una regola che corrisponde salva `bot_score = 99`.

### Regole (`src/lib/bot-rules.ts`, `bot_rules`)

`kind`: `ua_contains` (sottostringa dell'UA, valutata solo all'ingest: l'UA grezzo non e mai salvato), `referrer_host` (host esatto), `path_prefix`, `hash_today` (scade a fine giornata UTC, `expires_at` impostato alla creazione). Match case-insensitive; regole disattivate o scadute ignorate. Le regole sono in cache in memoria per ~60 s per processo (`invalidateRulesCache()` dopo ogni scrittura admin); il contatore `hits` e best-effort e un errore sulla tabella non rompe mai l'ingest.

Le regole valgono **dalle nuove visite**: le righe gia registrate non vengono riclassificate (disattivare una regola non "riabilita" visite passate; per questo l'anteprima prima di salvare e importante).

API admin (`requireAdmin`, cookie con CSRF same-origin oppure Bearer):

- `GET /api/admin/bot-rules` lista con `hits`; `POST {kind, value, note?}` crea; `PATCH {id, enabled}`; `DELETE {id}`.
- Validazione: kind in whitelist, valore max 200 caratteri, no caratteri di controllo; `ua_contains` >= 4 caratteri; `path_prefix` deve iniziare con `/` e non essere `/`; `referrer_host` deve essere un hostname e non un host del sito; `hash_today` = 16 hex. Duplicati => 409.
- `POST /api/admin/bot-rules/preview {kind, value}` => `{supported, days:7, excluded, human}`: quante pageview degli ultimi 7 giorni la regola avrebbe escluso e quante hanno `human = 1` (match in SQL con `LIKE ... ESCAPE`, wildcard escapate). `ua_contains` non e anteprimabile (UA non salvato): `supported:false`.

### API e dashboard

`GET /api/stats`: i campi principali contano **solo umani**. Nuovi campi: `quality {human, unverified, bot, unverified_pct}` (visite uniche per verdetto), `summary_legacy` (vecchio calcolo: tutto tranne `bot_hashes`), `review` (non verificati raggruppati per browser, os, device, country, referrer e pattern di percorso `/blog/*`; l'UA grezzo non e salvato, quindi non e raggruppabile), `mode` (`human`|`all`). `?include=all` restituisce il comportamento vecchio nei campi principali. `recent_visitors[].verdict` per riga. `/api/stats/live` conta tutti i non-bot (umani + non verificati): un visitatore appena arrivato non ha ancora avuto il tempo di interagire.

`/admin/analytics`: card "Qualita traffico", toggle "Includi non verificati" (`include=all`), lista "Da rivedere" con "Crea regola" (form inline precompilato con anteprima e avviso se colpisce visite umane), pannello "Regole bot" (hits, attiva/disattiva, elimina).

### Coesistenza e rimozione del legacy

Per **due settimane dal deploy** i due sistemi convivono: `summary_legacy` e il toggle mostrano i numeri vecchi accanto ai nuovi per tarare soglia e pesi. Restano attivi, marcati "legacy" in UI: `/api/admin/bot`, i pulsanti "Flag come bot", "Flag zero-engagement", "Annulla flag fatti oggi", "Annulla TUTTI", il 🤖 sulle righe, la tabella `bot_hashes` e la sua clausola in `bot-verdict.ts` (`BOT_SQL`, `NOT_LEGACY_BOT_SQL`).

Per rimuoverli (dopo il periodo di confronto): (1) togliere endpoint `src/pages/api/admin/bot.ts`, `bot-rollback.test.ts` e i pulsanti/handler legacy in `analytics.astro`; (2) togliere `NOT_LEGACY_BOT_SQL`/la clausola `bot_hashes` da `bot-verdict.ts`, `summary_legacy`, il blocco "Sospetti" e `suspicious` in `stats.ts`; (3) convertire gli hash storici in `bot_score = 99` sulle righe (`UPDATE pageviews SET bot_score = 99 WHERE visitor_hash IN (SELECT hash FROM bot_hashes)`) e ripristinare `is_unique` con `daily_visitors`; (4) `DROP TABLE bot_hashes`.

## Aggregati giornalieri e retention (Analytics v2 - Fase 3, 2026-10-15)

### Tabelle (`src/lib/analytics-rollup-schema.ts`, create da `scripts/migrate-analytics-v2.ts` e, se mancano, dal job stesso)

Tutte con `scope`: `'human'` (verdetto umano) e `'all'` (umani + non verificati = tutto tranne i bot, `NOT BOT_SQL`). I due scope bastano a ricostruire sia i numeri nuovi sia `?include=all`.

- `daily_stats(day, scope, pageviews, visitors, bounced, sum_time, n_time, sum_scroll, n_scroll)`
- `daily_pages(day, scope, pathname, pageviews, visitors, sum_time, n_time, sum_scroll, n_scroll, tp_visitors, tp_sum_scroll, tp_n_scroll)`: i `tp_*` sono le somme sulle sole righe con `time_on_page` non NULL (servono a "post piu letti", che filtra cosi).
- `daily_dims(day, scope, dim, value, pageviews, visitors)` con `dim` in `referrer, channel, country, browser, os, device, lang, utm_source, utm_campaign, section`. Referrer NULL = `value` `"\u0001null"`. La classificazione `section` e `SECTION_SQL` in `src/lib/analytics-sql.ts`, usata sia da `/api/stats` sia dal rollup.
- `rollup_log(day, computed_at, rows_in)`: un giorno e "chiuso" se ha una riga qui.

Le medie non si salvano mai: si tengono somme e conteggi e si dividono in lettura (mai media di medie). Un giorno senza righe non scrive nulla in `daily_*` (il grafico non ha il punto, come dai dati grezzi); resta solo la riga in `rollup_log`.

### Job (`netlify/functions/analytics-rollup.mts`, `src/lib/analytics-rollup.ts`)

Netlify Scheduled Function `20 0 * * *` (00:20 UTC, la directory `netlify/functions` e quella di default, nessuna modifica a `netlify.toml`). Calcola ieri **e** l'altro ieri (beacon in ritardo) con `rollupDay` e poi `pruneRaw`. `rollupDay(db, day)`: usa gli helper del verdetto (`HUMAN_SQL`, `BOT_SQL`) e, in **un solo** `db.batch([...], "write")`, cancella e reinserisce le righe del giorno (idempotente). Se mancano colonne di migrazioni successive (`human`, `bot_score`, `channel`...) o `bot_hashes` degrada invece di fallire. Le funzioni Netlify non ricevono il `define` di Vite usato da `env()`: la funzione legge `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` da `Netlify.env`/`process.env` (le variabili devono essere visibili al runtime "Functions") e usa import relativi.

### Retention (`pruneRaw`)

Pageviews grezzi: 90 giorni, **solo per i giorni con una riga in `rollup_log`** (mai cancellati dati non aggregati). Aggregati: per sempre. Pulisce anche `analytics_salts` e `daily_visitors` (2 giorni, come `purgeOldSalts`), `rate_limits` e `telegram_updates` (7 giorni), se esistono. Aggancio per `sessions` (Fase 2, 180 giorni): `DELETE FROM sessions WHERE day < ?`, no-op finche la tabella non esiste.

### `/api/stats` ibrido

Per il periodo richiesto, i giorni **prima di oggi (UTC)** con riga in `rollup_log` sono letti dai rollup (`scope` = `human`, o `all` con `include=all`), gli altri (oggi, non ancora aggregati, invalidati) dai dati grezzi con le query di sempre ristrette a quei giorni; i risultati si sommano. Query su intervalli con `GROUP BY`, niente cicli per giorno. Forma JSON identica, piu `source: {rollup_days, raw_days}` (debug; la dashboard lo mostra in "Aggiornamento dati"). Sempre da raw: `recent_visitors`, `suspicious`, `quality`, `review`, `summary_legacy` (coprono comunque i giorni recenti; su periodi oltre i 90 giorni contano solo i dati grezzi rimasti). Con il filtro `pathname` e per i grafici orari (periodo `today` / un solo giorno) si legge **solo raw**: i breakdown filtrati oltre i 90 giorni non sono disponibili (si restituisce cio che esiste). Test di equivalenza in `src/lib/analytics-rollup.test.ts`.

Nota: `include=all` ora e "umani + non verificati" (esclude anche i `bot_score` alti), coerente con lo scope `all`; `summary_legacy` resta il vecchio calcolo (tutto tranne `bot_hashes`) ed e solo da raw.

### Backfill e ricalcolo manuale

- `scripts/analytics-backfill.ts --from YYYY-MM-DD [--to YYYY-MM-DD]` (default `--to` = ieri): `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/analytics-backfill.ts --from 2026-07-01`. Idempotente. Eseguirlo **prima** che il job cancelli i dati vecchi.
- `POST /api/admin/analytics-rollup` `{from, to}` (admin; YYYY-MM-DD UTC, `to` prima di oggi, max 400 giorni): stesso ricalcolo. In dashboard, pulsante "Ricalcola aggregati" (periodo corrente, escluso oggi).

### Invalidazione

Flaggare/sbloccare hash dal vecchio `/api/admin/bot` cambia i numeri dei giorni passati: l'endpoint cancella (best effort, max 120 giorni) le righe `rollup_log` dei giorni di quegli hash, cosi `/api/stats` torna ai dati grezzi per quei giorni finche non si ricalcolano (pulsante o job). Le **regole bot non sono retroattive** (valgono dalle nuove visite, nessuna riga riscritta), quindi creare/disattivare una regola non invalida nulla. Giorni oltre i 90 giorni non hanno piu raw: restano i rollup com'erano.

## Sessioni, eventi e obiettivi (Analytics v2 - Fase 2, 2026-10-15)

Privacy: nessun cookie, nessun IP salvato, nessun identificativo persistente. L'unico identificativo e l'hash giornaliero con salt segreto (cancellato dopo 2 giorni): sessioni ed eventi si appoggiano a quello, quindi non seguono una persona da un giorno all'altro. Gli eventi hanno una whitelist chiusa con proprieta minuscole e validate: non possono trasportare testo libero.

Retention (decisione del proprietario): `sessions` 180 giorni, `events` grezzi 90 giorni (entrambi solo per i giorni con `rollup_log`), aggregati per sempre. Migrazione: `scripts/migrate-analytics-v2.ts` (idempotente; `/api/e` degrada se non applicata).

### Sessioni (`src/lib/analytics-sessions.ts`)

- Sessione = stesso `visitor_hash` con pausa < 30 minuti (la finestra scorre a ogni pageview e a ogni beacon). In `/api/e`, a ogni pageview: si cerca l'ultima sessione dell'hash con `last_seen_at > now-30min`, altrimenti se ne crea una (`entry_path`, `channel`, `referrer`, `country`, `device_type`); si aggiornano `pageviews`, `exit_path`, `last_seen_at`, `bot_score = MAX(...)` e si collega `pageviews.session_id`.
- `engaged_seconds`: i beacon sono cumulativi per pagina; alla sessione si somma solo il **delta** rispetto al valore gia salvato (mai negativo).
- `human`: la sessione eredita `human = 1` quando UNA qualsiasi delle sue pageview manda `engage` (semantica della Fase 4). Verdetto sessione = stessi helper `HUMAN_SQL`/`BOT_SQL` sulle colonne `human`, `bot_score`, `visitor_hash` della sessione. Le visite non verificate restano fuori dai numeri principali (scope `human`), incluse con `include=all`.
- **Mezzanotte UTC**: l'hash ruota ogni giorno, quindi una visita a cavallo si divide **legittimamente in due sessioni**. `day` = giorno di inizio. E il prezzo di non avere un identificativo persistente.
- Due prime pageview quasi simultanee possono creare due sessioni (nessun lock): accettato.
- **Bounce reale** = sessione con esattamente 1 pageview e `engaged_seconds < 10`. Se il beacon finale si perde (iOS/Safari) il tempo resta 0 e il bounce e leggermente sovrastimato. `summary.bounce_rate` (vecchio, per visitatore: prima visita del giorno con < 5 s) resta invariato; il numero vero e `sessions.bounce_rate`.

### Eventi (`src/lib/analytics-events.ts`)

Whitelist: `clap`, `comment_submit`, `comment_like`, `contact_submit`, `outbound_click`, `download`, `not_found`, `scroll_75`, `scroll_100`, `copy_code`, `share`. Prop: `outbound_click` = solo hostname di destinazione (max 100); `download` = estensione in `pdf, zip, epub, mp3, mp4, docx, xlsx`; `share` = `x, twitter, linkedin, reddit, facebook, whatsapp, telegram, email, copy, native`; `not_found` = host del referrer (opzionale); gli altri non hanno prop (ignorata). Nome sconosciuto o prop non valida: scartato (204).

`POST /api/e {type:"event", name, prop, page_id, hostname, pathname}`: stessi controlli degli altri beacon (Origin/Referer, rate limit 60/min fail-open, hash di oggi o di ieri). L'evento e legato a una pageview dello STESSO visitatore (`page_id` + hash); il `path` salvato e quello della pageview, non quello del body. `scroll_75`/`scroll_100` una sola volta per `page_id` (INSERT ... WHERE NOT EXISTS). Tabella `events(id, created_at, day, session_id, visitor_hash, name, path, prop, page_id)` (`page_id` in piu rispetto al piano, serve al dedupe).

Tracker: `window.va.track(name, prop)` (assente se `notrack`/webdriver/admin: usare `window.va && window.va.track(...)`). Gli eventi aspettano la risposta del pageview. Un solo listener `click` delegato (link in uscita -> `outbound_click`; link a file -> `download`; `data-share` -> `share`), `copy` dentro `pre/code` (una volta per pagina), scroll 75/100 solo su `/blog/` e `/en/blog/`. Strumentati a mano: claps (`PostClaps.astro`), like e invio commenti (`Comments.astro`), `contact_submit` (la pagina contatti non ha un form: e il commento inviato con `pageId="contact"`), share (`ShareButtons.astro`: X/LinkedIn/Reddit via `data-share`, copia e condivisione nativa a mano), 404 (`src/pages/404.astro`, `not_found` col referrer host).

### Obiettivi (`src/lib/analytics-goals.ts`)

Lista tipizzata: `contact` (`contact_submit`), `comment` (`comment_submit`), `engaged_read` (`scroll_75` solo su post), `outbound` (`outbound_click`). Conversioni = **sessioni distinte** (per giorno di inizio sessione) con l'evento; tasso = conversioni / sessioni dello stesso scope; per canale e per le 10 pagine di ingresso migliori (denominatore = sessioni di quel canale/ingresso). Cambiare la lista vale per i rollup futuri: per ricalcolare il passato rilanciare il rollup.

### Rollup e lettura ibrida

Tabelle (in `ROLLUP_DDL`): `daily_sessions(day, scope, sessions, bounced_sessions, pageviews, engaged_seconds)`, `daily_events(day, scope, name, prop, count, visitors)` (prop `''` = nessuna), `daily_entry_exit(day, scope, kind, path, sessions)`, e in piu `daily_goals(day, scope, goal, dim, value, conversions)` (dim `total|channel|entry`; goal `_sessions` = denominatori per canale/ingresso). Gli SQL sono generati da una sola funzione (`src/lib/analytics-session-stats.ts`) usata sia dal rollup (INSERT ... SELECT per un giorno) sia dalla lettura raw, quindi non possono divergere (test di equivalenza in `analytics-sessions-rollup.test.ts`, scope `human` e `all`). Un evento appartiene allo scope della sua sessione; eventi senza sessione non contano. `visitors` di `daily_events` = hash distinti nel giorno (somma sui giorni, come gli altri rollup).

`GET /api/stats`: campi NUOVI, forme esistenti invariate: `sessions {available, count, bounce_rate, pages_per_session, avg_engaged_seconds, by_channel, count_delta_pct, bounce_rate_delta_pp, prev_period}`, `channels` (visitatori per canale), `entry_pages`, `exit_pages` (top 10), `events [{name, prop, count, visitors}]`, `goals [{id, label, conversions, rate, by_channel, by_entry, conversions_delta_pct}]`. Sessioni/eventi/obiettivi non sono filtrati da `pathname` (una sessione attraversa piu pagine): con il filtro o col grafico orario si legge raw. Se la migrazione non e applicata `sessions.available = false`.

`GET /api/stats/live`: se esiste `sessions`, `active` = visitatori distinti con `sessions.last_seen_at > now-5min`, bot esclusi; altrimenti la query sulle pageview. `pageviews5m` resta dalle pageview.

Dopo il deploy: rilanciare il rollup dei giorni recenti (`POST /api/admin/analytics-rollup` o "Ricalcola aggregati"), altrimenti i giorni gia chiusi prima del deploy risultano a zero sessioni.

Limiti noti: i giorni rollupati prima della Fase 2 non hanno sessioni; le sessioni a cavallo della mezzanotte si dividono; nessun filtro per paese/device sulle card nuove.

## Recent changes (2026-05-27)

- **Live counter** `/api/stats/live` — `DISTINCT visitor_hash` in ultimi 5 min, esclude bot flaggati. Polling 30s dalla dashboard. Cache-Control `no-store` per evitare stale.
- **Bot exclusion globale** — `baseWhere` di `/api/stats` ora esclude `visitor_hash IN (SELECT hash FROM bot_hashes)` su TUTTE le query (pageviews, visitors, top pages, ecc.). Prima escludeva solo dal contatore "sospetti", lasciando pageviews gonfi.
- **Auto-refresh "Visitatori recenti"** — la dashboard ripolla `/api/stats?period=today` ogni 30s quando il period attivo è "Oggi" e la tab è in foreground.
- **Featured live card UI** — sezione "Visitatori recenti" promossa in posizione 2 (dopo summary stats), wrap in card terracotta-bordered, pallino verde pulsante next al titolo.
- **Contrast bump** — `--ax-page-ink-soft` da 0.72 → 0.86 alpha, `--ax-page-ink-mute` da 0.45 → 0.66 alpha. Testo piccolo passa WCAG AA con margine.
- **Removed client-side language redirect** — il vecchio script in `BaseHead.astro` redirigeva non-italiani a `/en/`, gonfiando Speed Index e confondendo Googlebot. Tolto. La selezione lingua resta manuale via header IT/EN.

Il resto di questa spec descrive il sistema base ancora valido. Sezione "Bot detection" qui sotto è ancora autoritativa, ma il punto chiave da ricordare è che il flag mette `is_unique = 0` sulle righe del visitor_hash + aggiunge l'hash a `bot_hashes`, e da lì TUTTE le query stats escludono automaticamente.

## Obiettivo

Sostituire Simple Analytics ($9/mese) con un sistema self-hosted che:

- Non usa cookie ne fingerprinting; l'unico dato nel browser e il flag di opt-out `notrack` in localStorage (solo se il visitatore/proprietario si esclude)
- Non salva IP address
- Non richiede banner GDPR
- Gira sullo stesso stack del blog (Turso + Netlify)
- Costa $0 (Turso free tier: 9GB, 500M reads/mese)

## Architettura

```
Browser                    Netlify Functions              Turso
  |                             |                           |
  |-- POST /api/e ------------->|-- INSERT pageview ------->|
  |                             |                           |
  |   Dashboard (SSR)           |                           |
  |-- GET /api/stats ---------->|-- SELECT aggregati ------>|
  |<-- JSON aggregati ---------|<-- risultati --------------|
```

- **Tracking script**: JS inline (~2KB), caricato su ogni pagina
- **Collect endpoint** `/api/e`: Netlify Function, valida l'input, deriva country da Netlify geo (fallback timezone), canale da referrer/UTM, parsa UA
- **Stats endpoint**: Netlify Function, restituisce aggregati con filtri data
- **Dashboard**: pagina Astro SSR protetta da token (come `/admin/comments`)

---

## Dati raccolti per pageview

| Campo             | Sorgente                                           | Note                                            |
| ----------------- | -------------------------------------------------- | ----------------------------------------------- |
| `pathname`        | `window.location.pathname`                         | No query string, no hash                        |
| `referrer`        | `document.referrer`                                | Solo hostname; i referrer del sito stesso sono scartati |
| `utm_source`      | URL param                                          | Estratto e poi rimosso dall'URL                 |
| `utm_medium`      | URL param                                          | Estratto e poi rimosso dall'URL                 |
| `utm_campaign`    | URL param                                          | Estratto e poi rimosso dall'URL                 |
| `utm_content`     | URL param                                          | Estratto e poi rimosso dall'URL                 |
| `is_unique`       | `daily_visitors`                                   | `1` alla prima visita del giorno (INSERT OR IGNORE atomico) |
| `channel`         | referrer + UTM                                     | `direct`, `search`, `social`, `ai`, `email`, `referral`, `campaign` |
| `screen_width`    | `screen.width`                                     | Dimensione schermo                              |
| `screen_height`   | `screen.height`                                    | Dimensione schermo                              |
| `viewport_width`  | `window.innerWidth`                                | Dimensione viewport                             |
| `viewport_height` | `window.innerHeight`                               | Dimensione viewport                             |
| `language`        | `navigator.language`                               | Es. `it-IT`, `en-US`                            |
| `timezone`        | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Per derivare country                            |
| `user_agent`      | `navigator.userAgent`                              | Parsato server-side                             |

### Dati derivati server-side

| Campo         | Derivato da      | Note                                              |
| ------------- | ---------------- | ------------------------------------------------- |
| `country`     | `x-nf-geo` / timezone | Netlify geo (solo codice paese), fallback mapping timezone |
| `browser`     | `user_agent`     | Nome browser (Chrome, Firefox, Safari...)         |
| `os`          | `user_agent`     | Sistema operativo                                 |
| `device_type` | `viewport_width` | mobile (<768), tablet (768-1024), desktop (>1024) |

### Dati NON raccolti

- IP address (non salvato, non hashato)
- Cookie / sessionStorage; localStorage solo per il flag `notrack`
- Fingerprint del browser
- Query string e hash dall'URL
- Dati personali identificabili

---

## Dati raccolti in differita (beacon)

Il tracker invia un beacon **cumulativo** a ogni `visibilitychange -> hidden` e a ogni `pagehide`:

| Campo          | Sorgente         | Note                                                |
| -------------- | ---------------- | --------------------------------------------------- |
| `time_on_page` | Timer JS         | Secondi accumulati **solo** mentre `visibilityState === "visible"` |
| `scroll_depth` | `window.scrollY` | Percentuale massima raggiunta, arrotondata al 5%    |

Il beacon porta anche `page_id` e `hostname` (per ricalcolare l'hash). Payload identici consecutivi non vengono rinviati. Il server fa `MAX(valore_esistente, valore_ricevuto)` con clamp a 3600s / 100%, quindi un lettore che cambia tab e torna viene misurato per intero, e un beacon fuori ordine non puo abbassare i valori. L'UPDATE richiede `page_id` **e** `visitor_hash` della richiesta corrente: un beacon puo aggiornare solo le proprie righe. Invio con `navigator.sendBeacon()` (fallback `fetch` con `keepalive`).

---

## Schema Database (Turso/SQLite)

```sql
CREATE TABLE pageviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id       TEXT NOT NULL,           -- 24 hex casuali generati client-side per collegare il beacon
  hostname      TEXT NOT NULL,           -- per supportare multi-dominio futuro
  pathname      TEXT NOT NULL,
  referrer      TEXT,                    -- hostname del referrer esterno, NULL se diretto
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  is_unique     INTEGER NOT NULL DEFAULT 0,  -- 1 = unique visit
  visitor_hash  TEXT,                    -- HMAC-SHA256(salt giornaliero, hostname:ip:ua), 16 hex — no IP salvato
  time_on_page  INTEGER,                -- secondi (aggiornato via beacon)
  scroll_depth  INTEGER,                -- percentuale 0-100 (aggiornato via beacon)
  browser       TEXT,
  os            TEXT,
  device_type   TEXT,                    -- 'desktop', 'tablet', 'mobile'
  screen_width  INTEGER,
  screen_height INTEGER,
  viewport_width  INTEGER,
  viewport_height INTEGER,
  language      TEXT,
  country       TEXT,                    -- Netlify geo, fallback timezone
  channel       TEXT,                    -- direct|search|social|ai|email|referral|campaign
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bot_hashes (
  hash  TEXT PRIMARY KEY               -- visitor_hash flaggato come bot
);

CREATE INDEX idx_pv_created   ON pageviews(created_at);
CREATE INDEX idx_pv_pathname  ON pageviews(pathname);
CREATE INDEX idx_pv_hostname  ON pageviews(hostname, created_at);
CREATE INDEX idx_pv_page_id   ON pageviews(page_id);
CREATE INDEX idx_pv_visitor_day ON pageviews(visitor_hash, created_at);

CREATE TABLE analytics_salts (       -- salt segreto giornaliero, cancellato dopo 2 giorni
  day   TEXT PRIMARY KEY,
  salt  TEXT NOT NULL
);

CREATE TABLE daily_visitors (        -- unicita atomica: INSERT OR IGNORE, rowsAffected === 1 => unico
  day           TEXT NOT NULL,
  visitor_hash  TEXT NOT NULL,
  PRIMARY KEY (day, visitor_hash)
);
```

### Stima dimensioni

- ~300 bytes per riga
- 1000 pageviews/giorno = ~9MB/mese = ~108MB/anno
- Turso free tier (9GB) = ~7 anni di dati

---

## API Endpoints

### `POST /api/e`

Riceve un pageview dal tracking script.

**Request body:**

```json
{
  "type": "pageview",
  "page_id": "a1b2c3d4e5f6a7b8c9d0e1f2",
  "hostname": "valerionarcisi.me",
  "pathname": "/blog/non-fa-ridere-backstage",
  "referrer": "google.com",
  "utm_source": "twitter",
  "utm_medium": null,
  "utm_campaign": null,
  "utm_content": null,
  "is_unique": true,
  "screen_width": 1920,
  "screen_height": 1080,
  "viewport_width": 1440,
  "viewport_height": 900,
  "language": "it-IT",
  "timezone": "Europe/Rome",
  "user_agent": "Mozilla/5.0..."
}
```

**Oppure beacon di aggiornamento:**

```json
{
  "type": "beacon",
  "page_id": "a1b2c3d4e5f6a7b8c9d0e1f2",
  "hostname": "valerionarcisi.me",
  "time_on_page": 45,
  "scroll_depth": 80
}
```

**Logica server-side:**

1. `Origin` (o, se assente, `Referer`) deve appartenere al sito, altrimenti `403`. UA bot => `204`. JSON non valido o `type` sconosciuto => `400`.
2. Validazione (`analytics-input.ts`): `hostname` in allow-list (`valerionarcisi.me`, `www.`, `localhost`, `127.0.0.1`), `pathname` che inizia con `/` max 300 con solo caratteri URL, `page_id` 8-64 caratteri `[A-Za-z0-9_-]`, UTM minuscoli max 100. Input non valido => `204` (scartato in silenzio).
3. Salt del giorno (UTC) -> `visitor_hash`; rate limit 60/min per hash (`429`, fail-open).
4. `pageview`: country (Netlify geo, poi timezone), canale, `INSERT OR IGNORE INTO daily_visitors` per `is_unique`, un solo INSERT in `pageviews` (se le colonne nuove mancano riprova senza).
5. `beacon`: `UPDATE ... SET time_on_page = MAX(...), scroll_depth = MAX(...) WHERE page_id = ? AND visitor_hash IN (hash di oggi, hash di ieri)`.
6. Risposta `204 No Content`.

**Rate limiting:** 60 eventi/minuto per `visitor_hash` tramite `src/lib/rate-limit.ts` (tabella `rate_limits`, chiave = hash, nessun IP salvato).

**Bot filtering — 3 livelli (livelli 2 e 3 = LEGACY, vedi "Bot detection" sopra per il nuovo modello):**
1. **UA-based (ingestion)**: `isbot@5.1.35` — blocca bot/crawler/spider noti prima che la visita venga salvata. UA vuoto → bloccato.
2. **Behavioral (automatico post-ingestion)**: se lo stesso `visitor_hash` fa ≥2 visite in 7 giorni con zero engagement (time_on_page ≤5s e scroll_depth = 0), viene auto-inserito in `bot_hashes`.
3. **Manuale (admin)**: dalla dashboard è possibile flaggare singoli visitatori o fare bulk-flag di tutti i suspect del periodo. I flaggati finiscono in `bot_hashes` e vengono esclusi da tutte le query di stats.

### `GET /api/stats`

Restituisce dati aggregati per la dashboard. Protetto da Bearer token (`ANALYTICS_ADMIN_TOKEN`).

**Query params:**
| Param | Default | Note |
|-------|---------|------|
| `period` | `today` | `today`, `7d`, `30d`, `90d`, `12m`, `custom` |
| `from` | - | ISO date, per `custom` |
| `to` | - | ISO date, per `custom` |
| `pathname` | - | Filtra per pagina specifica |

**Response:**

```json
{
  "period": { "from": "2026-01-27", "to": "2026-02-26" },
  "summary": {
    "pageviews": 3420,
    "visitors": 1890,
    "avg_time_on_page": 42,
    "avg_scroll_depth": 65,
    "bounce_rate": 45.2
  },
  "chart": [
    { "date": "2026-01-27", "pageviews": 120, "visitors": 80 },
    { "date": "2026-01-28", "pageviews": 95, "visitors": 62 }
  ],
  "top_pages": [
    {
      "pathname": "/blog/non-fa-ridere-backstage",
      "pageviews": 450,
      "visitors": 320
    }
  ],
  "referrers": [
    { "referrer": "google.com", "visitors": 400 },
    { "referrer": "twitter.com", "visitors": 120 },
    { "referrer": null, "visitors": 800, "label": "Direct" }
  ],
  "countries": [
    { "country": "IT", "visitors": 1200 },
    { "country": "US", "visitors": 300 }
  ],
  "browsers": [
    { "browser": "Chrome", "visitors": 900 },
    { "browser": "Safari", "visitors": 500 }
  ],
  "os": [
    { "os": "macOS", "visitors": 600 },
    { "os": "Windows", "visitors": 500 }
  ],
  "devices": [
    { "device_type": "desktop", "visitors": 1100 },
    { "device_type": "mobile", "visitors": 700 }
  ],
  "languages": [
    { "language": "it", "visitors": 1400 },
    { "language": "en", "visitors": 400 }
  ],
  "utm_sources": [{ "utm_source": "twitter", "visitors": 120 }],
  "utm_campaigns": [{ "utm_campaign": "launch", "visitors": 80 }]
}
```

**Regole aggregazione:**

- `visitors` = COUNT di `is_unique = 1`
- `pageviews` = COUNT totale
- `bounce_rate` = percentuale di unique visitors con `time_on_page < 5` o NULL
- `chart` raggruppato per giorno (o per ora se `period=today`, per settimana se `period=12m`)
- Tutti i breakdown limitati a top 20 per default
- `language` troncato ai primi 2 caratteri per aggregazione (it-IT -> it)

---

## Tracking Script

Script JS leggero (~2KB minificato) da caricare inline su ogni pagina.

### Comportamento

1. **Pageview**: al caricamento della pagina, raccoglie i dati e invia `POST /api/e` con `type: "pageview"` e un `page_id` casuale di 24 hex
2. **Beacon cumulativo**: su ogni `visibilitychange → hidden` **e** `pagehide`, invia `type: "beacon"` con il tempo visibile accumulato (nessun flag `sent`; si salta solo un payload identico al precedente)
3. **SPA support**: override di `history.pushState` per tracciare navigazioni client-side (utile se in futuro il blog usa View Transitions)
4. **Do Not Track**: se `navigator.doNotTrack === "1"`, non inviare nulla
5. **Bot detection**: skip se `navigator.webdriver === true`
6. **UTM extraction**: legge i parametri UTM dall'URL corrente, poi li rimuove dall'URL visibile con `replaceState` (URL pulito per l'utente)

### Dimensione target

- < 2KB minificato
- < 1KB gzipped
- Nessuna dipendenza
- No cookie, no sessionStorage; localStorage solo per `notrack` (nessuna coda di retry)

---

## Dashboard (`/admin/analytics`)

Pagina Astro SSR, protetta da token (`?token=ADMIN_TOKEN`), stessa logica di `/admin/comments`.

### Comportamento default

- **Periodo iniziale**: sempre `today` all'apertura (nessun ripristino da localStorage)
- I pulsanti periodo cambiano la vista ma non vengono ricordati al prossimo accesso

### Layout

```
+----------------------------------------------------------+
|  Analytics Dashboard               [Today] [7d] [30d] [90d] [12m]  |
+----------------------------------------------------------+
|                                                          |
|  [Pageviews: 3,420]  [Visitors: 1,890]  [Avg Time: 42s] |
|  [Scroll: 65%]       [Bounce: 45.2%]    [Suspected Bots] |
|                                                          |
|  ┌──────────────────────────────────────────────┐        |
|  │  📈 Line chart: pageviews + visitors / tempo  │        |
|  │                                              │        |
|  └──────────────────────────────────────────────┘        |
|                                                          |
|  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        |
|  │ Top Pages   │ │ Referrers   │ │ Countries   │        |
|  │ /blog/...   │ │ google.com  │ │ 🇮🇹 IT 1200 │        |
|  │ /films/...  │ │ twitter.com │ │ 🇺🇸 US 300  │        |
|  └─────────────┘ └─────────────┘ └─────────────┘        |
|                                                          |
|  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        |
|  │ Browsers    │ │ OS          │ │ Devices     │        |
|  │ Chrome 48%  │ │ macOS 32%   │ │ Desktop 58% │        |
|  │ Safari 27%  │ │ Windows 27% │ │ Mobile 37%  │        |
|  └─────────────┘ └─────────────┘ └─────────────┘        |
|                                                          |
|  ┌─────────────┐ ┌─────────────┐                        |
|  │ Languages   │ │ UTM Sources │                        |
|  │ it 74%      │ │ twitter 6%  │                        |
|  │ en 21%      │ │ newsletter  │                        |
|  └─────────────┘ └─────────────┘                        |
+----------------------------------------------------------+
```

### Stack UI

- HTML/CSS puro (coerente con il resto del blog)
- Chart: `<canvas>` con libreria leggera (Chart.js ~60KB) oppure SVG generato server-side
- Tema dark coerente con admin comments
- JS inline per fetch dati e interattività (cambio periodo, filtro pagina)
- Responsive (ma ottimizzato desktop, uso primario)

---

## File da creare/modificare

| File                                    | Azione       | Scopo                                                          |
| --------------------------------------- | ------------ | -------------------------------------------------------------- |
| `src/components/BaseHead.astro`         | **Modifica** | Sostituisci script Simple Analytics con tracking script inline |
| `src/lib/analytics.ts`                  | **Crea**     | Utility: parse UA, timezone->country mapping, validazione      |
| `src/pages/api/e.ts`                    | **Crea**     | Endpoint POST per ricevere pageview e beacon                   |
| `src/lib/analytics-salt.ts`, `analytics-input.ts`, `channels.ts`, `geo.ts` | **Crea** | Salt giornaliero, validazione, canali, geo (Fase 1) |
| `scripts/migrate-analytics-v2.ts`       | **Crea**     | Migrazione idempotente Fase 1                                  |
| `src/pages/api/stats.ts`                | **Crea**     | Endpoint GET per aggregati dashboard (protetto)                |
| `src/pages/admin/analytics.astro`       | **Crea**     | Dashboard SSR                                                  |
| `src/components/AnalyticsDashboard.css` | **Crea**     | Stili dashboard                                                |
| `scripts/init-analytics-db.ts`          | **Crea**     | Script per creare tabella pageviews                            |
| `src/env.d.ts`                          | **Modifica** | Aggiungere `ANALYTICS_ADMIN_TOKEN`                             |
| `src/pages/privacy-policy.astro`        | **Modifica** | Aggiornare testo (menzioniamo analytics anonimo)               |
| `src/pages/en/privacy-policy.astro`     | **Modifica** | Aggiornare testo EN                                            |

### Dipendenze

- **Nessuna nuova dipendenza server-side** (usa `@libsql/client` gia installato)
- **Chart.js** (opzionale, per grafici dashboard) — da valutare se servono grafici lato client oppure generati server-side come SVG

---

## Web Vitals, filtri, export, card home e report settimanale (Analytics v2 - Fase 5, 2026-10-15)

Decisioni del proprietario: Web Vitals SI (~1 KB nel tracker), report Telegram settimanale SI, le visite "non verificate" restano fuori dai numeri principali, raw 90 giorni. Migrazione: `scripts/migrate-analytics-v2.ts` (colonne `pageviews.lcp_ms`, `cls_milli`, `inp_ms` + tabella `daily_vitals`, idempotente; `/api/e` degrada se non applicata, `/api/stats` risponde `vitals.available = false`).

### Web Vitals (RUM)

- **Tracker** (`BaseHead.astro`, senza librerie, ~+1,1 KB non compresso / ~+0,5 KB gzip): `PerformanceObserver` con `buffered`, per tipo supportato. **LCP** = ultimo `largest-contentful-paint`, smette di aggiornarsi al primo `keydown`/`pointerdown`. **CLS** = massima *session window* (shift senza input recente, finestra chiusa da un gap >= 1 s o a 5 s di durata). **INP** = eventi `event` con `durationThreshold: 40`, raggruppati per `interactionId` (massimo per interazione), valore = p98 delle interazioni (il piu lento sotto le 50 interazioni). Valori mandati nel beacon cumulativo gia esistente (`lcp_ms`, `cls` come numero, `inp_ms`), solo se misurati: tipo non supportato = chiave assente, nessuna richiesta in piu. Test: `analytics-tracker-vitals.test.ts` esegue il vero script in una VM con un browser finto.
- **Server** (`parseVitals` in `analytics-vitals.ts`): `lcp_ms` 0-60000, `inp_ms` 0-10000, `cls` 0-10, fuori range = scartato (il beacon resta valido). `UPDATE` separato da tempo/scroll: LCP/INP = ultimo valore non nullo (`COALESCE(?, col)`), CLS = `MAX` (`cls_milli` = CLS x 1000). Senza le colonne il beacon salva comunque tempo e scroll.
- **Rollup** `daily_vitals(day, scope, device, metric, n, good, ni, poor, p75)`, PK `(day, scope, device, metric)`; `device` = `all` + ogni `device_type` (NULL = `unknown`); `metric` = `lcp|inp|cls`; `p75` in unita di storage (ms; CLS in millesimi). Soglie Google: LCP 2500/4000 ms, INP 200/500 ms, CLS 0,1/0,25 (buono <= prima, scarso > seconda). p75 del giorno = *nearest rank* sui valori ordinati, esatto.
- **Lettura** (`analytics-vitals-stats.ts`): giorni chiusi da `daily_vitals`, oggi / filtri / `pathname` / grafico orario da raw. I conteggi dei bucket sono **esatti** in ogni caso; il p75 e esatto per un solo giorno o per una lettura tutta raw; su piu giorni rollupati e la **media dei p75 giornalieri pesata per n (approssimazione)**: un p75 vero su piu giorni richiederebbe i valori grezzi. Test di equivalenza rollup vs raw in `analytics-vitals-stats.test.ts`.
- **`GET /api/stats`**: `vitals {available, lcp:{p75,good,ni,poor,n}, inp, cls, by_device:{mobile, desktop}}` (`cls.p75` in unita CLS) e `vitals_pages` (le 10 pagine con LCP p75 peggiore, n >= 5, solo raw, ultimi 90 giorni intersecati col periodo). I giorni rollupati prima del deploy non hanno vitals (non esistevano misure), nessun backfill necessario.

### Filtri globali

`country` (2 lettere), `device` (`mobile|tablet|desktop`), `channel` (`direct|search|social|ai|email|referral|campaign`) come query param di `/api/stats` (e dell'export); valori non validi = 400. Si applicano a riepilogo, grafico, top pagine, referrer, dimensioni, sessioni (`sessions` ha `country/device_type/channel`), eventi, obiettivi e vitals. **I filtri esistono solo sulle righe grezze**: con un filtro attivo l'API legge solo raw (`source.rollup_days = 0`), il periodo viene ridotto alla finestra di retention (90 giorni: `period.from` = max(richiesto, oggi - 90), `filters.clamped`, `filters.requested_from`) e il confronto col periodo precedente e `null` se non rientra nella finestra. La dashboard mostra una nota esplicita. SQL: `src/lib/analytics-filters.ts` (valori validati a insiemi chiusi, inseriti come letterali).

### Export CSV

`GET /api/stats/export?kind=top_pages|referrers|utm|channels|events|goals|daily&from&to` (+ `include=all`, filtri; max 400 giorni; default ultimi 30). `requireAdmin` (cookie o Bearer, GET = niente CSRF). Risposta `text/csv`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `nosniff`; liste **non troncate**. CSV RFC 4180 con CRLF (`src/lib/csv.ts`); le celle di testo che iniziano con `= + - @` (o tab/CR) sono precedute da `'` contro la CSV injection; i numeri non vengono toccati. Link "Esporta CSV" nelle intestazioni delle card.

### Card "Analytics oggi" (`/admin`)

`src/lib/analytics-summary.ts`, renderizzata lato server con **soft failure** (qualsiasi errore o 3 s di timeout = "dati non disponibili", la home non si rompe). Giorno = **giorno UTC** (come tutto il resto), solo visite umane; l'ora di aggiornamento e mostrata in Europe/Rome. Mostra: visitatori oggi; ieri **alla stessa ora** (taglio allo stesso orario UTC) e ieri totale, con variazione %; top 3 post di oggi (pageview). **Regola picco**: avviso se `visitatori oggi >= 10` E `visitatori oggi > 2 x media` dei visitatori (stesso orario, dalle 00:00 UTC) degli ultimi 7 stessi giorni della settimana (-7, -14, ... -49 giorni).

### Report settimanale Telegram

- Formatter puro `src/lib/analytics-report.ts` (testo semplice, niente `parse_mode`: nulla da escapare). Settimana = ultimo lunedi-domenica completo per **date Europe/Rome**, mappate 1:1 sui giorni UTC dell'analytics (qualche ora di scarto ai bordi, irrilevante) vs la settimana prima. Contenuto: visitatori e pageview con delta %, riga qualita (visite umane verificate vs non verificate), top 3 post, top 3 canali, obiettivi con conversioni, LCP mobile p75 con giudizio (se ci sono misure), link a `https://valerionarcisi.me/admin/analytics` (nessun token). Dati dagli stessi helper ibridi di `/api/stats`.
- Consegna: Netlify Scheduled Function `netlify/functions/analytics-weekly-report.mts`, cron `0 6 * * 1` (UTC) = lunedi 07:00 Roma in inverno (CET), **08:00 in estate (CEST)**: Netlify non ha fuso orario nel cron, la deriva di un'ora con l'ora legale e accettata. Legge `TURSO_*`, `TELEGRAM_BOT_TOKEN` e la destinazione da `Netlify.env`/`process.env` (come `analytics-rollup.mts`; import relativi; `fetch` con `AbortSignal.timeout(8000)`; l'URL contiene il token del bot quindi gli errori non lo propagano). Destinazione: `ANALYTICS_REPORT_CHAT_ID`, altrimenti il primo id di `TELEGRAM_USER_ID_WHITELIST`; senza token o destinazione logga e non fa nulla. Opt-out: `ANALYTICS_REPORT_DISABLED=1`.
- Test sicuro: `POST /api/admin/analytics-report` (admin) con `{}` = **dry run**, ritorna `{text, sent:false, dryRun:true}` senza inviare; `{"send":true}` invia davvero (rispetta opt-out e destinazione).

### Env vars (Fase 5)

`ANALYTICS_REPORT_CHAT_ID` (opzionale, chat del report; fallback primo id di `TELEGRAM_USER_ID_WHITELIST`), `ANALYTICS_REPORT_DISABLED` (`1` = nessun invio). Gia necessarie: `TELEGRAM_BOT_TOKEN`, `TURSO_*`, `ADMIN_TOKEN`.

## Dashboard in stile GA con vista Utenti (2026-10)

Sostituisce il layout a pagina unica di `/admin/analytics`. Look Foglio (tema scuro via `data-theme="dark"`, solo token `--foglio-*`; aggiunto `--foglio-scrim`), mobile-first, bersagli da 44px.

**Architettura**: scheletro HTML in `src/pages/admin/analytics.astro`, stile in `src/styles/admin-analytics.css`, logica in moduli ES nativi `public/admin/analytics/*.js` (stesso posto e stile di `admin-client.js`, di cui usa i globali `escapeHtml/apiJson/vitalState...`; Chart.js e Leaflet restano script classici con SRI). Nessuna dipendenza nuova.

**Informazione**: barra superiore (periodo Oggi/7g/30g/90g/12m + date personalizzate, filtri paese/device/canale con la nota sul limite raw 90 giorni, "Aggiornamento dati" + "Ricalcola aggregati") e tab ARIA nell'hash URL: `#panoramica`, `#utenti`, `#acquisizione`, `#coinvolgimento`, `#tecnologia`, `#bot`. I tab si disegnano in modo pigro da un solo payload `/api/stats`; "Utenti" ha il suo feed paginato.

- **Panoramica**: "In tempo reale" (`/api/stats/live`, ogni 30 s, in pausa a tab nascosto), 6 scorecard (Utenti, Sessioni, Pageview, Tempo attivo medio, Tasso di coinvolgimento = 100 - bounce reale delle sessioni, Eventi) con delta (freccia + testo) e sparkline SVG, grafico Chart.js con scelta metrica e periodo precedente tratteggiato (seconda chiamata `/api/stats` sul periodo `summary.prev_period`), canali, paesi (mappa + lista), dispositivi.
- **Utenti**: elenco di sessioni recenti (una riga = una visita) con verdetto, filtri rapidi (solo umani / tutti / non verificati / bot, solo con eventi) e i filtri globali; riepilogo "chi c'e ora" dagli utenti attivi; pannello dettaglio (bottom sheet su mobile, laterale su desktop) con cronologia di pagine ed eventi, Web Vitals se presenti, "Crea regola da questo visitatore" (stesso flusso anteprima/salvataggio delle regole bot, su referrer o pagina di ingresso) e "Flag come bot (legacy)".
- **Acquisizione**, **Coinvolgimento**, **Tecnologia**, **Bot & qualita**: tutto cio che mostrava la vecchia pagina (qualita traffico + "Includi non verificati", Da rivedere, Regole bot, pulsanti legacy, mappa, sezioni, post piu letti, sessioni/ingresso-uscita/canali/eventi/obiettivi, Web Vitals, UTM, export CSV). Tempo e scroll per pagina esistono solo per i post (rollup `daily_pages`); il trend per canale non e disponibile (nessuna serie per canale).

### Endpoint nuovi (admin, cookie o Bearer)

- `GET /api/stats/sessions?from&to&limit(30, max 100)&cursor&verdict(human|unverified|bot|all, default human)&country&device&channel&with_events=1` -> `{sessions:[{id,user,started_at,last_seen_at,country,device,browser,os,channel,referrer,entry_path,exit_path,pageviews,engaged_seconds,verdict,human,events_count}], next_cursor, available}`. Solo tabelle raw (`sessions` 180 giorni); ordine `started_at DESC, id DESC` con cursore keyset opaco (base64url di `started_at|id`), stabile anche con timestamp uguali. Browser/OS dalla prima pageview della sessione (indice `(visitor_hash, created_at)`, nessun indice nuovo). Senza tabella `sessions`: `{sessions:[], next_cursor:null, available:false}`. 400 per date/limit/cursor/verdict/filtri non validi.
- `GET /api/stats/sessions/[id]` -> `{session, pageviews:[{path,at,time_on_page,scroll_depth,lcp_ms,inp_ms,cls}], events:[{name,prop,path,at}]}` in ordine cronologico; `session` aggiunge `language` e UTM. 400 id non numerico, 404 inesistente.
- `GET /api/stats/live`: invariati `active` (numero) e `pageviews5m`; nuovo `active_sessions:[{user,country,device,path,last_seen_at}]` (sessioni viste negli ultimi 5 minuti, max 20, bot esclusi). Il campo si chiama `active_sessions` perche `active` e gia il conteggio.
- `/api/stats`: nuovi campi `sessions.daily` (serie giornaliera per le sparkline), `sessions.events_total`, `sessions.prev_period.{avg_engaged_seconds,events_total}`. Corretto il periodo precedente per `period=today` (prima era 2 giorni, ora esattamente ieri).
- `POST /api/admin/bot` accetta anche `{sessionId}` (LEGACY): il pannello Utenti non conosce mai l'hash.

### Privacy

Mai IP ne hash completo nelle risposte: solo `user` = primi 6 caratteri dell'hash, mostrati come "Utente #a1b2c3". L'hash ruota ogni giorno (salt giornaliero): chi torna il giorno dopo compare come un nuovo utente, e la dashboard lo dichiara in una riga. Coperto dai test (`src/pages/api/stats/_sessions.test.ts`).

### Dati demo

`scripts/seed-analytics-demo.ts` riempie un DB sqlite LOCALE con ~30 giorni di traffico sintetico (paesi, device, browser, canali, umani/non verificati/bot, 1-6 pageview per sessione, eventi, Web Vitals, regole bot con colpi, sessioni in tempo reale), dopo `migrateAnalyticsV2`, e ricalcola i rollup dei giorni chiusi. **Rifiuta di partire** (exit 1) se `TURSO_DATABASE_URL` non inizia con `file:`, perche svuota le tabelle analytics. Uso: `TURSO_DATABASE_URL=file:/tmp/demo.db TURSO_AUTH_TOKEN=x npx -y tsx scripts/seed-analytics-demo.ts`, poi `TURSO_DATABASE_URL=file:/tmp/demo.db TURSO_AUTH_TOKEN=x ADMIN_TOKEN=localtest pnpm start`.

## Env vars

```
ADMIN_TOKEN=<openssl rand -hex 32>
```

Riutilizza `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` gia configurati.

---

## Privacy policy

Le due versioni (`src/pages/privacy-policy.astro`, `src/pages/en/privacy-policy.astro`) dichiarano: analytics self-hosted senza cookie, IP mai salvato (usato solo in memoria per un identificativo anonimo che si azzera ogni giorno), paese dalla posizione approssimativa dell'hosting o dal fuso orario, e **una frase esplicita sul flag `notrack`**: il browser lo memorizza in localStorage solo se il visitatore/proprietario si esclude dal conteggio, senza identificativi.

---

## Ordine implementazione

1. Crea tabella DB (`scripts/init-analytics-db.ts`)
2. Crea `src/lib/analytics.ts` (parsing UA, timezone->country, validazione)
3. Crea `POST /api/collect` endpoint
4. Sostituisci script SA con tracking script inline in `BaseHead.astro`
5. Crea `GET /api/stats` endpoint
6. Crea dashboard `/admin/analytics`
7. Aggiorna privacy policy IT/EN
8. Test e deploy

---

## Limiti e trade-off

- **Country da Netlify geo e approssimato** (VPN, viaggiatori); in locale/dev manca l'header e si ricade sul timezone (mapping parziale, altrimenti `NULL`).
- **No session tracking** (Fase 2): ogni pageview e indipendente; il bounce rate e approssimato dal tempo sulla pagina.
- **Rate limit su DB** (`rate_limits`): 2 query in piu per evento; fail-open se il DB non risponde.
- **Niente real-time**: la dashboard mostra dati con un piccolo delay (query al DB).
- **Chart.js aggiunge ~60KB**: se il peso e un problema, possiamo generare SVG server-side.

### Caveat di accuratezza (come leggere i numeri)

- **`time_on_page` / `scroll_depth` dipendono dal beacon.** Se nessun beacon arriva (offline, browser che non emette `visibilitychange` ne `pagehide`) restano `NULL`; gli `AVG` ignorano i `NULL`, quindi i valori medi riflettono le visite "ingaggiate". Con il beacon cumulativo il tempo di chi torna sulla tab e poi la chiude viene sommato.
- **`bounce_rate` tende a essere sovrastimato**: quota di unique visitor con `time_on_page < 5` **o `NULL`**.
- **`visitors` su range multi-giorno = somma degli unici giornalieri**: l'hash cambia ogni giorno (salt), quindi chi torna in 3 giorni conta 3. Voluto: nessun tracciamento tra giorni.
- **Confine giornaliero in UTC** (`created_at` = `datetime('now')`, salt per giorno UTC).
- **"Live" conta pageview attive, non utenti distinti** (`COUNT(DISTINCT page_id)` negli ultimi 5 minuti).
- **Storico**: le righe precedenti alla Fase 1 hanno `channel = NULL` e hash col vecchio schema (non confrontabili con i nuovi).
