/**
 * Tunable game constants for Pong.
 *
 * Why one module: centralising every magic number keeps the feel of the game
 * adjustable in a single place (paddle size, ball speed, AI difficulty) and
 * keeps the entity classes declarative. Tuning the AI here — rather than in the
 * loop — is what lets difficulty change without touching gameplay structure.
 *
 * Units: all speeds are expressed in **pixels per second** and every `update`
 * takes a delta-time (seconds) so motion is frame-rate independent. This avoids
 * the classic bug where the game runs faster on high-refresh displays.
 */

/** Fixed canvas size. The game is designed around these dimensions. */
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 600

/** Paddle geometry and movement. */
export const PADDLE_WIDTH = 12
export const PADDLE_HEIGHT = 80
export const PADDLE_SPEED = 460 // px/s — the player's vertical paddle speed
/** Gap between each paddle's outer face and the side wall it defends. */
export const PADDLE_MARGIN = 24

/** Ball geometry and speed. */
export const BALL_SIZE = 12
/** Speed the ball is served at each round. */
export const BALL_BASE_SPEED = 380 // px/s
/** Multiplier applied to ball speed on every paddle contact (rally ramp-up). */
export const BALL_SPEEDUP = 1.05
/** Hard cap so long rallies never make the ball untrackable/tunnel-prone. */
export const BALL_MAX_SPEED = 820 // px/s
/**
 * Maximum reflection angle (radians) off a paddle face, measured from the
 * horizontal. Hitting the paddle edge yields this angle; hitting dead-centre
 * sends the ball back near-horizontal. Keeping it below 90° guarantees the
 * ball always makes horizontal progress and rallies can't stall vertically.
 */
export const BALL_MAX_BOUNCE_ANGLE = Math.PI / 3 // 60°

/** Seconds the ball rests at centre before it is served after each point. */
export const SERVE_DELAY = 0.8

/** First side to reach this score wins the match. */
export const MAX_SCORE = 11

/**
 * AI tuning. The computer paddle moves slower than the player and tolerates a
 * small tracking error so it is competent but beatable — it must not mirror the
 * ball with impossible reaction time (see spec edge cases).
 */
export const AI_SPEED = 340 // px/s — capped, below PADDLE_SPEED so it's beatable
/** Dead-zone (px): the AI won't chase alignment errors smaller than this. */
export const AI_TOLERANCE = 14

/** Colors (kept here so the Renderer stays purely mechanical). */
export const COLORS = {
  background: '#000000',
  paddle: '#ffffff',
  ball: '#ffffff',
  centerLine: '#444444',
  text: '#ffffff',
  accent: '#00ff66',
  warn: '#ff5555',
} as const

/** Font stack used for all on-canvas text. */
export const FONT_FAMILY = 'monospace'
