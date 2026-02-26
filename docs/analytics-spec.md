# Self-Hosted Analytics — Spec

Clone privacy-first di Simple Analytics, self-hosted su Turso + Astro + Netlify Functions.

## Obiettivo

Sostituire Simple Analytics ($9/mese) con un sistema self-hosted che:
- Non usa cookie, localStorage o fingerprinting
- Non salva IP address
- Non richiede banner GDPR
- Gira sullo stesso stack del blog (Turso + Netlify)
- Costa $0 (Turso free tier: 9GB, 500M reads/mese)

## Architettura

```
Browser                    Netlify Functions              Turso
  |                             |                           |
  |-- POST /api/collect ------->|-- INSERT pageview ------->|
  |                             |                           |
  |   Dashboard (SSR)           |                           |
  |-- GET /api/stats ---------->|-- SELECT aggregati ------>|
  |<-- JSON aggregati ---------|<-- risultati --------------|
```

- **Tracking script**: JS inline (~2KB), caricato su ogni pagina
- **Collect endpoint**: Netlify Function, riceve pageview, deriva country da timezone, parsa UA
- **Stats endpoint**: Netlify Function, restituisce aggregati con filtri data
- **Dashboard**: pagina Astro SSR protetta da token (come `/admin/comments`)

---

## Dati raccolti per pageview

| Campo | Sorgente | Note |
|-------|----------|------|
| `pathname` | `window.location.pathname` | No query string, no hash |
| `referrer` | `document.referrer` | Solo hostname, dominio esterno |
| `utm_source` | URL param | Estratto e poi rimosso dall'URL |
| `utm_medium` | URL param | Estratto e poi rimosso dall'URL |
| `utm_campaign` | URL param | Estratto e poi rimosso dall'URL |
| `utm_content` | URL param | Estratto e poi rimosso dall'URL |
| `is_unique` | Referrer check | `true` se referrer hostname != current hostname |
| `screen_width` | `screen.width` | Dimensione schermo |
| `screen_height` | `screen.height` | Dimensione schermo |
| `viewport_width` | `window.innerWidth` | Dimensione viewport |
| `viewport_height` | `window.innerHeight` | Dimensione viewport |
| `language` | `navigator.language` | Es. `it-IT`, `en-US` |
| `timezone` | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Per derivare country |
| `user_agent` | `navigator.userAgent` | Parsato server-side |

### Dati derivati server-side

| Campo | Derivato da | Note |
|-------|-------------|------|
| `country` | `timezone` | Mapping timezone -> country (no IP geolocation) |
| `browser` | `user_agent` | Nome browser (Chrome, Firefox, Safari...) |
| `os` | `user_agent` | Sistema operativo |
| `device_type` | `viewport_width` | mobile (<768), tablet (768-1024), desktop (>1024) |

### Dati NON raccolti

- IP address (non salvato, non hashato)
- Cookie / localStorage / sessionStorage
- Fingerprint del browser
- Query string e hash dall'URL
- Dati personali identificabili

---

## Dati raccolti in differita (beacon)

Quando l'utente lascia la pagina o la nasconde, lo script invia un secondo beacon con:

| Campo | Sorgente | Note |
|-------|----------|------|
| `time_on_page` | Timer JS | Secondi di permanenza (solo tempo con tab visibile) |
| `scroll_depth` | `window.scrollY` | Percentuale massima raggiunta, arrotondata al 5% |

Questi vengono inviati con `navigator.sendBeacon()` su `visibilitychange` e collegati al pageview tramite un `page_id` generato client-side (UUID casuale, non persistente).

---

## Schema Database (Turso/SQLite)

```sql
CREATE TABLE pageviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id       TEXT NOT NULL,           -- UUID generato client-side per collegare beacon
  hostname      TEXT NOT NULL,           -- per supportare multi-dominio futuro
  pathname      TEXT NOT NULL,
  referrer      TEXT,                    -- hostname del referrer esterno, NULL se diretto
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  is_unique     INTEGER NOT NULL DEFAULT 0,  -- 1 = unique visit
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
  country       TEXT,                    -- derivato da timezone
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pv_created   ON pageviews(created_at);
CREATE INDEX idx_pv_pathname  ON pageviews(pathname);
CREATE INDEX idx_pv_hostname  ON pageviews(hostname, created_at);
CREATE INDEX idx_pv_page_id   ON pageviews(page_id);
```

### Stima dimensioni

- ~300 bytes per riga
- 1000 pageviews/giorno = ~9MB/mese = ~108MB/anno
- Turso free tier (9GB) = ~7 anni di dati

---

## API Endpoints

### `POST /api/collect`

Riceve un pageview dal tracking script.

**Request body:**
```json
{
  "type": "pageview",
  "page_id": "a1b2c3d4",
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
  "page_id": "a1b2c3d4",
  "time_on_page": 45,
  "scroll_depth": 80
}
```

**Logica server-side:**
1. Validazione campi (pathname obbligatorio, lunghezze max)
2. Se `type === "pageview"`:
   - Deriva `country` da `timezone` (lookup table statica)
   - Parsa `user_agent` per estrarre `browser`, `os`
   - Deriva `device_type` da `viewport_width`
   - Sanitizza `pathname` (rimuovi trailing slash, normalizza)
   - INSERT nella tabella `pageviews`
3. Se `type === "beacon"`:
   - UPDATE `time_on_page` e `scroll_depth` dove `page_id` corrisponde
4. Risposta: `204 No Content` (o `200` se errore silenzioso per bot)

**Rate limiting:** max 1 pageview/secondo per IP (in-memory, non persistente). L'IP non viene salvato.

**Bot filtering:** rifiuta se `user_agent` contiene pattern noti (bot, crawler, spider).

### `GET /api/stats`

Restituisce dati aggregati per la dashboard. Protetto da Bearer token (`ANALYTICS_ADMIN_TOKEN`).

**Query params:**
| Param | Default | Note |
|-------|---------|------|
| `period` | `30d` | `today`, `7d`, `30d`, `90d`, `12m`, `custom` |
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
    { "pathname": "/blog/non-fa-ridere-backstage", "pageviews": 450, "visitors": 320 }
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
  "utm_sources": [
    { "utm_source": "twitter", "visitors": 120 }
  ],
  "utm_campaigns": [
    { "utm_campaign": "launch", "visitors": 80 }
  ]
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

1. **Pageview**: al caricamento della pagina, raccoglie i dati e invia `POST /api/collect` con `type: "pageview"`
2. **Beacon**: su `visibilitychange` (tab nascosta/chiusa), invia `POST /api/collect` con `type: "beacon"` via `sendBeacon()`
3. **SPA support**: override di `history.pushState` per tracciare navigazioni client-side (utile se in futuro il blog usa View Transitions)
4. **Do Not Track**: se `navigator.doNotTrack === "1"`, non inviare nulla
5. **Bot detection**: skip se `navigator.webdriver === true`
6. **UTM extraction**: legge i parametri UTM dall'URL corrente, poi li rimuove dall'URL visibile con `replaceState` (URL pulito per l'utente)

### Dimensione target

- < 2KB minificato
- < 1KB gzipped
- Nessuna dipendenza
- No cookie, no localStorage, no sessionStorage

---

## Dashboard (`/admin/analytics`)

Pagina Astro SSR, protetta da token (`?token=ANALYTICS_ADMIN_TOKEN`), stessa logica di `/admin/comments`.

### Layout

```
+----------------------------------------------------------+
|  Analytics Dashboard               [Today] [7d] [30d] [90d] [12m]  |
+----------------------------------------------------------+
|                                                          |
|  [Pageviews: 3,420]  [Visitors: 1,890]  [Avg Time: 42s] |
|  [Scroll: 65%]       [Bounce: 45.2%]                    |
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

| File | Azione | Scopo |
|------|--------|-------|
| `src/components/BaseHead.astro` | **Modifica** | Sostituisci script Simple Analytics con tracking script inline |
| `src/lib/analytics.ts` | **Crea** | Utility: parse UA, timezone->country mapping, validazione |
| `src/pages/api/collect.ts` | **Crea** | Endpoint POST per ricevere pageview e beacon |
| `src/pages/api/stats.ts` | **Crea** | Endpoint GET per aggregati dashboard (protetto) |
| `src/pages/admin/analytics.astro` | **Crea** | Dashboard SSR |
| `src/components/AnalyticsDashboard.css` | **Crea** | Stili dashboard |
| `scripts/init-analytics-db.ts` | **Crea** | Script per creare tabella pageviews |
| `src/env.d.ts` | **Modifica** | Aggiungere `ANALYTICS_ADMIN_TOKEN` |
| `src/pages/privacy-policy.astro` | **Modifica** | Aggiornare testo (menzioniamo analytics anonimo) |
| `src/pages/en/privacy-policy.astro` | **Modifica** | Aggiornare testo EN |

### Dipendenze

- **Nessuna nuova dipendenza server-side** (usa `@libsql/client` gia installato)
- **Chart.js** (opzionale, per grafici dashboard) — da valutare se servono grafici lato client oppure generati server-side come SVG

---

## Env vars

```
ANALYTICS_ADMIN_TOKEN=<openssl rand -hex 32>
```

Riutilizza `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` gia configurati.

---

## Privacy policy

Aggiornare entrambe le versioni con testo tipo:

**IT:** "Utilizziamo un sistema di analytics self-hosted che non usa cookie, non raccoglie indirizzi IP e non memorizza dati personali. I dati raccolti (pagine visitate, referrer, tipo di dispositivo, lingua e paese derivato dal fuso orario) sono completamente anonimi e non permettono di identificare singoli utenti."

**EN:** "We use a self-hosted analytics system that does not use cookies, does not collect IP addresses, and does not store personal data. The data collected (pages visited, referrer, device type, language, and country derived from timezone) is fully anonymous and cannot identify individual users."

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

- **Timezone -> Country non e preciso al 100%**: un italiano in vacanza a New York avra timezone America/New_York ma e italiano. Accettabile per un blog personale.
- **No session tracking**: non abbiamo un concetto di "sessione" persistente. Ogni pageview e indipendente. Il bounce rate e approssimato dal tempo sulla pagina.
- **Rate limiting in-memory**: si resetta ad ogni cold start della function. Per un blog personale e sufficiente.
- **Niente real-time**: la dashboard mostra dati con un piccolo delay (query al DB). Nessun WebSocket.
- **Chart.js aggiunge ~60KB**: se il peso e un problema, possiamo generare SVG server-side o usare un'alternativa leggera.
