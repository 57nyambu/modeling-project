import { Alert, Badge, Button, Group, List, NumberInput, Paper, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { api } from '../api'
import type { Validation } from '../api'
import { Section } from '../components/Common'
import { fmt } from '../format'

const LABELS = {
  rho: 'Utilisation (rho = lambda / mu)',
  wq: 'Average waiting time Wq = rho / (mu - lambda)',
  lq: 'Average queue length Lq = rho^2 / (1 - rho)',
}

export function ValidationPage() {
  const [lambda, setLambda] = useState(0.7)
  const [mu, setMu] = useState(1.0)
  const [data, setData] = useState<Validation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.validation(lambda, mu))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack gap="lg" maw={980}>
      <Section
        title="Model validation against queueing theory"
        description="Checks that the engine reproduces known analytic results before we trust its strategy comparisons."
      >
        <Paper withBorder radius="md" p="md">
          <Text size="sm">
            Customers still walk and shop exactly as in the full model. Because shopping is an infinite-server stage fed by
            a Poisson process, customers reach the checkout as a Poisson stream with the same rate lambda. With one counter
            and exponential service times (mean 1/mu) the checkout is an M/M/1 queue, whose results are known exactly.
          </Text>
          <List size="sm" mt="sm">
            <List.Item>10 independent replications of 20,000 simulated minutes each</List.Item>
            <List.Item>The engine passes if the theoretical value lies inside the 95% confidence interval</List.Item>
          </List>
          <Group mt="md" align="flex-end">
            <NumberInput label="Arrival rate lambda (per min)" value={lambda} min={0.1} max={4.9} step={0.1}
              decimalScale={2} onChange={(v) => setLambda(Number(v))} w={200} />
            <NumberInput label="Service rate mu (per min)" value={mu} min={0.2} max={5} step={0.1}
              decimalScale={2} onChange={(v) => setMu(Number(v))} w={200} />
            <Button onClick={run} loading={loading}>Run validation</Button>
          </Group>
          {loading && <Text size="xs" c="dimmed" mt="xs">This takes a few seconds.</Text>}
        </Paper>
      </Section>

      {error && <Alert color="red">{error}</Alert>}

      {data && (
        <Paper withBorder radius="md">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Measure</Table.Th>
                <Table.Th ta="right">Theory</Table.Th>
                <Table.Th ta="right">Simulated mean</Table.Th>
                <Table.Th ta="right">95% CI</Table.Th>
                <Table.Th ta="right">Relative error</Table.Th>
                <Table.Th>Result</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => {
                const m = data.measures[k]
                return (
                  <Table.Tr key={k}>
                    <Table.Td>{LABELS[k]}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{fmt(m.theory, 4)}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{fmt(m.simulated_mean, 4)}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{fmt(m.ci_low, 4)} to {fmt(m.ci_high, 4)}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{(m.relative_error * 100).toFixed(2)}%</Table.Td>
                    <Table.Td>
                      <Badge color={m.theory_inside_ci ? 'teal' : 'orange'} variant="light">
                        {m.theory_inside_ci ? 'Inside CI' : 'Outside CI'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" p="md">
            A value just outside the interval can happen 5% of the time by chance, and the store starts empty which slightly
            lowers early waiting times. Relative errors of a few percent confirm the engine. For reference, an M/M/2 queue
            with lambda = {fmt(data.mmc_reference.lambda, 2)} and mu = {fmt(data.mmc_reference.mu, 2)} has
            Wq = {fmt(data.mmc_reference.wq, 3)} min (Erlang C).
          </Text>
        </Paper>
      )}
    </Stack>
  )
}
