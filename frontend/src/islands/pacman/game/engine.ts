/**
 * Deterministic Pac-Man game engine — the single source of truth.
 *
 * Design notes (the "why"):
 * - Entities live on a discrete tile grid with a `progress` fraction toward
 *   the next tile. All decisions (turning, pellet eating, ghost direction
 *   choice) happen exactly at tile centers, which removes floating-point
 *   ambiguity and makes every transition reproducible.
 * - Ghost "random" movement (v1 strategy) is driven by a seeded LCG stored in
 *   `state.rngState`, so tests are fully deterministic despite randomness.
 * - `step` clamps the frame delta so tab-backgrounding cannot fast-forward the
 *   simulation. The function only advances while `phase === 'running'`.
 * - The engine never touches the DOM; rendering and input live elsewhere.
 */
import {
  buildMaze,
  buildPellets,
  GHOST_SPAWNS,
  MAZE_WIDTH,
  PACMAN_SPAWN,
  PACMAN_SPAWN_DIR,
} from './level'
import {
  FRIGHTENED_FLASH_MS,
  FRIGHTENED_MS,
  GHOST_EAT_SCORES,
  GHOST_FRIGHTENED_SPEED,
  GHOST_SPEED,
  INITIAL_LIVES,
  MAX_STEP_MS,
  PACMAN_SPEED,
  PELLET_SCORE,
  POWER_PELLET_SCORE,
} from './config'
import { TileType } from './types'
import type {
  Direction,
  Entity,
  GameState,
  Ghost,
  PacMan,
  TileCoord,
} from './types'

const EPS = 1e-9

const DELTAS: Record<Exclude<Direction, 'none'>, TileCoord> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
}

const OPPOSITE: Record<Exclude<Direction, 'none'>, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

/** Seeded LCG. Returns a float in [0, 1) and advances `state.rngState`. */
function nextRandom(state: GameState): number {
  // Numerical Recipes LCG constants.
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0
  return state.rngState / 0x100000000
}

/** Wrap a column through the horizontal tunnel; rows never wrap. */
function wrapCol(c: number): number {
  if (c < 0) return MAZE_WIDTH - 1
  if (c >= MAZE_WIDTH) return 0
  return c
}

/** The tile reached by stepping one tile from `tile` in `dir` (tunnel-aware). */
export function tileInDirection(tile: TileCoord, dir: Direction): TileCoord {
  if (dir === 'none') return { ...tile }
  const d = DELTAS[dir]
  return { r: tile.r + d.r, c: wrapCol(tile.c + d.c) }
}

/** True if the given tile is a wall. Out-of-vertical-bounds counts as a wall. */
export function isWall(state: GameState, tile: TileCoord): boolean {
  if (tile.r < 0 || tile.r >= state.maze.length) return true
  return state.maze[tile.r][wrapCol(tile.c)] === TileType.Wall
}

function canMove(state: GameState, tile: TileCoord, dir: Direction): boolean {
  if (dir === 'none') return false
  return !isWall(state, tileInDirection(tile, dir))
}

/** True while a frightened window is active. */
export function isFrightened(state: GameState): boolean {
  return state.frightenedTimer > 0
}

/** True during the final flash-warning slice of a frightened window. */
export function isFlashWarning(state: GameState): boolean {
  return state.frightenedTimer > 0 && state.frightenedTimer <= FRIGHTENED_FLASH_MS
}

function makePacman(): PacMan {
  return {
    tile: { ...PACMAN_SPAWN },
    dir: PACMAN_SPAWN_DIR,
    queuedDir: 'none',
    progress: 0,
    spawn: { ...PACMAN_SPAWN },
    spawnDir: PACMAN_SPAWN_DIR,
  }
}

function makeGhosts(): Ghost[] {
  return GHOST_SPAWNS.map((g) => ({
    tile: { ...g.spawn },
    dir: g.dir,
    progress: 0,
    color: g.color,
    frightened: false,
    spawn: { ...g.spawn },
    spawnDir: g.dir,
  }))
}

/** Create a fresh game in the `ready` phase. Also used for restart. */
export function createInitialState(seed = 1): GameState {
  const maze = buildMaze()
  const { pellets, total } = buildPellets(maze)
  return {
    phase: 'ready',
    score: 0,
    lives: INITIAL_LIVES,
    pacman: makePacman(),
    ghosts: makeGhosts(),
    maze,
    pellets,
    pelletsRemaining: total,
    frightenedTimer: 0,
    ghostEatChain: 0,
    rngState: seed >>> 0 || 1,
    resumePhase: 'running',
  }
}

/** Restart fully resets to the initial one-level state. */
export function restart(seed = 1): GameState {
  return createInitialState(seed)
}

/**
 * Queue a movement direction (from keyboard or touch). The first directional
 * input transitions `ready` -> `running` so the game starts on player intent.
 */
export function setDirection(state: GameState, dir: Direction): GameState {
  if (dir === 'none') return state
  if (state.phase === 'ready') {
    state.phase = 'running'
  }
  if (state.phase === 'running') {
    state.pacman.queuedDir = dir
    // If stationary at a center and the queued turn is immediately legal,
    // apply it now so the first key press starts movement responsively.
    if (state.pacman.progress === 0 && canMove(state, state.pacman.tile, dir)) {
      state.pacman.dir = dir
      state.pacman.queuedDir = 'none'
    }
  }
  return state
}

/** Manually toggle pause/resume via the P key. */
export function togglePause(state: GameState): GameState {
  if (state.phase === 'running') {
    state.phase = 'paused'
  } else if (state.phase === 'paused') {
    state.phase = 'running'
  }
  return state
}

/** Pause without player intent (e.g. tab hidden); remembers it was auto. */
export function pauseForVisibility(state: GameState): GameState {
  if (state.phase === 'running') {
    state.phase = 'paused'
  }
  return state
}

function eatPelletAt(state: GameState, tile: TileCoord): void {
  const cell = state.pellets[tile.r][tile.c]
  if (cell === 'none') return

  state.pellets[tile.r][tile.c] = 'none'
  state.pelletsRemaining--

  if (cell === 'power') {
    state.score += POWER_PELLET_SCORE
    activateFrightened(state)
  } else {
    state.score += PELLET_SCORE
  }

  if (state.pelletsRemaining <= 0) {
    state.phase = 'won'
  }
}

function activateFrightened(state: GameState): void {
  state.frightenedTimer = FRIGHTENED_MS
  state.ghostEatChain = 0
  for (const ghost of state.ghosts) {
    ghost.frightened = true
  }
}

function clearFrightened(state: GameState): void {
  state.frightenedTimer = 0
  state.ghostEatChain = 0
  for (const ghost of state.ghosts) {
    ghost.frightened = false
  }
}

/** Decision made by Pac-Man at a tile center: eat, then apply queued turn. */
function pacmanDecide(state: GameState): void {
  eatPelletAt(state, state.pacman.tile)
  if (state.phase !== 'running') return

  const p = state.pacman
  if (p.queuedDir !== 'none' && canMove(state, p.tile, p.queuedDir)) {
    p.dir = p.queuedDir
    p.queuedDir = 'none'
  }
  // If the current direction is blocked, movement simply halts in `advance`
  // (the facing direction is retained so a later queued turn can resume it).
}

/** Decision made by a ghost at a tile center: pick a random valid direction. */
function ghostDecide(state: GameState, ghost: Ghost): void {
  const all: Direction[] = ['up', 'down', 'left', 'right']
  const reverse = ghost.dir === 'none' ? 'none' : OPPOSITE[ghost.dir]
  const valid = all.filter((d) => canMove(state, ghost.tile, d))
  const preferred = valid.filter((d) => d !== reverse)
  const choices = preferred.length > 0 ? preferred : valid

  if (choices.length === 0) {
    ghost.dir = 'none'
    return
  }
  const idx = Math.floor(nextRandom(state) * choices.length)
  ghost.dir = choices[Math.min(idx, choices.length - 1)]
}

/**
 * Advance one entity by `distance` tiles, invoking `onCenter` whenever it is
 * exactly at a tile center (including the starting position). Movement stops
 * if the chosen direction is blocked by a wall.
 */
function advance(
  state: GameState,
  entity: Entity,
  distance: number,
  onCenter: (e: Entity) => void,
): void {
  let remaining = distance

  // Always run the center decision at the start of a step if aligned.
  if (entity.progress <= EPS) {
    entity.progress = 0
    onCenter(entity)
  }

  while (remaining > EPS) {
    if (entity.dir === 'none' || !canMove(state, entity.tile, entity.dir)) {
      // Blocked or idle: halt at the current center.
      break
    }
    const toNext = 1 - entity.progress
    const move = Math.min(remaining, toNext)
    entity.progress += move
    remaining -= move

    if (entity.progress >= 1 - EPS) {
      // Arrived at the next tile center.
      entity.tile = tileInDirection(entity.tile, entity.dir)
      entity.progress = 0
      onCenter(entity)
      if (state.phase !== 'running') break
    }
  }
}

function resetPositions(state: GameState): void {
  const p = state.pacman
  p.tile = { ...p.spawn }
  p.dir = p.spawnDir
  p.queuedDir = 'none'
  p.progress = 0
  for (const ghost of state.ghosts) {
    ghost.tile = { ...ghost.spawn }
    ghost.dir = ghost.spawnDir
    ghost.progress = 0
  }
}

function loseLife(state: GameState): void {
  state.lives--
  clearFrightened(state)
  if (state.lives <= 0) {
    state.lives = 0
    state.phase = 'game_over'
  } else {
    resetPositions(state)
  }
}

function eatGhost(state: GameState, ghost: Ghost): void {
  const idx = Math.min(state.ghostEatChain, GHOST_EAT_SCORES.length - 1)
  state.score += GHOST_EAT_SCORES[idx]
  state.ghostEatChain++
  ghost.frightened = false
  ghost.tile = { ...ghost.spawn }
  ghost.dir = ghost.spawnDir
  ghost.progress = 0
}

/**
 * Resolve Pac-Man/ghost collisions. Detects both same-tile overlap and a
 * direct swap (entities passing through each other in one step).
 */
function resolveCollisions(state: GameState, pacBefore: TileCoord, ghostBefore: TileCoord[]): void {
  const p = state.pacman
  for (let i = 0; i < state.ghosts.length; i++) {
    const ghost = state.ghosts[i]
    const overlap = ghost.tile.r === p.tile.r && ghost.tile.c === p.tile.c
    const swapped =
      ghost.tile.r === pacBefore.r &&
      ghost.tile.c === pacBefore.c &&
      p.tile.r === ghostBefore[i].r &&
      p.tile.c === ghostBefore[i].c
    if (!overlap && !swapped) continue

    if (ghost.frightened) {
      eatGhost(state, ghost)
    } else {
      loseLife(state)
      return
    }
  }
}

/**
 * Advance the simulation by `dtMs` milliseconds. Only runs while the game is
 * `running`; the delta is clamped to `MAX_STEP_MS`.
 */
export function step(state: GameState, dtMs: number): GameState {
  if (state.phase !== 'running') return state

  const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS)
  const dtSec = dt / 1000

  // Frightened countdown.
  if (state.frightenedTimer > 0) {
    state.frightenedTimer -= dt
    if (state.frightenedTimer <= 0) {
      clearFrightened(state)
    }
  }

  const pacBefore: TileCoord = { ...state.pacman.tile }
  const ghostBefore: TileCoord[] = state.ghosts.map((g) => ({ ...g.tile }))

  advance(state, state.pacman, PACMAN_SPEED * dtSec, () => pacmanDecide(state))
  if (state.phase !== 'running') return state

  for (const ghost of state.ghosts) {
    const speed = ghost.frightened ? GHOST_FRIGHTENED_SPEED : GHOST_SPEED
    advance(state, ghost, speed * dtSec, () => ghostDecide(state, ghost))
  }

  resolveCollisions(state, pacBefore, ghostBefore)
  return state
}
