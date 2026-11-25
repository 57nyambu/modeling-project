import { Alert, Anchor, Badge, Button, Group, NumberInput, Stack, Table, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { api, comparisonChartUrl, comparisonCsvUrl } from '../api'
import type { Comparison, Meta, Params, Stat, StrategyKey } from '../api'
import { BarsCI, GroupedColumns, PairedDots } from '../charts/Bars'
import { ChartCard } from '../charts/ChartCard'
import { StepChart, maxOf } from '../charts/StepChart'
import { niceMax } from '../charts/core'
import { IconDownload } from '../components/Icons'
import { EmptyState, PageHeader, Panel, Swatch } from '../components/Page'
import { ParameterPanel } from '../components/ParameterPanel'
import { BASKET_LABELS, STRATEGY_COLOURS, STRATEGY_ORDER, STRATEGY_SHORT, fmt, minutes, pct } from '../format'
import { num, validateParams } from '../model'
import { tokens } from '../theme'

interface Props {
  meta: Meta
  params: Params
  setParams: (p: Params) => void
  comparisonId: number | null
  onCreated: (id: number) => void
}

// Which direction is better for each measure (null = no preference)
const BETTER: Record<string, 'low' | 'high' | null> = {
  avg_wait: 'low', p90_wait: 'low', max_wait: 'low', prob_wait: 'low', pct_waited_over_5_min: 'low',
  avg_queue_length: 'low', max_queue_length: 'low', avg_service_time: null, avg_time_in_store: 'low',
  avg_in_store: 'low', utilisation: null, customers_served: 'high', throughput_per_hour: 'high', remaining: 'low',
}
const PERCENT = new Set(['prob_wait', 'utilisation'])
const COUNTS = new Set(['customers_served', 'remaining', 'max_queue_length'])

function show(measure: string, v: number) {
  if (PERCENT.has(measure)) return `${(v * 100).toFixed(1)}%`
  if (COUNTS.has(measure)) return fmt(v, 1)
  if (measure === 'pct_waited_over_5_min') return `${fmt(v, 1)}%`
  if (measure === 'avg_in_store' || measure === 'throughput_per_hour') return fmt(v, 1)
  return fmt(v, 3)
}

const significant = (s: Stat) => s.mean - s.ci_half > 0 || s.mean + s.ci_half < 0

function Verdict({ data }: { data: Comparison }) {
  const r = data.results
  const best = r.ranking_by_avg_wait[0]
  const others = r.ranking_by_avg_wait.slice(1)
  const w = (k: StrategyKey) => r.summary[k].measures.avg_wait
  const paired = r.paired_avg_wait_vs_shortest_queue
  return (
    <Panel>
      <Stack gap={10}>
        <Text size="lg" fw={600} lh={1.4} maw={880}>
          {r.summary[best].label} gave the shortest average wait: {minutes(w(best).mean)} (95% CI ± {fmt(w(best).ci_half, 3)}),
          against {others.map((k, i) => `${minutes(w(k).mean)} for ${r.summary[k].label}${i < others.length - 1 ? ' and ' : ''}`).join('')}.
        </Text>
        <Stack gap={4}>
          {(Object.entries(paired) as [StrategyKey, Stat | undefined][]).map(([k, s]) => s && (
            <Text size="sm" c="var(--ink-2)" key={k}>
              {r.summary[k].label} versus Shortest Queue: {s.mean >= 0 ? '+' : ''}{fmt(s.mean, 3)} min per customer
              (paired 95% CI {fmt(s.mean - s.ci_half, 3)} to {fmt(s.mean + s.ci_half, 3)}).{' '}
              {significant(s)
                ? <Text span fw={600} c={s.mean < 0 ? tokens.goodText : tokens.criticalText}>{s.mean < 0 ? 'Significantly shorter.' : 'Significantly longer.'}</Text>
                : <Text span fw={600}>Not a significant difference.</Text>}
            </Text>
          ))}
        </Stack>
      </Stack>
    </Panel>
  )
}

function StrategyColumns({ data }: { data: Comparison }) {
  const r = data.results
  const best = r.ranking_by_avg_wait[0]
  const rows: [string, string, (k: StrategyKey) => string][] = [
    ['90th percentile wait', 'p90_wait', (k) => minutes(r.summary[k].measures.p90_wait.mean)],
    ['Longest wait', 'max_wait', (k) => minutes(r.summary[k].measures.max_wait.mean)],
    ['Had to wait at all', 'prob_wait', (k) => pct(r.summary[k].measures.prob_wait.mean, 0)],
    ['Time in store', 'avg_time_in_store', (k) => minutes(r.summary[k].measures.avg_time_in_store.mean)],
    ['Longest queue', 'max_queue_length', (k) => fmt(r.summary[k].measures.max_queue_length.mean, 1)],
    ['Cashier utilisation', 'utilisation', (k) => pct(r.summary[k].measures.utilisation.mean)],
  ]
  return (
    <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {STRATEGY_ORDER.map((k, i) => (
        <div key={k} style={{ padding: '16px 18px', borderLeft: i ? `1px solid ${tokens.line}` : undefined }}>
          <Group gap={8} wrap="nowrap" mb={10}>
            <Swatch colour={STRATEGY_COLOURS[k]} />
            <Text fw={600} size="sm">{r.summary[k].label}</Text>
          </Group>
          <Text size="xs" c="var(--ink-2)">Average wait</Text>
          <Group gap={8} align="baseline" mb={4}>
            <Text fz={28} fw={600} lh={1.2}>{fmt(r.summary[k].measures.avg_wait.mean, 2)}</Text>
            <Text size="sm" c="var(--ink-2)">min ± {fmt(r.summary[k].measures.avg_wait.ci_half, 2)}</Text>
          </Group>
          <div style={{ height: 30 }}>
            {k === best && <Badge color="green" variant="light">Shortest average wait</Badge>}
          </div>
          <Stack gap={0}>
            {rows.map(([label, , value]) => (
              <Group key={label} justify="space-between" py={5} style={{ borderTop: `1px solid ${tokens.line}` }}>
                <Text size="sm" c="var(--ink-2)">{label}</Text>
                <Text size="sm" fw={600} className="num">{value(k)}</Text>
              </Group>
            ))}
          </Stack>
        </div>
      ))}
    </div>
  )
}

export function ComparePage({ meta, params, setParams, comparisonId, onCreated }: Props) {
  const [reps, setReps] = useState<number | string>(10)
  const [data, setData] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errors = useMemo(() => validateParams(params, meta), [params, meta])
  const repsValid = typeof reps === 'number' && Number.isInteger(reps) && reps >= 2 && reps <= 50

  useEffect(() => {
    if (comparisonId === null || data?.id === comparisonId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api.comparison(comparisonId)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonId])

  const run = async () => {
    if (!repsValid) return
    setLoading(true)
    setError(null)
    try {
      const d = await api.createComparison(params, reps as number)
      setData(d)
      onCreated(d.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const r = data?.results
  const work = num(params, 'arrival_rate') * num(params, 'duration') * (typeof reps === 'number' ? reps : 0) * 3

  return (
    <>
      <PageHeader
        title="Compare strategies"
        description="All three strategies serve the same customers in every replication, so differences come from the strategy and not from luck. Results show the mean over replications with a 95% confidence interval."
      />
      <div className="workspace">
        <div className="side">
          <ParameterPanel meta={meta} params={params} onChange={setParams} errors={errors} loadStrategy="express">
            <div>
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={600}>Replications</Text>
                <NumberInput w={92} value={reps} onChange={setReps} min={2} max={50} step={1} error={!repsValid}
                  aria-label="Replications" />
              </Group>
              <Text size="xs" c="var(--ink-2)" mt={4}>
                Seeds {String(params.seed)} to {Number(params.seed) + (typeof reps === 'number' ? reps : 1) - 1}, one per replication.
                {work > 0 && ` About ${Math.round(work).toLocaleString('en-GB')} customer journeys.`}
              </Text>
              {!repsValid && <Text size="xs" c={tokens.criticalText} mt={2}>Use a whole number from 2 to 50.</Text>}
            </div>
            <Button onClick={run} loading={loading} fullWidth size="sm" disabled={Object.keys(errors).length > 0 || !repsValid}>
              Run comparison
            </Button>
          </ParameterPanel>
        </div>

        <Stack gap={20} miw={0}>
          {error && (
            <Alert color="red" variant="light" title="The comparison did not run" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {!data && !loading && (
            <EmptyState title="No comparison yet">
              Press Run comparison to simulate all three strategies on identical customers. Ten replications take a few
              seconds and give confidence intervals narrow enough to rank the strategies.
            </EmptyState>
          )}
          {loading && !data && (
            <EmptyState title="Running the comparison">
              Each replication generates one set of customers and gives it to all three strategies.
            </EmptyState>
          )}

          {data && r && (
            <div style={{ opacity: loading ? 0.55 : 1 }}>
              <Stack gap={20}>
                <Group justify="space-between" wrap="wrap" gap="sm">
                  <Group gap={8} wrap="wrap">
                    <Text fw={600}>Comparison {data.id}</Text>
                    <Badge variant="outline" color="gray">{r.replications} replications</Badge>
                    <Badge variant="outline" color="gray">Seeds {r.seeds?.[0]} to {r.seeds?.[r.seeds.length - 1]}</Badge>
                    <Badge variant="outline" color="gray">{String(data.parameters.arrival_rate)} arrivals per min</Badge>
                    {data.parameters.arrival_profile === 'peak' && <Badge variant="outline" color="gray">Midday peak</Badge>}
                    <Badge variant="outline" color="gray">{String(data.parameters.num_counters)} counters, {String(data.parameters.num_express)} express</Badge>
                    <Badge variant="outline" color="gray">{String(data.parameters.duration)} min</Badge>
                  </Group>
                  <Anchor size="sm" href={comparisonCsvUrl(data.id)} c="var(--ink-2)">
                    <Group gap={4} wrap="nowrap"><IconDownload size={14} />Replication data (CSV)</Group>
                  </Anchor>
                </Group>

                <Verdict data={data} />
                <StrategyColumns data={data} />

                <div className="chart-grid">
                  <ChartCard
                    title="Average waiting time"
                    subtitle={`Mean of ${r.replications} replications; whiskers show the 95% confidence interval`}
                    pngHref={comparisonChartUrl(data.id, 'avg-wait')}
                    table={{
                      columns: ['Strategy', 'Mean (min)', '95% CI half-width', 'Standard deviation'],
                      rows: STRATEGY_ORDER.map((k) => [r.summary[k].label, fmt(r.summary[k].measures.avg_wait.mean, 3),
                        fmt(r.summary[k].measures.avg_wait.ci_half, 3), fmt(r.summary[k].measures.avg_wait.sd, 3)]),
                    }}
                  >
                    <BarsCI
                      rows={STRATEGY_ORDER.map((k) => ({
                        key: k, label: STRATEGY_SHORT[k], colour: STRATEGY_COLOURS[k],
                        mean: r.summary[k].measures.avg_wait.mean, ci: r.summary[k].measures.avg_wait.ci_half, n: r.replications,
                      }))}
                      unit="min" digits={3} ariaLabel="Average waiting time by strategy"
                    />
                  </ChartCard>
                  <ChartCard
                    title="Every replication"
                    subtitle="Each grey line joins one replication: the same customers under each strategy. Dark bars mark the means."
                    pngHref={comparisonChartUrl(data.id, 'replications')}
                    table={{
                      columns: ['Replication', 'Seed', ...STRATEGY_ORDER.map((k) => `${STRATEGY_SHORT[k]} (min)`)],
                      rows: r.per_replication.shortest_queue.map((_, i) => [
                        i + 1, r.seeds?.[i] ?? '', ...STRATEGY_ORDER.map((k) => fmt(r.per_replication[k][i].avg_wait, 3)),
                      ]),
                    }}
                  >
                    <PairedDots
                      columns={STRATEGY_ORDER.map((k) => ({
                        key: k, label: STRATEGY_SHORT[k], colour: STRATEGY_COLOURS[k],
                        values: r.per_replication[k].map((x) => x.avg_wait),
                      }))}
                      replications={r.replications} digits={3} height={230}
                      ariaLabel="Average waiting time in each replication"
                    />
                  </ChartCard>
                  <ChartCard
                    title="Average wait by basket size"
                    subtitle="Who gains and who loses under each strategy"
                    pngHref={comparisonChartUrl(data.id, 'by-category')}
                    table={{
                      columns: ['Basket', ...STRATEGY_ORDER.map((k) => `${STRATEGY_SHORT[k]} (min)`)],
                      rows: (['small', 'medium', 'large'] as const).map((c) => [
                        BASKET_LABELS[c], ...STRATEGY_ORDER.map((k) => `${fmt(r.summary[k].by_category_wait[c].mean, 3)} ± ${fmt(r.summary[k].by_category_wait[c].ci_half, 3)}`),
                      ]),
                    }}
                  >
                    <GroupedColumns
                      groups={['Small (1 to 5)', 'Medium (6 to 15)', 'Large (16+)']}
                      series={STRATEGY_ORDER.map((k) => ({
                        key: k, label: STRATEGY_SHORT[k], colour: STRATEGY_COLOURS[k],
                        values: (['small', 'medium', 'large'] as const).map((c) => ({
                          mean: r.summary[k].by_category_wait[c].mean, ci: r.summary[k].by_category_wait[c].ci_half,
                        })),
                      }))}
                      unit="min" digits={3} height={210} ariaLabel="Average wait by basket size and strategy"
                    />
                  </ChartCard>
                  <ChartCard
                    title="90th percentile waiting time"
                    subtitle="Nine in ten customers waited less than this"
                    pngHref={comparisonChartUrl(data.id, 'p90-wait')}
                  >
                    <BarsCI
                      rows={STRATEGY_ORDER.map((k) => ({
                        key: k, label: STRATEGY_SHORT[k], colour: STRATEGY_COLOURS[k],
                        mean: r.summary[k].measures.p90_wait.mean, ci: r.summary[k].measures.p90_wait.ci_half, n: r.replications,
                      }))}
                      unit="min" digits={2} ariaLabel="90th percentile waiting time by strategy"
                    />
                  </ChartCard>
                </div>

                {r.timeseries && (
                  <ChartCard
                    title="Customers waiting over the day"
                    subtitle="Replication 1. The three panels share one scale and the same customers, so differences are caused by the strategy."
                    pngHref={comparisonChartUrl(data.id, 'queue-over-time')}
                  >
                    <Stack gap={10}>
                      {(() => {
                        const top = niceMax(Math.max(1, ...STRATEGY_ORDER.map((k) => maxOf(r.timeseries[k].waiting))), 3, true)
                        return STRATEGY_ORDER.map((k, i) => (
                          <div key={k}>
                            <Group gap={6} mb={2}><Swatch colour={STRATEGY_COLOURS[k]} shape="line" /><Text size="xs" fw={600}>{r.summary[k].label}</Text></Group>
                            <StepChart
                              series={[{ key: k, label: 'Waiting', colour: STRATEGY_COLOURS[k], points: r.timeseries[k].waiting }]}
                              end={r.timeseries[k].duration} height={i === 2 ? 110 : 88} yMax={top} showXAxis={i === 2}
                              ariaLabel={`Customers waiting over time under ${r.summary[k].label}`}
                            />
                          </div>
                        ))
                      })()}
                    </Stack>
                  </ChartCard>
                )}

                <Panel title="All measures" description="Mean ± 95% confidence interval half-width. The best value in each row is bold where lower or higher is clearly better." padded={false}>
                  <div style={{ overflowX: 'auto' }}>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Measure</Table.Th>
                          {STRATEGY_ORDER.map((k) => (
                            <Table.Th key={k} ta="right">
                              <Group gap={6} justify="flex-end" wrap="nowrap"><Swatch colour={STRATEGY_COLOURS[k]} />{STRATEGY_SHORT[k]}</Group>
                            </Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {r.measures.map(({ key, label }) => {
                          const dir = BETTER[key]
                          const vals = STRATEGY_ORDER.map((k) => r.summary[k].measures[key].mean)
                          const target = dir === 'low' ? Math.min(...vals) : dir === 'high' ? Math.max(...vals) : null
                          const unique = target !== null && vals.filter((v) => v === target).length === 1
                          return (
                            <Table.Tr key={key}>
                              <Table.Td>{label}</Table.Td>
                              {STRATEGY_ORDER.map((k) => {
                                const s = r.summary[k].measures[key]
                                return (
                                  <Table.Td key={k} ta="right" fw={unique && s.mean === target ? 700 : 400}>
                                    {show(key, s.mean)}
                                    <Text span size="xs" c="var(--ink-3)" fw={400}> ± {show(key, s.ci_half)}</Text>
                                  </Table.Td>
                                )
                              })}
                            </Table.Tr>
                          )
                        })}
                      </Table.Tbody>
                    </Table>
                  </div>
                </Panel>

                {r.paired_vs_shortest_queue && (
                  <Panel
                    title="Paired differences against Shortest Queue"
                    description="Strategy minus Shortest Queue, replication by replication. Because the customers are identical, the differences are paired; an interval that excludes zero is significant at the 5% level."
                    padded={false}
                  >
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Measure</Table.Th>
                          {(['shortest_wait', 'express'] as StrategyKey[]).map((k) => <Table.Th key={k}>{r.summary[k].label}</Table.Th>)}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {Object.entries(r.paired_vs_shortest_queue).map(([measure, byStrategy]) => (
                          <Table.Tr key={measure}>
                            <Table.Td>{r.measures.find((x) => x.key === measure)?.label ?? measure}</Table.Td>
                            {(['shortest_wait', 'express'] as StrategyKey[]).map((k) => {
                              const s = byStrategy[k]
                              if (!s) return <Table.Td key={k}>-</Table.Td>
                              const sig = significant(s)
                              return (
                                <Table.Td key={k}>
                                  <Text span fw={600} className="num">{s.mean >= 0 ? '+' : ''}{fmt(s.mean, 3)}</Text>
                                  <Text span size="xs" c="var(--ink-2)"> ({fmt(s.mean - s.ci_half, 3)} to {fmt(s.mean + s.ci_half, 3)}) </Text>
                                  <Text span size="xs" fw={600} c={sig ? (s.mean < 0 ? tokens.goodText : tokens.criticalText) : 'var(--ink-2)'}>
                                    {sig ? (s.mean < 0 ? 'lower' : 'higher') : 'no significant difference'}
                                  </Text>
                                </Table.Td>
                              )
                            })}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Panel>
                )}
              </Stack>
            </div>
          )}
        </Stack>
      </div>
    </>
  )
}
