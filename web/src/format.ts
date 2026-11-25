import type { BasketKey, StrategyKey } from './api'

const isMissing = (v: number | null | undefined): v is null | undefined =>
  v === null || v === undefined || Number.isNaN(v)

export const fmt = (v: number | null | undefined, digits = 2) =>
  isMissing(v) ? '-' : v.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const int = (v: number | null | undefined) =>
  isMissing(v) ? '-' : Math.round(v).toLocaleString('en-GB')

export const pct = (v: number | null | undefined, digits = 1) =>
  isMissing(v) ? '-' : `${(v * 100).toFixed(digits)}%`

export const minutes = (v: number | null | undefined, digits = 2) =>
  isMissing(v) ? '-' : `${fmt(v, digits)} min`

/** Simulated minutes as h:mm:ss from opening. */
export const clock = (t: number) => {
  const total = Math.max(0, Math.round(t * 60))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const STRATEGY_COLOURS: Record<StrategyKey, string> = {
  shortest_queue: '#257de0',
  shortest_wait: '#f47230',
  express: '#00b894',
}

export const STRATEGY_SHORT: Record<StrategyKey, string> = {
  shortest_queue: 'Shortest Queue',
  shortest_wait: 'Shortest Est. Wait',
  express: 'Express / Normal',
}

export const STRATEGY_ORDER: StrategyKey[] = ['shortest_queue', 'shortest_wait', 'express']

// Basket size is ordered, so customers use one hue from light to dark (violet,
// which no strategy uses) and grow in size with the basket.
export const BASKET_COLOURS: Record<BasketKey, string> = {
  small: '#a99af3',
  medium: '#6a4ce2',
  large: '#3d2a99',
}

export const BASKET_LABELS: Record<BasketKey, string> = {
  small: 'Small (1 to 5 items)',
  medium: 'Medium (6 to 15)',
  large: 'Large (16 or more)',
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
