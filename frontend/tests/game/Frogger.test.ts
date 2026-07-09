/**
 * Integration tests for the Frogger orchestrator.
 *
 * jsdom does not implement a real 2D canvas context, so we inject a no-op
 * stub: these tests target game *logic* (state transitions, scoring, win/lose
 * resolution) rather than pixels. We drive `update(dt)` directly instead of
 * the RAF loop so each frame is deterministic.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Frogger } from '@/game/Frogger'

/** Minimal CanvasRenderingContext2D stub — every call is a no-op. */
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

/** Simulate pressing and releasing a key once at the window level. */
function tapKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }))
  window.dispatchEvent(new KeyboardEvent('keyup',  { code }))
}

describe('Frogger', () => {
  let game: Frogger

  beforeEach(() => {
    game = new Frogger(makeCanvas())
  })

  it('starts on the start screen with score 0 and 3 lives', () => {
    expect(game.getState()).toBe('start')
    expect(game.getScore()).toBe(0)
    expect(game.getLives()).toBe(3)
  })

  it('transitions to playing when Space is pressed', () => {
    tapKey('Space')
    game.update(0.016)
    expect(game.getState()).toBe('playing')
  })

  it('throws if the 2D context is unavailable', () => {
    const canvas = document.createElement('canvas')
    canvas.getContext = (() => null) as HTMLCanvasElement['getContext']
    expect(() => new Frogger(canvas)).toThrow()
  })

  it('wins once all five homes are claimed', () => {
    tapKey('Space')
    game.update(0.016)  // enter playing
    // Force all homes claimed via internal state.
    const homes = (game as unknown as { homes: boolean[] }).homes
    for (let i = 0; i < homes.length; i++) homes[i] = true
    // Move frog to home row at a home-pad position.
    const frog = (game as unknown as { frog: { row: number; position: { x: number; y: number }; bestRow: number } }).frog
    frog.row = 0
    frog.position.y = 0
    // Trigger a frame to detect win (homes already all claimed before this frame).
    // Reset last home to false so handleHomeRow can claim it and detect win.
    homes[4] = false
    frog.position.x = 720 - 16  // near HOME_CENTERS[4]=720, within capture radius
    game.update(0.016)
    expect(game.getState()).toBe('won')
  })

  it('loses a life when the frog is killed', () => {
    tapKey('Space')
    game.update(0.016)
    expect(game.getLives()).toBe(3)
    // Let the timer run out.
    game.update(31)
    expect(game.getLives()).toBe(2)
  })

  it('transitions to gameover after losing all lives', () => {
    tapKey('Space')
    game.update(0.016)
    // Drain all 3 lives via timer.
    game.update(31)
    game.update(31)
    game.update(31)
    expect(game.getState()).toBe('gameover')
  })

  it('restarts from gameover when Space is pressed', () => {
    tapKey('Space')
    game.update(0.016)
    game.update(31); game.update(31); game.update(31)
    expect(game.getState()).toBe('gameover')

    tapKey('Space')
    game.update(0.016)
    expect(game.getState()).toBe('playing')
    expect(game.getScore()).toBe(0)
    expect(game.getLives()).toBe(3)
  })

  it('scores points when the frog moves forward', () => {
    tapKey('Space')
    game.update(0.016)  // enter playing
    tapKey('ArrowUp')
    game.update(0.016)
    expect(game.getScore()).toBeGreaterThan(0)
  })

  it('cleans up without throwing on destroy', () => {
    expect(() => game.destroy()).not.toThrow()
  })

  afterEach(() => {
    game.destroy()
  })
})
