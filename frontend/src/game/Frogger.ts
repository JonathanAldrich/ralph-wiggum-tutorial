/**
 * Frogger — the game orchestrator.
 *
 * Owns every subsystem (Frog, lanes of Obstacles, InputHandler, Renderer,
 * score, lives, timer, and lifecycle state) and drives them from a single
 * `requestAnimationFrame` loop.
 *
 * Game layout — 13 rows of 50 px each (total 650 px):
 *   Row  0  : home strip — 5 lily-pad openings; reaching one claims it.
 *   Rows 1–5: river — frog must ride a log; open water = instant death.
 *   Row  6  : safe median (grass).
 *   Rows 7–11: road — touching any vehicle = instant death.
 *   Row  12 : start zone (safe) + HUD.
 *
 * Frame-rate independence: every `update(dt)` takes delta-time in seconds so
 * the game plays identically at 30, 60, or 144 Hz.
 */
import { Frog } from './Frog'
import { InputHandler } from './InputHandler'
import { Obstacle } from './Obstacle'
import { Renderer } from './Renderer'
import type { Entity, GameState } from './types'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  HOME_CAPTURE_RADIUS,
  HOME_CENTERS,
  HOME_ROW,
  INITIAL_LIVES,
  RIVER_ROWS,
  ROAD_ROWS,
  ROUND_TIME,
  SCORE_HOME,
  SCORE_STEP_FORWARD,
} from './constants'

/** Axis-aligned bounding-box overlap test. */
function intersects(a: Entity, b: Entity): boolean {
  return (
    a.position.x          < b.position.x + b.dimensions.width  &&
    a.position.x + a.dimensions.width  > b.position.x          &&
    a.position.y          < b.position.y + b.dimensions.height &&
    a.position.y + a.dimensions.height > b.position.y
  )
}

/** Per-lane obstacle configuration used to seed each lane. */
interface LaneConfig {
  row:   number
  speed: number  // px/s; positive = rightward
  items: Array<{ x: number; width: number }>
  kind:  'vehicle' | 'log'
  color: string
  colorAlt?: string
}

/** Full lane table — all 5 river lanes and 5 road lanes. */
const LANE_CONFIGS: LaneConfig[] = [
  // ── River (logs) ──────────────────────────────────────────────────────────
  { row: 1, speed:  80, kind: 'log', color: COLORS.log, colorAlt: COLORS.logRing,
    items: [{ x: 0, width: 130 }, { x: 300, width: 90 }, { x: 550, width: 120 }] },
  { row: 2, speed: -65, kind: 'log', color: COLORS.log, colorAlt: COLORS.logRing,
    items: [{ x: 80, width: 100 }, { x: 360, width: 140 }, { x: 640, width: 80 }] },
  { row: 3, speed: 105, kind: 'log', color: COLORS.log, colorAlt: COLORS.logRing,
    items: [{ x: 50, width: 170 }, { x: 420, width: 110 }] },
  { row: 4, speed: -80, kind: 'log', color: COLORS.log, colorAlt: COLORS.logRing,
    items: [{ x: 10, width: 90 }, { x: 270, width: 130 }, { x: 570, width: 90 }] },
  { row: 5, speed:  55, kind: 'log', color: COLORS.log, colorAlt: COLORS.logRing,
    items: [{ x: 140, width: 110 }, { x: 440, width: 100 }, { x: 680, width: 95 }] },

  // ── Road (vehicles) ───────────────────────────────────────────────────────
  { row: 7,  speed: 130, kind: 'vehicle', color: COLORS.vehicle,    colorAlt: COLORS.vehicleGlass,
    items: [{ x: 0, width: 60 }, { x: 280, width: 80 }, { x: 600, width: 60 }] },
  { row: 8,  speed: -95, kind: 'vehicle', color: COLORS.vehicleAlt, colorAlt: COLORS.vehicleGlass,
    items: [{ x: 120, width: 120 }, { x: 520, width: 120 }] },
  { row: 9,  speed: 185, kind: 'vehicle', color: COLORS.vehicle,    colorAlt: COLORS.vehicleGlass,
    items: [{ x: 0, width: 55 }, { x: 190, width: 55 }, { x: 470, width: 55 }, { x: 690, width: 55 }] },
  { row: 10, speed: -120, kind: 'vehicle', color: COLORS.vehicleAlt, colorAlt: COLORS.vehicleGlass,
    items: [{ x: 60, width: 65 }, { x: 340, width: 65 }, { x: 620, width: 65 }] },
  { row: 11, speed:  75, kind: 'vehicle', color: COLORS.vehicle,    colorAlt: COLORS.vehicleGlass,
    items: [{ x: 150, width: 130 }, { x: 560, width: 130 }] },
]

export class Frogger {
  private readonly ctx: CanvasRenderingContext2D
  private readonly renderer: Renderer
  private readonly input: InputHandler

  private frog!: Frog
  /** Map from row index to the obstacles/logs in that lane. */
  private lanes!: Map<number, Obstacle[]>
  private homes!: boolean[]
  private lives = INITIAL_LIVES
  private score = 0
  private timer = ROUND_TIME
  private state: GameState = 'start'

  private lastTime: number | null = null
  private rafId: number | null = null

  constructor(canvas: HTMLCanvasElement) {
    canvas.width  = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Frogger: 2D canvas context is not available')
    this.ctx = ctx
    this.renderer = new Renderer(this.ctx)
    this.input = new InputHandler(window)

    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0

    this.reset()
  }

  /** Full reset — new game from scratch. */
  reset(): void {
    this.frog  = new Frog()
    this.homes = Array<boolean>(HOME_CENTERS.length).fill(false)
    this.lives = INITIAL_LIVES
    this.score = 0
    this.timer = ROUND_TIME
    this.spawnObstacles()
  }

  /** Begin the RAF loop. Idempotent — calling twice won't stack loops. */
  start(): void {
    if (this.rafId !== null) return
    this.lastTime = null
    this.rafId = requestAnimationFrame(this.loop)
  }

  /** Stop the loop and tear down listeners. Call on React unmount. */
  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.input.destroy()
  }

  /** Read-only accessors — used by tests and diagnostics. */
  getState(): GameState { return this.state }
  getScore(): number    { return this.score }
  getLives(): number    { return this.lives }

  // ─── RAF loop ──────────────────────────────────────────────────────────────

  private loop = (now: number): void => {
    const dt = this.lastTime === null
      ? 0
      : Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now

    this.update(dt)
    this.render()

    this.rafId = requestAnimationFrame(this.loop)
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by `dt` seconds.
   *
   * Non-playing states only watch for Space to begin/restart; only `playing`
   * runs the full physics, collision, and win/lose passes.
   */
  update(dt: number): void {
    if (this.state !== 'playing') {
      if (this.input.consumeStart()) {
        this.reset()
        this.state = 'playing'
      }
      return
    }

    // Countdown timer — losing time costs a life.
    this.timer -= dt
    if (this.timer <= 0) {
      this.killFrog()
      return
    }

    // Move all obstacles.
    for (const row of this.lanes.values()) {
      for (const obs of row) obs.update(dt)
    }

    // ── Input: one hop per key press ──────────────────────────────────────
    const prevRow = this.frog.row
    this.frog.update(dt)

    if (this.input.consumeUp())    this.frog.moveUp()
    else if (this.input.consumeDown())  this.frog.moveDown()
    else if (this.input.consumeLeft())  this.frog.moveLeft()
    else if (this.input.consumeRight()) this.frog.moveRight()

    // Forward-progress scoring: each new row closer to home earns points.
    if (this.frog.row < prevRow && this.frog.row < this.frog.bestRow) {
      this.score += SCORE_STEP_FORWARD
      this.frog.bestRow = this.frog.row
    }

    const row = this.frog.row

    // ── River zone: must ride a log ────────────────────────────────────────
    if ((RIVER_ROWS as readonly number[]).includes(row)) {
      const logs = this.lanes.get(row) ?? []
      const log  = logs.find(l => intersects(this.frog, l))
      if (log) {
        this.frog.drift(log.speed * dt)
        if (this.frog.isOffScreen()) { this.killFrog(); return }
      } else {
        this.killFrog()
        return
      }
    }

    // ── Road zone: any vehicle contact = death ─────────────────────────────
    if ((ROAD_ROWS as readonly number[]).includes(row)) {
      const vehicles = this.lanes.get(row) ?? []
      if (vehicles.some(v => intersects(this.frog, v))) {
        this.killFrog()
        return
      }
    }

    // ── Home row: claim a pad or fall in the water ─────────────────────────
    if (row === HOME_ROW) {
      this.handleHomeRow()
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    this.renderer.drawBackground()
    this.renderer.drawHomes(this.homes)

    const allObstacles: Obstacle[] = []
    for (const obs of this.lanes.values()) allObstacles.push(...obs)
    this.renderer.drawObstacles(allObstacles)

    this.renderer.drawFrog(this.frog)
    this.renderer.drawHUD(this.score, this.lives, this.timer, ROUND_TIME)

    switch (this.state) {
      case 'start':    this.renderer.drawStartScreen();            break
      case 'gameover': this.renderer.drawGameOver(this.score);     break
      case 'won':      this.renderer.drawWinScreen(this.score);    break
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Build all lane obstacles from the config table. */
  private spawnObstacles(): void {
    this.lanes = new Map()
    for (const cfg of LANE_CONFIGS) {
      const laneY = cfg.row * 50 + (50 - 32) / 2  // vertically centred in lane
      const obs = cfg.items.map(item =>
        new Obstacle(
          item.x,
          laneY,
          item.width,
          32,
          cfg.speed,
          cfg.kind,
          cfg.color,
          cfg.colorAlt ?? cfg.color,
        )
      )
      this.lanes.set(cfg.row, obs)
    }
  }

  /** Lose a life; switch to gameover when lives run out. */
  private killFrog(): void {
    this.lives--
    if (this.lives <= 0) {
      this.state = 'gameover'
    } else {
      this.resetFrog()
    }
  }

  /** Reset only the frog (not lives or score) — used after a non-fatal death. */
  private resetFrog(): void {
    this.frog.reset()
    this.timer = ROUND_TIME
  }

  /**
   * Called when the frog reaches the home row.
   * Checks for proximity to an unclaimed home pad; otherwise kills the frog.
   */
  private handleHomeRow(): void {
    const cx = this.frog.centerX()
    for (let i = 0; i < HOME_CENTERS.length; i++) {
      if (!this.homes[i] && Math.abs(cx - HOME_CENTERS[i]) <= HOME_CAPTURE_RADIUS) {
        this.homes[i] = true
        this.score += SCORE_HOME
        this.resetFrog()
        if (this.homes.every(h => h)) this.state = 'won'
        return
      }
    }
    // Didn't land on any home pad — fall in the water.
    this.killFrog()
  }
}

// Re-export canvas dimensions for GameIsland to size the <canvas> element.
export { CANVAS_WIDTH, CANVAS_HEIGHT }
