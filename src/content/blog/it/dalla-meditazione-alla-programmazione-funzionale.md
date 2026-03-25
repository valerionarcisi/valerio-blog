---
title: "Dalla meditazione alla programmazione funzionale: Result, Pipe e la domanda scomoda sui framework"
date: "2026-03-25"
extract: "Volevo solo tracciare le mie sessioni di meditazione. Ho finito per ripensare come scrivo codice, adottando pattern funzionali come Result e Pipe. E mi sono posto una domanda scomoda."
tags:
  - "javascript"
  - "typescript"
  - "programmazione-funzionale"
  - "astro"
  - "meditazione"
coverImage: "/img/blog/dalla-meditazione-alla-programmazione-funzionale/cover.jpg"
coverAuthorName: "Luca Bravo"
coverAuthorLink: "https://unsplash.com/@lucabravo"
---

Tutto è partito da un bisogno semplice: volevo meditare ogni giorno e tenerne traccia.

Ho costruito una pagina nel mio sito — un timer, una heatmap stile GitHub, qualche statistica. All'inizio i dati stavano in `localStorage`. Funzionava, finché non ho provato ad aprire la pagina dal telefono: niente. I dati erano rimasti nel browser del portatile. Ovvio, col senno di poi.

Così ho spostato tutto su Turso, un database SQLite edge, con endpoint API per leggere e scrivere le sessioni. E qui è iniziato il vero viaggio.

## Il caos degli endpoint

Il primo endpoint per salvare una sessione di meditazione l'ho scritto come scrivo sempre codice server in TypeScript:

```typescript
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, duration_min, session_type } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "Valid date required" }),
        { status: 400 }
      );
    }

    await db.execute({
      sql: "INSERT INTO meditation_sessions ...",
      args: [date, duration_min ?? 0, session_type ?? null],
    });

    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500 }
    );
  }
};
```

Funziona. Ma poi ho aggiunto l'endpoint per i commenti. Poi quello per il form di contatto. Poi quello per il bot admin. E mi sono ritrovato con quattro file che facevano tutti la stessa cosa: `try/catch`, validazione inline, `new Response(JSON.stringify(...))` copia-incollato ovunque.

Il codice era corretto ma **fragile**. Ogni endpoint era un mondo a sé. Se dimenticavo un controllo, nessun errore di compilazione. Se cambiavo il formato della risposta, dovevo cercarlo in quattro file diversi.

Ma il problema vero erano gli errori che non vedevo. Cosa succede se il client manda `duration_min: "dieci"` invece di `10`? Il codice sopra lo inserisce nel database senza battere ciglio — `"dieci" ?? 0` dà `"dieci"`, non `0`. E cosa succede se `session_type` è lungo 10.000 caratteri? O se `date` è `"2026-13-45"`? Tutti casi che il try/catch non cattura perché tecnicamente non sono eccezioni. Sono dati sbagliati che entrano silenziosi nel sistema e esplodono dopo, quando è troppo tardi per capire da dove vengono.

## Il problema del try/catch

Il `try/catch` è un costrutto imperativo. Dice al runtime: "prova a fare questa cosa, e se esplode, gestisci il disastro". Ma ha tre difetti fondamentali:

**Non è componibile.** Non puoi prendere il risultato di un try/catch e passarlo a un'altra funzione senza annidare altri try/catch.

**Non è tipizzato.** Il `catch` riceve un `unknown`. TypeScript non sa dirti cosa è andato storto. Potresti ricevere un errore di rete, un JSON malformato o un `undefined is not a function` — tutto nello stesso blocco.

**È invisibile.** Se una funzione può fallire ma non usa try/catch, il compilatore non ti avvisa. L'errore semplicemente esplode a runtime, magari in produzione, magari alle 3 di notte.

## Either: il contenitore che non mente

La programmazione funzionale ha risolto questo problema decenni fa. In Haskell si chiama `Either`, in Scala `Try`, in F# `Result`. L'idea è la stessa: **un contenitore che può avere un valore o un errore, e il tipo te lo dice esplicitamente**.

Nel mio progetto l'ho implementato così:

```typescript
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Due funzioni per costruirlo:

```typescript
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

E una funzione per concatenare operazioni che possono fallire — `andThen`:

```typescript
function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
```

`andThen` è dove il pattern diventa potente. L'idea è semplice: **se il risultato precedente è un errore, non fare nulla. Se è un valore, applicaci la prossima funzione.**

Vediamolo in azione con un caso reale. Un utente invia una sessione di meditazione. Il body della richiesta potrebbe essere:

```json
{ "date": "2026-03-25", "duration_min": 10, "session_type": "anapana" }
```

Ma potrebbe anche essere:

```json
{ "date": "ciao", "duration_min": -5 }
```

O direttamente testo rotto, non-JSON. O un body vuoto. O un array invece di un oggetto. In produzione **succede tutto**. La domanda è: come gestisci ogni caso senza impazzire?

Con `andThen` costruisci una catena dove ogni step valida un pezzo, e se uno fallisce la catena si ferma:

```typescript
const result = andThen(
  parseJsonBody(request),       // Step 1: è JSON valido?
  body => parseSessionInput(body) // Step 2: i campi sono corretti?
);
```

Cosa succede con input diversi?

**Scenario 1: il client manda testo, non JSON.** `parseJsonBody` fallisce e ritorna:

```typescript
{ ok: false, error: "Invalid JSON" }
```

`andThen` vede l'errore e **non esegue** `parseSessionInput`. Il risultato finale è l'errore del primo step, intatto.

**Scenario 2: il JSON è valido ma la data è sbagliata** — `{ "date": "ciao" }`. `parseJsonBody` riesce e ritorna `ok({date: "ciao"})`. `andThen` vede il valore, esegue `parseSessionInput`, che ritorna:

```typescript
{ ok: false, error: "Valid date (YYYY-MM-DD) required" }
```

L'errore è specifico: non "qualcosa è andato storto", ma esattamente **cosa** è andato storto.

**Scenario 3: tutto corretto** — `{ "date": "2026-03-25", "duration_min": 10 }`. Entrambi gli step riescono:

```typescript
{ ok: true, value: { date: "2026-03-25", duration_min: 10, session_type: null } }
```

Tre scenari diversi, tutti gestiti dalla stessa catena di due righe. Nessun try/catch, nessun if annidato. L'errore si propaga da solo e porta con sé il messaggio esatto di cosa è andato storto.

Puoi continuare ad aggiungere step. Ogni `andThen` è un checkpoint: se qualcosa è già fallito prima, salta tutto il resto.

```typescript
const result = andThen(
  andThen(
    andThen(
      parseJsonBody(request),          // 1. È JSON?
      body => validateNotEmpty(body)    // 2. Non è vuoto?
    ),
    body => parseSessionInput(body)     // 3. I campi sono validi?
  ),
  session => validateDateNotFuture(session) // 4. La data non è nel futuro?
);
```

Se il passo 1 fallisce, i passi 2, 3 e 4 non vengono mai eseguiti. Se il passo 3 fallisce, il passo 4 non viene eseguito. L'errore del primo step che fallisce arriva intatto fino alla fine. Nessuna informazione persa.

Certo, l'annidamento di `andThen` è brutto da leggere — ci torniamo tra poco con `pipe`.

## Come cambia il codice in pratica

Vediamo l'intero flusso. La validazione dell'input per la meditazione diventa una funzione pura che restituisce un `Result`:

```typescript
function parseSessionInput(body: unknown): Result<SessionInput> {
  if (!body || typeof body !== "object")
    return err("Body must be an object");

  const { date, duration_min, session_type } = body as Record<string, unknown>;

  if (!isValidDate(date))
    return err("Valid date (YYYY-MM-DD) required");

  return ok({
    date,
    duration_min: clampInt(duration_min, 0, 480, 0),
    session_type: typeof session_type === "string"
      ? session_type.slice(0, 200)
      : null,
  });
}
```

E l'endpoint che la usa:

```typescript
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) return jsonErr("Unauthorized", 401);

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseSessionInput(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const { date, duration_min, session_type } = parsed.value;
  // ... insert nel DB
  return jsonOk({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};
```

Niente try/catch. Niente `new Response(JSON.stringify(...))`. Ogni passaggio è esplicito: se fallisce, il tipo ti dice cosa è andato storto. Se dimentichi di controllare `.ok`, TypeScript non ti fa accedere a `.value`.

Guardate quanti unhappy path sono gestiti in queste poche righe:

1. **Token mancante o sbagliato** → `jsonErr("Unauthorized", 401)` — non si va avanti
2. **Body non è JSON valido** (testo, binario, vuoto) → `jsonErr("Invalid JSON", 400)`
3. **Body è JSON ma non è un oggetto** → `jsonErr("Body must be an object", 400)`
4. **Data mancante o in formato sbagliato** → `jsonErr("Valid date required", 400)`
5. **Durata negativa, NaN, o stringa** → `clampInt` la normalizza silenziosamente a 0
6. **session_type troppo lungo** (attacco?) → troncato a 200 caratteri

Sei casi di errore. Zero try/catch. Ogni caso produce un messaggio chiaro e uno status code appropriato. E il compilatore ti forza a controllarli tutti — se togli il check `if (!parsed.ok)`, TypeScript non ti fa accedere a `parsed.value`.

## Gli helper: piccole funzioni, grande impatto

Insieme a `Result` ho costruito una piccola cassetta degli attrezzi. Ogni funzione fa una cosa sola e la fa bene.

### Risposte JSON uniformi

Prima ogni endpoint costruiva la `Response` a mano. Ora:

```typescript
function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

Ogni endpoint risponde con `return jsonOk(data)` o `return jsonErr("motivo", 400)`. Il formato è sempre lo stesso. Se domani voglio aggiungere un header CORS a tutte le risposte, lo cambio in un punto solo.

### Da Result a Response in un passo

Quando hai un `Result` e vuoi trasformarlo direttamente in una risposta HTTP:

```typescript
function resultToResponse<T>(result: Result<T>, successStatus = 200): Response {
  return result.ok
    ? jsonOk(result.value, successStatus)
    : jsonErr(result.error, 400);
}
```

Questa funzione è il ponte tra il mondo funzionale (Result) e il mondo HTTP (Response). La logica non sa nulla di HTTP, l'endpoint non sa nulla di validazione. Ognuno fa il suo.

### Parsing sicuro del body

`request.json()` può lanciare un'eccezione se il body non è JSON valido. È uno di quei casi subdoli: il client manda un body con `Content-Type: application/json` ma il contenuto è `"ciao mamma"`, o è vuoto, o è XML. Senza protezione, l'endpoint esplode con un'eccezione non gestita e il client riceve un 500 generico senza capire cosa ha sbagliato.

Invece di scrivere un try/catch in ogni endpoint:

```typescript
function parseJsonBody(request: Request): Promise<Result<unknown>> {
  return request
    .json()
    .then((body: unknown) => ok(body))
    .catch(() => err("Invalid JSON"));
}
```

Una riga nell'endpoint: `const bodyResult = await parseJsonBody(request)`. Se il JSON è malformato, ottieni un `Result` con l'errore — non un'eccezione che devi catturare. Il client riceve un 400 con `{"error": "Invalid JSON"}` e sa esattamente cosa ha sbagliato.

### Guardie di tipo riutilizzabili

La validazione si ripete: date, email, stringhe non vuote, numeri in un range. Invece di riscrivere le regex ovunque:

```typescript
function isValidDate(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function isValidEmail(val: unknown): val is string {
  return typeof val === "string" && val.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (val === null || val === undefined) return fallback;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
```

Nota il `d is string` nel tipo di ritorno: è un **type guard**. Dopo aver chiamato `isValidDate(date)`, TypeScript sa che `date` è una stringa. Non serve più il cast.

`clampInt` è particolarmente utile: accetta `unknown`, gestisce null, undefined, stringhe, NaN, e restituisce sempre un intero nel range. Nessun endpoint deve preoccuparsi di "e se il client manda una stringa invece di un numero?".

Questi helper sembrano banali. Ma è proprio il punto: ogni funzione è così semplice che non può avere bug. La complessità nasce solo dalla composizione — e la composizione è esplicita, leggibile, testabile.

## Pipe: leggere il codice come una frase

Il secondo concetto è più semplice ma altrettanto potente. Partiamo da un esempio concreto.

Supponiamo di voler trasformare un nome utente: togliere gli spazi, metterlo in minuscolo, e prendere i primi 20 caratteri. Senza pipe:

```typescript
const result = truncate(toLowerCase(trim(username)), 20);
```

Si legge dall'interno verso l'esterno: prima `trim`, poi `toLowerCase`, poi `truncate`. Ma l'occhio legge da sinistra a destra e vede prima `truncate`. Devi ricostruire mentalmente l'ordine.

Con `pipe`:

```typescript
const result = pipe(
  username,
  trim,
  toLowerCase,
  s => truncate(s, 20)
);
```

Si legge dall'alto verso il basso, nell'ordine di esecuzione:
1. Prendi `username`
2. Togli gli spazi
3. Metti in minuscolo
4. Tronca a 20 caratteri

Ogni riga è un passaggio. Il dato scorre verso il basso come l'acqua.

### Con Result diventa ancora più chiaro

Dove `pipe` brilla davvero è con `Result` e `andThen`. Prendiamo un endpoint completo — il form di contatto del mio sito:

```typescript
// Senza pipe: annidamento e ordine di lettura invertito
const response = resultToResponse(
  andThen(
    andThen(
      await parseJsonBody(request),
      validateOrigin
    ),
    parseContactInput
  )
);

// Con pipe: flusso lineare, si legge come una storia
const response = pipe(
  await parseJsonBody(request),    // 1. Leggi il body JSON
  body => andThen(body, validateOrigin),  // 2. Valida l'origine
  body => andThen(body, parseContactInput), // 3. Valida i campi
  result => resultToResponse(result)       // 4. Trasforma in Response
);
```

Se il JSON è malformato, il passo 1 ritorna `err("Invalid JSON")`. I passi 2, 3 e 4 non vengono eseguiti — `andThen` propaga l'errore. Se l'origine non è valida, si ferma al passo 2. E così via.

È come una catena di montaggio: se un pezzo è difettoso, la linea si ferma lì. Non arriva alla fine con un errore nascosto dentro.

### L'implementazione

La cosa incredibile è quanto è semplice il codice che fa funzionare tutto questo:

```typescript
function pipe(value: unknown, ...fns: Array<(arg: any) => any>): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}
```

Un `reduce`. Una riga. Prendi un valore iniziale, applica la prima funzione, passa il risultato alla seconda, e così via. Il `reduce` di JavaScript è già `pipe` — serviva solo dargli un nome.

Il resto sono overload TypeScript per mantenere i tipi attraverso la catena:

```typescript
function pipe<A, B>(a: A, ab: (a: A) => B): B;
function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
function pipe<A, B, C, D>(
  a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D
): D;
```

Ogni overload aggiunge un passaggio. TypeScript inferisce il tipo ad ogni step: se `ab` ritorna un `string`, allora `bc` riceve un `string`. Se sbagli tipo, il compilatore te lo dice prima di eseguire il codice.

## Il ruolo dell'AI in tutto questo

Devo essere onesto: gran parte del codice che vedete in questo articolo è stato generato da un'AI. Lavoro con Claude Code come un pair programmer sempre disponibile. Gli do una specifica, discutiamo l'approccio, lui genera il codice, io rivedo e itero.

Ma la scelta di usare `Result` invece di try/catch? Quella è stata mia. La decisione di estrarre la logica di validazione in funzioni pure e testabili? Mia. La struttura delle specs in `docs/` che guidano la generazione? Mia.

Le specs sono il vero artefatto del mio lavoro. Nel repository ci sono file come `docs/meditation-spec.md` e `docs/comments-spec.md` che descrivono cosa deve fare ogni componente, quali sono i vincoli, come devono interagire le parti. Il codice è un'implementazione delle specs — e quell'implementazione la può fare l'AI, un altro sviluppatore, o io stesso tra sei mesi.

Ecco un frammento reale di `docs/meditation-spec.md`:

```markdown
## API Endpoints

### POST `/api/admin/meditation`

| Aspetto        | Dettaglio                                                               |
|----------------|-------------------------------------------------------------------------|
| Autenticazione | Bearer token                                                            |
| Request body   | `{ date: "YYYY-MM-DD", duration_min?: number, session_type?: string }` |
| Validazione    | `date` obbligatorio, deve corrispondere a `/^\d{4}-\d{2}-\d{2}$/`     |
| Logica         | INSERT nella tabella con `created_at = datetime('now')`                |
| Response 201   | `{ ok: true, id: <number> }`                                           |
| Response 400   | `{ error: "Valid date (YYYY-MM-DD) required" }`                        |
| Response 401   | `"Unauthorized"`                                                        |

## Limiti e trade-off

- **Single-user**: il sistema è progettato per un solo utente. Non c'è gestione multi-utente
- **DELETE non esposta nella UI**: l'endpoint DELETE esiste nell'API ma non c'è un pulsante
  nella UI per cancellare sessioni
- **365 citazioni hardcoded**: le citazioni sono in un file JS statico, non nel database.
  Per aggiungerne o modificarne serve un deploy
- **Nessuna notifica push**: non ci sono reminder per meditare. La motivazione è affidata
  alla streak e all'abitudine
```

Questa tabella — con i contratti esatti dell'API, i response body, i codici di errore — è il documento che ho scritto io. Da qui l'AI ha generato l'endpoint che avete visto nelle sezioni precedenti. I sei unhappy path gestiti? Tutti documentati qui, prima che esistesse una riga di codice.

I trade-off sono altrettanto importanti: capire cosa **non** fa il sistema è parte del design. "Nessuna notifica push" non è una mancanza — è una scelta consapevole. La motivazione viene dalla streak, non dal telefono che rompe le scatole.

Il file completo è su GitHub: [docs/meditation-spec.md](https://github.com/valerionarcisi/valerio-blog/blob/main/docs/meditation-spec.md)

Questo cambia il mestiere. Non scrivo meno codice — scrivo più specifiche, più test, più decisioni architetturali documentate. Il codice è diventato l'artefatto meno importante del progetto.

## La domanda scomoda

E qui arrivo al punto che non riesco a risolvere.

Guardate la struttura del mio progetto:

- **`src/lib/result.ts`** — zero dipendenze da Astro. TypeScript puro. Funziona ovunque.
- **`src/lib/meditation.ts`** — zero dipendenze da Astro. Logica pura, testata con 73 test case.
- **`src/pages/api/admin/meditation.ts`** — 77 righe di colla tra Astro e le mie librerie pure.

La logica di business è framework-agnostic. Il framework è solo il guscio: routing, SSR, deploy su Netlify. Se domani Astro sparisse, riscriverei 77 righe di colla per SvelteKit o Hono. La logica resterebbe identica.

Ma allora la domanda diventa un'altra: se il mio codice è già fatto di funzioni pure e piccoli componenti che si compongono, e la colla la genera l'AI — **perché non usare direttamente la piattaforma web?**

HTML ha già i Custom Elements. Il browser ha già il `<template>`, lo Shadow DOM, gli slot. Sono standard, non cambiano ogni sei mesi, non richiedono un bundler. Un `<meditation-timer duration="10">` è un componente. Un `<result-handler>` che wrappa un fetch e gestisce loading/error/success è un componente. Nessun framework, nessun virtual DOM, nessuna build chain.

Il pattern è lo stesso del codice server: funzioni pure per la logica, componenti HTML nativi per la UI, composizione invece di framework. Il browser è già il framework.

Non dico che sia la risposta giusta. Astro mi dà il content layer, il routing file-based, l'SSG, gli adapter per Netlify — cose utili, concrete. Ma quando guardo il codice che ho scritto, la parte che conta davvero — la logica, i pattern, le decisioni — non dipende da nessuno di questi.

E se il mio lavoro è scrivere specifiche e decisioni architetturali, e l'implementazione la genera un'AI che può reimplementarle su qualsiasi piattaforma... il framework è diventato il vestito che cambi senza toccare il corpo. O forse è il corpo stesso che sta cambiando forma.

Non ho una risposta. Ma la domanda mi sembra quella giusta da porsi.
