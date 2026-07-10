/**
 * Snake Island mount logic.
 *
 * Dynamically imported by main.ts when a [data-island="snake"] element is
 * found. Parses the initial leaderboard props (an array of SnakeScore) and
 * renders the SnakeIsland into the mount element.
 */
import { createRoot } from 'react-dom/client'
import { SnakeIsland } from './SnakeIsland'
import type { SnakeScore } from '@/types'

/**
 * Mount the SnakeIsland component into the given element.
 *
 * @param element - DOM element to render into
 * @param props - Initial leaderboard data from the server (SnakeScore[])
 */
export function mount(element: HTMLElement, props: unknown): void {
  element.innerHTML = ''

  const initialData = Array.isArray(props) ? (props as SnakeScore[]) : []

  const root = createRoot(element)
  root.render(<SnakeIsland initialData={initialData} />)
}
