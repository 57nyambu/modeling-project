import {
  Alert, Anchor, Badge, Button, Grid, Group, Paper, Select, SimpleGrid, Slider, Stack, Table, Text,
} from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { api, runChartUrl, runCsvUrl } from '../api'
import type { Meta, Params, Run, StrategyKey } from '../api'
import { ChartImage, Legend, Section, StatCard } from '../components/Common'
import { ParameterPanel } from '../components/ParameterPanel'
import { BASKET_COLOURS, clock, fmt, minutes, pct } from '../format'
import { StoreCanvas } from '../sim/StoreCanvas'
import { prepare, snapshot } from '../sim/playback'
import { usePlayback } from '../sim/usePlayback'

interface Props {
  meta: Meta
  params: Params
  setParams: (p: Params) => void
  strategy: StrategyKey
  setStrategy: (s: StrategyKey) => void
  openRunId: number | null
}

const SPEEDS = ['1', '2', '5', '10', '20', '40']

export function SimulationPage({ meta, params, setParams, strategy, setStrategy, openRunId }: Props) {
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const duration = run?.metrics.duration ?? Number(params.duration)
  const pb = usePlayback(duration)

  useEffect(() => {
    if (openRunId === null) return
    setLoading(true)
    api.run(openRunId)
      .then((r) => { setRun(r); pb.reset() })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRunId])

  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.createRun(strategy, params)
      setRun(r)
      pb.play()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const prepared = useMemo(() => (run?.trace ? prepare(run.trace) : null), [run])
  const live = useMemo(
    () => (run?.trace && prepared ? snapshot(prepared, run.trace, pb.time) : null),
    [run, prepared, pb.time],
  )

  const m = run?.metrics
  const finished = pb.state === 'finished' || (run !== null && !run.trace)

  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
        <ParameterPanel meta={meta} params={params} onChange={setParams}>
          <Select
            label="Checkout strategy"
            value={strategy}
            onChange={(v) => v && setStrategy(v as StrategyKey)}
            data={meta.strategies.map((s) => ({ value: s.key, label: s.label }))}
            allowDeselect={false}
          />
          <Button onClick={start} loading={loading} fullWidth>
            Start simulation
          </Button>
        </ParameterPanel>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
        <Stack gap="lg">
          {error && <Alert color="red" title="Simulation failed" withCloseButton onClose={() => setError(null)}>{error}</Alert>}

          {!run && !loading && (
            <Paper withBorder radius="md" p="xl">
              <Text fw={600}>No simulation loaded</Text>
              <Text size="sm" c="dimmed" mt={4}>
                Set the parameters, choose a checkout strategy and press Start simulation. The engine runs the
                full discrete-event simulation on the server, then the store below replays every event on a clock
                you can pause, resume, scrub and reset.
              </Text>
            </Paper>
          )}

          {run && (
            <>
              <Paper withBorder radius="md" p="md">
                <Group justify="space-between" mb="sm" wrap="wrap">
                  <Group gap="xs">
                    <Text fw={700}>Run #{run.id}</Text>
                    <Badge variant="light">{run.metrics.strategy_label}</Badge>
                    <Badge variant="outline" color="gray">seed {String(run.parameters.seed)}</Badge>
                  </Group>
                  <Group gap="xs">
                    {pb.state === 'playing' ? (
                      <Button size="xs" variant="default" onClick={pb.pause}>Pause</Button>
                    ) : pb.state === 'paused' ? (
                      <Button size="xs" onClick={pb.resume}>Resume</Button>
                    ) : (
                      <Button size="xs" onClick={pb.play} disabled={!run.trace}>
                        {pb.state === 'finished' ? 'Replay' : 'Play'}
                      </Button>
                    )}
                    <Button size="xs" variant="default" onClick={pb.reset}>Reset</Button>
                    <Button size="xs" variant="default" onClick={pb.skipToEnd} disabled={!run.trace}>End</Button>
                    <Select
                      size="xs"
                      w={150}
                      value={String(pb.speed)}
                      onChange={(v) => v && pb.setSpeed(Number(v))}
                      data={SPEEDS.map((s) => ({ value: s, label: `${s} sim min / sec` }))}
                      allowDeselect={false}
                    />
                  </Group>
                </Group>

                {run.trace ? (
                  <>
                    <StoreCanvas trace={run.trace} timeRef={pb.timeRef} sectionLabels={meta.sections} />
                    <Group mt="sm" gap="md" align="center" wrap="nowrap">
                      <Text ff="monospace" size="sm" w={150}>
                        t = {pb.time.toFixed(1)} min
                      </Text>
                      <Slider
                        style={{ flex: 1 }}
                        min={0}
                        max={duration}
                        step={0.1}
                        value={pb.time}
                        onChange={(v) => { if (pb.state === 'playing') pb.pause(); pb.seek(v) }}
                        label={(v) => clock(v)}
                      />
                      <Text ff="monospace" size="sm" c="dimmed">{clock(pb.time)} / {clock(duration)}</Text>
                    </Group>
                    <Group justify="space-between" mt="xs">
                      <Legend items={[
                        { colour: BASKET_COLOURS.small, label: 'Small basket (1-5)' },
                        { colour: BASKET_COLOURS.medium, label: 'Medium (6-15)' },
                        { colour: BASKET_COLOURS.large, label: 'Large (16+)' },
                        { colour: '#94a3b8', label: 'Outlined: being served', ring: true },
                      ]} />
                      <Text size="xs" c="dimmed">Dark counter = cashier busy</Text>
                    </Group>
                  </>
                ) : (
                  <Alert color="yellow">
                    This run has too many customers to animate. Results and charts are still complete.
                  </Alert>
                )}
              </Paper>

              {live && (
                <Section title="Live state" description="System state at the current playback time">
                  <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
                    <StatCard label="Arrived" value={live.generated} />
                    <StatCard label="Shopping or walking" value={live.shopping} />
                    <StatCard label="Waiting in queues" value={live.waiting} />
                    <StatCard label="Being served" value={live.inService} />
                    <StatCard label="Served and left" value={live.served} />
                    <StatCard label="Longest queue now" value={Math.max(0, ...live.queues)} />
                  </SimpleGrid>
                </Section>
              )}

              {m && (
                <Section
                  title="Performance measures"
                  description={finished
                    ? `Final results for the full run of ${m.duration} minutes`
                    : `Final results for the full run of ${m.duration} minutes (the replay is still in progress)`}
                  actions={<Anchor size="sm" href={runCsvUrl(run.id)}>Download customer data (CSV)</Anchor>}
                >
                  <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
                    <StatCard label="Customers generated" value={m.customers_generated} />
                    <StatCard label="Customers served" value={m.customers_served} />
                    <StatCard label="Average waiting time" value={minutes(m.avg_wait)} />
                    <StatCard label="Maximum waiting time" value={minutes(m.max_wait)} />
                    <StatCard label="Average queue length" value={fmt(m.avg_queue_length, 3)}
                      hint={`Per counter, time-weighted. Store total ${fmt(m.avg_total_waiting, 3)}`} />
                    <StatCard label="Maximum queue length" value={m.max_queue_length} />
                    <StatCard label="Average service time" value={minutes(m.avg_service_time)} />
                    <StatCard label="Average time in store" value={minutes(m.avg_time_in_store)} />
                    <StatCard label="Cashier utilisation" value={pct(m.utilisation)} hint="Mean over counters" />
                    <StatCard label="Remaining at end" value={m.remaining}
                      hint={`${m.remaining_breakdown.shopping} shopping, ${m.remaining_breakdown.waiting} waiting, ${m.remaining_breakdown.in_service} in service`} />
                    <StatCard label="Waited over 5 minutes" value={`${fmt(m.pct_waited_over_5_min, 1)}%`} />
                    <StatCard label="Little's Law check" value={`${fmt(m.littles_law.lq_observed, 3)} = ${fmt(m.littles_law.lambda_wq, 3)}`}
                      hint="Lq (time-weighted) vs lambda x Wq" />
                  </SimpleGrid>

                  <Paper withBorder radius="md">
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Counter</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th ta="right">Served</Table.Th>
                          <Table.Th ta="right">Utilisation</Table.Th>
                          <Table.Th ta="right">Avg queue</Table.Th>
                          <Table.Th ta="right">Max queue</Table.Th>
                          <Table.Th ta="right">Avg wait</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {m.counters.map((c) => (
                          <Table.Tr key={c.counter}>
                            <Table.Td>C{c.counter}</Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="light" color={c.type === 'express' ? 'orange' : 'blue'}>{c.type}</Badge>
                            </Table.Td>
                            <Table.Td ta="right">{c.served}</Table.Td>
                            <Table.Td ta="right">{pct(c.utilisation)}</Table.Td>
                            <Table.Td ta="right">{fmt(c.avg_queue_length, 3)}</Table.Td>
                            <Table.Td ta="right">{c.max_queue_length}</Table.Td>
                            <Table.Td ta="right">{minutes(c.avg_wait)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>

                  <Paper withBorder radius="md">
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Basket size</Table.Th>
                          <Table.Th ta="right">Generated</Table.Th>
                          <Table.Th ta="right">Served</Table.Th>
                          <Table.Th ta="right">Avg wait</Table.Th>
                          <Table.Th ta="right">Avg time in store</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(['small', 'medium', 'large'] as const).map((k) => (
                          <Table.Tr key={k}>
                            <Table.Td tt="capitalize">{k}</Table.Td>
                            <Table.Td ta="right">{m.by_category[k].generated}</Table.Td>
                            <Table.Td ta="right">{m.by_category[k].served}</Table.Td>
                            <Table.Td ta="right">{minutes(m.by_category[k].avg_wait)}</Table.Td>
                            <Table.Td ta="right">{minutes(m.by_category[k].avg_time_in_store)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Section>
              )}

              <Section title="Performance charts" description="Generated by Matplotlib from this run. Click to open full size.">
                <ChartImage key={`ql-${run.id}`} src={runChartUrl(run.id, 'queue-length')} alt="Queue length over time" />
                <ChartImage key={`is-${run.id}`} src={runChartUrl(run.id, 'in-store')} alt="Customers in store" />
                <SimpleGrid cols={{ base: 1, lg: 2 }}>
                  <ChartImage key={`wh-${run.id}`} src={runChartUrl(run.id, 'wait-histogram')} alt="Waiting time distribution" />
                  <ChartImage key={`ut-${run.id}`} src={runChartUrl(run.id, 'utilisation')} alt="Cashier utilisation" />
                </SimpleGrid>
              </Section>
            </>
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}
