/**
 * Frog — the player character.
 *
 * Position is tracked in continuous pixel space so the frog can drift
 * smoothly with logs in the river. The logical `row` is updated whenever
 * the frog hops vertically and is used by the game loop to decide which
 * hazard zone the frog is in.
 *
 * Horizontal movement also snaps by LANE_HEIGHT (one cell width) to keep
 * the frog aligned with the lane grid.
 */
import type { Dimensions, Direction, Entity, Position } from './types'
import {
  CANVAS_WIDTH,
  FROG_HEIGHT,
  FROG_START_ROW,
  FROG_START_X,
  FROG_WIDTH,
  LANE_HEIGHT,
  MOVE_COOLDOWN,
} from './constants'

export class Frog implements Entity {
  position: Position
  dimensions: Dimensions
  alive = true
  /** Logical row index (0 = home strip, 12 = start zone). */
  row: number
  /** Facing direction — used by the Renderer to orient the sprite. */
  direction: Direction = 'up'
  /** High-water mark: lowest row index reached this life (for forward scoring). */
  bestRow: number
  /** Seconds until the frog may hop again (prevents multiple hops per frame). */
  private moveCooldown = 0

  constructor() {
    this.dimensions = { width: FROG_WIDTH, height: FROG_HEIGHT }
    this.row = FROG_START_ROW
    this.bestRow = FROG_START_ROW
    this.position = this.laneTopY(FROG_START_ROW, FROG_START_X)
  }

  /** Reset to start position (called on death and at round start). */
  reset(): void {
    this.row = FROG_START_ROW
    this.bestRow = FROG_START_ROW
    this.position = this.laneTopY(FROG_START_ROW, FROG_START_X)
    this.direction = 'up'
    this.moveCooldown = 0
    this.alive = true
  }

  /** Tick down the hop cooldown. */
  update(dt: number): void {
    if (this.moveCooldown > 0) this.moveCooldown = Math.max(0, this.moveCooldown - dt)
  }

  canHop(): boolean {
    return this.moveCooldown <= 0
  }

  moveUp(): boolean {
    if (!this.canHop() || this.row <= 0) return false
    this.row--
    this.position.y = this.row * LANE_HEIGHT + (LANE_HEIGHT - FROG_HEIGHT) / 2
    this.direction = 'up'
    this.moveCooldown = MOVE_COOLDOWN
    return true
  }

  moveDown(): boolean {
    if (!this.canHop() || this.row >= FROG_START_ROW) return false
    this.row++
    this.position.y = this.row * LANE_HEIGHT + (LANE_HEIGHT - FROG_HEIGHT) / 2
    this.direction = 'down'
    this.moveCooldown = MOVE_COOLDOWN
    return true
  }

  moveLeft(): boolean {
    if (!this.canHop() || this.position.x < LANE_HEIGHT) return false
    this.position.x -= LANE_HEIGHT
    this.direction = 'left'
    this.moveCooldown = MOVE_COOLDOWN
    return true
  }

  moveRight(): boolean {
    if (!this.canHop() || this.position.x + FROG_WIDTH > CANVAS_WIDTH - LANE_HEIGHT) return false
    this.position.x += LANE_HEIGHT
    this.direction = 'right'
    this.moveCooldown = MOVE_COOLDOWN
    return true
  }

  /**
   * Drift horizontally with a log platform by `dx` pixels.
   * Called every frame while the frog is riding a log.
   */
  drift(dx: number): void {
    this.position.x += dx
  }

  /** True if the frog has been carried off the visible canvas. */
  isOffScreen(): boolean {
    return (
      this.position.x + FROG_WIDTH < 0 ||
      this.position.x > CANVAS_WIDTH
    )
  }

  /** Centre x of the frog — used for home-pad proximity checks. */
  centerX(): number {
    return this.position.x + FROG_WIDTH / 2
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Compute the pixel y for the frog centred vertically in `row`. */
  private laneTopY(row: number, x: number): Position {
    return {
      x,
      y: row * LANE_HEIGHT + (LANE_HEIGHT - FROG_HEIGHT) / 2,
    }
  }
}
