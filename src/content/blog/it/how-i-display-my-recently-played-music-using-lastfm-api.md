---
title: Come mostro la musica ascoltata di recente usando le API di Last.fm
date: "2025-09-05"
extract: "La musica è una compagna costante nella mia vita, soprattutto durante il mio lavoro come sviluppatore e filmmaker. Volevo condividere il mio percorso musicale con i visitatori del mio sito, mostrando automaticamente cosa ho ascoltato di recente, senza la seccatura degli aggiornamenti manuali."
tags:
  - "lastfm"
  - "javascript"
  - "music"
coverImage: "/img/blog/how-i-display-my-recently-played-music-using-lastfm-api/cmf6m7ms30hr707leynw5nthm.png"
---

La musica è una compagna costante nella mia vita, soprattutto durante il mio lavoro come sviluppatore e filmmaker. Volevo condividere il mio percorso musicale con i visitatori del mio sito, mostrando automaticamente cosa ho ascoltato di recente, senza la seccatura degli aggiornamenti manuali.

## Il problema

Sono un ascoltatore accanito che usa Last.fm per tracciare le proprie abitudini di ascolto su tutte le piattaforme — Spotify, Apple Music, YouTube Music, e chi più ne ha più ne metta. Last.fm crea uno storico completo di tutto ciò che ascolto, ma volevo che questi dati vivessero anche sul mio sito personale, creando un ritratto più completo dei miei interessi e della mia quotidianità.

## La soluzione

Ho costruito un sistema automatizzato che recupera le tracce recenti dalle API di Last.fm e le mostra sulla mia homepage accanto ai film visti, creando un'istantanea multimediale dei miei interessi attuali.

### Step 1: Configurazione delle API Last.fm

Last.fm fornisce API robuste per accedere ai dati degli utenti. Per iniziare servono:
1. Un account Last.fm con lo scrobbling abilitato
2. Una API key dal portale sviluppatori di Last.fm
3. Il proprio username

L'endpoint per le tracce recenti segue questo schema:
```
https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=USERNAME&api_key=API_KEY&format=json
```

### Step 2: Recuperare le tracce recenti

Ho creato un service che gestisce le chiamate API e l'elaborazione dei dati:

```javascript
export const fetchRecentTracks = async (limit = 10) => {
  const API_KEY = import.meta.env.LASTFM_API_KEY;
  const USERNAME = 'valerionarcisi';

  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${USERNAME}&api_key=${API_KEY}&format=json&limit=${limit}`
    );

    const data = await response.json();
    return data.recenttracks?.track || [];
  } catch (error) {
    console.error('Error fetching Last.fm data:', error);
    return [];
  }
};
```

### Step 3: Elaborare i dati delle tracce

Le API di Last.fm restituiscono metadati ricchi per ogni traccia, tra cui:
- Titolo del brano e nome dell'artista
- Informazioni sull'album e copertina
- Timestamp di riproduzione (o stato "now playing")
- Link alle pagine Last.fm

Elaboro questi dati per estrarre ciò che serve per la visualizzazione:

```javascript
const processTrackData = (tracks) => {
  return tracks.map(track => ({
    name: track.name,
    artist: track.artist['#text'] || track.artist.name,
    album: track.album['#text'],
    image: track.image[3]['#text'], // Large image size
    url: track.url,
    date: track.date ? track.date['#text'] : 'Now Playing',
    isNowPlaying: track['@attr']?.nowplaying === 'true'
  }));
};
```

### Step 4: Mostrare la musica

Ho creato un componente `Reel` (lo stesso usato per i film) che mostra ogni traccia con:
- Copertina dell'album come immagine principale
- Titolo del brano e nome dell'artista
- Nome dell'album
- Data di riproduzione o indicatore "Now Playing"
- Link alla traccia su Last.fm

Il componente include un indicatore speciale per le tracce in riproduzione e fallback eleganti per le copertine mancanti.

### Step 5: Performance e affidabilità

Per garantire un'esperienza utente fluida:
- **Cache delle API** per rispettare i rate limit di Last.fm
- **Immagini di fallback** quando la copertina dell'album non è disponibile
- **Gestione errori** per problemi di rete o downtime delle API
- **Stati di caricamento** durante il recupero dei dati
- **Esecuzione parallela** con il recupero dei dati dei film

## Il risultato

La mia homepage ora mostra un feed in tempo reale dei miei gusti musicali accanto alle mie abitudini cinematografiche. I visitatori possono vedere cosa sto ascoltando al momento, scoprire nuova musica attraverso i miei ascolti recenti, e farsi un'idea più completa dei miei interessi culturali.

L'integrazione si aggiorna in tempo reale, quindi se sto ascoltando musica attivamente, compare come "Now Playing" sul mio sito. È come avere una radio personale che riflette le mie reali abitudini di ascolto.

## Perché Last.fm?

A differenza delle API di Spotify che mostrano solo le tracce recenti dalla loro piattaforma, Last.fm aggrega i dati di ascolto da più fonti:
- Spotify, Apple Music, YouTube Music
- Player musicali locali come iTunes o Foobar2000
- Dischi in vinile (con scrobbling manuale)
- Concerti dal vivo e DJ set

Questo dà un quadro più completo della mia vita musicale, non solo di ciò che streamo su un singolo servizio.

## Vantaggi tecnici

- **Tracciamento musicale universale** — Funziona su tutte le piattaforme
- **Metadati ricchi** — Informazioni dettagliate su traccia, artista e album
- **Aggiornamenti in tempo reale** — Mostra l'attività di ascolto corrente
- **Dati storici** — Accesso allo storico completo degli ascolti
- **Funzionalità community** — Link a Last.fm per la scoperta musicale

## Il tocco personale

La musica è qualcosa di profondamente personale, e mostrare le mie tracce recenti aggiunge autenticità al mio sito. Dimostra che non sono solo uno sviluppatore che programma in silenzio — sono una persona che trova ispirazione nei Radiohead, si motiva con la musica elettronica, e ogni tanto si concede qualche piacere colpevole pop.

Questa integrazione rappresenta un altro tassello del puzzle nel creare un sito veramente personale che riflette chi sono al di là del mio lavoro professionale.

*Vuoi vedere cosa sto ascoltando adesso? Dai un'occhiata alla sezione "Last Listened songs" sulla mia homepage, oppure segui il mio percorso musicale completo su [Last.fm](https://last.fm/user/valerionarcisi).*