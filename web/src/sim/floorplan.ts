// Floor-plan furniture derived from the engine's layout (metres). Shared by the
// animation and the layout diagram so both draw the same store.

export interface Rect { x: number; y: number; w: number; h: number }

export const HEADER_DEPTH = 1.2 // department sign strip at the top of each section
const GONDOLA_DEPTH = 0.7
const SIDE_MARGIN = 0.8

/** Two shelving runs (gondolas) per section, leaving three aisles. */
export function gondolas(r: Rect): Rect[] {
  const usable = r.h - HEADER_DEPTH
  const top = r.y + HEADER_DEPTH
  const gap = (usable - 2 * GONDOLA_DEPTH) / 3
  return [0, 1].map((i) => ({
    x: r.x + SIDE_MARGIN,
    y: top + gap * (i + 1) + GONDOLA_DEPTH * i,
    w: r.w - 2 * SIDE_MARGIN,
    h: GONDOLA_DEPTH,
  }))
}

/** Centre lines of the three aisles, where shopping customers stand. */
export function aisles(r: Rect): number[] {
  const usable = r.h - HEADER_DEPTH
  const top = r.y + HEADER_DEPTH
  const gap = (usable - 2 * GONDOLA_DEPTH) / 3
  return [0, 1, 2].map((i) => top + gap * i + GONDOLA_DEPTH * i + gap / 2)
}

export const AISLE_MARGIN = SIDE_MARGIN + 0.3

/** Door openings in the front wall (centre x, width) for entrance and exit. */
export const DOOR_WIDTH = 3.2

export const SERVICE_OFFSET = 1.0 // metres in front of the counter where the served customer stands
export const QUEUE_ROOM = 6.2 // metres of lane available for a visible queue
export const DESK = { dx: 0.7, w: 1.05, top: 18.2 } // checkout desk to the right of each lane
