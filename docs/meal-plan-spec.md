# Meal Plan — Spec

## Obiettivo

Dashboard admin privata che mostra il piano alimentare settimanale completo (colazione, pranzo, cena e spuntini) con navigazione a tab per giorno della settimana. Pensata per consultazione rapida da mobile durante la spesa o in cucina.

## Architettura

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  GET /admin/meal-plan?token=ADMIN_TOKEN          │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│         Astro SSR (Netlify Function)             │
│                                                  │
│  1. Verifica token via timeSafeEqual()           │
│  2. Importa days[] e snacks[] da meal-plan.ts    │
│  3. Renderizza HTML statico con tutti i giorni   │
│  4. Inietta <script is:inline> per tab switching │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              src/data/meal-plan.ts                │
│                                                  │
│  Dati hardcoded: DayPlan[] + SnackSection[]      │
│  Nessuna API esterna, nessun DB                  │
└─────────────────────────────────────────────────┘
```

## Dati / Schema

### `DayPlan`

```typescript
interface MealOption {
  items: string[];   // alimenti con grammature
  oil?: string;      // indicazione olio EVO (es. "3 cucchiaini olio EVO a crudo")
}

interface Meal {
  name: string;      // "Colazione" | "Pranzo" | "Cena" | "Cena (libera)" | "Spuntino"
  options: MealOption[];  // options[0] = principale, options[1..n] = alternative
}

interface DayPlan {
  id: string;        // "lun" | "mar" | "mer" | "gio" | "ven" | "sab" | "dom"
  label: string;     // "Lunedi", "Martedi", ...
  short: string;     // "Lun", "Mar", ...
  meals: Meal[];     // tipicamente 3 pasti (colazione, pranzo, cena), domenica ne ha 4
}
```

### `SnackSection`

```typescript
interface SnackSection {
  name: string;        // "Pre-Allenamento" | "Mattino Post-Allenamento" | "Mattino (no allenamento)" | "Pomeriggio"
  options: string[][]; // ogni opzione e un array di stringhe (alimenti combinabili con "+")
}
```

### Struttura dati

- **7 giorni** (lun-dom), ognuno con 3-4 pasti
- Ogni pasto ha 1-3 opzioni (la prima e quella principale)
- **4 sezioni spuntini** separate dai giorni, con 3-11 opzioni ciascuna
- La domenica ha una struttura speciale: colazione libera, pranzo con 3 opzioni, spuntino dedicato, cena libera (pizza o ristorante)

## Componenti UI

| Componente | Descrizione |
|---|---|
| **Tab bar** | Barra orizzontale scrollabile con 8 bottoni (Lun-Dom + Spuntini). Seleziona automaticamente il giorno corrente al caricamento |
| **Meal card** | Card scura con header (emoji + nome pasto), badge olio (verde/rosso), lista alimenti |
| **Alternative** | Blocco `<details>` espandibile ("1 alternativa" / "N alternative") con opzioni aggiuntive |
| **Oil badge** | Badge colorato: verde se presente olio, rosso se contiene "no" (classe `.no-oil`) |
| **Snack section** | Card con opzioni numerate, unite con " + " per alimenti combinabili |
| **AdminNav** | Navigazione admin condivisa (componente esterno) |

### Interazione client-side

- Script inline (non framework) che mappa `new Date().getDay()` -> id giorno (`dayMap[]`)
- Tab switching via `selectTab(id)`: toggle classi `.active` su tab e panel
- Attributi ARIA: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`

## File coinvolti

| File | Ruolo |
|---|---|
| `src/pages/admin/meal-plan.astro` | Pagina SSR, layout, stili, logica tab |
| `src/data/meal-plan.ts` | Dati del piano alimentare (export `days`, `snacks`) |
| `src/components/AdminNav.astro` | Navigazione admin condivisa |
| `src/lib/auth.ts` | Funzione `timeSafeEqual()` per verifica token |

## Dipendenze

- **Astro 5** — framework SSR
- **Nessuna dipendenza esterna** per i dati (tutto hardcoded in TypeScript)
- **Nessuna libreria JS client-side** (vanilla JS inline)
- **Nessun database**

## Env vars

| Variabile | Uso |
|---|---|
| `ADMIN_TOKEN` | Token segreto per autenticazione. Passato come query parameter `?token=` |

## Limiti e trade-off

- **Dati hardcoded**: il piano alimentare e scritto direttamente in `meal-plan.ts`. Per aggiornare i pasti bisogna modificare il file e rifare il deploy. Non esiste un'interfaccia di editing.
- **Nessun database**: scelta deliberata per semplicita — il piano cambia raramente e non richiede CRUD.
- **Autenticazione via query parameter**: il token e visibile nell'URL e nei log del server. Sufficiente per uso personale, non adatto a contesti multi-utente.
- **Nessun supporto i18n**: la pagina e solo in italiano (il piano alimentare e personale).
- **`prerender = false`**: la pagina e renderizzata server-side ad ogni richiesta (Netlify Function) per verificare il token. Non e cacheable.
- **Emoji hardcoded**: la mappa `mealEmoji` associa emoji ai nomi dei pasti. Se il nome del pasto cambia nel data file, l'emoji non viene mostrata (fallback su generico).
- **Mobile-first**: layout ottimizzato per consultazione su telefono (tab scrollabili, font ridotti sotto 500px).
