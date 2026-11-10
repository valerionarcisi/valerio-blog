# Bandi regionali (`/admin/bandi`)

Pagina admin per decidere **se e con chi muoversi** sui fondi regionali per il cinema, per **Walkie Talkie** (lungometraggio, sviluppo) e **Non fa ridere** (corto finito). Il fondo lo chiede una casa di produzione con sede in regione: la pagina mostra quando riapre ogni bando, perché lo prevediamo e quali case sentire. Non è una pagina di statistiche.

Sorella di `/admin/contatti` (`docs/radar-contatti-spec.md`): stesso DB del motore (`TURSO_RADAR_*`), stesse regole. Non la duplica: le case si aprono lì.

## Vincoli

- Il sito **non spedisce email** e **non scrive** in `contacts`, `credits`, `contact_regions`, `regional_calls`, `call_sessions`.
- Scritture ammesse: `radar_requests` (accodare) e `call_proposals.suitable`. Nient'altro. Lo schema lo possiede il motore (`radar/schema.py`): nessuna colonna nuova senza il tuo ok.
- Tutto il lavoro pesante (modello, crawling, bozze) resta al NAS.

## Cosa si riusa

| Da | Cosa |
| --- | --- |
| `radar-db.ts` | `getRadarDb()`, `isRadarConfigured()` (503 chiaro senza env) |
| `radar-contacts.ts` | `PROJECTS`/`Project`, il pattern `parseAction → Result` + `applyAction`, `rows()` (copiata in `radar-calls.ts`: non esportata da lì), `loadRequests` (stessa tabella), logica di dedup delle richieste aperte, `now()` |
| `result.ts` | `Result`, `jsonOk/jsonErr`, `parseJsonBody`, `andThen` |
| `admin-auth.ts` | `requireAdmin` su ogni API; le pagine controllano `Astro.locals.isAdmin` |
| `AdminNav` | nuova voce «Bandi regionali» nel gruppo **Film**, id `bandi`; card in `admin/index.astro` |
| `admin-client.js` | `apiJson`, `escapeHtml`, `parseDbDate` |
| `admin-contatti.css` | non si importa: uso `foglio.css` + `admin-foglio.css` + un `admin-bandi.css` nuovo, con gli stessi token. Le pillole progetto (`nfr`/`wt`) e la barra punteggio si copiano come regole, non come dipendenza |
| Pagina Contatti | link `/admin/contatti#casa-<id>` per ogni casa; stato pipeline letto da `contact_projects` |

**Non** si riusa: il routing a hash di `contatti.js`. Qui ogni vista ha un URL vero (richiesto), quindi pagine Astro SSR con markup lato server e un piccolo `public/admin/bandi.js` solo per azioni, copia testo e poll.

## Verifica sul DB reale (sola lettura, 9 nov 2026)

- Tabelle e colonne come da brief, più: `call_sessions.status` (`chiuso` / `in chiusura` / vuoto), `call_sessions.source`, `regional_calls.status`, `contact_regions.seen_at`, `radar_requests.payload` (esiste; non è nel test seed di `radar-contacts.test.ts`, lì c'è `url`).
- 67 bandi su 21 regioni (codici: `emilia-romagna`, `friuli-venezia-giulia`, `valle-d-aosta`, `trentino`, `alto-adige`…); 18 sono `facilities` **senza sessioni**.
- 60 sessioni, **20 senza `opens`**: la timeline usa `closes` come ancora quando manca.
- `call_proposals` ne ha **3**, tutte `media`; `annunciata`/`alta` non compaiono ancora → ogni stato vuoto va curato.
- `radar_requests.kind` oggi: `add_house`, `followup`, `opportunity`, `region`. `call_proposal` non è ancora mai stato usato: **da confermare che il motore lo consumi con payload `"<id> bozze"`**.

## Logica (`src/lib/radar-calls.ts`, pura, con test)

- `REGIONS` (codice → nome) in `src/lib/radar-regions.ts`: 21 voci; codice sconosciuto → il codice stesso.
- `parseJsonList(raw)` / `parseTargets(raw)`: mai eccezioni; JSON rotto, `null`, non-array, elementi sbagliati → lista vuota o elementi scartati; `score` non numerico → `null`; target ordinati per score.
- `actionWindow(predictedOpens, today)` → `{ from: opens-150d, to: opens-45d, state: "future" | "now" | "closing" | "passed" }`. `closing` = oggi tra 45 giorni e apertura. Per `annunciata` la finestra è la stessa.
- `openNow(sessions, today)`: sessione con `opens <= oggi <= closes` (o `opens` mancante e `closes >= oggi`), con giorni alla chiusura.
- `timelinePlacement(proposal, today)`: mese di apertura nei prossimi 12 mesi (posizione 0–1 e mese), `fuori` se oltre.
- `confidenceStyle`: `annunciata` piena con data, `alta` solida, `media` tenue, `bassa` tratteggiata.
- Raggruppamenti: `groupByMonth` (per la lista mobile), `groupContactsByBasis` (ordine `fondo_regionale`, `candidata_fondo`, `film_commission`, `sede`; i vincitori con anni e titoli da `credits.funds LIKE 'Fondo regionale <Regione>:%'`), `splitArchive` (passate, bandi chiusi, `suitable = 0`).
- Query: `loadOverview(db, today)`, `loadProposal(db, id)` (bando, sessioni, target arricchiti con stato `contact_projects` per quel progetto e flag email via `emailFlag`, richieste aperte), `loadRegion(db, code)`, `loadArchive(db)`.

## Viste

1. **`/admin/bandi`** – in alto «Aperti adesso» (titolo, regione, giorni alla chiusura). Sotto la **timeline 12 mesi**: una riga per proposta con `suitable = 1`, colorata per progetto (Walkie Talkie / Non fa ridere), barra al mese di apertura prevista, banda della finestra d'azione 150→45 giorni, linea «oggi». Filtri: progetto, regione, affidabilità, «solo nella finestra d'azione» (parametri in URL, così si condividono e il filtro sopravvive al ricarico). Sotto i 720 px diventa una **lista per mese** con la stessa informazione in testo.
2. **`/admin/bandi/proposta/<id>`** – scheda: bando e regione; apre/chiude e `basis`; mini-cronologia delle sessioni storiche (apertura → chiusura per anno); budget, contributo min/max, link ufficiale e Italy for Movies; **angolo**, **da preparare** (checklist, stato solo in locale nel browser), **attenzione**, **testo per le case** (con «Copia»), **case bersaglio** (perché, email con flag personale/info@, punteggio, stato pipeline per quel progetto, link `/admin/contatti#casa-<id>`). Azioni: Prepara bozze, Non adatta / Di nuovo adatta.
3. **`/admin/bandi/regione`** (elenco con conteggi) e **`/admin/bandi/regione/<codice>`** – case raggruppate per `basis`, vincitori in testa con anni e titoli; bandi della regione con storico sessioni; proposte aperte. Vale anche senza avvisi.
4. **`/admin/bandi/archivio`** – proposte passate, bandi chiusi, proposte non adatte (nascoste altrove).

Link «Bandi regionali» nel gruppo Film di `AdminNav` e card in `/admin`.

## API `/api/admin/bandi` (tutte `requireAdmin`, `Cache-Control: no-store`)

- `GET ?view=overview | proposal&id= | region&code= | archive | request&id=` (stato di una richiesta, per il poll).
- `POST {action}` con `parseAction → Result`:
  - `prepare_drafts {proposal_id}` → `INSERT INTO radar_requests(kind, payload) VALUES('call_proposal', '<id> bozze')`. Rifiuta se la proposta non esiste, è `suitable = 0`, non ha target con email, o c'è già una richiesta `pending/running` con lo stesso payload (risponde «già in corso»). Il limite di 5 bozze è del motore.
  - `set_suitable {proposal_id, value}` → `UPDATE call_proposals SET suitable = ?`.
- Poll: la scheda rilegge la richiesta ogni 4 s finché `pending/running`, poi mostra `done` / `failed` con `note`; anche pulsante «Aggiorna». Le bozze si approvano in Contatti (`#bozza-<id>`), come oggi.

## Test (vitest, DB `:memory:` con le tabelle del radar, dati finti)

Finestra d'azione ai bordi (150/45 giorni, già aperta, già passata), sessioni senza `opens`, bandi aperti, JSON difensivo (rotto, vuoto, tipi sbagliati), ordine e raggruppamento per `basis`, vincitori con titoli da `credits`, `prepare_drafts` (accoda, dedup, rifiuta non adatta / senza email), `set_suitable`, e che nessuna azione tocchi le tabelle protette.

## Stato e decisioni

1. **Nota personale** (non implementata, in attesa di scelta): non tocco `radar/schema.py`. Proposta: tabella `bandi_notes(proposal_id, text, updated_at)` nel DB del **blog** (Turso principale), migrazione idempotente come quelle analytics. Alternativa: colonna `call_proposals.note` aggiunta dal motore. La prima versione non ha note.
2. **Consumo di `call_proposal`**: il motore oggi non l'ha mai ricevuto; va confermato che legga `payload = "<id> bozze"`.
3. **Aperto adesso** (deciso: date): `call_sessions.status` è `chiuso` / `in chiusura` / vuoto, e 20 sessioni non hanno `opens`. Uso le date (`closes >= oggi`, `opens <= oggi` se presente), non lo `status`.
4. Proposte con `predicted_opens` oltre 12 mesi o già passate: fuori dalla timeline, in Archivio.

## Fuori scopo

Nessun invio email, nessuna modifica a contatti o bandi, nessuna statistica. Facilities (`sheet_kind = facilities`) compaiono solo nella vista regione.

## Opportunità, scadenze della settimana e salute del motore

Il motore (`~/radar` sul NAS, container `radar`) tiene le opportunità in `opportunities`: Valerio inoltra un post a HAL su Telegram, HAL accoda `opportunity`, il motore lo estrae e lo ricontrolla ogni giorno (`opportunities:watch`), con avvisi a 7 e 2 giorni. HAL è solo il bot Telegram (comandi `/casa`, `/bandi`, `/proposta <n> [bozze]`, `/regione`, forward di post); il lavoro lo fa il motore.

- **`/admin/bandi/opportunita`**: aperte per scadenza (le senza data in coda), agenda del motore (`deadlines` future senza doppioni per titolo), chiuse/scadute. Solo lettura. Logica in `src/lib/radar-opps.ts`.
- **Home admin, card «Scadenze e motore»**: opportunità e bandi aperti che chiudono entro 14 giorni (max 6) e una riga di salute. Soft failure: se il DB radar non risponde la card dice «dati non disponibili».
- **Salute**: ultimo giro in errore per lavoro, tranne se `hb_<lavoro>` è più recente dell'errore (send/inbox/requests entrano nello storico solo se falliscono, quindi l'errore resterebbe per sempre); battito fermo per `requests` (30 min), `inbox` (60), `send` (120). Mostra anche se gli invii sono spenti, accesi o in pausa.
- `call_proposal` con payload `"<id> bozze"` è consumato dal motore (`requests_queue.call_proposal` → `forecast.make_drafts`), che risponde anche su Telegram.
