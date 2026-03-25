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

| Campo        | Tipo    | Note                                           |
| ------------ | ------- | ---------------------------------------------- |
| `id`         | INTEGER | Primary key, autoincrement (implicito SQLite)  |
| `page_id`    | TEXT    | Identificativo della pagina (es. slug del post)|
| `name`       | TEXT    | Nome dell'autore (max 100 caratteri)           |
| `email`      | TEXT    | Email dell'autore (max 254 caratteri)          |
| `text`       | TEXT    | Contenuto del commento (max 5000 caratteri)    |
| `approved`   | INTEGER | 0 = pendente (default), 1 = approvato         |
| `created_at` | TEXT    | Timestamp di creazione (default SQLite)        |

Query di lettura pubblica filtrano per `approved = 1` e ordinano per `created_at ASC`.
Query admin filtrano per `approved = 0` (pendenti) o `approved = 1` (approvati) e ordinano per `created_at DESC`.

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
| **Request body** | `{ pageId, name, email, text, website }`       |
| **Response 201** | `{ ok: true }` (commento inserito)             |
| **Response 200** | `{ ok: true }` (honeypot attivato, silenzioso) |
| **Response 400** | `{ error: "All fields are required" }` oppure `{ error: "Field too long" }` oppure `{ error: "Invalid email" }` |

Logica:

1. **Honeypot**: se il campo `website` e valorizzato, il commento viene scartato silenziosamente (risposta 200 per non rivelare il meccanismo ai bot).
2. **Validazione campi**: `pageId`, `name`, `email`, `text` obbligatori e non vuoti dopo trim.
3. **Validazione lunghezza**: `name` <= 100, `email` <= 254, `text` <= 5000 caratteri.
4. **Validazione email**: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
5. **Inserimento**: `INSERT INTO comments (page_id, name, email, text)` — il campo `approved` resta al default (`0`).
6. **Notifica email**: chiama `notifyNewComment()` che invia un'email via Resend API all'indirizzo dell'admin (`valerio.narcisi@gmail.com`) con i dettagli del commento e un link diretto alla pagina di moderazione. La notifica e fire-and-forget: se fallisce non blocca la risposta.

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

- `action: "approve"` -> `UPDATE comments SET approved = 1 WHERE id = ?`
- `action: "delete"` -> `DELETE FROM comments WHERE id = ?`

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
| `src/lib/email.ts` | Funzione `notifyNewComment()` per notifica email via Resend API |
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
- **Nessuna notifica di risposta**: l'utente che commenta non riceve notifica quando il suo commento viene approvato o quando qualcuno risponde.
- **Commenti piatti**: non esiste una struttura a thread/risposte. Tutti i commenti sono allo stesso livello, ordinati cronologicamente.
- **Nessun editing/cancellazione da parte dell'utente**: una volta inviato, il commento puo essere gestito solo dall'admin.

### Possibili evoluzioni

- Aggiungere rate limiting (es. per IP o fingerprint)
- Implementare paginazione lato API e UI
- Aggiungere notifiche email per i commentatori
- Supportare commenti annidati (thread)
- Integrare un sistema anti-spam piu robusto (es. Akismet)
- Spostare l'autenticazione admin su cookie HttpOnly invece che query string
