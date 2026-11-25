import {
  Alert, Badge, Button, Grid, Group, NumberInput, Paper, SimpleGrid, Stack, Table, Text,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { api, comparisonChartUrl } from '../api'
import type { Comparison, Meta, Params, StrategyKey } from '../api'
import { ChartImage, Section } from '../components/Common'
import { ParameterPanel } from '../components/ParameterPanel'
import { STRATEGY_COLOURS, fmt } from '../format'

interface Props {
  meta: Meta
  params: Params
  setParams: (p: Params) => void
  openComparisonId: number | null
}

// Which direction is "better" for each measure (null = no preference)
const BETTER: Record<string, 'low' | 'high' | null> = {
  avg_wait: 'low', max_wait: 'low', avg_queue_length: 'low', max_queue_length: 'low',
  avg_service_time: null, avg_time_in_store: 'low', utilisation: null, customers_served: 'high',
  remaining: 'low', pct_waited_over_5_min: 'low',
}

export function ComparePage({ meta, params, setParams, openComparisonId }: Props) {
  const [reps, setReps] = useState(10)
  const [data, setData] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (openComparisonId === null) return
    setLoading(true)
    api.comparison(openComparisonId)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [openComparisonId])

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.createComparison(params, reps))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const keys = data ? (Object.keys(data.results.summary) as StrategyKey[]) : []
  const label = (k: StrategyKey) => data?.results.summary[k].label ?? k

  const bestOf = (measure: string): StrategyKey | null => {
    if (!data || !BETTER[measure]) return null
    const vals = keys.map((k) => [k, data.results.summary[k].measures[measure].mean] as const)
    const sorted = [...vals].sort((a, b) => (BETTER[measure] === 'low' ? a[1] - b[1] : b[1] - a[1]))
    return sorted[0][1] === sorted[1][1] ? null : sorted[0][0]
  }

  const display = (measure: string, v: number) =>
    measure === 'utilisation' ? `${(v * 100).toFixed(1)}%` : fmt(v, measure.startsWith('customers') || measure === 'remaining' || measure === 'max_queue_length' ? 1 : 3)

  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
        <ParameterPanel meta={meta} params={params} onChange={setParams}>
          <NumberInput
            label="Replications"
            description="Independent runs per strategy (seed, seed+1, ...)"
            value={reps}
            min={2}
            max={50}
            onChange={(v) => setReps(Number(v) || 2)}
          />
          <Button onClick={run} loading={loading} fullWidth>Run comparison</Button>
          <Text size="xs" c="dimmed">
            Every replication generates one set of customers and gives the identical set to all three strategies
            (Common Random Numbers), so differences come from the strategy, not from luck.
          </Text>
        </ParameterPanel>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
        <Stack gap="lg">
          {error && <Alert color="red" title="Comparison failed" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
          {!data && !loading && (
            <Paper withBorder radius="md" p="xl">
              <Text fw={600}>No comparison loaded</Text>
              <Text size="sm" c="dimmed" mt={4}>
                Run all three checkout strategies on the same customers and compare them with 95% confidence intervals.
              </Text>
            </Paper>
          )}

          {data && (
            <>
              <Paper withBorder radius="md" p="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text fw={700}>Comparison #{data.id}</Text>
                    <Badge variant="outline" color="gray">{data.replications} replications</Badge>
                    <Badge variant="outline" color="gray">seed {String(data.parameters.seed)}</Badge>
                    <Badge variant="outline" color="gray">{String(data.parameters.num_counters)} counters, {String(data.parameters.num_express)} express</Badge>
                  </Group>
                  <Text size="sm">
                    Lowest average wait: <b>{label(data.results.ranking_by_avg_wait[0])}</b>
                  </Text>
                </Group>
              </Paper>

              <Section title="Strategy comparison" description="Mean across replications, plus or minus the 95% confidence interval half-width. Best value per row in bold.">
                <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Measure</Table.Th>
                        {keys.map((k) => (
                          <Table.Th key={k} ta="right">
                            <Group gap={6} justify="flex-end" wrap="nowrap">
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: STRATEGY_COLOURS[k] }} />
                              {label(k)}
                            </Group>
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.results.measures.map(({ key, label: mlabel }) => {
                        const best = bestOf(key)
                        return (
                          <Table.Tr key={key}>
                            <Table.Td>{mlabel}</Table.Td>
                            {keys.map((k) => {
                              const s = data.results.summary[k].measures[key]
                              return (
                                <Table.Td key={k} ta="right" fw={best === k ? 700 : 400} ff="monospace">
                                  {display(key, s.mean)}
                                  <Text span c="dimmed" size="xs"> ± {display(key, s.ci_half)}</Text>
                                </Table.Td>
                              )
                            })}
                          </Table.Tr>
                        )
                      })}
                    </Table.Tbody>
                  </Table>
                </Paper>

                <Paper withBorder radius="md" p="md">
                  <Text fw={600} size="sm" mb={6}>Paired difference in average waiting time versus Shortest Queue</Text>
                  {Object.entries(data.results.paired_avg_wait_vs_shortest_queue).map(([k, s]) => {
                    if (!s) return null
                    const lo = s.mean - s.ci_half
                    const hi = s.mean + s.ci_half
                    const significant = lo > 0 || hi < 0
                    return (
                      <Text size="sm" key={k}>
                        {label(k as StrategyKey)}: {s.mean >= 0 ? '+' : ''}{fmt(s.mean, 3)} min
                        {' '}(95% CI {fmt(lo, 3)} to {fmt(hi, 3)}){' '}
                        <Badge size="xs" variant="light" color={significant ? (s.mean < 0 ? 'teal' : 'red') : 'gray'}>
                          {significant ? (s.mean < 0 ? 'significantly shorter' : 'significantly longer') : 'no significant difference'}
                        </Badge>
                      </Text>
                    )
                  })}
                  <Text size="xs" c="dimmed" mt={6}>
                    Because each replication uses the same customers for every strategy, the per-replication differences are
                    paired. If the interval does not contain zero the difference is statistically significant at the 5% level.
                  </Text>
                </Paper>
              </Section>

              <Section title="Comparison charts" description="Generated by Matplotlib. Error bars are 95% confidence intervals.">
                <SimpleGrid cols={{ base: 1, lg: 2 }}>
                  {['avg-wait', 'max-wait', 'queue-length', 'time-in-store', 'utilisation', 'by-category'].map((c) => (
                    <ChartImage key={`${data.id}-${c}`} src={comparisonChartUrl(data.id, c)} alt={c} />
                  ))}
                </SimpleGrid>
                <ChartImage key={`${data.id}-qot`} src={comparisonChartUrl(data.id, 'queue-over-time')} alt="Queue over time" />
              </Section>
            </>
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}
