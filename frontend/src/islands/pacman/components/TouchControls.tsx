/**
 * On-screen D-pad for touch / mobile play.
 *
 * Buttons fire `onDirection` for movement and `onPause` for pause/resume.
 * `touch-action: none` and pointer-event handling prevent the page from
 * scrolling or zooming while the player taps controls. Buttons respond to
 * pointer events so they work for touch, pen and mouse uniformly.
 */
import type { PointerEvent } from 'react'
import type { Direction } from '../game/types'

interface TouchControlsProps {
  onDirection: (dir: Direction) => void
  onPause: () => void
}

const noScroll = { touchAction: 'none' as const }

export function TouchControls({ onDirection, onPause }: TouchControlsProps) {
  function press(dir: Direction) {
    return (e: PointerEvent) => {
      e.preventDefault()
      onDirection(dir)
    }
  }

  const btn =
    'flex items-center justify-center w-14 h-14 rounded-lg bg-gray-800 text-white ' +
    'text-2xl select-none active:bg-gray-600'

  return (
    <div className="mt-4 flex flex-col items-center gap-2" style={noScroll}>
      <div className="grid grid-cols-3 gap-2" style={noScroll}>
        <span />
        <button
          type="button"
          aria-label="Move up"
          className={btn}
          onPointerDown={press('up')}
        >
          ▲
        </button>
        <span />
        <button
          type="button"
          aria-label="Move left"
          className={btn}
          onPointerDown={press('left')}
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Toggle pause"
          className={btn}
          onPointerDown={(e) => {
            e.preventDefault()
            onPause()
          }}
        >
          ⏯
        </button>
        <button
          type="button"
          aria-label="Move right"
          className={btn}
          onPointerDown={press('right')}
        >
          ▶
        </button>
        <span />
        <button
          type="button"
          aria-label="Move down"
          className={btn}
          onPointerDown={press('down')}
        >
          ▼
        </button>
        <span />
      </div>
    </div>
  )
}
