// Floor-plan furniture and drawing-only walkways, in metres. Shelving, aisles
// and cross-aisles come from the engine's layout, so the animation draws the
// same store the model routes customers through.

import type { Layout, Point } from '../api'

export interface Rect { x: number; y: number; w: number; h: number }

/** Door openings in the front wall (centre x, width) for entrance and exit. */
export const DOOR_WIDTH = 3.2

export const SERVICE_OFFSET = 1.0 // metres in front of the counter where the served customer stands
export const LANE_LENGTH = 6.9 // queue lane from the service point back to the lane opening
export const VISIBLE_SLOTS = 6 // queue places drawn in a lane; the rest are counted in a "+N" tag
export const DESK = { dx: 0.7, w: 1.05, top: 18.2 } // checkout desk to the right of each lane
const LANE_APPROACH = 0.2 // metres above the lane opening where customers line up to enter

export function shelves(L: Layout, name: string): Rect[] {
  return L.shelves[name] ?? []
}

export function servicePoint(L: Layout, counter: number): Point {
  const [x, y] = L.counters[counter]
  return [x, y - SERVICE_OFFSET]
}

export function laneTop(L: Layout, counter: number): number {
  return servicePoint(L, counter)[1] - LANE_LENGTH
}

/** Position of queue place k at a counter: 0 is the till, 1 is next in line. */
export function queueSlot(L: Layout, counter: number, k: number): Point {
  const [x, y] = servicePoint(L, counter)
  return [x, y - k * L.queue_spacing]
}

/** Drawing only: from the decision point into a lane (the model joins instantly). */
export function joinPath(L: Layout, counter: number, target: Point): Point[] {
  const [cx] = L.counters[counter]
  const top = laneTop(L, counter) - LANE_APPROACH
  return [L.checkout_point, [cx, top], target]
}

/** Drawing only: from the till, behind the counters and out of the exit door. */
export function exitPath(L: Layout, counter: number): Point[] {
  const start = servicePoint(L, counter)
  return [start, [start[0], L.exit_walk_y], [L.exit[0], L.exit_walk_y], [L.exit[0], L.height + 1.2]]
}
