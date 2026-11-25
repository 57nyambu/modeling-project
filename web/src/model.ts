// Client-side mirror of the model's formulas (docs/03-mathematical-model.md).
// Used for input checks, the load check in the parameter panel and the
// distribution diagrams. The server validates again before running.

import type { Meta, Params, StrategyKey } from './api'

export const SECTION_KEYS = ['grocery', 'beverages', 'household', 'personal_care'] as const

export function num(params: Params, key: string): number {
  const v = params[key]
  return typeof v === 'number' ? v : Number.NaN
}

export function weights(params: Params): Record<string, number> {
  const w = params.section_weights
  return (typeof w === 'object' && w !== null ? w : {}) as Record<string, number>
}

/** Field-level problems, keyed by parameter (plus "baskets", "payment", "walk", "sections"). */
export function validateParams(params: Params, meta: Meta): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const spec of meta.parameters) {
    const v = params[spec.key]
    if (v === '' || v === undefined || v === null) {
      errors[spec.key] = 'Enter a value'
      continue
    }
    if (typeof v !== 'number' || Number.isNaN(v)) {
      errors[spec.key] = 'Enter a number'
      continue
    }
    if (v < spec.min || v > spec.max) errors[spec.key] = `Use a value from ${spec.min} to ${spec.max}`
    else if (spec.step >= 1 && !Number.isInteger(v)) errors[spec.key] = 'Use a whole number'
  }
  const counters = num(params, 'num_counters')
  if (!errors.num_express && num(params, 'num_express') > counters) {
    errors.num_express = `Cannot exceed the ${counters} counters`
  }
  const shares = num(params, 'p_small') + num(params, 'p_medium') + num(params, 'p_large')
  if (Number.isFinite(shares) && Math.abs(shares - 1) > 1e-6) {
    errors.baskets = `Basket shares must add up to 1 (now ${shares.toFixed(2)})`
  }
  const a = num(params, 'payment_min')
  const c = num(params, 'payment_mode')
  const b = num(params, 'payment_max')
  if ([a, b, c].every(Number.isFinite) && !(a <= c && c <= b && a < b)) {
    errors.payment = 'Payment times must satisfy minimum <= most likely <= maximum'
  }
  if (num(params, 'walk_speed_min') > num(params, 'walk_speed_max')) {
    errors.walk = 'Slowest speed must not exceed the fastest'
  }
  const w = weights(params)
  const ws = SECTION_KEYS.map((k) => w[k])
  if (ws.some((x) => typeof x !== 'number' || Number.isNaN(x) || x < 0)) errors.sections = 'Shares must be 0 or more'
  else if (ws.reduce((s, x) => s + x, 0) <= 0) errors.sections = 'At least one section needs a share above 0'
  return errors
}

export const paymentMean = (p: Params) => (num(p, 'payment_min') + num(p, 'payment_mode') + num(p, 'payment_max')) / 3

/** E[n]: expected items per basket. */
export function meanItems(p: Params) {
  const L = num(p, 'large_max_items')
  return num(p, 'p_small') * 3 + num(p, 'p_medium') * 10.5 + num(p, 'p_large') * ((16 + L) / 2)
}

/** E[S | n] = n s + (a + b + c) / 3 */
export const expectedService = (p: Params, items: number) => items * num(p, 'scan_time_per_item') + paymentMean(p)

export interface LoadCheck {
  expectedCustomers: number
  meanItems: number
  meanService: number
  load: number          // offered load per counter, average over the run
  peakLoad: number      // at the busiest moment (peak profile only)
  express?: { load: number; peakLoad: number; counters: number }
  normal?: { load: number; peakLoad: number; counters: number }
}

export function loadCheck(p: Params, strategy: StrategyKey | null): LoadCheck {
  const lam = num(p, 'arrival_rate')
  const T = num(p, 'duration')
  const C = num(p, 'num_counters')
  const peakFactor = p.arrival_profile === 'peak' ? 1 + num(p, 'peak_amplitude') / 2 : 1
  const En = meanItems(p)
  const ES = expectedService(p, En)
  const load = (lam * ES) / C
  const out: LoadCheck = {
    expectedCustomers: lam * T,
    meanItems: En,
    meanService: ES,
    load,
    peakLoad: load * peakFactor,
  }
  const E = num(p, 'num_express')
  if (strategy === 'express' && E > 0 && E < C) {
    const ps = num(p, 'p_small')
    const pOther = 1 - ps
    const L = num(p, 'large_max_items')
    const nOther = pOther > 0 ? (num(p, 'p_medium') * 10.5 + num(p, 'p_large') * ((16 + L) / 2)) / pOther : 0
    const le = (lam * ps * expectedService(p, 3)) / E
    const ln = (lam * pOther * expectedService(p, nOther)) / (C - E)
    out.express = { load: le, peakLoad: le * peakFactor, counters: E }
    out.normal = { load: ln, peakLoad: ln * peakFactor, counters: C - E }
  }
  return out
}

export type LoadLevel = 'good' | 'warning' | 'critical'
export const loadLevel = (rho: number): LoadLevel => (rho >= 1 ? 'critical' : rho >= 0.8 ? 'warning' : 'good')

/** lambda(t) for the arrival profiles. */
export function arrivalRateAt(p: Params, t: number) {
  const lam = num(p, 'arrival_rate')
  if (p.arrival_profile !== 'peak') return lam
  const A = num(p, 'peak_amplitude')
  const T = num(p, 'duration')
  return lam * (1 - A / 2 + A * Math.sin((Math.PI * t) / T) ** 2)
}

// ---------- densities for the input-distribution diagram ----------
export const expPdf = (x: number, mean: number) => (x < 0 ? 0 : Math.exp(-x / mean) / mean)

export function triangularPdf(x: number, a: number, c: number, b: number) {
  if (x < a || x > b) return 0
  if (x < c) return (2 * (x - a)) / ((b - a) * (c - a || 1e-9))
  if (x === c) return 2 / (b - a)
  return (2 * (b - x)) / ((b - a) * (b - c || 1e-9))
}

export function itemsPmf(p: Params): { n: number; p: number }[] {
  const L = num(p, 'large_max_items')
  const out: { n: number; p: number }[] = []
  for (let n = 1; n <= L; n++) {
    const pr = n <= 5 ? num(p, 'p_small') / 5 : n <= 15 ? num(p, 'p_medium') / 10 : num(p, 'p_large') / (L - 15)
    out.push({ n, p: pr })
  }
  return out
}

/** Var[S | n] = n s^2 + variance of the triangular payment time */
export function serviceSd(p: Params, items: number) {
  const s = num(p, 'scan_time_per_item')
  const a = num(p, 'payment_min')
  const c = num(p, 'payment_mode')
  const b = num(p, 'payment_max')
  const triVar = (a * a + b * b + c * c - a * b - a * c - b * c) / 18
  return Math.sqrt(items * s * s + triVar)
}
