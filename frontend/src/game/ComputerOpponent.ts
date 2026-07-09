/**
 * ComputerOpponent — the AI that drives the right-hand paddle.
 *
 * Encapsulating the AI here (rather than inlining it in the loop) keeps the
 * difficulty tuning — capped speed and a tracking dead-zone — in one place so
 * it can be adjusted without touching the gameplay structure.
 *
 * Design for "competent but beatable" (a spec requirement):
 * - The paddle moves at AI_SPEED, which is *below* the player's PADDLE_SPEED,
 *   so it cannot always recover from a well-placed shot.
 * - It only reacts while the ball is travelling toward it; when the ball moves
 *   away it drifts back to centre, mimicking a human resetting position rather
 *   than mirroring the ball with impossible reaction time.
 * - A tolerance dead-zone stops jitter and lets fast shots slip past the edge.
 */
import type { Ball } from './Ball'
import type { Paddle } from './Paddle'
import { AI_SPEED, AI_TOLERANCE, CANVAS_HEIGHT } from './constants'

export class ComputerOpponent {
  /**
   * Move `paddle` one frame toward its target.
   *
   * @param paddle - the computer's paddle.
   * @param ball   - the live ball (read-only here).
   * @param dt     - delta-time in seconds.
   */
  update(paddle: Paddle, ball: Ball, dt: number): void {
    // Track the ball only when it is heading our way; otherwise recentre.
    const target =
      ball.vx > 0 ? ball.centerY : CANVAS_HEIGHT / 2
    const delta = target - paddle.centerY

    if (Math.abs(delta) <= AI_TOLERANCE) return

    // Capped step: never move faster than AI_SPEED, and never overshoot the
    // target within this frame (avoids oscillation around the ball).
    const step = Math.sign(delta) * Math.min(AI_SPEED * dt, Math.abs(delta))
    paddle.moveBy(step)
  }
}
