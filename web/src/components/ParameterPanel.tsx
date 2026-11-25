import { Accordion, Button, Group, NumberInput, Paper, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import type { Meta, Params } from '../api'

interface Props {
  meta: Meta
  params: Params
  onChange: (p: Params) => void
  children?: ReactNode // strategy selector, replications, action buttons
}

const GROUPS = ['Run', 'Arrivals', 'Checkout', 'Baskets', 'Shopping']

export function ParameterPanel({ meta, params, onChange, children }: Props) {
  const set = (key: string, value: number | string) => {
    const n = typeof value === 'number' ? value : parseFloat(value)
    if (Number.isNaN(n)) return
    onChange({ ...params, [key]: n })
  }
  const weights = (params.section_weights ?? meta.defaults.section_weights) as Record<string, number>
  const setWeight = (key: string, value: number | string) => {
    const n = typeof value === 'number' ? value : parseFloat(value)
    if (Number.isNaN(n)) return
    onChange({ ...params, section_weights: { ...weights, [key]: n } })
  }
  const basketSum = Number(params.p_small) + Number(params.p_medium) + Number(params.p_large)

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        {children}
        <Accordion multiple defaultValue={['Run', 'Arrivals', 'Checkout']} variant="separated" radius="sm">
          {GROUPS.map((group) => (
            <Accordion.Item key={group} value={group}>
              <Accordion.Control>
                <Text size="sm" fw={600}>{group}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {meta.parameters
                    .filter((p) => p.group === group)
                    .map((p) => (
                      <NumberInput
                        key={p.key}
                        size="xs"
                        label={p.unit ? `${p.label} (${p.unit})` : p.label}
                        description={p.help}
                        value={params[p.key] as number}
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        decimalScale={p.step < 1 ? 3 : 0}
                        onChange={(v) => set(p.key, v)}
                      />
                    ))}
                  {group === 'Baskets' && Math.abs(basketSum - 1) > 1e-6 && (
                    <Text size="xs" c="red">Basket probabilities must add up to 1 (currently {basketSum.toFixed(2)}).</Text>
                  )}
                  {group === 'Shopping' &&
                    Object.entries(meta.sections).map(([key, label]) => (
                      <NumberInput
                        key={key}
                        size="xs"
                        label={`${label} item share`}
                        description="Relative weight of items picked here"
                        value={weights[key]}
                        min={0}
                        max={1}
                        step={0.05}
                        decimalScale={2}
                        onChange={(v) => setWeight(key, v)}
                      />
                    ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
        <Group justify="flex-end">
          <Button variant="subtle" size="xs" onClick={() => onChange({ ...meta.defaults })}>
            Restore defaults
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
