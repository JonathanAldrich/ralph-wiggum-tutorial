# Feature: Replace Space Invaders with Classic Pong

## Feature Description
Replace the current Space Invaders implementation at `/` with a classic single-player Pong experience. The new game should stay fully client-side, continue using the existing Flask + React Islands + canvas architecture, and preserve the current page shell and hydration flow while changing the gameplay, on-screen copy, and tests to Pong.

The requested Pong variant is:
- single-player against an AI opponent
- keyboard-controlled
- first to 11 points
- framed with start, win, and lose screens
- implemented with simple canvas shapes and no asset pipeline changes

## User Story
As a visitor to the game page
I want to play a classic Pong match against a computer opponent
So that the repository showcases Pong instead of Space Invaders without changing the surrounding app architecture

## Problem Statement
The repository currently ships a Space Invaders game whose engine, rendering, copy, and automated tests are all tailored to aliens, bullets, and score-by-destruction gameplay. That no longer matches the requested product behavior. Replacing the feature requires more than a title swap: the engine, controls, scoring rules, UI messaging, and test suite all need to move from Space Invaders assumptions to Pong assumptions while keeping the page route and island mounting contract stable.

## Solution Statement
Implement a new Pong engine under the existing game island, keep the Flask route at `/`, and preserve the `data-island="game"` mount point so the backend remains an HTML shell only. Replace invader-specific engine modules with Pong-specific modules for paddles, ball physics, AI movement, scoring, and match-state management. Update the template copy, canvas accessibility text, backend view tests, frontend game tests, and Playwright coverage so the entire application consistently describes and validates Pong.

To make browser coverage reliable, add a lightweight DOM-accessible score/state surface next to the canvas (or a semantically equivalent stable status hook owned by the island) so Playwright can assert points, match completion, and restart state without relying on flaky pixel-diff guesses against a canvas-only UI.

No new runtime libraries should be introduced; use the existing TypeScript, React, canvas, Vitest, pytest, and Playwright stack.

## Relevant Files
Use these files to implement the feature:

- `README.md`
  - Update any directly user-facing references if the game example is described there in a way that would become incorrect after the replacement.
- `src/app/views/game.py`
  - Keeps the route at `/` and should have docstrings/comments updated from Space Invaders to Pong.
- `src/app/templates/game.html`
  - Holds the page title, heading, help text, and noscript copy that currently reference Space Invaders controls and branding.
- `src/app/views/__init__.py`
  - Confirms the route registration stays unchanged while the page behavior changes underneath it.
- `frontend/src/main.ts`
  - Confirms the `game` island registry entry remains intact so the replacement game does not require routing or bootstrapping changes.
- `frontend/src/islands/game/index.tsx`
  - Retains the island mount contract and should continue mounting a single game component into `[data-island="game"]`.
- `frontend/src/islands/game/GameIsland.tsx`
  - Swaps the engine import, keeps the canvas lifecycle, updates accessibility labels to Pong terminology, and is the best place to expose a stable DOM score/status surface for accessibility and Playwright assertions.
- `frontend/src/game/constants.ts`
  - Replace alien, bullet, and shooter constants with Pong field, paddle, ball, scoring, serve, and AI tuning constants while preserving a fixed canvas size unless there is a compelling reason not to.
- `frontend/src/game/types.ts`
  - Replace Space Invaders-oriented comments/types with Pong-oriented state and shared geometry types.
- `frontend/src/game/InputHandler.ts`
  - Change input semantics from left/right/shoot to up/down movement plus start/restart handling.
- `frontend/src/game/Renderer.ts`
  - Rewrite canvas drawing from invaders/bullets to court, paddles, ball, center line, score HUD, and menu/end states.
- `frontend/tests/game/SpaceInvaders.test.ts`
  - Serves as the current logic-test location and should be replaced by Pong-oriented tests.
- `frontend/tests/game/entities.test.ts`
  - Contains Space Invaders-specific entity coverage and must be rewritten or removed so `script/test` no longer imports invader-only classes and constants.
- `tests/test_game_view.py`
  - Verifies the backend HTML shell; needs updated title and page-copy assertions.
- `e2e/game.spec.ts`
  - Current browser coverage is Space Invaders-specific and should be replaced or renamed once the Pong flow is covered.

### New Files
- `frontend/src/game/Pong.ts`
  - New top-level game orchestrator owning the RAF loop, scores, state transitions, and integration between paddles, ball, input, AI, and renderer.
- `frontend/src/game/Paddle.ts`
  - Shared paddle entity for player and computer movement, bounds-clamping, and collision shape.
- `frontend/src/game/Ball.ts`
  - Ball entity handling velocity, reset positioning, and wall response.
- `frontend/src/game/ComputerOpponent.ts`
  - Encapsulates AI paddle targeting and tuning so difficulty remains adjustable without tangling it into the main game loop.
- `frontend/tests/game/Pong.test.ts`
  - New Vitest coverage for Pong logic and state transitions.
- `e2e/pong.spec.ts`
  - Dedicated Playwright coverage for the new user-visible Pong experience.

## Implementation Plan
### Phase 1: Foundation
Define the Pong rules and preserve the existing integration seams. Keep the Flask route, template mount point, canvas dimensions, and pure client-side architecture stable while introducing Pong-specific constants, entities, and input semantics. Establish the new test contracts early so the replacement has concrete behavioral targets before old files are removed.

### Phase 2: Core Implementation
Build the Pong gameplay loop: player paddle movement, AI paddle movement, ball serving and movement, paddle and wall collisions, score tracking, round resets after points, and first-to-11 win/lose behavior. Rewrite rendering and HUD output to match classic Pong while keeping the implementation deterministic enough for unit tests.

### Phase 3: Integration
Wire the new Pong engine into the existing island and backend template, remove Space Invaders-specific modules and tests, and ensure all outward-facing copy, accessibility labels, and browser tests describe Pong consistently.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### Lock the replacement scope
- Preserve the current `GET /` route and `data-island="game"` mount contract.
- Preserve the current client-only architecture: no new backend APIs, persistence, or database changes.
- Bake the clarified product decisions into the implementation: single-player vs AI, first to 11, start screen, win/lose screens, restart with Space.

### Create the E2E contract early
- Add `e2e/pong.spec.ts` before removing the old browser coverage so the new implementation has a clear user-level target.
- Expose score and match status through stable DOM text or test hooks owned by the island so Playwright can assert scoring, win/lose state, and restart deterministically instead of depending on canvas pixel diffs.
- Cover the minimum observable flow: page title/heading, visible canvas, Space starting the match, ArrowUp/ArrowDown moving the player paddle, score changes after missed returns, and win/lose copy once either side reaches 11.
- Retire `e2e/game.spec.ts` after the Pong spec is in place so the suite has one authoritative browser contract for the game page.

### Build the Pong domain model
- Add `Pong.ts`, `Paddle.ts`, `Ball.ts`, and `ComputerOpponent.ts`.
- Replace invader-specific constants in `frontend/src/game/constants.ts` with Pong-focused values for paddle size, paddle speed, ball size, base ball speed, speed-up on paddle contact, serve delay/reset behavior, maximum score, and AI movement tuning.
- Update `frontend/src/game/types.ts` so shared geometry stays reusable and the game lifecycle comments/types reflect Pong states instead of alien-destruction states.

### Rework input handling for Pong
- Update `frontend/src/game/InputHandler.ts` to track `ArrowUp`, `ArrowDown`, and `Space`.
- Continue preventing default browser scrolling for gameplay keys.
- Keep an edge-triggered start/restart read so menu transitions happen once per key press rather than repeating while Space is held.

### Implement the gameplay loop
- In `frontend/src/game/Pong.ts`, own the RAF loop, delta-time handling, reset lifecycle, and all match-state transitions.
- Move the player paddle from input each frame and keep it clamped within the playfield.
- Move the AI paddle from the computer-opponent logic with a capped speed and small tracking tolerance so it is competent but still beatable.
- Move the ball frame-by-frame, bounce it off the top and bottom walls, reflect it from paddles, and vary the return angle based on where the ball hits the paddle face.
- Detect when the ball exits the left or right boundary, increment the correct score, reset the round from center, and stop the match when either side reaches 11.
- Keep the loop frame-rate independent and guard against large `dt` spikes after tab stalls, following the current engine pattern.

### Rewrite rendering and page copy
- Rewrite `frontend/src/game/Renderer.ts` to draw the Pong court, center line, player paddle, AI paddle, ball, scoreboard, and start/win/lose overlays.
- Update `src/app/templates/game.html` text from Space Invaders to Pong, including page title, heading, instructions, and noscript copy.
- Update `src/app/views/game.py` and `frontend/src/islands/game/GameIsland.tsx` comments/docstrings/accessibility labels so they accurately describe Pong.
- Add a lightweight DOM score/state companion near the canvas so the game is more accessible and Playwright can assert match progress without reading pixels.

### Wire the new engine into the island
- Update `frontend/src/islands/game/GameIsland.tsx` to instantiate `Pong` instead of `SpaceInvaders`.
- Let the island own the DOM-facing score/status output, either by subscribing to engine state changes (e.g., via a callback like `onStateChange` passed to the constructor) or by reading a narrow public state interface from the engine. Ensure this does not trigger React re-renders on every frame, only when score or match state actually changes.
- Consider whether the DOM score surface should be visually hidden (`sr-only`) for screen readers and Playwright, or styled as a visible UI element that supplements or replaces the canvas HUD.
- Keep the fixed canvas lifecycle behavior intact: create on mount, start once, destroy on unmount.
- Preserve the current island registry and route bootstrapping so no changes are needed to `frontend/src/main.ts` or Flask blueprint wiring beyond terminology updates if required.

### Replace tests and remove Space Invaders artifacts
- Replace `frontend/tests/game/SpaceInvaders.test.ts` with `frontend/tests/game/Pong.test.ts`.
- Rewrite or remove `frontend/tests/game/entities.test.ts` so no frontend tests reference `Player`, `Bullet`, `AlienGrid`, or alien constants after the replacement.
- Add unit coverage for initial state, start transition, paddle bounds clamping, scoring/reset behavior, win/lose at 11, restart flow, and cleanup.
- Update `tests/test_game_view.py` to assert Pong copy and retain the island mount-point checks.
- Remove or stop importing `Alien.ts`, `AlienGrid.ts`, `Bullet.ts`, `Player.ts`, and `SpaceInvaders.ts` once `Pong.ts` fully owns the game.
- Clean up leftover Space Invaders copy and comments across the touched files so the repository does not describe the wrong game.

### Run the validation commands
- Execute the commands listed in the `Validation Commands` section and do not consider the feature complete until they all pass.

## Testing Strategy
### Unit Tests
Use targeted frontend unit tests to validate gameplay logic without relying on real canvas rendering. Cover:
- initial `start` state and zeroed score
- start transition on Space
- player paddle movement and bounds clamping
- AI paddle movement respecting bounds and speed caps
- ball reflection from paddles and walls
- left/right out-of-bounds scoring and round reset
- match completion when either side reaches 11
- restart from win/lose screens
- destroy/cleanup behavior

Use backend tests to confirm the HTML shell still returns 200, still exposes `data-island="game"`, and now advertises Pong in the title and page body.

Use Playwright against the DOM-facing score/status surface plus the mounted canvas so browser tests can verify score progression, end-state messaging, and restart behavior deterministically even though the main playfield is canvas-rendered.

### Edge Cases
- Ball collides with the exact top or bottom boundary without tunneling through it.
- Paddle collision near the paddle edge produces a valid reflected trajectory instead of sending the ball straight back every time.
- Player and AI paddles never leave the canvas, even with large `dt` values.
- Restart input does not immediately skip past the start or end screen because of key-repeat behavior.
- A point scored at the exact frame the ball crosses a boundary increments only once and resets the round cleanly.
- AI remains beatable and does not mirror the ball perfectly with impossible reaction time.
- The page does not scroll when gameplay keys are pressed.

## Acceptance Criteria
- Visiting `/` shows a Pong-branded page title, heading, controls text, and noscript message.
- The page still mounts a single canvas inside `[data-island="game"]` using the existing React Island integration.
- The island also exposes stable DOM-readable score and game-status text suitable for accessibility and browser assertions.
- Pressing Space starts a Pong match from a start screen.
- The player controls one paddle with `ArrowUp` and `ArrowDown`.
- A computer-controlled paddle plays on the opposite side.
- The ball bounces off paddles and top/bottom walls and awards a point when a paddle misses.
- The score is visible during play, rounds reset after each point, and the first side to 11 ends the match with a win or lose screen.
- Pressing Space from a completed match restarts a fresh game.
- No backend API, database schema, or server-side persistence is introduced for this feature.
- All updated backend, frontend, and browser tests describe Pong and pass.

## Validation Commands
Execute every command to validate the feature works correctly with zero regressions.

```bash
PYTHONPATH=src pytest tests/test_game_view.py
cd frontend && npm test -- tests/game
npx playwright test --reporter=list e2e/pong.spec.ts
script/test
script/typecheck
script/lint
npx playwright test --reporter=list
```

## Notes
- Prefer preserving the existing `800x600` canvas dimensions unless gameplay or layout testing reveals a concrete reason to change them.
- Keep the implementation asset-free and geometry-based, matching the current zero-asset canvas approach.
- The AI tuning should live in constants so difficulty can be adjusted later without changing the gameplay loop structure.
