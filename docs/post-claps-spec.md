# Post Claps — Spec

## Obiettivo

Aggiungere ai post del blog un sistema di "claps" stile Medium: un pulsante di applauso (👏) che l'utente puo' cliccare piu' volte (max 50, come Medium) per esprimere apprezzamento. Mostra il totale aggregato di tutti i visitatori e quanti claps "miei" ho lasciato. Identita' stabile via hash IP+UA, niente account.

## Architettura

```
                       VISITATORE
                           |
                  [PostClaps.astro]
                    |             |
            GET /api/posts/    POST /api/posts/
            claps?postId=...   claps  { postId }
                    |             |
                    v             v
                 +-----------------+
                 | Turso SQLite    |
                 | post_claps      |
                 +-----------------+
                          ^
                          |
              GET /api/admin/claps (Bearer token)
                          |
              [admin/comments.astro: section "Claps recap"]
```

## Schema DB

Tabella `post_claps`:

| Campo          | Tipo    | Note                                          |
| -------------- | ------- | --------------------------------------------- |
| `id`           | INTEGER | Primary key, autoincrement                    |
| `post_id`      | TEXT    | Slug-style identifier (es. `it/blog/foo`)     |
| `visitor_hash` | TEXT    | Hash stabile (no data) di host+IP+UA          |
| `count`        | INTEGER | Numero di clap del singolo visitor (max 50)   |
| `created_at`   | TEXT    | Timestamp del primo clap                      |
| `updated_at`   | TEXT    | Timestamp dell'ultimo clap                    |

Constraint `UNIQUE(post_id, visitor_hash)`. Indici su `post_id` e `visitor_hash`.

Il **totale** dei claps di un post e' `SUM(count)` aggregato. La cifra "mine" e' il `count` del singolo `visitor_hash`. Limite hard-coded: 50 claps per visitor (`MAX_CLAPS_PER_VISITOR`).

## API

### `GET /api/posts/claps?postId=...`

| Proprieta       | Valore                                          |
| --------------- | ----------------------------------------------- |
| **Metodo**      | GET                                             |
| **Path**        | `/api/posts/claps`                              |
| **Auth**        | Nessuna                                         |
| **Query**       | `postId` (obbligatorio)                         |
| **Response 200**| `{ total: number, mine: number, max: 50 }`     |
| **Response 400**| `{ error: "postId required" }`                  |

Calcola `total = COALESCE(SUM(count), 0)` e `mine = count` per il `visitor_hash` corrente (calcolato da host+IP+UA).

### `POST /api/posts/claps`

| Proprieta       | Valore                                                |
| --------------- | ----------------------------------------------------- |
| **Metodo**      | POST                                                  |
| **Path**        | `/api/posts/claps`                                    |
| **Auth**        | Nessuna                                               |
| **Body**        | `{ postId: string }`                                  |
| **Response 200**| `{ total, mine, max, capped? }`                       |
| **Response 400**| `{ error: "postId required" }` o "Invalid JSON"      |

Logica:
1. Calcola visitor_hash stabile
2. Cerca record per `(post_id, visitor_hash)`. Se non esiste → INSERT con `count = 1`. Se esiste e `count >= 50` → ritorna risposta con `capped: true` senza incrementare. Altrimenti UPDATE `count = count + 1`, aggiorna `updated_at`
3. Ricarica e ritorna `{ total, mine }`

Niente endpoint per rimuovere claps (semantica Medium).

### `GET /api/admin/claps` (Bearer token)

| Proprieta       | Valore                                                |
| --------------- | ----------------------------------------------------- |
| **Metodo**      | GET                                                   |
| **Path**        | `/api/admin/claps`                                    |
| **Auth**        | Bearer token (`Authorization: Bearer <ADMIN_TOKEN>`) |
| **Response 200**| `{ totals, per_post }`                                |
| **Response 401**| `{ error: "Unauthorized" }`                           |

`totals = { total, posts, unique_clappers }` aggregato sull'intera tabella.
`per_post = [{ post_id, total_claps, unique_clappers, last_clap_at }]` ordinato per `total_claps DESC`.

Viene usato dalla pagina `/admin/comments` per mostrare il "Claps recap".

## Componente

`src/components/PostClaps.astro` con `PostClaps.css` co-located. Props:
- `postId: string`
- `lang: "it" | "en"`

Layout: bottone a pillola con border `var(--color-tertiary)` (giallo brand), icona 👏 a sinistra, contatore "mine" a destra. Sotto/accanto, "TOT applausi totali".

Comportamento client (script inline):
- Al mount: GET `/api/posts/claps?postId=...` per popolare `total`, `mine`, `max`
- Click sul bottone: incrementa `mine` e `total` ottimisticamente, animazione `pulse` (CSS keyframe `scale + rotate`), poi POST per persistere. Quando l'ultima richiesta in volo torna, allinea i numeri ai valori canonici dal server.
- Bottone disabilitato (CSS `is-capped`) quando `mine >= max`.

## Inserimento nel layout

I file `src/pages/blog/[slug].astro` e `src/pages/en/blog/[slug].astro` importano `PostClaps` e lo renderizzano tra `<Content />` e `<Comments />`, passando `postId={`{lang}/blog/${slug}`}`.

## Recap admin

Nella pagina `/admin/comments` e' presente una sezione "👏 Claps recap" sotto la lista commenti. Mostra:
- **Totali**: total claps · numero di post con almeno un clap · visitatori unici
- **Tabella per post**: post_id, claps totali, visitatori unici, timestamp ultimo clap, ordinati per totale decrescente

Carica dati da `GET /api/admin/claps` con il bearer token.

## File coinvolti

| File | Scopo |
| ---- | ----- |
| `src/pages/api/posts/claps.ts` | Endpoint pubblico GET/POST |
| `src/pages/api/admin/claps.ts` | Endpoint admin GET (recap) |
| `src/components/PostClaps.astro` | Componente front-end |
| `src/components/PostClaps.css` | Stili del componente |
| `src/pages/blog/[slug].astro` | Wire del componente nel post IT |
| `src/pages/en/blog/[slug].astro` | Wire del componente nel post EN |
| `src/pages/admin/comments.astro` | Sezione "Claps recap" |
| `scripts/migrate-comments-replies-likes.ts` | Migration tabella `post_claps` |
| `scripts/init-db.ts` | Schema completo per nuove installazioni |

## Limiti e trade-off

- **Spam claps con VPN/incognito**: l'hash IP+UA non e' a prova di abuso. Per un blog personale e' sufficiente.
- **post_id non validato**: chi facesse una POST con un postId arbitrario puo' inquinare la tabella. Mitigazione: il client invia solo pageId reali. Accettato.
- **No timeline degli applausi**: si memorizza solo il totale per visitor, non ogni singolo click. Sufficiente per il counter.
- **Niente notifica email per i claps**: i claps sono interazioni leggere, l'admin li vede solo nella sezione recap quando apre la pagina admin.
