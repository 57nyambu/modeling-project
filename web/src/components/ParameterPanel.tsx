import { Collapse, Group, NumberInput, SegmentedControl, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Meta, ParamSpec, Params, StrategyKey } from '../api'
import { STRATEGY_COLOURS, fmt, int } from '../format'
import { SECTION_KEYS, loadCheck, loadLevel, weights } from '../model'
import type { LoadLevel } from '../model'
import { tokens } from '../theme'
import { IconChevron } from './Icons'

interface Props {
  meta: Meta
  params: Params
  onChange: (p: Params) => void
  errors: Record<string, string>
  strategy?: StrategyKey
  onStrategy?: (s: StrategyKey) => void
  /** Strategy used for the load check when there is no strategy picker (comparison page). */
  loadStrategy?: StrategyKey | null
  children?: ReactNode // primary action
}

const STRATEGY_HINTS: Record<StrategyKey, string> = {
  shortest_queue: 'Join the counter with the fewest customers',
  shortest_wait: 'Join the counter predicted to serve you soonest',
  express: 'Baskets of 5 or fewer items use express counters',
}

type Raw = number | string

function toValue(v: Raw): Raw {
  return typeof v === 'number' ? v : v.trim() === '' ? '' : Number.isNaN(Number(v)) ? v : Number(v)
}

function Field({ spec, value, error, onChange, width = 92 }: {
  spec: ParamSpec
  value: Raw | undefined
  error?: string
  onChange: (v: Raw) => void
  width?: number
}) {
  return (
    <div>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Tooltip label={spec.help} position="top-start">
          <Text size="sm" c="var(--ink-2)" style={{ cursor: 'help' }} component="label" htmlFor={`p-${spec.key}`}>
            {spec.label}
          </Text>
        </Tooltip>
        <NumberInput
          id={`p-${spec.key}`}
          w={width}
          value={value === undefined ? '' : (value as number | string)}
          onChange={(v) => onChange(toValue(v))}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          decimalScale={spec.step < 1 ? 3 : 0}
          clampBehavior="none"
          error={!!error}
          rightSection={spec.unit && spec.unit !== 'share' ? <Text size="xs" c="var(--ink-3)">{spec.unit}</Text> : null}
          rightSectionWidth={spec.unit === 'items' ? 40 : 34}
          rightSectionPointerEvents="none"
          aria-describedby={error ? `e-${spec.key}` : undefined}
        />
      </Group>
      {error && <Text id={`e-${spec.key}`} size="xs" c={tokens.criticalText} ta="right" mt={2}>{error}</Text>}
    </div>
  )
}

/** Several small inputs on one row, each with a caption underneath. */
function MultiField({ label, help, items, error }: {
  label: string
  help: string
  items: { caption: string; value: Raw | undefined; onChange: (v: Raw) => void; step: number; invalid?: boolean }[]
  error?: string
}) {
  return (
    <div>
      <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
        <Tooltip label={help} position="top-start">
          <Text size="sm" c="var(--ink-2)" pt={4} style={{ cursor: 'help' }}>{label}</Text>
        </Tooltip>
        <Group gap={6} wrap="nowrap">
          {items.map((it) => (
            <Stack key={it.caption} gap={1} align="center">
              <NumberInput
                w={54}
                value={it.value === undefined ? '' : (it.value as number | string)}
                onChange={(v) => it.onChange(toValue(v))}
                step={it.step}
                decimalScale={3}
                clampBehavior="none"
                error={!!it.invalid || !!error}
                aria-label={`${label}: ${it.caption}`}
                styles={{ input: { textAlign: 'center', paddingInline: 4 } }}
              />
              <Text size="10px" c="var(--ink-3)">{it.caption}</Text>
            </Stack>
          ))}
        </Group>
      </Group>
      {error && <Text size="xs" c={tokens.criticalText} ta="right" mt={2}>{error}</Text>}
    </div>
  )
}

function Group_({ title, open, onToggle, children }: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div style={{ borderTop: `1px solid ${tokens.line}` }}>
      <UnstyledButton onClick={onToggle} w="100%" py={10} aria-expanded={open}>
        <Group justify="space-between">
          <Text size="sm" fw={600}>{title}</Text>
          <span style={{ color: tokens.ink3, display: 'inline-flex', transform: open ? 'rotate(90deg)' : undefined }}>
            <IconChevron size={14} />
          </span>
        </Group>
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap={10} pb={14}>{children}</Stack>
      </Collapse>
    </div>
  )
}

const LEVEL_TEXT: Record<LoadLevel, string> = {
  good: 'Comfortable',
  warning: 'Busy: expect queues to build',
  critical: 'Overloaded: queues grow without limit',
}
const LEVEL_COLOUR: Record<LoadLevel, string> = { good: tokens.good, warning: tokens.warning, critical: tokens.critical }
const LEVEL_TRACK: Record<LoadLevel, string> = { good: '#d6f2db', warning: '#fdecc4', critical: '#f8d4d4' }

function LoadMeter({ label, value }: { label: string; value: number }) {
  if (!Number.isFinite(value)) return null
  const level = loadLevel(value)
  return (
    <div>
      <Group justify="space-between" gap={6}>
        <Text size="sm" c="var(--ink-2)">{label}</Text>
        <Text size="sm" fw={600} className="num">{Math.round(value * 100)}%</Text>
      </Group>
      <div style={{ height: 6, borderRadius: 6, background: LEVEL_TRACK[level], marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, value * 100)}%`, height: '100%', borderRadius: 6, background: LEVEL_COLOUR[level] }} />
      </div>
      <Text size="xs" mt={3} c={level === 'good' ? tokens.goodText : level === 'warning' ? tokens.warningText : tokens.criticalText}>
        {LEVEL_TEXT[level]}
      </Text>
    </div>
  )
}

export function ParameterPanel({ meta, params, onChange, errors, strategy, onStrategy, loadStrategy, children }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    Run: true, Arrivals: true, Checkout: true, Baskets: false, Shopping: false, Load: true,
  })
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))
  const spec = (key: string) => meta.parameters.find((p) => p.key === key)!
  const set = (key: string) => (v: Raw) => onChange({ ...params, [key]: v })
  const field = (key: string) => (
    <Field spec={spec(key)} value={params[key] as Raw} error={errors[key]} onChange={set(key)} />
  )
  const w = weights(params)
  const peak = params.arrival_profile === 'peak'
  const hasErrors = Object.keys(errors).length > 0
  const load = hasErrors ? null : loadCheck(params, strategy ?? loadStrategy ?? null)

  return (
    <div className="panel" style={{ padding: '14px 16px 16px' }}>
      <Stack gap={12}>
        {strategy && onStrategy && (
          <div role="radiogroup" aria-label="Checkout strategy">
            <Text size="sm" fw={600} mb={8}>Checkout strategy</Text>
            <Stack gap={6}>
              {meta.strategies.map((s) => {
                const selected = s.key === strategy
                return (
                  <UnstyledButton
                    key={s.key}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onStrategy(s.key)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: `1px solid ${selected ? tokens.ink : tokens.line}`,
                      background: selected ? '#f4f6f9' : '#ffffff',
                      boxShadow: selected ? `inset 0 0 0 1px ${tokens.ink}` : undefined,
                    }}
                  >
                    <Group gap={10} wrap="nowrap" align="flex-start">
                      <span style={{ marginTop: 5, width: 10, height: 10, borderRadius: 2, flex: 'none', background: STRATEGY_COLOURS[s.key] }} />
                      <div>
                        <Text size="sm" fw={600} lh={1.3}>{s.label}</Text>
                        <Text size="xs" c="var(--ink-2)" lh={1.35}>{STRATEGY_HINTS[s.key]}</Text>
                      </div>
                    </Group>
                  </UnstyledButton>
                )
              })}
            </Stack>
          </div>
        )}

        <div>
          <Group_ title="Run" open={open.Run} onToggle={() => toggle('Run')}>
            {field('duration')}
            {field('seed')}
          </Group_>

          <Group_ title="Arrivals" open={open.Arrivals} onToggle={() => toggle('Arrivals')}>
            <Group justify="space-between" wrap="nowrap">
              <Tooltip label="Constant: the same average rate all day. Peak: fewer customers at opening and closing, more in the middle." position="top-start">
                <Text size="sm" c="var(--ink-2)" style={{ cursor: 'help' }}>Arrival pattern</Text>
              </Tooltip>
              <SegmentedControl
                value={String(params.arrival_profile ?? 'constant')}
                onChange={(v) => onChange({ ...params, arrival_profile: v })}
                data={[{ value: 'constant', label: 'Constant' }, { value: 'peak', label: 'Midday peak' }]}
              />
            </Group>
            {field('arrival_rate')}
            {peak && field('peak_amplitude')}
          </Group_>

          <Group_ title="Checkout" open={open.Checkout} onToggle={() => toggle('Checkout')}>
            {field('num_counters')}
            {field('num_express')}
            {field('scan_time_per_item')}
            <MultiField
              label="Payment time (min)"
              help="Triangular distribution: shortest, most likely and longest time to pay."
              error={errors.payment}
              items={[
                { caption: 'shortest', value: params.payment_min as Raw, onChange: set('payment_min'), step: 0.1, invalid: !!errors.payment_min },
                { caption: 'likely', value: params.payment_mode as Raw, onChange: set('payment_mode'), step: 0.1, invalid: !!errors.payment_mode },
                { caption: 'longest', value: params.payment_max as Raw, onChange: set('payment_max'), step: 0.1, invalid: !!errors.payment_max },
              ]}
            />
          </Group_>

          <Group_ title="Baskets" open={open.Baskets} onToggle={() => toggle('Baskets')}>
            <MultiField
              label="Basket mix"
              help="Share of customers with small (1 to 5), medium (6 to 15) and large (16 or more) baskets. Must add up to 1."
              error={errors.baskets}
              items={[
                { caption: 'small', value: params.p_small as Raw, onChange: set('p_small'), step: 0.05, invalid: !!errors.p_small },
                { caption: 'medium', value: params.p_medium as Raw, onChange: set('p_medium'), step: 0.05, invalid: !!errors.p_medium },
                { caption: 'large', value: params.p_large as Raw, onChange: set('p_large'), step: 0.05, invalid: !!errors.p_large },
              ]}
            />
            {field('large_max_items')}
          </Group_>

          <Group_ title="Shopping" open={open.Shopping} onToggle={() => toggle('Shopping')}>
            {field('mean_pick_time')}
            <MultiField
              label="Walking speed (m/s)"
              help="Each customer gets a walking speed drawn uniformly between these two values."
              error={errors.walk}
              items={[
                { caption: 'slowest', value: params.walk_speed_min as Raw, onChange: set('walk_speed_min'), step: 0.1, invalid: !!errors.walk_speed_min },
                { caption: 'fastest', value: params.walk_speed_max as Raw, onChange: set('walk_speed_max'), step: 0.1, invalid: !!errors.walk_speed_max },
              ]}
            />
            <MultiField
              label="Item share by section"
              help="Relative weight of each section when items are placed in a basket. Customers only visit sections they buy from."
              error={errors.sections}
              items={SECTION_KEYS.map((k) => ({
                caption: meta.sections[k].split(' ')[0].toLowerCase(),
                value: w[k] as Raw,
                onChange: (v: Raw) => onChange({ ...params, section_weights: { ...w, [k]: v as number } }),
                step: 0.05,
              }))}
            />
          </Group_>

          <Group_ title="Load check" open={open.Load} onToggle={() => toggle('Load')}>
            {load ? (
              <>
                <Stack gap={4}>
                  {[
                    ['Expected customers', int(load.expectedCustomers)],
                    ['Average basket', `${fmt(load.meanItems, 1)} items`],
                    ['Average service time', `${fmt(load.meanService, 2)} min`],
                  ].map(([k, v]) => (
                    <Group key={k} justify="space-between">
                      <Text size="sm" c="var(--ink-2)">{k}</Text>
                      <Text size="sm" fw={600} className="num">{v}</Text>
                    </Group>
                  ))}
                </Stack>
                <LoadMeter label={peak ? 'Cashier load, average' : 'Cashier load'} value={load.load} />
                {peak && <LoadMeter label="Cashier load at the peak" value={load.peakLoad} />}
                {load.express && load.normal && (
                  <>
                    <LoadMeter label={`Express counters (${load.express.counters})`} value={peak ? load.express.peakLoad : load.express.load} />
                    <LoadMeter label={`Normal counters (${load.normal.counters})`} value={peak ? load.normal.peakLoad : load.normal.load} />
                  </>
                )}
                <Text size="xs" c="var(--ink-3)">
                  Load = arrival rate x average service time / counters. At 100% or more the cashiers cannot keep up.
                </Text>
              </>
            ) : (
              <Text size="sm" c="var(--ink-2)">Fix the highlighted values to see the expected load.</Text>
            )}
          </Group_>
        </div>

        {children}
        <UnstyledButton onClick={() => onChange({ ...meta.defaults })} style={{ alignSelf: 'center' }}>
          <Text size="xs" c="var(--ink-2)" td="underline">Restore default parameters</Text>
        </UnstyledButton>
      </Stack>
    </div>
  )
}
