# Feature: Classic Snake Arcade Replacement

## Feature Description
Replace the current Hello World tutorial surface with a playable classic Snake game that runs in the existing Flask + React Islands application. The new experience should preserve the repo's full-stack teaching value by keeping the server-rendered entry page, mounting a React island for the interactive game, and adding a persistent backend leaderboard so completed runs are stored and displayed across sessions.

The feature should target desktop keyboard play only. When a run ends, the player is prompted to enter initials or a short display name so their score can be saved to the leaderboard.

## User Story
As a visitor to the tutorial app
I want to play a classic Snake game in place of the current Hello World demo
So that the application feels like a complete interactive arcade experience instead of a CRUD placeholder

## Problem Statement
The repository currently demonstrates the stack with a minimal Hello World greeting flow. While useful as a starter example, it does not showcase richer client-side interaction, game-state management, or a meaningful backend persistence flow. The app needs a more compelling feature that still fits the current architecture and testing approach.

## Solution Statement
Implement Snake as a new React island mounted from the root route and backed by a lightweight Flask leaderboard API. The frontend should own the game loop, keyboard input, collision handling, food spawning, pause/restart behavior, and game-over flow. The backend should store leaderboard entries with player initials/name, score, and timestamp, then provide sorted results for server rendering and client refreshes. Hello-specific routes, templates, tests, and frontend island code should be replaced so the primary app experience is Snake rather than the greeting demo.

## Relevant Files
Use these files to implement the feature:

- `README.md`
  - Keep project description aligned if it references the current Hello World demo or example flow.
- `src/app/views/hello.py`
  - Current root page and JSON API; replace or rename this route module so `/` serves Snake and Hello CRUD endpoints are removed.
- `src/app/views/__init__.py`
  - Update blueprint registration to point at the Snake view module.
- `src/app/controllers/hello.py`
  - Current controller pattern to replace with Snake leaderboard operations.
- `src/app/models/hello.py`
  - Existing persistence example; replace with a score model appropriate for the leaderboard.
- `src/app/schemas/hello.py`
  - Replace validation/serialization schemas with score request/response schemas.
- `src/app/templates/hello/index.html`
  - Replace the page content and island mount point with the Snake layout.
- `src/app/templates/base.html`
  - Reuse the existing page shell; only adjust if the Snake page needs small layout-level support.
- `src/app/__init__.py`
  - Preserve current app-factory wiring while integrating any new modules.
- `frontend/src/main.ts`
  - Update the island registry from `hello` to `snake`.
- `frontend/src/types/index.ts`
  - Add shared types for leaderboard entries, score submission, and any game-state payloads passed from Flask.
- `frontend/src/islands/hello/HelloIsland.tsx`
  - Replace with the Snake island implementation or use as the basis for the new island structure.
- `frontend/src/islands/hello/index.tsx`
  - Replace the mount logic for the new Snake island.
- `frontend/tests/islands/hello/HelloIsland.test.tsx`
  - Replace with frontend tests for Snake rendering, controls, and leaderboard/game-over UI.
- `tests/test_hello.py`
  - Replace backend tests for the new root page and leaderboard API contract.
- `e2e/hello.spec.ts`
  - Replace the current E2E flow with an end-to-end Snake scenario.
- `migrations/versions/e31396db40b1_create_hello_table.py`
  - Existing migration history to build on when adding the new score table migration.
- `playwright.config.ts`
  - Reuse existing Playwright setup; only update if the new E2E flow needs configuration changes.

### New Files
- `src/app/views/snake.py`
  - New route module if the feature is implemented as a rename instead of modifying `hello.py` in place.
- `src/app/controllers/snake.py`
  - New controller for leaderboard retrieval and score creation.
- `src/app/models/snake_score.py`
  - New SQLAlchemy model for persistent leaderboard entries.
- `src/app/schemas/snake.py`
  - Pydantic schemas for score submission and score responses.
- `src/app/templates/snake/index.html`
  - Dedicated template for the Snake page.
- `frontend/src/islands/snake/SnakeIsland.tsx`
  - Main interactive game component.
- `frontend/src/islands/snake/index.tsx`
  - Island mount entry for Snake.
- `frontend/src/islands/snake/game.ts`
  - Pure game-state helpers for movement, collision detection, food generation, and restart behavior; keep game rules testable outside React.
- `frontend/tests/islands/snake/SnakeIsland.test.tsx`
  - Focused component and interaction tests.
- `tests/test_snake.py`
  - Backend integration tests for page rendering and leaderboard endpoints.
- `e2e/snake.spec.ts`
  - Browser-level test covering a playable session and score submission.
- `migrations/versions/<revision>_create_snake_scores_table.py`
  - Alembic migration creating the leaderboard table, and optionally dropping the `hello` table if the implementation fully removes that domain.

## Implementation Plan
### Phase 1: Foundation
Define the Snake domain and replace the Hello-specific persistence shape with a leaderboard model and API contract. Extract pure frontend game logic so movement rules, direction guards, collision detection, and score increments can be tested independently of React timing concerns.

### Phase 2: Core Implementation
Build the Snake island UI and game loop, including the board, score display, keyboard controls, pause/restart controls, food spawning, collision-driven game over, and prompt flow for saving a score. Implement backend endpoints to accept validated score submissions and return the top leaderboard entries in deterministic order.

### Phase 3: Integration
Wire the Flask root route to render the Snake page with initial leaderboard data, update the island registry to mount `data-island="snake"`, remove Hello-specific copy and tests, and ensure unit, integration, type, lint, and browser coverage all reflect the new primary experience.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### Create the test targets first
- Add `e2e/snake.spec.ts` as the browser-level contract for the finished experience.
- Replace `tests/test_hello.py` with `tests/test_snake.py` to define the backend route and leaderboard expectations.
- Replace `frontend/tests/islands/hello/HelloIsland.test.tsx` with `frontend/tests/islands/snake/SnakeIsland.test.tsx`.
- Define the minimum behaviors those tests must cover before implementation expands:
  - Root page renders Snake branding and the `data-island="snake"` mount point.
  - Leaderboard API accepts valid scores and rejects invalid payloads.
  - Snake UI renders the board, score, and control instructions.
  - Game-over flow prompts for initials/name and saves a score.

### Replace the backend domain
- Introduce a `SnakeScore` model with at least:
  - `id`
  - `player_name`
  - `score`
  - `created_at`
- Add a migration that creates the score table and, if the implementation removes the old domain completely, drops the unused `hello` table in the same migration or a follow-up cleanup migration.
- Create Pydantic schemas for:
  - score submission payload validation
  - score response serialization
- Add controller methods for:
  - fetching top scores with an explicit limit
  - creating a new score entry
- Keep ordering deterministic: highest score first, then newest or oldest timestamp as a documented tie-breaker chosen consistently across controller and tests.

### Replace the root page and API routes
- Serve `/` from the Snake route module and pass initial leaderboard data into the template.
- Replace the Hello JSON API with Snake-specific endpoints such as:
  - `GET /api/snake/scores`
  - `POST /api/snake/scores`
- Keep route behavior narrow and explicit:
  - only accept JSON for score submission
  - validate player name length and score bounds
  - enforce basic score spoofing bounds in Pydantic (e.g., maximum possible score based on board size) to gracefully handle invalid payloads
  - return structured error payloads on validation failure
- Update blueprint registration to remove the Hello route module and register the Snake route module.

### Build the frontend game logic
- Create a pure helper module for the core rules:
  - board size constants
  - initial snake state
  - legal direction changes
  - next-head movement
  - food spawning that avoids occupied cells
  - wall/self collision checks
  - score increment rules
- Keep the React component focused on rendering, timers, keyboard listeners, and score submission, with rules delegated to the helper module.
- Choose fixed-timestep classic gameplay rather than swipe/mobile interactions.
- Prevent immediate 180-degree turns so the snake cannot reverse into itself.
- Ensure the game event listener calls `e.preventDefault()` on arrow keys to prevent the browser window from scrolling while playing.
- Use a robust approach for the game interval (e.g., tracking state with `useRef` or a custom `useInterval` hook) to avoid React stale closure bugs.

### Build the Snake island UI
- Replace the Hello island with a Snake island registered under `data-island="snake"`.
- Render:
  - a visible game board
  - current score
  - high-score/leaderboard panel
  - keyboard instructions
  - start, pause/resume, and restart controls
- Render the board using standard DOM elements (e.g., CSS Grid of `div`s) rather than `<canvas>` to make styling and Playwright testing straightforward.
- Require an explicit "Start" action (e.g., clicking a button or pressing Space) to begin the game, rather than auto-starting on mount. This ensures the game doesn't crash into a wall before E2E tests fully connect.
- On game over:
  - freeze the board
  - show the final score
  - prompt for initials/name
  - submit the score to the backend
  - refresh the leaderboard after a successful save
- Keep the initial server-rendered page useful without hydration by showing the title, instructions, and leaderboard fallback content.

### Update shared frontend wiring
- Replace Hello-specific types in `frontend/src/types/index.ts` with Snake score and API types.
- Update `frontend/src/main.ts` so the island registry imports `snake` instead of `hello`.
- Update the mount entry to parse initial leaderboard props and render the Snake island.
- Remove stale Hello-specific text, placeholders, and component assumptions that no longer match the product.

### Update automated coverage
- Backend tests should cover:
  - root page title/content
  - presence of `data-island="snake"`
  - empty leaderboard response
  - successful score creation
  - validation failures for blank names, overlong names, negative scores, and malformed payloads
  - leaderboard ordering
- Frontend tests should cover:
  - initial render from server-provided leaderboard data
  - keyboard-driven state changes
  - prevention of reverse direction changes
  - game-over rendering and score form visibility
  - leaderboard refresh after a mocked successful score submission
- E2E should cover:
  - loading the page
  - starting a game
  - steering the snake with the keyboard
  - reaching a deterministic game-over path
  - submitting initials/name
  - seeing the saved score in the leaderboard

### Run validation commands
- Run the validation commands below in order and fix any regressions before considering the feature complete.

## Testing Strategy
### Unit Tests
- Backend integration tests should validate the Flask page and leaderboard API contract end to end against the test database fixture.
- Frontend unit tests should exercise the pure game-rule helpers directly to avoid flaky timer-heavy assertions.
- Component tests should verify the Snake island's rendering and interaction behavior with mocked network requests for leaderboard reads/writes.

### Edge Cases
- Prevent reverse turns while allowing valid direction changes.
- Ensure food never spawns on the snake body.
- Handle game over on wall collision and self-collision.
- Reject zero or negative scores if the chosen product rule only stores completed scoring runs.
- Reject blank player names and names longer than the chosen limit.
- Preserve deterministic leaderboard ordering when multiple players have the same score.
- Avoid double-submitting the same completed run if the player clicks save more than once.
- Ensure restart clears the previous game-over state and score-submission UI.
- Ensure keyboard listeners are cleaned up so repeated mounts do not stack controls.

## Acceptance Criteria
- Visiting `/` shows Snake instead of Hello World.
- The page contains a mounted React island registered as `snake`.
- A user can start a game and control movement with the keyboard on desktop.
- The snake grows and the score increases when food is collected.
- The game ends on wall collision or self-collision.
- After game over, the user can enter initials/name and save the score.
- Saved scores persist in the backend and appear in the leaderboard after reload.
- Hello-specific page copy, CRUD UI, and automated tests are removed or replaced so the main experience is consistently Snake.
- Backend, frontend, and browser test coverage all reflect the Snake workflow.

## Validation Commands
Execute every command to validate the feature works correctly with zero regressions.

```bash
PYTHONPATH=src pytest tests/test_snake.py
cd frontend && npm test -- tests/islands/snake/SnakeIsland.test.tsx
npx playwright test e2e/snake.spec.ts --reporter=list
script/test
script/typecheck
script/lint
```

## Notes
- No new frontend or backend libraries should be required; the existing Flask, SQLAlchemy, React, TypeScript, Vitest, and Playwright stack is sufficient.
- Prefer a fixed board size and deterministic helper functions so the game is straightforward to test.
- Keep the backend focused on leaderboard persistence only; the active game loop should remain client-side.
- If retaining old migration history is important, create a forward migration to add `snake_scores` rather than rewriting the original `hello` migration.
