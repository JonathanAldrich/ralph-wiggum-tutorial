/**
 * InputHandler — keyboard state tracking for Pong.
 *
 * Uses an event-driven "held keys" set rather than reacting to individual
 * keypress events, because gameplay needs to poll the *current* state every
 * frame ("is Up held right now?") instead of responding to discrete events.
 * The handler also exposes an edge-triggered `consumeStart()` so the
 * start/win/lose screens advance on a single Space press without auto-repeat
 * skipping straight past them (a spec edge case).
 *
 * `destroy()` removes the listeners — essential for the React Island unmount
 * path so we don't leak global handlers across navigations or HMR reloads.
 */
export class InputHandler {
  private readonly held = new Set<string>()
  /** Latched when Space transitions from up→down, cleared on consume. */
  private startPressed = false

  constructor(private readonly target: Window | HTMLElement = window) {
    this.target.addEventListener('keydown', this.onKeyDown)
    this.target.addEventListener('keyup', this.onKeyUp)
  }

  private onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent
    // Prevent the page from scrolling when the player uses arrows/space.
    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'Space'
    ) {
      e.preventDefault()
    }
    // Edge-detect Space: only latch on the initial press, not on auto-repeat,
    // so holding Space can't blow past the start/end screens.
    if (e.code === 'Space' && !this.held.has('Space')) {
      this.startPressed = true
    }
    this.held.add(e.code)
  }

  private onKeyUp = (event: Event): void => {
    this.held.delete((event as KeyboardEvent).code)
  }

  /** True while the player is holding ArrowUp (move paddle up). */
  isUp(): boolean {
    return this.held.has('ArrowUp')
  }

  /** True while the player is holding ArrowDown (move paddle down). */
  isDown(): boolean {
    return this.held.has('ArrowDown')
  }

  /**
   * Edge-triggered Space read for menu transitions. Returns true exactly once
   * per physical press, so a single tap starts/restarts the match instead of
   * instantly skipping screens while the key is held.
   */
  consumeStart(): boolean {
    if (this.startPressed) {
      this.startPressed = false
      return true
    }
    return false
  }

  /** Remove listeners and clear state. Call on teardown to avoid leaks. */
  destroy(): void {
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.held.clear()
    this.startPressed = false
  }
}
