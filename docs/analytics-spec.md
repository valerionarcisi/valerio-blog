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
