import { Alert, Button, Group, Loader, Paper, Stack, Table, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { ComparisonSummary, Meta, RunSummary } from '../api'
import { Section } from '../components/Common'
import { dateTime, fmt, pct } from '../format'

interface Props {
  meta: Meta
  onOpenRun: (id: number) => void
  onOpenComparison: (id: number) => void
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

  if (error) return <Alert color="red">{error}</Alert>
  if (!runs || !cmps) return <Group justify="center" p="xl"><Loader /></Group>

  return (
    <Stack gap="xl">
      <Section title="Saved simulation runs" description="Stored in SQLite. Opening a run restores its animation and results.">
        <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
          {runs.length === 0 ? <Text p="md" c="dimmed" size="sm">No runs yet.</Text> : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th><Table.Th>Created</Table.Th><Table.Th>Strategy</Table.Th>
                  <Table.Th ta="right">Seed</Table.Th><Table.Th ta="right">Duration</Table.Th>
                  <Table.Th ta="right">Arrival rate</Table.Th><Table.Th ta="right">Counters</Table.Th>
                  <Table.Th ta="right">Served</Table.Th><Table.Th ta="right">Avg wait</Table.Th>
                  <Table.Th ta="right">Utilisation</Table.Th><Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {runs.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>{r.id}</Table.Td>
                    <Table.Td>{dateTime(r.created_at)}</Table.Td>
                    <Table.Td>{r.strategy_label}</Table.Td>
                    <Table.Td ta="right">{r.seed}</Table.Td>
                    <Table.Td ta="right">{r.duration} min</Table.Td>
                    <Table.Td ta="right">{r.arrival_rate}/min</Table.Td>
                    <Table.Td ta="right">{r.num_counters}</Table.Td>
                    <Table.Td ta="right">{r.customers_served} / {r.customers_generated}</Table.Td>
                    <Table.Td ta="right">{fmt(r.avg_wait, 3)} min</Table.Td>
                    <Table.Td ta="right">{pct(r.utilisation)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Button size="compact-xs" variant="light" onClick={() => onOpenRun(r.id)}>Open</Button>
                        <Button size="compact-xs" variant="subtle" color="red" onClick={() => remove(() => api.deleteRun(r.id))}>Delete</Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Section>

      <Section title="Saved strategy comparisons">
        <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
          {cmps.length === 0 ? <Text p="md" c="dimmed" size="sm">No comparisons yet.</Text> : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th><Table.Th>Created</Table.Th><Table.Th ta="right">Replications</Table.Th>
                  <Table.Th ta="right">Seed</Table.Th><Table.Th ta="right">Arrival rate</Table.Th>
                  <Table.Th ta="right">Counters</Table.Th><Table.Th>Lowest average wait</Table.Th><Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cmps.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>{c.id}</Table.Td>
                    <Table.Td>{dateTime(c.created_at)}</Table.Td>
                    <Table.Td ta="right">{c.replications}</Table.Td>
                    <Table.Td ta="right">{c.seed}</Table.Td>
                    <Table.Td ta="right">{c.arrival_rate}/min</Table.Td>
                    <Table.Td ta="right">{c.num_counters} ({c.num_express} express)</Table.Td>
                    <Table.Td>{label(c.best_strategy)} ({fmt(c.avg_wait[c.best_strategy], 3)} min)</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Button size="compact-xs" variant="light" onClick={() => onOpenComparison(c.id)}>Open</Button>
                        <Button size="compact-xs" variant="subtle" color="red" onClick={() => remove(() => api.deleteComparison(c.id))}>Delete</Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Section>
    </Stack>
  )
}
