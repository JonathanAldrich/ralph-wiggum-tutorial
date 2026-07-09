/**
 * Tunable game constants for Frogger.
 *
 * All speeds are expressed in **pixels per second** and updates take a
 * delta-time (seconds) so motion is frame-rate independent.
 *
 * Layout — 13 lanes × 50 px each = 650 px tall:
 *   Row  0        : home strip (5 lily-pad openings in a hedge)
 *   Rows 1–5  : river  (logs moving left/right; frog must ride them)
 *   Row  6        : safe median (grass)
 *   Rows 7–11 : road   (vehicles; touch one = instant death)
 *   Row  12       : start zone (safe grass + HUD)
 */

/** Fixed canvas size. 13 rows × 50 px = 650 px. */
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 650

/** Height (px) of every lane row; also the distance of one frog hop. */
export const LANE_HEIGHT = 50

/** Frog sprite bounding box — smaller than a lane for visual margin. */
export const FROG_WIDTH = 32
export const FROG_HEIGHT = 32

// ─── Row assignments ─────────────────────────────────────────────────────────
export const HOME_ROW = 0
export const RIVER_ROWS = [1, 2, 3, 4, 5] as const
export const MEDIAN_ROW = 6
export const ROAD_ROWS = [7, 8, 9, 10, 11] as const
export const START_ROW = 12

// ─── Home pads ────────────────────────────────────────────────────────────────
/** X-centres of the 5 lily-pad home slots (evenly spaced across 800 px). */
export const HOME_CENTERS: readonly number[] = [80, 240, 400, 560, 720]
/** Graphical width of each home pad. */
export const HOME_PAD_WIDTH = 48
/** How close (px) the frog's centre must be to capture a home. */
export const HOME_CAPTURE_RADIUS = 22

// ─── Frog start ───────────────────────────────────────────────────────────────
export const FROG_START_ROW = START_ROW
/** Pixel x of the frog at the start of each life. */
export const FROG_START_X = Math.round((CANVAS_WIDTH - FROG_WIDTH) / 2)

/** Minimum seconds between hops (prevents blurring through rows on fast input). */
export const MOVE_COOLDOWN = 0.12

export const INITIAL_LIVES = 3
/** Seconds to complete a crossing before losing a life. */
export const ROUND_TIME = 30

/** Score for each row advanced towards the homes. */
export const SCORE_STEP_FORWARD = 10
/** Bonus score for reaching a home pad. */
export const SCORE_HOME = 200

/** Colors. */
export const COLORS = {
  river:          '#1e40af',
  riverShimmer:   '#2563eb',
  road:           '#374151',
  roadLine:       '#fbbf24',
  grass:          '#166534',
  homeStrip:      '#14532d',
  homePad:        '#15803d',
  homeOccupied:   '#22c55e',
  frog:           '#4ade80',
  frogDark:       '#16a34a',
  frogEye:        '#f0fdf4',
  log:            '#92400e',
  logRing:        '#78350f',
  vehicle:        '#ef4444',
  vehicleAlt:     '#f97316',
  vehicleGlass:   '#bfdbfe',
  text:           '#f9fafb',
  accent:         '#4ade80',
  danger:         '#ef4444',
  timerGood:      '#4ade80',
  timerWarn:      '#fb923c',
  timerDanger:    '#ef4444',
} as const

export const FONT_FAMILY = '"Courier New", Courier, monospace'
