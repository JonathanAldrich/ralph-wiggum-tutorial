/**
 * SnakeIsland component tests.
 *
 * Verifies rendering from server data, the board/score/controls, the
 * game-over flow (driven deterministically with fake timers by letting the
 * snake run straight into the wall), and leaderboard refresh after a mocked
 * successful score submission.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { SnakeIsland } from '@/islands/snake/SnakeIsland'
import type { SnakeScore } from '@/types'

const SAMPLE: SnakeScore[] = [
  { id: 1, player_name: 'TOP', score: 99, created_at: '2026-01-01T00:00:00' },
  { id: 2, player_name: 'MID', score: 50, created_at: '2026-01-02T00:00:00' },
]

describe('SnakeIsland', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the leaderboard from server-provided data', () => {
    render(<SnakeIsland initialData={SAMPLE} />)
    expect(screen.getByText('TOP')).toBeInTheDocument()
    expect(screen.getByText('MID')).toBeInTheDocument()
  })

  it('renders an empty leaderboard state', () => {
    render(<SnakeIsland initialData={[]} />)
    expect(screen.getByText(/no scores yet/i)).toBeInTheDocument()
  })

  it('renders the board, score, and a start control (no auto-start)', () => {
    render(<SnakeIsland initialData={[]} />)
    expect(screen.getByTestId('snake-board')).toBeInTheDocument()
    expect(screen.getByText(/score:\s*0/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
    // Game must not be running until the player starts it.
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
  })

  it('starts the game when Start is clicked', () => {
    vi.useFakeTimers()
    render(<SnakeIsland initialData={[]} />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /start/i }))
    })
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('reaches game over and shows the score form (deterministic wall crash)', () => {
    vi.useFakeTimers()
    render(<SnakeIsland initialData={[]} />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /start/i }))
    })
    // Snake runs straight right into the wall; 30 ticks guarantees a crash.
    act(() => {
      vi.advanceTimersByTime(120 * 30)
    })
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your initials/i)).toBeInTheDocument()
  })

  it('refreshes the leaderboard after a successful score submission', async () => {
    vi.useFakeTimers()
    const { rerender } = render(<SnakeIsland initialData={[]} />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /start/i }))
    })
    act(() => {
      vi.advanceTimersByTime(120 * 30)
    })
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    // Switch to real timers for the async fetch flow (loop is stopped now).
    vi.useRealTimers()

    const created: SnakeScore = {
      id: 10,
      player_name: 'ZED',
      score: 0,
      created_at: '2026-07-09T00:00:00',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => created }) // POST
      .mockResolvedValueOnce({ ok: true, json: async () => [created] }) // GET refresh
    vi.stubGlobal('fetch', fetchMock)

    fireEvent.change(screen.getByPlaceholderText(/enter your initials/i), {
      target: { value: 'ZED' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save score/i }))

    await waitFor(() => expect(screen.getByText(/score saved/i)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/snake/scores',
      expect.objectContaining({ method: 'POST' }),
    )
    await waitFor(() => expect(screen.getByText('ZED')).toBeInTheDocument())

    rerender(<SnakeIsland initialData={[]} />)
  })
})

describe('SnakeIsland keyboard', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts the game when Space is pressed', () => {
    render(<SnakeIsland initialData={[]} />)
    act(() => {
      fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    })
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })
})
