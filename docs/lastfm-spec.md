# Last.FM — Spec

## Obiettivo

Mostrare nella homepage i brani ascoltati di recente dall'utente Last.FM `valerionar`, con copertina album, artista e data di ascolto. I dati vengono recuperati a runtime tramite un endpoint serverless e renderizzati come card orizzontali scrollabili (componente condiviso con Letterboxd).

## Architettura

```
Browser (client)
     |
     | GET /api/lastfm
     v
+-----------------------------+
| API Endpoint (Netlify fn)   |
|  lastfm.ts                  |
+-----------------------------+
     |
     | fetch user.getrecenttracks
     | (limit=20)
     v
+-----------------------------+
| Audioscrobbler API v2.0     |
| ws.audioscrobbler.com       |
+-----------------------------+
     |
     | JSON (recent tracks)
     v
+-----------------------------+
| Filtraggio:                 |
| - escludi tracce senza album|
| - escludi placeholder image |
+-----------------------------+
     |
     | JSON array
     v
+-----------------------------+
| Reel.astro (componente UI) |
| card con cover, artista,    |
| album, data                 |
+-----------------------------+
```

## Dati

### Dati dall'API Audioscrobbler

| Campo              | Origine              | Descrizione                          |
| ------------------ | -------------------- | ------------------------------------ |
| `name`             | track                | Nome del brano                       |
| `url`              | track                | URL della pagina Last.FM del brano   |
| `artist.#text`     | track.artist         | Nome dell'artista                    |
| `album.#text`      | track.album          | Nome dell'album                      |
| `image[].#text`    | track.image          | URL copertina (array per dimensione) |
| `date.#text`       | track.date           | Data/ora scrobble (assente se in riproduzione) |

### Schema Zod (service layer)

Il service `audioscrobbler.ts` definisce uno schema Zod per validare la risposta API:

```ts
Track {
  name: string
  url: string
  date?: { "#text": string }
  album: { "#text": string }
  artist: { "#text": string }
  image: Array<{ "#text": string, size: string }>
}
```

### Oggetto restituito al client (endpoint)

```ts
{
  name: string;    // nome brano
  url: string;     // URL pagina Last.FM
  artist: string;  // nome artista
  album: string;   // nome album
  image: string;   // URL copertina (dimensione "extralarge", indice 3)
  date: string | null;  // data scrobble (null se in riproduzione)
}
```

## API Endpoints

### `GET /api/lastfm`

- **Prerender**: `false` (serverless, eseguito a runtime)
- **Autenticazione**: nessuna (endpoint pubblico)
- **Cache**: `Cache-Control: public, max-age=900` (15 minuti)
- **Parametri API**: `method=user.getrecenttracks`, `user=valerionar`, `limit=20`, `format=json`
- **Flusso**:
  1. Costruisce query params per l'API Audioscrobbler
  2. Fetch `https://ws.audioscrobbler.com/2.0/`
  3. Filtra tracce: escludi quelle senza album e con immagine placeholder
  4. Mappa i campi nel formato semplificato
  5. Restituisce array JSON
- **Filtri applicati**:
  - `album["#text"] !== ""` — rimuove tracce senza album associato
  - `image[0]["#text"] !== PLACEHOLDER_IMAGE` — rimuove tracce con immagine placeholder Last.FM generica
- **Risposte di errore**:
  - `502` se il fetch verso Audioscrobbler fallisce
  - `500` per errori interni generici

## Componenti UI

### `Reel.astro` (tipo `"song"`)

Il componente Reel e' condiviso con il flusso Letterboxd. In modalita' `song`:

**Props specifiche**:

| Prop         | Tipo   | Descrizione                 |
| ------------ | ------ | --------------------------- |
| `url`        | string | URL copertina album         |
| `href`       | string | Link esterno (Last.FM)      |
| `title`      | string | Nome del brano              |
| `watchedDate`| string | Data scrobble               |
| `artist`     | string | Nome artista                |
| `album`      | string | Nome album                  |
| `type`       | `"song"` | Attiva layout quadrato    |

**Differenze rispetto a `movie`**:
- Thumbnail quadrata (160x160 mobile, 185x160 desktop) invece che verticale
- Placeholder SVG diverso ("No Cover" invece di "No Poster")
- Mostra artista (colore accent cyan, font mono) e album (corsivo) sotto il titolo
- Nessun badge voto

## File coinvolti

| File | Ruolo |
| --- | --- |
| `src/pages/api/lastfm.ts` | Endpoint serverless — fetch Audioscrobbler, filtra, ritorna JSON |
| `src/services/audioscrobbler.ts` | Service layer — schema Zod, tipo `AudioScubblerTrack`, funzione `fetchRecentTracks()` |
| `src/components/Reel.astro` | Componente card (condiviso con Letterboxd) |
| `src/components/Reel.css` | Stili co-locati del componente Reel |

**Nota**: come per Letterboxd, l'endpoint `api/lastfm.ts` reimplementa la logica di fetch e filtraggio inline, invece di importare `fetchRecentTracks()` dal service. Il service offre in piu' la validazione Zod.

## Dipendenze

| Pacchetto | Utilizzo |
| --- | --- |
| `astro` | Framework, routing, endpoint serverless |
| `astro:content` (zod) | Validazione schema nel service layer |

Nessuna dipendenza esterna aggiuntiva (a differenza di Letterboxd che richiede `xml2js`). L'API Audioscrobbler restituisce JSON direttamente.

## Env vars

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `LASTFM_API_KEY` | Si | API key per Last.FM / Audioscrobbler |

## Limiti e trade-off

- **Nessuna cache persistente**: come per Letterboxd, i dati vengono recuperati ad ogni richiesta (mitigato dal `max-age=900` HTTP).
- **Duplicazione logica**: l'endpoint `api/lastfm.ts` non utilizza il service `audioscrobbler.ts` che offre validazione Zod e tipizzazione. La logica di fetch e filtraggio e' duplicata.
- **Nessuna validazione nell'endpoint**: a differenza del service (che usa Zod), l'endpoint accede ai dati con `any` senza validazione.
- **Utente hardcoded**: `valerionar` e' hardcoded sia nell'endpoint che nel service.
- **Limite fisso a 20 tracce**: il parametro `limit=20` e' hardcoded. Non e' configurabile dal client.
- **Traccia in riproduzione**: se l'utente sta ascoltando un brano, `date` sara' `null` (il campo `date` e' assente nella risposta API per la traccia "now playing").
- **Immagine extralarge**: l'endpoint usa l'indice `[3]` dell'array immagini (dimensione "extralarge", ~300px). Non c'e' fallback se l'array ha meno di 4 elementi.
- **Filtro placeholder fragile**: l'URL dell'immagine placeholder Last.FM e' hardcoded. Se Last.FM cambia l'URL, il filtro smettera' di funzionare.
- **Typo nel service**: il tipo si chiama `AudioScubblerSchema` / `AudioScubblerResponse` (manca una "r" in "Scrobbler"). Impatto solo estetico, non funzionale.
