---
title: "Come automatizzare lo sviluppo frontend senza testare alla cieca"
date: "2026-06-13"
extract: "Nel frontend non basta sapere che qualcosa non funziona. Prima misuriamo il problema con Chrome DevTools, poi usiamo Playwright per impedirgli di tornare."
tags:
  - "frontend"
  - "testing"
  - "playwright"
  - "ai"
coverImage: "/img/blog/come-automatizzare-lo-sviluppo-frontend-senza-testare-alla-cieca/cover.jpg"
coverDescription: "Illustrazione di un browser misurato con guide geometriche e bloccato da un test automatico"
---

Nel backend verificare una modifica è spesso semplice: una funzione restituisce il valore giusto, un endpoint risponde oppure una riga esiste nel database.

Nel frontend è diverso. Un pulsante può essere nel DOM ma fuori dallo schermo. Può sembrare cliccabile mentre un layer trasparente intercetta il click. Una modale può essere `fixed` e muoversi con un antenato.

Per molto tempo abbiamo trattato questi casi come problemi di test. In realtà erano prima di tutto problemi di **osservazione**.

## Prima capire, poi testare

Gli strumenti di browser automation sanno aprire pagine, cliccare e acquisire screenshot. Playwright sa dirci che un'interazione fallisce. Ma il sintomo non spiega sempre la causa.

Uno screenshot può mostrare una modale fuori posto, ma non dice quale regola CSS la sposta. Un click fallito non rivela automaticamente quale elemento lo ha intercettato.

Il processo che funziona è lo stesso che usiamo manualmente:

```text
osserva -> misura -> correggi -> ri-misura
```

Solo quando abbiamo capito il comportamento decidiamo quale proprietà trasformare in un test permanente.

## Chrome DevTools per diagnosticare

Chrome DevTools misura ciò che il browser ha davvero calcolato, non ciò che immaginiamo leggendo il codice.

- `getBoundingClientRect()` mostra posizione e dimensioni reali;
- `elementFromPoint(x, y)` rivela quale elemento riceve il click;
- `getComputedStyle()` restituisce valori risolti come `z-index`, `pointer-events` e `transform`;
- risalire gli antenati aiuta a trovare proprietà che alterano `position: fixed`.

Così "la modale sembra spostata" diventa "il bordo destro supera il viewport di 84 pixel". E "il pulsante non funziona" diventa "in quel punto il click raggiunge l'overlay".

Queste misure sono rapide e usa-e-getta. Servono a trovare la causa, non a sostituire i test.

## Lo screenshot conferma il risultato

Gli screenshot restano utili per composizione, gerarchia, spaziatura e resa complessiva. Non sono però lo strumento migliore per analizzare hit-test, stacking context o valori CSS risolti.

Separare i due compiti riduce anche il contesto necessario agli agenti. Poche coordinate e alcuni computed styles costano molto meno di una sequenza di immagini complete.

Non abbiamo un benchmark scientifico. Nei nostri loop stimiamo però un risparmio del **70-95% dei token di diagnosi** quando molti screenshot intermedi diventano misure testuali e una sola immagine finale.

## Playwright impedisce alla regressione di tornare

Quando il problema è chiaro e il risultato visivo è corretto, scriviamo il test E2E.

Il test verifica la proprietà scoperta durante la diagnosi: l'elemento resta nel viewport, il click raggiunge il controllo giusto oppure la modale mantiene la posizione attesa.

L'ordine conta. Solo Playwright ci costringerebbe a indovinare l'asserzione mentre cerchiamo ancora la causa. Solo DevTools risolverebbe il problema di oggi senza proteggerci da quello di domani.

Per i fix visivi, quindi, non partiamo dal test. Prima troviamo l'invariante corretta, poi la trasformiamo in un contratto.

## Red-on-old, poi si spedisce

Prima del commit verifichiamo che il nuovo test fallisca senza il fix e passi con il fix. È il controllo **red-on-old**.

Un test verde in entrambi gli stati non protegge nulla: potrebbe colpire l'elemento sbagliato o usare un'asserzione troppo permissiva.

Il nostro design gate è semplice:

```text
misura con DevTools
  -> correggi e ri-misura
  -> controlla lo screenshot
  -> verifica red-on-old con Playwright
  -> esegui i gate e fai review
  -> commit
```

Automatizzare il frontend non significa eliminare lo sguardo umano. Significa renderlo ripetibile: DevTools trova la causa, lo screenshot conferma il risultato e Playwright impedisce alla regressione di tornare.
