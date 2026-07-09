/**
 * Core game type definitions for the Pong engine.
 *
 * These types are deliberately framework-agnostic (no React, no DOM beyond
 * the canvas context passed to the Renderer). Keeping them isolated lets the
 * engine be unit-tested and reused independently of the Islands wrapper.
 */

/** A point in canvas space. Origin is top-left; +y points down. */
export interface Position {
  x: number
  y: number
}

/** Width/height of an axis-aligned rectangle, in pixels. */
export interface Dimensions {
  width: number
  height: number
}

/**
 * Anything with a position and size — the shared shape used for the
 * axis-aligned collision tests between the ball and the paddles.
 */
export interface Entity {
  position: Position
  dimensions: Dimensions
}

/**
 * High-level match lifecycle states.
 *
 * - `start`   — title screen, waiting for the player to serve the first ball.
 * - `playing` — active rally; the only state the game loop simulates.
 * - `won`     — the player reached MAX_SCORE first.
 * - `lost`    — the computer reached MAX_SCORE first.
 *
 * The loop only advances simulation in `playing`; other states just render a
 * static screen, which is why the loop can keep running cheaply after the
 * match ends (and lets the player restart with Space).
 */
export type GameState = 'start' | 'playing' | 'won' | 'lost'

/**
 * The narrow, DOM-facing snapshot the island subscribes to.
 *
 * The island renders an accessible (and Playwright-assertable) score/status
 * surface from this. It is emitted only when the status or a score actually
 * changes, so React never re-renders on every animation frame.
 */
export interface PongPublicState {
  status: GameState
  playerScore: number
  computerScore: number
}
