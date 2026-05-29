/**
 * Core gameplay types for the Pac-Man island.
 *
 * These types are intentionally framework-agnostic (no React / DOM) so the
 * engine and level modules can be unit-tested headlessly with Vitest. The
 * engine is the single source of truth for game state; React only reads
 * discrete HUD/overlay values derived from it.
 */

/** Static maze tile classification. Pellets are tracked separately (see PelletGrid). */
export const enum TileType {
  Wall = 0,
  Path = 1,
}

/** What edible item (if any) currently sits on a path tile. */
export type Pellet = 'none' | 'pellet' | 'power'

/** Movement direction. `none` means the entity is stationary. */
export type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

/** High-level game phases that drive overlays and the run loop. */
export type GamePhase = 'ready' | 'running' | 'paused' | 'won' | 'game_over'

/** Integer maze coordinate (row, column). */
export interface TileCoord {
  r: number
  c: number
}

/**
 * A moving entity. Position is expressed as an integer `tile` plus a
 * `progress` fraction (0..1) along `dir` toward the next tile. Keeping the
 * model discrete-with-progress (rather than free pixels) makes movement and
 * collision fully deterministic and easy to reason about in tests, while
 * still allowing smooth sub-tile rendering.
 */
export interface Entity {
  tile: TileCoord
  dir: Direction
  /** Fraction (0..1) travelled from `tile` toward the next tile along `dir`. */
  progress: number
}

export interface PacMan extends Entity {
  /** Direction the player wants next; applied at the next tile center if legal. */
  queuedDir: Direction
  spawn: TileCoord
  spawnDir: Direction
}

export interface Ghost extends Entity {
  /** Visual/identity colour used by the renderer. */
  color: string
  /** True while edible during a frightened window. */
  frightened: boolean
  spawn: TileCoord
  spawnDir: Direction
}

/** 2D grid of static tiles: `maze[r][c]`. */
export type MazeGrid = TileType[][]

/** 2D grid of pellets: `pellets[r][c]`. */
export type PelletGrid = Pellet[][]

/**
 * The complete, serialisable game state. Everything needed to render a frame
 * and to advance the simulation lives here so the engine stays pure.
 */
export interface GameState {
  phase: GamePhase
  score: number
  lives: number
  pacman: PacMan
  ghosts: Ghost[]
  maze: MazeGrid
  pellets: PelletGrid
  pelletsRemaining: number
  /** Milliseconds remaining in the current frightened window (0 when inactive). */
  frightenedTimer: number
  /** Index into the cumulative ghost-eat multiplier table for the current window. */
  ghostEatChain: number
  /** Seeded RNG state so ghost "random" movement is reproducible in tests. */
  rngState: number
  /** Phase to restore when resuming from a non-manual pause (visibility). */
  resumePhase: GamePhase
}
