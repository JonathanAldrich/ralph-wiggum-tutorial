/**
 * Engine unit tests — the deterministic core of Pac-Man.
 *
 * These tests are the safety net for gameplay rules that are impossible to
 * assert reliably in E2E (timing-dependent). They drive the pure engine with
 * controlled state and fixed deltas, exercising scoring, frightened mode,
 * collisions, tunnel wrap, win/game-over and restart. Determinism comes from
 * the seeded RNG in GameState, so ghost "random" movement never flakes.
 */
import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  isFrightened,
  isFlashWarning,
  restart,
  setDirection,
  step,
  togglePause,
} from '@/islands/pacman/game/engine'
import {
  FRIGHTENED_MS,
  GHOST_EAT_SCORES,
  INITIAL_LIVES,
  PELLET_SCORE,
  POWER_PELLET_SCORE,
} from '@/islands/pacman/game/config'
import type { GameState, TileCoord } from '@/islands/pacman/game/types'

/** Find the first path tile carrying a regular pellet. */
function findPellet(state: GameState, type: 'pellet' | 'power'): TileCoord {
  for (let r = 0; r < state.pellets.length; r++) {
    for (let c = 0; c < state.pellets[r].length; c++) {
      if (state.pellets[r][c] === type) return { r, c }
    }
  }
  throw new Error(`no ${type} found`)
}

function running(): GameState {
  const state = createInitialState(42)
  state.phase = 'running'
  return state
}

describe('Pac-Man engine', () => {
  it('starts in the ready phase with full HUD', () => {
    const state = createInitialState()
    expect(state.phase).toBe('ready')
    expect(state.score).toBe(0)
    expect(state.lives).toBe(INITIAL_LIVES)
    expect(state.pelletsRemaining).toBeGreaterThan(0)
  })

  it('first direction input transitions ready -> running', () => {
    const state = createInitialState()
    setDirection(state, 'left')
    expect(state.phase).toBe('running')
  })

  it('does not advance unless running', () => {
    const state = createInitialState()
    const before = { ...state.pacman.tile }
    step(state, 100)
    expect(state.pacman.tile).toEqual(before)
  })

  it('eats a pellet and scores 10', () => {
    const state = running()
    const tile = findPellet(state, 'pellet')
    state.pacman.tile = { ...tile }
    state.pacman.dir = 'none'
    state.pacman.progress = 0
    step(state, 16)
    expect(state.score).toBe(PELLET_SCORE)
    expect(state.pellets[tile.r][tile.c]).toBe('none')
  })

  it('eating a power pellet activates frightened mode and scores 50', () => {
    const state = running()
    const tile = findPellet(state, 'power')
    state.pacman.tile = { ...tile }
    state.pacman.dir = 'none'
    state.pacman.progress = 0
    step(state, 16)
    expect(state.score).toBe(POWER_PELLET_SCORE)
    expect(isFrightened(state)).toBe(true)
    expect(state.ghosts.every((g) => g.frightened)).toBe(true)
    expect(state.frightenedTimer).toBeGreaterThan(0)
  })

  it('frightened timer expires and ghosts return to normal', () => {
    const state = running()
    const tile = findPellet(state, 'power')
    state.pacman.tile = { ...tile }
    state.pacman.dir = 'none'
    step(state, 16)
    expect(isFrightened(state)).toBe(true)

    // Keep Pac-Man idle and run enough clamped steps to exceed the window.
    state.pacman.dir = 'none'
    state.pacman.queuedDir = 'none'
    const steps = Math.ceil(FRIGHTENED_MS / 100) + 5
    for (let i = 0; i < steps; i++) step(state, 100)

    expect(isFrightened(state)).toBe(false)
    expect(state.ghosts.every((g) => !g.frightened)).toBe(true)
  })

  it('enters the flash-warning phase before frightened expiry', () => {
    const state = running()
    const tile = findPellet(state, 'power')
    state.pacman.tile = { ...tile }
    state.pacman.dir = 'none'
    step(state, 16)

    expect(isFlashWarning(state)).toBe(false)
    state.frightenedTimer = 1000 // within the 2000ms warning window
    expect(isFlashWarning(state)).toBe(true)
  })

  it('applies cumulative ghost-eat multipliers in one window', () => {
    const state = running()
    state.frightenedTimer = FRIGHTENED_MS
    state.ghostEatChain = 0
    // Put every ghost on Pac-Man's tile, all frightened.
    for (const ghost of state.ghosts) {
      ghost.frightened = true
      ghost.tile = { ...state.pacman.tile }
    }
    state.pacman.dir = 'none'
    step(state, 16)

    const expected = GHOST_EAT_SCORES.slice(0, state.ghosts.length).reduce(
      (a, b) => a + b,
      0,
    )
    expect(state.score).toBe(expected)
  })

  it('rejects movement into a wall but applies a queued legal turn', () => {
    const state = running()
    // Tile (1,2): up is the top border wall; right is open.
    const tile: TileCoord = { r: 1, c: 2 }
    state.pellets[tile.r][tile.c] = 'none'
    state.pacman.tile = { ...tile }
    state.pacman.dir = 'up'
    state.pacman.queuedDir = 'none'
    state.pacman.progress = 0

    step(state, 16)
    expect(state.pacman.tile).toEqual(tile) // blocked, no movement

    setDirection(state, 'right')
    // Advance enough to cross at least one tile (6 tiles/s -> need >166ms).
    for (let i = 0; i < 20; i++) step(state, 16)
    expect(state.pacman.tile.c).toBeGreaterThan(tile.c)
  })

  it('wraps Pac-Man through the tunnel', () => {
    const state = running()
    const tunnelRow = Math.floor(state.maze.length / 2)
    state.pacman.tile = { r: tunnelRow, c: 1 }
    state.pacman.dir = 'left'
    state.pacman.queuedDir = 'none'
    state.pacman.progress = 0
    // Clear pellets on the tunnel row to avoid score noise / win.
    for (let c = 0; c < state.maze[tunnelRow].length; c++) {
      state.pellets[tunnelRow][c] = 'none'
    }

    let wrapped = false
    for (let i = 0; i < 60; i++) {
      step(state, 16)
      if (state.pacman.tile.c >= state.maze[tunnelRow].length - 2) {
        wrapped = true
        break
      }
    }
    expect(wrapped).toBe(true)
  })

  it('loses a life and respawns on collision with a normal ghost', () => {
    const state = running()
    state.lives = 3
    const ghost = state.ghosts[0]
    ghost.frightened = false
    ghost.tile = { ...state.pacman.tile }
    const spawn = { ...state.pacman.spawn }

    step(state, 16)
    expect(state.lives).toBe(2)
    expect(state.phase).toBe('running')
    expect(state.pacman.tile).toEqual(spawn)
  })

  it('transitions to game_over when the last life is lost', () => {
    const state = running()
    state.lives = 1
    const ghost = state.ghosts[0]
    ghost.frightened = false
    ghost.tile = { ...state.pacman.tile }

    step(state, 16)
    expect(state.lives).toBe(0)
    expect(state.phase).toBe('game_over')
  })

  it('wins when the final pellet is consumed', () => {
    const state = running()
    // Strip all pellets, then place a single one on Pac-Man's tile.
    for (let r = 0; r < state.pellets.length; r++) {
      for (let c = 0; c < state.pellets[r].length; c++) {
        state.pellets[r][c] = 'none'
      }
    }
    state.pellets[state.pacman.tile.r][state.pacman.tile.c] = 'pellet'
    state.pelletsRemaining = 1
    state.pacman.dir = 'none'

    step(state, 16)
    expect(state.pelletsRemaining).toBe(0)
    expect(state.phase).toBe('won')
  })

  it('pause toggles between running and paused', () => {
    const state = running()
    togglePause(state)
    expect(state.phase).toBe('paused')
    const before = { ...state.pacman.tile }
    step(state, 100) // no advance while paused
    expect(state.pacman.tile).toEqual(before)
    togglePause(state)
    expect(state.phase).toBe('running')
  })

  it('restart fully resets state', () => {
    const state = running()
    state.score = 500
    state.lives = 1
    state.pacman.tile = { r: 1, c: 1 }
    state.pelletsRemaining = 3
    state.frightenedTimer = 1234

    const fresh = restart()
    expect(fresh.score).toBe(0)
    expect(fresh.lives).toBe(INITIAL_LIVES)
    expect(fresh.phase).toBe('ready')
    expect(fresh.frightenedTimer).toBe(0)
    expect(fresh.pelletsRemaining).toBeGreaterThan(3)
  })

  it('clamps large frame deltas so backgrounding cannot fast-forward', () => {
    const state = running()
    state.pacman.tile = { r: Math.floor(state.maze.length / 2), c: 5 }
    state.pacman.dir = 'right'
    state.pacman.progress = 0
    for (let c = 0; c < state.maze[0].length; c++) {
      state.pellets[state.pacman.tile.r][c] = 'none'
    }

    const start = { ...state.pacman.tile }
    step(state, 100000) // huge delta, clamped to MAX_STEP_MS
    const traveled = Math.abs(state.pacman.tile.c - start.c) + state.pacman.progress
    // At 6 tiles/s with a 100ms clamp, at most ~0.6 tiles in one step.
    expect(traveled).toBeLessThan(1)
  })
})
