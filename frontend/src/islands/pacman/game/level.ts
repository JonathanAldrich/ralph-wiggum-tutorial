/**
 * Single-level maze layout for Pac-Man.
 *
 * The maze is generated procedurally as a classic "pillar" grid: a solid
 * border of walls, plus isolated single-tile wall pillars at every
 * (even-row, even-column) interior position. Single pillars never disconnect
 * the corridors, so every path tile is guaranteed reachable — this keeps the
 * level provably solvable without hand-drawing/verifying a fixed ASCII map.
 *
 * One horizontal tunnel runs across the middle row: its two border tiles are
 * open and wrap to each other (see engine tunnel handling).
 *
 * Every path tile gets a pellet except the entity spawn tiles (which start
 * empty) and four power-pellet tiles placed near the corners.
 */
import { TileType } from './types'
import type { MazeGrid, PelletGrid, TileCoord, Direction } from './types'

/** Maze dimensions in tiles. Odd values keep the pillar layout symmetric. */
export const MAZE_WIDTH = 19
export const MAZE_HEIGHT = 19

/** The middle row is the wrap-around tunnel row. */
export const TUNNEL_ROW = Math.floor(MAZE_HEIGHT / 2)

const CENTER: TileCoord = {
  r: Math.floor(MAZE_HEIGHT / 2),
  c: Math.floor(MAZE_WIDTH / 2),
}

/** Pac-Man starts at the maze center, initially stationary. */
export const PACMAN_SPAWN: TileCoord = { ...CENTER }
export const PACMAN_SPAWN_DIR: Direction = 'none'

/**
 * Four ghosts spawn active on the board around the center (no ghost-house
 * release timer in v1). Each has a colour and an initial heading.
 */
export interface GhostSpawn {
  color: string
  spawn: TileCoord
  dir: Direction
}

export const GHOST_SPAWNS: GhostSpawn[] = [
  { color: '#ff0000', spawn: { r: CENTER.r, c: CENTER.c - 2 }, dir: 'left' },
  { color: '#ffb8ff', spawn: { r: CENTER.r, c: CENTER.c + 2 }, dir: 'right' },
  { color: '#00ffff', spawn: { r: CENTER.r - 2, c: CENTER.c }, dir: 'up' },
  { color: '#ffb852', spawn: { r: CENTER.r + 2, c: CENTER.c }, dir: 'down' },
]

/** Power-pellet positions near each corner. */
const POWER_PELLETS: TileCoord[] = [
  { r: 1, c: 1 },
  { r: 1, c: MAZE_WIDTH - 2 },
  { r: MAZE_HEIGHT - 2, c: 1 },
  { r: MAZE_HEIGHT - 2, c: MAZE_WIDTH - 2 },
]

function isBorder(r: number, c: number): boolean {
  return r === 0 || c === 0 || r === MAZE_HEIGHT - 1 || c === MAZE_WIDTH - 1
}

function isPillar(r: number, c: number): boolean {
  return r % 2 === 0 && c % 2 === 0
}

/** Build a fresh static maze grid. */
export function buildMaze(): MazeGrid {
  const maze: MazeGrid = []
  for (let r = 0; r < MAZE_HEIGHT; r++) {
    const row: TileType[] = []
    for (let c = 0; c < MAZE_WIDTH; c++) {
      // Open the two tunnel-row border tiles so the tunnel can wrap.
      const isTunnelOpening = r === TUNNEL_ROW && (c === 0 || c === MAZE_WIDTH - 1)
      const wall = !isTunnelOpening && (isBorder(r, c) || isPillar(r, c))
      row.push(wall ? TileType.Wall : TileType.Path)
    }
    maze.push(row)
  }
  return maze
}

function sameTile(a: TileCoord, b: TileCoord): boolean {
  return a.r === b.r && a.c === b.c
}

/**
 * Build a fresh pellet grid for the given maze. Returns the grid plus the
 * total pellet count (regular + power) so the engine can track remaining
 * pellets for the win condition.
 */
export function buildPellets(maze: MazeGrid): { pellets: PelletGrid; total: number } {
  const reserved: TileCoord[] = [PACMAN_SPAWN, ...GHOST_SPAWNS.map((g) => g.spawn)]
  const powerSet = POWER_PELLETS

  const pellets: PelletGrid = []
  let total = 0

  for (let r = 0; r < MAZE_HEIGHT; r++) {
    const row: PelletGrid[number] = []
    for (let c = 0; c < MAZE_WIDTH; c++) {
      const coord: TileCoord = { r, c }
      if (maze[r][c] === TileType.Wall) {
        row.push('none')
      } else if (reserved.some((t) => sameTile(t, coord))) {
        row.push('none')
      } else if (powerSet.some((t) => sameTile(t, coord))) {
        row.push('power')
        total++
      } else {
        row.push('pellet')
        total++
      }
    }
    pellets.push(row)
  }

  return { pellets, total }
}
