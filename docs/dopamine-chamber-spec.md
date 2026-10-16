# Dopamine Chamber — design system del sito pubblico

Sostituisce l'aspetto "Foglio" (carta crema, EB Garamond, terracotta) su tutte le pagine pubbliche. Ispirazione: la grafica dell'album _Dopamine Chamber_ di Fontaines D.C. (16 ottobre 2026): fondo nero, volto rosa distorto, titolo blu in due font. Lo abbiamo spostato dal disco al **cinema**: il sito è un set (scene, timecode, titoli di coda), con un tono freddo e sintetico.

## Come funziona

- Le pagine pubbliche hanno `<html class="foglio dc">`. `src/styles/dc.css` rimappa tutti i token `--foglio-*` (palette, font, raggi). Le pagine admin restano `class="foglio"` e mantengono la carta crema.
- Il tema è **solo scuro**: niente toggle chiaro/scuro, `color-scheme: dark`.
- Layout e CSS di pagina (`Foglio*Layout`, `Visti.css`, ecc.) usano ancora i token `--foglio-*`; quando serve, regole `.dc ...` o `html.dc ...` sovrascrivono.

## Token

| Token                        | Valore                | Uso                                               |
| ---------------------------- | --------------------- | ------------------------------------------------- |
| `--foglio-bg`                | `#04050a`             | fondo (nero appena blu)                           |
| `--foglio-ink` / `--dc-text` | `#e6e9ee` / `#cfd3da` | testo, testo lungo                                |
| `--foglio-ink-mute`          | `#8b929c`             | testo secondario (contrasto > 4.5:1)              |
| `--dc-blue`                  | `#3355ff`             | **solo** titoli grandi (3.8:1: mai sotto i 24 px) |
| `--dc-link`                  | `#8fa2ff`             | link e testo blu piccolo                          |
| `--foglio-accent`            | `#ff4fa3`             | rosa: carne, enfasi, stati                        |

Regola: blu per i titoli, rosa per la pelle e l'enfasi, tutto il resto grigio freddo. Nessun altro colore.

## Tipografia

- **Archivo Variable** (assi `wdth` 62–125 e `wght`): titoli larghi e pesanti (`900`, `font-stretch:125%`, maiuscolo), titoli di sezione sottili e stretti (`200`, `62%`), corpo.
- **Instrument Serif**: solo lead, estratti e citazioni (mai corpo del testo).
- **JetBrains Mono**: metadati, scene, bottoni.
- Font in `src/styles/fonts.css`, `font-display: optional` come gli altri.

## Linguaggio del cinema

- **Scene heading** (`.dc-scene`): "SEQ. 01 — INT. SCRIVANIA — NOTTE" sopra ogni sezione della home.
- **Hero**: inquadratura 2.39:1 con angoli del mirino (`.dc-frame` + `.dc-mark--*`), riga "● REC 00:00:04:12".
- **Filmografia**: striscia di pellicola con perforazioni (`.dc-strip`), fotogrammi desaturati che prendono colore al passaggio del mouse (`.dc-grade`).
- **Titoli di coda**: il footer.
- **Trattamento volto** (`.dc-face`): rosa, distorsione orizzontale (filtro SVG `#dc-warp`), doppione spostato, scanline. Usato su ritratto e copertine degli articoli. **Sui fotogrammi dei film no**: la scheda film mostra le immagini a colori con il solo mirino, per i selezionatori dei festival.
- **Titolo glitchato** (`.dc-warp-type`, filtro `#dc-warp-type`): i filtri SVG sono montati una volta sola in `FoglioHeader` (`DcFilters.astro`).

## Due volumi per i post

Campo frontmatter `mood` (`full` | `quiet`, default `full`):

- `full`: titolo gigante distorto, copertina con trattamento volto.
- `quiet`: per i post personali. Titolo sottile e minuscolo, foto naturale, colonna stretta, nessuna distorsione.

Oggi `quiet`: i due post "21 giorni senza alcol" (IT + EN).

## Pagine

- Home: `DcHome.astro` + `DcHome.css` (condivisa da `/` e `/en/`). Tre ingressi: festival → Caramella, programmatori → Codice, lettori → blog. "Non fa ridere" mostra lo stato di lavorazione. Mantiene le classi `fh-lib-*` perché `src/scripts/watched-movies.ts` le genera lato client.
- Codice (`/codice`, `/en/code`): `DcCode.astro`, dal CV. I post tecnici sono scelti da `isTechnicalPost()` (`src/lib/tech-posts.ts`, per tag).
- Post, scheda film (poster, titolo, allori, CTA trailer/screener), lista blog, titoli delle pagine interne (`h1.dc-page-title`).

## Titoli mai tagliati

I titoli giganti si adattano alla larghezza: la dimensione è `min(clamp(...), --dc-fit-w / (parola più lunga × 0.8))`. Le pagine passano la lunghezza della parola più lunga con `--lw` (calcolata in `FoglioPostLayout` e `FoglioFilmLayout`; `h1.dc-page-title` usa 10 di default). Le parole non si spezzano a metà (`overflow-wrap: break-word` serve solo da rete di sicurezza).

## Credito

Il footer dichiara: "Design ispirato a _Dopamine Chamber_ dei Fontaines D.C." (link a fontainesdc.com; EN: "Design inspired by …").

## Decisioni

- **Oh Writers non è più nel sito** (non verrà pubblicato).
- Il numero di telefono del CV non è sul sito.
- Il PDF del CV non è pubblicato: contiene il telefono e Oh Writers, e non cita Java. Aggiornarlo prima di linkarlo.
- La ricerca nell'header e i tag nelle righe dei post sono rimandati (`BlogSearch` non è montato da nessuna parte).

## Da fare

- Allori: Fano e Bracciano (premi vinti) non hanno un'immagine in `public/img/caramella/laurels/`, quindi nell'elenco dei premi mostrano la barra rosa e il premio. Aggiungere i PNG e il campo `laurel` nel frontmatter.
- Durata e genere di Caramella (`technicalSpecs.duration`) e link al press kit sulla scheda film.
- Poster Letterboxd/TMDB nella sezione "visti" quando le API rispondono (in sviluppo senza chiavi mostra il fallback).
- Reader mode (`ReaderMode.astro`): i temi crema/bianco/seppia non hanno senso su fondo scuro; da rivedere.
- Misurare le prestazioni (Archivo variabile, filtri SVG su iOS) prima del merge su `main`.
