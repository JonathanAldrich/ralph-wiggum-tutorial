/**
 * Tests for the Pong engine and its entities.
 *
 * jsdom does not implement a real 2D canvas context, so we inject a no-op
 * stub: these tests target game *logic* (state transitions, scoring, reflection,
 * win/lose resolution, bounds clamping) rather than pixels. We drive
 * `update(dt)` directly instead of the RAF loop so each frame is deterministic.
 * Canvas rendering itself is exercised via the Playwright E2E suite.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Pong } from '@/game/Pong'
import { Paddle } from '@/game/Paddle'
import { Ball } from '@/game/Ball'
import { ComputerOpponent } from '@/game/ComputerOpponent'
import {
  AI_SPEED,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_SCORE,
  PADDLE_SPEED,
} from '@/game/constants'

/** Minimal CanvasRenderingContext2D stub — every drawing call is a no-op. */
function makeStubContext(): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get: () => () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.getContext = (() => makeStubContext()) as HTMLCanvasElement['getContext']
  return canvas
}

/** Simulate pressing and releasing Space once at the window level. */
function tapSpace(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
}

/** Escape hatch to read/poke the engine's private fields in tests. */
type Internals = {
  playerScore: number
  computerScore: number
  state: string
  serveTimer: number
}
function internals(game: Pong): Internals {
  return game as unknown as Internals
}

/** Move the engine into a live rally with the ball already served. */
function enterRally(game: Pong): void {
  tapSpace()
  game.update(0.016) // start -> playing
  internals(game).serveTimer = 0
}

describe('Paddle', () => {
  it('clamps at the top wall even with a huge dt', () => {
    const paddle = new Paddle(0, 100)
    paddle.moveUp(1000)
    expect(paddle.position.y).toBe(0)
  })

  it('clamps at the bottom wall even with a huge dt', () => {
    const paddle = new Paddle(0, 100)
    paddle.moveDown(1000)
    expect(paddle.position.y).toBe(CANVAS_HEIGHT - paddle.dimensions.height)
  })
})

describe('Ball', () => {
  it('bounces off the top wall without tunneling through it', () => {
    const ball = new Ball()
    ball.position.y = 1
    ball.vy = -1000
    ball.update(0.05)
    expect(ball.position.y).toBeGreaterThanOrEqual(0)
    expect(ball.vy).toBeGreaterThan(0)
  })

  it('bounces off the bottom wall without tunneling through it', () => {
    const ball = new Ball()
    const maxY = CANVAS_HEIGHT - ball.dimensions.height
    ball.position.y = maxY - 1
    ball.vy = 1000
    ball.update(0.05)
    expect(ball.position.y).toBeLessThanOrEqual(maxY)
    expect(ball.vy).toBeLessThan(0)
  })

  it('serves from centre with horizontal motion in the requested direction', () => {
    const ball = new Ball()
    ball.serve(1)
    expect(ball.vx).toBeGreaterThan(0)
    ball.serve(-1)
    expect(ball.vx).toBeLessThan(0)
  })
})

describe('ComputerOpponent', () => {
  it('chases the ball when it is heading toward the AI, capped and clamped', () => {
    const paddle = new Paddle(0, 0)
    paddle.centerVertically()
    const startY = paddle.position.y
    const ball = new Ball()
    ball.position.y = CANVAS_HEIGHT - ball.dimensions.height // far below
    ball.vx = 200 // heading toward the AI
    new ComputerOpponent().update(paddle, ball, 0.016)
    // Moved down toward the ball, but no more than AI_SPEED * dt.
    expect(paddle.position.y).toBeGreaterThan(startY)
    expect(paddle.position.y - startY).toBeLessThanOrEqual(AI_SPEED * 0.016 + 1e-6)
  })

  it('is beatable: the AI paddle is slower than the player paddle', () => {
    expect(AI_SPEED).toBeLessThan(PADDLE_SPEED)
  })

  it('never leaves the court even with a large dt', () => {
    const paddle = new Paddle(0, 0)
    const ball = new Ball()
    ball.position.y = CANVAS_HEIGHT
    ball.vx = 200
    new ComputerOpponent().update(paddle, ball, 100)
    expect(paddle.position.y).toBeGreaterThanOrEqual(0)
    expect(paddle.position.y).toBeLessThanOrEqual(
      CANVAS_HEIGHT - paddle.dimensions.height,
    )
  })
})

describe('Pong', () => {
  let game: Pong

  beforeEach(() => {
    game = new Pong(makeCanvas())
  })

  afterEach(() => {
    game.destroy()
  })

  it('starts on the start screen with a zeroed score', () => {
    expect(game.getState()).toBe('start')
    expect(game.getPlayerScore()).toBe(0)
    expect(game.getComputerScore()).toBe(0)
  })

  it('transitions to playing when Space is pressed', () => {
    tapSpace()
    game.update(0.016)
    expect(game.getState()).toBe('playing')
  })

  it('throws if the 2D context is unavailable', () => {
    const canvas = document.createElement('canvas')
    canvas.getContext = (() => null) as HTMLCanvasElement['getContext']
    expect(() => new Pong(canvas)).toThrow()
  })

  it('moves the player paddle up and down from input, clamped to the court', () => {
    enterRally(game)
    const paddle = game.getPlayerPaddle()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
    for (let i = 0; i < 200; i++) game.update(0.05)
    expect(paddle.position.y).toBe(0)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }))

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }))
    for (let i = 0; i < 200; i++) game.update(0.05)
    expect(paddle.position.y).toBe(CANVAS_HEIGHT - paddle.dimensions.height)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }))
  })

  it('reflects the ball off the player paddle back toward the computer', () => {
    enterRally(game)
    const ball = game.getBall()
    const paddle = game.getPlayerPaddle()
    // Overlap the paddle face, centred, moving left into it.
    ball.position.x = paddle.position.x + 2
    ball.position.y = paddle.centerY - ball.dimensions.height / 2
    ball.vx = -300
    ball.vy = 0
    game.update(0.001)
    expect(ball.vx).toBeGreaterThan(0)
  })

  it('varies the return angle based on where the ball strikes the paddle', () => {
    enterRally(game)
    const ball = game.getBall()
    const paddle = game.getPlayerPaddle()
    // Strike near the top edge -> upward (negative vy) return.
    ball.position.x = paddle.position.x + 2
    ball.position.y = paddle.position.y - ball.dimensions.height / 2
    ball.vx = -300
    ball.vy = 0
    game.update(0.001)
    expect(ball.vy).not.toBe(0)
  })

  it('awards the player a point when the ball exits the right edge and resets', () => {
    enterRally(game)
    const ball = game.getBall()
    ball.position.x = CANVAS_WIDTH + 5
    ball.vx = 300
    game.update(0.001)
    expect(game.getPlayerScore()).toBe(1)
    expect(game.getState()).toBe('playing')
    // Ball recentred and a serve delay queued -> no double count next frame.
    expect(internals(game).serveTimer).toBeGreaterThan(0)
    game.update(0.001)
    expect(game.getPlayerScore()).toBe(1)
  })

  it('awards the computer a point when the ball exits the left edge', () => {
    enterRally(game)
    const ball = game.getBall()
    ball.position.x = -(ball.dimensions.width + 5)
    ball.vx = -300
    game.update(0.001)
    expect(game.getComputerScore()).toBe(1)
  })

  it('ends in a win once the player reaches MAX_SCORE', () => {
    enterRally(game)
    internals(game).playerScore = MAX_SCORE - 1
    const ball = game.getBall()
    ball.position.x = CANVAS_WIDTH + 5
    ball.vx = 300
    game.update(0.001)
    expect(game.getPlayerScore()).toBe(MAX_SCORE)
    expect(game.getState()).toBe('won')
  })

  it('ends in a loss once the computer reaches MAX_SCORE', () => {
    enterRally(game)
    internals(game).computerScore = MAX_SCORE - 1
    const ball = game.getBall()
    ball.position.x = -(ball.dimensions.width + 5)
    ball.vx = -300
    game.update(0.001)
    expect(game.getComputerScore()).toBe(MAX_SCORE)
    expect(game.getState()).toBe('lost')
  })

  it('restarts a fresh match from the end screen when Space is pressed', () => {
    enterRally(game)
    internals(game).playerScore = MAX_SCORE - 1
    const ball = game.getBall()
    ball.position.x = CANVAS_WIDTH + 5
    ball.vx = 300
    game.update(0.001)
    expect(game.getState()).toBe('won')

    tapSpace()
    game.update(0.016)
    expect(game.getState()).toBe('playing')
    expect(game.getPlayerScore()).toBe(0)
    expect(game.getComputerScore()).toBe(0)
  })

  it('does not skip past the end screen from held-key auto-repeat', () => {
    // A single Space press starts the match...
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    game.update(0.016)
    expect(game.getState()).toBe('playing')
    // ...and while it is still held, forcing an end state must not auto-restart.
    internals(game).state = 'won'
    game.update(0.016)
    expect(game.getState()).toBe('won')
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
  })

  it('reports score/status changes through the onStateChange callback', () => {
    const snapshots: string[] = []
    const g = new Pong(makeCanvas(), (s) =>
      snapshots.push(`${s.status}:${s.playerScore}:${s.computerScore}`),
    )
    tapSpace()
    g.update(0.016)
    expect(snapshots).toContain('start:0:0')
    expect(snapshots).toContain('playing:0:0')
    g.destroy()
  })

  it('cleans up without throwing on destroy', () => {
    expect(() => game.destroy()).not.toThrow()
  })
})
