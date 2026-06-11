# Non Fa Ridere — coming-soon page + mini-game

Coming-soon page for the short film **Non Fa Ridere** (written/directed by Valerio Narcisi). While the film is in post, the page hosts a small arcade game themed on the script, with a global leaderboard.

## Routes

- `/non-fa-ridere/` (it) and `/en/non-fa-ridere/` (en) — film-detail layout (`ff-*` from `FoglioFilmLayout.css`): cover, single-column plot, embedded game + leaderboard, backstage stills gallery with lightbox. Public and indexed (in sitemap). Also listed as an in-production film at `/films/non-fa-ridere/`.
- `GET/POST /api/non-fa-ridere/scores` — leaderboard endpoint (`prerender = false`).

## The game

Side-scrolling platformer (Super-Mario shaped). Filippo the pizza maker runs through the night, throwing pizzas and stomping the characters from the script across **four levels**.

- **Controls**: `←`/`→` run, `↑` jump, `Space` throw a pizza. Touch: on-screen round buttons (◀▶ left, jump/pizza right) inside the stage.
- **Kill**: hit an enemy with a pizza, or jump on its head Mario-style. Tea is a friend — hitting her costs a life.
- **Lives**: 3. Lose one on contact with an enemy (70-tick i-frames).
- **Mobile**: the game enters fullscreen on start and exits on game over. Native fullscreen where available, CSS `position:fixed` fallback for iOS Safari. Canvas centred (`contain`).
- **Juice**: floating score popups, mozzarella splat particles, a combo multiplier (consecutive kills within ~90 ticks, ×1.25 per extra), screen shake on hits/damage.

### Levels

| # | Scene | Goal |
|---|---|---|
| 1 | La Sala | clear 10 clients |
| 2 | Il Bar | clear 10 (drunks, bottle shelves, "PECORINO AMARO" chalkboard) |
| 3 | La Cucina | clear 10 cooks; **Tea** mini-boss (6 HP) enters after 6 kills |
| 4 | Il Palco (Open Grezzo) | beat **Giulio**, the final boss (10 HP) |

Spawn favours the front (≈72% from ahead). Music is procedural punk (WebAudio), faster/tenser per level (172→178→196→212 BPM).

### Cast (enemies) — from the script

| Character | Behaviour | Points |
|---|---|---|
| Vecchia | slow, common ("Gemma… signore mio!") | 10 |
| Rider | fast (the late delivery driver) | 15 |
| Comico | 2 HP, hops | 25 |
| Michele (il comico) | staggers, mic in hand (bar level) | 30 |
| Cuoco | 2 HP (kitchen level) | 20 |
| Nonno | floats low, killable by pizza/stomp, harmless on contact | 50 |
| Tea | **friend** — hitting her costs a life and points; let her pass | — |
| Tea (mini-boss) | kitchen guardian, 6 HP | 100 |
| Giulio | **final boss**, 24 HP, chases Filippo and enrages (faster + dashes) under 40% HP ("te tiro dentro a lu forno!") | 600 |

Bosses show a name label (TEA / GIULIO) over their health bar. **Filippo (player) and Giulio (final boss) wear the real people's faces** — cropped from photos, treated to a warm sepia duotone + grain, circular-masked, and drawn as a head over the pixel body **Filippo, Giulio, Tea, Nonno and Michele** all wear the real actors' faces, treated the same way (sepia duotone + grain + circular mask) — frames pulled from the film cut (Filippo from a set photo, bandana profile that flips with direction). `ENEMY_FACES` maps character → treated face (`giulio/tea/nonno/michele-face.png`); rider, vecchia and cuoco stay pixel. (`filippo-face.png` = **Giacomo Bottoni** in character.). The other characters are pixel sprites.

## Leaderboard

- **Storage**: Turso table `game_scores` (`game_id`, `name`, `score`, `visitor_hash`, `created_at`).
- **Top query**: best score per `name`, ordered desc, limit 10.
- **Anti-cheat (best-effort)**: scores submitted client-side, so the server validates and clamps — non-negative integer, rejected above `MAX_PLAUSIBLE_SCORE` (1,000,000). Names trimmed, control chars stripped, capped at 24 chars, empty → "Anonimo". This stops accidental/garbage payloads; it is not tamper-proof (a determined user can POST a plausible score). Acceptable for a toy leaderboard.
- **Best score** also cached in `localStorage` (`nfr-best`) for offline bragging.

## Files

- `src/lib/leaderboard-api.ts` — deep module: `parseNewScore` (Result), `submitScore`, `topScores`, table bootstrap (`ensureTable`, idempotent per client via WeakSet).
- `src/pages/api/non-fa-ridere/scores.ts` — GET/POST, reuses analytics visitor-hash + Result helpers.
- `src/components/NonFaRidereGame.astro` — self-contained Canvas game (vanilla JS, zero deps), Foglio palette, scoped CSS, leaderboard UI.
- `src/pages/non-fa-ridere.astro` + `src/pages/en/non-fa-ridere.astro` — pages.
- `scripts/init-leaderboard-db.ts` — creates `game_scores` (also auto-created lazily by the lib).
- `src/lib/leaderboard-api.test.ts` — Vitest, in-memory libsql.

## Setup

The table is created lazily on first request, but to provision it explicitly:

```
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... pnpm exec tsx scripts/init-leaderboard-db.ts
```

## Assets / tone

Pixel-ish shapes drawn procedurally in the canvas (no image assets) using the Foglio palette. Tone matches the film's moodboard: melancholic provincial pizzeria, sad-funny. No sprite sheet to maintain.
