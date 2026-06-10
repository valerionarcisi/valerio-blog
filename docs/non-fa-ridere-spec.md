# Non Fa Ridere — coming-soon page + mini-game

Coming-soon page for the short film **Non Fa Ridere** (written/directed by Valerio Narcisi). While the film is in post, the page hosts a small arcade game themed on the script, with a global leaderboard.

## Routes

- `/non-fa-ridere/` (it) and `/en/non-fa-ridere/` (en) — `FoglioLayout`, logline + embedded game + leaderboard. Public and indexed (in sitemap).
- `GET/POST /api/non-fa-ridere/scores` — leaderboard endpoint (`prerender = false`).

## The game

Fixed single-screen arcade (Space-Invaders shaped). Filippo the pizza maker is stuck behind the counter; customers/characters descend from the top. Throw pizzas to clear them before they reach the floor.

- **Controls**: `←`/`→` move, `Space`/tap to throw. Touch: tap moves Filippo to that x and throws.
- **Lives**: 3. Lose one when a non-friend/non-bonus enemy reaches the floor, or when you hit Tea.
- **Difficulty**: spawn cadence and fall speed ramp with score.

### Cast (enemies) — from the script

| Character | Behaviour | Points |
|---|---|---|
| Vecchia | slow, common ("Gianna! Non Gemma!") | 10 |
| Rider | fast (the angry delivery crowd) | 15 |
| Comico (John/Milco/Luca) | 2 HP, zig-zags | 25 |
| Nonno | ghost, blinks, **bonus** — no penalty if it reaches the floor | 50 |
| Tea | **friend** — hitting her costs a life and points; let her pass safely | — |
| Giulio | **final boss**, 8 HP, appears once score ≥ 400 ("te tiro dentro a lu forno!") | 200 |

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
