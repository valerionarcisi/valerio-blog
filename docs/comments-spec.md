# Comments System — Spec

## Obiettivo

Fornire un sistema di commenti self-hosted per i post del blog, senza dipendere da servizi SaaS esterni (Disqus, Giscus, ecc.). I visitatori possono lasciare commenti sulle pagine del blog; ogni commento passa attraverso una moderazione manuale prima di diventare visibile. L'admin riceve una notifica via email alla ricezione di un nuovo commento e puo approvare o eliminare i commenti da un'interfaccia dedicata.

## Architettura

```
                           VISITATORE
                               |
                     [Comments.astro component]
                        |              |
                   GET /api/comments   POST /api/comments
                   (carica approvati)  (invia nuovo)
                        |              |
                        v              v
                   +---------+    +---------+    +------------+
                   | Turso   |    | Turso   |--->| Resend API |
                   | (READ)  |    | (WRITE) |    | (email)    |
                   +---------+    +---------+    +------------+
                        ^              ^
                        |              |
                   GET /api/admin/     PATCH /api/admin/
                   comments            comments
                        |              |
                     [admin/comments.astro]
                               |
                            ADMIN
                   (autenticato via token)
```

Flusso dati:

1. Il visitatore apre una pagina blog -> il componente `Comments.astro` carica i commenti approvati via `GET /api/comments?pageId=...`
2. Il visitatore compila il form -> `POST /api/comments` inserisce il commento nel DB con `approved = 0` (default) e invia una notifica email via Resend
3. L'admin accede a `/admin/comments?token=ADMIN_TOKEN` -> la pagina carica i commenti pendenti via `GET /api/admin/comments?status=pending`
4. L'admin approva o elimina -> `PATCH /api/admin/comments` con `{ id, action }` aggiorna o cancella il record
5. Dopo l'approvazione il commento diventa visibile ai visitatori

## Dati / Schema DB

Database: **Turso** (SQLite edge, via `@libsql/client`).

Tabella `comments`:

| Campo               | Tipo    | Note                                                                    |
| ------------------- | ------- | ----------------------------------------------------------------------- |
| `id`                | INTEGER | Primary key, autoincrement                                              |
| `page_id`           | TEXT    | Identificativo della pagina (es. slug del post)                         |
| `name`              | TEXT    | Nome dell'autore (max 100 caratteri)                                    |
| `email`             | TEXT    | Email dell'autore (max 254 caratteri)                                   |
| `text`              | TEXT    | Contenuto del commento (max 5000 caratteri)                             |
| `approved`          | INTEGER | 0 = pendente (default), 1 = approvato                                   |
| `parent_id`         | INTEGER | NULL per commenti top-level, FK self → `comments(id)` ON DELETE CASCADE |
| `likes_count`       | INTEGER | Conteggio denormalizzato dei like (default 0)                           |
| `notified_approved` | INTEGER | 0 = email approvazione non ancora inviata, 1 = inviata (default 0)      |
| `lang`              | TEXT    | `'it'` o `'en'`, usato per costruire il link nelle email (default `'it'`) |
| `created_at`        | TEXT    | Timestamp di creazione (default SQLite)                                 |

Tabella `comment_likes`:

| Campo          | Tipo    | Note                                                      |
| -------------- | ------- | --------------------------------------------------------- |
| `id`           | INTEGER | Primary key, autoincrement                                |
| `comment_id`   | INTEGER | FK → `comments(id)` ON DELETE CASCADE                     |
| `visitor_hash` | TEXT    | Hash stabile (no data) di host+IP+UA per identita'        |
| `created_at`   | TEXT    | Timestamp                                                 |

Constraint `UNIQUE(comment_id, visitor_hash)` impedisce voti multipli dallo stesso visitatore.

Query di lettura pubblica filtrano per `approved = 1` e ordinano per `created_at ASC`. La GET pubblica esegue un LEFT JOIN su `comment_likes` filtrato dal `visitor_hash` corrente per popolare il flag `liked_by_me`.
Query admin filtrano per `approved = 0` (pendenti) o `approved = 1` (approvati) e ordinano per `created_at DESC`. La GET admin include `parent_id`, `parent_name`, `likes_count` e `children_count` per gestire indicatori di reply e cascade warning.

## Risposte annidate (replies)

I commenti possono avere risposte multi-livello tramite la colonna `parent_id`. La risposta a una risposta crea un nuovo record con il `parent_id` puntato al commento padre. La GET pubblica restituisce comunque una **flat list ordinata cronologicamente**: il client costruisce l'albero in O(n) usando una mappa `id → nodo`. Il rendering CSS limita l'indentazione visiva a 4 livelli (`data-depth="4"`) per non rompere il layout su mobile.

Solo i commenti **gia' approvati** possono ricevere reply. Un POST a un parent pendente o di un'altra pagina viene rifiutato con 400. Eliminare un commento parent elimina in cascata tutto il sottoalbero (`ON DELETE CASCADE`). La pagina admin avvisa l'utente con un `confirm()` quando il commento ha figli.

## Like

Ogni commento approvato puo' ricevere like da visitatori anonimi. L'identita' del votante e' un hash SHA-256 a 16 caratteri esadecimali calcolato da `hostname + ip + user-agent` (vedi `generateStableVisitorHash` in `src/lib/analytics.ts`, variante senza data di `generateVisitorHash` per evitare che lo stesso utente possa ri-likare ogni giorno). Il bottone like e' un toggle: il primo click inserisce in `comment_likes`, il secondo cancella. Il `likes_count` viene ricalcolato dopo ogni operazione con `SELECT COUNT(*)` per garantire consistenza.

## Auto-login Author

Quando Valerio visita `/admin/comments?token=...`, il token viene salvato in `localStorage` (chiave `vbAdminToken`). Da quel momento il componente `Comments.astro` lo riconosce su qualsiasi blog post: nasconde i campi name/email del form, mostra "Stai rispondendo come Valerio · Author", e invia il commento con header `Authorization: Bearer <token>`.

Lato server (`POST /api/comments`), se il bearer token corrisponde a `ADMIN_TOKEN` (verificato con `verifyBearerToken`), il flusso:
1. Forza `name = "Valerio"`, `email = "valerio.narcisi@gmail.com"` (costanti in `src/lib/author.ts`) — i campi del body vengono ignorati: spoofing impossibile
2. Inserisce con `approved = 1`, `is_author = 1`, `notified_approved = 1`
3. **Salta** `notifyNewComment` (e' Valerio stesso)
4. Se e' una reply a un parent diverso da Valerio, invia `notifyReplyToYourComment` al parent author

`is_author` viene esposto sia nella GET pubblica che in quella admin, ed e' usato dal client per renderizzare un badge giallo "Author" accanto al nome.

Multi-device: `localStorage` persiste su Safari iOS, Chrome Android, ecc. Una visita unica a `/admin/comments?token=...` per ogni device e' sufficiente — niente magic link extra.

## Notifiche email

Quattro funzioni in `src/lib/email.ts`, tutte fire-and-forget e con graceful skip se manca `RESEND_API_KEY`:

1. **`notifyNewComment`** — destinatario admin. Inviata da `POST /api/comments`. Il subject include "Reply" se e' una risposta e mostra il nome del parent.
2. **`notifyCommentApproved`** — destinatario autore. Inviata da `PATCH /api/admin/comments` su `action: "approve"` solo se `notified_approved = 0` (idempotente). Lingua dal campo `lang` del commento.
3. **`notifyReplyToYourComment`** — destinatario autore del parent. Inviata insieme a `notifyCommentApproved` quando il commento approvato ha un `parent_id`. Skip se l'email del reply autore coincide con quella del parent (auto-notifica).
4. **`notifyCommentRejected`** — destinatario autore. Inviata da `PATCH` su `action: "delete"`. Testo gentile, niente dettagli sulla ragione.

Tutti i link nei body usano `https://valerionarcisi.me/{lang}/blog/{pageId}/`.

## API Endpoints

### `GET /api/comments`

| Proprieta       | Valore                                          |
| --------------- | ----------------------------------------------- |
| **Metodo**      | GET                                             |
| **Path**        | `/api/comments`                                 |
| **Autenticazione** | Nessuna (endpoint pubblico)                  |
| **Query params** | `pageId` (obbligatorio)                        |
| **Response 200** | `[{ id, name, text, created_at }, ...]`        |
| **Response 400** | `{ error: "pageId required" }`                 |

Logica: seleziona dalla tabella `comments` i record con `page_id` corrispondente e `approved = 1`, ordinati per `created_at ASC`. L'email non viene esposta nella risposta pubblica.

---

### `POST /api/comments`

| Proprieta       | Valore                                          |
| --------------- | ----------------------------------------------- |
| **Metodo**      | POST                                            |
| **Path**        | `/api/comments`                                 |
| **Autenticazione** | Nessuna (endpoint pubblico)                  |
| **Content-Type** | `application/json`                              |
| **Request body** | `{ pageId, name, email, text, lang, parentId?, website }` |
| **Response 201** | `{ ok: true }` (commento inserito)             |
| **Response 200** | `{ ok: true }` (honeypot attivato, silenzioso) |
| **Response 400** | `{ error: "..." }` (validazione fallita o parent invalido) |

Logica:

1. **Honeypot**: se `website` valorizzato, scarta silenzioso (200).
2. **Validazione campi**: `pageId`, `name`, `email`, `text` obbligatori e non vuoti dopo trim.
3. **Validazione lunghezza**: `name` <= 100, `email` <= 254, `text` <= 5000.
4. **Validazione email**: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
5. **Validazione parentId** (se presente): intero positivo, deve esistere, deve essere `approved = 1`, deve appartenere allo stesso `pageId`. Altrimenti 400.
6. **Lang**: accetta `'it'` o `'en'`, default `'it'`.
7. **Inserimento**: `INSERT INTO comments (page_id, name, email, text, parent_id, lang)` — `approved` default 0.
8. **Notifica email admin**: chiama `notifyNewComment()` (fire-and-forget). Se la submission e' una reply, il subject e il body indicano il parent.

### `POST /api/comments/like`

| Proprieta       | Valore                                          |
| --------------- | ----------------------------------------------- |
| **Metodo**      | POST                                            |
| **Path**        | `/api/comments/like`                            |
| **Autenticazione** | Nessuna (endpoint pubblico)                  |
| **Request body** | `{ commentId: number }`                         |
| **Response 200** | `{ liked: boolean, count: number }`             |
| **Response 400** | commentId invalido o commento pending           |
| **Response 404** | commento inesistente                            |

Logica: calcola il `visitor_hash` stabile, verifica che il commento esista e sia approvato, poi toggla il like (insert se manca, delete se presente). Aggiorna `likes_count` con `SELECT COUNT(*)` per consistenza e ritorna lo stato post-toggle. Idempotente per design.

---

### `GET /api/admin/comments`

| Proprieta       | Valore                                          |
| --------------- | ----------------------------------------------- |
| **Metodo**      | GET                                             |
| **Path**        | `/api/admin/comments`                           |
| **Autenticazione** | Bearer token (`Authorization: Bearer <ADMIN_TOKEN>`) |
| **Query params** | `status` (opzionale, default `"pending"`, valori: `"pending"` / `"approved"`) |
| **Response 200** | `[{ id, page_id, name, email, text, approved, created_at }, ...]` |
| **Response 401** | `"Unauthorized"`                               |

Logica: converte `status` in valore numerico (`approved` = 1, altrimenti 0), seleziona i record corrispondenti ordinati per `created_at DESC`. L'email e inclusa nella risposta admin. L'autenticazione usa `verifyBearerToken()` che effettua un confronto time-safe del token.

---

### `PATCH /api/admin/comments`

| Proprieta       | Valore                                          |
| --------------- | ----------------------------------------------- |
| **Metodo**      | PATCH                                           |
| **Path**        | `/api/admin/comments`                           |
| **Autenticazione** | Bearer token (`Authorization: Bearer <ADMIN_TOKEN>`) |
| **Content-Type** | `application/json`                              |
| **Request body** | `{ id: number, action: "approve" | "delete" }` |
| **Response 200** | `{ ok: true }`                                 |
| **Response 400** | `{ error: "Invalid action" }`                  |
| **Response 401** | `"Unauthorized"`                               |

Logica:

- `action: "approve"` -> `UPDATE comments SET approved = 1, notified_approved = 1`. Se `notified_approved` era 0, invia `notifyCommentApproved` all'autore. Se il commento ha `parent_id` e l'email del parent e' diversa da quella del reply, invia anche `notifyReplyToYourComment` al parent author.
- `action: "delete"` -> `DELETE FROM comments WHERE id = ?` (cascade su figli) + `notifyCommentRejected` all'autore.

## Componenti UI

### `Comments.astro` (componente pubblico)

Riceve due props:
- `pageId: string` — identificativo della pagina
- `lang: "it" | "en"` — lingua per le label

**Layout**:
- Sezione con titolo "Commenti" / "Comments"
- Lista commenti (`Comments-list`) con `aria-live="polite"` per accessibilita
- Form di invio con campi: Nome, Email, campo honeypot nascosto (Website), Commento, bottone Invia
- Messaggio di stato post-invio (successo/errore)

**Comportamento**:
- Al caricamento: fetch `GET /api/comments?pageId=...` e rendering della lista. Se vuota, mostra messaggio "Nessun commento ancora".
- Al submit: fetch `POST /api/comments` con dati JSON. In caso di successo, mostra messaggio di conferma e resetta il form. In caso di errore, mostra messaggio di errore.
- Le date vengono formattate con `toLocaleDateString()` nella locale corretta (`it-IT` o `en-US`).
- L'output HTML viene sanitizzato con `escapeHtml()` (creazione di text node nel DOM).

**CSS** (`Comments.css`, co-located):
- Mobile-first, usa variabili CSS globali del tema
- Il campo honeypot (`Comments-hp`) e posizionato fuori schermo con `position: absolute; left: -9999px`

**i18n**: label duplicate nel frontmatter (per SSR) e nello script inline (per client-side), in entrambe le lingue (IT/EN).

---

### `admin/comments.astro` (pagina admin)

**Autenticazione**: confronto time-safe del query param `token` con `ADMIN_TOKEN`. Se non valido, ritorna 401.

**Layout**:
- Header con navigazione admin (`AdminNav` component)
- Titolo "Comments"
- Tab "Pending" / "Approved" per filtrare i commenti
- Conteggio commenti
- Tabella con colonne: Page, Name, Email, Comment, Date, Actions
- Messaggio "No comments found" se la lista e vuota

**Comportamento**:
- Al caricamento: fetch dei commenti pendenti via `GET /api/admin/comments?status=pending`
- Click su tab: ricarica i commenti con lo status corrispondente
- Bottone "Approve" (solo su commenti pendenti): chiama `PATCH /api/admin/comments` con `action: "approve"`, poi ricarica
- Bottone "Delete": chiama `PATCH /api/admin/comments` con `action: "delete"`, poi ricarica
- Il token viene passato dallo script Astro al client via `define:vars`
- Meta tag `robots: noindex, nofollow` e `referrer: no-referrer` per proteggere la pagina

**Stile**: inline nella pagina, tema scuro (`background: #0a0a0c`), colori coerenti col brand (`#c9a84c` gold, `#4ecdc4` cyan, `#e74c3c` rosso).

## File coinvolti

| File | Scopo |
| ---- | ----- |
| `src/pages/api/comments.ts` | Endpoint pubblico GET/POST per lettura e invio commenti |
| `src/pages/api/admin/comments.ts` | Endpoint admin GET/PATCH per moderazione commenti |
| `src/pages/admin/comments.astro` | Pagina admin per la moderazione dei commenti |
| `src/components/Comments.astro` | Componente front-end per visualizzare e inviare commenti |
| `src/components/Comments.css` | Stili del componente commenti |
| `src/lib/turso.ts` | Client singleton per Turso (libsql), usato da tutti gli endpoint |
| `src/lib/auth.ts` | Utility `timeSafeEqual()` e `verifyBearerToken()` per autenticazione admin |
| `src/lib/email.ts` | Funzioni `notifyNewComment`, `notifyCommentApproved`, `notifyCommentRejected`, `notifyReplyToYourComment` |
| `src/pages/api/comments/like.ts` | Endpoint pubblico POST per il toggle del like |
| `scripts/migrate-comments-replies-likes.ts` | Migration idempotente che aggiunge colonne e tabella `comment_likes` |
| `src/components/AdminNav.astro` | Navigazione condivisa nelle pagine admin |

## Dipendenze

| Libreria | Uso |
| -------- | --- |
| `@libsql/client` | Client per Turso (SQLite edge DB) |
| `astro` (framework) | Routing, SSR, componenti, `APIRoute` type |
| Resend API (HTTP) | Invio email di notifica (nessun SDK, chiamata `fetch` diretta) |

## Env vars

| Variabile | Descrizione |
| --------- | ----------- |
| `TURSO_DATABASE_URL` | URL del database Turso |
| `TURSO_AUTH_TOKEN` | Token di autenticazione per Turso |
| `ADMIN_TOKEN` | Token segreto per accedere alle pagine e API admin |
| `RESEND_API_KEY` | API key di Resend per l'invio email di notifica (opzionale: se assente le notifiche vengono silenziosamente saltate) |

## Limiti e trade-off

- **Nessun rate limiting**: gli endpoint pubblici non implementano throttling o rate limiting. Un bot potrebbe inviare molti commenti in poco tempo. Mitigazione parziale: honeypot field.
- **Honeypot come unica difesa anti-spam**: non c'e CAPTCHA ne altri meccanismi avanzati. L'honeypot funziona contro bot semplici ma non contro attacchi mirati.
- **Moderazione solo manuale**: ogni commento richiede approvazione manuale dell'admin. Non c'e moderazione automatica, filtri per parole chiave o integrazione con servizi anti-spam.
- **Nessuna paginazione**: le query non implementano LIMIT/OFFSET. Su pagine con molti commenti, tutte le righe vengono caricate in una sola richiesta.
- **Email non visibile pubblicamente**: la GET pubblica non espone l'email, ma questa viene comunque raccolta e salvata nel DB. Non c'e un meccanismo di opt-in esplicito ne informativa sulla privacy inline.
- **Token admin nel query string**: la pagina admin usa il token come query parameter (`?token=...`), il che lo espone nei log del server e nella cronologia del browser. Mitigato dal meta tag `referrer: no-referrer`.
- **Label i18n duplicate**: le traduzioni del componente `Comments.astro` sono definite sia nel frontmatter (per SSR) che nello script inline (per il client), creando duplicazione. Questo e necessario perche `<script is:inline>` non ha accesso alle variabili Astro.
- **Nessun editing/cancellazione da parte dell'utente**: una volta inviato, il commento puo essere gestito solo dall'admin.
- **Like aggirabili con VPN/incognito**: l'hash IP+UA non e' a prova di abuso, ma per un blog personale e' sufficiente.
- **No pre-moderazione delle reply visualmente**: una reply pending appare solo all'admin; il parent in cui si annida e' visibile pubblicamente, ma il thread cresce solo dopo approvazione.

### Possibili evoluzioni

- Aggiungere rate limiting (es. per IP o fingerprint)
- Implementare paginazione lato API e UI
- Integrare un sistema anti-spam piu robusto (es. Akismet)
- Spostare l'autenticazione admin su cookie HttpOnly invece che query string
- Consentire all'utente di cancellare il proprio commento via magic link in email
