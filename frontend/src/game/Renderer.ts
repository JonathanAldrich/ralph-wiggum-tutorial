/**
 * Renderer — all canvas drawing for Frogger.
 *
 * Pure presentation: it receives game state and paints it. No gameplay logic
 * lives here, keeping the engine unit-testable without a canvas context.
 * All visuals use geometric shapes — no image assets needed.
 */
import type { Frog } from './Frog'
import type { Obstacle } from './Obstacle'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  FONT_FAMILY,
  HOME_CENTERS,
  HOME_PAD_WIDTH,
  HOME_ROW,
  LANE_HEIGHT,
  MEDIAN_ROW,
  RIVER_ROWS,
  ROAD_ROWS,
  START_ROW,
} from './constants'

export class Renderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  // ─── Full-frame methods ────────────────────────────────────────────────────

  /** Draw the static lane backgrounds. */
  drawBackground(): void {
    for (let row = 0; row < START_ROW + 1; row++) {
      const y = row * LANE_HEIGHT
      if (row === HOME_ROW) {
        this.ctx.fillStyle = COLORS.homeStrip
        this.ctx.fillRect(0, y, CANVAS_WIDTH, LANE_HEIGHT)
      } else if ((RIVER_ROWS as readonly number[]).includes(row)) {
        this.ctx.fillStyle = COLORS.river
        this.ctx.fillRect(0, y, CANVAS_WIDTH, LANE_HEIGHT)
        // Subtle shimmer lines.
        this.ctx.fillStyle = COLORS.riverShimmer
        this.ctx.fillRect(0, y + LANE_HEIGHT * 0.35, CANVAS_WIDTH, 2)
      } else if (row === MEDIAN_ROW || row === START_ROW) {
        this.ctx.fillStyle = COLORS.grass
        this.ctx.fillRect(0, y, CANVAS_WIDTH, LANE_HEIGHT)
      } else if ((ROAD_ROWS as readonly number[]).includes(row)) {
        this.ctx.fillStyle = COLORS.road
        this.ctx.fillRect(0, y, CANVAS_WIDTH, LANE_HEIGHT)
        // Dashed centre line.
        this.ctx.fillStyle = COLORS.roadLine
        const lineY = y + LANE_HEIGHT / 2 - 1
        for (let x = 0; x < CANVAS_WIDTH; x += 24) {
          this.ctx.fillRect(x, lineY, 14, 2)
        }
      }
    }
    // Border between road and median.
    this.ctx.fillStyle = COLORS.roadLine
    this.ctx.fillRect(0, MEDIAN_ROW * LANE_HEIGHT - 2, CANVAS_WIDTH, 2)
    this.ctx.fillRect(0, (MEDIAN_ROW + 1) * LANE_HEIGHT, CANVAS_WIDTH, 2)
  }

  /** Draw the home strip pads, highlighting claimed ones. */
  drawHomes(homes: boolean[]): void {
    const y = HOME_ROW * LANE_HEIGHT
    HOME_CENTERS.forEach((cx, i) => {
      const padX = cx - HOME_PAD_WIDTH / 2
      const padY = y + (LANE_HEIGHT - 36) / 2
      this.ctx.fillStyle = homes[i] ? COLORS.homeOccupied : COLORS.homePad
      // Rounded-rect approximation using arc.
      this.roundRect(padX, padY, HOME_PAD_WIDTH, 36, 8)
      // Lily-pad cross detail.
      this.ctx.fillStyle = homes[i] ? '#16a34a' : '#14532d'
      this.ctx.fillRect(cx - 1, padY + 4, 2, 28)
      this.ctx.fillRect(padX + 4, padY + 17, HOME_PAD_WIDTH - 8, 2)
    })
  }

  /** Draw every obstacle (log or vehicle). */
  drawObstacles(obstacles: Obstacle[]): void {
    for (const obs of obstacles) {
      if (!obs.alive) continue
      if (obs.kind === 'log') {
        this.drawLog(obs)
      } else {
        this.drawVehicle(obs)
      }
    }
  }

  /** Draw the frog at its current position, oriented by direction. */
  drawFrog(frog: Frog): void {
    if (!frog.alive) return
    const { x, y } = frog.position
    const w = frog.dimensions.width
    const h = frog.dimensions.height
    const cx = x + w / 2
    const cy = y + h / 2
    const r = Math.min(w, h) / 2

    // Body.
    this.ctx.fillStyle = COLORS.frog
    this.ctx.beginPath()
    this.ctx.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Belly.
    this.ctx.fillStyle = COLORS.frogDark
    this.ctx.beginPath()
    this.ctx.ellipse(cx, cy + 2, r * 0.55, r * 0.45, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Eyes (positioned by facing direction).
    this.ctx.fillStyle = COLORS.frogEye
    const eyeR = 4
    const eyeOffset = r * 0.55
    let ex1: number, ey1: number, ex2: number, ey2: number
    switch (frog.direction) {
      case 'up':
        ex1 = cx - eyeOffset * 0.6; ey1 = cy - eyeOffset * 0.7
        ex2 = cx + eyeOffset * 0.6; ey2 = cy - eyeOffset * 0.7
        break
      case 'down':
        ex1 = cx - eyeOffset * 0.6; ey1 = cy + eyeOffset * 0.6
        ex2 = cx + eyeOffset * 0.6; ey2 = cy + eyeOffset * 0.6
        break
      case 'left':
        ex1 = cx - eyeOffset * 0.7; ey1 = cy - eyeOffset * 0.5
        ex2 = cx - eyeOffset * 0.7; ey2 = cy + eyeOffset * 0.5
        break
      case 'right':
        ex1 = cx + eyeOffset * 0.7; ey1 = cy - eyeOffset * 0.5
        ex2 = cx + eyeOffset * 0.7; ey2 = cy + eyeOffset * 0.5
        break
    }
    this.ctx.beginPath(); this.ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); this.ctx.fill()
    this.ctx.beginPath(); this.ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); this.ctx.fill()
    // Pupils.
    this.ctx.fillStyle = '#000'
    this.ctx.beginPath(); this.ctx.arc(ex1, ey1, 2, 0, Math.PI * 2); this.ctx.fill()
    this.ctx.beginPath(); this.ctx.arc(ex2, ey2, 2, 0, Math.PI * 2); this.ctx.fill()
  }

  /** Overlay: score, lives (as frog icons), and timer bar. */
  drawHUD(score: number, lives: number, timer: number, totalTime: number): void {
    const hudY = START_ROW * LANE_HEIGHT
    const hudH = LANE_HEIGHT

    // Score.
    this.ctx.fillStyle = COLORS.text
    this.ctx.font = `bold 16px ${FONT_FAMILY}`
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(`SCORE: ${score}`, 12, hudY + hudH / 2)

    // Lives as small frog circles.
    this.ctx.fillStyle = COLORS.frog
    for (let i = 0; i < lives; i++) {
      this.ctx.beginPath()
      this.ctx.arc(CANVAS_WIDTH / 2 + 60 + i * 22, hudY + hudH / 2, 7, 0, Math.PI * 2)
      this.ctx.fill()
    }
    this.ctx.fillStyle = COLORS.text
    this.ctx.font = `12px ${FONT_FAMILY}`
    this.ctx.textAlign = 'right'
    this.ctx.fillText('LIVES:', CANVAS_WIDTH / 2 + 52, hudY + hudH / 2)

    // Timer bar.
    const frac = Math.max(0, timer / totalTime)
    const barW = 140
    const barX = CANVAS_WIDTH - barW - 12
    const barY = hudY + (hudH - 10) / 2
    this.ctx.fillStyle = '#374151'
    this.ctx.fillRect(barX, barY, barW, 10)
    this.ctx.fillStyle =
      frac > 0.5 ? COLORS.timerGood : frac > 0.25 ? COLORS.timerWarn : COLORS.timerDanger
    this.ctx.fillRect(barX, barY, barW * frac, 10)
    this.ctx.fillStyle = COLORS.text
    this.ctx.font = `11px ${FONT_FAMILY}`
    this.ctx.textAlign = 'right'
    this.ctx.textBaseline = 'bottom'
    this.ctx.fillText('TIME', barX + barW, barY - 1)
  }

  /** Title screen. */
  drawStartScreen(): void {
    this.ctx.fillStyle = 'rgba(0,0,0,0.65)'
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    this.drawCentered('FROGGER', CANVAS_HEIGHT / 2 - 50, 48, COLORS.accent)
    this.drawCentered('Press SPACE to start', CANVAS_HEIGHT / 2 + 10, 22, COLORS.text)
    this.drawCentered('Arrow keys to hop', CANVAS_HEIGHT / 2 + 44, 16, COLORS.text)
    this.drawCentered('Ride logs · Dodge cars · Reach the lily pads!', CANVAS_HEIGHT / 2 + 72, 14, '#9ca3af')
  }

  /** Game-over overlay. */
  drawGameOver(score: number): void {
    this.ctx.fillStyle = 'rgba(0,0,0,0.7)'
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    this.drawCentered('GAME OVER', CANVAS_HEIGHT / 2 - 40, 42, COLORS.danger)
    this.drawCentered(`Score: ${score}`, CANVAS_HEIGHT / 2 + 16, 24, COLORS.text)
    this.drawCentered('Press SPACE to play again', CANVAS_HEIGHT / 2 + 54, 18, COLORS.text)
  }

  /** Win overlay. */
  drawWinScreen(score: number): void {
    this.ctx.fillStyle = 'rgba(0,0,0,0.7)'
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    this.drawCentered('YOU WIN! 🐸', CANVAS_HEIGHT / 2 - 40, 42, COLORS.accent)
    this.drawCentered(`Final score: ${score}`, CANVAS_HEIGHT / 2 + 16, 24, COLORS.text)
    this.drawCentered('Press SPACE to play again', CANVAS_HEIGHT / 2 + 54, 18, COLORS.text)
  }

  // ─── Private drawing helpers ───────────────────────────────────────────────

  private drawLog(obs: Obstacle): void {
    const { x, y } = obs.position
    const { width: w, height: h } = obs.dimensions
    this.ctx.fillStyle = obs.color
    this.roundRect(x, y + 4, w, h - 8, 6)
    // Wood grain rings.
    this.ctx.fillStyle = obs.colorAlt
    for (let rx = 18; rx < w - 6; rx += 20) {
      this.ctx.beginPath()
      this.ctx.ellipse(x + rx, y + h / 2, 4, (h - 10) / 2, 0, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  private drawVehicle(obs: Obstacle): void {
    const { x, y } = obs.position
    const { width: w, height: h } = obs.dimensions
    const vy = y + 6
    const vh = h - 12
    // Body.
    this.ctx.fillStyle = obs.color
    this.roundRect(x, vy, w, vh, 5)
    // Windows.
    this.ctx.fillStyle = obs.colorAlt
    const wW = Math.min(w * 0.28, 28)
    if (obs.speed > 0) {
      this.ctx.fillRect(x + w - wW - 8, vy + 4, wW, vh - 8)
    } else {
      this.ctx.fillRect(x + 8, vy + 4, wW, vh - 8)
    }
  }

  /** Fill a rounded rectangle. */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath()
    this.ctx.moveTo(x + r, y)
    this.ctx.lineTo(x + w - r, y)
    this.ctx.arcTo(x + w, y, x + w, y + r, r)
    this.ctx.lineTo(x + w, y + h - r)
    this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    this.ctx.lineTo(x + r, y + h)
    this.ctx.arcTo(x, y + h, x, y + h - r, r)
    this.ctx.lineTo(x, y + r)
    this.ctx.arcTo(x, y, x + r, y, r)
    this.ctx.closePath()
    this.ctx.fill()
  }

  private drawCentered(text: string, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.font = `bold ${size}px ${FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(text, CANVAS_WIDTH / 2, y)
  }
}
