# Implementation Plan — ralph-wiggum-tutorial

## Status

> **Active feature: Pac-Man browser game page (`/pacman`).**
> Spec: `specs/issue-20260529-4bf5f0a8-build-pacman-page.md`
> **State: ✅ COMPLETE — implemented, tested, and validated end-to-end.**

The Pac-Man showcase page is fully implemented and additive (Hello at `/` is
untouched). All validation suites pass with zero regressions:

- Backend: `pytest tests/` → 18 passed (6 Pac-Man + 12 Hello).
- Frontend: `vitest run` → 29 passed (16 engine + 9 island + 4 Hello).
- Typecheck: `mypy src/` + `tsc --noEmit` → clean.
- Lint: `flake8 src/ tests/` + `eslint src/` → clean.
- E2E: `playwright test` → 17 passed (8 Pac-Man + 9 Hello).

## What was built

### Backend
- `src/app/views/pacman.py` — `pacman_bp` blueprint, single `GET '/'` route
  rendering `pacman/index.html` (no API/persistence).
- `src/app/views/__init__.py` — registers `pacman_bp` with `url_prefix='/pacman'`.
- `src/app/templates/pacman/index.html` — extends `base.html`; `data-island="pacman"`
  mount point, server-rendered control instructions, no-JS fallback.
- `src/app/templates/base.html` — added a global nav bar (Hello / Pac-Man).
- `tests/test_pacman.py` — route 200, heading, mount point, instructions, plus
  explicit Hello no-regression + nav-link assertions.

### Frontend (`frontend/src/islands/pacman/`)
- `game/types.ts` — tiles, direction, phases, entity & `GameState` shapes.
- `game/config.ts` — all constants (sizes, speeds, scoring, frightened
  duration/flash, key maps, `GHOST_STRATEGY='random'` documented).
- `game/level.ts` — procedurally generated 19×19 pillar maze (provably
  connected), pellet/power placement, spawns, tunnel row.
- `game/engine.ts` — deterministic state machine (discrete tile + progress
  model, seeded LCG for ghost randomness, delta clamping, pellet/power scoring,
  frightened window + flash warning, cumulative ghost-eat multipliers,
  life loss/respawn, win/game-over, tunnel wrap, pause/resume).
- `game/render.ts` — canvas drawing (guards null ctx for jsdom).
- `PacmanIsland.tsx` — canvas + rAF loop (handle in ref, cancelled on cleanup),
  HUD/overlays in React state only, keyboard (arrows/WASD/P) with
  `preventDefault`, auto-pause on visibility change, restart/pause buttons.
- `components/TouchControls.tsx` — on-screen D-pad (`touch-action: none`).
- `index.tsx` — mount entry; registered in `frontend/src/main.ts`.
- `__tests__/engine.test.ts` (16) + `__tests__/PacmanIsland.test.tsx` (9).
- `e2e/pacman.spec.ts` — DOM/HUD assertions only (no canvas-pixel/score timing).

## Learnings (for future loops)
- Playwright locator is `getByLabel` (NOT `getByLabelText`, which is RTL-only).
- `script/server` runs Vite + Flask; if Vite dies (e.g. SIGHUP), island JS
  fails with `ERR_CONNECTION_REFUSED` to :5173 and ALL e2e fail as "hidden".
  Start it detached so it survives, then `playwright test` reuses it.
- `npx playwright install chromium` was required (only ffmpeg was cached).
- Frontend tests under `frontend/src/**` ARE typechecked+linted (tsconfig
  include `["src"]`); avoid jest-dom matchers there — use vitest core matchers.
- ESLint `no-self-assign` (recommended) flags `x = x` patterns — avoid.

## Notes / constraints (still apply)
- No backend persistence or DB migration; gameplay is client-side.
- Ghost AI is v1 random-valid-direction by design (documented in `config.ts`).
