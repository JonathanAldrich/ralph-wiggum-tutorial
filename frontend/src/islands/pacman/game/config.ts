/**
 * Fixed gameplay constants for Pac-Man.
 *
 * Centralising these makes the engine free of magic numbers and lets tests
 * reference the same source of truth (e.g. scoring, frightened duration).
 */
import type { Direction } from './types'

/** Pixel size of a single maze tile when rendered to canvas. */
export const TILE_SIZE = 20

/**
 * Movement speeds in tiles-per-second. Pac-Man is slightly faster than the
 * ghosts so the game is winnable; frightened ghosts are slower so the player
 * can chase them down.
 */
export const PACMAN_SPEED = 6
export const GHOST_SPEED = 5
export const GHOST_FRIGHTENED_SPEED = 3

/** Starting lives. */
export const INITIAL_LIVES = 3

/** Score awarded per edible. */
export const PELLET_SCORE = 10
export const POWER_PELLET_SCORE = 50

/**
 * Cumulative ghost-eat multipliers within a single frightened window:
 * 1st ghost = 200, 2nd = 400, 3rd = 800, 4th = 1600. The chain resets when a
 * new power pellet is eaten or the window expires.
 */
export const GHOST_EAT_SCORES = [200, 400, 800, 1600] as const

/** Duration of a frightened window in milliseconds. */
export const FRIGHTENED_MS = 6000

/**
 * When the frightened window has this many milliseconds or fewer remaining,
 * ghosts enter the flash-warning phase so the player knows it is about to end.
 */
export const FRIGHTENED_FLASH_MS = 2000

/**
 * Maximum simulation delta per step, in milliseconds. Frame deltas are clamped
 * to this so backgrounding the tab (which produces a huge delta on return)
 * cannot fast-forward the game unpredictably.
 */
export const MAX_STEP_MS = 100

/** Key to pause / resume the game. */
export const PAUSE_KEY = 'p'

/**
 * Keyboard mappings: arrow keys and WASD both move; `P` pauses. Keys are
 * compared case-insensitively (see engine/island input handling).
 */
export const MOVEMENT_KEYS: Record<string, Direction> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

/**
 * Ghost movement strategy for v1.
 *
 * `'random'` means: at each tile center a ghost chooses a uniformly random
 * valid direction among its non-wall neighbours, excluding an immediate
 * 180° reversal unless that is the only option (a dead end). There is
 * intentionally NO chase/target AI in v1 — ghosts do not pursue Pac-Man.
 */
export const GHOST_STRATEGY: 'random' = 'random'
