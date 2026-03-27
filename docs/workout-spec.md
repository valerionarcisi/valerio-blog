# Workout Casa — Spec

## Obiettivo

Pagina admin `/admin/workout` che funge da **personal trainer digitale** per gli allenamenti casalinghi con TRX e kettlebell. Guida l'utente attraverso ogni sessione con voce (Web Speech Synthesis), timer automatici e log storico.

## Workout disponibili

| ID | Nome | Scheda originale | Focus |
|---|---|---|---|
| workout-a | Workout A | No data | Full body — forza + cardio |
| workout-b | Workout B | 12/12/2024 | Gambe + core |
| workout-c | Workout C | 02/07/2024 | Petto + total body |
| workout-d | Workout D | 18/04/2024 | Full body — stabilità |

Ogni workout ha 3 blocchi: AMRAP#1, EMOM 20:00, AMRAP#2.

## Struttura dati (`src/data/workouts.js`)

```javascript
{
  id: 'workout-a',
  name: 'Workout A',
  subtitle: 'Kbl · TRX · Bastone',
  date: null,                    // data scheda originale (ISO o null)
  equipment: ['Kettlebell', 'TRX', 'Bastone'],
  focus: 'Full body — forza + cardio',
  estimatedMin: 55,
  blocks: [
    {
      type: 'amrap',
      label: 'AMRAP #1',
      rounds: 3,                 // sub-round: 3 × 8 minuti con 2 min rest
      secPerRound: 480,
      restSec: 120,
      exercises: [
        { name: 'Rematore dx kettlebell', reps: 12, cue: '...' },
        ...
      ]
    },
    {
      type: 'emom',
      label: 'EMOM 20:00',
      totalSec: 1200,            // 20 minuti
      exercises: [
        { name: 'Rope jump', cue: '...', isRest: false },
        { name: 'Rest', cue: 'Recupero', isRest: true },
      ]
    },
    { type: 'amrap', ... }       // AMRAP#2: 2 × 12 min
  ]
}
```

Warm-up condiviso: 10 esercizi × 30 secondi = 5 minuti dinamici (definito in `WARMUP_EXERCISES`).

## Flusso sessione

```
select → warmup (10×30s) → interblock → block[0] → interblock → block[1] → interblock → block[2] → feedback → done
```

### Fasi interne AMRAP
```
amrap_active (secPerRound) → rest (restSec) → amrap_active → ... → goNextBlock
```

### Fasi interne EMOM
```
emomMinute=0 (60s) → emomMinute=1 → ... → emomMinute=totalSec/60-1 → goNextBlock
```

## Voce (Web Speech Synthesis — it-IT)

| Momento | Messaggio |
|---|---|
| Warmup inizio | "Partiamo con il riscaldamento. Dieci esercizi da trenta secondi." |
| Ogni esercizio warmup | "[nome]. [cue]" |
| Warmup fine | "Riscaldamento completato. [workout.name]. Inizia tra tre, due, uno." |
| AMRAP inizio | "[label]. Hai N minuti per fare più round possibili. Esercizi: [lista]. Via!" |
| AMRAP metà tempo | "Metà tempo. Continua!" |
| AMRAP 30s | "Trenta secondi. Finisci il round!" |
| AMRAP fine | "Stop! Riposati per due minuti." |
| EMOM inizio | "[label]. N minuti. Ogni minuto cambi esercizio." |
| Ogni minuto EMOM | "Minuto N: [esercizio]. Via!" |
| EMOM fine | "EMOM completato. Ottimo lavoro!" |
| Fine sessione | "Allenamento completato! Grande lavoro!" |

## Contatore round AMRAP

Pulsante "✓ Round completato" visibile durante la fase `amrap_active`. Ogni tap incrementa il contatore per `{ blockIdx, subRound }` corrente. Salvato in `amrap_rounds` (JSON) nel DB.

## Suggerimento rotazione

Algoritmo: workout con `last_done` più vecchia (o mai fatto) viene suggerito con badge "✦ Suggerito oggi".

## Database — Turso

```sql
CREATE TABLE IF NOT EXISTS workout_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id   TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_sec INTEGER,
  rpe          INTEGER,    -- 1-10 (Rate of Perceived Exertion)
  note         TEXT,       -- max 500 chars
  amrap_rounds TEXT        -- JSON: {"0-1": 4, "2-1": 3}  → blockIdx-subRound → rounds
);
```

## API Endpoints

### `GET /api/admin/workout-sessions`

Protetto da Bearer token. Ritorna:
```json
{
  "sessions": [...],
  "stats": {
    "lastDoneByWorkout": { "workout-a": "2026-03-25T...", ... },
    "totalByWorkout": { "workout-a": 5, ... },
    "weekCount": 2
  }
}
```

### `POST /api/admin/workout-sessions`

```json
{
  "workout_id": "workout-a",
  "duration_sec": 3240,
  "rpe": 7,
  "note": "ho fatto 4 round sull AMRAP, gambe pesanti",
  "amrap_rounds": { "0-1": 4, "0-2": 3, "2-1": 2 }
}
```

## Integrazione Training Readiness

`GET /api/training` ora include `homeWorkoutsThisWeek: number` — conteggio sessioni nella settimana corrente. La logica readiness in `training.astro` può usare questo valore per aggiustare il punteggio (es. -10 se homeWorkoutsThisWeek >= 2).

## File

| File | Ruolo |
|---|---|
| `src/data/workouts.js` | Definizione workout + warm-up |
| `src/pages/admin/workout.astro` | Pagina SSR completa |
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
