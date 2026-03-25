# Meditation — Spec

## Obiettivo

Dashboard privata per il tracciamento della pratica di meditazione Vipassana. Serve a:

- **Registrare sessioni** di meditazione con data, durata e tipo
- **Visualizzare statistiche** (streak, sessioni totali, minuti totali, sessioni del mese)
- **Guidare la pratica** con timer, guida vocale, sessioni strutturate e un percorso progressivo a fasi
- **Motivare la costanza** tramite heatmap annuale, streak bar e citazioni giornaliere

La pagina e' ad uso esclusivo dell'admin (autenticazione via token) e non e' indicizzata dai motori di ricerca.

## Architettura

```
Browser (admin/meditation?token=XXX)
  |
  |  1. Astro SSR verifica token via query param
  |     (timeSafeEqual vs ADMIN_TOKEN)
  |
  v
+---------------------+       +--------------------+
| meditation.astro    |       | meditation-quotes  |
| (pagina SSR)        |------>| .js (365 citazioni)|
| - HTML/CSS/JS inline|       +--------------------+
+---------------------+
  |
  | 2. JS client-side: fetch() con Bearer token
  |
  v
+---------------------------+       +-----------------+
| /api/admin/meditation.ts  |       | Turso (libsql)  |
| GET  -> lista sessioni    |------>| meditation_     |
| POST -> nuova sessione    |       | sessions        |
| DELETE -> rimuovi sessione|       +-----------------+
+---------------------------+
  |
  | verifyBearerToken(req, ADMIN_TOKEN)
  v
  401 se non autorizzato
```

**Flusso dati:**
1. La pagina Astro verifica il token nel query string (SSR) e serializza le 365 citazioni in JSON
2. Il JS client chiama `GET /api/admin/meditation` per caricare le sessioni degli ultimi 365 giorni
3. I dati vengono elaborati client-side: statistiche, heatmap, streak, percorso
4. Al termine di una sessione timer, il JS chiama `POST /api/admin/meditation` per salvare automaticamente
5. Tutto il rendering (stats, heatmap, journey, quote, focus, sessione) avviene client-side

## Dati / Schema DB

### Tabella `meditation_sessions`

| Campo          | Tipo    | Vincoli / Default                        |
|----------------|---------|------------------------------------------|
| `id`           | INTEGER | PRIMARY KEY AUTOINCREMENT                |
| `date`         | TEXT    | NOT NULL, formato `YYYY-MM-DD`           |
| `duration_min` | INTEGER | DEFAULT 0                                |
| `session_type` | TEXT    | Nullable, es. "Anapana — Consapevolezza del respiro" |
| `created_at`   | TEXT    | `datetime('now')` al momento dell'INSERT |

### Indici

| Nome                    | Colonna | Scopo                                |
|-------------------------|---------|--------------------------------------|
| `idx_meditation_date`   | `date`  | Query efficiente per range di date   |

La tabella viene creata automaticamente (`CREATE TABLE IF NOT EXISTS`) ad ogni richiesta API tramite `ensureTable()`.

## API Endpoints

### GET `/api/admin/meditation`

| Aspetto        | Dettaglio                                                                 |
|----------------|---------------------------------------------------------------------------|
| Autenticazione | Bearer token nell'header `Authorization` (confrontato con `ADMIN_TOKEN`) |
| Request body   | Nessuno                                                                   |
| Query params   | Nessuno                                                                   |
| Logica         | Seleziona tutte le sessioni con `date >= date('now', '-365 days')`, ordinate per data e id ASC |
| Response 200   | `[{ id, date, duration_min, session_type, created_at }, ...]`            |
| Response 401   | `"Unauthorized"` (testo piano)                                           |

### POST `/api/admin/meditation`

| Aspetto        | Dettaglio                                                                 |
|----------------|---------------------------------------------------------------------------|
| Autenticazione | Bearer token                                                              |
| Request body   | `{ date: "YYYY-MM-DD", duration_min?: number, session_type?: string }`   |
| Validazione    | `date` obbligatorio, deve corrispondere a `/^\d{4}-\d{2}-\d{2}$/`       |
| Logica         | INSERT nella tabella con `created_at = datetime('now')`                  |
| Response 201   | `{ ok: true, id: <number> }`                                             |
| Response 400   | `{ error: "Valid date (YYYY-MM-DD) required" }`                          |
| Response 401   | `"Unauthorized"`                                                          |

### DELETE `/api/admin/meditation`

| Aspetto        | Dettaglio                                                                 |
|----------------|---------------------------------------------------------------------------|
| Autenticazione | Bearer token                                                              |
| Query params   | `id` (obbligatorio) — ID della sessione da eliminare                     |
| Logica         | DELETE dalla tabella per ID                                               |
| Response 200   | `{ ok: true }`                                                            |
| Response 400   | `{ error: "id param required" }`                                         |
| Response 401   | `"Unauthorized"`                                                          |

## Componenti UI

La pagina e' un singolo file `.astro` con CSS inline (`<style is:global>`) e JS inline (`<script is:inline>`). Non utilizza componenti Astro dedicati, ad eccezione di `AdminNav`.

### Stats (griglia 4 colonne)

Quattro box con statistiche calcolate client-side:
- **Streak** — giorni consecutivi di pratica (conta da oggi o da ieri all'indietro)
- **Sessioni** — totale sessioni (ultimi 365 giorni)
- **Min totali** — somma di tutti i `duration_min`
- **Questo mese** — numero sessioni del mese corrente

### Heatmap (ultimi 365 giorni)

Griglia in stile GitHub contributions: 7 righe (giorni della settimana) x ~52 colonne (settimane). Ogni cella rappresenta un giorno con colore in base ai minuti totali:
- Vuoto: `#1a1a1e`
- l1 (1-5 min): viola 25%
- l2 (6-15 min): viola 45%
- l3 (16-30 min): viola 70%
- l4 (31+ min): `#bb86fc` pieno

Il giorno corrente ha un bordo dorato. Cliccando su una cella si apre un pannello di dettaglio con l'elenco delle sessioni del giorno (tipo + durata) e il totale.

### Journey / Fasi (percorso adattivo)

Sistema a 8 fasi progressive su 24 mesi, ognuna con:
- **Nome e icona** (Fondamenta, Corpo, Gentilezza, Visione, Profondita', Maturita', Integrazione, Maestria)
- **Range di mesi** e durate consigliate (min/max)
- **Pesi** per tipo di sessione (es. fase 1: 75% Anapana, 15% Body Scan, 10% Camminata)
- **Testo spirituale** con insegnamenti Vipassana

La fase corrente e' calcolata in base ai mesi di pratica effettivi, corretti per la consistenza (se la frequenza e' < 30%, i mesi vengono ridotti proporzionalmente). Una barra di progresso a 24 dot mostra l'avanzamento. La sessione giornaliera suggerita deriva dai pesi della fase corrente, indicizzata deterministicamente dal giorno dell'anno.

### Timer

Timer circolare SVG con anello di progresso e display digitale `MM:SS`.

- **Preset**: 5, 10 (default), 15, 20, 30, 45 minuti
- **Controlli**: Inizia/Pausa/Riprendi, Reset, Voce ON/OFF
- **Breath label**: ciclo testuale di 4 fasi (Inspira, Trattieni, Espira, Pausa) ogni 2 secondi
- **Guida attiva**: pannello che mostra lo step corrente della sessione con titolo, descrizione e hint
- **Scheduling guidato**: gli step della sessione vengono distribuiti proporzionalmente sulla durata scelta, con transizioni annunciate da chime e voce
- **Auto-save**: al termine del timer, la sessione viene salvata automaticamente via POST API
- **Wake Lock**: richiede `navigator.wakeLock` per impedire lo spegnimento dello schermo durante la meditazione

### Sessioni (7 tipi)

Ogni tipo di sessione ha 4 step strutturati con titolo, descrizione e durata:

1. **Anapana** — consapevolezza del respiro (triangolo narici-labbro)
2. **Body Scan** — scansione delle sensazioni dalla testa ai piedi
3. **Metta** — meditazione di amorevole gentilezza (se stessi, cari, tutti)
4. **Vipassana profonda** — impermanenza, sensazioni sottili, equanimita'
5. **Camminata consapevole** — movimento lento con micro-consapevolezza
6. **Osservazione dei pensieri** — etichettare e lasciar andare
7. **Suono e silenzio** — ascolto aperto e suono interno

La sessione del giorno e' selezionata con `dayOfYear % sessions.length`, poi eventualmente sovrascritta dal sistema journey/fasi.

### Citazione e focus giornalieri

- **Citazione**: selezionata con `dayOfYear % 365` dall'array di 365 citazioni (autori: Goenka, Buddha, Thich Nhat Hanh, Rumi, Eckhart Tolle, tradizioni varie)
- **Focus**: 2 card da un array di 7 coppie, ciclate per giorno della settimana. Ogni card ha icona, titolo e breve testo motivazionale

### Audio System

Suoni sintetizzati via Web Audio API (`AudioContext`), nessun file audio esterno:

| Suono          | Frequenze      | Durata   | Uso                                  |
|----------------|----------------|----------|--------------------------------------|
| **Bell**       | 528 Hz + 396 Hz| 4 sec    | Inizio sessione (1x), fine (3x)     |
| **Chime**      | 880 Hz         | 1.5 sec  | Transizione rapida                   |
| **Low Chime**  | 440 Hz         | 1 sec    | Promemoria a meta' step             |
| **Step Chimes**| 780 Hz         | 0.6 sec  | Transizione step (ripetuti N volte) |

La campana tibetana e' simulata con due oscillatori sinusoidali sovrapposti e decay esponenziale del gain.

### Voice System

Utilizza la Web Speech Synthesis API (`SpeechSynthesis`) per la guida vocale in italiano:

- **Voce**: cerca automaticamente una voce italiana (`lang.startsWith("it")`), fallback sulla voce di default. Retry fino a 10 volte con intervallo di 500ms
- **Parametri**: `rate: 0.85`, `pitch: 0.9`, `lang: "it-IT"`
- **Keep-alive**: workaround per bug Chrome che interrompe la sintesi dopo ~15s — `pause()/resume()` ogni 10 secondi
- **Training mode**: dopo 30 giorni di pratica (`VOICE_TRAINING_DAYS`), la voce viene disattivata automaticamente (suggerimento a meditare in silenzio). L'utente puo' sovrascrivere via toggle (persistito in `localStorage`)
- **Warm-up mobile**: su iOS/Android, la speech synthesis richiede un'utterance iniziale durante un user gesture, eseguita al click su "Inizia"

## File coinvolti

| File                                       | Azione     | Scopo                                              |
|--------------------------------------------|------------|-----------------------------------------------------|
| `src/pages/admin/meditation.astro`         | Esistente  | Pagina SSR con UI completa (HTML, CSS, JS inline)  |
| `src/pages/api/admin/meditation.ts`        | Esistente  | API REST per CRUD sessioni di meditazione          |
| `src/data/meditation-quotes.js`            | Esistente  | Array di 365 citazioni (text + author)             |
| `src/components/AdminNav.astro`            | Esistente  | Navigazione admin condivisa                        |
| `src/lib/turso.ts`                         | Esistente  | Client Turso (libsql) — `getDb()`                  |
| `src/lib/auth.ts`                          | Esistente  | `verifyBearerToken()`, `timeSafeEqual()`           |

## Dipendenze

| Libreria / API         | Tipo       | Uso                                                   |
|------------------------|------------|--------------------------------------------------------|
| `@libsql/client`       | npm        | Client Turso per accesso al database SQLite edge      |
| Web Audio API           | Browser    | Generazione suoni (campana, chime) via oscillatori    |
| Web Speech Synthesis API| Browser    | Guida vocale in italiano durante la meditazione       |
| Screen Wake Lock API    | Browser    | Previene lo spegnimento schermo durante il timer      |
| `localStorage`          | Browser    | Persistenza preferenza voce ON/OFF (`meditation-voice-override`) |

Nessuna libreria JS esterna lato client. Tutto il codice e' vanilla JS inline.

## Env vars

| Variabile            | Richiesta | Uso                                                     |
|----------------------|-----------|---------------------------------------------------------|
| `ADMIN_TOKEN`        | Si'       | Autenticazione pagina (query param) e API (Bearer token)|
| `TURSO_DATABASE_URL` | Si'       | URL del database Turso                                  |
| `TURSO_AUTH_TOKEN`   | Si'       | Token di autenticazione Turso                           |

## Limiti e trade-off

- **Single-user**: il sistema e' progettato per un solo utente (l'admin). Non c'e' gestione multi-utente
- **Tutto inline**: CSS e JS sono inline nella pagina Astro. Vantaggio: zero richieste aggiuntive, deploy semplice. Svantaggio: file monolitico di ~1300 righe, non testabile unitariamente
- **Nessun service worker**: se il browser va in background, il timer continua correttamente (usa `Date.now()` per il tempo reale, non `setInterval` cumulativo), ma l'audio/voce potrebbe non funzionare
- **Audio sintetico**: i suoni sono generati via Web Audio API, non da file audio. La qualita' e' limitata ma evita il caricamento di asset esterni
- **Speech Synthesis**: dipende dalle voci installate sul dispositivo. Se non c'e' una voce italiana, usa quella di default. Il workaround keep-alive per Chrome potrebbe non funzionare su tutti i browser
- **Nessun export/backup**: i dati sono solo su Turso. Non c'e' funzionalita' di export CSV o backup
- **DELETE non esposta nella UI**: l'endpoint DELETE esiste nell'API ma non c'e' un pulsante nella UI per cancellare sessioni
- **Calcolo streak semplificato**: conta solo la presenza/assenza di sessioni per giorno, non la qualita' o la durata minima
- **365 citazioni hardcoded**: le citazioni sono in un file JS statico, non nel database. Per aggiungerne o modificarne serve un deploy
- **Nessuna notifica push**: non ci sono reminder per meditare. La motivazione e' affidata alla streak e all'abitudine

### Possibili evoluzioni

- Export dati in CSV/JSON
- Statistiche avanzate (media durata, distribuzione per tipo, grafici temporali)
- Reminder push via service worker / web notification
- Separazione JS in moduli per testabilita'
- Note personali per sessione
- Pulsante delete nella UI per correggere sessioni errate
