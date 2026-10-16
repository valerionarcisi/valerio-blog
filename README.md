# valerionarcisi.me

Personal site of Valerio Narcisi — filmmaker, sceneggiatore, sviluppatore. Cortometraggi, blog tecnico-narrativo, pagina Codice (CV), dashboard private.

Live: <https://valerionarcisi.me>. Built with **Astro 7** on **Netlify**, content in Markdown, data layer on **Turso**.

---

## Stack

| Layer           | Choice                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| Framework       | Astro 7 (static + Netlify Functions for server endpoints)                                 |
| Language        | TypeScript strict, ESM                                                                    |
| Package manager | pnpm                                                                                      |
| Node            | 20+ (pnpm requires it)                                                                    |
| Styling         | Plain CSS, co-located per component (no framework)                                        |
| Design system   | **Dopamine Chamber** (public, dark) on top of **Foglio** tokens (admin keeps cream paper) |
| Database        | **Turso** (libsql) — comments, claps, analytics, editorial agents                         |
| Deployment      | Netlify (auto-deploy on push to `main`)                                                   |
| i18n            | Italian (default, no prefix) + English (`/en/`)                                           |

---

## Architecture

### Public pages

| Route                                        | What                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/`                                          | Home (dual-craft hero, blog featured + most read, films grid, recently watched/listened, about strip)                       |
| `/blog/[...page]`                            | Blog listing with paginated archive (page 2+ noindex,follow)                                                                |
| `/blog/[slug]`                               | Post detail with ToC, share buttons, claps, comments, related posts                                                         |
| `/films/` `/films/[slug]`                    | Film index + per-film detail with festival laurels, stills, awards                                                          |
| `/visti/`                                    | Films watched (Letterboxd + TMDB), with budget/revenue and unique directors stats                                           |
| `/ascolti/`                                  | Music listening from Last.FM (top albums, top artists, recent scrobbles)                                                    |
| `/tag/` `/tag/[tag]/[...page]`               | Tag index + per-tag archive (all tag pages noindex,follow)                                                                  |
| `/codice/` (`/en/code/`)                     | Code page built from the CV: numbers, experience, method, tools, technical posts                                            |
| `/who-i-am/` `/contatti/` `/privacy-policy/` | About, contact, privacy                                                                                                     |
| `/non-fa-ridere/`                            | Coming-soon page for the short film, with a Canvas mini-game (Filippo throws pizzas at the cast) + global Turso leaderboard |
| `/en/...`                                    | English mirror                                                                                                              |

Public pages use the **Dopamine Chamber** design system (`src/styles/dc.css`, spec: `docs/dopamine-chamber-spec.md`): dark-only, cinema vocabulary, `<html class="foglio dc">`. It remaps the **Foglio** tokens (`src/styles/foglio.css`, `--foglio-*`), which admin pages still use as-is. Blog posts take an optional `mood: quiet` frontmatter field for personal posts (no distortion).

### Content layer

- Blog posts: `src/content/blog/{locale}/{slug}.md`
- Films: `src/content/films/{locale}/{slug}.md`
- Watched movies: refreshed at build time + client-side from `/api/letterboxd` (fresh logs appear without redeploy — `docs/letterboxd-spec.md`)
- Music: Last.FM at build time

### API endpoints

All endpoints use a **`Result<T, E>` pattern** — no thrown exceptions, no silent failures. Every handler is a pipeline:

```
parseJsonBody → parseInput → dbQuery → jsonOk / jsonErr
```

**Public:**

- `GET/POST /api/comments` — public comments (nested replies via `parentId`; author mode via admin cookie session or Bearer)
- `POST /api/comments/like` — toggle like on a comment (visitor hash anti-double-vote)
- `GET/POST /api/posts/claps` — Medium-style claps on blog posts (max 50 per visitor)
- `GET/POST /api/non-fa-ridere/scores` — global leaderboard for the "Non Fa Ridere" mini-game (top 10, best score per name, server-side score clamping)
- `GET /api/letterboxd` `GET /api/lastfm` `GET /api/contact` — data fetchers + form
- `GET /api/search.json` — full-text site search
- `POST /api/e` — privacy-first analytics tracker (no cookies, anonymous visitor hash)
- `GET /api/t` — legacy bot-trap endpoint, kept as no-op

**Admin (cookie session or Bearer token):**

- `GET /api/stats` — analytics aggregates (pageviews, visitors, top pages, devices, geo, UTM, recent visitors, suspicious)
- `GET /api/stats/sessions` — admin: recent sessions for the dashboard "Utenti" view (keyset pagination, verdict/country/device/channel filters); `GET /api/stats/sessions/[id]` — session timeline; `GET /api/stats/live` — online now + `active_sessions`
- `GET /api/stats/export?kind=top_pages|referrers|utm|channels|events|goals|daily` — CSV export of analytics tables (admin; CSV-injection safe)
- `POST /api/admin/analytics-report` — weekly analytics Telegram report: dry run by default (`{}`), `{"send":true}` delivers; the Scheduled Function `netlify/functions/analytics-weekly-report.mts` sends it on Mondays
- `GET /api/stats/live` — online-now counter (distinct visitor_hash in last 5 min, excludes flagged bots)
- `GET/PATCH /api/admin/comments` — comment moderation (email notifications on approve/reject)
- `GET /api/admin/claps` — claps recap by post
- `POST /api/admin/analytics-rollup` — (re)compute daily analytics rollups for `{from, to}` (max 400 days); the nightly Netlify Scheduled Function `netlify/functions/analytics-rollup.mts` does it automatically and prunes raw pageviews older than 90 days
- `POST /api/admin/bot` — flag suspicious visitors as bots (single, bulk, or auto-flag-suspects)
- `GET /api/analytics-report` — weekly analytics report as plain text, read-only Bearer `ANALYTICS_REPORT_TOKEN` (fetched by the HAL bot on the NAS, which delivers it on Telegram)

**Editorial Agents (Bearer / Telegram secret):**

- `POST /api/telegram/webhook` — Telegram Bot webhook (Phase 1: Idea Catcher). Validates `X-Telegram-Bot-Api-Secret-Token` header + user-ID whitelist (`TELEGRAM_USER_ID_WHITELIST`). Routes voice (Whisper), photo (sharp), text commands (`/idea`, `/list`, `/done`, `/media`, `/tag`, `/help`), and forwarded messages.

### Functional core (`src/lib/`)

| Module                                                                | What                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `result.ts`                                                           | `Result<T, E>`, `pipe()`, `andThen()`, `jsonOk()`, `jsonErr()`, `parseJsonBody()`, validators |
| `auth.ts`                                                             | `verifyBearerToken()`, timing-safe compare                                                    |
| `turso.ts`                                                            | Singleton Turso client                                                                        |
| `env.ts`                                                              | Centralised env var access                                                                    |
| `analytics.ts`                                                        | Bot detection (`isBot()`), visitor hashing, UA parsing                                        |
| `editorial-ideas.ts`                                                  | DB layer for `editorial_ideas` table (Idea Catcher)                                           |
| `media-library.ts`                                                    | DB layer for `media_library` table                                                            |
| `telegram.ts`                                                         | Telegram Bot API client (sendMessage, getFile, downloadFile)                                  |
| `whisper.ts`                                                          | OpenAI Whisper transcription                                                                  |
| `image-processing.ts`                                                 | sharp resize 1600px + JPEG q82 + EXIF strip                                                   |
| `top-posts.ts` `post-stats.ts` `format-money.ts` `letterboxd-slug.ts` | Misc helpers                                                                                  |

### Components

Built with co-located CSS files. Key reusable atoms:

- `FoglioHeader` `FoglioFooter` — public chrome (nav with phone menu, end-credits footer); `DcHome` `DcCode` `DcFilters` — Dopamine Chamber home, code page, shared SVG filters
- `BaseHead` — meta tags, hreflang, OG, JSON-LD, analytics injection
- `Comments` — full comment thread with auto-login, likes, nested replies
- `ShareButtons` — X/LinkedIn/Reddit + Web Share API fallback
- `RelatedPosts` — same-tag suggestions
- `ActivityHeatmap` — annual squares for any daily-activity dataset
- `AdminNav` — sidebar nav for `/admin/*` pages

---

## Admin

Private dashboards under `/admin/` (visit `/admin?token=<ADMIN_TOKEN>` once: an HttpOnly session cookie is set and the token is stripped from the URL; see `docs/admin-auth-spec.md`):

| Page                     | What                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/analytics`       | GA-style analytics dashboard (Panoramica, Utenti, Acquisizione, Coinvolgimento, Tecnologia, Bot & qualità): live users, sessions timeline, scorecards with deltas, geo map, bot rules |
| `/admin/comments`        | Moderation queue + claps recap + activity feed                                                                                                                                        |
| `/admin`                 | "Oggi" home: next event countdown, today's analytics and meals, links to every page                                                                                                   |
| `/admin/body-comp`       | BIA body composition with charts (FFM, FM, BMI, BMR, PhA) and a "last measurement" banner                                                                                             |
| `/admin/meal-plan`       | Tabs: weekly plan, shopping list (`#spesa`), recipes (`#ricette`); `/admin/grocery` and `/admin/recipes` redirect                                                                     |
| `/admin/arte-di-narrare` | One-off event page (Rome, 18 Oct 2026): schedule, parking and travel times                                                                                                            |
| `/admin/radar`           | Film opportunities radar (bandi/call/pitch) — deadline-sorted cards from `src/data/radar.json` (served via `GET /api/admin/radar`), filters + search                                  |

`src/data/radar.json` is the single data source for `/admin/radar`, regenerated **weekly** by a
GitHub Actions workflow (`.github/workflows/radar-weekly.yml`): `scripts/radar-update.mjs`
web-researches film opportunities via the Anthropic API (Haiku + web search), rewrites the file,
`scripts/radar-notify.ts` notifies new items via the Telegram bot, then it commits & pushes →
Netlify deploys. Requires GitHub Secrets `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_USER_ID_WHITELIST`. To update manually, edit `src/data/radar.json` and push, or run the
workflow from the Actions tab. See `docs/radar-spec.md` and `docs/radar-agent.md`.

---

## Editorial Agents (work in progress)

The site is the foundation for an **editorial automation system** that helps Valerio publish without remembering to — push-based, not pull-based. The full design lives at `docs/superpowers/specs/2026-05-27-editorial-agents-design.md`. Six planned agents (Idea Catcher live, others on roadmap):

| Phase | Agent                                                                                         | Status     |
| ----- | --------------------------------------------------------------------------------------------- | ---------- |
| 1     | **Idea Catcher** — Telegram bot for capturing ideas, voice (Whisper), photo uploads, forwards | ✅ Live    |
| 2     | **Distributor** — auto-drafts LinkedIn/Bluesky/Reddit posts when a new blog post is deployed  | 🟡 Planned |
| 3     | **Curator** — drafts Letterboxd reviews (IT + EN) when a new film is logged via RSS           | 🟡 Planned |
| 4     | **Analyst** — weekly digest of GSC + analytics + idea suggestions                             | 🟡 Planned |
| 5     | **Instagram Story Publisher** — Story templates for festival/set moments                      | 🟡 Planned |
| 6     | **Drafter** — outline + opening generator for pillar essays from idea queue                   | 🟡 Planned |

Strategy and voice are codified separately:

- `docs/editorial-strategy.md` — the "constitution": audience priorities, content columns, cadence, what we never publish
- `docs/voice-profile.md` — operative voice doc loaded by agents at runtime; anchor is the `21-giorni-senza-alcol` post

### Setting up the Telegram bot

See `docs/setup/telegram-bot.md` for the full BotFather → env vars → webhook → smoke-test walkthrough.

---

## Performance & SEO

| Metric                                        | Where                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Lighthouse mobile (home/film/visti/blog post) | **96-100** Performance, **96-100** Accessibility, **100** Best Practices, **100** SEO                       |
| CLS                                           | 0 across the board (via `font-display: optional`)                                                           |
| LCP                                           | 0.2-0.6s                                                                                                    |
| Sitemap                                       | `/sitemap-index.xml`, paginated archives + `/tag/*` + `/admin/*` + `/api/*` excluded via `astro.config.mjs` |
| Security headers                              | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (configured in `netlify.toml`) |
| Cache                                         | `/img/*` `/videos/*` `/fonts/*` → `Cache-Control: public, max-age=31536000, immutable`                      |

---

## Setup

```bash
pnpm install
cp .env.example .env  # fill in vars (see below)
nvm use 22            # Astro 7 requires Node 22.12+
pnpm dev              # dev server on :4321
```

### Environment variables

**Core (data):**

```
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
TMDB_API_KEY
LASTFM_API_KEY
RESEND_API_KEY              # transactional email (contact form, comment notifications)
```

**Admin / private:**

```
ADMIN_TOKEN                 # /admin/* and Bearer auth on /api/admin/*
```

**Editorial Agents (Phase 1):**

```
TELEGRAM_BOT_TOKEN          # BotFather
TELEGRAM_SECRET_TOKEN       # openssl rand -hex 32; validates webhook calls
TELEGRAM_USER_ID_WHITELIST  # comma-separated Telegram user IDs allowed to message the bot
OPENAI_API_KEY              # Whisper transcription for voice messages (optional — voice fails gracefully if missing)
```

---

## Commands

```bash
pnpm dev          # dev server (opens browser)
pnpm start        # dev server (no browser)
pnpm build        # type-check + build
pnpm preview      # preview production build
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm test         # Vitest (305+ tests)
pnpm test:watch   # Vitest watch mode
```

---

## Docs

Feature-level specs are in `docs/`. Each adds context that a future developer (or future me) needs to understand a decision or a non-obvious mechanism.

| Doc                                                      | What                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `analytics-spec.md`                                      | Cookieless analytics system, bot detection, suspect flagging                   |
| `blog-spec.md`                                           | Blog list + post layout decisions                                              |
| `comments-spec.md`                                       | Comments + likes + moderation flow                                             |
| `contact-spec.md`                                        | Contact form + Resend transactional email                                      |
| `lastfm-spec.md`                                         | Last.FM ingestion + `/ascolti`                                                 |
| `letterboxd-spec.md`                                     | Letterboxd RSS + TMDB enrichment + `/visti` client refresh                     |
| `meal-plan-spec.md` `body-comp-spec.md` | Admin dashboards                                                               |
| `post-claps-spec.md`                                     | Medium-style claps system                                                      |
| `telegram-bot-spec.md`                                   | Idea Catcher Telegram bot details                                              |
| `editorial-strategy.md`                                  | Editorial constitution (audience, columns, cadence)                            |
| `voice-profile.md`                                       | Voice profile loaded by agents at runtime                                      |
| `non-fa-ridere-spec.md`                                  | `/non-fa-ridere/` coming-soon page + arcade mini-game + leaderboard (as built) |
| `non-fa-ridere-game-spec.md`                             | Superseded early brainstorm (interactive-fiction concept)                      |
| `porting-foglio-plan.md`                                 | Migration plan to the Foglio design system                                     |
| `setup/telegram-bot.md`                                  | Telegram bot setup walkthrough                                                 |
| `superpowers/specs/`                                     | Larger system designs                                                          |
| `superpowers/plans/`                                     | Step-by-step implementation plans for agentic subagent execution               |

---

## Conventions

- **Path alias**: `~/` → `src/` (`tsconfig.json` + `vite.config`)
- **CSS**: co-located next to components (`Foo.astro` + `Foo.css`)
- **Comments**: explain _why_, not _what_ — self-documenting code via well-named functions
- **Result pattern**: every API endpoint returns `Result<T, E>`; validation via `parse*()` helpers; responses via `jsonOk()` / `jsonErr()`
- **No Zod**: guards in `~/lib/result` (`isValidDate`, `isNonEmptyString`, `isValidEmail`, `clampInt`, `parseJsonBody`). Plain TypeScript validation, zero new deps.
- **Tests**: Vitest, co-located `*.test.ts` (or `_*.test.ts` under `src/pages/` to escape Astro routing)
- **Specs**: keep `docs/*-spec.md` in sync with reality. When you change a feature, update its spec.
