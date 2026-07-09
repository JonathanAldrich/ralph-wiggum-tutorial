/**
 * Ball — position, velocity, and top/bottom wall response.
 *
 * The ball owns only the physics that don't need to know about paddles or
 * scoring: constant-velocity motion and reflecting off the top and bottom
 * walls. Paddle reflection and out-of-bounds scoring are resolved by the Pong
 * orchestrator, which is the single place that can see both paddles, the score,
 * and the serve lifecycle.
 *
 * Wall bounces reposition the ball back inside the court on contact rather than
 * only flipping velocity, so a large `dt` can never tunnel the ball through a
 * wall (a spec edge case).
 */
import type { Dimensions, Position } from './types'
import {
  BALL_BASE_SPEED,
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
} from './constants'

export class Ball {
  readonly position: Position
  readonly dimensions: Dimensions = { width: BALL_SIZE, height: BALL_SIZE }
  /** Velocity components in px/s. */
  vx = 0
  vy = 0

  constructor() {
    this.position = { x: 0, y: 0 }
    this.centerInCourt()
  }

  /** Current speed magnitude in px/s. */
  get speed(): number {
    return Math.hypot(this.vx, this.vy)
  }

  get centerX(): number {
    return this.position.x + this.dimensions.width / 2
  }

  get centerY(): number {
    return this.position.y + this.dimensions.height / 2
  }

  /** Park the ball dead-centre with no velocity (used between serves). */
  centerInCourt(): void {
    this.position.x = (CANVAS_WIDTH - this.dimensions.width) / 2
    this.position.y = (CANVAS_HEIGHT - this.dimensions.height) / 2
    this.vx = 0
    this.vy = 0
  }

  /**
   * Launch the ball from centre toward `direction` (-1 = toward the player on
   * the left, +1 = toward the computer on the right) at a shallow random
   * vertical angle so no two serves are identical.
   */
  serve(direction: number): void {
    this.centerInCourt()
    // Random angle within ±30° of horizontal keeps the serve playable.
    const angle = (Math.random() * 2 - 1) * (Math.PI / 6)
    this.vx = Math.sign(direction) * BALL_BASE_SPEED * Math.cos(angle)
    this.vy = BALL_BASE_SPEED * Math.sin(angle)
  }

  /** Advance the ball and bounce it off the top and bottom walls. */
  update(dt: number): void {
    this.position.x += this.vx * dt
    this.position.y += this.vy * dt

    // Top wall.
    if (this.position.y <= 0) {
      this.position.y = 0
      this.vy = Math.abs(this.vy)
    }
    // Bottom wall.
    const maxY = CANVAS_HEIGHT - this.dimensions.height
    if (this.position.y >= maxY) {
      this.position.y = maxY
      this.vy = -Math.abs(this.vy)
    }
  }
}
