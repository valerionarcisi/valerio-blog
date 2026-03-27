# Training — Spec

## Obiettivo

Dashboard privata per il monitoraggio settimanale degli allenamenti e la generazione di un **suggerimento smart per il weekend**, basato su:
- Carico settimanale (km, dislivello, HR, palestra)
- Storico recente (ultime 4 settimane come baseline)
- Meteo del weekend (Open-Meteo, gratuito)
- Obiettivo di gara personale (4:40–4:50 /km)

Nessun input manuale — tutto automatico da Strava + meteo.

## Architettura

```
Browser (admin/training?token=XXX)
  |
  | SSR: verifica token, serializza dati in JSON
  v
+--------------------+     +------------------+
| training.astro     |     | Open-Meteo API   |
| (SSR)              |---->| (fetch at build  |
|                    |     |  time, no key)   |
+--------------------+     +------------------+
  |
  | fetch() client-side con Bearer token
  v
+--------------------+     +------------------+
| /api/strava        |---->| Strava API       |
| (existing)         |     | (yearly data)    |
+--------------------+     +------------------+

Flusso:
1. SSR chiama Strava + Open-Meteo, serializza in props
2. JS client elabora: calcola carico settimana, baseline, suggerimento
3. Tutto client-side rendering (stesso pattern di meditation.astro)
```

## Logica suggerimento weekend

### Input
- `weekKm` — km corsi lunedì–venerdì
- `weekElevation` — dislivello totale settimana
- `weekRuns` — numero corse settimana
- `hasGym` — sessione palestra questa settimana
- `avgKm4w` — media km settimanali ultime 4 settimane (baseline)
- `lastHillyDate` — ultima corsa con >100m dislivello
- `last3WeeksAllEasy` — nessun suggerimento di fartlek recente
- `weatherSat` / `weatherSun` — temperatura e probabilità pioggia

### Output
- Range km target (es. "16–19 km")
- Tipo uscita: `long_easy` / `long_tempo` / `hilly` / `recovery` / `rest`
- Sugg. passo (es. "5:30–5:45 /km")
- Giorno consigliato (sabato o domenica, in base al meteo)
- Testo motivazionale breve

### Step 1 — Calcola la distanza suggerita (progressione adattiva)

Il sistema non usa un range fisso. Inferisce il target dalla progressione reale:

```
// Storico ultimi 12 weekend (sabato + domenica)
longestRecent = max long run degli ultimi 30 giorni
avgLong4w     = media km lunghi ultimi 4 weekend
hrLastLong    = HR medio ultima corsa lunga
paceLastLong  = passo ultima corsa lunga
paceAvg4w     = passo medio ultime 4 settimane

// Readiness score (0–100)
readiness = 50 (base)
+ if weekKm < avgKm4w * 0.8 → +15 (settimana leggera, gambe fresche)
+ if hrLastLong < hrAvg4w - 5 → +15 (ultima lunga facile per il cuore)
+ if paceLastLong < paceAvg4w - 10sec → +10 (ultima lunga ben gestita)
- if weekKm > avgKm4w * 1.2 → -20 (settimana pesante)
- if hasGym AND weekRuns >= 3 → -10 (accumulo fatica)
- if daysSinceLastRun < 1 → -15 (corsa ieri)

// Target distanza
if readiness >= 80:
  target = longestRecent * 1.12   // push: +12% (regola 10%)
elif readiness >= 60:
  target = longestRecent * 1.05   // consolidamento
elif readiness >= 40:
  target = avgLong4w               // mantieni
else:
  target = avgLong4w * 0.75        // recovery

// Arrotonda a km interi, min 10km, no hard ceiling
// Se target > 25km la prima volta → cap a longestRecent + 3km (sicurezza)
```

Esempio reale: se fai 18km per 3 weekend con basso HR → readiness alta → suggerisce 20km. Se lo fai bene, la settimana dopo suggerisce 22km. Se l'HR era alto → consolida a 18km.

### Step 2 — Tipo di uscita

```
if readiness < 35:
  → recovery: ritmo +30sec rispetto paceAvg, km cappati a min(targetKm * 0.75, 14)

elif weekKm < 10 AND weekRuns == 0:
  → easy: ritmo +15sec, "riattiva le gambe"

elif daysSinceHilly > 21 AND weekElevation < 50 AND readiness >= 55:
  → hilly: suggerisce dislivello adattivo basato su media ultime 4 uscite collinari
    (readiness >= 70 → avgHillyElev * 1.1, altrimenti * 0.9, arrotondato a 50m, range 100–400m)

elif weeksConsecutiveEasy >= 3:
  → fartlek: ultimi 25% a ritmo -25sec rispetto paceAvg
    (segnala progressione verso obiettivo 4:40–4:50)

else:
  → long_easy: readiness >= 70 → "spingere sulla distanza", altrimenti standard
```

### Step 3 — Meteo override

```
if rainSat > 60%: prefer Sunday
if rainSun > 60% AND rainSat > 60%: "corri sabato mattina presto prima della pioggia"
if temp > 22°C: target_km -= 2, pace += 10sec/km, segnala "caldo — idratati"
if temp < 2°C: segnala "freddo — riscaldamento lungo"
```

### Progressione verso 4:40–4:50
Traccia il passo medio mensile. Ogni 3 settimane in cui readiness >= 60,
inserisce un segmento a ritmo soglia nel lungo. Mostra delta: "sei a 58 sec
dall'obiettivo — con costanza ci arrivi in 3–4 mesi".

## Dati / Schema DB

Nessuna nuova tabella — tutti i dati vengono da Strava API e Open-Meteo.

## API Endpoints

### GET `/api/training` (nuovo, protetto da Bearer token)
Aggrega dati Strava + meteo Open-Meteo. Chiamato client-side con `Authorization: Bearer ADMIN_TOKEN`.

**Response:**
```json
{
  "currentWeekActivities": [...],     // attività da lunedì corrente a oggi
  "last4WeeklyKm": [32, 28, 35, 30], // km per settimana ultimi 4 lunedì
  "weekendLongRuns": [...],           // corse weekend lunghe (>8km) ultimi 90gg
  "last12WeeklyElevation": [...],     // dislivello per settimana ultime 12
  "weeklyRunStats": [...],            // aggregati settimanali per chart 12w
  "weather": { "2026-03-28": { "temp": 14, "rain": 3, "code": 2 }, ... }
}
```

`weekendLongRuns` include `{ date, distanceM, movingTime, elevation, averageHeartrate }`.

| Campo | Dettaglio |
|---|---|
| URL | `https://api.open-meteo.com/v1/forecast` |
| Params | `latitude`, `longitude`, `daily=precipitation_probability_max,temperature_2m_max,weathercode&forecast_days=7&timezone=Europe/Rome` |
| Auth | Nessuna (gratuito) |
| Fallback | Se fetch fallisce, nasconde sezione meteo senza bloccare la pagina |

Coordinate: **Porto Sant'Elpidio, FM** (43.256, 13.760) — hardcodate in `src/pages/api/training.ts`.

## Componenti UI

```
┌─────────────────────────────────────────────┐
│  Allenamento                                │
│  Settimana 21–27 marzo                      │
├─────────────────────────────────────────────┤
│  QUESTA SETTIMANA                           │
│  32.9km  4 corse  ↑200m  1 palestra         │
│  ████████░░░░ Settimana nella media         │
├─────────────────────────────────────────────┤
│  🎯 SUGGERIMENTO WEEKEND                    │
│  Domenica — 16–19 km                        │
│  Ritmo facile 5:30–5:45/km                  │
│  ☀️ 14°C · pioggia 10%                      │
│  "Volume normale questa settimana.          │
│   Non hai fatto dislivello — ottima          │
│   occasione per un percorso collinare."     │
├─────────────────────────────────────────────┤
│  ANDAMENTO 12 SETTIMANE                     │
│  [barre km per settimana + linea pace]      │
├─────────────────────────────────────────────┤
│  OBIETTIVO GARA  4:40–4:50 /km              │
│  Passo attuale: 5:38/km  delta: -58 sec     │
│  ████░░░░░░░░ Progresso stimato: 3–4 mesi  │
├─────────────────────────────────────────────┤
│  ULTIME ATTIVITÀ (ordine inverso, più recente prima)  │
│  [lista compatta cliccabile → Strava]                 │
└───────────────────────────────────────────────────────┘
```

## File da creare/modificare

| File | Azione | Scopo |
|---|---|---|
| `src/pages/admin/training.astro` | Creato | Pagina SSR con UI completa, logica client-side |
| `src/pages/api/training.ts` | Creato | Endpoint GET: aggrega Strava + Open-Meteo |
| `src/services/strava.ts` | Modificato | Aggiunge `fetchTrainingContext()` con `currentWeekActivities`, `last4WeeklyKm`, `weekendLongRuns`, `last12WeeklyElevation` |
| `src/components/AdminNav.astro` | Modificato | Aggiunge link "Training / Run" alla nav |

## Dipendenze

Nessuna nuova libreria. Open-Meteo usa fetch nativo.

## Env vars

Nessuna nuova. Coordinate meteo hardcodate in `src/pages/api/training.ts`:
```typescript
const LAT = 43.256; // Porto Sant'Elpidio, FM
const LON = 13.760;
```

## Ordine implementazione

1. Aggiungere `currentWeekActivities` e `last4WeeksStats` a `strava.ts`
2. Creare `training.astro` con SSR (Strava + meteo fetch)
3. Implementare logica suggerimento (JS client-side)
4. UI: header settimana, suggerimento, grafico 12 settimane, obiettivo, lista attività
5. Aggiornare `AdminNav` con nuovo link
6. Aggiornare questa spec

## Limiti e trade-off

- **Coordinate meteo fisse**: Porto Sant'Elpidio hardcodata in `api/training.ts`. Se ti alleni altrove, il meteo non è preciso
- **Nessun ML**: logica rule-based, non impara. Funziona bene per pattern stabili
- **Nessuna distinzione ripetute**: Strava non espone segmenti nell'API di lista — tutte le corse appaiono uguali. Per analisi intervalli servirebbe la Activity Detail API (1 call per attività = lento)
- **Suggerimento non modificabile**: non puoi dire "ho già pianificato una gara sabato". È informativo, non vincolante
- **Dati a build time**: il meteo e le attività vengono fetchati al momento del caricamento della pagina (SSR), non in real-time
