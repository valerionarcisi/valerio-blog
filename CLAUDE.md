# Valerio Blog

Personal blog and portfolio site for Valerio Narcisi (filmmaker, sceneggiatore, sviluppatore).

## Tech Stack

- **Framework**: Astro 7 (static site generation + Netlify Functions for server endpoints)
- **Language**: TypeScript (strict mode), ESM
- **Package Manager**: pnpm
- **Node**: 22.12+ (required by Astro 7). Always `nvm use 22` before pnpm commands.
- **Styling**: Plain CSS, co-located CSS files next to components. No CSS framework.
- **Design system**: **Foglio** — cream paper (`#f6f1e8`), EB Garamond serif (display + prose), Inter sans (body fallback), JetBrains Mono, terracotta accent (`#a8451a`). Tokens in `src/styles/foglio.css` (`--foglio-*`).
- **Deployment**: Netlify (static pages + serverless functions). Auto-deploy on push to `main`.
- **Database**: Turso (libsql) for comments, claps, analytics, editorial agents queue, game leaderboard (`/non-fa-ridere/`).

## i18n

- **Default locale**: Italian (`it`), no URL prefix
- **Secondary locale**: English (`en`), URL prefix `/en/`
- **Config**: `prefixDefaultLocale: false` in `astro.config.mjs`
- **UI translations**: `src/i18n/ui.ts`
- **Helpers**: `src/i18n/utils.ts` — `getLangFromUrl()`, `useTranslations()`, `getLangFromId()`, `getSlugFromId()`

Note: the legacy client-side language redirect (BaseHead detected navigator.language and 301-ed Italian users to `/`, English users to `/en/`) is **removed**. The IT/EN switch is now manual via header. This was costing CLS and confusing GSC.

## Content Architecture

- **Blog posts**: Astro Content Collections in `src/content/blog/{locale}/{slug}.md`
- **Films**: Astro Content Collections in `src/content/films/{locale}/{slug}.md`
- **Movies watched**: Fetched from Letterboxd RSS + TMDB API at build time, then refreshed client-side from `/api/letterboxd` so freshly-logged films appear without a redeploy
- **Music**: Last.FM at build time, served via `/ascolti` (top albums, top artists, recent scrobbles)
- **Sports activities**: Strava at build time, served via `/admin/strava` and `/admin/training`

## Project Structure

```
src/
  components/        # Reusable Astro components with co-located CSS
  content/           # Astro Content Collections
    blog/{it,en}/    # Markdown posts
    films/{it,en}/   # Film data
  i18n/              # Translation dictionary + locale helpers
  layouts/           # Page layouts
    Foglio*.astro    # Foglio design-system layouts (Post, List, Film, FilmsIndex, Layout)
  lib/               # Functional core (Result pattern, validators, DB helpers, API clients)
  pages/             # Routes
    index.astro      # Home with Foglio hero
    blog/            # Blog list + post detail
    films/           # Film index + per-film detail
    tag/             # Tag cloud + per-tag archive (noindex,follow)
    visti/           # Films watched
    ascolti/         # Music listening
    contatti/        # Contact form
    who-i-am/        # About
    privacy-policy/
    admin/           # Private dashboards (cookie session; visit once with ?token=...)
    en/              # English mirror
    api/             # API endpoints
      admin/         # Cookie session or Bearer token (requireAdmin)
      stats/         # Public + live counter
      posts/         # Public claps
      telegram/      # Webhook for Idea Catcher (Phase 1 agents)
  services/          # External API integrations (Letterboxd, TMDB, Last.FM, Strava, Audioscrobbler)
  styles/            # foglio.css (design tokens) + global.css (legacy) + fonts.css + admin-foglio.css
public/
  img/               # Static images organized by section
  img/uploads/       # Media library uploads (dev only — Netlify Functions filesystem is read-only)
  videos/
docs/
  *-spec.md          # Feature specs (one per feature)
  editorial-strategy.md
  voice-profile.md
  setup/             # Setup guides (telegram-bot.md)
  superpowers/       # Larger system designs + step-by-step plans
    specs/
    plans/
```

## Conventions

- **Path alias**: Use `~/` to reference `src/` (configured in tsconfig.json)
- **CSS**: Co-located CSS files next to components (e.g., `Card.astro` + `Card.css`). Foglio layouts have their own CSS file (e.g. `FoglioPostLayout.astro` + `.css`).
- **No `:global()` in plain `.css` files** — only works inside Astro scoped `<style>` blocks. Use direct selectors instead.
- **No comments explaining what**: Self-documenting code via well-named functions. Comments only for _why_.
- **Content collections**: Astro 7 glob loader. Slugs derived from filenames. Locale from directory (`it/`, `en/`).
- **Images**: Blog covers may be external URLs or `/img/blog/{slug}/cover.jpg`. Film images in `public/img/{film-name}/`. Process new uploads with sharp (resize 1600px, JPEG q82, strip EXIF). Festival laurels for films go in `public/img/{film-name}/laurels/`.
- **Server endpoints**: Use `export const prerender = false` on API routes. Turso client via `getDb()` from `~/lib/turso`. Env vars via `env()` from `~/lib/env`.
- **Result pattern**: Tutti gli endpoint API usano `Result<T, E>` da `~/lib/result` per rendere espliciti successo/fallimento. Parsing input con funzioni `parse*()` che ritornano `Result`. Risposte via `jsonOk()` / `jsonErr()`.
- **Pipe**: `pipe()` da `~/lib/result` per comporre trasformazioni in modo leggibile. `andThen()` per concatenare operazioni su `Result`.
- **Validation**: Guardie di tipo condivise in `~/lib/result` (`isValidDate`, `isNonEmptyString`, `isValidEmail`, `clampInt`, `parseJsonBody`). Niente Zod — zero dipendenze, validazione plain TypeScript.
- **Tests**: Vitest with co-located `*.test.ts` files. Mock libsql via `vi.mock("~/lib/turso", ...)` with in-memory `createClient({ url: ":memory:" })`. Mock `env()` via `vi.mock("~/lib/env", ...)`. **Note**: test files inside `src/pages/` must be prefixed `_` (e.g. `_webhook.test.ts`) or Astro will pick them up as routes.
- **Third-party embeds**: never paste a raw `<iframe>` (YouTube, Relive, Vimeo...) in a post: it loads, and the provider receives the visitor's IP, as soon as the page opens. Print the click-to-load block with `npx -y tsx scripts/embed-consent-html.ts "<embed url>" it|en [height]` and paste that instead (`src/lib/embed-consent.ts`, `src/scripts/embed-consent.ts`, styles in `FoglioPostLayout.css`). A test fails if a raw iframe appears in `src/content`. The privacy policy (IT + EN, section "Contenuti di terze parti") names the embeds: update it when you add a new provider.
- **Sitemap filter**: `astro.config.mjs` excludes `/admin/`, `/tag/`, paginated `/blog/N/`, paginated `/en/blog/N/` — keep this in sync if you add new noindex-able archives.

## Commands

- `nvm use 22 && pnpm dev` — Start dev server (opens browser)
- `pnpm start` — Start dev server (no browser)
- `pnpm build` — Type-check and build for production
- `pnpm preview` — Preview production build locally
- `pnpm lint` — ESLint
- `pnpm format` — Prettier
- `pnpm test` — Vitest single run
- `pnpm test:watch` — Vitest watch mode

## External APIs (env vars required)

**Core (data):**

- `TURSO_DATABASE_URL` `TURSO_AUTH_TOKEN`
- `TMDB_API_KEY` — Movie metadata
- `LASTFM_API_KEY` — Last.FM / Audioscrobbler
- `STRAVA_CLIENT_ID` `STRAVA_CLIENT_SECRET` `STRAVA_REFRESH_TOKEN` (scope: `activity:read_all`)
- `RESEND_API_KEY` — transactional email (contact form, comment notifications)

**Admin:**

- `ADMIN_TOKEN` — admin secret. Visit `/admin?token=...` once: middleware sets the HttpOnly `vb_admin` session cookie (HMAC keyed by the token, 30 days) on that same response (no redirect: Netlify re-appends the query string to function redirects and it loops; `AdminNav` strips `?token=` from the address bar client-side). Cookie, `Authorization: Bearer` and `?token=` all stay valid. Cookie-authenticated POST/PUT/PATCH/DELETE need a same-origin `Origin`/`Referer` (CSRF). `/admin/logout` clears it. Rotating = change `ADMIN_TOKEN`. See `docs/admin-auth-spec.md`.

**Editorial Agents (Phase 1 — Idea Catcher Telegram bot):**

- `TELEGRAM_BOT_TOKEN` — from BotFather
- `TELEGRAM_SECRET_TOKEN` — `openssl rand -hex 32`; validates webhook calls
- `TELEGRAM_USER_ID_WHITELIST` — comma-separated Telegram user IDs allowed to message the bot
- `OPENAI_API_KEY` — Whisper transcription for voice messages (optional)
- `ANALYTICS_REPORT_CHAT_ID` — chat id for the weekly analytics report (optional; falls back to the first id of `TELEGRAM_USER_ID_WHITELIST`)
- `ANALYTICS_REPORT_DISABLED` — `1` disables the weekly report

## Contact form

`/contatti` and `/en/contact` (shared `src/components/ContactPage.astro` + `ContactForm.astro`, script `src/scripts/contact-form.ts`) → `POST /api/contact` → e-mail to the owner through Resend (`reply_to` = the visitor). Nothing about the message is stored. No cookies, no CAPTCHA, no third party; protection: honeypot, a small proof of work solved in the browser (`GET /api/contact/challenge` returns a signed, expiring, single-use challenge, HMAC key derived from `ADMIN_TOKEN`; `src/lib/contact.ts`), rate limits on a hashed IP plus a global daily cap (`src/lib/rate-limit.ts`), same-site Origin check, strict validation and the spam filter. If the mail service fails the visitor gets a ready-made `mailto:` with their text. Needs `RESEND_API_KEY` (503 `not_configured` without it). Never put the admin secret in an email.

## Comments + Claps System

- **Public Comments API**: `GET/POST /api/comments` — fetch approved comments (nested replies via `parentId`), submit new ones, author mode via admin cookie session (or Bearer); the form detects it at runtime with `GET /api/admin/me`
- **Comment Likes**: `POST /api/comments/like` — toggle like, visitor-hash anti-double-vote
- **Claps**: `GET/POST /api/posts/claps` — Medium-style claps (max 50 per visitor)
- **Admin API**: `GET/PATCH /api/admin/comments` — list pending, approve/delete (cookie session or Bearer + email notifications)
- **Admin UI**: `/admin/comments`
- **Anti-spam**: Honeypot hidden field (bots fill it, silently discarded). Email notifications via Resend.
- **Moderation**: All comments pending until manually approved.

## Analytics System

Cookieless, privacy-first. Spec: `docs/analytics-spec.md`; piano: `docs/superpowers/plans/2026-10-15-analytics-v2.md`.

- **Tracking**: `<script is:inline>` in `BaseHead.astro` → `POST /api/e`. `page_id` casuale (24 hex); beacon **cumulativo** (tempo visibile accumulato, inviato a ogni `hidden`/`pagehide`); l'UPDATE usa `MAX()` e richiede lo stesso `visitor_hash`.
- **Visitor hash** = HMAC-SHA256(salt giornaliero segreto, hostname:ip:ua) → 16 hex. Salt in `analytics_salts` (`src/lib/analytics-salt.ts`), cancellati dopo 2 giorni. `generateStableVisitorHash` (claps/likes/leaderboard) resta separato e invariato.
- **Country**: Netlify geo (`x-nf-geo`, `src/lib/geo.ts`), fallback timezone. **Channel**: `src/lib/channels.ts`. Referrer interni scartati.
- **Input**: validazione in `src/lib/analytics-input.ts` (host allow-list, Origin/Referer obbligatorio, path/UTM), rate limit 60/min per hash. Unicita atomica con `daily_visitors`.
- **localStorage**: solo il flag di opt-out `notrack` (dichiarato nella privacy policy). Nessuna coda di retry. La privacy policy (IT + EN) elenca anche gli eventi misurati.
- **Migrazione** (tutte le fasi, compresa la 5 con le colonne Web Vitals): `scripts/migrate-analytics-v2.ts` (idempotente; `/api/e` degrada se non applicata). Eseguire PRIMA del deploy.
- **Bot detection (Fase 4)**: tre categorie calcolate in lettura (`src/lib/bot-verdict.ts`): **bot** (`bot_score >= BOT_SCORE_THRESHOLD`=5 o hash in `bot_hashes`), **umano** (`human = 1`), **non verificato** (resto). `human` lo imposta l'evento `engage` del tracker (prima interazione o 3 s visibili, legato a `page_id` + `visitor_hash` come il beacon). `bot_score` si calcola all'ingest in `src/lib/bot-score.ts` (Accept-Language, Sec-Fetch-*, viewport, lingua/timezone, rate); i percorsi da scanner (`*.php`, `/.env`, `/wp-admin`...) sono scartati (204). Regole in `bot_rules` (`src/lib/bot-rules.ts`: `ua_contains|referrer_host|path_prefix|hash_today`, match = `bot_score` 99, cache 60 s), gestite da `/api/admin/bot-rules` (+ `/preview` con conteggio ultimi 7 giorni e quanti `human=1`). Le regole valgono dalle nuove visite, nessuna riga viene riscritta. Dettagli: `docs/analytics-spec.md` ("Bot detection").
- **LEGACY (da rimuovere ~2 settimane dopo il deploy della Fase 4)**: `/api/admin/bot`, pulsanti "Flag come bot"/"Flag zero-engagement"/"Annulla", 🤖, tabella `bot_hashes`, `summary_legacy`. Procedura di rimozione nella spec.
- **Dashboard**: `/admin/analytics` in stile GA con tab (`#panoramica #utenti #acquisizione #coinvolgimento #tecnologia #bot`): scorecard con delta e sparkline, grafico con periodo precedente, vista **Utenti** (sessioni recenti + dettaglio con cronologia, `GET /api/stats/sessions` keyset-paginato e `/api/stats/sessions/[id]`, in privacy solo `Utente #` + 6 caratteri dell'hash giornaliero), `/api/stats/live` con `active_sessions`. Markup in `analytics.astro`, stile `src/styles/admin-analytics.css`, logica nei moduli ES `public/admin/analytics/*.js`. Dati demo: `scripts/seed-analytics-demo.ts` (solo `TURSO_DATABASE_URL=file:...`, rifiuta altro). Dettagli: spec ("Dashboard in stile GA").
- **Stats query**: i campi principali di `/api/stats` contano solo `HUMAN_SQL`; `include=all` = umani + non verificati (`NOT BOT_SQL`, scope `all`); `quality`, `summary_legacy` (vecchio calcolo, `NOT_LEGACY_BOT_SQL`), `review` sempre presenti
- **Aggregati e retention (Fase 3)**: `daily_stats/daily_pages/daily_dims/rollup_log` (scope `human`|`all`, solo somme: le medie si ricalcolano), calcolati da `src/lib/analytics-rollup.ts` (`rollupDay` idempotente in un solo batch). Netlify Scheduled Function `netlify/functions/analytics-rollup.mts` (00:20 UTC: ieri + l'altro ieri, poi `pruneRaw`: raw 90 giorni solo se il giorno ha `rollup_log`; aggregati per sempre). `/api/stats` e ibrido (`src/lib/stats-hybrid.ts`): giorni chiusi dai rollup, oggi/non aggregati/filtro `pathname`/grafico orario da raw; risposta con `source {rollup_days, raw_days}`. La funzione legge `TURSO_*` da `Netlify.env`/`process.env` (non da `env()`) e usa import relativi. Backfill: `scripts/analytics-backfill.ts --from --to`; manuale: `POST /api/admin/analytics-rollup {from,to}` (max 400 giorni); `/api/admin/bot` invalida i rollup dei giorni degli hash flaggati (le regole bot non sono retroattive). Eseguire la migrazione PRIMA del deploy, poi il backfill.
- **Live counter**: `/api/stats/live` = visitatori distinti con `sessions.last_seen_at` negli ultimi 5 min (bot esclusi; umani + non verificati: un visitatore appena arrivato non ha ancora interagito). Senza la tabella `sessions` ricade sulle pageview.
- **Sessioni, eventi, obiettivi (Fase 2)**: sessione = stesso `visitor_hash`, pausa < 30 min (`src/lib/analytics-sessions.ts`, tabella `sessions`, `pageviews.session_id`); a mezzanotte UTC l'hash ruota e la sessione si divide (documentato). **Bounce reale** = 1 pageview e `engaged_seconds` < 10 (`sessions.bounce_rate`); `summary.bounce_rate` e il vecchio calcolo, invariato. Eventi: `window.va && window.va.track(name, prop)` dal tracker (assente con `notrack`/webdriver), `POST /api/e {type:"event"}`, whitelist e validazione prop in `src/lib/analytics-events.ts` (`clap, comment_submit, comment_like, contact_submit, outbound_click, download, not_found, scroll_75, scroll_100, copy_code, share`), legati a `page_id` + hash come i beacon; `scroll_*` una volta per `page_id`. Auto-strumentati dal tracker: link in uscita, download, copy in `pre/code`, scroll 75/100 sui post; a mano: claps, like/invio commenti (`contact_submit` = commento sulla pagina `contact`), share (`data-share`), 404. Obiettivi in `src/lib/analytics-goals.ts`. Rollup `daily_sessions/daily_events/daily_entry_exit/daily_goals` (SQL condiviso con la lettura raw in `analytics-session-stats.ts`). Retention: `sessions` 180 giorni, `events` 90 giorni, solo per i giorni rollupati. Nuovi campi di `/api/stats`: `sessions`, `channels`, `entry_pages`, `exit_pages`, `events`, `goals`. Migrazione PRIMA del deploy, poi rilanciare il rollup dei giorni recenti. Dettagli: `docs/analytics-spec.md` ("Sessioni, eventi e obiettivi").
- **Web Vitals, filtri, export, home, report (Fase 5)**: il tracker misura LCP/CLS/INP (`PerformanceObserver`, nessuna libreria) e li manda nel beacon cumulativo (`lcp_ms`, `cls`, `inp_ms`; server: `pageviews.lcp_ms/cls_milli/inp_ms`, LCP/INP ultimo valore, CLS `MAX`); rollup `daily_vitals` (bucket Google esatti, p75 esatto per giorno, su piu giorni media pesata dei p75 giornalieri = approssimazione), `/api/stats` ha `vitals` e `vitals_pages`. Filtri `country|device|channel` su `/api/stats` (`src/lib/analytics-filters.ts`): **solo raw**, periodo ridotto a 90 giorni. Export `GET /api/stats/export?kind=...` (CSV con guardia anti formula injection, `src/lib/csv.ts`). Card "Analytics oggi" in `/admin` (`src/lib/analytics-summary.ts`, soft failure; picco = oggi > 2x media dei 7 stessi giorni della settimana, min 10). Report Telegram settimanale: `src/lib/analytics-report.ts` + `netlify/functions/analytics-weekly-report.mts` (cron `0 6 * * 1` UTC, deriva DST di 1 h) e `POST /api/admin/analytics-report {send?}` (default dry run). Env: `ANALYTICS_REPORT_CHAT_ID` (fallback primo id di `TELEGRAM_USER_ID_WHITELIST`), `ANALYTICS_REPORT_DISABLED=1`. Dettagli: `docs/analytics-spec.md` ("Fase 5").
- **Migrazione Fase 4**: stesso `scripts/migrate-analytics-v2.ts` (aggiunge `human`, `bot_score`, `bot_rules`). Eseguirla PRIMA del deploy: `/api/e` degrada se manca, ma `/api/stats` richiede le colonne.

## Editorial Agents

A planned push-based editorial automation system. **Phase 1 (Idea Catcher) is live**, the rest is on the roadmap.

- **Strategy**: `docs/editorial-strategy.md` — audience priorities, columns, cadence
- **Voice**: `docs/voice-profile.md` — operative voice doc loaded by agents at runtime; anchor = `21-giorni-senza-alcol` post
- **System design**: `docs/superpowers/specs/2026-05-27-editorial-agents-design.md`
- **Phase 1 implementation plan**: `docs/superpowers/plans/2026-05-27-idea-catcher.md`
- **Setup guide**: `docs/setup/telegram-bot.md`

Phase 1 (Idea Catcher) endpoints:

- `POST /api/telegram/webhook` — Telegram Bot webhook. Validates `X-Telegram-Bot-Api-Secret-Token` header + `TELEGRAM_USER_ID_WHITELIST`. Returns 503 if `TELEGRAM_SECRET_TOKEN` env is empty (fail-closed). Handles: `/start`, `/help`, `/idea`, `/list`, `/done`, `/media`, `/tag`, voice (Whisper), photo (sharp), forwarded messages, plain text capture.

**Known limitation**: photo upload via `fs.writeFile("public/img/uploads/...")` works in dev but fails in production (Netlify Functions filesystem is read-only). Migrate to **Netlify Blobs** before relying on the photo flow. Inline TODO in `src/pages/api/telegram/webhook.ts` references the setup doc.

## Adding Content

- **New blog post**: Create `src/content/blog/{locale}/{slug}.md` with frontmatter (title, date, extract, tags, coverImage). Create both `it/` and `en/` versions.
- **New film**: Create `src/content/films/{locale}/{slug}.md` with frontmatter (title, year, role, status, sortOrder, coverImage, posterImage, plot, festivals). `posterImage` is the 2:3 poster for card thumbnails; `coverImage` is the 16:9 still for detail page. Create both `it/` and `en/` versions.
- **Festival laurels**: `public/img/{film-name}/laurels/*.png` — sharp-processed PNGs with alpha (chroma key on dark backgrounds, see `caramella` for the canonical pattern).

## Documentation Rule

When making significant changes (new features, architectural decisions, design choices), **always update**:

1. **`README.md`** — public-facing overview, stack, setup, routes table
2. **The relevant `docs/{feature}-spec.md`** — feature-level detail. If new, create it.
3. **This `CLAUDE.md`** if the change affects conventions or external APIs

Keep all three concise but complete enough for a future developer (or future you) to understand the reasoning.

## Specs

Le spec di ogni feature si trovano in `docs/{feature-name}-spec.md`. Alla fine di ogni feature (nuova o modificata), **aggiorna sempre la spec corrispondente** in `docs/`. Se la spec non esiste, creala.

Per progetti più grossi (sistemi che attraversano più feature, come gli editorial agents), la spec live in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` e il piano di implementazione step-by-step in `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`. Generati dalle skill `superpowers:brainstorming` + `superpowers:writing-plans`.
