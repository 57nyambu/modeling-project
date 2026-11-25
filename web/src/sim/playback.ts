// Turns the engine's event trace into customer positions at any playback time t.
// The engine has already computed every event time; the browser only interpolates
// walking between known points, so the animation is a faithful replay of the model.

import type { Layout, Point, Trace, TraceCustomer } from '../api'

export type Status = 'walking' | 'shopping' | 'waiting' | 'service' | 'leaving'

export interface Placed {
  id: number
  cat: TraceCustomer['cat']
  x: number
  y: number
  status: Status
}

export interface Snapshot {
  placed: Placed[]
  generated: number
  served: number
  shopping: number
  waiting: number
  inService: number
  queues: number[]
  busy: boolean[]
}

const EXIT_WALK = 0.6 // minutes, drawing only (see assumption 9)
const UNKNOWN_WALK = 0.5 // used only when a walk is cut off by the end of the run
const SERVICE_OFFSET = 1.0 // metres above the counter where the customer being served stands
const QUEUE_ROOM = 6.2 // metres available for a visible queue

interface Prepared {
  c: TraceCustomer
  points: Point[] // one jittered point inside each section on the route
}

// Deterministic pseudo-random number in [0,1) from an integer, so jitter is stable.
function hash01(n: number): number {
  let x = (n * 2654435761) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 2246822507) >>> 0
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

export function prepare(trace: Trace): Prepared[] {
  const { sections } = trace.layout
  return trace.customers.map((c) => ({
    c,
    points: c.legs.map(([name], i) => {
      const r = sections[name]
      const m = 0.9
      return [
        r.x + m + hash01(c.id * 7 + i) * (r.w - 2 * m),
        r.y + m + 1.2 + hash01(c.id * 13 + i + 5) * (r.h - 2 * m - 1.2),
      ] as Point
    }),
  }))
}

const lerp = (p: Point, q: Point, f: number): [number, number] => {
  const k = Math.max(0, Math.min(1, f))
  return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]
}

export function servicePoint(layout: Layout, counter: number): Point {
  const [x, y] = layout.counters[counter]
  return [x, y - SERVICE_OFFSET]
}

function shoppingPosition(p: Prepared, t: number, layout: Layout): { pos: [number, number]; status: Status } {
  const { c, points } = p
  // Entrance -> first section
  const firstArr = c.legs[0][1]
  if (firstArr === null || t < firstArr) {
    const span = firstArr === null ? UNKNOWN_WALK : firstArr - c.a
    return { pos: lerp(layout.entrance, points[0], span > 0 ? (t - c.a) / span : 1), status: 'walking' }
  }
  for (let i = 0; i < c.legs.length; i++) {
    const [, arr, dep] = c.legs[i]
    if (arr === null) break
    if (dep === null || t < dep) return { pos: [points[i][0], points[i][1]], status: 'shopping' }
    const next = c.legs[i + 1]
    const target: Point = next ? points[i + 1] : layout.checkout_point
    const nextArr = next ? next[1] : c.co
    if (nextArr === null || t < nextArr) {
      const span = nextArr === null ? UNKNOWN_WALK : nextArr - dep
      return { pos: lerp(points[i], target, span > 0 ? (t - dep) / span : 1), status: 'walking' }
    }
  }
  return { pos: [layout.checkout_point[0], layout.checkout_point[1]], status: 'walking' }
}

export function snapshot(prepared: Prepared[], trace: Trace, t: number): Snapshot {
  const layout = trace.layout
  const nCounters = trace.counters.length
  const placed: Placed[] = []
  const waitingBy: Prepared[][] = Array.from({ length: nCounters }, () => [])
  const busy = Array(nCounters).fill(false) as boolean[]
  let generated = 0
  let served = 0
  let shopping = 0
  let inService = 0

  for (const p of prepared) {
    const c = p.c
    if (c.a > t) break // customers are sorted by arrival
    generated++
    if (c.d !== null && c.d <= t) {
      served++
      if (t < c.d + EXIT_WALK && c.c !== null) {
        const [x, y] = lerp(servicePoint(layout, c.c), layout.exit, (t - c.d) / EXIT_WALK)
        placed.push({ id: c.id, cat: c.cat, x, y, status: 'leaving' })
      }
      continue
    }
    if (c.ss !== null && c.ss <= t && c.c !== null) {
      inService++
      busy[c.c] = true
      const [x, y] = servicePoint(layout, c.c)
      placed.push({ id: c.id, cat: c.cat, x, y, status: 'service' })
      continue
    }
    if (c.co !== null && c.co <= t && c.c !== null) {
      waitingBy[c.c].push(p)
      continue
    }
    shopping++
    const { pos, status } = shoppingPosition(p, t, layout)
    placed.push({ id: c.id, cat: c.cat, x: pos[0], y: pos[1], status })
  }

  const queues = waitingBy.map((list, ci) => {
    list.sort((a, b) => (a.c.co! - b.c.co!) || a.c.id - b.c.id) // FIFO order
    const [sx, sy] = servicePoint(layout, ci)
    const spacing = Math.min(layout.queue_spacing, QUEUE_ROOM / Math.max(1, list.length))
    list.forEach((p, k) => {
      placed.push({ id: p.c.id, cat: p.c.cat, x: sx, y: sy - (k + 1) * spacing, status: 'waiting' })
    })
    return list.length
  })

  return {
    placed,
    generated,
    served,
    shopping,
    waiting: queues.reduce((a, b) => a + b, 0),
    inService,
    queues,
    busy,
  }
}
