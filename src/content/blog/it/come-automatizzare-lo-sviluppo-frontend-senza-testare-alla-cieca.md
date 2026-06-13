---
title: "Come automatizzare lo sviluppo frontend senza testare alla cieca"
date: "2026-06-13"
extract: "Nel frontend il punto di verifica è più ambiguo che nel backend. Abbiamo costruito un design gate in due passaggi: Chrome DevTools per capire, Playwright per impedire alle regressioni di tornare."
tags:
  - "frontend"
  - "testing"
  - "playwright"
  - "ai"
coverImage: "/img/blog/come-automatizzare-lo-sviluppo-frontend-senza-testare-alla-cieca/cover.jpg"
coverDescription: "Illustrazione di un browser misurato con guide geometriche e bloccato da un test automatico"
---

Nel backend il punto di verifica è spesso netto. Una funzione restituisce il valore giusto oppure no. Un endpoint risponde con lo status atteso oppure fallisce. Il database contiene una riga oppure non la contiene.

Nel frontend è più complicato. Un'interfaccia può essere formalmente corretta e allo stesso tempo risultare sbagliata: un pulsante è nel DOM ma finisce fuori dallo schermo, un elemento sembra cliccabile ma un layer trasparente intercetta il click, una modale ha `position: fixed` ma si muove insieme a un antenato. Anche la UX può funzionare senza essere quella che avevamo progettato.

Per molto tempo abbiamo trattato questo problema come un problema di test. Poi abbiamo capito che era prima di tutto un problema di **osservazione**. Stavamo chiedendo agli strumenti di bloccare una regressione prima ancora di aver capito che cosa stesse succedendo nell'interfaccia.

Da qui è nato il nostro design gate in due passaggi: prima usiamo Chrome DevTools per diagnosticare il comportamento reale, poi Playwright per congelare la proprietà che abbiamo scoperto. Lo screenshot rimane, ma smette di portare da solo tutto il peso della verifica.

## Il tentativo di automatizzare subito

Il nostro obiettivo iniziale era semplice: fare in modo che anche un agente potesse sviluppare e verificare il frontend senza costringerci a controllare manualmente ogni modifica.

Per questo stavamo sperimentando **chrome-agent**, uno strumento di browser automation pensato per gli agenti. Può aprire pagine, ispezionare la struttura accessibile, trovare elementi, cliccare, compilare campi, leggere il testo e acquisire screenshot. È utile perché trasforma molte operazioni del browser in comandi strutturati e relativamente economici da inserire nel contesto di un modello.

Lo stavamo testando insieme a Playwright per chiudere l'intero loop: modifica del codice, apertura dell'applicazione, interazione con la pagina e verifica del risultato. Sulla carta sembrava sufficiente. Nella pratica continuavamo ad avere un problema: gli strumenti sapevano eseguire azioni, ma non sempre riuscivano a spiegare **perché** l'interfaccia fosse sbagliata.

Playwright poteva dirci che un click non funzionava. chrome-agent poteva mostrarci gli elementi disponibili o produrre uno screenshot. Ma tra il sintomo e la causa restava uno spazio vuoto. Finivamo così per accumulare screenshot, formulare ipotesi dal sorgente e, alla fine, aprire personalmente Chrome per fare il controllo che volevamo automatizzare.

Il loop era diventato più automatico nell'esecuzione, non nella comprensione.

## Abbiamo replicato quello che facevamo manualmente

La svolta è arrivata osservando il nostro comportamento durante una normale sessione di sviluppo frontend.

Quando qualcosa non torna, non scriviamo subito un test E2E. Apriamo il browser, guardiamo la pagina e iniziamo a fare domande concrete. Dove si trova davvero l'elemento? Quale layer riceve il click? Qual è il valore risolto di `pointer-events`? C'è un `transform` su un antenato che ha cambiato il riferimento di un elemento fixed?

Poi modifichiamo il codice, ricarichiamo e controlliamo di nuovo. Il ciclo reale è:

```text
osserva -> misura -> correggi -> ri-misura
```

Abbiamo quindi dato agli agenti lo stesso processo. Non solo un browser da comandare, ma Chrome DevTools per interrogare la pagina dal vivo e gli screenshot come occhi per verificare il risultato complessivo.

Questo ha anche spostato più avanti la fase di test. Prima comprendiamo il comportamento; solo dopo decidiamo quale proprietà merita di diventare permanente.

## Primo passaggio: Chrome DevTools come scalpello

Chrome DevTools è il nostro strumento di diagnosi. Lavora su Chrome reale e ci permette di misurare il comportamento che il browser ha effettivamente calcolato, non quello che immaginiamo leggendo CSS e componenti.

Le verifiche più utili sono spesso molto semplici:

- `getBoundingClientRect()` ci dice dove si trova un elemento, quanto misura e se ha coordinate negative o finisce fuori dal viewport;
- `elementFromPoint(x, y)` esegue un hit-test reale e rivela quale elemento si trova davvero sotto il punto del click;
- `getComputedStyle()` restituisce valori risolti come `z-index`, `pointer-events`, `position` e `transform`;
- risalire gli antenati permette di trovare un `transform`, un `filter` o un'altra proprietà che cambia il comportamento di `position: fixed`.

Questi controlli producono numeri e valori confrontabili. Non diciamo più "la modale sembra spostata". Possiamo dire che il suo bordo destro è 84 pixel oltre il viewport. Non diciamo "il bottone non prende il click". Possiamo vedere che, in quelle coordinate, `elementFromPoint()` restituisce l'overlay.

Il loop resta volutamente esplorativo: misura, fallisce, modifica, ri-misura. Le query usate durante la diagnosi sono usa-e-getta e non vengono committate. Chrome DevTools è lo **scalpello**: rapido, preciso e senza boilerplate. Proprio per questo non è la nostra CI. Una sessione interattiva non è una garanzia ripetibile.

## Gli screenshot sono gli occhi, non la diagnosi

Non abbiamo eliminato gli screenshot. Abbiamo smesso di usarli per rispondere a domande per cui non sono lo strumento giusto.

Uno screenshot è ottimo per valutare composizione, gerarchia, spaziatura e risultato complessivo. È molto meno efficace per stabilire quale layer intercetti un click o perché un elemento fixed abbia cambiato sistema di riferimento. Per quello servono il DOM e i valori calcolati dal browser.

La distinzione riduce anche il contesto necessario agli agenti. Un'immagine completa deve essere codificata e analizzata come input visivo; una risposta strutturata con quattro coordinate, il nome di un elemento e alcuni computed styles occupa in genere molto meno spazio.

Non abbiamo ancora un benchmark controllato da pubblicare, quindi non vogliamo trasformare questa osservazione in una percentuale scientifica. Come ordine di grandezza operativo, nei loop con molti controlli intermedi stimiamo un risparmio del **70-95% dei token dedicati alla diagnosi**, soprattutto quando dieci screenshot vengono sostituiti da dieci misure testuali e da un solo screenshot finale. Il risultato varia con risoluzione, modello e quantità di dati estratti, ma la direzione è chiara: prima chiediamo al browser pochi fatti, poi usiamo l'immagine per confermare l'insieme.

## Secondo passaggio: Playwright come morsa

Quando le misure sono corrette e lo screenshot mostra il risultato atteso, il lavoro esplorativo è finito. A quel punto entra Playwright.

Scriviamo un test E2E sulla proprietà misurabile emersa durante la diagnosi: l'elemento deve rimanere nel viewport, l'hit-test in una coordinata deve raggiungere il pulsante, la modale deve essere l'ultimo elemento del contenitore oppure un controllo deve restare cliccabile dopo l'apertura di un overlay.

Playwright è la **morsa**. È più goffo dello scalpello durante l'esplorazione, ma mantiene la proprietà ferma nel tempo. Il test resta nel repository, gira in CI e può essere eseguito su più browser.

La sequenza è importante. Solo Playwright ci costringerebbe a indovinare l'asserzione mentre stiamo ancora cercando la causa. Solo Chrome DevTools risolverebbe il problema presente senza impedire che ritorni. La separazione tra diagnosi e blocco non è un dettaglio del processo: è il design gate.

## Per i fix visivi non facciamo test-first

Per la logica pura continuiamo a considerare il test-first una pratica efficace. Se conosciamo input, output e invarianti, possiamo descrivere il comportamento prima dell'implementazione.

Un fix visivo o geometrico parte spesso da una condizione diversa: non conosciamo ancora l'invariante giusta. Sappiamo che qualcosa non funziona, ma non sappiamo se il test debba controllare le coordinate, l'ordine nel DOM, il risultato dell'hit-test o una proprietà risolta.

Scrivere il test in quel momento significa codificare un'ipotesi. Chrome DevTools fa emergere il fatto misurabile; Playwright lo trasforma in contratto. Il test E2E non scopre il bug: **lo congela dopo che la diagnosi lo ha trovato**.

## Red-on-old obbligatorio

Prima di committare verifichiamo che il nuovo test protegga davvero dal comportamento precedente.

Mettiamo temporaneamente da parte il fix, eseguiamo il test e lo vediamo fallire. Poi ripristiniamo la modifica e lo vediamo passare. È il controllo red-on-old: rosso sul vecchio comportamento, verde sul nuovo.

Un test verde in entrambi gli stati non dimostra nulla. Potrebbe interrogare l'elemento sbagliato, usare un'asserzione troppo permissiva o verificare una proprietà che non dipende dal fix. Il passaggio costa normalmente meno di un minuto e separa un regression test da semplice codice di test.

## Dal design gate al ciclo build, verify, ship

Il design gate vive dentro un ciclo di delivery più ampio:

```text
develop
  -> Chrome DevTools: misura dal vivo
  -> fallisce? fix e ri-misura
  -> ok: screenshot
  -> Playwright: red-on-old, poi green-on-new
  -> typecheck, lint e CI
  -> review del diff
  -> commit
```

Manteniamo WIP=1: un solo fronte aperto fino al merge. Prima di ogni commit facciamo code review sul diff, non sulla memoria di ciò che pensiamo di aver cambiato. La definition of done richiede test ai layer appropriati, E2E eseguiti per primi, screenshot nel recap, gate verdi e stato aggiornato nel backlog.

Spec, backlog e learnings conservano le decisioni. La chat resta un ambiente di lavoro temporaneo: quando un item è chiuso, puliamo il contesto e passiamo al successivo. In questo modo non chiediamo a una conversazione sempre più lunga di diventare il database del progetto.

Automatizzare lo sviluppo frontend, per noi, non ha significato eliminare lo sguardo umano. Ha significato scomporlo: gli screenshot danno agli agenti gli occhi, Chrome DevTools fornisce le misure e Playwright impedisce al comportamento corretto di scappare. Prima capiamo. Poi blocchiamo. Solo allora spediamo.
