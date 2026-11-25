import {
  Alert, Anchor, Badge, Button, Group, SegmentedControl, Stack, Tabs, Text, Tooltip,
} from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { api, runChartUrl, runCsvUrl } from '../api'
import type { BasketKey, Meta, Params, Run, StrategyKey, Trace } from '../api'
import { BarsCI, Histogram } from '../charts/Bars'
import { ChartCard } from '../charts/ChartCard'
import { StepChart, maxOf } from '../charts/StepChart'
import { niceMax } from '../charts/core'
import { CustomerLog } from '../components/CustomerLog'
import { IconDownload, IconEnd, IconPause, IconPlay, IconReset, IconSliders } from '../components/Icons'
import { EmptyState, MeasureSheet, PageHeader, Panel, Swatch } from '../components/Page'
import { ParameterPanel } from '../components/ParameterPanel'
import {
  BASKET_COLOURS, BASKET_LABELS, STRATEGY_COLOURS, clock, fmt, int, minutes, pct,
} from '../format'
import { num, validateParams } from '../model'
import { Scrubber } from '../sim/Scrubber'
import { StoreCanvas } from '../sim/StoreCanvas'
import { prepare, snapshot } from '../sim/playback'
import type { Snapshot } from '../sim/playback'
import { usePlayback } from '../sim/usePlayback'
import { tokens } from '../theme'

interface Props {
  meta: Meta
  params: Params
  setParams: (p: Params) => void
  strategy: StrategyKey
  setStrategy: (s: StrategyKey) => void
  runId: number | null
  onRunCreated: (id: number) => void
}

const SPEEDS = [1, 5, 10, 20, 60]

/** An empty store drawn from the current parameters, shown before the first run. */
function previewTrace(meta: Meta, params: Params, strategy: StrategyKey): Trace {
  const n = Math.min(10, Math.max(1, Math.round(num(params, 'num_counters')) || 4))
  const express = strategy === 'express' ? Math.min(n, Math.max(0, Math.round(num(params, 'num_express')) || 0)) : 0
  const { x_min, x_max, y } = meta.counter_span
  const counters: [number, number][] = n === 1
    ? [[(x_min + x_max) / 2, y]]
    : Array.from({ length: n }, (_, i) => [x_min + (i * (x_max - x_min)) / (n - 1), y])
  return {
    duration: 1,
    layout: { ...meta.layout, counters },
    counters: counters.map((_, i) => ({ index: i, type: i < express ? 'express' : 'normal' })),
    customers: [],
  }
}

/** Live state at the playback time, in one row under the floor plan. */
function LiveStrip({ live, time, duration }: { live: Snapshot; time: number; duration: number }) {
  const items: [string, number, string][] = [
    ['Arrived', live.generated, 'Customers who have entered so far'],
    ['Shopping', live.shopping, 'In a section or walking between points'],
    ['Waiting', live.waiting, 'In a checkout queue'],
    ['Being served', live.inService, 'At a till right now'],
    ['Left', live.served, 'Served and gone'],
  ]
  return (
    <div className="live-strip">
      <div className="live-cell live-clock">
        <Text size="xs" c="var(--ink-2)">Time since opening</Text>
        <Text fz={30} fw={600} lh={1.15} className="num" style={{ letterSpacing: '-0.01em' }}>{clock(time)}</Text>
        <Text size="xs" c="var(--ink-3)">Closes at {clock(duration)}</Text>
      </div>
      {items.map(([label, value, hint]) => (
        <div key={label} className="live-cell" title={hint}>
          <Text size="xs" c="var(--ink-2)">{label}</Text>
          <Text fz={22} fw={600} lh={1.3}>{value}</Text>
        </div>
      ))}
    </div>
  )
}

export function SimulationPage({ meta, params, setParams, strategy, setStrategy, runId, onRunCreated }: Props) {
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showParams, setShowParams] = useState(true)
  const [tab, setTab] = useState<string | null>('queues')
  const errors = useMemo(() => validateParams(params, meta), [params, meta])
  const duration = run?.metrics.duration ?? (num(params, 'duration') || 240)
  const pb = usePlayback(duration)

  useEffect(() => {
    if (runId === null || run?.id === runId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api.run(runId)
      .then((r) => { if (!cancelled) { setRun(r); pb.reset() } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.createRun(strategy, params)
      setRun(r)
      onRunCreated(r.id)
      pb.play()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const preview = useMemo(() => previewTrace(meta, params, strategy), [meta, params, strategy])
  const trace = run?.trace ?? null
  const prepared = useMemo(() => (trace ? prepare(trace) : null), [trace])
  const live = useMemo(
    () => (trace && prepared ? snapshot(prepared, trace, pb.time) : null),
    [trace, prepared, pb.time],
  )
  const m = run?.metrics
  const ts = run?.timeseries
  const playhead = pb.state === 'idle' ? null : pb.time
  const queueMax = ts ? niceMax(Math.max(1, ...ts.queues.map(maxOf)), 3, true) : 1

  const transport = run && trace && (
    <Group justify="space-between" gap="sm" mt={12} wrap="wrap">
      <Group gap={6}>
        {pb.state === 'playing' ? (
          <Button size="xs" variant="default" leftSection={<IconPause size={14} />} onClick={pb.pause}>Pause</Button>
        ) : pb.state === 'paused' ? (
          <Button size="xs" leftSection={<IconPlay size={14} />} onClick={pb.resume}>Resume</Button>
        ) : (
          <Button size="xs" leftSection={<IconPlay size={14} />} onClick={pb.play}>
            {pb.state === 'finished' ? 'Replay' : 'Play'}
          </Button>
        )}
        <Button size="xs" variant="default" leftSection={<IconReset size={14} />} onClick={pb.reset}>Reset</Button>
        <Button size="xs" variant="default" leftSection={<IconEnd size={14} />} onClick={pb.skipToEnd}>Jump to end</Button>
      </Group>
      <Group gap={8}>
        <Tooltip label="Simulated minutes that pass in one real second">
          <Text size="xs" c="var(--ink-2)">Speed</Text>
        </Tooltip>
        <SegmentedControl
          value={String(pb.speed)}
          onChange={(v) => pb.setSpeed(Number(v))}
          data={SPEEDS.map((s) => ({ value: String(s), label: `${s}x` }))}
          aria-label="Playback speed in simulated minutes per second"
        />
      </Group>
    </Group>
  )

  return (
    <>
      <PageHeader
        title="Simulation"
        description="Run one checkout strategy and watch customers enter, shop, queue, pay and leave. The engine computes the whole day first; the floor plan then replays its events."
        actions={
          <Button variant="default" size="xs" leftSection={<IconSliders size={14} />} onClick={() => setShowParams((s) => !s)}>
            {showParams ? 'Hide parameters' : 'Show parameters'}
          </Button>
        }
      />
      <div className={`workspace${showParams ? '' : ' wide'}`}>
        {showParams && (
          <div className="side">
            <ParameterPanel
              meta={meta} params={params} onChange={setParams} errors={errors}
              strategy={strategy} onStrategy={setStrategy}
            >
              <Button onClick={start} loading={loading} disabled={Object.keys(errors).length > 0} fullWidth size="sm">
                Start simulation
              </Button>
            </ParameterPanel>
          </div>
        )}

        <Stack gap={20} miw={0}>
          {error && (
            <Alert color="red" variant="light" title="The simulation did not run" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {run && (
            <Group justify="space-between" gap="sm" wrap="wrap">
              <Group gap={8} wrap="wrap">
                <Text fw={600}>Run {run.id}</Text>
                <Group gap={6} wrap="nowrap">
                  <Swatch colour={STRATEGY_COLOURS[run.strategy]} />
                  <Text size="sm">{run.metrics.strategy_label}</Text>
                </Group>
                <Badge variant="outline" color="gray">{String(run.parameters.duration)} min</Badge>
                <Badge variant="outline" color="gray">{String(run.parameters.arrival_rate)} arrivals per min</Badge>
                {run.parameters.arrival_profile === 'peak' && <Badge variant="outline" color="gray">Midday peak</Badge>}
                <Badge variant="outline" color="gray">
                  {String(run.parameters.num_counters)} counters
                  {run.strategy === 'express' ? `, ${String(run.parameters.num_express)} express` : ''}
                </Badge>
                <Badge variant="outline" color="gray">Seed {String(run.parameters.seed)}</Badge>
              </Group>
              <Anchor size="sm" href={runCsvUrl(run.id)} c="var(--ink-2)">
                <Group gap={4} wrap="nowrap"><IconDownload size={14} />Customer data (CSV)</Group>
              </Anchor>
            </Group>
          )}

          <div className="panel" style={{ padding: 16, minWidth: 0 }}>
            <StoreCanvas trace={trace ?? preview} timeRef={pb.timeRef} sectionLabels={meta.sections} />
            <Group gap={16} mt={10} wrap="wrap">
              {(['small', 'medium', 'large'] as BasketKey[]).map((k) => (
                <Group key={k} gap={6} wrap="nowrap">
                  <span style={{ width: 9 + (k === 'large' ? 4 : k === 'medium' ? 2 : 0), height: 9 + (k === 'large' ? 4 : k === 'medium' ? 2 : 0), borderRadius: 20, background: BASKET_COLOURS[k] }} />
                  <Text size="xs" c="var(--ink-2)">{BASKET_LABELS[k]}</Text>
                </Group>
              ))}
              <Group gap={6} wrap="nowrap">
                <span style={{ width: 11, height: 11, borderRadius: 20, background: '#ffffff', border: `2px solid ${tokens.ink}` }} />
                <Text size="xs" c="var(--ink-2)">Dark ring: being served</Text>
              </Group>
              <Group gap={6} wrap="nowrap">
                <span style={{ width: 14, height: 10, borderRadius: 2, background: tokens.ink }} />
                <Text size="xs" c="var(--ink-2)">Dark lane number: cashier busy</Text>
              </Group>
            </Group>
            {run && trace && ts && (
              <>
                {transport}
                <div style={{ marginTop: 10 }}>
                  <Scrubber duration={duration} time={pb.time} waiting={ts.waiting} onSeek={pb.seek} onScrubStart={pb.pause} />
                  <Text size="xs" c="var(--ink-3)" mt={2}>
                    The shading behind the timeline is the number of customers waiting. Drag, click or use the arrow keys to move through the day.
                  </Text>
                </div>
                {live && <LiveStrip live={live} time={pb.time} duration={duration} />}
              </>
            )}
            {run && !trace && (
              <Alert color="yellow" variant="light" mt="sm">
                This run has more than 5,000 customers, so it is not animated. All results and charts below are complete.
              </Alert>
            )}
            {!run && (
              <Text size="sm" c="var(--ink-2)" mt={12}>
                {loading
                  ? 'Running the simulation: the engine is processing every arrival, shopping trip, queue and payment.'
                  : 'This is the store with your current counters. Choose a strategy, check the load, then press Start simulation.'}
              </Text>
            )}
          </div>

          {!run && !loading && (
            <EmptyState title="No results yet">
              Results appear here after the first run: waiting times, queue lengths, cashier utilisation, charts and a
              log of every customer. Earlier runs are kept under Saved results.
            </EmptyState>
          )}

          {m && ts && run && (
            <>
              <Panel
                title="Results for the full run"
                description={`Measured over ${m.duration} minutes. Waiting times count customers whose service started before closing.`}
                padded={false}
              >
                <div style={{ padding: 12, containerType: 'inline-size' }}>
                  <MeasureSheet groups={[
                    {
                      title: 'Customers',
                      rows: [
                        { label: 'Generated', value: int(m.customers_generated) },
                        { label: 'Served', value: int(m.customers_served) },
                        { label: 'Served per hour', value: fmt(m.throughput_per_hour, 1) },
                        {
                          label: 'Still in the store at closing', value: int(m.remaining),
                          hint: `${m.remaining_breakdown.shopping} shopping, ${m.remaining_breakdown.waiting} waiting, ${m.remaining_breakdown.in_service} being served`,
                        },
                      ],
                    },
                    {
                      title: 'Waiting',
                      rows: [
                        { label: 'Average wait', value: minutes(m.avg_wait) },
                        { label: '90th percentile', value: minutes(m.p90_wait) },
                        { label: 'Longest wait', value: minutes(m.max_wait) },
                        { label: 'Had to wait at all', value: pct(m.prob_wait, 0) },
                        { label: 'Waited over 5 min', value: `${fmt(m.pct_waited_over_5_min, 1)}%` },
                      ],
                    },
                    {
                      title: 'Queues',
                      rows: [
                        { label: 'Average queue per counter', value: fmt(m.avg_queue_length, 3), hint: 'Time-weighted: (1/T) x area under the queue-length curve' },
                        { label: 'Average waiting, all queues', value: fmt(m.avg_total_waiting, 3) },
                        { label: 'Longest queue', value: int(m.max_queue_length) },
                        {
                          label: "Little's law check", value: `${fmt(m.littles_law.lq_observed, 3)} vs ${fmt(m.littles_law.lambda_wq, 3)}`,
                          hint: 'Time-weighted queue length should equal arrival rate x average wait',
                        },
                      ],
                    },
                    {
                      title: 'Service and cashiers',
                      rows: [
                        { label: 'Average service time', value: minutes(m.avg_service_time) },
                        { label: 'Average time in store', value: minutes(m.avg_time_in_store) },
                        { label: 'Average customers in store', value: fmt(m.avg_in_store, 1) },
                        { label: 'Cashier utilisation', value: pct(m.utilisation) },
                        { label: 'Busy cashiers on average', value: `${fmt(m.avg_busy_cashiers, 2)} of ${m.counters.length}` },
                      ],
                    },
                  ]} />
                  {m.remaining > 0 && (
                    <Text size="xs" c="var(--ink-3)" mt={8} px={4}>
                      At closing: {m.remaining_breakdown.shopping} still shopping, {m.remaining_breakdown.waiting} waiting
                      and {m.remaining_breakdown.in_service} being served.
                    </Text>
                  )}
                </div>
              </Panel>

              <Tabs value={tab} onChange={setTab} variant="outline" radius="sm">
                <Tabs.List>
                  <Tabs.Tab value="queues">Queues over time</Tabs.Tab>
                  <Tabs.Tab value="waits">Waiting times</Tabs.Tab>
                  <Tabs.Tab value="counters">Counters</Tabs.Tab>
                  <Tabs.Tab value="log">Customer log</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="queues" pt="md">
                  <Stack gap={16}>
                    <ChartCard
                      title="Customers waiting at each counter"
                      subtitle={`Same scale for every counter. The dark line follows the replay.${ts.decimated ? ' Long run: peaks are kept, short dips may be hidden.' : ''}`}
                      pngHref={runChartUrl(run.id, 'queue-length')}
                      table={{
                        columns: ['Counter', 'Type', 'Average queue', 'Longest queue', 'Average wait (min)'],
                        rows: m.counters.map((c) => [`Counter ${c.counter}`, c.type, fmt(c.avg_queue_length, 3), c.max_queue_length, fmt(c.avg_wait, 2)]),
                      }}
                    >
                      <div className="multiples">
                        {ts.queues.map((q, i) => (
                          <div key={i}>
                            <Text size="xs" fw={600} mb={2}>
                              Counter {i + 1}{m.counters[i].type === 'express' ? ' (express)' : ''}
                              <Text span size="xs" c="var(--ink-2)" fw={400}>{`  average ${fmt(m.counters[i].avg_queue_length, 2)}, longest ${m.counters[i].max_queue_length}`}</Text>
                            </Text>
                            <StepChart
                              series={[{ key: `q${i}`, label: 'Waiting', colour: tokens.series, points: q }]}
                              end={m.duration} height={110} yMax={queueMax} playhead={playhead}
                              ariaLabel={`Queue length at counter ${i + 1} over time`}
                            />
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                    <div className="chart-grid">
                      <ChartCard
                        title="Customers in the store"
                        subtitle={`Time-weighted average ${fmt(m.avg_in_store, 1)}, highest ${m.max_in_store}`}
                        pngHref={runChartUrl(run.id, 'in-store')}
                      >
                        <StepChart series={[{ key: 'in', label: 'In store', colour: tokens.series, points: ts.in_store }]}
                          end={m.duration} height={180} playhead={playhead} ariaLabel="Customers in the store over time" />
                      </ChartCard>
                      <ChartCard
                        title="Busy cashiers"
                        subtitle={`Average ${fmt(m.avg_busy_cashiers, 2)} of ${m.counters.length}, which is the utilisation of ${pct(m.utilisation)}`}
                        pngHref={runChartUrl(run.id, 'busy-cashiers')}
                      >
                        <StepChart series={[{ key: 'busy', label: 'Busy cashiers', colour: tokens.series, points: ts.busy }]}
                          end={m.duration} height={180} yMax={m.counters.length} playhead={playhead} ariaLabel="Busy cashiers over time" />
                      </ChartCard>
                    </div>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="waits" pt="md">
                  <div className="chart-grid">
                    <ChartCard
                      title="How long customers waited"
                      subtitle={`${pct(1 - m.prob_wait, 0)} were served without waiting. The histogram shows the ${int(m.wait_distribution.positive)} who waited.`}
                      pngHref={runChartUrl(run.id, 'wait-histogram')}
                      table={{
                        columns: ['Waiting time (min)', 'Customers'],
                        rows: [
                          ['0 (no wait)', m.wait_distribution.zero],
                          ...m.wait_distribution.counts.map((c, i) => [
                            `${fmt(m.wait_distribution.edges[i], 2)} to ${fmt(m.wait_distribution.edges[i + 1], 2)}`, c,
                          ]),
                        ],
                      }}
                    >
                      {m.wait_distribution.counts.length ? (
                        <Histogram
                          edges={m.wait_distribution.edges} counts={m.wait_distribution.counts}
                          mean={m.wait_distribution.mean_positive} ariaLabel="Histogram of waiting times" height={230}
                        />
                      ) : <Text size="sm" c="var(--ink-2)">Nobody had to wait in this run.</Text>}
                    </ChartCard>
                    <ChartCard
                      title="Average wait by basket size"
                      subtitle="One run, so no confidence interval. Use Compare strategies for replicated results."
                      table={{
                        columns: ['Basket', 'Generated', 'Served', 'Average wait (min)', 'Had to wait', 'Time in store (min)'],
                        rows: (['small', 'medium', 'large'] as BasketKey[]).map((k) => [
                          BASKET_LABELS[k], m.by_category[k].generated, m.by_category[k].served,
                          fmt(m.by_category[k].avg_wait, 2), pct(m.by_category[k].prob_wait, 0), fmt(m.by_category[k].avg_time_in_store, 2),
                        ]),
                      }}
                    >
                      <BarsCI
                        rows={(['small', 'medium', 'large'] as BasketKey[]).map((k) => ({
                          key: k, label: BASKET_LABELS[k], colour: BASKET_COLOURS[k], mean: m.by_category[k].avg_wait,
                        }))}
                        unit="min" labelWidth={150} ariaLabel="Average wait by basket size"
                      />
                    </ChartCard>
                  </div>
                </Tabs.Panel>

                <Tabs.Panel value="counters" pt="md">
                  <ChartCard
                    title="Cashier utilisation"
                    subtitle="Share of the run each cashier spent serving: busy time divided by the run length."
                    pngHref={runChartUrl(run.id, 'utilisation')}
                    table={{
                      columns: ['Counter', 'Type', 'Served', 'Utilisation', 'Average queue', 'Longest queue', 'Average wait (min)', 'Average service (min)'],
                      rows: m.counters.map((c) => [
                        `Counter ${c.counter}`, c.type, c.served, pct(c.utilisation), fmt(c.avg_queue_length, 3),
                        c.max_queue_length, fmt(c.avg_wait, 2), fmt(c.avg_service_time, 2),
                      ]),
                    }}
                  >
                    <BarsCI
                      rows={m.counters.map((c) => ({
                        key: String(c.counter), label: `Counter ${c.counter}${c.type === 'express' ? ' (express)' : ''}`,
                        colour: tokens.series, mean: c.utilisation * 100,
                      }))}
                      unit="%" digits={1} labelWidth={150} ariaLabel="Cashier utilisation by counter"
                    />
                  </ChartCard>
                </Tabs.Panel>

                <Tabs.Panel value="log" pt="md">
                  {trace ? <CustomerLog trace={trace} sectionLabels={meta.sections} /> : (
                    <Text size="sm" c="var(--ink-2)">This run is too large to list here. Download the customer data as CSV instead.</Text>
                  )}
                </Tabs.Panel>
              </Tabs>
            </>
          )}
        </Stack>
      </div>
    </>
  )
}
