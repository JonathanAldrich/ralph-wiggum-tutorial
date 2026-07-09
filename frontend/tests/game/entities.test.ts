/**
 * Unit tests for the Frogger game entities.
 *
 * All tests are pure logic (no canvas) covering the key edge cases:
 * frog movement boundary clamping, obstacle wrapping, and directional
 * facing. Canvas rendering is exercised via E2E instead.
 */
import { describe, it, expect } from 'vitest'
import { Frog } from '@/game/Frog'
import { Obstacle } from '@/game/Obstacle'
import {
  CANVAS_WIDTH,
  FROG_START_ROW,
  LANE_HEIGHT,
  FROG_WIDTH,
  FROG_HEIGHT,
} from '@/game/constants'

describe('Frog', () => {
  it('spawns at the start row centred horizontally', () => {
    const frog = new Frog()
    expect(frog.row).toBe(FROG_START_ROW)
    // x should be centred — within a few pixels of canvas centre.
    const cx = frog.position.x + FROG_WIDTH / 2
    expect(Math.abs(cx - CANVAS_WIDTH / 2)).toBeLessThan(2)
  })

  it('moveUp decrements the row and updates y position', () => {
    const frog = new Frog()
    const startRow = frog.row
    frog.moveUp()
    expect(frog.row).toBe(startRow - 1)
    expect(frog.position.y).toBeCloseTo(
      (startRow - 1) * LANE_HEIGHT + (LANE_HEIGHT - FROG_HEIGHT) / 2,
    )
  })

  it('cannot move above row 0', () => {
    const frog = new Frog()
    for (let i = 0; i < 20; i++) {
      frog['moveCooldown'] = 0  // bypass cooldown
      frog.moveUp()
    }
    expect(frog.row).toBe(0)
  })

  it('cannot move below the start row', () => {
    const frog = new Frog()
    for (let i = 0; i < 5; i++) {
      frog['moveCooldown'] = 0
      frog.moveDown()
    }
    expect(frog.row).toBe(FROG_START_ROW)
  })

  it('moveLeft cannot push the frog off the left edge', () => {
    const frog = new Frog()
    for (let i = 0; i < 30; i++) {
      frog['moveCooldown'] = 0
      frog.moveLeft()
    }
    expect(frog.position.x).toBeGreaterThanOrEqual(0)
  })

  it('moveRight cannot push the frog off the right edge', () => {
    const frog = new Frog()
    for (let i = 0; i < 30; i++) {
      frog['moveCooldown'] = 0
      frog.moveRight()
    }
    expect(frog.position.x + FROG_WIDTH).toBeLessThanOrEqual(CANVAS_WIDTH)
  })

  it('tracks facing direction when hopping', () => {
    const frog = new Frog()
    expect(frog.direction).toBe('up')
    frog.moveUp()
    expect(frog.direction).toBe('up')
    frog['moveCooldown'] = 0
    frog.moveDown()
    expect(frog.direction).toBe('down')
    frog['moveCooldown'] = 0
    frog.moveLeft()
    expect(frog.direction).toBe('left')
    frog['moveCooldown'] = 0
    frog.moveRight()
    expect(frog.direction).toBe('right')
  })

  it('drift moves position.x by the given delta', () => {
    const frog = new Frog()
    const startX = frog.position.x
    frog.drift(25)
    expect(frog.position.x).toBeCloseTo(startX + 25)
  })

  it('isOffScreen is true when drifted far off either edge', () => {
    const frog = new Frog()
    frog.drift(-2000)
    expect(frog.isOffScreen()).toBe(true)

    const frog2 = new Frog()
    frog2.drift(2000)
    expect(frog2.isOffScreen()).toBe(true)
  })

  it('reset restores starting state', () => {
    const frog = new Frog()
    frog.moveUp(); frog.drift(100)
    frog.reset()
    expect(frog.row).toBe(FROG_START_ROW)
    expect(frog.direction).toBe('up')
  })
})

describe('Obstacle', () => {
  it('moves rightward with positive speed', () => {
    const obs = new Obstacle(100, 0, 60, 32, 100, 'vehicle', '#f00')
    obs.update(1)
    expect(obs.position.x).toBeCloseTo(200)
  })

  it('moves leftward with negative speed', () => {
    const obs = new Obstacle(400, 0, 60, 32, -100, 'log', '#a00')
    obs.update(1)
    expect(obs.position.x).toBeCloseTo(300)
  })

  it('wraps around from right edge to left', () => {
    const obs = new Obstacle(CANVAS_WIDTH - 10, 0, 60, 32, 300, 'vehicle', '#f00')
    obs.update(1)  // large dt pushes it past the right edge
    expect(obs.position.x).toBeLessThan(0)  // wrapped to left of canvas
  })

  it('wraps around from left edge to right', () => {
    const obs = new Obstacle(10, 0, 60, 32, -300, 'log', '#a00')
    obs.update(1)
    expect(obs.position.x).toBeGreaterThan(CANVAS_WIDTH - 60)
  })

  it('stays alive (wrapping obstacles never die)', () => {
    const obs = new Obstacle(0, 0, 60, 32, 500, 'vehicle', '#f00')
    obs.update(10)
    expect(obs.alive).toBe(true)
  })
})
