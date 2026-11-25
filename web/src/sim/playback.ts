// Turns the engine's event trace into customer positions at any playback time t.
// The engine has already computed every event time and every walking route; the
// browser only moves customers along those routes between known times, so the
// animation is a faithful replay of the model. Joining a lane, stepping forward
// in a queue and walking out after paying are drawn only: the model treats them
// as instantaneous (assumption 9).

import type { BasketKey, Layout, Point, Trace, TraceCustomer } from '../api'
import { VISIBLE_SLOTS, exitPath, joinPath, queueSlot, servicePoint } from './floorplan'
import { clamp, pointAt, polyline, rawLength, smooth, smoothstep } from './geometry'
import type { Polyline } from './geometry'

export type Status = 'walking' | 'shopping' | 'joining' | 'waiting' | 'service' | 'leaving'

export interface Placed {
  id: number
  cat: BasketKey
  x: number
  y: number
  facing: 1 | -1
  /** Walking cycle position (one cycle per stride); legs swing as it changes. */
  phase: number
  moving: boolean
  status: Status
  alpha: number
  /** Queuing beyond the places drawn in the lane (counted in the "+N" tag). */
  hidden: boolean
  counter: number | null
  /** Section being shopped, or the destination of a walk ('checkout' for the last one). */
  where: string | null
  /** Place in the queue: 1 is next to be served. */
  slot: number | null
}

export interface Snapshot {
  placed: Placed[]
  generated: number
  served: number
  shopping: number
  waiting: number
  inService: number
  queues: number[]
  /** Waiting customers not drawn in each lane. */
  overflow: number[]
  busy: boolean[]
  servedBy: number[]
}

const STRIDE = 0.75 // metres per walking cycle
const BROWSE = 0.45 // metres a shopper drifts along the aisle while picking items
const STEP = 0.08 // minutes to step forward one place in a queue (drawing only)
const FADE_IN = 0.06 // minutes to fade in at the entrance
const JOIN_MIN = 0.05 // minutes, bounds of the drawn walk from the decision point into a lane
const JOIN_MAX = 0.35

export interface Walk {
  /** Smoothed route actually drawn. */
  pl: Polyline
  /** Corner points from the engine. */
  raw: Point[]
  t0: number | null
  t1: number | null
  /** True when t1 is an engine event time, false when extrapolated past closing. */
  known: boolean
}

export interface Stay {
  section: string
  items: number
  spot: Point
  t0: number | null
  t1: number | null
  xmin: number
  xmax: number
}

export interface Prepared {
  c: TraceCustomer
  /** One walk into each section on the route, then one to the checkout. */
  walks: Walk[]
  stays: Stay[]
  exit: Polyline | null
  exitDur: number
  joinDur: number
}

const minutesFor = (metres: number, v: number) => metres / (60 * Math.max(0.1, v))

export function prepareCustomer(c: TraceCustomer, L: Layout): Prepared {
  const walks: Walk[] = []
  const stays: Stay[] = []
  c.p.forEach((raw, i) => {
    const t0 = i === 0 ? c.a : (c.legs[i - 1]?.[2] ?? null)
    const end = i < c.legs.length ? c.legs[i][1] : c.co
    const t1 = end ?? (t0 === null ? null : t0 + minutesFor(rawLength(raw), c.v))
    walks.push({ pl: polyline(smooth(raw)), raw, t0, t1, known: end !== null })
  })
  c.legs.forEach(([section, arr, dep, items], i) => {
    const spot = c.p[i][c.p[i].length - 1]
    const r = L.sections[section]
    stays.push({ section, items, spot, t0: arr, t1: dep, xmin: r.x + 0.9, xmax: r.x + r.w - 0.9 })
  })
  let exit: Polyline | null = null
  let exitDur = 0
  let joinDur = JOIN_MIN
  if (c.c !== null && c.c < L.counters.length) {
    exit = polyline(smooth(exitPath(L, c.c), 0.7))
    exitDur = minutesFor(exit.length, c.v)
    joinDur = clamp(minutesFor(rawLength(joinPath(L, c.c, servicePoint(L, c.c))), c.v), JOIN_MIN, JOIN_MAX)
  }
  return { c, walks, stays, exit, exitDur, joinDur }
}

export function prepare(trace: Trace): Prepared[] {
  return trace.customers.map((c) => prepareCustomer(c, trace.layout))
}

const sign = (v: number, fallback: 1 | -1 = 1): 1 | -1 => (v > 1e-6 ? 1 : v < -1e-6 ? -1 : fallback)

function base(p: Prepared, status: Status, x: number, y: number): Placed {
  return {
    id: p.c.id, cat: p.c.cat, x, y, facing: 1, phase: 0, moving: false, status, alpha: 1, hidden: false,
    counter: p.c.c, where: null, slot: null,
  }
}

/** Where a customer who has not reached the checkout is at time t. */
function onTheShopFloor(p: Prepared, t: number): Placed {
  const { walks, stays } = p
  for (let i = 0; i < walks.length; i++) {
    const w = walks[i]
    if (w.t0 === null || t < w.t0) break
    if (w.t1 === null || t < w.t1) {
      const span = (w.t1 ?? w.t0) - w.t0
      const d = (span > 0 ? (t - w.t0) / span : 1) * w.pl.length
      const at = pointAt(w.pl, d)
      const out = base(p, 'walking', at.x, at.y)
      const overall = w.raw[w.raw.length - 1][0] - w.raw[0][0]
      out.facing = Math.abs(at.dx) > 0.25 ? sign(at.dx) : sign(overall)
      out.phase = d / STRIDE
      out.moving = true
      out.where = i < stays.length ? stays[i].section : 'checkout'
      return out
    }
    const s = stays[i]
    if (!s || s.t0 === null || t < s.t0) break
    if (s.t1 === null || t < s.t1) {
      // Picking items: drift back and forth along the aisle, once per item
      const span = s.t1 !== null ? s.t1 - s.t0 : Math.max(0.5, s.items * 0.6)
      const u = clamp((t - s.t0) / span, 0, 1)
      const k = Math.min(s.items, 6)
      const offset = BROWSE * Math.sin(2 * Math.PI * k * u)
      const x = clamp(s.spot[0] + offset, s.xmin, s.xmax)
      const velocity = Math.cos(2 * Math.PI * k * u)
      const out = base(p, 'shopping', x, s.spot[1])
      out.facing = sign(velocity)
      out.phase = offset / STRIDE
      out.moving = Math.abs(velocity) > 0.35
      out.where = s.section
      return out
    }
  }
  // Past the last known point (only possible for rounding at closing): stand at the end of the route
  const last = walks[walks.length - 1]
  const end = last.raw[last.raw.length - 1]
  return { ...base(p, 'walking', end[0], end[1]), where: 'checkout' }
}

const progress = (t: number, s: number) => 1 - smoothstep(0, 1, (t - s) / STEP)

export function snapshot(prepared: Prepared[], trace: Trace, t: number): Snapshot {
  const L = trace.layout
  const nCounters = trace.counters.length
  const placed: Placed[] = []
  const waitingBy: Prepared[][] = Array.from({ length: nCounters }, () => [])
  const serving: (Prepared | null)[] = Array(nCounters).fill(null)
  const starts: number[][] = Array.from({ length: nCounters }, () => [])
  const busy = Array(nCounters).fill(false) as boolean[]
  const servedBy = Array(nCounters).fill(0) as number[]
  let generated = 0
  let served = 0
  let shopping = 0
  let inService = 0

  for (const p of prepared) {
    const c = p.c
    if (c.a > t) break // customers are sorted by arrival
    generated++
    if (c.co === null || c.co > t || c.c === null) {
      shopping++
      const out = onTheShopFloor(p, t)
      if (t < c.a + FADE_IN) out.alpha = clamp((t - c.a) / FADE_IN, 0, 1)
      placed.push(out)
      continue
    }
    const k = c.c
    if (c.ss !== null && c.ss > c.co && c.ss <= t && t < c.ss + STEP) starts[k].push(c.ss)
    if (c.d !== null && c.d <= t) {
      served++
      servedBy[k]++
      if (p.exit && t < c.d + p.exitDur) {
        const d = ((t - c.d) / p.exitDur) * p.exit.length
        const at = pointAt(p.exit, d)
        const out = base(p, 'leaving', at.x, at.y)
        out.facing = Math.abs(at.dx) > 0.25 ? sign(at.dx) : 1
        out.phase = d / STRIDE
        out.moving = true
        out.alpha = 0.6 * clamp((p.exit.length - d) / 1.5, 0, 1)
        placed.push(out)
      }
      continue
    }
    if (c.ss !== null && c.ss <= t) {
      inService++
      busy[k] = true
      serving[k] = p
      continue
    }
    waitingBy[k].push(p)
  }

  // Queue places: 0 is the till, 1 is next in line. Each step forward is eased
  // over STEP minutes, and only counts for customers who were already behind.
  const place = (p: Prepared, k: number, baseSlot: number, upTo: number) => {
    let slot = baseSlot
    let gliding = false
    for (const s of starts[k]) {
      if (s > p.c.co! && s <= upTo) {
        slot += progress(t, s)
        gliding = true
      }
    }
    return { slot, gliding }
  }

  const putInLane = (p: Prepared, k: number, status: Status, slot: number, gliding: boolean, inLine: number | null) => {
    const target = queueSlot(L, k, Math.min(slot, VISIBLE_SLOTS + 1))
    const sinceJoin = t - p.c.co!
    let out: Placed
    if (sinceJoin < p.joinDur) {
      const pl = polyline(smooth(joinPath(L, k, target), 0.8))
      const f = sinceJoin / p.joinDur
      const at = pointAt(pl, f * pl.length)
      out = base(p, 'joining', at.x, at.y)
      out.facing = Math.abs(at.dx) > 0.25 ? sign(at.dx) : 1
      out.phase = (f * pl.length) / STRIDE
      out.moving = true
      if (slot >= VISIBLE_SLOTS + 1) out.alpha = 1 - smoothstep(0.75, 1, f)
    } else {
      out = base(p, status, target[0], target[1])
      out.phase = (slot * L.queue_spacing) / STRIDE
      out.moving = gliding
      out.alpha = clamp(VISIBLE_SLOTS + 1 - slot, 0, 1)
    }
    out.hidden = slot >= VISIBLE_SLOTS + 1 && sinceJoin >= p.joinDur
    out.counter = k
    out.slot = inLine
    placed.push(out)
  }

  const queues = waitingBy.map((list, k) => {
    list.sort((a, b) => a.c.co! - b.c.co! || a.c.id - b.c.id) // FIFO order
    const svc = serving[k]
    if (svc) {
      const { slot, gliding } = place(svc, k, 0, svc.c.ss!)
      putInLane(svc, k, 'service', slot, gliding, null)
    }
    list.forEach((p, idx) => {
      const { slot, gliding } = place(p, k, 1 + idx, Infinity)
      putInLane(p, k, 'waiting', slot, gliding, 1 + idx)
    })
    return list.length
  })

  placed.sort((a, b) => a.y - b.y) // nearer customers are drawn over those behind them

  return {
    placed,
    generated,
    served,
    shopping,
    waiting: queues.reduce((a, b) => a + b, 0),
    inService,
    queues,
    overflow: queues.map((q) => Math.max(0, q - VISIBLE_SLOTS)),
    busy,
    servedBy,
  }
}
