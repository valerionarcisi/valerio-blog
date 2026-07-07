# Radar opportunità — spec

Vista privata admin che mostra bandi/opportunità cinema (workshop, call, pitch, fondi, premi),
ordinate per scadenza. Alimentata da un file JSON rigenerato ogni giorno da un agente.

## Componenti

- **Pagina**: `src/pages/admin/radar.astro` — route `/admin/radar`, `noindex`, self-contained
  (nessun layout condiviso, come le altre pagine admin). Tema Foglio (`foglio.css` +
  `admin-foglio.css`), accento terracotta.
- **Dati**: `public/radar.json` — unica fonte, servita a `/radar.json`, letta client-side.
- **Ricerca**: `scripts/radar-update.mjs` — API Anthropic (Haiku + web search, via `fetch`) →
  riscrive `radar.json`. Fail-safe: non sovrascrive se la risposta non è valida.
- **Notifica**: `scripts/radar-notify.ts` — diff deterministico degli `id` nuovi → DM Telegram.
- **Schedulazione**: `.github/workflows/radar-weekly.yml` — settimanale (lunedì 08:00 UTC) +
  run manuale. Secrets: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID_WHITELIST`.
- **Brief/flusso**: `docs/radar-agent.md`.

## Auth

Riusa il pattern admin esistente: `?token=ADMIN_TOKEN`, check server-side `timeSafeEqual`
(`~/lib/auth`), `401` se manca/errato. Nessun env nuovo.

## Schema `radar.json`

```jsonc
{
  "updatedAt": "2026-07-07T09:00:00+02:00", // ISO con offset
  "items": [
    {
      "id": "slug-stabile", // id univoco e stabile; guida la rilevazione novità
      "title": "…",
      "what": "cos'è",
      "forWho": "a chi si rivolge",
      "deadline": "2026-07-25", // YYYY-MM-DD oppure null
      "whereWhen": "luogo e date",
      "probability": 70, // 0-100 oppure null
      "why": "perché candidarsi / ostacoli",
      "action": "prossima azione concreta",
      "link": "https://…",
      "source": "OnlyFUNDS", // es. OnlyFUNDS, European Short Pitch, Creative Europe MEDIA, Cineuropa, ShorTO
      "tags": ["in-person", "a-pagamento"], // online|hybrid|in-person|gratis|a-pagamento (+ liberi)
      "status": "aperta", // aperta | in-arrivo | scaduta
    },
  ],
}
```

## Comportamento pagina

- Fetch `/radar.json` a runtime (`cache: no-store`) → render client-side. Sostituire il file
  (via push/deploy) aggiorna i dati senza toccare il codice.
- **Ordinamento**: deadline crescente; senza deadline in fondo; le scadute (deadline < oggi)
  in una sezione "Scadute" collassata.
- **Filtri** (chip toggle sticky, combinabili) + ricerca testuale su titolo/`what`/`source`:
  - `Online/Hybrid` (tag `online`|`hybrid`), `Gratis` (tag `gratis`),
    `≤ 30 giorni` (deadline entro 30gg), `Prob ≥ 50%`.
- **Scheda**: titolo + badge fonte; countdown colorato (verde >14gg, giallo 4-14, rosso ≤3,
  "oggi", "scaduta il…"); riga `whereWhen`; badge probabilità (verde ≥55 / giallo 30-54 /
  grigio ≤29); `what`/`why`/`action`; chip tag (evidenzia online/hybrid/gratis);
  bottone "Apri" → `link` in nuova scheda.
- **Empty state**: "Nessuna opportunità caricata" se `items` vuoto o fetch fallito.
- Mobile-first: 1 colonna, 2 colonne da ≥720px.

## Automazione

Workflow settimanale `.github/workflows/radar-weekly.yml`: `radar-update.mjs` (ricerca Haiku) →
`radar-notify.ts` (notifica se `id` nuovi) → commit + push (`GITHUB_TOKEN`, `contents: write`).
In alternativa, on-demand da Claude Code ("aggiorna il radar"). Dettagli in `docs/radar-agent.md`.

## Note

- `/admin/` è già escluso dal sitemap in `astro.config.mjs`.
- `radar-notify.ts` non riusa `sendMessage` di `~/lib/telegram.ts` perché quello dipende da
  `env()` (decode Astro build-time), non disponibile in un contesto script `process.env`.
- Selftest della diff: `npx tsx scripts/radar-notify.ts --selftest`.
