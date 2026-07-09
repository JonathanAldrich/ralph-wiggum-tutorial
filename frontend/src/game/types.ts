/**
 * Core game type definitions for the Frogger engine.
 *
 * Framework-agnostic — no React, no DOM. Keeps the engine unit-testable
 * without a canvas context.
 */

/** A point in canvas space. Origin top-left; +y points downward. */
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
 * High-level game lifecycle states.
 *
 * - `start`    — title screen, waiting for the player to begin.
 * - `playing`  — active gameplay.
 * - `gameover` — all lives lost.
 * - `won`      — all five home pads claimed.
 */
export type GameState = 'start' | 'playing' | 'gameover' | 'won'

/**
 * Anything with a position, size, and alive flag.
 *
 * `alive` is the single source of truth for participation in updates,
 * rendering, and collision checks.
 */
export interface Entity {
  position: Position
  dimensions: Dimensions
  alive: boolean
}

/** Direction the frog is facing — used for sprite orientation. */
export type Direction = 'up' | 'down' | 'left' | 'right'
