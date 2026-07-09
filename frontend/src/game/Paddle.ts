/**
 * Paddle — the shared vertical bat used by both the player and the computer.
 *
 * A paddle only knows how to move up/down and clamp itself inside the court;
 * *who* decides its movement each frame (player input vs. the AI) lives
 * outside. This keeps the entity dumb and reusable for both sides, and makes
 * the bounds-clamping edge case ("paddles never leave the canvas even with a
 * large dt") a single guarded operation instead of two copies.
 */
import type { Dimensions, Position } from './types'
import {
  CANVAS_HEIGHT,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
} from './constants'

export class Paddle {
  readonly position: Position
  readonly dimensions: Dimensions = {
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  }

  constructor(x: number, y: number) {
    this.position = { x, y }
  }

  /** Vertical centre of the paddle — used for AI targeting and ball reflection. */
  get centerY(): number {
    return this.position.y + this.dimensions.height / 2
  }

  /** Move up by `dt` seconds of travel, clamped to the top wall. */
  moveUp(dt: number): void {
    this.moveBy(-PADDLE_SPEED * dt)
  }

  /** Move down by `dt` seconds of travel, clamped to the bottom wall. */
  moveDown(dt: number): void {
    this.moveBy(PADDLE_SPEED * dt)
  }

  /**
   * Apply an arbitrary vertical delta (used by the AI, which moves at its own
   * capped speed) and clamp so the paddle can never leave the court — even if a
   * huge `dt` after a tab stall would otherwise fling it off-screen.
   */
  moveBy(dy: number): void {
    this.position.y = clamp(
      this.position.y + dy,
      0,
      CANVAS_HEIGHT - this.dimensions.height,
    )
  }

  /** Recentre the paddle vertically — used when a fresh match resets. */
  centerVertically(): void {
    this.position.y = (CANVAS_HEIGHT - this.dimensions.height) / 2
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
