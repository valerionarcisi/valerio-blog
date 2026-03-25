# Contact Form — Spec

## Obiettivo

Permettere ai visitatori di inviare un messaggio al proprietario del sito tramite un modulo contatti. Il messaggio viene inoltrato via email (Resend API) senza salvarlo in database. Il sistema include protezioni anti-spam (honeypot) e rate limiting.

## Architettura

```
  Browser (client)                    Netlify Function                  Resend API
       |                                    |                              |
  [Form submit]                             |                              |
       |                                    |                              |
  JS intercetta submit                      |                              |
  raccoglie campi + honeypot                |                              |
       |                                    |                              |
  POST /api/contact  ------------------>  [Validazione]                    |
  Content-Type: application/json            |                              |
                                     1. Check Origin                       |
                                        (CORS whitelist)                   |
                                            |                              |
                                     2. Rate Limit                         |
                                        (3 req/min per IP)                 |
                                            |                              |
                                     3. Honeypot                           |
                                        (campo "website" pieno = bot)      |
                                        risponde 200 ok (silent discard)   |
                                            |                              |
                                     4. Validazione campi                  |
                                        name <= 100 char                   |
                                        email <= 254 char + regex          |
                                        message <= 5000 char               |
                                            |                              |
                                     5. sendContactEmail() ----------> POST /emails
                                        via Resend API                     |
                                            |                         Email a
                                            |                         valerio.narcisi@gmail.com
                                     6. Risposta al client                 |
                                        { ok: true } | { error: "..." }   |
       |                                    |                              |
  [Mostra feedback]  <------------------    |                              |
  successo / errore                         |                              |
```

## Dati / Schema

### Payload richiesta (`POST /api/contact`)

```json
{
  "name": "string",       // obbligatorio, max 100 caratteri
  "email": "string",      // obbligatorio, max 254 caratteri, validato con regex
  "message": "string",    // obbligatorio, max 5000 caratteri
  "website": "string"     // honeypot: se compilato, la richiesta viene scartata silenziosamente
}
```

### Risposta

| Status | Body | Significato |
|--------|------|-------------|
| 200 | `{ "ok": true }` | Messaggio inviato (o honeypot attivato — stessa risposta) |
| 400 | `{ "error": "..." }` | JSON invalido o campi mancanti/invalidi |
| 403 | `{ "error": "Forbidden" }` | Origin non nell'allowlist |
| 429 | `{ "error": "Too many requests" }` | Rate limit superato |
| 500 | `{ "error": "Failed to send" }` | Errore invio email via Resend |

### Email generata

- **Da**: `Blog <onboarding@resend.dev>` (dominio sandbox Resend)
- **A**: `valerio.narcisi@gmail.com` (hardcoded)
- **Reply-To**: email del mittente (per rispondere direttamente)
- **Oggetto**: `Nuovo messaggio da {nome}`
- **Corpo**: HTML con nome, email e messaggio (escape HTML applicato)

## API Endpoints

### `POST /api/contact`

Endpoint serverless (Netlify Function, `prerender = false`).

**Sicurezza**:
- **CORS Origin check**: accetta solo richieste da `valerionarcisi.me`, `www.valerionarcisi.me`, `localhost:4321`, `localhost:3000`
- **Rate limiting**: massimo 3 richieste per IP in una finestra di 60 secondi. Implementato con `Map` in-memory (si resetta al cold start della function)
- **Honeypot**: campo nascosto `website` — se compilato, il server risponde `200 { ok: true }` senza inviare email (i bot non si accorgono del rifiuto)
- **Validazione input**: tipo, lunghezza e formato email verificati server-side
- **Escape HTML**: tutti i campi vengono sanitizzati con `escapeHtml()` prima di inserirli nell'email

## Componenti UI

### Pagina `contatti.astro`

Pagina statica con layout basato su `BlogPost.css`. Contiene:

- Testo introduttivo in italiano
- Form HTML con 3 campi visibili: Nome (`text`, `maxlength=100`), Email (`email`, `maxlength=254`), Messaggio (`textarea`, `maxlength=5000`)
- Campo honeypot nascosto (`website`) con `aria-hidden="true"` e `tabindex="-1"`
- Pulsante "Invia"
- Div `#form-result` con `aria-live="polite"` per feedback accessibile

**Script inline** (`is:inline`):
- Intercetta il submit del form
- Disabilita il pulsante e mostra "Invio in corso..."
- Invia i dati come JSON a `/api/contact`
- Mostra messaggio di successo ("Messaggio inviato!") o errore
- Resetta il form dopo invio riuscito
- Riabilita il pulsante in ogni caso (`finally`)

## i18n

La pagina contatti esiste solo in italiano (`/contatti`). Non c'e una versione inglese. Tutti i testi (label, messaggi di feedback, placeholder) sono hardcoded in italiano direttamente nel template e nello script.

## File coinvolti

| File | Ruolo |
|------|-------|
| `src/pages/contatti.astro` | Pagina contatti (IT) con form e script client |
| `src/pages/api/contact.ts` | Endpoint serverless — validazione, rate limit, invio email |
| `src/lib/email.ts` | Utility invio email via Resend (`sendContactEmail()`) |
| `src/components/ContactForm.css` | Stili del form (importato nella pagina) |
| `src/components/BaseHead.astro` | Head HTML (SEO, meta) |
| `src/components/Header.astro` | Header navigazione |
| `src/components/Footer.astro` | Footer |

## Dipendenze

- **Resend API** — servizio email transazionale (HTTP REST, nessun SDK installato)
- **Netlify Functions** — runtime serverless per l'endpoint `/api/contact`
- **Nessun database** — i messaggi non vengono salvati, solo inoltrati via email

## Env vars

| Variabile | Obbligatoria | Descrizione |
|-----------|-------------|-------------|
| `RESEND_API_KEY` | si | API key per il servizio Resend. Se assente, `sendContactEmail()` ritorna `false` |

## Limiti e trade-off

- **Rate limiting in-memory**: il `Map` che traccia le richieste per IP vive nella memoria della funzione serverless. Si resetta ad ogni cold start di Netlify Functions, quindi non e persistente. Un attaccante potrebbe aggirarlo forzando nuove istanze.
- **Nessun CAPTCHA**: la protezione anti-bot si basa unicamente sull'honeypot. Bot sofisticati che analizzano il DOM potrebbero evitare il campo nascosto.
- **Nessun salvataggio dei messaggi**: se l'email non viene recapitata (errore Resend, quota esaurita, ecc.), il messaggio e perso. Non esiste coda di retry.
- **Dominio sandbox Resend**: il mittente e `onboarding@resend.dev` (dominio sandbox), il che potrebbe causare problemi di deliverability o finire in spam. Per produzione sarebbe meglio un dominio verificato.
- **Solo italiano**: la pagina contatti non ha una versione inglese. I visitatori anglofoni del sito (che navigano su `/en/`) non hanno un modulo contatti localizzato.
- **Validazione email basilare**: la regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` copre i casi comuni ma non e conforme a RFC 5322. Sufficiente per uso pratico.
- **Nessuna conferma al mittente**: chi invia il messaggio non riceve email di conferma, solo il feedback visivo nella pagina.
