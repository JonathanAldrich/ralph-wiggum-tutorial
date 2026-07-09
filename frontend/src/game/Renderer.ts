/**
 * Renderer — all canvas drawing for Pong.
 *
 * Isolating every `ctx` call here keeps the game logic (Pong, the entities)
 * free of rendering concerns and, conversely, keeps the Renderer "dumb": it
 * draws whatever state it's handed and makes no gameplay decisions. That
 * separation is what makes the engine unit-testable without a real canvas.
 *
 * Visuals are simple geometric shapes (no sprite assets) so the game is
 * instantly playable with zero asset loading, per the spec.
 */
import type { Ball } from './Ball'
import type { Paddle } from './Paddle'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  FONT_FAMILY,
} from './constants'

export class Renderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /** Paint the black backdrop, clearing the previous frame. */
  clear(): void {
    this.ctx.fillStyle = COLORS.background
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }

  /** Draw the dashed centre line that divides the two halves of the court. */
  drawCourt(): void {
    this.ctx.fillStyle = COLORS.centerLine
    const dashHeight = 16
    const gap = 12
    const x = CANVAS_WIDTH / 2 - 2
    for (let y = 8; y < CANVAS_HEIGHT; y += dashHeight + gap) {
      this.ctx.fillRect(x, y, 4, dashHeight)
    }
  }

  /** Draw a paddle as a solid rectangle. */
  drawPaddle(paddle: Paddle): void {
    const { x, y } = paddle.position
    const { width, height } = paddle.dimensions
    this.ctx.fillStyle = COLORS.paddle
    this.ctx.fillRect(x, y, width, height)
  }

  /** Draw the ball as a solid square. */
  drawBall(ball: Ball): void {
    this.ctx.fillStyle = COLORS.ball
    this.ctx.fillRect(
      ball.position.x,
      ball.position.y,
      ball.dimensions.width,
      ball.dimensions.height,
    )
  }

  /** Draw both scores in the classic Pong HUD (player left, computer right). */
  drawScore(playerScore: number, computerScore: number): void {
    this.ctx.fillStyle = COLORS.text
    this.ctx.font = `48px ${FONT_FAMILY}`
    this.ctx.textBaseline = 'top'
    this.ctx.textAlign = 'right'
    this.ctx.fillText(`${playerScore}`, CANVAS_WIDTH / 2 - 40, 24)
    this.ctx.textAlign = 'left'
    this.ctx.fillText(`${computerScore}`, CANVAS_WIDTH / 2 + 40, 24)
  }

  /** Title screen prompting the player to serve the first ball. */
  drawStartScreen(): void {
    this.drawCenteredText('PONG', CANVAS_HEIGHT / 2 - 60, 52, COLORS.accent)
    this.drawCenteredText('Press SPACE to start', CANVAS_HEIGHT / 2 + 6, 22, COLORS.text)
    this.drawCenteredText('Move: \u2191 \u2193   First to 11 wins', CANVAS_HEIGHT / 2 + 44, 16, COLORS.text)
  }

  /** End screen shown when the match is decided. */
  drawEndScreen(playerWon: boolean): void {
    const title = playerWon ? 'YOU WIN!' : 'YOU LOSE'
    const color = playerWon ? COLORS.accent : COLORS.warn
    this.drawCenteredText(title, CANVAS_HEIGHT / 2 - 40, 44, color)
    this.drawCenteredText('Press SPACE to play again', CANVAS_HEIGHT / 2 + 24, 18, COLORS.text)
  }

  /** Helper: horizontally centered text at a given baseline y. */
  private drawCenteredText(text: string, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.font = `${size}px ${FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(text, CANVAS_WIDTH / 2, y)
  }
}
