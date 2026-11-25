import { Alert, Button, Group, Loader, Stack, Table, Text } from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { ComparisonSummary, Meta, RunSummary } from '../api'
import { PageHeader, Panel, Swatch } from '../components/Page'
import { STRATEGY_COLOURS, dateTime, fmt, pct } from '../format'

interface Props {
  meta: Meta
  onOpenRun: (id: number) => void
  onOpenComparison: (id: number) => void
}

/** Delete needs a second click within a few seconds, so nothing is removed by accident. */
function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <Button
      size="compact-xs"
      variant={armed ? 'filled' : 'subtle'}
      color="red"
      onClick={() => {
        if (armed) { onConfirm(); setArmed(false); return }
        setArmed(true)
        timer.current = window.setTimeout(() => setArmed(false), 3000)
      }}
    >
      {armed ? 'Confirm delete' : 'Delete'}
    </Button>
  )
}

export function HistoryPage({ meta, onOpenRun, onOpenComparison }: Props) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [cmps, setCmps] = useState<ComparisonSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const label = (k: string) => meta.strategies.find((s) => s.key === k)?.label ?? k

  const load = useCallback(() => {
    Promise.all([api.runs(), api.comparisons()])
      .then(([r, c]) => { setRuns(r.results); setCmps(c.results) })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const remove = async (fn: () => Promise<void>) => {
    try { await fn(); load() } catch (e) { setError((e as Error).message) }
  }

  return (
    <>
      <PageHeader
        title="Saved results"
        description="Every run and comparison is stored in the SQLite database with its seed and parameters, so any result can be reopened or reproduced exactly."
      />
      {error && <Alert color="red" variant="light" mb="md">{error}</Alert>}
      {!runs || !cmps ? <Group justify="center" p="xl"><Loader color="ink" /></Group> : (
        <Stack gap={20}>
          <Panel title="Simulation runs" description={`${runs.length} saved`} padded={false}>
            {runs.length === 0 ? <Text p="md" c="var(--ink-2)" size="sm">No runs yet. Start one on the Simulation page.</Text> : (
              <div style={{ overflowX: 'auto' }}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Run</Table.Th><Table.Th>Saved</Table.Th><Table.Th>Strategy</Table.Th>
                      <Table.Th ta="right">Seed</Table.Th><Table.Th ta="right">Length</Table.Th>
                      <Table.Th ta="right">Arrivals per min</Table.Th><Table.Th ta="right">Counters</Table.Th>
                      <Table.Th ta="right">Served</Table.Th><Table.Th ta="right">Average wait</Table.Th>
                      <Table.Th ta="right">Utilisation</Table.Th><Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {runs.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td fw={600}>{r.id}</Table.Td>
                        <Table.Td c="var(--ink-2)">{dateTime(r.created_at)}</Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap"><Swatch colour={STRATEGY_COLOURS[r.strategy]} />{r.strategy_label}</Group>
                        </Table.Td>
                        <Table.Td ta="right">{r.seed}</Table.Td>
                        <Table.Td ta="right">{r.duration} min</Table.Td>
                        <Table.Td ta="right">{r.arrival_rate}</Table.Td>
                        <Table.Td ta="right">{r.num_counters}</Table.Td>
                        <Table.Td ta="right">{r.customers_served} of {r.customers_generated}</Table.Td>
                        <Table.Td ta="right">{fmt(r.avg_wait, 3)} min</Table.Td>
                        <Table.Td ta="right">{pct(r.utilisation)}</Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <Button size="compact-xs" variant="light" onClick={() => onOpenRun(r.id)}>Open</Button>
                            <DeleteButton onConfirm={() => remove(() => api.deleteRun(r.id))} />
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Panel>

          <Panel title="Strategy comparisons" description={`${cmps.length} saved`} padded={false}>
            {cmps.length === 0 ? <Text p="md" c="var(--ink-2)" size="sm">No comparisons yet. Run one on the Compare strategies page.</Text> : (
              <div style={{ overflowX: 'auto' }}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Comparison</Table.Th><Table.Th>Saved</Table.Th><Table.Th ta="right">Replications</Table.Th>
                      <Table.Th ta="right">First seed</Table.Th><Table.Th ta="right">Arrivals per min</Table.Th>
                      <Table.Th ta="right">Counters</Table.Th><Table.Th>Shortest average wait</Table.Th><Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cmps.map((c) => (
                      <Table.Tr key={c.id}>
                        <Table.Td fw={600}>{c.id}</Table.Td>
                        <Table.Td c="var(--ink-2)">{dateTime(c.created_at)}</Table.Td>
                        <Table.Td ta="right">{c.replications}</Table.Td>
                        <Table.Td ta="right">{c.seed}</Table.Td>
                        <Table.Td ta="right">{c.arrival_rate}</Table.Td>
                        <Table.Td ta="right">{c.num_counters}, {c.num_express} express</Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Swatch colour={STRATEGY_COLOURS[c.best_strategy]} />
                            {label(c.best_strategy)}, {fmt(c.avg_wait[c.best_strategy], 3)} min
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <Button size="compact-xs" variant="light" onClick={() => onOpenComparison(c.id)}>Open</Button>
                            <DeleteButton onConfirm={() => remove(() => api.deleteComparison(c.id))} />
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Panel>
        </Stack>
      )}
    </>
  )
}
