/**
 * SnakeIsland — the interactive Snake game.
 *
 * Responsibilities kept in this component: rendering the board/score/
 * leaderboard, running the fixed-timestep game loop, listening for keyboard
 * input, and submitting completed runs. All game *rules* live in the pure
 * `game.ts` helpers so they can be tested without React timers.
 *
 * Why the refs? React's `setInterval` callback closes over state at creation
 * time, causing stale-closure bugs. We drive the loop with a `useInterval`
 * hook (callback stored in a ref) and buffer keyboard input in a ref so a key
 * pressed mid-tick is applied on the next tick without stale reads.
 */
import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react'
import type { SnakeScore, ScoreCreate } from '@/types'
import {
  BOARD_SIZE,
  MAX_SCORE,
  createInitialState,
  nextDirection,
  step,
  pointsEqual,
  type Direction,
  type GameState,
} from './game'

const TICK_MS = 120
const MAX_NAME_LENGTH = 20

type Status = 'idle' | 'playing' | 'paused' | 'over'

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/** Run `callback` every `delay` ms; pass `null` to pause. Avoids stale closures. */
function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])
  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

interface SnakeIslandProps {
  initialData?: SnakeScore[]
}

export function SnakeIsland({ initialData = [] }: SnakeIslandProps) {
  const [game, setGame] = useState<GameState>(createInitialState)
  const [status, setStatus] = useState<Status>('idle')
  const [leaderboard, setLeaderboard] = useState<SnakeScore[]>(initialData)

  const [playerName, setPlayerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Buffers the latest requested direction; applied (with reversal guard) on
  // the next tick. Mirrors the committed direction so it survives restarts.
  const requestedDirection = useRef<Direction>(game.direction)

  const tick = useCallback(() => {
    setGame((prev) => {
      const direction = nextDirection(prev.direction, requestedDirection.current)
      return step({ ...prev, direction })
    })
  }, [])

  useInterval(tick, status === 'playing' ? TICK_MS : null)

  // Transition to the game-over screen when the loop reports a crash.
  useEffect(() => {
    if (game.gameOver) setStatus('over')
  }, [game.gameOver])

  const startGame = useCallback(() => {
    const fresh = createInitialState()
    requestedDirection.current = fresh.direction
    setGame(fresh)
    setPlayerName('')
    setSubmitted(false)
    setSubmitting(false)
    setSubmitError(null)
    setStatus('playing')
  }, [])

  const togglePause = useCallback(() => {
    setStatus((s) => (s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s))
  }, [])

  // Keyboard: arrows steer (and preventDefault to stop the page scrolling),
  // Space starts/pauses/resumes. Listener is cleaned up on unmount so repeated
  // mounts never stack controls.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const direction = KEY_TO_DIRECTION[e.key]
      if (direction) {
        e.preventDefault()
        requestedDirection.current = direction
        return
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setStatus((s) => {
          if (s === 'idle' || s === 'over') {
            startGame()
            return 'playing'
          }
          return s === 'playing' ? 'paused' : 'playing'
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [startGame])

  const refreshLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/snake/scores')
      if (!res.ok) throw new Error('Failed to load leaderboard')
      setLeaderboard(await res.json())
    } catch (err) {
      console.error('Failed to refresh leaderboard:', err)
    }
  }, [])

  async function handleSubmitScore(e: FormEvent) {
    e.preventDefault()
    if (submitting || submitted) return
    const name = playerName.trim()
    if (!name) {
      setSubmitError('Please enter your initials or name.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: ScoreCreate = { player_name: name, score: game.score }
      const res = await fetch('/api/snake/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save score')
      }
      setSubmitted(true)
      await refreshLeaderboard()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save score')
    } finally {
      setSubmitting(false)
    }
  }

  const occupied = new Map<string, 'head' | 'body' | 'food'>()
  game.snake.forEach((segment, i) => {
    occupied.set(`${segment.x},${segment.y}`, i === 0 ? 'head' : 'body')
  })
  if (!pointsEqual(game.food, { x: -1, y: -1 })) {
    occupied.set(`${game.food.x},${game.food.y}`, 'food')
  }

  const cells = []
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const kind = occupied.get(`${x},${y}`)
      const color =
        kind === 'head'
          ? 'bg-green-700'
          : kind === 'body'
            ? 'bg-green-500'
            : kind === 'food'
              ? 'bg-red-500'
              : 'bg-gray-100'
      cells.push(<div key={`${x},${y}`} className={`w-full h-full ${color}`} />)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Board + score + controls */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-semibold text-gray-800" aria-live="polite">
            Score: {game.score}
          </p>
          <div className="flex gap-2">
            {status === 'idle' || status === 'over' ? (
              <button
                type="button"
                onClick={startGame}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {status === 'over' ? 'Play Again' : 'Start'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={togglePause}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  {status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={startGame}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Restart
                </button>
              </>
            )}
          </div>
        </div>

        <div
          data-testid="snake-board"
          className="grid gap-px bg-gray-300 border border-gray-300 rounded"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
            width: 'min(90vw, 400px)',
            height: 'min(90vw, 400px)',
          }}
        >
          {cells}
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Arrow keys to steer · Space to {status === 'playing' ? 'pause' : 'start'}
        </p>

        {status === 'over' && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg" data-testid="game-over">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Game Over</h3>
            <p className="text-gray-700 mb-3">
              Final score: <span className="font-semibold">{game.score}</span>
            </p>
            {submitted ? (
              <p className="text-green-700 font-medium">Score saved! 🎉</p>
            ) : (
              <form onSubmit={handleSubmitScore} className="flex flex-col gap-2">
                <label htmlFor="player-name" className="text-sm text-gray-600">
                  Enter your initials to save your score:
                </label>
                <div className="flex gap-2">
                  <input
                    id="player-name"
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your initials"
                    maxLength={MAX_NAME_LENGTH}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={submitting}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !playerName.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Saving...' : 'Save Score'}
                  </button>
                </div>
                {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              </form>
            )}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="flex-1">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-gray-500 italic">No scores yet. Be the first!</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((entry, i) => (
              <li
                key={entry.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-gray-800">
                  <span className="text-gray-400 mr-2">#{i + 1}</span>
                  {entry.player_name}
                </span>
                <span className="font-semibold text-gray-700">{entry.score}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-gray-400">Top scores capped at {MAX_SCORE}.</p>
      </div>
    </div>
  )
}
