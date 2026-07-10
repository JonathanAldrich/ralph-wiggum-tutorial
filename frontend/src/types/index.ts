/**
 * Shared TypeScript types for the application.
 *
 * These types are used across islands, components, and API interactions.
 */

/**
 * A leaderboard entry returned by the Snake API.
 */
export interface SnakeScore {
  id: number
  player_name: string
  score: number
  created_at: string
}

/**
 * Request payload for submitting a completed Snake run.
 */
export interface ScoreCreate {
  player_name: string
  score: number
}

/**
 * Generic API error response.
 */
export interface ApiError {
  error: string
  message?: string
  details?: Record<string, unknown>[]
}

/**
 * Props passed to islands via data-props attribute.
 * Each island receives its initial data from the server.
 */
export type IslandProps<T = unknown> = {
  initialData?: T
}
