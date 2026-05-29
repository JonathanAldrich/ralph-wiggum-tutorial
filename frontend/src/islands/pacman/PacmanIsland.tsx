/**
 * PacmanIsland — the React shell around the canvas game.
 *
 * Responsibilities split (the "why"):
 * - The engine owns all gameplay state in a ref; React state mirrors only the
 *   discrete HUD/overlay values (score, lives, phase) so the per-frame canvas
 *   loop never forces React re-renders.
 * - A single requestAnimationFrame loop, with its handle stored in a ref and
 *   cancelled on cleanup, advances + renders the game. This guards against
 *   React 18 StrictMode's dev double-invoke spawning duplicate loops.
 * - Keyboard (arrows/WASD/P) and touch input both feed the same engine API.
 *   Gameplay keys call preventDefault so the page does not scroll.
 * - The game auto-pauses when the tab is hidden.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createInitialState,
  pauseForVisibility,
  setDirection,
  step,
  togglePause,
} from './game/engine'
import { canvasSize, render } from './game/render'
import { INITIAL_LIVES, MOVEMENT_KEYS, PAUSE_KEY } from './game/config'
import type { Direction, GamePhase, GameState } from './game/types'
import { TouchControls } from './components/TouchControls'

/** Discrete values mirrored into React for the HUD/overlays. */
interface Hud {
  score: number
  lives: number
  phase: GamePhase
}

const PHASE_LABEL: Record<GamePhase, string> = {
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  won: 'Level Complete',
  game_over: 'Game Over',
}

function toHud(state: GameState): Hud {
  return { score: state.score, lives: state.lives, phase: state.phase }
}

export function PacmanIsland() {
  const stateRef = useRef<GameState>(createInitialState(Date.now() >>> 0 || 1))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number>(0)

  const [hud, setHud] = useState<Hud>(() => toHud(stateRef.current))
  const hudRef = useRef<Hud>(hud)

  // Push HUD changes into React only when a tracked value actually changes.
  const syncHud = useCallback(() => {
    const next = toHud(stateRef.current)
    const prev = hudRef.current
    if (
      next.score !== prev.score ||
      next.lives !== prev.lives ||
      next.phase !== prev.phase
    ) {
      hudRef.current = next
      setHud(next)
    }
  }, [])

  const { width, height } = canvasSize(stateRef.current)

  // Animation loop. Set up once; cancelled on unmount.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d') ?? null

    const loop = (ts: number) => {
      const last = lastTsRef.current || ts
      const dt = ts - last
      lastTsRef.current = ts

      step(stateRef.current, dt)
      render(ctx, stateRef.current)
      syncHud()

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastTsRef.current = 0
    }
  }, [syncHud])

  const applyDirection = useCallback(
    (dir: Direction) => {
      setDirection(stateRef.current, dir)
      syncHud()
    },
    [syncHud],
  )

  const handlePause = useCallback(() => {
    togglePause(stateRef.current)
    syncHud()
  }, [syncHud])

  const handleRestart = useCallback(() => {
    stateRef.current = createInitialState(Date.now() >>> 0 || 1)
    lastTsRef.current = 0
    syncHud()
  }, [syncHud])

  // Keyboard input + scroll prevention for gameplay keys.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key in MOVEMENT_KEYS) {
        e.preventDefault()
        applyDirection(MOVEMENT_KEYS[key])
      } else if (key === PAUSE_KEY) {
        e.preventDefault()
        handlePause()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyDirection, handlePause])

  // Auto-pause when the tab is hidden so the game does not run in background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        pauseForVisibility(stateRef.current)
        syncHud()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [syncHud])

  const showOverlay = hud.phase !== 'running'

  return (
    <div className="flex flex-col items-center" style={{ touchAction: 'none' }}>
      {/* HUD — DOM-visible text so E2E can assert on it reliably. */}
      <div className="flex gap-6 mb-3 font-mono text-gray-800" data-testid="hud">
        <span data-testid="score">Score: {hud.score}</span>
        <span data-testid="lives">Lives: {hud.lives}</span>
        <span data-testid="phase">Status: {PHASE_LABEL[hud.phase]}</span>
      </div>

      <div className="relative" style={{ width, maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="bg-black rounded w-full h-auto"
          data-testid="pacman-canvas"
        />

        {showOverlay && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white rounded"
            data-testid="overlay"
            data-phase={hud.phase}
          >
            <p className="text-2xl font-bold mb-2">{PHASE_LABEL[hud.phase]}</p>
            {hud.phase === 'ready' && (
              <p className="text-sm">Press an arrow key or D-pad to start</p>
            )}
            {hud.phase === 'paused' && <p className="text-sm">Press P to resume</p>}
            {(hud.phase === 'won' || hud.phase === 'game_over') && (
              <p className="text-sm">Press Restart to play again</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleRestart}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={handlePause}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          {hud.phase === 'paused' ? 'Resume' : 'Pause'}
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500 max-w-sm text-center">
        Move with arrow keys or WASD, press P to pause. Lives start at {INITIAL_LIVES}.
        Eat all pellets to win; power pellets let you eat ghosts.
      </p>

      <TouchControls onDirection={applyDirection} onPause={handlePause} />
    </div>
  )
}
