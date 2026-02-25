# Valerio Blog

Personal blog and portfolio site for Valerio Narcisi (web developer, director, screenwriter).

## Tech Stack

- **Framework**: Astro 5 (static site generation + server endpoints via Netlify adapter)
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm
- **Styling**: Plain CSS with co-located CSS files (normalize.css reset, no CSS framework)
- **Fonts**: Merriweather (body), Staatliches (headings), JetBrains Mono (code/mono)
- **Deployment**: Netlify (static pages + serverless functions for API endpoints)
- **Comments**: Self-hosted system with Turso (SQLite edge DB) + custom API endpoints
- **Database**: Turso (libsql) for comments storage and moderation

## i18n

- **Default locale**: Italian (`it`), no URL prefix
- **Secondary locale**: English (`en`), URL prefix `/en/`
- **Config**: `prefixDefaultLocale: false` in `astro.config.mjs`
- **UI translations**: `src/i18n/ui.ts`
- **Helpers**: `src/i18n/utils.ts` — `getLangFromUrl()`, `useTranslations()`

## Content Architecture

- **Blog posts**: Astro Content Collections in `src/content/blog/{locale}/{slug}.md`
- **Films**: Astro Content Collections in `src/content/films/{locale}/{slug}.md`
- **Movies watched**: Fetched from Letterboxd RSS + TMDB API at build time
- **Music**: Fetched from Last.FM API at build time

## Project Structure

```
src/
  components/    # Reusable Astro components with co-located CSS
  content/       # Content collections
    blog/        # Blog posts organized by locale (it/, en/)
    films/       # Film data organized by locale (it/, en/)
  i18n/          # Translation dictionary and helpers
  layouts/       # Page layouts (BlogPost, Blog, FilmPage)
  lib/           # Shared utilities (turso client)
  pages/         # Route pages (IT default, no prefix)
    blog/        # Italian blog listing and [slug] pages
    films/       # Italian films listing and [slug] pages
    tag/         # Italian tag filter pages
    admin/       # Admin pages (comments moderation)
    en/          # English pages (prefixed /en/)
      blog/
      films/
      tag/
    api/         # API endpoints (search, comments, admin)
  services/      # External API integrations (Letterboxd, TMDB, Last.FM)
  styles/        # Global styles
public/
  img/           # Static images organized by section
  videos/        # Static video files
```

## Conventions

- **Path alias**: Use `~/` to reference `src/` (configured in tsconfig.json)
- **CSS**: Co-located CSS files next to components (e.g., `Card.astro` + `Card.css`)
- **No comments explaining what**: Use self-documenting code. Comments only for "why"
- **Content collections**: Astro 5 glob loader. Slugs derived from filenames. Locale from directory
- **Images**: Blog covers may be external URLs. Film images in `public/img/{film-name}/`
- **Server endpoints**: Use `export const prerender = false` on API routes. Turso client via `getDb()` from `~/lib/turso`

## Commands

- `pnpm dev` — Start dev server (opens browser)
- `pnpm start` — Start dev server (no browser)
- `pnpm build` — Type-check and build for production
- `pnpm preview` — Preview production build locally
- `pnpm lint` — Run ESLint
- `pnpm format` — Format with Prettier

## External APIs (env vars required)

- `TMDB_API_KEY` — Movie metadata from TMDB
- `LASTFM_API_KEY` — Music data from Last.FM / Audioscrobbler
- `TURSO_DATABASE_URL` — Turso SQLite edge database URL
- `TURSO_AUTH_TOKEN` — Turso authentication token
- `COMMENTS_ADMIN_TOKEN` — Secret token for comments admin page

## Comments System

- **Public API**: `GET/POST /api/comments` — fetch approved comments, submit new ones
- **Admin API**: `GET/PATCH /api/admin/comments` — list pending, approve/delete (Bearer token auth)
- **Admin UI**: `/admin/comments?token=COMMENTS_ADMIN_TOKEN`
- **Anti-spam**: Honeypot hidden field (bots fill it, silently discarded)
- **Moderation**: All comments pending until manually approved via admin page
- **Component**: `Comments.astro` with inline i18n labels (IT/EN), client-side JS via `<script is:inline>`

## Adding Content

- **New blog post**: Create `src/content/blog/{locale}/{slug}.md` with frontmatter (title, date, extract, tags, coverImage). Create both `it/` and `en/` versions.
- **New film**: Create `src/content/films/{locale}/{slug}.md` with frontmatter (title, year, role, status, sortOrder, coverImage, plot, etc.). Create both `it/` and `en/` versions.

## Documentation Rule

When making significant changes (new features, architectural decisions, design choices), **always update the README.md** with:
- What was added/changed and why
- Design decisions and trade-offs (e.g., why Turso over Supabase, why self-hosted comments over SaaS)
- How it works (architecture, data flow)
- Setup instructions if new env vars or services are needed
- Keep it concise but complete enough for a future developer (or future you) to understand the reasoning
