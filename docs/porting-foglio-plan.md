# Porting plan — Foglio redesign

Branch: `redesign/foglio`  
Started: 2026-05-26  
Lead reference: mockups in `src/pages/admin/mockups/`

---

## Preservation contract

Things that must never regress during the port:

| What | Why |
|------|-----|
| All public URLs (`/blog/[slug]`, `/films/[slug]`, `/tag/*`, `/en/*`) | SEO + inbound links |
| `/who-i-am` and `/en/who-i-am` | Stable about-page URLs |
| API endpoints (`/api/comments`, `/api/search`, `/api/admin/*`) | Comments system + search live in production |
| Admin zone (`/admin/comments`, `/admin/mockups`) | Internal tooling |
| RSS feed (`/rss.xml`) | Letterboxd + feed readers |
| Turso schema (comments, post_claps, pageviews tables) | No DB migrations without an explicit migration script |
| i18n routing (`prefixDefaultLocale: false`) | IT = `/`, EN = `/en/` |
| Result pattern + pipe utilities in `~/lib/result` | Used across all API endpoints |
| Dark mode: `prefers-color-scheme` + `html[data-theme]` | Already shipped in Foglio tokens |

---

## What the Foglio scope does NOT touch (yet)

- Legacy pages still using `Layout.astro` / `BlogPost.astro` — they keep their dark CSS until explicitly ported
- `src/styles/global.css`, `src/styles/typography-optimized.css` — left untouched; `.foglio` scope isolates the new design
- Comments component — will be restyled to Foglio tokens in Slice D, not before

---

## Sequential slices

### ✅ Foundation (done)
- `src/styles/foglio.css` — design tokens, dark mode, compat fixes
- `src/styles/fonts.css` — added EB Garamond + Inter via @fontsource
- `FoglioLayout.astro`, `FoglioHeader.astro`, `FoglioFooter.astro`
- Pilot page: `/who-i-am` (IT) — uses FoglioLayout, full content

### Slice A — Blog post + listing
- `FoglioPostLayout.astro`: cover hero, sticky ToC (collapsible on mobile via `<details>`), sidenotes, code blocks
- Port `/blog/[slug].astro` + `/en/blog/[slug].astro`
- Port `/blog/[...page].astro` + `/en/blog/[...page].astro`
- Port tag pages `/tag/[tag].astro` + `/en/tag/[tag].astro`

### Slice B — Films
- `FoglioFilmLayout.astro`: poster with passe-partout frame, synopsis, lightbox gallery for stills
- Port `/films/[slug].astro` + `/en/films/[slug].astro`
- Port `/films/index.astro` + `/en/films/index.astro`

### Slice C — Home
- Port `/index.astro` + `/en/index.astro`
- Sections: hero + portrait, Adesso note (inline, disappears if empty), Film grid, Blog spread, Library (Visti/Ascoltato), About strip
- Filter chips max 5, simplified

### Slice D — Cleanup + polish
- Restyle Comments component to Foglio tokens
- Move Strava dashboard to `/admin/activities`
- 404 page (`/404.astro`) restyled
- OG image updates
- Privacy / contact pages restyled
- Final accent discipline audit (max 3-4 terracotta instances per page)

---

## Accent discipline (terracotta `#a8451a` / dark `#d9874e`)

Three functional roles only:
1. **H1 keyword** — one `<em class="acc">` per page title
2. **Status badges / CTAs** — `.foglio-status--stabile`, `.foglio-readmore`
3. **Hover states** — nav links, footer links on hover

Rule: italic ≠ accent. `<em>` is ink by default; add `.acc` only to opt in to terracotta.

---

## Agent strategy

Each slice = one focused agent spawned on `redesign/foglio` branch.  
A "lead" agent validates after each slice by:
1. Running `pnpm build` — must pass with 0 errors
2. Checking that no legacy-dark colors leak into `.foglio`-scoped pages
3. Verifying no existing URL returns 404

Agents are spawned only when the previous slice is committed and build passes.
