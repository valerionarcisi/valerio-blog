# Body Composition — Spec

## Obiettivo

Dashboard admin privata per monitorare l'andamento della composizione corporea nel tempo tramite misurazioni BIA (Bioimpedenza). Visualizza grafici storici, metriche di riepilogo, piano nutrizionale target e consigli giornalieri motivazionali.

## Architettura

```
┌──────────────────────────────────────────────────────┐
│                      Browser                          │
│  GET /admin/body-comp?token=ADMIN_TOKEN               │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│            Astro SSR (Netlify Function)                │
│                                                        │
│  1. Verifica token via timeSafeEqual()                 │
│  2. Importa measurements.json come modulo              │
│  3. Estrae measurements[], nutrition_plan, sources[]   │
│  4. Passa dati al client via define:vars               │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│           Client-side (script is:inline)               │
│                                                        │
│  Chart.js 4.4.7 (CDN)                                 │
│  - 5 grafici linea (composizione, BF%, PhA, BMI, BMR) │
│  - 2 grafici donut (composizione attuale, macros)      │
│  - 1 grafico barre (kcal settimanali)                  │
│  - 6 stat card con delta vs misurazione precedente     │
│  - Tabella storica completa                            │
│  - 3 tip giornalieri (ruotano per day-of-year)         │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│          data/body-comp/measurements.json              │
│                                                        │
│  File JSON statico con:                                │
│  - subject (anagrafica)                                │
│  - sources[] (medici/software)                         │
│  - measurements[] (serie storica BIA)                  │
│  - nutrition_plan (macros + kcal settimanali)          │
└──────────────────────────────────────────────────────┘
```

## Dati / Schema

### `measurements.json` — struttura root

```json
{
  "subject": { "name": "...", "dob": "YYYY-MM-DD", "sex": "M" },
  "sources": [ ... ],
  "measurements": [ ... ],
  "nutrition_plan": { ... }
}
```

### `sources[]`

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | string | Identificativo ("mancini", "cardinali") |
| `doctor` | string | Nome del professionista |
| `role` | string | Qualifica (es. "Biologo Nutrizionista") |
| `software` | string | Software BIA utilizzato |
| `height_cm` | number | Altezza registrata (varia per fonte: 168 vs 167) |
| `notes` | string | Note sulla normalizzazione dei valori |

### `measurements[]`

| Campo | Tipo | Presente in | Descrizione |
|---|---|---|---|
| `date` | string | tutti | Data misurazione (YYYY-MM-DD) |
| `source` | string | tutti | Riferimento a sources[].id |
| `weight_kg` | number | tutti | Peso corporeo totale |
| `bmi` | number | tutti | Body Mass Index |
| `pha_deg` | number | tutti | Angolo di fase (gradi) |
| `bmr_kcal` | number | tutti | Metabolismo basale |
| `bcm_kg` | number | tutti | Body Cell Mass |
| `ffm_kg` | number | tutti | Fat-Free Mass |
| `fm_kg` | number | tutti | Fat Mass |
| `fm_pct` | number | tutti | Fat Mass percentuale |
| `tbw_l` | number | tutti | Total Body Water (litri) |
| `rz_ohm` | number | tutti | Resistenza (impedenza) |
| `xc_ohm` | number | tutti | Reattanza |
| `bcm_pct_ffm` | number | solo cardinali | BCM come % di FFM |
| `ffm_pct` | number | solo cardinali | FFM come % del peso |
| `tbw_pct` | number | solo cardinali | TBW come % del peso |
| `ecw_l` | number | solo cardinali | Extra-Cellular Water (litri) |
| `ecw_pct_tbw` | number | solo cardinali | ECW come % di TBW |
| `nak` | number | solo cardinali | Rapporto Na/K |

Serie storica: 12 misurazioni dal 2023-09-28 al 2026-03-17. Le prime 8 da "mancini", le ultime 5 da "cardinali".

### `nutrition_plan`

```json
{
  "date": "2026-03-17",
  "source": "cardinali",
  "macros_target": { "protein_pct": 29.56, "fat_pct": 22.62, "carb_pct": 47.53 },
  "macros_average": { "protein_pct": 28.71, "fat_pct": 22.69, "carb_pct": 46.35 },
  "daily_kcal": [1800, 1720, 1790, 1760, 1720, 2100, 1800],
  "daily_labels": ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
}
```

## Componenti UI

| Componente | Descrizione |
|---|---|
| **Daily Tips** | 3 card motivazionali (Benessere, Costanza, Meditazione) che ruotano in base al giorno dell'anno (`dayOfYear % array.length`). ~31 messaggi per categoria. Focus su anti-alcol e disciplina. |
| **Source Legend** | Legenda con dot colorati per distinguere le due fonti dati (Mancini = teal, Cardinali = oro) |
| **Summary Grid** | 6 stat card (Peso, FM%, FFM, BMI, PhA, BMR) con valore attuale, delta vs precedente (verde/rosso con inversione semantica per peso e FM%), tooltip informativo |
| **Composizione Corporea** | Grafico linea full-width con 3 serie: Peso, FFM, FM. Punti colorati per fonte |
| **Body Fat %** | Grafico linea con zone colorate di sfondo (verde <15%, giallo 15-20%, rosso >20%) |
| **Angolo di Fase** | Grafico linea con banda verde tratteggiata (range sano 5-7 gradi) |
| **BMI** | Grafico linea con 4 zone colorate (sottopeso, normopeso, sovrappeso, obeso) |
| **Metabolismo Basale** | Grafico linea con area fill verde |
| **Donut Composizione** | Donut chart FM vs FFM dell'ultima misurazione, peso totale al centro |
| **Donut Macros** | Donut chart proteine/lipidi/glucidi del piano nutrizionale target, kcal medie giornaliere al centro |
| **Kcal Settimanali** | Grafico a barre per giorno della settimana, con linea media tratteggiata. Barre sopra la media in giallo, sotto in teal |
| **Storico Misurazioni** | Tabella completa con tutte le misurazioni (ordine cronologico inverso), badge colorato per fonte |
| **AdminNav** | Navigazione admin condivisa |

### Logica delta

La funzione `delta(curr, prev, unit, invert)` calcola la differenza tra ultima e penultima misurazione. Il parametro `invert` inverte la semantica del colore: per peso e FM% un aumento e negativo (rosso), per FFM, PhA e BMR un aumento e positivo (verde).

## File coinvolti

| File | Ruolo |
|---|---|
| `src/pages/admin/body-comp.astro` | Pagina SSR, layout, stili, logica grafici |
| `data/body-comp/measurements.json` | Dati BIA storici + piano nutrizionale |
| `src/components/AdminNav.astro` | Navigazione admin condivisa |
| `src/lib/auth.ts` | Funzione `timeSafeEqual()` per verifica token |

## Dipendenze

| Dipendenza | Versione | Caricamento | Uso |
|---|---|---|---|
| **Chart.js** | 4.4.7 | CDN (`cdn.jsdelivr.net`) | Tutti i grafici (linea, donut, barre) |
| **Astro 5** | — | Framework | SSR + `define:vars` per passare dati al client |

Nessun database. Nessuna API esterna a runtime.

## Env vars

| Variabile | Uso |
|---|---|
| `ADMIN_TOKEN` | Token segreto per autenticazione. Passato come query parameter `?token=` |

## Limiti e trade-off

- **Dati in file JSON statico**: le misurazioni vanno aggiunte manualmente a `measurements.json` e richiedono un redeploy. Non esiste un form di inserimento. Scelta voluta: le misurazioni BIA avvengono ogni 2-3 mesi.
- **Due fonti con campi diversi**: il passaggio da Dott.ssa Mancini a Dott. Cardinali ha introdotto campi aggiuntivi (`ecw_l`, `nak`, `bcm_pct_ffm`, ecc.) presenti solo nelle misurazioni recenti. I grafici usano solo i campi comuni.
- **Altezza discordante**: 168 cm (Mancini) vs 167 cm (Cardinali). Il BMI e calcolato da ciascuna fonte con la propria altezza, quindi non e perfettamente comparabile.
- **Chart.js da CDN**: dipendenza esterna a runtime. Se il CDN non e raggiungibile, i grafici non vengono renderizzati (nessun fallback).
- **Script inline monolitico**: tutta la logica client (8 grafici, tabella, tips) e in un unico blocco `<script is:inline>`. Non e modulare ne testabile.
- **Consigli giornalieri statici**: i tip ruotano deterministicamente per day-of-year. Non c'e personalizzazione ne tracciamento.
- **Autenticazione via query parameter**: il token e visibile nell'URL. Sufficiente per uso personale.
- **`prerender = false`**: pagina renderizzata server-side ad ogni richiesta (Netlify Function).
- **Nessun supporto i18n**: pagina solo in italiano.
- **File JSON fuori da `src/`**: `measurements.json` risiede in `data/` (root del progetto), non in `src/`. Importato con path relativo `../../../data/body-comp/measurements.json`.
