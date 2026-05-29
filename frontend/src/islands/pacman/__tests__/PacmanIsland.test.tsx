/**
 * PacmanIsland component tests.
 *
 * These verify the React shell wires the engine to the DOM correctly: HUD
 * renders from initial state, overlays reflect the phase, keyboard and touch
 * input start/drive the game, and Restart resets the HUD. We assert on
 * DOM-visible HUD/overlay text rather than canvas pixels (jsdom has no canvas
 * 2D context), mirroring the E2E strategy. We use vitest core matchers only,
 * keeping these src-tree tests free of jest-dom type augmentation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PacmanIsland } from '@/islands/pacman/PacmanIsland'
import { INITIAL_LIVES } from '@/islands/pacman/game/config'

// jsdom lacks a real animation clock; make rAF a no-op so loops don't run.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PacmanIsland', () => {
  it('renders the HUD from initial state', () => {
    render(<PacmanIsland />)
    expect(screen.getByTestId('score').textContent).toContain('Score: 0')
    expect(screen.getByTestId('lives').textContent).toContain(`Lives: ${INITIAL_LIVES}`)
    expect(screen.getByTestId('phase').textContent).toContain('Ready')
  })

  it('shows the ready overlay initially', () => {
    render(<PacmanIsland />)
    const overlay = screen.getByTestId('overlay')
    expect(overlay.getAttribute('data-phase')).toBe('ready')
  })

  it('renders the canvas board', () => {
    render(<PacmanIsland />)
    expect(screen.getByTestId('pacman-canvas')).toBeTruthy()
  })

  it('renders the touch D-pad with directional + pause controls', () => {
    render(<PacmanIsland />)
    expect(screen.getByLabelText('Move up')).toBeTruthy()
    expect(screen.getByLabelText('Move down')).toBeTruthy()
    expect(screen.getByLabelText('Move left')).toBeTruthy()
    expect(screen.getByLabelText('Move right')).toBeTruthy()
    expect(screen.getByLabelText('Toggle pause')).toBeTruthy()
  })

  it('starts the game on a keyboard direction press (ready overlay disappears)', () => {
    render(<PacmanIsland />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('phase').textContent).toContain('Running')
    expect(screen.queryByTestId('overlay')).toBeNull()
  })

  it('starts the game on a touch D-pad press', () => {
    render(<PacmanIsland />)
    fireEvent.pointerDown(screen.getByLabelText('Move left'))
    expect(screen.getByTestId('phase').textContent).toContain('Running')
  })

  it('pauses and resumes via the Pause button', () => {
    render(<PacmanIsland />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    const pauseBtn = screen.getByRole('button', { name: 'Pause' })
    fireEvent.click(pauseBtn)
    expect(screen.getByTestId('phase').textContent).toContain('Paused')
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(screen.getByTestId('phase').textContent).toContain('Running')
  })

  it('restart resets the HUD to its initial state', () => {
    render(<PacmanIsland />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('phase').textContent).toContain('Running')

    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByTestId('phase').textContent).toContain('Ready')
    expect(screen.getByTestId('score').textContent).toContain('Score: 0')
    expect(screen.getByTestId('lives').textContent).toContain(`Lives: ${INITIAL_LIVES}`)
    expect(screen.getByTestId('overlay').getAttribute('data-phase')).toBe('ready')
  })

  it('removes the keyboard listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<PacmanIsland />)
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    removeSpy.mockRestore()
  })
})
