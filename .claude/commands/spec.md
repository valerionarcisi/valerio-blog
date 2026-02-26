Brainstorming e specifica di una nuova feature per valerionarcisi.me.

Quando l'utente propone un'idea o una feature:

1. **Analizza il contesto**: leggi il codebase per capire cosa esiste gia (stack, pattern, componenti, API, DB)
2. **Ricerca**: se serve, cerca online come funzionano servizi/tool simili per capire cosa clonare o adattare
3. **Discuti con l'utente**: fai domande per chiarire scope, priorita e vincoli prima di scrivere
4. **Scrivi la spec** in `docs/{feature-name}-spec.md` con questa struttura:

```
# {Feature Name} — Spec

## Obiettivo
Cosa fa e perche serve.

## Architettura
Diagramma ASCII del flusso dati e componenti coinvolti.

## Dati / Schema DB
Tabelle, campi, indici. Stima dimensioni se rilevante.

## API Endpoints
Per ogni endpoint: method, path, request/response body, logica, autenticazione.

## Componenti UI
Layout, comportamento, interazioni. Mockup ASCII se utile.

## File da creare/modificare
Tabella con file, azione (crea/modifica), scopo.

## Dipendenze
Nuove librerie necessarie (con versione pinned). Preferire zero dipendenze.

## Env vars
Nuove variabili d'ambiente necessarie.

## Ordine implementazione
Lista numerata dei passi.

## Limiti e trade-off
Cosa non fa, compromessi accettati, possibili evoluzioni future.
```

5. Mostra la spec all'utente per review
6. NON iniziare a scrivere codice finche l'utente non approva la spec
