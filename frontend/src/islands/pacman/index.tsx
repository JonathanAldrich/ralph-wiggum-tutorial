/**
 * Pac-Man island mount entry.
 *
 * Dynamically imported by main.ts when a [data-island="pacman"] element is
 * found. Clears the server-rendered loading placeholder and renders the game.
 * The game owns all its state on the client, so no server props are needed.
 */
import { createRoot } from 'react-dom/client'
import { PacmanIsland } from './PacmanIsland'

export function mount(element: HTMLElement): void {
  element.innerHTML = ''
  const root = createRoot(element)
  root.render(<PacmanIsland />)
}
