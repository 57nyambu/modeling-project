// Typed client for the Django API. In development Vite proxies /api to Django.

export type StrategyKey = 'shortest_queue' | 'shortest_wait' | 'express'
export type Params = Record<string, number | string | Record<string, number>>

export interface ParamSpec {
  key: string
  label: string
  unit: string
  min: number
  max: number
  step: number
  group: string
  help: string
}

export interface Meta {
  defaults: Params
  parameters: ParamSpec[]
  sections: Record<string, string>
  strategies: { key: StrategyKey; label: string }[]
}

export interface CounterMetrics {
  counter: number
  type: 'normal' | 'express'
  served: number
  utilisation: number
  avg_queue_length: number
  max_queue_length: number
  avg_wait: number
}

export interface Metrics {
  strategy: StrategyKey
  strategy_label: string
  duration: number
  customers_generated: number
  customers_served: number
  customers_started_service: number
  avg_wait: number
  max_wait: number
  avg_queue_length: number
  avg_total_waiting: number
  max_queue_length: number
  avg_service_time: number
  avg_time_in_store: number
  utilisation: number
  remaining: number
  remaining_breakdown: { shopping: number; waiting: number; in_service: number }
  pct_waited_over_5_min: number
  littles_law: { lq_observed: number; lambda_wq: number }
  counters: CounterMetrics[]
  by_category: Record<'small' | 'medium' | 'large', {
    generated: number; served: number; avg_wait: number; avg_time_in_store: number
  }>
  events_processed: number
}

export type Point = [number, number]

export interface Layout {
  width: number
  height: number
  entrance: Point
  exit: Point
  checkout_point: Point
  sections: Record<string, { x: number; y: number; w: number; h: number }>
  counters: Point[]
  queue_spacing: number
}

export interface TraceCustomer {
  id: number
  cat: 'small' | 'medium' | 'large'
  items: number
  a: number
  legs: [string, number | null, number | null][]
  co: number | null
  c: number | null
  ss: number | null
  d: number | null
}

export interface Trace {
  duration: number
  layout: Layout
  counters: { index: number; type: 'normal' | 'express' }[]
  customers: TraceCustomer[]
}

export interface RunSummary {
  id: number
  created_at: string
  strategy: StrategyKey
  strategy_label: string
  seed: number
  duration: number
  arrival_rate: number
  num_counters: number
  customers_generated: number
  customers_served: number
  avg_wait: number
  utilisation: number
}

export interface Run extends RunSummary {
  parameters: Params
  metrics: Metrics
  timeseries: { t: number[]; in_store: number[]; queues: number[][] }
  trace: Trace | null
}

export interface Stat { mean: number; sd: number; ci_half: number; n: number }

export interface ComparisonSummary {
  id: number
  created_at: string
  replications: number
  seed: number
  duration: number
  arrival_rate: number
  num_counters: number
  num_express: number
  best_strategy: StrategyKey
  avg_wait: Record<StrategyKey, number>
}

export interface Comparison extends ComparisonSummary {
  parameters: Params
  results: {
    replications: number
    measures: { key: string; label: string }[]
    summary: Record<StrategyKey, {
      label: string
      measures: Record<string, Stat>
      by_category_wait: Record<'small' | 'medium' | 'large', Stat>
    }>
    paired_avg_wait_vs_shortest_queue: Partial<Record<StrategyKey, Stat>>
    ranking_by_avg_wait: StrategyKey[]
  }
}

export interface ValidationMeasure {
  theory: number
  simulated_mean: number
  ci_low: number
  ci_high: number
  theory_inside_ci: boolean
  relative_error: number
}

export interface Validation {
  lambda: number
  mu: number
  duration: number
  replications: number
  measures: Record<'rho' | 'wq' | 'lq', ValidationMeasure>
  mmc_reference: { c: number; lambda: number; mu: number; rho: number; p_wait: number; wq: number; lq: number }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(res.ok ? 'Invalid response from server' : `Server error (${res.status})`)
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new Error(msg ?? `Request failed (${res.status})`)
  }
  return data as T
}

export const api = {
  meta: () => request<Meta>('/api/meta'),
  runs: () => request<{ results: RunSummary[] }>('/api/runs'),
  run: (id: number) => request<Run>(`/api/runs/${id}`),
  createRun: (strategy: StrategyKey, parameters: Params) =>
    request<Run>('/api/runs', { method: 'POST', body: JSON.stringify({ strategy, parameters }) }),
  deleteRun: (id: number) => request<void>(`/api/runs/${id}`, { method: 'DELETE' }),
  comparisons: () => request<{ results: ComparisonSummary[] }>('/api/comparisons'),
  comparison: (id: number) => request<Comparison>(`/api/comparisons/${id}`),
  createComparison: (parameters: Params, replications: number) =>
    request<Comparison>('/api/comparisons', {
      method: 'POST',
      body: JSON.stringify({ parameters, replications }),
    }),
  deleteComparison: (id: number) => request<void>(`/api/comparisons/${id}`, { method: 'DELETE' }),
  validation: (lambda: number, mu: number) =>
    request<Validation>(`/api/validation?lambda=${lambda}&mu=${mu}`),
}

export const runChartUrl = (id: number, name: string) => `/api/runs/${id}/charts/${name}.png`
export const comparisonChartUrl = (id: number, name: string) => `/api/comparisons/${id}/charts/${name}.png`
export const runCsvUrl = (id: number) => `/api/runs/${id}/customers.csv`
