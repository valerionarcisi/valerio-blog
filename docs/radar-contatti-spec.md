# Radar contatti (`/admin/contatti`)

Pannello per gestire le case di produzione e distribuzione da contattare per i film di Valerio: **Non fa ridere** (cerca distribuzione festival) e **Walkie Talkie** (cerca produzione o coproduzione europea; la distribuzione c'è già).

Non è il "Radar opportunità" (`/admin/radar`, `docs/radar-spec.md`): quello legge `src/data/radar.json`. Questo legge un database a parte.

## Come è fatto

- **Il motore è sul NAS**, non nel blog: container Python `radar` (cartella `radar/` del NAS, fuori da questo repository). Cerca le case, visita i siti, controlla le email, dà un punteggio, scrive le bozze e **spedisce**. Il blog non invia mai email.
- **Il blog legge e scrive solo sul database del motore** (Turso `cinema-contacts`), che è un database **diverso** da quello del blog (`TURSO_DATABASE_URL`).
- Accesso: cookie di sessione admin o Bearer (`requireAdmin`), come le altre API admin.

## Variabili d'ambiente

| Variabile           | Cosa                               |
| ------------------- | ---------------------------------- |
| `TURSO_RADAR_URL`   | indirizzo del DB `cinema-contacts` |
| `TURSO_RADAR_TOKEN` | token del DB `cinema-contacts`     |

Vanno aggiunte su Netlify e sono già nell'elenco di `astro.config.mjs`. Senza, l'API risponde 503 con un messaggio chiaro.

## Tabelle usate

Tabelle del motore (create da `python -m radar migrate`):

- `contact_projects(contact_id, project, score, score_detail, reason, shortlist, stage)` — punteggio e fase **per film**: una casa può servire a entrambi.
- `radar_outbox` — bozze e coda invii. Stati: `draft`, `approved`, `sent`, `error`, `discarded`, `cancelled`, `done`.
- `radar_runs`, `radar_sources`, `radar_events`, `radar_settings` — giri del motore, fonti, storico, regole.

Tabella storica `contacts` (condivisa con Hermes): anagrafica, email, prove, note.

## Pagina

Una sola pagina con routing sull'hash, logica in `public/admin/contatti.js`:

| Hash          | Vista                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| `#oggi`       | bozze da approvare, relazioni calde, ultimi giri del motore                       |
| `#pipeline`   | colonne per fase, un film alla volta, filtri per punteggio e nome                 |
| `#casa-<id>`  | scheda: punteggio spiegato, email con prova, doppioni, storico, note, cambio fase |
| `#bozza-<id>` | modifica, approva, togli dalla coda, scarta                                       |
| `#motore`     | giri, fonti, accensione degli invii, pausa, regole                                |

## API `/api/admin/contatti`

`GET ?view=today | pipeline&project=…&min=… | contact&id=… | draft&id=… | engine`

`POST` con `action`:

- `draft_update`, `draft_approve`, `draft_unapprove`, `draft_discard`
- `stage` (cambia fase di un contatto per un film), `shortlist`, `note`
- `setting` (solo chiavi in lista, con limiti: tetto giornaliero, fascia oraria, follow-up…)

Logica e validazione in `src/lib/radar-contacts.ts` (`parseAction` → `Result`, `applyAction`); test in `radar-contacts.test.ts` con DB in memoria.

## Spostare le carte

Nella Pipeline le carte si trascinano da una colonna all'altra (desktop) oppure si usa il menu «Sposta in…» sotto la carta (sempre visibile sul telefono, al passaggio del mouse o con la tastiera sul desktop). Scartare o segnare «Risposta» chiede conferma; ogni spostamento mostra «Annulla» per 12 secondi. Verso «Bozza pronta» non si sposta nulla: le bozze le crea il motore (anche il server rifiuta la fase `draft`). Sotto i 640 px le colonne diventano una lista verticale.

## Richieste al motore

Il sito non chiama mai il modello: accoda una riga in `radar_requests` e il motore sul NAS la esegue entro un minuto. La pagina rilegge i dati ogni 4 secondi finché ci sono richieste aperte, quindi il risultato compare da solo.

| `kind`      | Dove si lancia              | Cosa fa il motore                                         |
| ----------- | --------------------------- | --------------------------------------------------------- |
| `draft`     | Scheda casa, «Scrivi bozza» | scrive la prima mail (richiede il modello)                |
| `followup`  | Oggi, «Prepara follow-up»   | bozza da modello fisso, senza modello                     |
| `shorten`   | Bozza, «Riscrivi più breve» | accorcia a 80 parole (richiede il modello)                |
| `translate` | Bozza, «Traduci in inglese» | traduce e imposta la lingua `en` (richiede il modello)    |
| `add_house` | HAL, `/casa <sito>`         | legge il sito, salva casa e persone, risponde su Telegram |

Prima di riscrivere o tradurre, la pagina salva il testo che stai modificando, così non si perde. Una richiesta uguale già aperta non viene duplicata. Se il modello non risponde (per esempio credito esaurito) la richiesta passa a `failed` e la nota si vede sulla scheda o nella bozza.

**Follow-up scaduti** (sezione in «Oggi»): fase «Inviata» o «Follow-up», con email, ultimo contatto più vecchio di `followup_days`, meno di `max_followups` follow-up già fatti (il maggiore tra `contacts.status = follow-up-N` di Hermes e quelli registrati dal motore) e nessuna bozza aperta.

## Spesa del modello

I lavori automatici del motore fanno al massimo `llm_daily_calls` chiamate al giorno (default 40, regolabile in Motore › Regole; la pagina mostra quante ne sono state fatte oggi). Costo misurato: circa 0,0055 $ a chiamata. Le richieste fatte dall'admin non sono bloccate dal tetto. Il motore non scarta mai una casa da solo: segnala «Possibile fuori target» nel motivo e la fase resta com'è.

## Regole di sicurezza

- **Approva = metti in coda.** L'invio lo fa il NAS, solo se `send_enabled = 1` e `paused = 0`, nella fascia oraria e sotto il tetto giornaliero.
- `draft_approve` rifiuta il testo se contiene segnaposto tra parentesi quadre (`[link screener]`).
- Si modificano solo le bozze non ancora in coda.
- Segnare "risposta" o "scartata" annulla le bozze in sospeso di quel contatto per quel film.
- Scartare una bozza mette il contatto "in attesa": il motore non lo riscrive finché non lo rimetti "da contattare".
- Il motore non riscrive a una casa contattata negli ultimi `no_repeat_days` (60).
- Il blog non conosce mai la password di Gmail: sta solo nel `.env` del NAS.

## Limiti noti

- Una pagina sola, nessuna paginazione: la pipeline mostra al massimo 40 carte per colonna.
- Le azioni sul database sono dirette, senza annulla.
