// One customer's journey, read straight from the engine's event times: the
// steps for the journey panel, what they are doing at a playback time, and what
// they saw when they chose a counter.

import type { StrategyKey, Trace, TraceCustomer } from '../api'
import { clock, fmt } from '../format'
import type { Placed } from './playback'

export type ActivityKey = 'walk' | 'shop' | 'wait' | 'service'

export interface Activity {
  kind: ActivityKey
  start: number
  end: number
  section?: string
}

export interface JourneyStep {
  key: string
  kind: 'section' | 'checkout' | 'service' | 'leave'
  title: string
  detail: string
  start: number | null
  end: number | null
  /** Stop number drawn on the floor plan (sections only). */
  stop?: number
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`
const mins = (v: number) => `${fmt(v, 2)} min`

/** Walking, shopping, waiting and service intervals up to departure (or closing). */
export function activities(c: TraceCustomer, duration: number): Activity[] {
  const out: Activity[] = []
  const add = (kind: ActivityKey, start: number | null, end: number | null, section?: string) => {
    if (start === null) return
    const e = Math.min(end ?? duration, duration)
    if (e > start) out.push({ kind, start, end: e, section })
  }
  let from: number | null = c.a
  c.legs.forEach(([section, arr, dep]) => {
    add('walk', from, arr)
    add('shop', arr, dep, section)
    from = dep
  })
  add('walk', from, c.co)
  add('wait', c.co, c.ss)
  add('service', c.ss, c.d)
  return out
}

export function journeySteps(c: TraceCustomer, labels: Record<string, string>): JourneyStep[] {
  const steps: JourneyStep[] = []
  c.legs.forEach(([section, arr, dep, n], i) => {
    steps.push({
      key: `s${i}`, kind: 'section', title: labels[section] ?? section, stop: i + 1, start: arr, end: dep,
      detail: arr === null ? `${items(n)}, not reached by closing` : dep === null ? `${items(n)}, still shopping at closing` : items(n),
    })
  })
  const counter = c.c === null ? '' : `counter ${c.c + 1}`
  steps.push({
    key: 'queue', kind: 'checkout', title: c.co === null ? 'Checkouts' : `Queued at ${counter}`, start: c.co, end: c.ss,
    detail: c.co === null ? 'Not reached by closing' : c.ss === null ? 'Still waiting at closing' : c.ss === c.co ? 'No wait' : `Waited ${mins(c.ss - c.co)}`,
  })
  steps.push({
    key: 'service', kind: 'service', title: 'Paid', start: c.ss, end: c.d,
    detail: c.ss === null ? '-' : c.d === null ? 'Still being served at closing' : `Served in ${mins(c.d - c.ss)}`,
  })
  steps.push({
    key: 'leave', kind: 'leave', title: 'Left', start: c.d, end: c.d,
    detail: c.d === null ? 'Still in the store at closing' : `${mins(c.d - c.a)} in the store`,
  })
  return steps
}

/** Customers ahead in the same queue at time t (FIFO by checkout arrival). */
export function aheadInQueue(trace: Trace, c: TraceCustomer, t: number): number {
  if (c.co === null || c.c === null) return 0
  let n = 0
  for (const o of trace.customers) {
    if (o.id === c.id || o.c !== c.c || o.co === null) continue
    const before = o.co < c.co || (o.co === c.co && o.id < c.id)
    if (before && o.co <= t && (o.ss === null || o.ss > t)) n++
  }
  return n
}

/** What the customer is doing at time t, in a sentence. */
export function statusAt(trace: Trace, c: TraceCustomer, t: number, labels: Record<string, string>): string {
  const name = (s: string) => labels[s] ?? s
  const end = trace.duration
  if (t < c.a) return `Arrives at ${clock(c.a)}`
  if (c.d !== null && t >= c.d) return `Left at ${clock(c.d)} after ${mins(c.d - c.a)} in the store`
  const closing = t >= end ? ' at closing' : ''
  if (c.ss !== null && t >= c.ss) {
    return `Being served at counter ${c.c! + 1}${closing}, for ${mins(t - c.ss)} so far`
  }
  if (c.co !== null && t >= c.co) {
    const ahead = aheadInQueue(trace, c, t)
    return `Waiting at counter ${c.c! + 1}${closing}, ${ordinal(ahead + 1)} in line, for ${mins(t - c.co)} so far`
  }
  for (const [section, arr, dep] of c.legs) {
    if (arr === null || t < arr) return `Walking to ${name(section)}${closing}`
    if (dep === null || t < dep) return `Shopping in ${name(section)}${closing}`
  }
  return `Walking to the checkouts${closing}`
}

/** Short status for the hover card, from the drawn position. */
export function describePlaced(p: Placed, labels: Record<string, string>): string {
  const name = (s: string | null) => (s === null ? '' : s === 'checkout' ? 'the checkouts' : (labels[s] ?? s))
  switch (p.status) {
    case 'walking': return `Walking to ${name(p.where)}`
    case 'shopping': return `Shopping in ${name(p.where)}`
    case 'joining': return `Joining counter ${(p.counter ?? 0) + 1}`
    case 'waiting': return `Waiting at counter ${(p.counter ?? 0) + 1}, ${ordinal(p.slot ?? 1)} in line`
    case 'service': return `Being served at counter ${(p.counter ?? 0) + 1}`
    case 'leaving': return 'Paid and leaving'
  }
}

export interface DecisionRow {
  counter: number
  type: 'normal' | 'express'
  people: number
  estimate: number
  eligible: boolean
  chosen: boolean
}

export interface Decision {
  rows: DecisionRow[]
  rule: string
  reason: string
}

const rule = (strategy: StrategyKey, limit: number): string => ({
  shortest_queue: 'Shortest Queue: join the counter with the fewest people, counting the person being served. Ties go to the lowest counter number.',
  shortest_wait: 'Shortest Estimated Waiting Time: join the counter with the smallest estimated wait. Customers estimate it from the basket sizes they can see, because true service times are hidden.',
  express: `Express and Normal: baskets of ${limit} items or fewer use express counters, all others use normal counters. Within the group, join the counter with the fewest people.`,
}[strategy])

const tieNote = (others: number) =>
  others === 0 ? '' : `, tied with ${others === 1 ? 'another counter' : `${others} other counters`}, so the lowest number won`

/** The counters as the customer saw them when choosing, and why the chosen one won. */
export function decision(trace: Trace, c: TraceCustomer): Decision | null {
  if (c.seen === null || c.c === null) return null
  const strategy = trace.strategy
  const hasExpress = trace.counters.some((k) => k.type === 'express')
  const wantExpress = c.items <= trace.express_limit
  const rows: DecisionRow[] = c.seen.map(([people, estimate], i) => {
    const type = trace.counters[i]?.type ?? 'normal'
    const eligible = strategy !== 'express' || !hasExpress || (type === 'express') === wantExpress
    return { counter: i + 1, type, people, estimate, eligible, chosen: i === c.c }
  })
  const chosen = rows[c.c]
  let reason: string
  if (strategy === 'shortest_wait') {
    const others = rows.filter((r) => !r.chosen && Math.abs(r.estimate - chosen.estimate) < 1e-6).length
    reason = `Counter ${chosen.counter} had the smallest estimated wait, ${mins(chosen.estimate)}${tieNote(others)}.`
  } else {
    const others = rows.filter((r) => r.eligible && !r.chosen && r.people === chosen.people).length
    const group = strategy === 'express' && hasExpress
      ? `With ${items(c.items)}, only ${wantExpress ? 'express' : 'normal'} counters were allowed. `
      : ''
    const who = chosen.people === 0 ? 'nobody' : chosen.people === 1 ? '1 person' : `${chosen.people} people`
    reason = `${group}Counter ${chosen.counter} had ${who}, the fewest${tieNote(others)}.`
  }
  const waited = c.ss !== null && c.co !== null ? c.ss - c.co : null
  if (waited !== null && waited === 0 && chosen.people === 0) {
    reason += ' Service started at once.'
  } else if (waited !== null) {
    reason += strategy === 'shortest_wait'
      ? ` The actual wait was ${mins(waited)}.`
      : ` Its estimated wait was ${mins(chosen.estimate)}; the actual wait was ${mins(waited)}.`
  }
  return { rows, rule: rule(strategy, trace.express_limit), reason }
}
