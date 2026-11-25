// Typed client for the Django API. In development Vite proxies /api to Django.

export type StrategyKey = 'shortest_queue' | 'shortest_wait' | 'express'
export type BasketKey = 'small' | 'medium' | 'large'
export type ParamValue = number | string | Record<string, number>
export type Params = Record<string, ParamValue>

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

export type Point = [number, number]

export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  width: number
  height: number
  entrance: Point
  exit: Point
  checkout_point: Point
  sections: Record<string, Box>
  shelves: Record<string, Box[]>
  header_depth: number
  /** y of the three aisles that run across every section (back, middle, front). */
  aisle_rows: number[]
  /** x of the cross-aisles where customers change aisle row. */
  cross_aisles: number[]
  entry_turn: Point
  exit_walk_y: number
  counters: Point[]
  queue_spacing: number
}

export interface ExampleRoute {
  stops: { section: string; point: Point }[]
  paths: Point[][]
}

export interface Meta {
  defaults: Params
  parameters: ParamSpec[]
  arrival_profiles: string[]
  sections: Record<string, string>
  strategies: { key: StrategyKey; label: string }[]
  layout: Layout
  counter_span: { x_min: number; x_max: number; y: number }
  example_route: ExampleRoute
}

export interface CounterMetrics {
  counter: number
  type: 'normal' | 'express'
  served: number
  utilisation: number
  avg_queue_length: number
  max_queue_length: number
  avg_wait: number
  avg_service_time: number
}

export interface WaitDistribution {
  zero: number
  positive: number
  mean_positive: number
  bin_width: number
  edges: number[]
  counts: number[]
}

export interface Metrics {
  schema: number
  strategy: StrategyKey
  strategy_label: string
  duration: number
  customers_generated: number
  customers_served: number
  customers_started_service: number
  throughput_per_hour: number
  avg_wait: number
  max_wait: number
  p90_wait: number
  prob_wait: number
  pct_waited_over_5_min: number
  avg_queue_length: number
  avg_total_waiting: number
  max_queue_length: number
  avg_in_store: number
  max_in_store: number
  avg_busy_cashiers: number
  avg_service_time: number
  avg_time_in_store: number
  utilisation: number
  remaining: number
  remaining_breakdown: { shopping: number; waiting: number; in_service: number }
  littles_law: { lq_observed: number; lambda_wq: number }
  wait_distribution: WaitDistribution
  counters: CounterMetrics[]
  by_category: Record<BasketKey, {
    generated: number; served: number; avg_wait: number; prob_wait: number; avg_time_in_store: number
  }>
  events_processed: number
}

/** Step function: [time, value] at every change point. */
export type Steps = Point[]

export interface TimeSeries {
  duration: number
  decimated: boolean
  in_store: Steps
  waiting: Steps
  busy: Steps
  queues: Steps[]
}

/** One customer's day, straight from the engine's events (times in minutes after opening). */
export interface TraceCustomer {
  id: number
  cat: BasketKey
  items: number
  /** Walking speed in metres per second. */
  v: number
  /** Arrival time. */
  a: number
  /** Planned route: [section, arrived, left, items]; times are null if not reached by closing. */
  legs: [string, number | null, number | null, number][]
  /** Walking routes as corner points: one into each section, then one to the checkout. */
  p: Point[][]
  /** Checkout arrival (the moment the counter is chosen). */
  co: number | null
  /** Chosen counter (0-based). */
  c: number | null
  /** Service start. */
  ss: number | null
  /** Departure (end of service). */
  d: number | null
  /** What the customer saw at the checkout: [people at the counter, estimated wait] per counter. */
  seen: [number, number][] | null
}

export interface Trace {
  duration: number
  strategy: StrategyKey
  express_limit: number
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
  timeseries: TimeSeries
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
    schema: number
    replications: number
    seeds: number[]
    measures: { key: string; label: string }[]
    summary: Record<StrategyKey, {
      label: string
      measures: Record<string, Stat>
      by_category_wait: Record<BasketKey, Stat>
    }>
    paired_avg_wait_vs_shortest_queue: Partial<Record<StrategyKey, Stat>>
    paired_vs_shortest_queue: Record<string, Partial<Record<StrategyKey, Stat>>>
    ranking_by_avg_wait: StrategyKey[]
    per_replication: Record<StrategyKey, Record<string, number>[]>
    timeseries: Record<StrategyKey, TimeSeries>
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
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new Error('Cannot reach the simulation API. Check that Django is running on port 8000.')
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(res.ok ? 'The server sent a response that is not JSON.' : `The server returned an error (${res.status}).`)
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new Error(msg ? msg.charAt(0).toUpperCase() + msg.slice(1) + '.' : `Request failed (${res.status}).`)
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
export const comparisonCsvUrl = (id: number) => `/api/comparisons/${id}/replications.csv`
