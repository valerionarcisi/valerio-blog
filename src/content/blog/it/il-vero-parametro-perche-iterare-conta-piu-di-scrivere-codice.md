---
title: "Il vero parametro: perché iterare conta più di scrivere codice"
date: "2026-03-04"
extract: "Ho costruito un sistema di analytics self-hosted usando Claude. Ma la parte interessante non è il codice — è il processo iterativo che ha trasformato un'idea in un prodotto funzionante in poche ore."
tags: ["ai", "javascript", "thoughts", "analytics"]
coverImage: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=630&fit=crop"
coverAuthorName: "Lisa Keffer"
coverAuthorLink: "https://unsplash.com/@lisakeffer"
---

Qualche settimana fa ho deciso di replicare un software che uso quotidianamente — Simple Analytics — da zero, con Claude. Non perché ne avessi bisogno. L'ho fatto perché volevo rispondere a una domanda che mi gira in testa da un po': **quanto ci metto a replicare un prodotto SaaS con un'AI?**

Dietro quella domanda ce n'è una più scomoda: se io posso farlo in poche ore, che senso ha per molti software continuare ad esistere? Che senso ha, per estensione, un blog personale come questo?

La risposta mi ha sorpreso. Ma non nel modo in cui pensavo.

## La paura giusta

Viviamo in un momento in cui un singolo developer con un LLM può replicare in ore quello che prima richiedeva settimane e un team. Questo non è un discorso teorico — l'ho appena fatto. In poche ore avevo un sistema di analytics completo: endpoint di raccolta, database su Turso, dashboard con grafici, scroll depth, tempo sulla pagina, visitor tracking. Tutto privacy-first, zero cookie, self-hosted.

Se è così facile, molti software non hanno più ragione di esistere nella loro forma attuale. È una paura legittima, e credo che sia la paura giusta da avere.

Ma nel farlo ho capito qualcos'altro.

## Non è il codice, è la strada

La prima versione funzionava. Poi ho confrontato i numeri con Simple Analytics: 170 visitatori loro, 29 i miei. Stesso periodo, stesso sito.

Invece di riscrivere tutto, ho chiesto "perché?" Ed è partito un ciclo che non avrei mai potuto pianificare:

Gli ad blocker bloccavano il mio endpoint perché si chiamava `/api/collect` — troppo ovvio. Il check su Do Not Track scartava utenti reali per rispettare una specifica morta. La deduplicazione lato client era imprecisa. Nessun retry sui dati persi. Il rate limiter si resettava ad ogni cold start su serverless.

Cinque problemi, trovati uno dopo l'altro, ognuno che rivelava il successivo. Non era un piano — era un **ping-pong** continuo tra me e Claude. Io facevo le domande, lui proponeva soluzioni, io valutavo, lui aggiustava. Avanti e indietro finché il sistema non funzionava davvero.

Poi sono apparsi i visitatori cinesi. Tutti Chrome, tutti Windows, tutti desktop. Zero scroll, zero tempo sulla pagina. Bot, ovviamente. Claude ha proposto di filtrarli con regole statiche — paese, user agent, pattern noti. Funzionava, ma era fragile. Così gli ho chiesto di costruire una trappola: link invisibili che un utente reale non vedrebbe mai, ma che un bot segue automaticamente. Da lì è nato un sistema di honeypot con detection comportamentale che non era in nessun piano iniziale.

**Non ho scritto quasi nessuna di queste righe di codice.** Ma il sistema funziona perché sapevo cosa chiedere, quando insistere e quando cambiare direzione.

## La trappola per i bot

Un honeypot, nel contesto della sicurezza informatica, è una trappola. Qualcosa che sembra appetibile per un attaccante ma che in realtà serve solo a identificarlo. Nel nostro caso: link invisibili nel footer che un utente reale non vedrà mai, ma che un bot — che analizza il DOM alla ricerca di URL — segue senza esitazione.

Ecco come è andata la conversazione.

**Io:** *"va bene anche fare qualcosa tipo honeypot. Un link invisibile ma che il bot va a cercare e vede come normale. Potrebbe essere una strada giusta?"*

Claude ha generato un endpoint `/api/t` — un nome volutamente opaco — e un link nascosto nel footer. Poi gli ho chiesto di rinforzare la trappola.

**Io:** *"prima rinforziamo la trappola"*

E lui ha moltiplicato le esche, usando tre tecniche CSS diverse per nasconderle, con testi che i bot adorano:

```html
<a href="/api/t"
   style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;"
   tabindex="-1" aria-hidden="true">sitemap</a>

<a href="/api/t?r=2"
   style="clip:rect(0,0,0,0);position:absolute;width:1px;height:1px;"
   tabindex="-1" aria-hidden="true">wp-admin</a>

<a href="/api/t?r=3"
   style="opacity:0;pointer-events:none;position:absolute;"
   tabindex="-1" aria-hidden="true">login</a>
```

"sitemap", "wp-admin", "login" — parole che un crawler segue per istinto. Un utente reale non le vede. `aria-hidden="true"` e `tabindex="-1"` le nascondono anche agli screen reader e alla navigazione da tastiera.

Quando un bot segue uno di questi link, l'endpoint calcola un hash del visitatore e lo salva in una tabella `bot_hashes`:

```typescript
export const GET: APIRoute = async ({ request }) => {
  const ua = request.headers.get("user-agent") ?? undefined;
  if (isBot(ua)) return new Response(null, { status: 204 });

  const ip = request.headers.get("x-forwarded-for")
    ?.split(",")[0]?.trim() ?? "unknown";

  const hash = await generateVisitorHash("valerionarcisi.me", ip, ua ?? "");
  await db.execute({
    sql: "INSERT OR IGNORE INTO bot_hashes (hash) VALUES (?)",
    args: [hash],
  });

  return new Response(null, { status: 204 });
};
```

Da quel momento, tutte le query delle statistiche escludono automaticamente quei visitatori. Nessun falso positivo, nessuna regola statica da mantenere. Il bot si identifica da solo.

La cosa che mi ha colpito? Non avrei mai pianificato questa soluzione. È nata da una domanda fatta nel momento giusto, durante una conversazione che stava andando in un'altra direzione.

## L'astrazione si è spostata

Una volta l'astrazione era il linguaggio di programmazione. Assembly era troppo vicino alla macchina, poi è arrivato il C, poi i linguaggi ad alto livello, poi i framework. Ogni strato ci allontanava dalla macchina e ci avvicinava al problema.

Adesso l'astrazione è la conversazione. Claude, gli agenti, gli LLM — sono il nuovo strato con cui parliamo alle macchine. Non scrivi più `for (let i = 0; i < arr.length; i++)`. Dici "filtra i bot dalle statistiche e mostrami solo i visitatori reali". Il linguaggio naturale è diventato il linguaggio di programmazione.

E se il linguaggio non è più il collo di bottiglia, allora scrivere codice non ha più il valore di una volta. Punto. Non sto dicendo che non serve capire cosa succede sotto — serve eccome. Ma la capacità di scrivere sintassi corretta al primo tentativo non è più una competenza che vale qualcosa.

## Il software che sparirà

Se il linguaggio non è più il collo di bottiglia, allora la quantità di codice che verrà replicata sarà enorme. Bastano pochi developer interni con un LLM e gran parte del software che oggi affidiamo in outsourcing, a consulenti esterni o a body rental vario, può essere riscritto internamente in tempi ridicoli. Troppo perché certi modelli di business sopravvivano.

Forse resisteranno solo i prodotti molto verticali, quelli con domini particolari dove la conoscenza accumulata ha un valore che non si replica con un prompt. Ma per tutto il resto? Il conto alla rovescia è già partito.

E poi c'è la questione della UX. Oggi il flusso è: cerco su Google → apro un sito → navigo in una lista → trovo quello che mi serve. Ma se un agente può fare tutto questo per me, che senso ha il portale? Forse per il 90% dei SaaS basterà un MCP server e un client che ci parla. L'agente fa le cose, il portale serve solo per le funzionalità davvero avanzate — quelle che richiedono un'interfaccia complessa, una visualizzazione che un prompt non può restituire.

È solo un mio pensiero, ovviamente. Ma il fatto che me lo stia chiedendo mentre costruisco un sistema di analytics con un'AI... beh, mi sembra abbastanza eloquente.

## Il test alla lavagna

Ora immaginiamoci durante un colloquio. C'è un tizio che ti guarda mentre scrivi pseudo codice alla lavagna. Senza internet. Ti chiede di invertire un albero binario, o di implementare un merge sort a memoria.

Ha senso?

A mio avviso non aveva senso nemmeno prima. Misurare la memoria, nel nostro campo, non ha mai avuto senso — non a scuola, non all'università, non nei colloqui. Capisco che sia un parametro facile da misurare, e capisco perché sia stato adottato. Ma facile da misurare non significa significativo.

Adesso, poi, non ha proprio alcun senso. Un LLM ha accesso a una memoria così estesa che non possiamo minimamente pareggiare. Chiederti di ricordare la signature di una funzione è come chiederti di fare una moltiplicazione a mano quando hai una calcolatrice davanti. Puoi farlo, ma perché dovresti?

## Allora cosa conta?

Conta **cosa** stai facendo, **perché** lo stai facendo e **la strada** che imbocchi per farlo.

Nel mio caso: ho scelto di replicare un prodotto per capire qualcosa sull'AI, ho scoperto che il valore sta nel processo iterativo, ho cambiato direzione più volte seguendo i dati invece del piano. Ogni problema risolto ne ha aperto un altro che non potevo prevedere. L'honeypot per i bot cinesi non era in nessun brief — è nato da una domanda fatta al momento giusto.

Forse un giorno ci chiederanno la lista dei prompt che usiamo per arrivare a un risultato. Forse sì. Ma anche quello sarebbe solo un proxy imperfetto.

Perché la verità è che non puoi misurare la proattività in un colloquio di un'ora. Non puoi misurare la creatività con un test. Non puoi capire se una persona sa iterare chiedendole di scrivere codice alla lavagna.

La creatività — quella vera, quella che ti fa fare la domanda che nessuno ha pensato di fare — viene dalle attività creative che fai nel tempo libero. Dal cinema che guardi, dalla musica che ascolti, dai problemi che ti inventi e risolvi per curiosità. È improduttiva per definizione, e proprio per questo è il punto focale.

## Il prossimo passo

Ho replicato Simple Analytics in poche ore. Ho costruito un sistema di bot detection che non avevo pianificato. Ho aggiunto SEO, hreflang, RSS autodiscovery, un file `llms.txt` per farmi trovare dalle AI.

Il prossimo passo? Forse riscriverò questo sito in WebAssembly. O direttamente in assembly. Perché no?

Se il linguaggio non è più il vincolo, allora la domanda non è più "in cosa lo scrivo" ma "cosa voglio che faccia e perché". E quella è una domanda a cui nessuno ha mai potuto rispondere per te. Nemmeno prima.
