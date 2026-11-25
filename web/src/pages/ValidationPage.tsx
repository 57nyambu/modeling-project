import { Alert, Anchor, Badge, Button, Group, NumberInput, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { api } from '../api'
import type { Validation } from '../api'
import { linear, ticks, useWidth } from '../charts/core'
import { ChartCard } from '../charts/ChartCard'
import { PageHeader, Panel } from '../components/Page'
import { fmt } from '../format'
import { tokens } from '../theme'

const LABELS = {
  rho: { name: 'Utilisation', formula: 'rho = lambda / mu' },
  wq: { name: 'Average waiting time', formula: 'Wq = rho / (mu - lambda)' },
  lq: { name: 'Average queue length', formula: 'Lq = rho^2 / (1 - rho)' },
} as const
type Key = keyof typeof LABELS
const KEYS: Key[] = ['rho', 'wq', 'lq']

/** Every measure on one axis: the percentage difference from theory, with the 95% CI. */
function DeviationPlot({ data }: { data: Validation }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const rows = KEYS.map((k) => {
    const m = data.measures[k]
    const rel = (v: number) => ((v - m.theory) / m.theory) * 100
    return { k, mean: rel(m.simulated_mean), lo: rel(m.ci_low), hi: rel(m.ci_high), ok: m.theory_inside_ci }
  })
  const span = Math.max(2, ...rows.flatMap((r) => [Math.abs(r.lo), Math.abs(r.hi)])) * 1.15
  const m = { left: 170, right: 24, top: 8, bottom: 28 }
  const band = 40
  const height = m.top + rows.length * band + m.bottom
  const x = linear(-span, span, m.left, Math.max(m.left + 10, width - m.right))
  const tv = ticks(span, 3).flatMap((v) => (v === 0 ? [0] : [-v, v])).sort((a, b) => a - b)
  return (
    <div ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} className="chart-svg" role="img" aria-label="Difference between simulation and theory with 95% confidence intervals">
          {tv.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={m.top} y2={height - m.bottom} stroke={v === 0 ? tokens.ink : tokens.grid} strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={x(v)} y={height - m.bottom + 16} textAnchor="middle" fontSize={11} fill={tokens.ink2}>{v > 0 ? `+${v}` : v}%</text>
            </g>
          ))}
          <text x={x(0) + 6} y={m.top + 4} fontSize={11} fill={tokens.ink} dy="0.6em">Theory</text>
          {rows.map((r, i) => {
            const cy = m.top + i * band + band / 2 + 6
            return (
              <g key={r.k}>
                <text x={m.left - 12} y={cy} dy="0.32em" textAnchor="end" fontSize={12} fill={tokens.ink}>{LABELS[r.k].name}</text>
                <line x1={x(r.lo)} x2={x(r.hi)} y1={cy} y2={cy} stroke={tokens.series} strokeWidth={2} />
                <line x1={x(r.lo)} x2={x(r.lo)} y1={cy - 6} y2={cy + 6} stroke={tokens.series} strokeWidth={2} />
                <line x1={x(r.hi)} x2={x(r.hi)} y1={cy - 6} y2={cy + 6} stroke={tokens.series} strokeWidth={2} />
                <circle cx={x(r.mean)} cy={cy} r={5} fill={tokens.series} stroke="#ffffff" strokeWidth={2} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export function ValidationPage({ onOpenDiagram }: { onOpenDiagram: (id: string) => void }) {
  const [lambda, setLambda] = useState<number | string>(0.7)
  const [mu, setMu] = useState<number | string>(1.0)
  const [data, setData] = useState<Validation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = typeof lambda === 'number' && typeof mu === 'number' && lambda > 0 && lambda < mu && mu <= 5

  const run = async () => {
    if (!valid) return
    setLoading(true)
    setError(null)
    try {
      setData(await api.validation(lambda as number, mu as number))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Validation"
        description="Before trusting the strategy comparison, check that the engine reproduces a queue whose answer is known exactly from queueing theory."
      />
      <Stack gap={20} maw={1060}>
        <Panel title="How the check works">
          <Stack gap={10}>
            <Text size="sm" maw={820}>
              Customers still walk and shop exactly as in the full model. Shopping takes place in sections with unlimited
              room, and a Poisson stream passing through such a stage leaves it as a Poisson stream with the same rate. With
              one counter and exponential service times the checkout is therefore an M/M/1 queue, and its utilisation,
              average wait and average queue length have exact formulas.
            </Text>
            <Text size="sm" maw={820}>
              The engine runs 10 independent replications of 20,000 simulated minutes. It passes when the theoretical
              value lies inside the 95% confidence interval of the simulated mean.{' '}
              <Anchor component="button" type="button" size="sm" underline="always" c="var(--ink)" onClick={() => onOpenDiagram('validation')}>See the validation diagram</Anchor>
            </Text>
            <Group align="flex-end" gap="sm" mt={4}>
              <NumberInput label="Arrival rate lambda (per min)" value={lambda} onChange={setLambda} min={0.1} max={4.9} step={0.1}
                decimalScale={2} w={190} size="sm" hideControls={false} />
              <NumberInput label="Service rate mu (per min)" value={mu} onChange={setMu} min={0.2} max={5} step={0.1}
                decimalScale={2} w={190} size="sm" hideControls={false} />
              <Button onClick={run} loading={loading} disabled={!valid}>Run validation</Button>
            </Group>
            {!valid && <Text size="xs" c={tokens.criticalText}>The queue must be stable: choose lambda below mu, and mu at most 5.</Text>}
            {loading && <Text size="xs" c="var(--ink-2)">Simulating 200,000 minutes takes a few seconds.</Text>}
          </Stack>
        </Panel>

        {error && <Alert color="red" variant="light" title="Validation did not run">{error}</Alert>}

        {data && (
          <>
            <ChartCard
              title="Simulation against theory"
              subtitle={`lambda = ${fmt(data.lambda, 2)}, mu = ${fmt(data.mu, 2)}. Dots are simulated means, whiskers their 95% confidence intervals, the dark line is the exact theoretical value.`}
              table={{
                columns: ['Measure', 'Theory', 'Simulated mean', '95% CI', 'Relative error', 'Theory inside CI'],
                rows: KEYS.map((k) => {
                  const m = data.measures[k]
                  return [LABELS[k].name, fmt(m.theory, 4), fmt(m.simulated_mean, 4), `${fmt(m.ci_low, 4)} to ${fmt(m.ci_high, 4)}`,
                    `${(m.relative_error * 100).toFixed(2)}%`, m.theory_inside_ci ? 'Yes' : 'No']
                }),
              }}
            >
              <DeviationPlot data={data} />
            </ChartCard>
            <Panel title="Results" padded={false}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Measure</Table.Th>
                    <Table.Th>Formula</Table.Th>
                    <Table.Th ta="right">Theory</Table.Th>
                    <Table.Th ta="right">Simulated mean</Table.Th>
                    <Table.Th ta="right">95% CI</Table.Th>
                    <Table.Th ta="right">Relative error</Table.Th>
                    <Table.Th>Result</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {KEYS.map((k) => {
                    const m = data.measures[k]
                    return (
                      <Table.Tr key={k}>
                        <Table.Td>{LABELS[k].name}</Table.Td>
                        <Table.Td><Text span ff="monospace" size="xs">{LABELS[k].formula}</Text></Table.Td>
                        <Table.Td ta="right">{fmt(m.theory, 4)}</Table.Td>
                        <Table.Td ta="right">{fmt(m.simulated_mean, 4)}</Table.Td>
                        <Table.Td ta="right">{fmt(m.ci_low, 4)} to {fmt(m.ci_high, 4)}</Table.Td>
                        <Table.Td ta="right">{(m.relative_error * 100).toFixed(2)}%</Table.Td>
                        <Table.Td>
                          <Badge color={m.theory_inside_ci ? 'green' : 'orange'}>
                            {m.theory_inside_ci ? 'Theory inside CI' : 'Theory outside CI'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
              <Text size="xs" c="var(--ink-2)" p="md" maw={860}>
                A value just outside the interval happens about 5% of the time by chance. Each replication also starts with
                an empty store, which slightly lowers early waiting times. For reference, an M/M/2 queue with
                lambda = {fmt(data.mmc_reference.lambda, 2)} and mu = {fmt(data.mmc_reference.mu, 2)} has
                Wq = {fmt(data.mmc_reference.wq, 3)} min by the Erlang C formula.
              </Text>
            </Panel>
          </>
        )}
      </Stack>
    </>
  )
}
