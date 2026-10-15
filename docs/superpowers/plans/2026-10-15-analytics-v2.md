# Analytics v2 — piano di miglioramento del tracking self-hosted

Data: 2026-10-15 · Stato: proposta · Spec di riferimento: `docs/analytics-spec.md`

## Perché

Il sistema attuale (tracker inline in `BaseHead.astro` → `POST /api/e` → tabella `pageviews` su Turso → `/api/stats`) funziona, ma ha problemi che rendono i numeri meno affidabili di quanto sembri e che peggioreranno con la crescita dei dati.

### Problemi verificati nel codice

| # | Problema | Dove | Effetto |
|---|---|---|---|
| 1 | Hash visitatore = SHA-256(data:host:IP:UA) **senza salt segreto** | `src/lib/analytics.ts` `generateVisitorHash` | Con data e UA noti, lo spazio IPv4 (2³²) è enumerabile: l'hash è pseudonimizzazione debole, non anonimizzazione. La promessa "no banner GDPR" è fragile. |
| 2 | Il tracker usa `localStorage` (`notrack`, `_ae`) | `BaseHead.astro` | Contraddice la spec ("no localStorage"); va dichiarato o tolto. |
| 3 | Paese derivato solo dal **timezone** del browser | `countryFromTimezone` | Mappa di ~80 timezone: tutto il resto è `NULL`, VPN/viaggiatori sbagliati. Netlify fornisce già la geo lato edge senza salvare l'IP. |
| 4 | Referrer interni non filtrati | `e.ts` → `extractHostname` | La navigazione interna finisce tra i "referrer" (il proprio dominio inquina la classifica). Nessuna classificazione canale (search / social / AI / direct). |
| 5 | Beacon aggiorna per `page_id` casuale a 8 caratteri, senza legarlo al visitatore | `e.ts` ramo `beacon` | Chiunque può riscrivere tempo/scroll di una riga indovinando o riusando un id; possibili collisioni. |
| 6 | Tempo sulla pagina inviato **una sola volta** al primo `hidden` | `BaseHead.astro` flag `sent` | Se il lettore cambia tab e torna, il resto della lettura è perso → engagement sottostimato su mobile. |
| 7 | "Bounce rate" = visita unica con tempo < 5s | `stats.ts` | Non esiste il concetto di sessione: niente pagine/visita, entry/exit page, percorsi. |
| 8 | Unicità calcolata con SELECT poi INSERT, senza indice su `visitor_hash` | `e.ts`, schema in `scripts/init-analytics-db.ts` | Race condition (doppi "unici") e scansione righe a ogni pageview. |
| 9 | Ogni apertura della dashboard esegue ~18 query su righe grezze con `NOT IN (SELECT hash FROM bot_hashes)` + polling ogni 30s | `stats.ts`, `stats/live.ts`, `analytics.astro` | Turso fattura le **righe lette**: il costo cresce linearmente coi dati, la dashboard rallenta. Nessuna tabella aggregata, nessuna retention. |
| 10 | Bot detection solo su User-Agent (`isbot`) + flag manuale per `visitor_hash`, che modifica i dati grezzi | `analytics.ts`, `/api/admin/bot` | I bot headless con UA reale passano; il flag vale un giorno solo (l'hash ruota), colpisce lettori veri con beacon perso ed è servito un sistema di annullamento in 4 PR. Dettagli in Fase 4. |
| 11 | Input non validato: `hostname`, `pathname`, UTM liberi; l'Origin mancante passa | `e.ts` | Chiunque con `curl` può iniettare pageview e valori arbitrari nella dashboard. |
| 12 | Nessun evento personalizzato | — | Non si misurano clap, commenti inviati, click in uscita, download, 404, form contatti: solo pageview. |
| 13 | Nessuna misura di performance reale | — | Nessun dato Core Web Vitals (LCP/INP/CLS) dagli utenti veri. |

## Obiettivi misurabili

1. **Privacy forte e dichiarabile**: nessun IP né hash invertibile salvato; salt giornaliero segreto distrutto a fine giornata; nessun storage nel browser per i visitatori normali.
2. **Numeri affidabili**: paese corretto per ≥95% delle visite; referrer interni esclusi; sessioni reali; bot automatici scartati senza intervento manuale nella maggior parte dei casi.
3. **Costo e velocità costanti**: dashboard < 1s e righe lette per apertura indipendenti dal volume storico (aggregati giornalieri), retention dei dati grezzi a 90 giorni.
4. **Più segnale**: eventi (clap, commento, uscita, download, 404, contatto), canali di acquisizione, Web Vitals.

## Fasi

Ogni fase è rilasciabile da sola, con test Vitest (pattern del repo: `vi.mock("~/lib/turso")` con `createClient({ url: ":memory:" })`).

### Fase 1 — Correttezza e privacy (S, priorità massima)

1. **Salt giornaliero segreto** (`src/lib/analytics-salt.ts`)
   - Tabella `analytics_salts(day TEXT PRIMARY KEY, salt TEXT NOT NULL)`; `getDailySalt(db, day)` crea 32 byte casuali con `INSERT OR IGNORE` e li rilegge.
   - `generateVisitorHash(salt, host, ip, ua)`; i salt più vecchi di 2 giorni vengono cancellati (nel job della Fase 3, o opportunisticamente con probabilità 1%).
   - Cambia l'hash: nessuna migrazione dei dati storici, i giorni passati restano con il vecchio schema.
   - Rimuovere `generateStableVisitorHash` se non più usato (verificare i chiamanti, es. likes/claps).
2. **Geo da Netlify** invece del timezone
   - Leggere `context.geo` / header `x-nf-geo` (country code) nell'endpoint; fallback a `countryFromTimezone`. Nessun IP salvato.
   - Aggiungere colonna `region` opzionale (solo codice regione, niente città) se utile.
3. **Referrer pulito e canale**
   - Scartare referrer con hostname uguale al sito (lista `ALLOWED_HOSTS`).
   - Nuova colonna `channel` calcolata server-side da referrer + UTM: `direct | search | social | ai | email | referral | campaign`. Mappa in `src/lib/channels.ts` (google/bing/duckduckgo/ecosia → search; facebook/instagram/t.co/x.com/linkedin/threads/bsky → social; chatgpt.com/perplexity.ai/claude.ai/gemini.google.com/copilot → ai; mail/gmail/outlook → email).
4. **Validazione input** in `/api/e`
   - `hostname` deve essere in `ALLOWED_HOSTS` (altrimenti 204 e scarto); `pathname` deve iniziare con `/`, max 300, solo caratteri URL validi; UTM normalizzati in minuscolo, max 100; richiedere `Origin` o `Referer` del sito (non solo "se presente").
   - Rate limit per visitatore con l'helper esistente `src/lib/rate-limit.ts` (es. 60 eventi/minuto per hash), fail-open.
5. **Beacon legato al pageview**
   - `page_id` diventa 16+ caratteri casuali (`crypto.getRandomValues`), e l'UPDATE richiede anche `visitor_hash` = hash calcolato dalla richiesta corrente: un beacon può aggiornare solo le proprie righe.
   - Il beacon diventa **cumulativo**: si invia a ogni `hidden` con il tempo visibile accumulato (si somma solo mentre `visibilityState === "visible"`) e lo scroll massimo; il server fa `time_on_page = MAX(time_on_page, ?)`, `scroll_depth = MAX(scroll_depth, ?)`. Risolve il problema 6.
6. **Unicità atomica + indice**
   - Indice `idx_pv_visitor_day ON pageviews(visitor_hash, created_at)`.
   - Tabella `daily_visitors(day, visitor_hash, PRIMARY KEY(day, visitor_hash))`: `INSERT OR IGNORE` → `rowsAffected === 1` ⇒ unico. Niente più SELECT+INSERT.
7. **localStorage**: togliere `_ae` (retry dei pageview falliti, valore marginale) e spostare l'opt-out `notrack` su un cookie di prima parte solo per l'admin, oppure lasciarlo e documentarlo nella privacy policy. Decisione da prendere (vedi "Domande aperte").

**Accettazione:** test per salt, canali, validazione, beacon cumulativo con hash diverso rifiutato, unicità concorrente; la spec e `CLAUDE.md` ("Analytics System") aggiornate.

### Fase 2 — Sessioni ed eventi (M)

1. **Sessioni senza cookie**
   - Una sessione = stesso `visitor_hash` con pause < 30 minuti. Tabella `sessions(id, day, visitor_hash, started_at, last_seen_at, entry_path, exit_path, pageviews, engaged_seconds, channel, referrer, country, device_type)`.
   - In `/api/e`: cerca l'ultima sessione dell'hash con `last_seen_at > now-30min` (indice su `(visitor_hash, last_seen_at)`), altrimenti ne crea una; aggiorna `pageviews`, `exit_path`, `last_seen_at`. `pageviews.session_id` collega le righe.
   - Metriche vere: **bounce** = sessione con 1 pageview e < 10s di engagement; pagine/sessione; durata media; entry ed exit pages.
2. **Eventi personalizzati**
   - Tabella `events(id, created_at, session_id, visitor_hash, name, path, prop_key, prop_value)`; nomi ammessi in whitelist server-side.
   - API client minima nel tracker: `window.va?.track(name, props)`.
   - Eventi iniziali: `clap`, `comment_submit`, `comment_like`, `contact_submit`, `outbound_click` (host di destinazione), `download` (estensione), `404` (path richiesto + referrer), `scroll_75`/`scroll_100` sui post, `copy_code`, `share`.
   - Intercettazione click in uscita/download con un solo listener delegato su `document`.
3. **Obiettivi (goals)**: un goal = evento o pagina (`/contatti` → `contact_submit`). Tasso di conversione per canale e per post.

**Accettazione:** test per la logica di sessione (nuova dopo 30 min, stessa entro 30 min, attraversamento mezzanotte), whitelist eventi, tracker che non rompe la pagina se l'endpoint fallisce.

### Fase 3 — Aggregati, retention e costo (M)

> **Stato: [x] implementata (2026-10-15).** Dettagli in `docs/analytics-spec.md` ("Aggregati giornalieri e retention"). Codice: `src/lib/analytics-rollup.ts`, `analytics-rollup-schema.ts`, `analytics-sql.ts`, `stats-hybrid.ts`, `netlify/functions/analytics-rollup.mts`, `POST /api/admin/analytics-rollup`, `scripts/analytics-backfill.ts`.
>
> Decisioni: raw 90 giorni (solo giorni con `rollup_log`), aggregati per sempre; scope `human`/`all` (`all` = tutto tranne i bot, quindi `include=all` ora esclude anche `bot_score` alto); cron 00:20 UTC. Fatti i punti 1-4 per le tabelle esistenti.
>
> **Rimasto da fare:**
> - [ ] `sessions`, `events`, `daily_events` e le colonne `sessions/bounces/engaged_seconds`, `entry/exit` (dipendono dalla Fase 2); aggancio di pulizia sessioni a 180 giorni gia pronto in `pruneRaw`.
> - [ ] Live counter da `sessions.last_seen_at` (punto 5, Fase 2).
> - [ ] `quality`, `review`, `summary_legacy` e `recent_visitors` restano da raw (nessun rollup per verdetto/bot).
> - [ ] Breakdown filtrati per `pathname` oltre i 90 giorni non disponibili (solo raw).
> - [ ] Hash flaggati dal legacy `/api/admin/bot`: invalidazione best effort; le regole non sono retroattive.

1. **Rollup giornaliero** con una Netlify Scheduled Function (`netlify/functions/analytics-rollup.mts`, cron `15 0 * * *` Europe/Rome → in UTC) che per il giorno precedente scrive:
   - `daily_stats(day, pageviews, visitors, sessions, bounces, engaged_seconds)`
   - `daily_pages(day, path, pageviews, visitors, avg_time, avg_scroll)`
   - `daily_dims(day, dim, value, visitors, pageviews)` con `dim ∈ {referrer, channel, country, browser, os, device, lang, utm_source, utm_campaign, entry, exit}`
   - `daily_events(day, name, prop_value, count, visitors)`
   - Idempotente: `DELETE … WHERE day = ?` + `INSERT` nello stesso `db.batch(…, "write")`.
2. **`/api/stats` ibrido**: per i giorni chiusi legge i rollup, per oggi legge le righe grezze (piccole). Stessa forma JSON di oggi, così la dashboard non cambia.
3. **Bot già esclusi nel rollup** (join con `bot_hashes` al momento del calcolo); quando l'admin flagga un bot di un giorno passato, l'endpoint `/api/admin/bot` ricalcola il rollup di quel giorno.
4. **Retention**: righe grezze `pageviews`/`events` più vecchie di 90 giorni cancellate dallo stesso job; sessioni a 180 giorni; aggregati per sempre.
5. **Live counter**: usa `sessions.last_seen_at > now-5min` (indice) invece di `COUNT(DISTINCT)` sui pageview; polling 30s → 60s e pausa con tab nascosta (già fatto lato dashboard).

**Accettazione:** test di equivalenza: stesse risposte di `/api/stats` da rollup e da righe grezze su un dataset sintetico; job idempotente se rilanciato.

### Fase 4 — Bot: nuovo modello e nuovo modo di flaggare (M)

> **Stato: [x] implementata (2026-10-15), in periodo di coesistenza.** Dettagli e scelte in `docs/analytics-spec.md` ("Bot detection"). Codice: `src/lib/bot-score.ts`, `bot-rules.ts`, `bot-verdict.ts`, `/api/admin/bot-rules` (+ `/preview`), evento `engage` in `/api/e` e nel tracker, `/api/stats` (`quality`, `summary_legacy`, `review`, `?include=all`), dashboard.
>
> Decisioni: i "non verificati" sono **esclusi** dai numeri principali e mostrati a parte con la percentuale; `country_device` non implementato (kind: `ua_contains | referrer_host | path_prefix | hash_today`); le regole valgono dalle nuove visite (il verdetto in lettura usa `bot_score`, non rivaluta le regole sulle righe passate; l'UA non e salvato).
>
> **Da fare dopo ~2 settimane di coesistenza (data di deploy + 14 giorni):**
> - [ ] Tarare soglia/pesi guardando `quality` e `summary_legacy` affiancati.
> - [ ] Convertire `bot_hashes` in `bot_score = 99` sulle righe storiche e ripristinare `is_unique` da `daily_visitors` (punto 3 della migrazione sotto).
> - [ ] Rimuovere `/api/admin/bot`, `bot-rollback.test.ts`, "Flag come bot", "Flag zero-engagement", "Annulla flag", "Annulla TUTTI", 🤖, URL `?recover=all`, "Sospetti"/`suspicious`, `summary_legacy`, la clausola `bot_hashes` in `bot-verdict.ts`, poi `DROP TABLE bot_hashes`.
> - [ ] Valutare `ua_family` (browser major + os) per raggruppare meglio "Da rivedere" se i gruppi attuali sono troppo larghi.

#### Come funziona oggi

- **Filtro automatico** solo su User-Agent (`isbot`) e `navigator.webdriver`: i bot dichiarati non arrivano nemmeno al DB.
- **Flag manuale per `visitor_hash`** da `/admin/analytics`: singolo (🤖 sulla riga), in blocco ("Flag zero-engagement" = tempo ≤ 5s e scroll 0) o sull'intervallo ("Flag come bot" sui sospetti). Il flag **modifica i dati grezzi** (`is_unique = 0` su tutte le righe dell'hash) e aggiunge l'hash a `bot_hashes`; tutte le query escludono `visitor_hash IN bot_hashes`.
- Per annullare: per riga, "Annulla flag fatti oggi", "Annulla TUTTI" e la URL di emergenza `GET /api/admin/bot?recover=all`.

#### Perché flaggare per hash non regge

1. **L'hash cambia ogni giorno** (contiene la data, e con la Fase 1 anche il salt giornaliero). Flaggare un hash pulisce solo quel giorno: domani lo stesso bot ha un hash nuovo. È un lavoro manuale quotidiano che non previene nulla.
2. **L'euristica "zero engagement" colpisce persone vere.** Il beacon su iOS/Safari e con tab chiuse di colpo si perde spesso: `time_on_page` resta `NULL` e un lettore reale diventa "sospetto". La cronologia lo conferma: dopo il flag in blocco sono servite quattro PR solo per poter tornare indietro (#15 unflag, #17 "Annulla TUTTI", #19 URL di recupero, #20 restore in due passi).
3. **Un hash non è una persona**: IP+UA uguali dietro la stessa rete (CGNAT mobile, uffici, Wi-Fi pubblici) ⇒ un flag può togliere più lettori veri.
4. **Il flag è distruttivo e costoso**: riscrive `is_unique` sulle righe, obbliga a ricalcoli per annullare, e la subquery `NOT IN (SELECT hash FROM bot_hashes)` gira su ogni query della dashboard.

**Conclusione:** il flag per hash ha senso solo come "nascondi questo visitatore di oggi", non come strumento di bot detection. Va sostituito da una **classificazione** (non una modifica dei dati) e da **regole** che valgono anche nei giorni successivi.

#### Nuovo modello: tre categorie, nessuna riga riscritta

Ogni pageview ha un verdetto ricalcolabile, non un flag distruttivo:

| Categoria | Quando | Conta nei numeri principali |
|---|---|---|
| **Umano** | ha mandato almeno un segnale umano (sotto) | Sì |
| **Non verificato** | nessun segnale umano, ma nessun indizio di bot | No, mostrato a parte con la sua percentuale |
| **Bot** | UA bot, regola manuale, oppure `bot_score` sopra soglia | No |

1. **Segnale umano positivo** (la parte più importante). Il tracker manda un evento `engage` una sola volta per pagina alla prima interazione reale: scroll, `pointerdown`, tasto, oppure 3 secondi con la pagina visibile. Il server imposta `pageviews.human = 1` sulla riga (stesso controllo `page_id` + `visitor_hash` della Fase 1). È economico, non dipende dal beacon finale che si perde, e i crawler headless di solito non lo producono.
2. **Punteggio negativo server-side** salvato in `pageviews.bot_score` al momento dell'inserimento:
   - +3 manca `Accept-Language`; +3 mancano gli header `Sec-Fetch-*` su un browser che dovrebbe inviarli;
   - +2 viewport 0 o dimensioni impossibili; +2 lingua del browser e timezone incoerenti in modo marcato;
   - +3 più di 20 pageview/minuto dallo stesso hash (dal rate limiter della Fase 1);
   - +5 percorsi da scanner (`/wp-login.php`, `/.env`, `/xmlrpc.php`, `*.php`), che vanno comunque scartati.
   - Soglia iniziale 5, configurabile; i pesi sono un punto di partenza da tarare sui dati veri.
3. **Il verdetto si calcola al momento della lettura** (o nel rollup della Fase 3): `bot` se `bot_score ≥ soglia` o una regola corrisponde, `umano` se `human = 1`, altrimenti `non verificato`. Cambiare soglia o regole ricalcola tutto, senza toccare le righe.

#### Nuovo modo di flaggare: regole invece di hash

- Tabella `bot_rules(id, kind, value, note, created_at, hits)` con `kind ∈ {ua_contains, referrer_host, path_prefix, country_device, hash_today}`.
- Dalla riga di un visitatore sospetto in dashboard, il pulsante 🤖 apre un menu con le azioni proposte già compilate da quella riga:
  - "Blocca questo user-agent" (`ua_contains`, con la stringa da confermare/accorciare);
  - "Blocca questo referrer" (referrer spam);
  - "Blocca questo percorso" (scanner);
  - "Nascondi solo questo visitatore oggi" (`hash_today`, scade da sola a fine giornata: è il vecchio flag, ridimensionato).
- Ogni regola mostra quante visite ha colpito (`hits`) e un'**anteprima prima di salvarla** ("questa regola escluderebbe 42 visite negli ultimi 7 giorni, di cui 3 con segnale umano"). Se una regola colpisce visite con segnale umano, la dashboard lo segnala: è il modo per accorgersi dei falsi positivi prima che diventino un problema.
- Le regole si disattivano con un click; nessun ricalcolo delle righe, perché il verdetto è calcolato.
- L'ingest applica le regole `ua_contains`/`path_prefix` subito (la riga viene comunque salvata con `bot_score` alto per poterla rivedere, oppure scartata del tutto per gli scanner).

#### Dashboard

- Card riassuntiva: Umani / Non verificati / Bot, con la quota di "non verificati" per giorno. Se la quota sale all'improvviso, c'è un nuovo bot da guardare.
- Lista "Da rivedere": i visitatori non verificati raggruppati per UA, referrer e percorso (non per hash), così si vede subito il pattern e si crea una regola con un click.
- Rimuovere "Flag zero-engagement", "Flag come bot" sull'intervallo, "Annulla TUTTI" e la URL `GET ?recover=all` una volta migrati i dati (sotto).

#### Migrazione dal sistema attuale

1. Aggiungere `human`, `bot_score` e `bot_rules`; il tracker inizia a mandare `engage`.
2. Per due settimane i due sistemi convivono: la dashboard mostra i numeri vecchi e i nuovi affiancati, per tarare soglia e pesi.
3. Convertire `bot_hashes` esistenti in regole `hash_today` storiche (solo per i giorni passati) e ripristinare `is_unique` col calcolo della Fase 1 (`daily_visitors`), così nessun dato resta riscritto dal vecchio flag.
4. Togliere `bot_hashes` dalle query e i vecchi pulsanti.

**Accettazione:** test per il calcolo del verdetto (umano/non verificato/bot, regole, soglia), per l'anteprima di una regola e per l'evento `engage` rifiutato con hash diverso; nessuna query della dashboard deve più modificare `pageviews`.

### Fase 5 — Web Vitals e dashboard (S/M)

1. **Core Web Vitals RUM**: nel tracker, `PerformanceObserver` per LCP, CLS, INP (implementazione minima, ~1 KB, senza librerie) inviati nel beacon finale; colonne `lcp_ms`, `cls`, `inp_ms`. Dashboard: p75 per pagina e per device, con soglie Google (verde/giallo/rosso).
2. **Nuove viste in `/admin/analytics`**: canali; entry/exit; pagine per sessione; goal e conversioni; eventi; Web Vitals; filtro per paese/device/canale applicabile a tutte le card; export CSV.
3. **Card in home admin** (`/admin`): visitatori oggi vs ieri, top post di oggi, eventuali picchi di traffico.
4. **Report settimanale** opzionale via Telegram (il bot esiste già): visitatori, top 3 post, canali, delta vs settimana prima.

## Ordine consigliato e stima

| Fase | Valore | Rischio | Stima |
|---|---|---|---|
| 1 Correttezza e privacy | Alto | Basso | 1 giornata |
| 3 Aggregati e retention | Alto (costo e velocità) | Medio | 1–1,5 giornate |
| 2 Sessioni ed eventi | Alto | Medio | 1,5 giornate |
| 4 Bot: modello e regole | Alto | Medio | 1 giornata |
| 5 Web Vitals e dashboard | Medio | Basso | 1 giornata |

Ordine consigliato: **1 → 4 → 3 → 2 → 5**. La Fase 4 va prima degli aggregati perché decide cosa conta come visita: farla dopo vorrebbe dire rifare i rollup.

## Migrazioni

- Nuovo script `scripts/migrate-analytics-v2.ts` (stesso stile di `scripts/init-analytics-db.ts`): `ALTER TABLE pageviews ADD COLUMN channel / session_id / bot_score / is_human / lcp_ms / cls / inp_ms`, nuove tabelle e indici, tutto `IF NOT EXISTS` / idempotente.
- Nessun backfill obbligatorio: i dati storici restano leggibili; i rollup dei giorni passati si possono generare una volta lanciando il job con un intervallo di date.
- Rimuovere i fallback "pre-migration" in `e.ts` (doppio INSERT) una volta applicata la migrazione.

## Fuori scopo

- Fingerprinting, cookie di tracciamento, IP geolocation propria, session replay, heatmap dei click.
- Strumenti esterni (Plausible/Umami): il piano resta sullo stack attuale, a costo zero.

## Domande aperte

1. **Opt-out `notrack`**: tenerlo in `localStorage` (e dichiararlo in privacy policy) o spostarlo su un cookie solo per l'admin?
2. **Retention**: 90 giorni per i dati grezzi vanno bene, o vuoi tenerli di più per analisi storiche per singola visita?
3. **Report Telegram settimanale**: lo vuoi?
4. **Web Vitals**: vale la pena il ~1 KB in più nel tracker?
5. **Visite "non verificate"**: escluderle dai numeri principali (più prudente) o contarle e mostrare gli umani verificati come metrica di qualità?

## Documentazione da aggiornare a ogni fase

`docs/analytics-spec.md`, la sezione "Analytics System" di `CLAUDE.md`, la privacy policy (`src/pages/privacy-policy/`) se cambia cosa viene raccolto, `README.md` se cambiano le rotte.
