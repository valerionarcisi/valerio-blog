# Letterboxd / TMDB — Spec

## Obiettivo

Mostrare nella homepage i film visti di recente dall'utente Letterboxd `valenar`, arricchiti con poster e valutazione media da TMDB. I dati vengono recuperati a runtime tramite un endpoint serverless e renderizzati come card orizzontali scrollabili.

## Architettura

```
Browser (client)
     |
     | GET /api/letterboxd
     v
+-----------------------------+
| API Endpoint (Netlify fn)   |
|  letterboxd.ts              |
+-----------------------------+
     |                    |
     | 1. fetch RSS       | 2. per ogni film con tmdb:movieId
     v                    v
+-----------------+   +-------------------+
| Letterboxd RSS  |   | TMDB API v3       |
| /valenar/rss/   |   | /movie/{id}       |
+-----------------+   +-------------------+
     |                    |
     | XML (RSS 2.0)      | JSON (dettagli film)
     v                    v
+-----------------------------+
| Parsing + merge dati       |
| title, posterPath,          |
| voteAverage, link,          |
| watchedDate                 |
+-----------------------------+
     |
     | JSON array
     v
+-----------------------------+
| Reel.astro (componente UI) |
| card con poster, voto, data |
+-----------------------------+
```

## Dati

### Dati estratti dal feed RSS Letterboxd

| Campo                       | Origine            | Descrizione                        |
| --------------------------- | ------------------ | ---------------------------------- |
| `letterboxd:filmTitle`      | RSS item           | Titolo del film su Letterboxd      |
| `tmdb:movieId`              | RSS item           | ID TMDB (usato come chiave join)   |
| `letterboxd:watchedDate`    | RSS item           | Data di visione (YYYY-MM-DD)       |
| `link`                      | RSS item           | URL della review su Letterboxd     |

### Dati arricchiti da TMDB

| Campo          | Origine       | Descrizione                              |
| -------------- | ------------- | ---------------------------------------- |
| `poster_path`  | TMDB API      | Path relativo del poster (w500)          |
| `vote_average` | TMDB API      | Voto medio della community TMDB          |
| `vote_count`   | TMDB API      | Numero totale di voti                    |
| `title`        | TMDB API      | Titolo (fallback se manca dal RSS)       |

### Oggetto restituito al client

```ts
{
  title: string;         // titolo film (RSS, fallback TMDB)
  posterPath: string;    // path poster TMDB (es. "/abc123.jpg")
  voteAverage: number;   // media voti TMDB
  voteCount: number;     // conteggio voti TMDB
  link: string;          // URL review Letterboxd
  watchedDate: string;   // data visione (YYYY-MM-DD)
}
```

## API Endpoints

### `GET /api/letterboxd`

- **Prerender**: `false` (serverless, eseguito a runtime)
- **Autenticazione**: nessuna (endpoint pubblico)
- **Cache**: `Cache-Control: public, max-age=900` (15 minuti)
- **Flusso**:
  1. Fetch RSS da `https://letterboxd.com/valenar/rss/`
  2. Parsing XML con `xml2js.parseString`
  3. Filtra solo gli item con `tmdb:movieId` presente
  4. Per ogni item, chiama TMDB API v3 `/movie/{id}` in parallelo (`Promise.all`)
  5. Merge dati RSS + TMDB, scarta eventuali film falliti (`null`)
  6. Restituisce array JSON
- **Risposte di errore**:
  - `502` se il fetch RSS fallisce
  - `500` per errori interni generici

## Componenti UI

### `Reel.astro`

Componente riutilizzabile per card di film e brani musicali in uno scroll orizzontale.

**Props** (tipo `movie`):

| Prop           | Tipo     | Descrizione                        |
| -------------- | -------- | ---------------------------------- |
| `url`          | string   | URL completa immagine poster       |
| `href`         | string   | Link esterno (Letterboxd)          |
| `title`        | string   | Titolo del film                    |
| `watchedDate`  | string   | Data visione                       |
| `vote_average` | number?  | Voto medio TMDB                    |
| `vote_count`   | number?  | Conteggio voti TMDB                |
| `type`         | `"movie" \| "song"` | Determina layout della card |

**Comportamento**:
- Poster con dimensione fissa (160x240 mobile, 185x278 desktop)
- Badge voto sovrapposto in alto a destra (font mono, sfondo semi-trasparente con blur)
- Placeholder SVG se il poster manca o fallisce il caricamento (`onerror` inline)
- Data formattata in formato breve inglese (es. "Mar 15")
- Titolo troncato a 2 righe con `-webkit-line-clamp`
- Hover: zoom 1.05 + brightness 1.1 sul poster

## File coinvolti

| File | Ruolo |
| --- | --- |
| `src/pages/api/letterboxd.ts` | Endpoint serverless — fetch RSS, join TMDB, ritorna JSON |
| `src/services/letterboxd.ts` | Service layer — `getLetterboxdRss()` e `parseXmlContent()` (utility riusabili) |
| `src/services/tmdb.ts` | Service layer — `getMovieById()`, costanti API TMDB |
| `src/components/Reel.astro` | Componente card (condiviso con Last.FM) |
| `src/components/Reel.css` | Stili co-locati del componente Reel |

**Nota**: l'endpoint `api/letterboxd.ts` attualmente duplica parte della logica presente nei service (`letterboxd.ts`, `tmdb.ts`) invece di importarli direttamente. I service sono disponibili per un eventuale refactoring.

## Dipendenze

| Pacchetto | Versione | Utilizzo |
| --- | --- | --- |
| `xml2js` | — | Parsing XML del feed RSS Letterboxd |
| `astro` | 5.x | Framework, routing, endpoint serverless |

## Env vars

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `TMDB_API_KEY` | Si | API key per The Movie Database (v3) |

## Limiti e trade-off

- **Nessuna cache persistente**: i dati vengono recuperati ad ogni richiesta (mitigato dal `max-age=900` HTTP). Non c'e' un layer di cache server-side (Redis, KV store, ecc.).
- **Rate limiting TMDB**: ogni chiamata all'endpoint genera N richieste parallele a TMDB (una per film nel feed RSS). Con feed lunghi si rischia di superare i rate limit TMDB.
- **Chiamate N+1**: il pattern e' 1 fetch RSS + N fetch TMDB. Non c'e' batching (TMDB non offre un endpoint bulk per ID multipli).
- **Duplicazione logica**: l'endpoint `api/letterboxd.ts` reimplementa parsing XML e fetch TMDB inline, invece di riusare `src/services/letterboxd.ts` e `src/services/tmdb.ts`.
- **Nessuna validazione schema**: la risposta TMDB e il feed RSS non vengono validati con Zod o simili; si usa `any` per il parsing.
- **Utente hardcoded**: il profilo Letterboxd `valenar` e' hardcoded sia nell'endpoint che nel service.
- **Nessun limite item**: tutti gli item del feed RSS con `tmdb:movieId` vengono processati. Il feed Letterboxd puo' contenere decine di entry.
- **Immagini TMDB w500**: il poster viene servito in formato `w500` (via costante `IMAGES_URL` nel service), adeguato per le dimensioni della card ma potenzialmente sovradimensionato per mobile.
