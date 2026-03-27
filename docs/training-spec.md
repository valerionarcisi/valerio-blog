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
if readiness < 40:
  → recovery: ritmo +30sec rispetto paceAvg

elif daysSinceHilly > 14 AND weekElevation < 50 AND readiness >= 60:
  → hilly: target km, ritmo +20–30sec (dislivello)

elif weeksConsecutiveEasy >= 3:
  → long_tempo: target km, ultimi 20% a soglia (5:05–5:15/km)
    (segnala progressione verso obiettivo 4:40)

else:
  → long_easy: target km, ritmo 5:30–5:45/km
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

### GET `/api/strava` (esistente)
Già restituisce `weeklyRunStats`, `yearlyBreakdown`, `typeDistribution`.
Aggiungere alla risposta:
- `currentWeekActivities` — attività da lunedì corrente a oggi
- `last4WeeksStats` — media km/settimana ultime 4 settimane

### GET `/api/weather` (nuovo — SSR only, chiamato server-side)
Non esposto come endpoint pubblico — chiamato direttamente nell'SSR di `training.astro`.

| Campo | Dettaglio |
|---|---|
| URL | `https://api.open-meteo.com/v1/forecast` |
| Params | `latitude`, `longitude`, `daily=precipitation_probability_max,temperature_2m_max,weathercode&forecast_days=7&timezone=Europe/Rome` |
| Auth | Nessuna (gratuito) |
| Fallback | Se fetch fallisce, nasconde sezione meteo senza bloccare la pagina |

Coordinate default: **Milano** (45.464, 9.190) — hardcodate, modificabili in CLAUDE.md.

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
│  ULTIME ATTIVITÀ                            │
│  [lista compatta cliccabile → Strava]       │
└─────────────────────────────────────────────┘
```

## File da creare/modificare

| File | Azione | Scopo |
|---|---|---|
| `src/pages/admin/training.astro` | Crea | Pagina SSR con UI completa |
| `src/services/strava.ts` | Modifica | Aggiunge `currentWeekActivities`, `last4WeeksStats` |
| `src/components/AdminNav.astro` | Modifica | Aggiunge link "Training" alla nav |

## Dipendenze

Nessuna nuova libreria. Open-Meteo usa fetch nativo.

## Env vars

Nessuna nuova. Coordinate meteo hardcodate in `training.astro` (Milano).

## Ordine implementazione

1. Aggiungere `currentWeekActivities` e `last4WeeksStats` a `strava.ts`
2. Creare `training.astro` con SSR (Strava + meteo fetch)
3. Implementare logica suggerimento (JS client-side)
4. UI: header settimana, suggerimento, grafico 12 settimane, obiettivo, lista attività
5. Aggiornare `AdminNav` con nuovo link
6. Aggiornare questa spec

## Limiti e trade-off

- **Coordinate meteo fisse**: Milano hardcodata. Se ti alleni altrove, il meteo non è preciso
- **Nessun ML**: logica rule-based, non impara. Funziona bene per pattern stabili
- **Nessuna distinzione ripetute**: Strava non espone segmenti nell'API di lista — tutte le corse appaiono uguali. Per analisi intervalli servirebbe la Activity Detail API (1 call per attività = lento)
- **Suggerimento non modificabile**: non puoi dire "ho già pianificato una gara sabato". È informativo, non vincolante
- **Dati a build time**: il meteo e le attività vengono fetchati al momento del caricamento della pagina (SSR), non in real-time
