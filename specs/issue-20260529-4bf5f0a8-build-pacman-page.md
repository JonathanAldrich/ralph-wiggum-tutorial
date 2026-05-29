# Feature: Pac-Man browser game page

## Feature Description
Add a dedicated `/pacman` page to the existing Flask + React Islands app that delivers a playable, single-level Pac-Man experience. The page should support keyboard play on desktop, basic touch controls on mobile, display score and remaining lives, run ghost movement and collision rules, and provide clear win/game-over + restart flows without replacing the existing Hello demo.

## User Story
As a visitor to the tutorial app
I want to play a polished Pac-Man game in the browser
So that I can interact with a more substantial demo than the current Hello example

## Problem Statement
The current application only demonstrates a simple Hello World island. It does not showcase how this stack handles richer UI state, animation loops, responsive interaction patterns, or a medium-complexity product feature. A Pac-Man page creates a concrete, engaging example that exercises the React Islands architecture without requiring backend persistence or database changes.

## Solution Statement
Implement Pac-Man as a new Flask route and template that mounts a dedicated React island. Keep gameplay fully client-side and model the maze, pellets, player, ghosts, score, lives, frightened state, win state, restart flow, tunnel wrap-around, and pause/resume behavior in a deterministic game engine module. Use a `<canvas>` for the live board rendering to avoid React re-rendering every animation frame, while keeping overlay UI, controls, and status text in React state. Support desktop keyboard controls plus a touch-friendly on-screen D-pad for mobile.

## Relevant Files
Use these files to implement the feature:

- `README.md`
  - Confirms the project architecture, development commands, and the expected plan/build workflow.
- `AGENTS.md`
  - Defines validation commands, testing expectations, and codebase patterns that the implementation must follow.
- `src/app/views/__init__.py`
  - Registers Flask blueprints; must be updated so the new Pac-Man route is reachable.
- `src/app/views/hello.py`
  - Existing example of a Flask blueprint serving both HTML and API endpoints; useful as the route/template pattern reference.
- `src/app/templates/base.html`
  - Shared page shell and Vite asset loading; Pac-Man page will extend this template.
- `src/app/templates/hello/index.html`
  - Existing example of a server-rendered template with a React island mount point and fallback content.
- `frontend/src/main.ts`
  - Island registry and auto-mount entry point; must register the new Pac-Man island.
- `frontend/src/islands/hello/index.tsx`
  - Existing island mount wrapper; good reference for Pac-Man island mounting.
- `frontend/src/islands/hello/HelloIsland.tsx`
  - Existing React island organization and state management example.
- `frontend/src/types/index.ts`
  - Shared frontend type conventions; can host reusable Pac-Man UI/game types if that keeps imports clean.
- `tests/test_hello.py`
  - Backend route test patterns for HTML responses and mount-point assertions.
- `e2e/hello.spec.ts`
  - Existing Playwright structure and conventions for page-level and API/browser assertions.
- `playwright.config.ts`
  - Confirms E2E discovery path and server boot behavior for the new Pac-Man spec.
- `frontend/package.json`
  - Confirms the frontend test/typecheck/lint commands the implementation must keep green.

### New Files
- `src/app/views/pacman.py`
  - New Flask blueprint for the Pac-Man page route.
- `src/app/templates/pacman/index.html`
  - New template containing the Pac-Man island mount point, heading, instructions, and non-JS fallback.
- `tests/test_pacman.py`
  - Backend route coverage for the new page.
- `frontend/src/islands/pacman/index.tsx`
  - Pac-Man island mount entry.
- `frontend/src/islands/pacman/PacmanIsland.tsx`
  - Main React component for game shell, HUD, overlays, and control wiring.
- `frontend/src/islands/pacman/game/types.ts`
  - Core gameplay types for tiles, entities, direction, game phase, and state.
- `frontend/src/islands/pacman/game/config.ts`
  - Constants for tile size, speeds, lives, scoring, canvas dimensions, control mappings, pause key (`P`), ghost strategy (`random` for v1), frightened-mode duration, frightened-mode flash warning threshold, and cumulative ghost-eat score multipliers (200 → 400 → 800 → 1600).
- `frontend/src/islands/pacman/game/level.ts`
  - Maze layout, pellet placement, tunnel coordinates, spawn points, and wall metadata.
- `frontend/src/islands/pacman/game/engine.ts`
  - Deterministic state transition logic for movement, collisions, scoring, ghost behavior, frightened mode, win/game-over, and restart.
- `frontend/src/islands/pacman/game/render.ts`
  - Canvas drawing logic for the board, pellets, Pac-Man, ghosts, and overlays that belong on the canvas layer.
- `frontend/src/islands/pacman/components/TouchControls.tsx`
  - On-screen D-pad buttons for touch/mobile play.
- `frontend/src/islands/pacman/__tests__/engine.test.ts`
  - Unit tests for gameplay state transitions and edge cases.
- `frontend/src/islands/pacman/__tests__/PacmanIsland.test.tsx`
  - Component tests for HUD, overlays, keyboard/touch wiring, and restart flow.
- `e2e/pacman.spec.ts`
  - Dedicated browser test file for Pac-Man page rendering, controls, gameplay state changes, and restart behavior.

## Implementation Plan
### Phase 1: Foundation
Create a dedicated Flask route/template pair and register the new blueprint so `/pacman` renders inside the existing application shell. Add the Pac-Man island to the frontend registry, define the new game module structure, and codify fixed gameplay constants, maze layout, entity types, score values, and control mappings before wiring the runtime.

### Phase 2: Core Implementation
Build the gameplay engine as a deterministic state machine that updates Pac-Man, ghosts, pellets, score, frightened mode, lives, tunnel wrap-around, and win/game-over transitions. Render the live board through a canvas-driven animation loop with `requestAnimationFrame`, keeping React responsible only for discrete UI state like HUD values, overlays, pause state, and restart. Implement keyboard controls with scroll prevention and an on-screen D-pad for touch/mobile input.

### Phase 3: Integration
Connect the engine to the Pac-Man island, expose page instructions and accessible HUD text, auto-pause on tab visibility changes, handle restart/reset behavior cleanly, and add backend, frontend, and Playwright coverage so the feature fits the app’s existing testing and routing patterns without regressing the Hello page.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### Create the dedicated Pac-Man page surface
- Add `src/app/views/pacman.py` with a Pac-Man blueprint that exposes a `GET '/'` route and is registered with `url_prefix='/pacman'` in `__init__.py`, following the same pattern as the Hello blueprint at `/`.
- Update `src/app/views/__init__.py` to import and register the new blueprint explicitly.
- Add a navigation link to `/pacman` in `src/app/templates/base.html` (or the Hello page template) so the new page is discoverable without typing the URL directly.
- Add `src/app/templates/pacman/index.html` extending `base.html` with:
  - a `data-island="pacman"` mount point
  - server-rendered instructions for controls
  - fallback content for users without JavaScript
  - page copy that distinguishes Pac-Man from the existing Hello demo

### Create the E2E test file early
- Add `e2e/pacman.spec.ts` before or alongside core implementation so the expected user flow is locked in.
- Cover the minimum end-to-end flow:
  - visit `/pacman`
  - verify page title/heading and Pac-Man mount surface
  - verify canvas/HUD and on-screen D-pad render
  - verify the game enters `running` phase after a directional key or D-pad press (assert the `ready` overlay disappears)
  - verify restart returns the game to its initial HUD state (score reset to 0, lives reset to initial count, `ready` overlay visible)
- **Do not assert that score increments or pellets are consumed in E2E tests** — gameplay timing is non-deterministic in Playwright. Pellet scoring and collision outcomes are covered by engine unit tests.
- Prefer assertions against visible DOM/HUD state rather than raw canvas pixels.
- Capture Playwright screenshots/traces on failure using the repo’s existing config.

### Define shared game data and rules
- Create `types.ts`, `config.ts`, and `level.ts` for:
  - tile definitions and maze dimensions
  - pellet and power-pellet scoring; cumulative ghost-eat multipliers (200, 400, 800, 1600 per ghost in a single frightened window)
  - Pac-Man and ghost spawn points; ghosts start active on the board (no ghost-house release timer for v1)
  - ghost movement strategy: **random valid direction at each intersection** for v1 — no directional chase AI; document this explicitly in `config.ts`
  - tunnel entry/exit coordinates with wrap-around rules
  - initial lives, direction queueing, and game phases (`ready`, `running`, `paused`, `won`, `game_over`)
  - pause key binding (`P`)
  - frightened-mode duration and flash-warning threshold (last N ms before expiry, ghosts render as flashing)
- Keep these modules pure and framework-agnostic so they can be unit-tested independently.
- Specify one-level completion behavior explicitly: when all pellets are consumed, show a "Level Complete" state and allow restart back to the same level.

### Build the deterministic game engine
- Implement `engine.ts` as the source of truth for state transitions:
  - queued direction changes at tile boundaries
  - wall collision checks
  - pellet/power-pellet consumption and score updates
  - frightened-mode timer activation, flash-warning phase, and expiry (ghosts return to normal)
  - cumulative ghost-eat scoring within a single frightened window
  - ghost collision outcomes for normal vs frightened states
  - life loss, respawn, and game-over transitions
  - tunnel wrap-around for Pac-Man and ghosts
  - manual pause/resume via `P` key
- Keep engine helpers pure where possible so Vitest can validate them without a DOM.
- Clamp large frame deltas and support explicit pause/resume so tab switching does not fast-forward the game unexpectedly.

### Implement rendering and island lifecycle
- Register the island in `frontend/src/main.ts`.
- Add `frontend/src/islands/pacman/index.tsx` to mount the island cleanly.
- Implement `PacmanIsland.tsx` with:
  - `<canvas>`-based board rendering via `render.ts`
  - HUD elements for score, lives, and current game phase
  - instructions for keyboard and touch controls
  - start/restart controls and visible overlays for ready, win, pause, and game over
- Start the animation loop with `requestAnimationFrame`, store the frame handle in a ref, and cancel it on cleanup so React 18 development behavior does not create duplicate loops.
- Keep per-frame positions in refs/engine state instead of forcing React to re-render on every tick.

### Add keyboard and touch controls
- Support arrow keys and WASD for desktop play; `P` to pause/resume.
- Prevent default browser scrolling for gameplay keys while the game is active.
- Implement `TouchControls.tsx` as an on-screen D-pad with clear directional buttons that work on touch and mouse/pointer input.
- Apply mobile-safe interaction behavior such as `touch-action: none` where needed so controls do not trigger page scrolling/zoom interference.
- Ensure the layout scales on smaller screens so the canvas and controls remain usable on mobile.

### Add automated tests throughout implementation
- Add `tests/test_pacman.py` with backend assertions that:
  - `GET /pacman` returns `200`
  - the page contains the Pac-Man title/heading
  - the Pac-Man island mount point is present
  - the Hello page at `/` still works unchanged
- Add `frontend/src/islands/pacman/__tests__/engine.test.ts` covering:
  - pellet scoring
  - power-pellet frightened mode activation
  - frightened mode timer expiry (ghosts return to normal)
  - cumulative ghost-eat scoring within a single frightened window
  - wall collision and queued turns
  - tunnel wrap-around
  - life loss and respawn
  - win condition when the final pellet is consumed
  - restart resetting state
- Add `frontend/src/islands/pacman/__tests__/PacmanIsland.test.tsx` covering:
  - HUD rendering from initial state
  - restart button behavior
  - visible overlay states
  - touch control button dispatch
  - keyboard handler setup/cleanup

### Run the full validation suite
- Run the validation commands listed below in repo-supported form.
- Resolve any failing backend, frontend, typecheck, lint, or E2E checks before considering the feature complete.

## Testing Strategy
### Unit Tests
- Backend route tests for the new `/pacman` page and for preserving the existing `/` route behavior.
- Pure frontend engine tests that validate movement, collisions, frightened mode, scoring, tunnel wrap-around, win/game-over transitions, and restart behavior.
- React component tests for the Pac-Man island HUD, overlays, restart controls, and touch input wiring.

### Edge Cases
- Arrow/WASD/`P` input should not scroll the page during active gameplay.
- React effect cleanup must prevent duplicate animation loops in development.
- Large time deltas after tab backgrounding should not cause the game to skip unpredictably.
- Touch controls must remain usable on narrow/mobile screens.
- Pac-Man and ghosts must wrap correctly through the tunnel.
- Losing the final life should show game over instead of silently resetting.
- Eating the final pellet should show a win/level-complete state instead of freezing.
- Restart should fully reset score, lives, pellets, ghost state, queued input, and overlays.
- Frightened mode timer expiry must return all ghosts to normal movement; the flash-warning phase must appear before expiry.
- Eating multiple ghosts in one frightened window must apply the cumulative score multiplier (200, 400, 800, 1600).

## Acceptance Criteria
- Visiting `/pacman` renders a dedicated Pac-Man page without replacing or breaking the existing Hello page at `/`.
- A navigation link to `/pacman` is present so the page is discoverable.
- The page mounts a Pac-Man React island and shows a playable single-level game with score, lives, ghosts, and restart flow.
- Keyboard controls (arrows, WASD, `P` to pause) work on desktop, and visible on-screen touch controls work on mobile-sized layouts.
- The live board is rendered through canvas or another non-per-frame-React-render mechanism suitable for smooth gameplay.
- Pac-Man can collect pellets, lose lives on ghost collisions, trigger frightened mode through power pellets (with flash-warning before expiry), and complete the level.
- Ghost movement uses random-valid-direction strategy (v1); this is documented in `config.ts`.
- Tunnel wrap-around works correctly.
- Win and game-over states are visible and restart returns the game to its initial one-level state.
- Backend, frontend unit/component, typecheck, lint, and Playwright E2E validations all pass.

## Validation Commands
Execute every command to validate the feature works correctly with zero regressions.

- `./script/test`
- `./script/typecheck`
- `./script/lint`
- `./script/test-e2e`
- `PYTHONPATH=src pytest tests/test_pacman.py tests/test_hello.py`
- `cd frontend && npm test -- --run Pacman`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `npx playwright test e2e/pacman.spec.ts`

## Notes
- No new backend persistence or database migration should be required; keep gameplay state client-side.
- No external game engine should be introduced unless implementation proves the current stack cannot meet the scope; start with the existing React + Vite toolchain.
- Prefer DOM-visible HUD state for E2E assertions because gameplay visuals inside canvas are harder to verify reliably in browser tests.
- Keep the Hello feature as the baseline example and treat Pac-Man as an additive showcase page.
