/**
 * Pong — the game orchestrator.
 *
 * Owns every subsystem (the two Paddles, the Ball, the ComputerOpponent AI,
 * InputHandler, and Renderer), the score, and the match lifecycle, and drives
 * them from a single `requestAnimationFrame` loop. Centralising the loop here
 * guarantees a consistent move → collide → score → render order each frame and
 * gives one place to stop simulation on win/lose.
 *
 * Frame-rate independence: the loop computes a delta-time in seconds and feeds
 * it to every `update(dt)`, so the game plays identically at 30, 60, or 144Hz.
 * The dt is clamped so a stalled/backgrounded tab can't teleport the ball or
 * paddles across the court (a spec edge case).
 *
 * DOM-facing state: the engine is pure TypeScript, but the island needs a
 * stable score/status surface for accessibility and Playwright. Rather than let
 * React poll every frame, the engine pushes a `PongPublicState` snapshot through
 * an optional `onStateChange` callback *only* when the status or a score
 * actually changes — never on ordinary motion frames.
 */
import { Ball } from './Ball'
import { ComputerOpponent } from './ComputerOpponent'
import { InputHandler } from './InputHandler'
import { Paddle } from './Paddle'
import { Renderer } from './Renderer'
import type { Entity, GameState, PongPublicState } from './types'
import {
  BALL_MAX_BOUNCE_ANGLE,
  BALL_MAX_SPEED,
  BALL_SPEEDUP,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_SCORE,
  PADDLE_MARGIN,
  PADDLE_WIDTH,
  SERVE_DELAY,
} from './constants'

/** Axis-aligned bounding-box overlap test between two entities. */
function intersects(a: Entity, b: Entity): boolean {
  return (
    a.position.x < b.position.x + b.dimensions.width &&
    a.position.x + a.dimensions.width > b.position.x &&
    a.position.y < b.position.y + b.dimensions.height &&
    a.position.y + a.dimensions.height > b.position.y
  )
}

/** Optional listener invoked when the DOM-facing snapshot changes. */
export type StateListener = (state: PongPublicState) => void

export class Pong {
  private readonly ctx: CanvasRenderingContext2D
  private readonly renderer: Renderer
  private readonly input: InputHandler
  private readonly ai = new ComputerOpponent()

  private player!: Paddle
  private computer!: Paddle
  private ball!: Ball
  private playerScore = 0
  private computerScore = 0
  private state: GameState = 'start'

  /** Seconds until the ball is served; >0 means the ball rests at centre. */
  private serveTimer = 0
  /** Direction (-1 toward player, +1 toward computer) of the pending serve. */
  private pendingServeDir = 1

  /** Timestamp of the previous animation frame (ms), or null before start. */
  private lastTime: number | null = null
  /** Active RAF handle, or null when the loop is stopped. */
  private rafId: number | null = null

  /** Last snapshot pushed to the island, for change-detection. */
  private lastEmitted: PongPublicState | null = null

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onStateChange?: StateListener,
  ) {
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Pong: 2D canvas context is not available')
    }
    this.ctx = ctx
    this.renderer = new Renderer(this.ctx)
    this.input = new InputHandler(window)

    // Make the canvas keyboard-focusable so it can be tabbed to; input is
    // captured at the window level, but focusability aids accessibility/E2E.
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0

    this.reset()
    this.emitState()
  }

  /** Reset paddles, ball, scores, and serve state for a fresh match. */
  reset(): void {
    this.player = new Paddle(PADDLE_MARGIN, 0)
    this.computer = new Paddle(
      CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH,
      0,
    )
    this.player.centerVertically()
    this.computer.centerVertically()
    this.ball = new Ball()
    this.playerScore = 0
    this.computerScore = 0
    // First serve of the match goes out after the usual delay, random side.
    this.serveTimer = SERVE_DELAY
    this.pendingServeDir = Math.random() < 0.5 ? -1 : 1
  }

  /** Begin the animation loop. Idempotent: re-entry won't stack RAF loops. */
  start(): void {
    if (this.rafId !== null) return
    this.lastTime = null
    this.rafId = requestAnimationFrame(this.loop)
  }

  /** Stop the loop and tear down listeners. Call on unmount to avoid leaks. */
  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.input.destroy()
  }

  /** Read-only accessors, primarily for tests/diagnostics. */
  getState(): GameState {
    return this.state
  }

  getPlayerScore(): number {
    return this.playerScore
  }

  getComputerScore(): number {
    return this.computerScore
  }

  getBall(): Ball {
    return this.ball
  }

  getPlayerPaddle(): Paddle {
    return this.player
  }

  getComputerPaddle(): Paddle {
    return this.computer
  }

  private loop = (now: number): void => {
    // Convert ms→s and clamp the first/after-stall frame so motion never
    // teleports (e.g. when the tab was backgrounded).
    const dt =
      this.lastTime === null ? 0 : Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now

    this.update(dt)
    this.render()

    this.rafId = requestAnimationFrame(this.loop)
  }

  /**
   * Advance the simulation by `dt` seconds.
   *
   * Menu states (start/won/lost) only watch for a Space press to begin a fresh
   * match; only `playing` runs the full simulation.
   */
  update(dt: number): void {
    if (this.state !== 'playing') {
      if (this.input.consumeStart()) {
        this.reset()
        this.state = 'playing'
        this.emitState()
      }
      return
    }

    // --- Paddle movement ---------------------------------------------------
    if (this.input.isUp()) this.player.moveUp(dt)
    if (this.input.isDown()) this.player.moveDown(dt)
    this.ai.update(this.computer, this.ball, dt)

    // --- Ball: serve countdown, then motion + resolution -------------------
    if (this.serveTimer > 0) {
      // Ball rests at centre; only launch once the countdown elapses.
      this.serveTimer -= dt
      if (this.serveTimer <= 0) {
        this.serveTimer = 0
        this.ball.serve(this.pendingServeDir)
      }
      return
    }

    this.ball.update(dt)
    this.handlePaddleCollisions()
    this.handleScoring()
  }

  /**
   * Reflect the ball off whichever paddle it is currently overlapping.
   *
   * The reflection angle varies with where the ball strikes the paddle face:
   * a centre hit returns near-horizontal, an edge hit returns at up to
   * BALL_MAX_BOUNCE_ANGLE. We only reflect when the ball is travelling *into*
   * the paddle (vx sign), which prevents a second bounce from re-triggering
   * while the ball is still overlapping on its way out.
   */
  private handlePaddleCollisions(): void {
    // Player paddle (left): reflect the ball rightward.
    if (this.ball.vx < 0 && intersects(this.ball, this.player)) {
      this.reflect(this.player, +1)
      this.ball.position.x =
        this.player.position.x + this.player.dimensions.width
    }
    // Computer paddle (right): reflect the ball leftward.
    else if (this.ball.vx > 0 && intersects(this.ball, this.computer)) {
      this.reflect(this.computer, -1)
      this.ball.position.x =
        this.computer.position.x - this.ball.dimensions.width
    }
  }

  /** Set the ball's post-bounce velocity off `paddle` toward `direction`. */
  private reflect(paddle: Paddle, direction: number): void {
    // -1 (top edge) .. +1 (bottom edge) relative to the paddle centre.
    const offset =
      (this.ball.centerY - paddle.centerY) / (paddle.dimensions.height / 2)
    const clamped = Math.max(-1, Math.min(1, offset))
    const angle = clamped * BALL_MAX_BOUNCE_ANGLE
    const speed = Math.min(this.ball.speed * BALL_SPEEDUP, BALL_MAX_SPEED)

    this.ball.vx = direction * speed * Math.cos(angle)
    this.ball.vy = speed * Math.sin(angle)
  }

  /**
   * Award a point when the ball leaves the left or right edge, reset the round
   * from centre serving toward the side that conceded, and end the match when
   * either side reaches MAX_SCORE. The boundary test fires once because the
   * ball is recentred immediately, so a single crossing can't double-count.
   */
  private handleScoring(): void {
    const exitedLeft = this.ball.position.x + this.ball.dimensions.width <= 0
    const exitedRight = this.ball.position.x >= CANVAS_WIDTH

    if (!exitedLeft && !exitedRight) return

    if (exitedLeft) {
      // Player missed → computer scores; next serve heads toward the player.
      this.computerScore += 1
      this.pendingServeDir = -1
    } else {
      // Computer missed → player scores; next serve heads toward the computer.
      this.playerScore += 1
      this.pendingServeDir = 1
    }

    if (this.playerScore >= MAX_SCORE) {
      this.state = 'won'
    } else if (this.computerScore >= MAX_SCORE) {
      this.state = 'lost'
    } else {
      // Park the ball and pause before the next serve.
      this.ball.centerInCourt()
      this.serveTimer = SERVE_DELAY
    }

    this.emitState()
  }

  /** Push a fresh snapshot to the island only when it actually changed. */
  private emitState(): void {
    if (!this.onStateChange) return
    const next: PongPublicState = {
      status: this.state,
      playerScore: this.playerScore,
      computerScore: this.computerScore,
    }
    const prev = this.lastEmitted
    if (
      prev &&
      prev.status === next.status &&
      prev.playerScore === next.playerScore &&
      prev.computerScore === next.computerScore
    ) {
      return
    }
    this.lastEmitted = next
    this.onStateChange(next)
  }

  /** Render the current frame according to match state. */
  private render(): void {
    this.renderer.clear()
    this.renderer.drawCourt()

    switch (this.state) {
      case 'start':
        this.renderer.drawStartScreen()
        break
      case 'playing':
        this.renderer.drawScore(this.playerScore, this.computerScore)
        this.renderer.drawPaddle(this.player)
        this.renderer.drawPaddle(this.computer)
        this.renderer.drawBall(this.ball)
        break
      case 'won':
        this.renderer.drawScore(this.playerScore, this.computerScore)
        this.renderer.drawEndScreen(true)
        break
      case 'lost':
        this.renderer.drawScore(this.playerScore, this.computerScore)
        this.renderer.drawEndScreen(false)
        break
    }
  }
}

export { CANVAS_WIDTH, CANVAS_HEIGHT }
