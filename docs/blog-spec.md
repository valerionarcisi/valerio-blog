# Blog System — Spec

## Obiettivo

Fornire un sistema di blog statico con supporto i18n (italiano/inglese), paginazione, filtro per tag, ricerca lato client e articoli correlati. I contenuti sono scritti in Markdown tramite Astro Content Collections e generati staticamente al build time.

## Architettura

```
                         BUILD TIME
                             |
              +--------------+--------------+
              |                             |
   Content Collections               API Search Index
   src/content/blog/                  /api/search.json
      it/*.md                              |
      en/*.md                              |
              |                            |
     +--------+--------+                   |
     |        |        |                   |
  [slug]  [...page]  [tag]                 |
  pagina   listing   listing               |
  singola  paginato  per tag               |
     |        |        |                   |
     |     +--+--+     |                   |
     |     |     |     |                   |
     |   Card  Card  Card                  |
     |                                     |
     +--- RelatedPosts                     |
     |    (tag similarity)                 |
     |                                     |
     +--- Comments                         |
                                           |
                    RUNTIME (client)       |
                         |                 |
                    BlogSearch  <----------+
                    fetch JSON
                    filtro locale
                    risultati dropdown
```

## Dati / Schema

### Frontmatter dei post (`src/content/blog/{locale}/{slug}.md`)

| Campo              | Tipo       | Obbligatorio | Note                                      |
|--------------------|------------|--------------|-------------------------------------------|
| `title`            | `string`   | si           | Titolo del post                            |
| `date`             | `string`   | si           | Data di pubblicazione (ISO)                |
| `extract`          | `string`   | si           | Estratto/descrizione breve                 |
| `tags`             | `string[]` | si           | Tag per categorizzazione e correlati       |
| `coverImage`       | `string`   | si           | URL immagine di copertina (anche esterno)  |
| `coverAuthorLink`  | `string`   | no           | Link all'autore della cover                |
| `coverAuthorName`  | `string`   | no           | Nome autore della cover                    |
| `coverDescription` | `string`   | no           | Alt text / descrizione della cover         |

### Indice di ricerca (generato da `/api/search.json`)

```json
[
  {
    "title": "string",
    "slug": "string",
    "lang": "it | en",
    "extract": "string",
    "date": "string",
    "tags": ["string"]
  }
]
```

## API Endpoints

### `GET /api/search.json`

Endpoint statico (pre-renderizzato al build time) che restituisce tutti i post di tutte le lingue come array JSON.

- **Risposta 200**: array di oggetti `{ title, slug, lang, extract, date, tags }`
- **Risposta 500**: array vuoto `[]`
- **Cache**: `Cache-Control: public, s-maxage=300` (5 minuti)
- **Nota**: l'indice include tutti i post di tutte le lingue; il filtro per lingua avviene lato client

## Componenti UI

### `Card.astro`

Card per la preview di un post nella lista. Mostra immagine ottimizzata (`astro:Image`, 600x340, lazy loading), data, massimo 2 tag, titolo e un estratto troncato a 120 caratteri. Il link punta a `/blog/{slug}/` (IT) o `/en/blog/{slug}/` (EN). Include effetti visivi (overlay, glitch, pixelate) sulla card image.

**Props**: `title`, `extract`, `date`, `coverImage`, `tags`, `slug`, `lang?` (default `"it"`)

### `BlogSearch.astro`

Componente di ricerca client-side con dropdown dei risultati. Al mount carica l'intero indice da `/api/search.json` tramite `fetch`. La ricerca parte da 2+ caratteri e filtra per corrispondenza (case-insensitive) su `title`, `extract` e `tags`. I risultati mostrano il titolo con evidenziazione del termine cercato (`<mark>`). Si chiude con Escape o con il pulsante di clear.

**Limiti**: non filtra per lingua (mostra risultati IT e EN mescolati); i link puntano sempre a `/blog/{slug}/` senza prefisso lingua.

### `RelatedPosts.astro`

Mostra fino a `maxPosts` (default 6) articoli correlati basati sulla similarita dei tag. L'algoritmo conta i tag in comune; a parita ordina per data decrescente. Esclude il post corrente. Filtra per lingua. Renderizza una griglia responsiva di `Card`.

**Props**: `currentSlug`, `currentTags`, `maxPosts?` (default 6), `lang?` (default `"it"`)

## i18n

- La lingua viene determinata dalla directory del contenuto (`it/` o `en/`) tramite `getLangFromId()`
- Utility in `src/i18n/utils.ts`:
  - `getLangFromUrl(url)` — estrae la lingua dal path URL
  - `getLangFromId(id)` — estrae la lingua dall'ID della content collection (primo segmento del path)
  - `getSlugFromId(id)` — estrae lo slug dall'ID (ultimo segmento del path)
  - `useTranslations(lang)` — restituisce una funzione `t(key)` con fallback alla lingua default
  - `getLocalizedPath(path, lang)` — aggiunge il prefisso `/en/` se necessario
- Chiavi di traduzione rilevanti per il blog: `blog.relatedPosts`, `blog.readMore`, `blog.readingTime`, `blog.tags`
- Configurazione: italiano senza prefisso URL, inglese con prefisso `/en/`
- Le pagine IT e EN sono file separati (`src/pages/blog/` e `src/pages/en/blog/`)

## Paginazione

- Gestita da `paginate()` di Astro con `pageSize: 6`
- L'oggetto `pagination` passato al layout `Blog.astro` contiene: `currentPage`, `lastPage`, `url.prev`, `url.next`, `url.current`, `basePath`
- Le pagine tag (`/tag/{tag}/`) usano lo stesso meccanismo con base path `/tag/{tag}/`
- Le pagine tag hanno `noindex` per evitare indicizzazione duplicata

## File coinvolti

| File | Ruolo |
|------|-------|
| `src/pages/blog/[slug].astro` | Pagina singola post (IT) |
| `src/pages/blog/[...page].astro` | Listing paginato (IT) |
| `src/pages/tag/[tag]/[...page].astro` | Listing filtrato per tag (IT) |
| `src/pages/api/search.json.ts` | Endpoint indice di ricerca |
| `src/components/Card.astro` | Card preview post |
| `src/components/Card.css` | Stili co-locati della Card |
| `src/components/BlogSearch.astro` | Ricerca client-side |
| `src/components/RelatedPosts.astro` | Articoli correlati |
| `src/components/Comments.astro` | Sistema commenti (inline nel post) |
| `src/components/FormattedDate.astro` | Formattazione date |
| `src/components/Tag.astro` | Componente singolo tag |
| `src/layouts/BlogPost.astro` | Layout pagina singola |
| `src/layouts/Blog.astro` | Layout listing |
| `src/i18n/utils.ts` | Helper i18n (lang/slug extraction) |
| `src/i18n/ui.ts` | Dizionario traduzioni |
| `src/content/blog/it/*.md` | Contenuti italiano |
| `src/content/blog/en/*.md` | Contenuti inglese |

## Dipendenze

- **Astro 5** — framework SSG, content collections (glob loader), `paginate()`, `astro:Image`
- **astro:content** — `getCollection()`, `render()` per i post Markdown
- **Nessuna libreria di ricerca esterna** — la ricerca e puramente client-side con `String.includes()`

## Env vars

Nessuna variabile d'ambiente richiesta per il sistema blog in se. L'indice di ricerca e i contenuti sono tutti generati staticamente al build time.

(Le env vars `TURSO_*` e `ADMIN_TOKEN` servono al sistema commenti, che e integrato nelle pagine post ma e un sistema separato.)

## Limiti e trade-off

- **Ricerca non filtrata per lingua**: `BlogSearch` carica tutti i post (IT + EN) e non filtra per lingua corrente. I link nei risultati puntano sempre a `/blog/{slug}/` (percorso italiano).
- **Ricerca in-memory**: l'intero indice viene scaricato al primo utilizzo. Funziona bene per blog di dimensioni medie, ma non scala per migliaia di post.
- **Nessuna ricerca full-text**: il filtro e basato su `includes()` su titolo, estratto e tag. Non supporta fuzzy matching, stemming o ranking per rilevanza.
- **Paginazione statica**: la dimensione pagina (6 post) e fissa nel codice, non configurabile senza modifica.
- **Pagine duplicate IT/EN**: le route per italiano e inglese sono file Astro separati con logica quasi identica. Il filtro per lingua e manuale (`getLangFromId() === 'it'`).
- **Tag case-insensitive ma non normalizzati**: il confronto tag usa `toLowerCase()` ma lo slug del tag nel URL mantiene il case originale del primo tag trovato.
- **Immagini cover esterne**: le cover possono essere URL esterni, il che richiede configurazione Astro per i domini consentiti nelle ottimizzazioni immagini.
