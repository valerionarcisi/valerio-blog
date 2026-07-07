# Radar — aggiornamento dati

Come si rigenera `public/radar.json` (la fonte della pagina `/admin/radar`).
Schema completo in `docs/radar-spec.md`.

## Flusso automatico (settimanale, GitHub Actions)

Workflow: `.github/workflows/radar-weekly.yml` — lunedì 08:00 UTC (o run manuale dalla tab Actions).

1. `node scripts/radar-update.mjs` — chiama l'API Anthropic (**Haiku 4.5 + web search**, via
   `fetch`, zero dipendenze) passando gli item correnti; il modello cerca bandi/opportunità cinema
   nuovi o aggiornati (OnlyFUNDS, Collettivo Incendio, European Short Pitch, Creative Europe MEDIA,
   Cineuropa, ShorTO…) adatti a un regista emergente con corti, e restituisce il JSON aggiornato.
   Lo script riscrive `public/radar.json` (`updatedAt` lo mette lui, autoritativo).
   **Fail-safe**: se la risposta non è un JSON con `items` non vuoto (o manca un `id`), esce con
   errore **senza** sovrascrivere il file — meglio dati vecchi che dati distrutti.
2. `npx tsx scripts/radar-notify.ts` — confronta il working tree con `HEAD:public/radar.json`;
   se ci sono `id` nuovi, manda una DM Telegram all'owner. Gira **prima** del commit (così HEAD è
   ancora la versione vecchia).
3. Commit + push di `public/radar.json` (se cambiato) → Netlify deploya.

### GitHub Secrets richiesti

- `ANTHROPIC_API_KEY` — chiave API Anthropic (progetto Oh Writers). Consumo separato
  dall'abbonamento Claude Code; a Haiku settimanale ≈ pochi € al mese.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID_WHITELIST` — bot Idea Catcher; il primo id della
  whitelist è l'owner notificato.

Il push usa il `GITHUB_TOKEN` di default con `permissions: contents: write` — niente PAT.

## Flusso on-demand (gratis)

In alternativa (o in aggiunta) puoi aggiornare quando vuoi da una sessione Claude Code: chiedi
"aggiorna il radar" e verrà eseguita la stessa logica (ricerca → riscrive `radar.json` →
`radar-notify` → commit). Nessun costo oltre l'abbonamento.

## Note

- `radar-update.mjs` usa la variante web search **`web_search_20250305`** perché Haiku 4.5 non
  supporta la `20260209` (dynamic filtering, solo Opus/Sonnet recenti).
- Aggiornamento manuale minimo: edita `public/radar.json` e fai push.
