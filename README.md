# valerionarcisi.me

Personal blog and portfolio — web developer, director, screenwriter.

Built with **Astro 5**, deployed on **Netlify**, content in Markdown.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Astro 5 (SSG + Netlify serverless functions) |
| Language | TypeScript strict |
| Package manager | pnpm |
| Styling | Plain CSS, co-located per component |
| Database | Turso (SQLite edge) — comments + meditation |
| Deployment | Netlify (auto-deploy on push to `main`) |
| i18n | Italian (default, no prefix) + English (`/en/`) |

---

## Architecture

### Content
- Blog posts and films live in `src/content/` as Markdown files, organized by locale (`it/`, `en/`)
- External data fetched at build time: **Letterboxd** (movies), **Last.FM** (music), **Strava** (sport)
- **Watched movies** also refresh client-side: pages render the build-time list as a fallback, then fetch `/api/letterboxd` on load so a freshly-logged film appears without a redeploy (see `docs/letterboxd-spec.md`)

### API Endpoints
All endpoints use a `Result<T, E>` pattern — no exceptions, no silent failures. Every handler is a pipeline:

```
parseJsonBody → parseInput → dbQuery → jsonOk / jsonErr
```

- `GET/POST /api/comments` — public comments (nested replies via `parentId`; author auto-login via Bearer token)
- `POST /api/comments/like` — toggle like on a comment (visitor hash anti-double-vote)
- `GET/POST /api/posts/claps` — Medium-style claps on blog posts (max 50 per visitor)
- `GET/PATCH /api/admin/comments` — moderation (Bearer token), email notifications on approve/reject
- `GET /api/admin/claps` — claps recap by post (Bearer token)
- `GET/POST/DELETE /api/admin/meditation` — meditation session tracking

### Functional core (`src/lib/`)
- `result.ts` — `Result<T,E>`, `pipe()`, `andThen()`, `jsonOk()`, `jsonErr()`, `parseJsonBody()`
- `meditation.ts` — `parseSessionInput()`, `parseDeleteId()`
- `auth.ts` — `verifyBearerToken()`
- `turso.ts` — singleton Turso client

---

## Admin

Private pages under `/admin/` (protected by `ADMIN_TOKEN`):

- `/admin/meditation` — Vipassana timer, heatmap, adaptive annual plan, streak
- `/admin/meal-plan` — weekly meal plan
- `/admin/body-comp` — BIA body composition tracking
- `/admin/grocery` — shopping list from meal plan
- `/admin/recipes` — recipes with dosages
- `/admin/comments` — comment moderation

---

## Setup

```bash
pnpm install
cp .env.example .env  # fill in the vars below
pnpm dev
```

### Environment variables

```
TMDB_API_KEY
LASTFM_API_KEY
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
ADMIN_TOKEN
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
STRAVA_REFRESH_TOKEN
```

---

## Commands

```bash
pnpm dev      # dev server
pnpm build    # type-check + build
pnpm preview  # preview production build
pnpm lint     # ESLint
pnpm format   # Prettier
```

---

## Specs

Feature specs are in `docs/`. Each feature has its own `{feature}-spec.md`.
