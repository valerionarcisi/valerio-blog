# Valerio Blog

Personal blog and portfolio site for Valerio Narcisi (filmmaker, sceneggiatore, sviluppatore).

## Tech Stack

- **Framework**: Astro 5 (static site generation + Netlify Functions for server endpoints)
- **Language**: TypeScript (strict mode), ESM
- **Package Manager**: pnpm
- **Node**: 20+ (pnpm requires it). Always `nvm use 20` before pnpm commands.
- **Styling**: Plain CSS, co-located CSS files next to components. No CSS framework.
- **Design system**: **Foglio** — cream paper (`#f6f1e8`), EB Garamond serif (display + prose), Inter sans (body fallback), JetBrains Mono, terracotta accent (`#a8451a`). Tokens in `src/styles/foglio.css` (`--foglio-*`).
- **Deployment**: Netlify (static pages + serverless functions). Auto-deploy on push to `main`.
- **Database**: Turso (libsql) for comments, claps, analytics, meditation, editorial agents queue, game leaderboard (`/non-fa-ridere/`).

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
    admin/           # Private dashboards (?token=...)
    en/              # English mirror
    api/             # API endpoints
      admin/         # Bearer-token protected
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
- **No comments explaining what**: Self-documenting code via well-named functions. Comments only for *why*.
- **Content collections**: Astro 5 glob loader. Slugs derived from filenames. Locale from directory (`it/`, `en/`).
- **Images**: Blog covers may be external URLs or `/img/blog/{slug}/cover.jpg`. Film images in `public/img/{film-name}/`. Process new uploads with sharp (resize 1600px, JPEG q82, strip EXIF). Festival laurels for films go in `public/img/{film-name}/laurels/`.
- **Server endpoints**: Use `export const prerender = false` on API routes. Turso client via `getDb()` from `~/lib/turso`. Env vars via `env()` from `~/lib/env`.
- **Result pattern**: Tutti gli endpoint API usano `Result<T, E>` da `~/lib/result` per rendere espliciti successo/fallimento. Parsing input con funzioni `parse*()` che ritornano `Result`. Risposte via `jsonOk()` / `jsonErr()`.
- **Pipe**: `pipe()` da `~/lib/result` per comporre trasformazioni in modo leggibile. `andThen()` per concatenare operazioni su `Result`.
- **Validation**: Guardie di tipo condivise in `~/lib/result` (`isValidDate`, `isNonEmptyString`, `isValidEmail`, `clampInt`, `parseJsonBody`). Niente Zod — zero dipendenze, validazione plain TypeScript.
- **Tests**: Vitest with co-located `*.test.ts` files. Mock libsql via `vi.mock("~/lib/turso", ...)` with in-memory `createClient({ url: ":memory:" })`. Mock `env()` via `vi.mock("~/lib/env", ...)`. **Note**: test files inside `src/pages/` must be prefixed `_` (e.g. `_webhook.test.ts`) or Astro will pick them up as routes.
- **Sitemap filter**: `astro.config.mjs` excludes `/admin/`, `/tag/`, paginated `/blog/N/`, paginated `/en/blog/N/` — keep this in sync if you add new noindex-able archives.

## Commands

- `nvm use 20 && pnpm dev` — Start dev server (opens browser)
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
- `ADMIN_TOKEN` — `/admin/*` and Bearer auth on `/api/admin/*`

**Editorial Agents (Phase 1 — Idea Catcher Telegram bot):**
- `TELEGRAM_BOT_TOKEN` — from BotFather
- `TELEGRAM_SECRET_TOKEN` — `openssl rand -hex 32`; validates webhook calls
- `TELEGRAM_USER_ID_WHITELIST` — comma-separated Telegram user IDs allowed to message the bot
- `OPENAI_API_KEY` — Whisper transcription for voice messages (optional)

## Comments + Claps System

- **Public Comments API**: `GET/POST /api/comments` — fetch approved comments (nested replies via `parentId`), submit new ones, auto-login returning authors via Bearer token
- **Comment Likes**: `POST /api/comments/like` — toggle like, visitor-hash anti-double-vote
- **Claps**: `GET/POST /api/posts/claps` — Medium-style claps (max 50 per visitor)
- **Admin API**: `GET/PATCH /api/admin/comments` — list pending, approve/delete (Bearer token + email notifications)
- **Admin UI**: `/admin/comments?token=ADMIN_TOKEN`
- **Anti-spam**: Honeypot hidden field (bots fill it, silently discarded). Email notifications via Resend.
- **Moderation**: All comments pending until manually approved.

## Analytics System

Cookieless, privacy-first. Anonymous visitor hash = SHA-256(date + hostname + IP + UA).

- **Tracking**: client-side `<script is:inline>` in `BaseHead.astro` → `POST /api/e`
- **Bot detection**: UA-based via `isbot` library + admin can flag specific `visitor_hash` as bot via `/api/admin/bot`
- **Dashboard**: `/admin/analytics` — live online counter (30s polling), aggregates, geo map (Leaflet), bot flagging
- **Stats query excludes** `visitor_hash IN bot_hashes` from all counts (`baseWhere` in `stats.ts`)
- **Live counter**: `/api/stats/live` returns DISTINCT visitor_hash in last 5 min, excludes bots

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
