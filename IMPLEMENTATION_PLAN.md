# Implementation Plan — Classic Snake Arcade Replacement

Spec: `specs/20260709-231756-snake-arcade-replace-hello-world.md`

## Status: ✅ COMPLETE (2026-07-09)

The Hello World demo has been fully replaced by the Snake arcade feature end
to end. All spec validation commands pass with zero regressions:

- `PYTHONPATH=src pytest tests/test_snake.py` → 17 passed
- `cd frontend && npm test` → 23 passed (game.ts + SnakeIsland)
- `npx playwright test e2e/snake.spec.ts --reporter=list` → 5 passed
- `script/typecheck` (mypy + tsc) → clean
- `script/lint` (flake8 + eslint) → clean

## What was delivered

### Backend (`src/app/`)
- `models/snake_score.py` — `SnakeScore` (`id`, `player_name` String(20), `score`, `created_at`).
- `schemas/snake.py` — `ScoreCreate` (name 1..20 trimmed/non-blank, score 1..`MAX_SCORE`), `ScoreResponse`. `MAX_SCORE = 20*20 - 3 = 397` (board-derived anti-spoof bound).
- `controllers/snake.py` — `SnakeController.get_top(limit=10)` (score desc, then earliest `created_at`, then `id` — documented tie-breaker) and `create()`.
- `views/snake.py` — `snake_bp`: `GET /` (renders page + initial leaderboard), `GET/POST /api/snake/scores`. POST validates JSON; on `ValidationError` returns `400` with `details=e.errors(include_context=False, ...)` (custom-validator `ValueError` isn't JSON-serializable otherwise).
- `models|controllers|schemas|views/__init__.py` updated; Hello backend modules + template deleted.
- Migration `a1b2c3d4e5f6_create_snake_scores_table.py` (down_revision `e31396db40b1`): creates `snake_scores`, drops `hello`, with symmetric `downgrade()`.

### Frontend (`frontend/src/`)
- `islands/snake/game.ts` — pure, RNG-injectable logic (constants, movement, 180° reversal guard, wall/self collision, food placement avoiding the body, scoring, `step`). First food spawns directly ahead of the head so an opening move always scores (guarantees a savable, deterministic e2e score).
- `islands/snake/SnakeIsland.tsx` — CSS-grid board, score, leaderboard, Start/Pause-Resume/Restart, `useInterval` fixed-timestep loop (ref-based, no stale closures), keyboard steering with `preventDefault` on arrows + Space to start/pause, game-over form → `POST /api/snake/scores` → leaderboard refresh, double-submit guard, listener cleanup.
- `islands/snake/index.tsx` mount; `types/index.ts` (`SnakeScore`, `ScoreCreate`); `main.ts` registry `hello`→`snake`. Hello island + tests deleted.

### Tests
- `tests/test_snake.py`, `frontend/tests/islands/snake/{game.test.ts,SnakeIsland.test.tsx}`, `e2e/snake.spec.ts`. Hello tests removed.

## Notes / learnings for future work
- **Dev DB alembic recovery**: the dev Postgres `alembic_version` pointed at a
  dangling revision (`f1a2b3c4d5e6`) with no tables, so `flask db stamp/upgrade`
  errored ("Can't locate revision"). Fix was a one-off `DELETE FROM
  alembic_version` then `flask db upgrade` (replays `e31396db40b1` →
  `a1b2c3d4e5f6`). Only needed because the DB was empty.
- Leaderboard has no DELETE endpoint (spec keeps the API narrow), so e2e uses
  unique per-run player names instead of API cleanup between tests.
- Board geometry constants are duplicated in `game.ts` and `schemas/snake.py`
  (20x20, initial length 3, MAX_SCORE 397) and must be kept in sync.
