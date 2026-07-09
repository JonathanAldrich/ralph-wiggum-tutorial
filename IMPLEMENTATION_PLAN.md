# Implementation Plan

Spec: `specs/20260709-201656-replace-space-invaders-with-pong.md` — Replace the Space Invaders game at `/` with single-player Pong vs. an AI opponent (first to 11; start/win/lose screens; ArrowUp/ArrowDown to move, Space to start/restart), keeping the Flask + React Islands + canvas architecture and the `data-island="game"` mount contract.

## Status: COMPLETE ✅

The Pong replacement is fully implemented and all validation commands pass
(`pytest`, `vitest`, `playwright`, `mypy`, `tsc`, `flake8`, `eslint`).

### What shipped
- **Engine** (`frontend/src/game/`): `Pong.ts` (RAF loop, dt clamp, scoring, paddle
  reflection with angle-by-hit-point, serve delay, first-to-11 win/lose,
  `onStateChange` snapshot emission), `Paddle.ts`, `Ball.ts` (wall bounce, no
  tunneling), `ComputerOpponent.ts` (capped speed + tolerance dead-zone, beatable),
  rewritten `constants.ts` (Pong tuning; AI difficulty lives here; 800×600 kept),
  `types.ts` (`GameState = start|playing|won|lost`, `PongPublicState`),
  `InputHandler.ts` (ArrowUp/ArrowDown/Space, edge-triggered start), `Renderer.ts`
  (court, centre line, paddles, ball, dual score HUD, start/end overlays).
- **Island** (`GameIsland.tsx`): instantiates `Pong`, exposes an accessible
  `role="status"` DOM surface with `data-testid` score/status hooks fed only on
  score/status change (no per-frame React churn); create+`start()` on mount,
  `destroy()` on unmount.
- **Backend**: `game.py` docstrings + `game.html` (title/heading/instructions/
  noscript) + `test_game_view.py` now describe Pong; route `GET /` and mount
  contract unchanged.
- **Tests**: `frontend/tests/game/Pong.test.ts` (22 tests — state transitions,
  paddle clamping, AI cap/bounds/beatability, ball reflection + angle variance,
  wall bounce, left/right scoring + single-count reset, win/lose at 11, restart,
  key-repeat not skipping screens, `onStateChange`, destroy). `e2e/pong.spec.ts`
  (6 tests, DOM-status-driven, deterministic — reaches 11 with idle player).
- **Removed**: `SpaceInvaders/AlienGrid/Alien/Bullet/Player.ts`,
  `SpaceInvaders.test.ts`, `entities.test.ts`, `e2e/game.spec.ts`, stale
  `pacman.cpython-312.pyc`.

## Notes / Decisions
- 800×600 canvas and zero-asset, geometry-only rendering preserved.
- AI tuning in `constants.ts` (`AI_SPEED=340 < PADDLE_SPEED=460`, `AI_TOLERANCE=14`)
  so difficulty is adjustable without touching the loop, and the player can win.
- Player paddle is on the **left** (ArrowUp/Down); computer on the **right**.
- Serve heads toward the side that just conceded, after `SERVE_DELAY`.
- The DOM score/status surface is the only new architectural addition; no backend
  API, DB, or persistence — client-only architecture preserved.
