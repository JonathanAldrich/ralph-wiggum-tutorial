/**
 * Pure Snake game logic — no React, no timers, no DOM.
 *
 * Keeping the rules here (movement, direction guards, collisions, food
 * spawning, scoring) makes them deterministic and unit-testable without
 * fighting React's render/timer lifecycle. The board geometry constants must
 * stay in sync with the backend schema (`src/app/schemas/snake.py`), which
 * derives the maximum accepted score from them.
 */

export const BOARD_SIZE = 20
export const INITIAL_SNAKE_LENGTH = 3
/** Largest score a legitimate run can reach on a 20x20 board (400 - 3). */
export const MAX_SCORE = BOARD_SIZE * BOARD_SIZE - INITIAL_SNAKE_LENGTH

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Point {
  x: number
  y: number
}

export interface GameState {
  snake: Point[] // head is index 0
  food: Point
  direction: Direction
  score: number
  gameOver: boolean
}

/** Injectable RNG so tests can force deterministic food placement. */
export type Rng = () => number

const MOVES: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITES: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

/** True if changing from `current` to `next` would be a 180° reversal. */
export function isOpposite(current: Direction, next: Direction): boolean {
  return OPPOSITES[current] === next
}

/**
 * Resolve a requested direction change, blocking illegal 180° reversals.
 * Returns the current direction unchanged when the request is illegal.
 */
export function nextDirection(current: Direction, requested: Direction): Direction {
  return isOpposite(current, requested) ? current : requested
}

/** Compute the next head position for a given direction (no wrapping). */
export function moveHead(head: Point, direction: Direction): Point {
  const delta = MOVES[direction]
  return { x: head.x + delta.x, y: head.y + delta.y }
}

export function isWallCollision(head: Point): boolean {
  return head.x < 0 || head.y < 0 || head.x >= BOARD_SIZE || head.y >= BOARD_SIZE
}

export function isSelfCollision(head: Point, body: Point[]): boolean {
  return body.some((segment) => pointsEqual(segment, head))
}

/**
 * Pick a food cell that is not occupied by the snake. Uses the injected RNG
 * so tests can make placement deterministic. If the board is completely full
 * (a perfect win), returns an off-board sentinel that can never be reached.
 */
export function spawnFood(snake: Point[], rng: Rng = Math.random): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`))
  const free: Point[] = []
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    }
  }
  if (free.length === 0) return { x: -1, y: -1 }
  const index = Math.floor(rng() * free.length) % free.length
  return free[index]
}

/**
 * Build the starting game state with the snake centered and moving right.
 *
 * The first food is placed directly ahead of the head so the opening move
 * always scores. This gives the player an immediate target and — importantly —
 * makes end-to-end tests deterministic: a run can reach a non-zero, savable
 * score without relying on random food placement.
 */
export function createInitialState(rng: Rng = Math.random): GameState {
  const center = Math.floor(BOARD_SIZE / 2)
  const snake: Point[] = []
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    snake.push({ x: center - i, y: center })
  }
  const ahead: Point = { x: center + 1, y: center }
  const food = isWallCollision(ahead) ? spawnFood(snake, rng) : ahead
  return {
    snake,
    food,
    direction: 'right',
    score: 0,
    gameOver: false,
  }
}

/**
 * Advance the game by one tick. Pure: returns a new state, never mutates.
 * Handles wall/self collision (sets `gameOver`), eating (grow + score + new
 * food), and normal movement (shift forward, drop the tail).
 */
export function step(state: GameState, rng: Rng = Math.random): GameState {
  if (state.gameOver) return state

  const head = moveHead(state.snake[0], state.direction)

  if (isWallCollision(head)) {
    return { ...state, gameOver: true }
  }

  const eating = pointsEqual(head, state.food)
  // When not eating, the tail vacates its cell this tick, so a collision with
  // that specific cell is allowed.
  const bodyToCheck = eating ? state.snake : state.snake.slice(0, -1)
  if (isSelfCollision(head, bodyToCheck)) {
    return { ...state, gameOver: true }
  }

  const newSnake = eating ? [head, ...state.snake] : [head, ...state.snake.slice(0, -1)]
  const score = eating ? state.score + 1 : state.score
  const food = eating ? spawnFood(newSnake, rng) : state.food

  return { ...state, snake: newSnake, food, score }
}
