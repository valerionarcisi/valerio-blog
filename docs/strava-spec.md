# Strava Integration — Spec

## Obiettivo

Mostrare sul sito le attivita sportive recenti dell'utente provenienti da Strava, con statistiche aggregate (settimanali e mensili), un grafico della corsa settimanale, una distribuzione per tipo di attivita e un breakdown giornaliero. I dati vengono recuperati a runtime tramite un endpoint API serverless (Netlify) che interroga le API Strava v3.

## Architettura

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│  Browser     │──GET──▶ /api/strava       │──────▶│ Strava OAuth │
│  (client JS) │       │ (Netlify fn,     │       │ Token URL    │
│              │◀─JSON─│  prerender:false) │       └──────┬───────┘
└──────────────┘       │                  │              │
                       │  services/       │◀─────────────┘
                       │  strava.ts       │  access_token
                       │                  │
                       │                  │──GET──▶ Strava API v3
                       │                  │         /athlete/activities
                       │                  │◀─JSON──
                       └──────────────────┘
                              │
                  Formatta + aggrega dati
                              │
                              ▼
                       JSON response
                       {activities, stats,
                        dailyBreakdown,
                        yearlyBreakdown,
                        typeDistribution,
                        weeklyRunStats}
```

**Flusso:**

1. Il client chiama `GET /api/strava`.
2. L'endpoint effettua in parallelo due chiamate al service layer:
   - `fetchRecentActivities(5)` — ultime 5 attivita.
   - `fetchFullStats()` — tutte le attivita dell'ultimo anno (paginazione automatica a blocchi di 200).
3. Il service ottiene un `access_token` fresco tramite OAuth2 refresh token grant.
4. I dati grezzi vengono normalizzati, aggregati e formattati.
5. La risposta JSON viene restituita con `Cache-Control: public, max-age=900` (15 minuti).

## Dati

### Interfacce principali (definite in `services/strava.ts`)

**`StravaActivity`** — Risposta grezza dell'API Strava:

| Campo               | Tipo     | Note                          |
|---------------------|----------|-------------------------------|
| id                  | number   | ID univoco attivita           |
| name                | string   | Nome attivita                 |
| type                | string   | Tipo generico (Run, Ride...)  |
| sport_type          | string   | Tipo specifico (TrailRun...)  |
| start_date          | string   | ISO 8601                      |
| distance            | number   | Metri                         |
| moving_time         | number   | Secondi                       |
| elapsed_time        | number   | Secondi (incluse pause)       |
| total_elevation_gain| number   | Metri                         |
| average_speed       | number   | m/s                           |
| max_speed           | number   | m/s                           |
| average_heartrate   | number?  | bpm (opzionale)               |
| max_heartrate       | number?  | bpm (opzionale)               |
| suffer_score        | number?  | Indice di sforzo (opzionale)  |
| kudos_count         | number   | Numero di kudos               |

**`NormalizedActivity`** — Versione normalizzata (camelCase, campi ridotti):

| Campo            | Tipo     | Note                              |
|------------------|----------|-----------------------------------|
| id               | number   |                                   |
| name             | string   |                                   |
| type             | string   |                                   |
| sportType        | string   |                                   |
| date             | string   | ISO 8601                          |
| distance         | number   | Metri                             |
| movingTime       | number   | Secondi                           |
| elevation        | number   | Metri                             |
| averageSpeed     | number   | m/s                               |
| averageHeartrate | number?  | bpm                               |
| kudos            | number   |                                   |
| url              | string   | Link diretto a strava.com         |

**`ActivityStats`** — Statistiche aggregate per un periodo:

| Campo            | Tipo   | Note                             |
|------------------|--------|----------------------------------|
| totalActivities  | number | Conteggio attivita               |
| totalDistance     | number | Metri                            |
| totalElevation   | number | Metri                            |
| totalMovingTime  | number | Secondi                          |
| averagePace      | number | Secondi per km (media ponderata) |

**`DailyBreakdown`** — Dettaglio giornaliero (ultimi 30 o 365 giorni):

| Campo      | Tipo             | Note                                    |
|------------|------------------|-----------------------------------------|
| date       | string           | YYYY-MM-DD                              |
| distance   | number           | Metri totali del giorno                 |
| duration   | number           | Secondi totali del giorno               |
| type       | string           | Sport type dell'attivita principale     |
| color      | string           | Colore associato al tipo                |
| activities | DailyActivity[]  | Lista di tutte le attivita del giorno   |

**`TypeDistribution`** — Distribuzione per tipo di sport (ultimo mese):

| Campo         | Tipo   | Note                          |
|---------------|--------|-------------------------------|
| type          | string | sport_type                    |
| label         | string | Etichetta leggibile           |
| color         | string | Colore hex                    |
| totalDistance  | number | Metri                         |
| totalDuration | number | Secondi                       |
| count         | number | Numero attivita               |
| percentage    | number | Percentuale sul totale (0-100)|

**`WeeklyRunStats`** — Statistiche settimanali di corsa (ultime 8 settimane):

| Campo     | Tipo   | Note                         |
|-----------|--------|------------------------------|
| weekLabel | string | Es. "3-9/2" o "28/1-3/2"    |
| weekStart | string | YYYY-MM-DD                   |
| distance  | number | Metri                        |
| pace      | number | Secondi per km               |
| runs      | number | Numero corse                 |
| elevation | number | Dislivello totale in metri   |

### Formato risposta API (`GET /api/strava`)

```json
{
  "activities": [
    {
      "id": 123,
      "name": "Morning Run",
      "type": "Run",
      "sportType": "Run",
      "date": "2026-03-25T07:00:00Z",
      "distance": 10000,
      "movingTime": 3000,
      "elevation": 150,
      "averageSpeed": 3.33,
      "kudos": 5,
      "url": "https://www.strava.com/activities/123",
      "formattedDistance": "10.0 km",
      "formattedDuration": "50m",
      "formattedPace": "5:00 /km",
      "color": "#fc4c02",
      "label": "Run",
      "formattedDate": "Mar 25",
      "hasDistance": true,
      "formattedElevation": "↑150m"
    }
  ],
  "stats": {
    "weekly": {
      "distance": "32.5 km",
      "duration": "2h 45m",
      "pace": "5:05 /km",
      "elevation": "↑320m",
      "count": 4
    },
    "monthly": { "..." : "..." }
  },
  "dailyBreakdown": [ "..." ],
  "yearlyBreakdown": [ "..." ],
  "typeDistribution": [ "..." ],
  "weeklyRunStats": [ "..." ]
}
```

## API Endpoints

### `GET /api/strava`

- **File**: `src/pages/api/strava.ts`
- **Prerender**: `false` (serverless function)
- **Autenticazione**: Nessuna (endpoint pubblico)
- **Cache**: `Cache-Control: public, max-age=900` (15 minuti)
- **Risposta successo**: `200` con body JSON (vedi formato sopra)
- **Risposta errore**: `500` con `{ "error": "Internal error" }`

L'endpoint esegue due chiamate parallele al service layer:
1. `fetchRecentActivities(5)` — le ultime 5 attivita
2. `fetchFullStats()` — statistiche complete dell'ultimo anno

`fetchFullStats()` internamente pagina le attivita a blocchi di 200 (loop `while` fino a batch < 200), poi calcola:
- **periodStats**: statistiche aggregate per gli ultimi 7 e 30 giorni
- **dailyBreakdown**: breakdown giornaliero degli ultimi 30 giorni
- **yearlyBreakdown**: breakdown giornaliero degli ultimi 365 giorni
- **typeDistribution**: distribuzione per tipo di sport (ultimi 30 giorni)
- **weeklyRunStats**: statistiche corsa per le ultime 8 settimane (solo `Run` e `TrailRun`)

## Componenti UI

### `ActivityCard.astro`

Card singola per un'attivita. Mostra:
- Dot colorato per tipo + etichetta tipo (es. "Run", "Trail")
- Nome attivita (titolo)
- Statistiche: distanza, durata, passo, dislivello
- Data
- Link esterno a Strava

**Props**: `{ activity: NormalizedActivity }`

### `ActivityList.astro`

Lista compatta di attivita in formato riga. Ogni riga mostra: dot colorato, nome, statistiche (distanza, durata, passo, dislivello), data. Ogni riga e un link a Strava.

**Props**: `{ activities: NormalizedActivity[] }`

### `StravaSummary.astro`

Riepilogo statistiche settimanali e mensili su due righe. Ogni riga mostra: badge periodo ("7d" / "30d" personalizzabili), distanza totale, numero attivita, passo medio, dislivello totale. I valori sono separati da un punto mediano (`·`).

**Props**: `{ stats: PeriodStats; weekLabel?: string; monthLabel?: string }`

### `RunWeeklyChart.astro`

Grafico SVG inline che mostra l'andamento della corsa nelle ultime 8 settimane. Due linee sovrapposte:
- **Linea continua arancione** (`#fc4c02`): distanza in km (con area riempita sotto)
- **Linea tratteggiata gialla** (`#c8a000`): passo medio

Caratteristiche:
- Asse Y sinistro: distanza in km
- Asse Y destro: passo (min:sec)
- Asse X: etichette settimana (es. "3-9/2")
- Indicatore numero corse sopra ogni punto (`3x`)
- Evidenziazione della settimana migliore (dot piu grande + alone)
- Tooltip SVG con dettagli
- Stato vuoto: messaggio "Nessuna corsa recente"

**Props**: `{ weeks: WeeklyRunStats[] }`

Dimensioni SVG: viewBox `700x160`, padding 40px laterale, 24px top, 28px bottom.

### `ActivityDonut.astro`

Grafico a ciambella SVG che mostra la distribuzione delle attivita per tipo (ultimo mese). Al centro del donut: numero totale attivita. Legenda laterale con dot colorato, etichetta e percentuale.

**Props**: `{ distribution: TypeDistribution[]; totalActivities: number }`

Parametri SVG: viewBox `100x100`, raggio 36, stroke-width 8.

## File coinvolti

| File                                    | Ruolo                                     |
|-----------------------------------------|-------------------------------------------|
| `src/services/strava.ts`               | Service layer: auth, fetch, normalizzazione, aggregazione, formattazione |
| `src/pages/api/strava.ts`              | Endpoint API serverless                   |
| `src/components/ActivityCard.astro`     | Card singola attivita                     |
| `src/components/ActivityCard.css`       | Stili card attivita                       |
| `src/components/ActivityList.astro`     | Lista compatta attivita                   |
| `src/components/ActivityList.css`       | Stili lista attivita                      |
| `src/components/StravaSummary.astro`    | Riepilogo statistiche periodo             |
| `src/components/StravaSummary.css`      | Stili riepilogo                           |
| `src/components/RunWeeklyChart.astro`   | Grafico corsa settimanale                 |
| `src/components/RunWeeklyChart.css`     | Stili grafico                             |
| `src/components/ActivityDonut.astro`    | Grafico a ciambella distribuzione tipo    |
| `src/components/ActivityDonut.css`      | Stili donut                               |

## Dipendenze

- **Astro 5** — Framework SSR/SSG, rendering componenti `.astro`
- **Netlify Adapter** — Esecuzione endpoint serverless (`prerender: false`)
- **Strava API v3** — Sorgente dati attivita (`/athlete/activities`)
- **Strava OAuth2** — Refresh token grant per ottenere access token

Nessuna dipendenza npm aggiuntiva: il service usa solo `fetch` nativo e logica pura per aggregazione, formattazione e calcolo statistiche.

## Env vars

| Variabile               | Obbligatoria | Descrizione                                        |
|--------------------------|:------------:|----------------------------------------------------|
| `STRAVA_CLIENT_ID`       | Si           | Client ID dell'app Strava                          |
| `STRAVA_CLIENT_SECRET`   | Si           | Client Secret dell'app Strava                      |
| `STRAVA_REFRESH_TOKEN`   | Si           | Refresh token con scope `activity:read_all`        |

Tutte e tre sono necessarie per ottenere l'access token tramite il flusso OAuth2 refresh grant. L'access token non viene persistito: viene richiesto ad ogni invocazione dell'endpoint.

## Limiti e trade-off

1. **Token refresh ad ogni richiesta**: L'access token non viene cachato in memoria o su storage. Ogni chiamata a `/api/strava` genera un refresh token grant verso Strava. Questo semplifica l'architettura (nessun stato da gestire) ma raddoppia la latenza e consuma rate limit.

2. **Rate limit Strava**: Le API Strava hanno limiti di 100 richieste ogni 15 minuti e 1000 al giorno. La cache HTTP di 15 minuti (`max-age=900`) mitiga il problema, ma in caso di deployment frequenti o cache miss multipli si rischia di raggiungere il limite.

3. **Paginazione completa per le statistiche**: `fetchFullStats()` scarica tutte le attivita dell'ultimo anno con paginazione a blocchi di 200. Per utenti molto attivi questo puo significare piu richieste sequenziali all'API Strava, aumentando la latenza.

4. **Nessuna persistenza dati**: I dati non vengono salvati su database. Ogni richiesta ricostruisce le statistiche da zero. Un crash dell'API Strava rende la sezione non disponibile.

5. **Calcolo lato server**: Tutta l'aggregazione (daily breakdown, type distribution, weekly run stats) avviene nel serverless function. Per dataset grandi (365 giorni di attivita) il tempo di calcolo e trascurabile, ma la latenza di rete verso Strava domina.

6. **Endpoint pubblico senza autenticazione**: `/api/strava` e accessibile a chiunque. La cache HTTP limita l'abuso, ma non c'e protezione esplicita contro scraping o attacchi volumetrici.

7. **Formattazione date fissa in inglese**: Le date nelle attivita sono formattate in `en-us` (`"Mar 25"`), indipendentemente dalla lingua del sito. Il grafico settimanale ha invece etichette in italiano ("Corsa settimanale", "corse", "Nessuna corsa recente").

8. **Solo corsa nel grafico settimanale**: `RunWeeklyChart` filtra solo attivita di tipo `Run` e `TrailRun`. Altre attivita con distanza (Ride, Swim, Walk) non compaiono nel grafico.

9. **Mappa colori e etichette hardcoded**: I tipi di attivita supportati (Run, TrailRun, Walk, Hike, Ride, Swim, WeightTraining, Workout, Yoga, Crossfit) sono definiti in due lookup table statiche. Tipi non mappati ricevono un colore grigio di fallback (`#8a8a8e`) e usano il nome grezzo come etichetta.
