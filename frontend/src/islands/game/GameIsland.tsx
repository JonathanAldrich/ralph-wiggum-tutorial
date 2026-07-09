/**
 * GameIsland — thin React wrapper that owns the canvas lifecycle and a small
 * DOM-facing score/status surface.
 *
 * Per the spec, the game engine is pure TypeScript with no React dependency;
 * this component's jobs are to (1) render a `<canvas>` and bind the engine's
 * lifecycle to React's — create + `start()` on mount, `destroy()` on unmount —
 * and (2) mirror the engine's score/status into accessible DOM text.
 *
 * The canvas is opaque to assistive tech and to Playwright, so the engine
 * pushes a `PongPublicState` snapshot through `onStateChange` and we surface it
 * as a `role="status"` region. Crucially the engine only fires that callback
 * when the score or match status actually changes, so this state update — and
 * the React re-render it triggers — never happens on ordinary animation frames.
 */
import { useEffect, useRef, useState } from 'react'
import { Pong, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/game/Pong'
import type { PongPublicState } from '@/game/types'

const STATUS_LABEL: Record<PongPublicState['status'], string> = {
  start: 'Press Space to start',
  playing: 'Playing',
  won: 'You win! Press Space to play again',
  lost: 'You lose. Press Space to play again',
}

export function GameIsland() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snapshot, setSnapshot] = useState<PongPublicState>({
    status: 'start',
    playerScore: 0,
    computerScore: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const game = new Pong(canvas, setSnapshot)
    game.start()

    // Cleanup cancels the RAF loop and removes key listeners, so navigating
    // away or hot-reloading never leaks a running game or global handlers.
    return () => game.destroy()
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Pong game"
        className="border border-gray-700 rounded-lg shadow-lg bg-black max-w-full"
      />
      {/*
        Accessible, Playwright-assertable mirror of the canvas HUD. Updated only
        when the engine reports a score/status change, never per frame.
      */}
      <div
        role="status"
        aria-live="polite"
        className="font-mono text-gray-700 text-sm"
      >
        <span data-testid="pong-status">{STATUS_LABEL[snapshot.status]}</span>
        {' — '}
        <span>
          You <span data-testid="player-score">{snapshot.playerScore}</span>
          {' · '}
          CPU <span data-testid="computer-score">{snapshot.computerScore}</span>
        </span>
      </div>
    </div>
  )
}
