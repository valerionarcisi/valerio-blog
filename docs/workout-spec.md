# Workout Casa — Spec

## Obiettivo

Pagina admin `/admin/workout` che funge da **personal trainer digitale** per gli allenamenti casalinghi con TRX e kettlebell. Guida l'utente attraverso ogni sessione con voce (Web Speech Synthesis), timer automatici e log storico.

## Workout disponibili

Ogni workout è un **singolo blocco** (AMRAP o EMOM), non un macro-workout multi-blocco.

| ID | Nome | Tipo | Focus |
|---|---|---|---|
| w01 | AMRAP A1 | AMRAP 3×8min | Full body — forza |
| w02 | EMOM A2 | EMOM 20min | Cardio + core |
| w03 | AMRAP A3 | AMRAP 2×12min | Cardio + forza |
| w04 | AMRAP B1 | AMRAP 3×8min | Gambe + core |
| w05 | EMOM B2 | EMOM 20min | Schiena + core |
| w06 | AMRAP B3 | AMRAP 2×12min | Braccia + core |
| w07 | AMRAP C1 | AMRAP 2×12min | Petto + total body |
| w08 | EMOM C2 | EMOM 20min | Gambe + spalle |
| w09 | AMRAP C3 | AMRAP 2×12min | Braccia + core |
| w10 | AMRAP D1 | AMRAP 2×12min | Full body — stabilita |
| w11 | EMOM D2 | EMOM 20min | Gambe + schiena |
| w12 | AMRAP D3 | AMRAP 2×12min | Braccia + core |

## Struttura dati (`src/data/workouts.js`)

Ogni workout ha un singolo blocco (type, exercises) direttamente nell'oggetto — nessun array `blocks`.

```javascript
{
  id: 'w01',
  name: 'AMRAP A1',
  subtitle: 'Rematore · Overhead · Core',
  equipment: ['Kettlebell', 'Bastone'],
  focus: 'Full body — forza',
  type: 'amrap',              // 'amrap' | 'emom'
  rounds: 3,                  // solo AMRAP: quanti round
  secPerRound: 480,            // solo AMRAP: secondi per round
  restSec: 120,                // solo AMRAP: secondi di rest tra round
  exercises: [
    { name: 'Rematore dx kettlebell', reps: 12, cue: '...' },
    ...
  ]
}

// EMOM
{
  id: 'w02',
  name: 'EMOM A2',
  type: 'emom',
  totalSec: 1200,              // solo EMOM: durata totale
  exercises: [
    { name: 'Rope jump', cue: '...', isRest: false },
    { name: 'Rest', cue: 'Recupero', isRest: true },
  ]
}
```

Warm-up condiviso: 10 esercizi × 30 secondi = 5 minuti dinamici (definito in `WARMUP_EXERCISES`).

## Flusso UI

```
griglia 12 card → click card → preview (tabella esercizi + dettagli) → click "Inizia Workout" → warmup → sessione → feedback → done
```

### Preview screen

Mostra prima di partire:
- Nome workout, focus, equipment, tipo (AMRAP/EMOM), durata stimata
- Tabella esercizi con colonne: Esercizio, Reps, Cue
- Bottone "▶ Inizia Workout" per partire
- Bottone "← Indietro" per tornare alla griglia

### Flusso sessione

```
warmup (10×30s) → interblock (4s countdown) → main block → feedback → done
```

### Fasi interne AMRAP
```
amrap_active (secPerRound) → rest (restSec) → amrap_active → ... → endSession
```

### Fasi interne EMOM
```
emomMinute=0 (60s) → emomMinute=1 → ... → emomMinute=totalSec/60-1 → endSession
```

## Voce (Web Speech Synthesis — it-IT)

| Momento | Messaggio |
|---|---|
| Warmup inizio | "Partiamo con il riscaldamento. Dieci esercizi da trenta secondi." |
| Ogni esercizio warmup | "[nome]. [cue]" |
| Warmup fine | "Riscaldamento completato. [workout.name]. Inizia tra tre, due, uno." |
| AMRAP inizio | "[name]. Hai N minuti per fare più round possibili. Esercizi: [lista]. Via!" |
| AMRAP metà tempo | "Metà tempo. Continua!" |
| AMRAP 30s | "Trenta secondi. Finisci il round!" |
| AMRAP fine | "Stop! Workout completato. Ottimo!" |
| EMOM inizio | "[name]. N minuti. Ogni minuto cambi esercizio." |
| Ogni minuto EMOM | "Minuto N: [esercizio]. Via!" |
| EMOM fine | "EMOM completato. Ottimo lavoro!" |
| Fine sessione | "Allenamento completato! Grande lavoro!" |

## Contatore round AMRAP

Pulsante "✓ Round completato" visibile durante la fase `amrap_active`. Ogni tap incrementa il contatore per il `subRound` corrente. Salvato in `amrap_rounds` (JSON) nel DB.

## Suggerimento rotazione

Algoritmo: workout con `last_done` più vecchia (o mai fatto) viene suggerito con badge "✦ Suggerito".

## Database — Turso

```sql
CREATE TABLE IF NOT EXISTS workout_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id   TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_sec INTEGER,
  rpe          INTEGER,    -- 1-10 (Rate of Perceived Exertion)
  note         TEXT,       -- max 500 chars
  amrap_rounds TEXT        -- JSON: {"1": 4, "2": 3}  → subRound → rounds
);
```

## API Endpoints

### `GET /api/admin/workout-sessions`

Protetto da Bearer token. Ritorna:
```json
{
  "sessions": [...],
  "stats": {
    "lastDoneByWorkout": { "w01": "2026-03-25T...", ... },
    "totalByWorkout": { "w01": 5, ... },
    "weekCount": 2
  }
}
```

### `POST /api/admin/workout-sessions`

```json
{
  "workout_id": "w01",
  "duration_sec": 1620,
  "rpe": 7,
  "note": "ho fatto 4 round, gambe pesanti",
  "amrap_rounds": { "1": 4, "2": 3 }
}
```

## Integrazione Training Readiness

`GET /api/training` ora include `homeWorkoutsThisWeek: number` — conteggio sessioni nella settimana corrente.

## File

| File | Ruolo |
|---|---|
| `src/data/workouts.js` | Definizione 12 workout + warm-up |
| `src/pages/admin/workout.astro` | Pagina SSR completa (preview + sessione + feedback) |
| `src/pages/api/admin/workout-sessions.ts` | CRUD sessioni |
| `src/components/AdminNav.astro` | Aggiunto "workout" page type e "Casa" link |
| `src/pages/api/training.ts` | Aggiunto `homeWorkoutsThisWeek` nella response |

## TODO futuro (non implementato) — Progressione

- Tracciare il peso kettlebell usato per ogni esercizio
- Confrontare round AMRAP sessione corrente vs precedente (es. "la volta scorsa 4 round, oggi 5 — migliorato!")
- Suggerire di aumentare il peso se per 3 sessioni consecutive hai completato tutti i round nel tempo
- Grafico trend RPE nel tempo per workout_id

## Limiti

- **Nessun ML**: la logica è rule-based. Suggerisce solo sulla base di "quando l'hai fatto l'ultima volta"
- **Voce richiede it-IT**: se l'utente non ha una voce italiana installata, la sintesi usa la voce di sistema (potenzialmente in inglese)
- **Wake lock**: API best-effort, può non funzionare su tutti i browser
