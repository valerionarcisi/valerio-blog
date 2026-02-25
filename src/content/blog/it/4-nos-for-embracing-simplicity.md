---
title: "4 No per abbracciare la semplicità"
date: "2024-11-20"
extract: "Nella mia ricerca di costruire un blog più efficiente, ho imparato l'importanza della semplicità e dell'adattabilità. Dicendo \"No\" a strumenti complessi come vanilla-extract ed effect-ts, e abbracciando soluzioni dirette come CSS globale, zod per la validazione e HyGraph per la gestione dei contenuti, ho snellito il mio processo di sviluppo. Condivido le lezioni apprese e i cambiamenti fatti per migliorare la mia esperienza di blogging."
tags:
  - "CSS"
  - "vanilla-extract"
  - "effect-ts"
coverImage: "/img/blog/4-nos-for-embracing-simplicity/aeaJy4qSTkOGHzZVZFqV.jpg"
---

Il mio prodotto è un blog — un semplice blog — e ha le sue esigenze.

Qui sotto una breve lista di "No!" che mi sono detto per costruire un rapporto migliore con esso.

## No vanilla-extract!

Prima di tutto, ho eliminato [vanilla-extract](https://vanilla-extract.style/) perché aggiornare il mio CSS era diventato troppo complesso. Al suo posto, ho creato un file CSS globale dove ho definito la mia palette colori e incluso tutto ciò di cui il mio blog ha bisogno.

Poi ho iniziato a usare classi annidate per stilizzare i miei componenti Astro. *Keep it simple, stupid.*

```jsx
.Card {
  ...,
  .title,
  .description,
  .date,
  .tags {
    margin-bottom: var(--space-medium);
  }
  .info {
    padding: var(--space-medium) 0;
  }

  h3 {
    margin-bottom: 0;
    font-size: var(--fontSize-large);
  }
...
}
```

Pensavo che i preprocessor CSS fossero essenziali per le librerie, ma ora, con funzionalità come [@layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) e [@scope](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope), il loro vantaggio principale è facilitare una migliore comunicazione tra i membri del team — principalmente grazie all'integrazione con TypeScript.

## No Effect-ts!

Era un ottimo modo di lavorare, ma era diventato troppo complesso aggiornare la mia logica. Volevo espandere le sezioni *Last Watched Movie* e *Last Listened Song*, ma aggiornarle era diventato eccessivamente difficile.

Sebbene [effect-ts](https://effect.website/) sia fantastico per prevenire errori — ti obbliga a gestire ogni caso d'uso, inclusa la promise restituita dal metodo `.json()` — per me era diventato troppo difficile da mantenere.

Quindi sono passato a [zod](https://zod.dev/) per una semplice validazione dei payload. Tutto qui. Niente di più, niente di meno.

## No React-js!

Mentre usavo componenti React all'interno di Astro, ho scoperto che Astro inietta JavaScript in questi componenti, il che a volte può portare a tempi di caricamento più lunghi e maggiore complessità.

Il risultato è stato il passaggio dall'80% al 100% nelle performance.

![Screenshot 2024-11-20 at 17.59.30.png](/img/blog/4-nos-for-embracing-simplicity/nrFSQNfqTfiMepOCUWkf.png)
![Screenshot 2024-11-20 at 17.59.24.png](/img/blog/4-nos-for-embracing-simplicity/BTNPkrLITOySbYoemdtB.png)

## No Markdown!

Scrivere in Markdown era diventato un ostacolo per me, e il mio flusso era il seguente:

- Creare una prima bozza su Notion
- Esportare il post da Notion come markdown
- Sistemare il Markdown affinché Astro potesse leggerlo senza errori
- Controllare il risultato
- Pushare su GitHub

Ora sono passato a [HyGraph](https://hygraph.com/) e l'ho collegato al mio sito Astro. HyGraph mi offre 100GB di spazio e il controllo completo sullo schema dei post. Posso usare [GraphQL](https://graphql.org/), ma l'unico svantaggio è che l'esportazione richiede uno script che devo costruirmi da solo.

Dopo il collegamento, ho creato una piccola GitHub Action per eseguire due build al giorno, collegata esclusivamente a HyGraph.

```jsx
// .github/workflows/netlify-build.yml

name: Trigger Netlify Build

on:
  schedule:
    - cron: '0 12 * * *'
    - cron: '0 18 * * *'

jobs:
  trigger-build:
    runs-on: ubuntu-latest

    steps:
      - name: Trigger build to Netlify
        run: |
          curl -X POST -d '{}' https://api.netlify.com/build_hooks/67362820c0646f083c57490e
```

## Conclusione

Nel costruire il mio blog, ho imparato il valore della semplicità e dell'adattabilità. Dicendo "No" agli strumenti che complicavano il mio flusso di lavoro, ho creato un'esperienza di sviluppo più efficiente.

Passare da `vanilla-extract` a un file CSS globale, da `effect-ts` a `zod` per la validazione, abbracciare Astro per la generazione di siti statici e integrare HyGraph per la gestione dei contenuti, mi ha aiutato a concentrarmi sulle reali esigenze del mio blog.

Spero che il mio percorso risuoni con chi affronta sfide simili. Grazie per la lettura, e non esitate a contattarmi per qualsiasi domanda!