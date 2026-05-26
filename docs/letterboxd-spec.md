# Letterboxd / TMDB — Spec

## Obiettivo

Mostrare i film visti di recente dall'utente Letterboxd `valenar`, arricchiti con poster, regista, budget/box office, durata e valutazione da TMDB. I dati appaiono in tre superfici:

- **Homepage** (`/`, `/en/`) — blocco "Visti di recente" / "Recently watched", ultimi 5 film.
- **Pagina completa** (`/visti`, `/en/watched`) — lista completa raggruppata per anno, con statistiche (totale film, ultimi 7 giorni, ore guardate, voto medio).

### Freschezza senza redeploy

Il sito è statico (Astro SSG su Netlify). Per evitare che un film appena loggato su Letterboxd resti invisibile fino al prossimo deploy, le sezioni usano **progressive enhancement**:

1. **Build time**: le pagine renderizzano la lista corrente come contenuto statico → ottimo per SEO, primo paint immediato, e fallback se JS è disabilitato o l'API è giù.
2. **Client side**: al caricamento, uno script fa `fetch('/api/letterboxd')` e, se ottiene dati, **riscrive** la lista (e le statistiche, nella pagina completa) con i film freschi.

Risultato: un film appena visto compare entro la finestra di cache dell'endpoint (~5 min), senza rebuild.

## Architettura

```
Build time (statico)                 Client (runtime, ogni visita)
+-----------------------+            +------------------------------+
| index/visti .astro    |            | <script> watched-movies.ts   |
| fetch RSS+TMDB         |            |  fetchWatched()              |
| render lista (fallback)|           |   -> GET /api/letterboxd     |
+-----------------------+            |  renderCompact / renderFull  |
                                     +------------------------------+
                                                  |
                                                  v
                                     +------------------------------+
                                     | API Endpoint (Netlify fn)    |
                                     |  src/pages/api/letterboxd.ts |
                                     |  prerender = false           |
                                     +------------------------------+
                                         |                    |
                                         | getLetterboxdRss() | getMovieById() (per film)
                                         v                    v
                                  +----------------+   +-------------------+
                                  | Letterboxd RSS |   | TMDB API v3       |
                                  | /valenar/rss/  |   | /movie/{id}       |
                                  +----------------+   | append: credits   |
                                                       +-------------------+
```

L'endpoint **riusa i service** `letterboxd.ts` e `tmdb.ts` (niente più logica duplicata inline).

## Dati

### Estratti dal feed RSS Letterboxd

| Campo                    | Descrizione                        |
| ------------------------ | ---------------------------------- |
| `letterboxd:filmTitle`   | Titolo del film su Letterboxd      |
| `tmdb:movieId`           | ID TMDB (chiave join, obbligatorio)|
| `letterboxd:watchedDate` | Data di visione (YYYY-MM-DD)       |
| `letterboxd:memberRating`| Voto personale (es. "4.0")         |
| `link`                   | URL della review su Letterboxd     |

Gli item senza `tmdb:movieId` vengono scartati.

### Arricchiti da TMDB (`/movie/{id}?append_to_response=credits`)

`poster_path`, `budget`, `revenue`, `overview`, `release_date`, `vote_average`, `runtime`, e i registi estratti da `credits.crew` (`job === "Director"`, deduplicati) via `extractDirectors()`.

### Oggetto restituito al client

```ts
{
  title: string;
  posterPath: string | null;
  budget: number | null;
  revenue: number | null;
  directors: string[];
  overview: string | null;
  releaseDate: string | null;   // YYYY-MM-DD
  voteAverage: number | null;
  runtime: number | null;       // minuti
  rating: string | null;        // voto personale Letterboxd
  watchedDate: string | null;   // YYYY-MM-DD
  link: string;
}
```

## API Endpoints

### `GET /api/letterboxd`

- **Prerender**: `false` (serverless, runtime)
- **Autenticazione**: nessuna (endpoint pubblico)
- **Cache**: `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600` — 5 min browser + CDN, così sotto traffico le chiamate a TMDB restano limitate.
- **Flusso**:
  1. `getLetterboxdRss()` → fetch RSS `https://letterboxd.com/valenar/rss/`
  2. `parseXmlContent()` (xml2js)
  3. Filtra gli item con `tmdb:movieId`
  4. Per ogni item, `getMovieById()` in parallelo (`Promise.all`); i film falliti diventano `null` e vengono scartati
  5. Mappa allo shape camelCase sopra, preserva l'ordine del feed (più recente prima)
- **Errori**: `500` per errori interni; i singoli film che falliscono vengono semplicemente omessi.

## Rendering client (`src/scripts/watched-movies.ts`)

Modulo bundlato lato client (import-abile dagli `<script>` Astro). Costruisce il DOM con `document.createElement` (niente `innerHTML` su dati esterni → no XSS). Riusa gli helper puri `formatMoneyCompact` e `letterboxdDirectorUrl`.

| Export | Ruolo |
| --- | --- |
| `fetchWatched()` | `GET /api/letterboxd`, ritorna `WatchedMovie[]` (o `[]`) |
| `renderCompact(block, movies, opts)` | Riscrive la lista a 5 film della homepage |
| `renderFull(main, movies, opts)` | Raggruppa per anno, riscrive la lista completa e aggiorna le statistiche |

`opts` porta `locale` (`it-IT` / `en-GB`), `byLabel` ("di" / "by") e, per la full, `myRatingLabel`. Le pagine espongono hook `data-*` (`data-watched-home`, `data-watched-list`, `data-watched-main`, `data-stat="total|week|hours|rating"`).

## File coinvolti

| File | Ruolo |
| --- | --- |
| `src/pages/api/letterboxd.ts` | Endpoint serverless — fetch RSS, join TMDB, ritorna JSON arricchito |
| `src/scripts/watched-movies.ts` | Fetch + rendering client (homepage compatta + pagina completa) |
| `src/services/letterboxd.ts` | `getLetterboxdRss()`, `parseXmlContent()` |
| `src/services/tmdb.ts` | `getMovieById()` (append credits), `extractDirectors()` |
| `src/pages/index.astro`, `src/pages/en/index.astro` | Homepage — render build-time + `<script>` `renderCompact` |
| `src/pages/visti.astro`, `src/pages/en/watched.astro` | Pagina completa — render build-time + `<script>` `renderFull` |

## Dipendenze

| Pacchetto | Utilizzo |
| --- | --- |
| `xml2js` | Parsing XML del feed RSS Letterboxd |
| `astro` 5.x | Framework, routing, endpoint serverless, bundling script client |

## Env vars

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `TMDB_API_KEY` | Sì | API key per The Movie Database (v3) |

## Limiti e trade-off

- **Doppio rendering**: la stessa lista è renderizzata sia in `.astro` (build) sia in TS (client). È duplicazione voluta — il costo è il prezzo del progressive enhancement (SEO + fallback + freschezza).
- **Chiamate N+1**: 1 fetch RSS + N fetch TMDB. Nessun batching (TMDB non offre endpoint bulk). Mitigato dalla cache CDN a 5 min.
- **Nessuna validazione schema**: RSS e risposta TMDB non sono validati con Zod; il parsing dell'XML usa `any` (coerente con gli altri service).
- **Utente hardcoded**: il profilo `valenar` è hardcoded nel service.
- **Nessun limite item**: tutti gli item con `tmdb:movieId` vengono processati.
