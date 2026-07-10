/**
 * Unit tests for the pure Snake game logic.
 *
 * These exercise the rules directly (movement, reversal guard, collisions,
 * food placement, scoring) without any React or timer involvement, so they
 * are fast and fully deterministic via an injected RNG.
 */
import { describe, it, expect } from 'vitest'
import {
  BOARD_SIZE,
  MAX_SCORE,
  createInitialState,
  isOpposite,
  nextDirection,
  moveHead,
  isWallCollision,
  isSelfCollision,
  spawnFood,
  step,
  pointsEqual,
} from '@/islands/snake/game'

describe('game constants', () => {
  it('derives MAX_SCORE from board size and initial length', () => {
    expect(MAX_SCORE).toBe(BOARD_SIZE * BOARD_SIZE - 3)
  })
})

describe('direction rules', () => {
  it('detects opposite directions', () => {
    expect(isOpposite('left', 'right')).toBe(true)
    expect(isOpposite('up', 'down')).toBe(true)
    expect(isOpposite('up', 'left')).toBe(false)
  })

  it('blocks 180-degree reversals', () => {
    expect(nextDirection('right', 'left')).toBe('right')
    expect(nextDirection('up', 'down')).toBe('up')
  })

  it('allows legal turns', () => {
    expect(nextDirection('right', 'up')).toBe('up')
    expect(nextDirection('up', 'left')).toBe('left')
  })
})

describe('moveHead', () => {
  it('moves in each direction', () => {
    expect(moveHead({ x: 5, y: 5 }, 'up')).toEqual({ x: 5, y: 4 })
    expect(moveHead({ x: 5, y: 5 }, 'down')).toEqual({ x: 5, y: 6 })
    expect(moveHead({ x: 5, y: 5 }, 'left')).toEqual({ x: 4, y: 5 })
    expect(moveHead({ x: 5, y: 5 }, 'right')).toEqual({ x: 6, y: 5 })
  })
})

describe('collisions', () => {
  it('detects wall collisions', () => {
    expect(isWallCollision({ x: -1, y: 0 })).toBe(true)
    expect(isWallCollision({ x: 0, y: -1 })).toBe(true)
    expect(isWallCollision({ x: BOARD_SIZE, y: 0 })).toBe(true)
    expect(isWallCollision({ x: 0, y: BOARD_SIZE })).toBe(true)
    expect(isWallCollision({ x: 0, y: 0 })).toBe(false)
  })

  it('detects self collisions', () => {
    const body = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]
    expect(isSelfCollision({ x: 2, y: 1 }, body)).toBe(true)
    expect(isSelfCollision({ x: 3, y: 1 }, body)).toBe(false)
  })
})

describe('spawnFood', () => {
  it('never spawns on the snake body', () => {
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    // rng=0 picks the first free cell scanning rows top-to-bottom: (0,0) and
    // (1,0) are occupied, so the first free cell is (2,0).
    const food = spawnFood(snake, () => 0)
    expect(pointsEqual(food, { x: 2, y: 0 })).toBe(true)
  })

  it('returns an off-board sentinel when the board is full', () => {
    const full = []
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) full.push({ x, y })
    }
    expect(spawnFood(full, () => 0)).toEqual({ x: -1, y: -1 })
  })
})

describe('createInitialState', () => {
  it('centers a snake of the initial length moving right', () => {
    const state = createInitialState(() => 0)
    expect(state.snake).toHaveLength(3)
    expect(state.direction).toBe('right')
    expect(state.score).toBe(0)
    expect(state.gameOver).toBe(false)
    // Head is the frontmost cell.
    expect(state.snake[0].x).toBeGreaterThan(state.snake[1].x)
  })

  it('places the first food directly ahead of the head (savable-score guarantee)', () => {
    const state = createInitialState(() => 0)
    expect(state.food).toEqual({ x: state.snake[0].x + 1, y: state.snake[0].y })
  })
})

describe('step', () => {
  it('moves the snake forward without growing when not eating', () => {
    const state = createInitialState(() => 0)
    // Put food far away so we do not eat this tick.
    const withFood = { ...state, food: { x: 0, y: 0 } }
    const next = step(withFood, () => 0)
    expect(next.snake).toHaveLength(3)
    expect(next.score).toBe(0)
    expect(next.snake[0].x).toBe(state.snake[0].x + 1)
  })

  it('grows and scores when eating food', () => {
    const state = createInitialState(() => 0)
    const head = state.snake[0]
    const withFood = { ...state, food: { x: head.x + 1, y: head.y } }
    const next = step(withFood, () => 0)
    expect(next.snake).toHaveLength(4)
    expect(next.score).toBe(1)
  })

  it('ends the game on wall collision', () => {
    const state = createInitialState(() => 0)
    // Head at right wall, moving right.
    const atWall = {
      ...state,
      snake: [
        { x: BOARD_SIZE - 1, y: 5 },
        { x: BOARD_SIZE - 2, y: 5 },
        { x: BOARD_SIZE - 3, y: 5 },
      ],
      direction: 'right' as const,
      food: { x: 0, y: 0 },
    }
    expect(step(atWall, () => 0).gameOver).toBe(true)
  })

  it('ends the game on self collision', () => {
    // Snake curls so the head moves into a non-tail body segment: head (5,5)
    // moving right lands on (6,5), which is a middle segment (not the tail).
    const state = {
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ],
      food: { x: 0, y: 0 },
      direction: 'right' as const,
      score: 0,
      gameOver: false,
    }
    expect(step(state, () => 0).gameOver).toBe(true)
  })

  it('is a no-op once the game is over', () => {
    const state = { ...createInitialState(() => 0), gameOver: true }
    expect(step(state, () => 0)).toBe(state)
  })
})
