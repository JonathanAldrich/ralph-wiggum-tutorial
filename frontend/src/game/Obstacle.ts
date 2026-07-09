/**
 * Obstacle — a single moving hazard or platform.
 *
 * Used for both road vehicles (danger) and river logs (platforms). The sign
 * of `speed` encodes direction: positive = right, negative = left. Obstacles
 * wrap seamlessly around the canvas so lanes stay perpetually populated.
 *
 * The `kind` property lets the Renderer and collision logic distinguish
 * between vehicles (which kill the frog) and logs (which carry it).
 */
import type { Dimensions, Entity, Position } from './types'
import { CANVAS_WIDTH } from './constants'

export type ObstacleKind = 'vehicle' | 'log'

export class Obstacle implements Entity {
  position: Position
  dimensions: Dimensions
  alive = true
  speed: number
  kind: ObstacleKind
  /** Visual colour hint for the Renderer; optional secondary colour. */
  color: string
  colorAlt: string

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    speed: number,
    kind: ObstacleKind,
    color: string,
    colorAlt = color,
  ) {
    this.position = { x, y }
    this.dimensions = { width, height }
    this.speed = speed
    this.kind = kind
    this.color = color
    this.colorAlt = colorAlt
  }

  /**
   * Advance the obstacle by `dt` seconds and wrap it around the canvas edges
   * so it re-enters from the opposite side without a gap.
   */
  update(dt: number): void {
    this.position.x += this.speed * dt
    // A small overshoot buffer (equal to the obstacle's own width) ensures the
    // obstacle is fully off-screen before teleporting, preventing a visual pop.
    if (this.speed > 0 && this.position.x > CANVAS_WIDTH) {
      this.position.x = -this.dimensions.width
    } else if (this.speed < 0 && this.position.x + this.dimensions.width < 0) {
      this.position.x = CANVAS_WIDTH
    }
  }
}
