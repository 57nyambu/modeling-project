import { Badge, Button, Group, Switch, Table, Text, Tooltip } from '@mantine/core'
import { useEffect, useId, useMemo, useRef } from 'react'
import type { Trace, TraceCustomer } from '../api'
import { useWidth } from '../charts/core'
import { clock, fmt } from '../format'
import { activities, decision, journeySteps, statusAt } from '../sim/journey'
import type { ActivityKey, JourneyStep } from '../sim/journey'
import { drawLegendFigure } from '../sim/people'
import type { PersonStyle } from '../sim/people'
import { tokens } from '../theme'
import { IconChevron, IconClose } from './Icons'

const ACTIVITY: Record<ActivityKey, { label: string; colour: string }> = {
  walk: { label: 'Walking', colour: '#c4daf5' },
  shop: { label: 'Shopping', colour: '#7d8fa7' },
  wait: { label: 'Waiting', colour: 'hatch' },
  service: { label: 'Being served', colour: tokens.ink },
}

/** The customer's figure, drawn by the same code as the floor plan. */
export function FigureIcon({ cat, size = 28, serving = false }: { cat: TraceCustomer['cat']; size?: number; serving?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const width = cat === 'large' ? size * 1.15 : size * (serving ? 0.95 : 0.7)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(size * dpr)
    const opts: Partial<PersonStyle> = serving ? { serving: true } : {}
    drawLegendFigure(canvas, cat, opts)
  }, [cat, size, width, serving])
  return <canvas ref={ref} style={{ width, height: size, display: 'block' }} aria-hidden="true" />
}

function Swatch({ kind, patternId }: { kind: ActivityKey; patternId: string }) {
  const fill = ACTIVITY[kind].colour === 'hatch' ? `url(#${patternId})` : ACTIVITY[kind].colour
  return (
    <svg width={14} height={10} aria-hidden="true" style={{ flex: 'none' }}>
      <rect x={0.5} y={0.5} width={13} height={9} rx={2} fill={fill} stroke={kind === 'wait' ? tokens.ink3 : 'none'} />
    </svg>
  )
}

function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={5} height={5} fill="#ffffff" />
        <line x1={0} y1={0} x2={0} y2={5} stroke={tokens.ink2} strokeWidth={1.6} />
      </pattern>
    </defs>
  )
}

/** One bar from arrival to departure, split into walking, shopping, waiting and service. */
function JourneyBar({ customer, duration, time, labels, onSeek, patternId }: {
  customer: TraceCustomer; duration: number; time: number; labels: Record<string, string>
  onSeek: (t: number) => void; patternId: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const acts = useMemo(() => activities(customer, duration), [customer, duration])
  const start = customer.a
  const end = Math.max(start + 0.01, Math.min(customer.d ?? duration, duration))
  const h = 22
  const x = (t: number) => ((t - start) / (end - start)) * width
  const seekFrom = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect()
    onSeek(start + ((clientX - rect.left) / rect.width) * (end - start))
  }
  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 && (
        <svg
          width={width} height={h + 18} className="chart-svg" role="img" style={{ display: 'block', cursor: 'pointer' }}
          aria-label={`Time in the store from ${clock(start)} to ${clock(end)}: ${acts.map((a) => `${ACTIVITY[a.kind].label} ${fmt(a.end - a.start, 2)} min`).join(', ')}`}
          onClick={(e) => seekFrom(e.clientX, e.currentTarget)}
        >
          <Hatch id={patternId} />
          <rect x={0} y={0} width={width} height={h} rx={4} fill={tokens.surface2} />
          {acts.map((a, i) => {
            const x0 = x(a.start)
            const w = Math.max(1, x(a.end) - x0)
            const fill = ACTIVITY[a.kind].colour === 'hatch' ? `url(#${patternId})` : ACTIVITY[a.kind].colour
            const label = a.kind === 'shop' && a.section ? labels[a.section] : a.kind === 'service' ? 'Paying' : ''
            return (
              <g key={i}>
                <rect x={x0} y={0} width={w} height={h} fill={fill} stroke="#ffffff" strokeWidth={1}>
                  <title>{`${ACTIVITY[a.kind].label}${a.section ? ` in ${labels[a.section]}` : ''}: ${clock(a.start)} to ${clock(a.end)}, ${fmt(a.end - a.start, 2)} min`}</title>
                </rect>
                {label && w > label.length * 6.4 + 10 && (
                  <text x={x0 + 6} y={h / 2 + 4} fontSize={11} fill={a.kind === 'service' ? '#ffffff' : tokens.ink} pointerEvents="none">{label}</text>
                )}
              </g>
            )
          })}
          {time >= start && time <= end && (
            <g pointerEvents="none">
              <line x1={x(time)} x2={x(time)} y1={-1} y2={h + 3} stroke={tokens.ink} strokeWidth={2} />
              <circle cx={x(time)} cy={h + 3} r={3.5} fill={tokens.ink} stroke="#ffffff" strokeWidth={1.5} />
            </g>
          )}
          <text x={0} y={h + 15} fontSize={11} fill={tokens.ink3}>{clock(start)}</text>
          <text x={width} y={h + 15} fontSize={11} fill={tokens.ink3} textAnchor="end">
            {customer.d !== null ? clock(end) : `${clock(end)} (closing)`}
          </text>
        </svg>
      )}
    </div>
  )
}

function stepState(step: JourneyStep, t: number): 'done' | 'current' | 'next' {
  if (step.start === null || t < step.start) return 'next'
  if (step.end !== null && step.end > step.start && t < step.end) return 'current'
  if (step.end === null && step.kind !== 'leave') return 'current'
  return 'done'
}

function StepMarker({ step, state }: { step: JourneyStep; state: 'done' | 'current' | 'next' }) {
  const filled = state !== 'next'
  const r = step.stop ? 10 : 6
  return (
    <svg width={24} height={24} aria-hidden="true" style={{ flex: 'none', overflow: 'visible' }}>
      {state === 'current' && <circle cx={12} cy={12} r={r + 4} fill="rgba(37, 125, 224, 0.2)" />}
      {step.kind === 'checkout' ? (
        <path d="M12 5l7 7-7 7-7-7z" fill={filled ? tokens.series : '#ffffff'} stroke={filled ? tokens.series : tokens.lineStrong} strokeWidth={2} />
      ) : (
        <circle cx={12} cy={12} r={r} fill={filled ? tokens.series : '#ffffff'} stroke={filled ? tokens.series : tokens.lineStrong} strokeWidth={2} />
      )}
      {step.stop && (
        <text x={12} y={16} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={filled ? '#ffffff' : tokens.ink2}>{step.stop}</text>
      )}
    </svg>
  )
}

interface Props {
  trace: Trace
  customer: TraceCustomer
  time: number
  labels: Record<string, string>
  dimOthers: boolean
  onDimOthers: (v: boolean) => void
  onSeek: (t: number) => void
  onStep: (direction: -1 | 1) => void
  onClose: () => void
}

/** Everything about one traced customer: where they are now, their timeline and their checkout choice. */
export function JourneyPanel({ trace, customer: c, time, labels, dimOthers, onDimOthers, onSeek, onStep, onClose }: Props) {
  const patternId = `hatch-${useId().replace(/:/g, '')}`
  const steps = useMemo(() => journeySteps(c, labels), [c, labels])
  const acts = useMemo(() => activities(c, trace.duration), [c, trace.duration])
  const totals = useMemo(() => {
    const out: Record<ActivityKey, number> = { walk: 0, shop: 0, wait: 0, service: 0 }
    for (const a of acts) out[a.kind] += a.end - a.start
    return out
  }, [acts])
  const choice = useMemo(() => decision(trace, c), [trace, c])
  const first = trace.customers[0]?.id
  const lastId = trace.customers[trace.customers.length - 1]?.id
  const hasExpress = trace.counters.some((k) => k.type === 'express')
  const route = c.legs.map(([s]) => labels[s] ?? s).join(', ')

  return (
    <section className="panel journey" aria-label={`Journey of customer ${c.id}`}>
      <header className="journey-head">
        <Group gap={12} wrap="nowrap" miw={0}>
          <FigureIcon cat={c.cat} size={34} />
          <div style={{ minWidth: 0 }}>
            <Group gap={8} wrap="wrap">
              <Text fw={600} size="lg">Customer {c.id}</Text>
              <Badge variant="outline" color="gray">{c.items} {c.items === 1 ? 'item' : 'items'}, {c.cat} basket</Badge>
            </Group>
            <Text size="xs" c="var(--ink-2)">
              Arrived {clock(c.a)}. Walks at {fmt(c.v, 2)} m/s. Route: {route}.
            </Text>
          </div>
        </Group>
        <Group gap={8} wrap="wrap" justify="flex-end">
          <Button.Group>
            <Button size="xs" variant="default" leftSection={<IconChevron dir="left" size={14} />} disabled={c.id === first} onClick={() => onStep(-1)}>
              Previous
            </Button>
            <Button size="xs" variant="default" rightSection={<IconChevron size={14} />} disabled={c.id === lastId} onClick={() => onStep(1)}>
              Next
            </Button>
          </Button.Group>
          <Switch size="xs" label="Dim other customers" checked={dimOthers} onChange={(e) => onDimOthers(e.currentTarget.checked)} />
          <Tooltip label="Esc also stops tracing">
            <Button size="xs" variant="default" leftSection={<IconClose size={14} />} onClick={onClose}>Stop tracing</Button>
          </Tooltip>
        </Group>
      </header>

      <div className="journey-now">
        <Text size="xs" c="var(--ink-2)">At {clock(time)}</Text>
        <Text fw={600}>{statusAt(trace, c, time, labels)}</Text>
      </div>

      <div className="journey-body">
        <div>
          <Text size="xs" fw={600} c="var(--ink-2)" mb={6}>Time in the store</Text>
          <JourneyBar customer={c} duration={trace.duration} time={time} labels={labels} onSeek={onSeek} patternId={patternId} />
          <Group gap={14} mt={4} wrap="wrap">
            {(Object.keys(ACTIVITY) as ActivityKey[]).map((k) => (
              <Group key={k} gap={6} wrap="nowrap">
                <Swatch kind={k} patternId={patternId} />
                <Text size="xs" c="var(--ink-2)">
                  {ACTIVITY[k].label} <Text span size="xs" fw={600} c="var(--ink)" className="num">{fmt(totals[k], 2)} min</Text>
                </Text>
              </Group>
            ))}
          </Group>
        </div>

        <ol className="journey-steps">
          {steps.map((step) => {
            const state = stepState(step, time)
            const when = step.start === null ? 'Not reached'
              : step.end !== null && step.end > step.start ? `${clock(step.start)} to ${clock(step.end)}` : clock(step.start)
            return (
              <li key={step.key} className={`journey-step is-${state}`}>
                <button type="button" disabled={step.start === null} onClick={() => step.start !== null && onSeek(step.start)}
                  aria-label={`${step.title}, ${when}, ${step.detail}. Jump to this moment.`}>
                  <span className="journey-step-rail"><StepMarker step={step} state={state} /></span>
                  <Text size="sm" fw={600} lh={1.3}>{step.title}</Text>
                  <Text size="xs" c="var(--ink-2)" className="num">{when}</Text>
                  <Text size="xs" c="var(--ink-2)">{step.detail}</Text>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {choice && (
        <div className="journey-choice">
          <div>
            <Text size="sm" fw={600}>How counter {c.c! + 1} was chosen</Text>
            <Text size="xs" c="var(--ink-2)" mt={4}>{choice.rule}</Text>
            <Text size="sm" mt={8}>{choice.reason}</Text>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table fz="xs" verticalSpacing={4} withRowBorders={false} highlightOnHover={false} className="journey-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Counter</Table.Th>
                  {hasExpress && <Table.Th>Type</Table.Th>}
                  <Table.Th ta="right">People there</Table.Th>
                  <Table.Th ta="right">Estimated wait</Table.Th>
                  <Table.Th><span className="visually-hidden">Choice</span></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {choice.rows.map((r) => (
                  <Table.Tr key={r.counter} className={r.chosen ? 'is-chosen' : r.eligible ? '' : 'is-excluded'}>
                    <Table.Td fw={r.chosen ? 600 : 400}>{r.counter}</Table.Td>
                    {hasExpress && <Table.Td>{r.type === 'express' ? 'Express' : 'Normal'}</Table.Td>}
                    <Table.Td ta="right">{r.people}</Table.Td>
                    <Table.Td ta="right">{fmt(r.estimate, 2)} min</Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      {r.chosen ? <Badge size="sm" variant="filled" color="ink" style={{ overflow: 'visible' }}>Chosen</Badge>
                        : r.eligible ? null : <Text size="xs" c="var(--ink-3)">Not allowed</Text>}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </div>
      )}
      {!choice && c.co === null && (
        <Text size="xs" c="var(--ink-2)" className="journey-choice">This customer had not reached the checkouts when the store closed, so no counter was chosen.</Text>
      )}
    </section>
  )
}
