/**
 * Canvas rendering for the Pac-Man board.
 *
 * Rendering is intentionally separate from React: the island drives this from
 * a requestAnimationFrame loop so the board animates without triggering React
 * re-renders every frame. All drawing reads from engine `GameState`.
 *
 * Guards: in jsdom (component tests) `getContext('2d')` returns null, so every
 * entry point tolerates a missing context and simply does nothing.
 */
import { TILE_SIZE } from './config'
import { TileType } from './types'
import type { GameState, Ghost } from './types'
import { isFlashWarning } from './engine'

/** Pixel center of an entity given its tile + progress along its direction. */
function entityPixel(
  tile: { r: number; c: number },
  progress: number,
  dir: string,
): { x: number; y: number } {
  let r = tile.r
  let c = tile.c
  if (dir === 'up') r -= progress
  else if (dir === 'down') r += progress
  else if (dir === 'left') c -= progress
  else if (dir === 'right') c += progress
  return { x: (c + 0.5) * TILE_SIZE, y: (r + 0.5) * TILE_SIZE }
}

function drawMaze(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let r = 0; r < state.maze.length; r++) {
    for (let c = 0; c < state.maze[r].length; c++) {
      if (state.maze[r][c] === TileType.Wall) {
        ctx.fillStyle = '#1d2b8a'
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      }
    }
  }
}

function drawPellets(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let r = 0; r < state.pellets.length; r++) {
    for (let c = 0; c < state.pellets[r].length; c++) {
      const cell = state.pellets[r][c]
      if (cell === 'none') continue
      const x = (c + 0.5) * TILE_SIZE
      const y = (r + 0.5) * TILE_SIZE
      ctx.fillStyle = '#ffd9b3'
      ctx.beginPath()
      ctx.arc(x, y, cell === 'power' ? TILE_SIZE * 0.28 : TILE_SIZE * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawPacman(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { tile, progress, dir } = state.pacman
  const { x, y } = entityPixel(tile, progress, dir)
  const radius = TILE_SIZE * 0.45

  // Animate the mouth based on travel progress.
  const mouth = 0.12 + 0.18 * Math.abs(Math.sin(progress * Math.PI))
  const base: Record<string, number> = { right: 0, down: 0.5, left: 1, up: 1.5, none: 0 }
  const facing = base[dir] ?? 0

  ctx.fillStyle = '#ffe600'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.arc(
    x,
    y,
    radius,
    (facing + mouth) * Math.PI,
    (facing - mouth + 2) * Math.PI,
  )
  ctx.closePath()
  ctx.fill()
}

function ghostColor(state: GameState, ghost: Ghost): string {
  if (!ghost.frightened) return ghost.color
  // Flash between blue and white during the warning phase.
  if (isFlashWarning(state)) {
    const flashOn = Math.floor(state.frightenedTimer / 250) % 2 === 0
    return flashOn ? '#ffffff' : '#2121de'
  }
  return '#2121de'
}

function drawGhost(ctx: CanvasRenderingContext2D, state: GameState, ghost: Ghost): void {
  const { x, y } = entityPixel(ghost.tile, ghost.progress, ghost.dir)
  const radius = TILE_SIZE * 0.45

  ctx.fillStyle = ghostColor(state, ghost)
  ctx.beginPath()
  ctx.arc(x, y - radius * 0.1, radius, Math.PI, 0)
  ctx.lineTo(x + radius, y + radius)
  ctx.lineTo(x + radius * 0.5, y + radius * 0.6)
  ctx.lineTo(x, y + radius)
  ctx.lineTo(x - radius * 0.5, y + radius * 0.6)
  ctx.lineTo(x - radius, y + radius)
  ctx.closePath()
  ctx.fill()

  // Eyes.
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x - radius * 0.35, y - radius * 0.1, radius * 0.18, 0, Math.PI * 2)
  ctx.arc(x + radius * 0.35, y - radius * 0.1, radius * 0.18, 0, Math.PI * 2)
  ctx.fill()
}

/** Draw a complete frame. No-op if the context is unavailable (jsdom). */
export function render(
  ctx: CanvasRenderingContext2D | null,
  state: GameState,
): void {
  if (!ctx) return
  const width = state.maze[0].length * TILE_SIZE
  const height = state.maze.length * TILE_SIZE

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  drawMaze(ctx, state)
  drawPellets(ctx, state)
  drawPacman(ctx, state)
  for (const ghost of state.ghosts) {
    drawGhost(ctx, state, ghost)
  }
}

/** Canvas pixel dimensions for the current maze. */
export function canvasSize(state: GameState): { width: number; height: number } {
  return {
    width: state.maze[0].length * TILE_SIZE,
    height: state.maze.length * TILE_SIZE,
  }
}
