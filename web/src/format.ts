export const fmt = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? '-' : v.toFixed(digits)

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? '-' : `${(v * 100).toFixed(digits)}%`

export const minutes = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? '-' : `${v.toFixed(digits)} min`

export const clock = (t: number) => {
  const h = Math.floor(t / 60)
  const m = Math.floor(t % 60)
  const s = Math.floor((t * 60) % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const dateTime = (iso: string) => new Date(iso).toLocaleString()

export const STRATEGY_COLOURS: Record<string, string> = {
  shortest_queue: '#2563eb',
  shortest_wait: '#0d9488',
  express: '#d97706',
}

export const BASKET_COLOURS = { small: '#0d9488', medium: '#2563eb', large: '#d97706' } as const
