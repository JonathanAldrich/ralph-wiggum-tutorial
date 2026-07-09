/**
 * InputHandler — keyboard state tracking for the game.
 *
 * Tracks currently-held keys for continuous polling (`isLeft()`, etc.) and
 * exposes edge-triggered consumption for one-shot actions (`consumeUp()`, etc.)
 * so discrete Frogger hops fire exactly once per key-press without auto-repeat
 * firing again while the key is held.
 *
 * `destroy()` removes all listeners — essential for the React Island unmount
 * path to avoid leaking global handlers across HMR reloads.
 */
export class InputHandler {
  private readonly held = new Set<string>()
  private startPressed = false
  private upPressed = false
  private downPressed = false
  private leftPressed = false
  private rightPressed = false

  constructor(private readonly target: Window | HTMLElement = window) {
    this.target.addEventListener('keydown', this.onKeyDown)
    this.target.addEventListener('keyup', this.onKeyUp)
  }

  private onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
    // Edge-detect: only latch on the initial press, not on auto-repeat.
    if (!this.held.has(e.code)) {
      if (e.code === 'Space')      this.startPressed = true
      if (e.code === 'ArrowUp')    this.upPressed    = true
      if (e.code === 'ArrowDown')  this.downPressed  = true
      if (e.code === 'ArrowLeft')  this.leftPressed  = true
      if (e.code === 'ArrowRight') this.rightPressed = true
    }
    this.held.add(e.code)
  }

  private onKeyUp = (event: Event): void => {
    this.held.delete((event as KeyboardEvent).code)
  }

  // Continuous (held) state queries.
  isLeft():  boolean { return this.held.has('ArrowLeft') }
  isRight(): boolean { return this.held.has('ArrowRight') }
  isUp():    boolean { return this.held.has('ArrowUp') }
  isDown():  boolean { return this.held.has('ArrowDown') }

  /**
   * Edge-triggered reads — return `true` exactly once per physical key press.
   * Used by Frogger so each arrow tap produces exactly one hop.
   */
  consumeStart(): boolean {
    if (this.startPressed) { this.startPressed = false; return true }
    return false
  }
  consumeUp(): boolean {
    if (this.upPressed)    { this.upPressed    = false; return true }
    return false
  }
  consumeDown(): boolean {
    if (this.downPressed)  { this.downPressed  = false; return true }
    return false
  }
  consumeLeft(): boolean {
    if (this.leftPressed)  { this.leftPressed  = false; return true }
    return false
  }
  consumeRight(): boolean {
    if (this.rightPressed) { this.rightPressed = false; return true }
    return false
  }

  /** Remove listeners and clear all state. Call on unmount to avoid leaks. */
  destroy(): void {
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.held.clear()
    this.startPressed = this.upPressed = this.downPressed =
      this.leftPressed = this.rightPressed = false
  }
}
