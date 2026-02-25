---
title: Come mostro gli ultimi film visti usando il feed RSS di Letterboxd
date: "2025-09-05"
extract: "Da filmmaker e cinefilo, volevo mostrare gli ultimi film visti sul mio sito personale. Invece di aggiornare manualmente una lista ogni volta che guardo qualcosa di nuovo, ho deciso di automatizzare il processo usando il feed RSS di Letterboxd e un po' di integrazione intelligente."
tags:
  - "letterboxd"
  - "movies"
  - "javascript"
coverImage: "/img/blog/how-i-display-my-latest-watched-movies-using-letterboxd-rss-feed/cmf6lzl380c4v07le5r2apkfc.png"
---

Da filmmaker e cinefilo, volevo mostrare gli ultimi film visti sul mio sito personale. Invece di aggiornare manualmente una lista ogni volta che guardo qualcosa di nuovo, ho deciso di automatizzare il processo usando il feed RSS di Letterboxd e un po' di integrazione intelligente.

## Il problema

Sono un utente attivo di Letterboxd, dove registro ogni film che guardo e assegno un voto. Però volevo che i visitatori del mio sito potessero vedere cosa ho guardato di recente, senza dover mantenere due liste separate — una su Letterboxd e un'altra sul mio sito.

## La soluzione

Ho costruito un sistema automatizzato che recupera gli ultimi film visti dal feed RSS di Letterboxd e li mostra sulla mia homepage, completi di locandina, voto e data di visione.

### Step 1: Accedere al feed RSS di Letterboxd

Letterboxd fornisce feed RSS per le attività degli utenti. L'URL del feed segue questo schema:
```
https://letterboxd.com/username/rss/
```

Questo feed contiene tutte le attività recenti, inclusi film visti, recensioni e voci del diario.

### Step 2: Parsing del feed RSS

Ho creato un service che recupera e analizza il contenuto XML da Letterboxd:

```javascript
export const getLetterboxdRss = async () => {
  const response = await fetch('https://letterboxd.com/valerionarcisi/rss/');
  return response;
};

export const parseXmlContent = async (xmlString) => {
  const parser = new xml2js.Parser();
  return new Promise((resolve, reject) => {
    parser.parseString(xmlString, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};
```

### Step 3: Estrarre le informazioni sui film

Il feed RSS include gli ID TMDb (The Movie Database) per ogni film, che uso per recuperare dettagli aggiuntivi come locandine in alta qualità e valutazioni:

```javascript
const lastWatchedMovies = async () => {
  const xml = await getLetterboxdRss();
  const parsedXml = await parseXmlContent(await xml.text());

  const moviePromises = parsedXml.rss.channel[0].item
    .filter((item) => item?.["tmdb:movieId"]?.[0])
    .map(async (item) => {
      try {
        const movie = await getMovieById(item["tmdb:movieId"][0]);
        return { ...movie, ...item };
      } catch (error) {
        console.error(`Failed to fetch movie with ID ${item["tmdb:movieId"][0]}`, error);
        return null;
      }
    });

  const watchedMovies = await Promise.all(moviePromises);
  return watchedMovies.filter(Boolean);
};
```

### Step 4: Mostrare i film

Ho creato un componente `Reel` personalizzato che mostra ogni film con:
- Locandina del film da TMDb
- Titolo da Letterboxd
- Il mio voto (vote_average)
- Data di visione
- Link alla mia recensione su Letterboxd

Il componente gestisce la presentazione visiva con effetti hover e design responsive.

### Step 5: Ottimizzazione delle performance

Per garantire caricamenti rapidi:
- **Chiamate API in parallelo** usando `Promise.all()`
- **Cache delle risposte TMDb** per evitare di superare i rate limit
- **Gestione errori elegante** quando i dati del film non sono disponibili
- **Ottimizzazione immagini** usando l'ottimizzazione integrata di Astro

## Il risultato

Ora la mia homepage mostra automaticamente gli ultimi film visti in un elegante carosello a scorrimento orizzontale. I visitatori possono vedere cosa ho guardato, i miei voti, e cliccare per leggere le mie recensioni complete su Letterboxd.

Questa integrazione mantiene il mio sito dinamico e personale senza richiedere alcuna manutenzione manuale. Ogni volta che registro un film su Letterboxd, appare automaticamente sul mio sito nel giro di pochi minuti.

## Vantaggi tecnici

- **Aggiornamento automatico dei contenuti** — Nessun intervento manuale necessario
- **Sincronizzazione in tempo reale** — I nuovi film appaiono automaticamente
- **Metadati ricchi** — Combina i dati di Letterboxd con i dettagli di TMDb
- **Performance ottimizzate** — Chiamate API in parallelo e gestione errori
- **Mobile responsive** — Funziona perfettamente su tutti i dispositivi

Questo approccio dimostra come i feed RSS possano ancora essere strumenti potenti per la distribuzione di contenuti e l'automazione di siti personali nel 2025. A volte le soluzioni più semplici sono le più efficaci!

*Vuoi vederlo in azione? Dai un'occhiata alla sezione "Last watched movies" sulla mia homepage, oppure sfoglia il mio diario cinematografico completo su [Letterboxd](https://letterboxd.com/valerionarcisi/).*