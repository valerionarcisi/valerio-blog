---
title: Come mostro le mie attività Strava sul mio sito usando le API di Strava
date: "2026-03-09"
extract: "Volevo mostrare le mie attività sportive sul mio sito personale. Invece di usare widget embed, ho integrato le API di Strava per fetchare i dati a build time con Astro."
tags:
  - "javascript"
  - "astro"
  - "how-to"
coverImage: "https://images.unsplash.com/photo-1748252011080-2c1b4fca6388?w=1200"
coverAuthorName: "Karla Arróniz"
coverAuthorLink: "https://unsplash.com/@karlaarroniz"
---

Lo sport è una parte importante della mia routine. Corro, cammino, mi alleno — e registro tutto su Strava. Volevo che queste attività apparissero anche sul mio sito personale, accanto ai film visti e alla musica ascoltata, per dare ai visitatori un'istantanea più completa della mia quotidianità.

## Il problema

Strava offre widget embed, ma sono poco personalizzabili e non si integrano bene con il design del sito. Volevo qualcosa che si fondesse con il look esistente — le stesse card orizzontali scrollabili che uso per film e musica — e che si aggiornasse automaticamente ad ogni build.

## La soluzione

Ho costruito un'integrazione che usa le API di Strava per recuperare le attività recenti a build time con Astro e mostrarle in card compatte nella homepage.

### Step 1: Creare l'app su Strava

Per accedere alle API serve registrare un'applicazione su [Strava Settings](https://www.strava.com/settings/api). Servono:

1. Un account Strava
2. Nome dell'app, categoria, sito web e dominio di callback
3. L'icona dell'app (obbligatoria per ottenere le credenziali)

Una volta creata, Strava fornisce **Client ID**, **Client Secret** e un primo **Access Token** con scope limitato.

### Step 2: Ottenere il Refresh Token con lo scope corretto

L'access token iniziale ha solo lo scope `read`, che non basta per leggere le attività. Serve lo scope `activity:read_all`. Per ottenerlo bisogna passare attraverso il flusso di autorizzazione OAuth:

```
https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&scope=activity:read_all
```

Dopo aver autorizzato, Strava redirige a `localhost` con un `code` nell'URL. Questo codice va scambiato per un refresh token con una richiesta POST:

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=AUTHORIZATION_CODE \
  -d grant_type=authorization_code
```

Il `refresh_token` nella risposta è quello da salvare nelle variabili d'ambiente.

### Step 3: Creare il service per le API

Ho creato `src/services/strava.ts` che gestisce il refresh del token e il recupero delle attività:

```typescript
const refreshAccessToken = async (): Promise<string> => {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: import.meta.env.STRAVA_CLIENT_ID,
      client_secret: import.meta.env.STRAVA_CLIENT_SECRET,
      refresh_token: import.meta.env.STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  return data.access_token;
};
```

Il token di accesso di Strava scade dopo 6 ore, ma il refresh token è permanente. Ad ogni build il service rinnova il token e recupera le attività:

```typescript
export const fetchRecentActivities = async (count = 5) => {
  const accessToken = await refreshAccessToken();
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${count}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const activities = await response.json();
  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    sportType: a.sport_type,
    date: a.start_date,
    distance: a.distance,
    movingTime: a.moving_time,
    elevation: a.total_elevation_gain,
    averageSpeed: a.average_speed,
    url: `https://www.strava.com/activities/${a.id}`,
  }));
};
```

### Step 4: Formattare i dati

Il service include helper per formattare distanza, durata e passo in modo leggibile:

```typescript
export const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

export const formatPace = (speedMs: number, type: string): string => {
  if (type === "WeightTraining" || speedMs === 0) return "";
  const paceMinPerKm = 1000 / 60 / speedMs;
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
};
```

Ogni tipo di attività ha un colore associato — arancione per la corsa, viola per i pesi, blu per la bici — mostrato come un piccolo dot colorato nella card.

### Step 5: Il componente ActivityCard

Ho creato un componente Astro compatto che mostra ogni attività in una card verticale:

- Dot colorato con il tipo di attività
- Nome dell'allenamento
- Statistiche: distanza, durata, passo e dislivello
- Data dell'attività
- Link diretto a Strava

Il componente è inserito in un container scrollabile orizzontalmente (lo stesso usato per film e musica), così le card sono sfogliabili con lo swipe senza occupare troppo spazio verticale.

### Step 6: Integrazione nella homepage

Nella homepage le attività vengono recuperate in parallelo con film e musica usando `Promise.all`, con un `.catch(() => [])` per non bloccare il rendering se Strava è irraggiungibile:

```typescript
const [lastWatched, lastSongs, lastActivities] = await Promise.all([
  lastWatchedMovies(),
  fetchRecentTracks(),
  fetchRecentActivities(5).catch(() => []),
]);
```

La sezione appare solo se ci sono attività da mostrare, grazie a un semplice check sulla lunghezza dell'array.

## Il risultato

La homepage ora mostra tre sezioni multimediali — film, musica e sport — che danno un quadro completo della mia quotidianità. Le card delle attività sportive si integrano perfettamente con il design esistente e si aggiornano ad ogni build.

## Variabili d'ambiente

Per replicare l'integrazione servono tre variabili:

- `STRAVA_CLIENT_ID` — Il Client ID dell'app
- `STRAVA_CLIENT_SECRET` — Il Client Secret dell'app
- `STRAVA_REFRESH_TOKEN` — Il refresh token con scope `activity:read_all`

## Lezioni apprese

- Lo scope `read` iniziale di Strava **non** include le attività. Serve `activity:read_all`
- Il flusso OAuth richiede un passaggio manuale una tantum, ma poi il refresh token funziona indefinitamente
- Recuperare i dati a build time con Astro è la soluzione più semplice: nessun client-side fetch, nessun CORS, nessun rate limit a runtime

_Vuoi vedere le mie attività recenti? Dai un'occhiata alla sezione "Ultime attività sportive" sulla mia homepage, oppure seguimi su [Strava](https://www.strava.com)._
