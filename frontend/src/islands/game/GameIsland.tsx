/**
 * GameIsland — thin React wrapper that owns the canvas lifecycle.
 *
 * The game engine is pure TypeScript with no React dependency; this component
 * only renders a `<canvas>` and binds the engine's lifecycle to React's:
 * create + `start()` on mount, `destroy()` on unmount.
 */
import { useEffect, useRef } from 'react'
import { Frogger, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/game/Frogger'

export function GameIsland() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const game = new Frogger(canvas)
    game.start()

    return () => game.destroy()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      aria-label="Frogger game"
      className="border border-gray-700 rounded-lg shadow-lg bg-black max-w-full"
    />
  )
}
