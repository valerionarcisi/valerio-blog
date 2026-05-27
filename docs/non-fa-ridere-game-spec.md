# Non fa ridere — Game spec

## Obiettivo

Un piccolo gioco-vignetta in browser, ospitato su `/non-fa-ridere/` (o `/films/non-fa-ridere/play`), che funzioni come **promo interattivo** del cortometraggio omonimo. Non è il film. Non è un trailer. È un *side artifact* — qualcosa che il pubblico può attraversare in 3-5 minuti, che lascia un sapore, e che (idealmente) genera curiosità sul corto, sul regista, sul progetto Oh Writers.

Tre vincoli editoriali:

1. **Tonalità coerente con Foglio**: serif EB Garamond, cream paper, accento terracotta. Niente UI da videogame "spaziale" o cartoonesca.
2. **Niente download, niente plugin, niente login**. Si apre dal sito, si gioca, si chiude. Mobile-first, funziona offline una volta caricato.
3. **Asse narrativo > meccanica**. Il gioco deve esistere *perché* serve a raccontare qualcosa che il trailer non può; se l'unico contenuto è "premi spazio per saltare", il progetto fallisce.

## Domande ancora aperte (da decidere prima di codare)

| # | Decisione | Opzioni | Impatto |
|---|---|---|---|
| 1 | **Genere** | (a) interactive fiction testuale stile Twine, (b) point-and-click pixel art 2D, (c) walking-simulator first-person WebGL, (d) vignette a scelta multipla con immagini fisse dal set | Determina lo stack, il budget tempo, e il tipo di asset da produrre |
| 2 | **Plot/scena giocabile** | Una scena chiave del corto? Un prequel? Una scena tagliata? Un POV alternativo? | Decide cosa esiste *solo* nel gioco |
| 3 | **Durata gioco** | 3-5 min, 10-15 min, 30+ min | Definisce numero di scene/scelte |
| 4 | **Asset visivi** | (a) foto dal set rielaborate, (b) pixel art originale, (c) illustrazioni vector tipo Foglio, (d) solo testo tipografico (Twine-like) | Determina tempi di produzione visiva |
| 5 | **Persistenza progresso** | (a) niente, riparte da zero ogni volta, (b) localStorage, (c) sync DB Turso per "achievements pubblici" | Influenza il backend |
| 6 | **Endpoint/share** | (a) link a `/non-fa-ridere/` semplice, (b) finale unico per ogni run shareable via URL parameters, (c) classifica/timer di completamento | SEO e viralità |

**Mio default consigliato** (se preferisci che decida io e ci muoviamo):

- **(1)** d → vignette a scelta multipla con immagini fisse dal set
- **(2)** una scena prequel di 3 momenti, ognuno con 2-3 scelte
- **(3)** 5-7 min totali
- **(4)** a → foto dal set + grain + filtri color-grading coerenti col film
- **(5)** b → localStorage per "scena raggiunta" + "epilogo sbloccato"
- **(6)** b → ogni finale ha un URL univoco shareabile (es. `/non-fa-ridere/?ending=tavolo`)

Motivazione: minimo costo tecnico, massimo riuso degli asset già esistenti (foto di set), tono editoriale coerente con Foglio, e l'URL-share è virale senza richiedere infrastruttura.

## Architettura (proposta basata sui default)

```
Browser  →  /non-fa-ridere/ (Astro static page)
              │
              ├─ <body> con shell Foglio (header, footer, font)
              ├─ <div id="stage"> placeholder per il game canvas
              ├─ Inline JS (≤30KB): game engine + scene graph
              └─ Asset preloaded:
                   - 8-12 jpg (foto set, max 1600px lato lungo, q80)
                   - 1 ttf (Garamond italic, già caricato dal sito)
                   - 0-1 audio file opzionale (ambience set, mp3 80kbps)

  Stato locale:
    - localStorage.nfr_progress = { scenesSeen: [], ending: null }
    - URL ?ending=X per deep-link a un finale specifico
    - Niente backend, niente DB
```

**Stack**:

- Astro page statica (no SSR, no API) → CDN cache forever
- Vanilla TypeScript per il game engine, scritto in un singolo file `~/lib/nfr-engine.ts`
- Niente Phaser/PixiJS/Three.js → ~30KB di JS totali
- Co-locazione CSS Foglio in `NonFaRiderePlay.css`
- Asset in `public/img/non-fa-ridere/play/` (cache headers immutable già configurati)

**Game engine (scene graph minimal)**:

```ts
type Scene = {
  id: string;
  image: string;            // path a jpg
  text: string;             // testo narrativo
  choices: Array<{
    label: string;
    next: string;           // id scena successiva
    consequence?: string;   // testo flash che appare brevemente
  }>;
  isEnding?: boolean;
};

const scenes: Record<string, Scene> = { /* ... 8-12 scene */ };

function play(id: string): void {
  const scene = scenes[id];
  // render image fade-in, testo type-on, choices
  // on click → save progress, navigate to scene.next
}
```

## Pagina e routing

| Path | Cosa è | Render |
|---|---|---|
| `/non-fa-ridere/` | Landing del gioco. Hero con titolo italic, sottotitolo "un gioco di Valerio Narcisi", CTA "Inizia" | Astro static |
| `/non-fa-ridere/?ending=X` | Deep-link a un finale, mostra direttamente l'ending screen | Astro static + JS legge query |
| `/films/non-fa-ridere/` | Pagina film esistente (post produzione) | Astro static, già live |

La pagina film standard linka al gioco con un CTA prominente (`<a href="/non-fa-ridere/" class="foglio-readmore">Gioca →</a>`).

## Considerazioni di design

### Tonalità (Foglio applicato)

- **Background**: `var(--foglio-bg)` (cream o ink scuro in dark mode)
- **Testo narrativo**: serif EB Garamond, italic, color `var(--foglio-ink)`, font-size `var(--foglio-fs-lg)`, line-height 1.55, max-width 32em
- **Scelte (choices)**: pulsanti minimal con border `1px var(--foglio-rule)`, hover → border `var(--foglio-accent)`. Niente shadow drop, niente gradient.
- **Immagini**: aspect-ratio fisso 16:9 o 3:2, border-radius `var(--foglio-radius-md)`, leggero grain CSS via `mix-blend-mode` per coerenza film-look
- **Transizioni scena**: opacity fade 280ms, niente slide aggressivi
- **Mobile**: image full-width, testo sotto, choices in colonna

### Onboarding

Niente tutorial. La prima scena ha 1-2 scelte. Si capisce da solo. Stile *Bandersnatch*, non *Heavy Rain*.

### Accessibilità

- `prefers-reduced-motion` → niente type-on text, niente fade, transizioni istantanee
- Choices come `<button>` reali con focus-visible
- Testo selectable
- Alt text per ogni immagine
- Min touch target 44px

### Performance

- Tutti gli asset (immagini) **preloadati al click su "Inizia"** prima della prima scena → no flash mid-game
- Total JS < 30KB gzip
- LCP < 1.5s su 4G mobile
- Lighthouse > 95 ovunque

## Riusabilità → libreria interna

Se Non fa ridere funziona, lo stesso engine può essere riusato per:

- **Caramella** retroattivamente — un "dietro le quinte" interattivo
- Futuri corti, ogni volta come `/non-fa-ridere-game-spec.md`-clone
- Oh Writers come tutorial interattivo

Quindi `~/lib/nfr-engine.ts` va scritto **generico**: prende uno scene graph in input, non hardcode il contenuto.

## Roadmap

Approccio iterativo, lavoro in 4 fasi:

| Fase | Output | Tempo stimato |
|---|---|---|
| **0. Decisione** | Risposte alle 6 domande in alto | 15 min di chat |
| **1. Engine + 1 scena dummy** | Pagina `/non-fa-ridere/` con engine funzionante, 2 scene placeholder lorem ipsum. Test mobile/desktop, lighthouse, share URL | 2-3h |
| **2. Contenuto + asset** | Scene graph completo (testi finali + foto trattate), 8-12 immagini ottimizzate, 2-3 finali | 4-6h (dipende dal lavoro creativo) |
| **3. Polish** | Sound design opzionale, animations, ending screens shareable, OG image dinamica per ogni ending | 2-3h |
| **4. Lancio** | Push, post blog "Ho fatto un gioco del mio corto", share su LinkedIn/X | 1h |

## Misure di successo

Non SEO. Non click. Niente di quello.

- **Tasso completamento**: % di chi arriva a un ending vs chi inizia. Misurato via custom event nell'analytics esistente (gia c'è `/api/e`, basta aggiungere `type: "game_ending"` con label = ending id)
- **Distribuzione ending**: quale finale prendono di più. Dice qualcosa sui giocatori.
- **Tempo medio per scena**: se < 5s, hanno skippato e non hanno letto. Se > 30s, hanno guardato l'immagine. Anche questo via custom event.

Aggiungere alla tabella `pageviews` non serve — questo è un evento separato. Considerare una nuova tabella `game_events` o estendere `pageviews` con `event_type` nullable.

## Non-goal

- Audio musicale dal film (rights complicati, escluso fino a clearance esplicita)
- Game multiplayer (non ha senso per il formato)
- Mobile app nativa (browser sufficiente)
- Achievement system tipo Steam (overengineering per uno short)
- Localizzazione EN per la v1 — solo IT al lancio, EN se il gioco funziona

## Domande aperte residue (non bloccanti)

- Il nome del progetto è "Non fa ridere — il gioco" o lo chiamiamo diversamente per non confondere col corto?
- La pagina è linkata in homepage ("Adesso", section esistente) o solo dalla pagina film?
- Vogliamo un easter egg sulla home (es. clic 7 volte sul ritratto → accesso al gioco)? Bello ma poi dimentico
- Cookieless tracking dei custom event va bene per privacy? (sì, hash anonimo come già fa /api/e)

---

**Prossimo passo**: rispondi alle 6 domande in alto (anche solo "default ok per tutto") e parto con la Fase 1. Aggiornerò questa spec col fattuale a fine ogni fase.
