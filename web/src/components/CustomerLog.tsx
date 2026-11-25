import { Button, Group, Pagination, Select, Table, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import type { BasketKey, Trace, TraceCustomer } from '../api'
import { BASKET_COLOURS, capitalise, fmt } from '../format'
import { IconRoute } from './Icons'

type State = 'served' | 'in_service' | 'waiting' | 'shopping'

function stateOf(c: TraceCustomer): State {
  if (c.d !== null) return 'served'
  if (c.ss !== null) return 'in_service'
  if (c.co !== null) return 'waiting'
  return 'shopping'
}

const STATE_LABEL: Record<State, string> = {
  served: 'Served',
  in_service: 'Being served at closing',
  waiting: 'Waiting at closing',
  shopping: 'Shopping at closing',
}

const PAGE = 25
const t = (v: number | null) => (v === null ? '-' : fmt(v, 2))

interface Props {
  trace: Trace
  sectionLabels: Record<string, string>
  tracedId?: number | null
  onTrace?: (id: number) => void
}

/** Every customer's timeline, straight from the engine's event times. */
export function CustomerLog({ trace, sectionLabels, tracedId = null, onTrace }: Props) {
  const [basket, setBasket] = useState('all')
  const [state, setState] = useState('all')
  const [counter, setCounter] = useState('all')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => trace.customers.filter((c) =>
    (basket === 'all' || c.cat === basket) &&
    (state === 'all' || stateOf(c) === state) &&
    (counter === 'all' || (c.c !== null && c.c + 1 === Number(counter)))), [trace, basket, state, counter])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE)
  const reset = (fn: (v: string) => void) => (v: string | null) => { fn(v ?? 'all'); setPage(1) }

  return (
    <div className="panel">
      <Group justify="space-between" p="sm" gap="sm" wrap="wrap" style={{ borderBottom: '1px solid var(--line)' }}>
        <Group gap="xs" wrap="wrap">
          <Select w={150} value={basket} onChange={reset(setBasket)} aria-label="Basket size"
            data={[{ value: 'all', label: 'All baskets' }, ...(['small', 'medium', 'large'] as BasketKey[]).map((k) => ({ value: k, label: `${capitalise(k)} baskets` }))]} />
          <Select w={200} value={state} onChange={reset(setState)} aria-label="State at closing"
            data={[{ value: 'all', label: 'Any outcome' }, ...(Object.keys(STATE_LABEL) as State[]).map((k) => ({ value: k, label: STATE_LABEL[k] }))]} />
          <Select w={140} value={counter} onChange={reset(setCounter)} aria-label="Counter"
            data={[{ value: 'all', label: 'All counters' }, ...trace.counters.map((c) => ({ value: String(c.index + 1), label: `Counter ${c.index + 1}` }))]} />
        </Group>
        <Text size="xs" c="var(--ink-2)">
          {rows.length.toLocaleString('en-GB')} customers. Times in minutes after opening. Route: G Grocery, B Beverages, H Household, P Personal Care.
        </Text>
      </Group>
      <div style={{ overflowX: 'auto' }}>
        <Table fz="xs" verticalSpacing={5} striped stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Basket</Table.Th>
              <Table.Th>Route</Table.Th>
              <Table.Th ta="right">Arrived</Table.Th>
              <Table.Th ta="right">At checkout</Table.Th>
              <Table.Th ta="right">Counter</Table.Th>
              <Table.Th ta="right">Wait</Table.Th>
              <Table.Th ta="right">Service</Table.Th>
              <Table.Th ta="right">Left</Table.Th>
              <Table.Th ta="right">In store</Table.Th>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Outcome</Table.Th>
              {onTrace && <Table.Th><span className="visually-hidden">Trace</span></Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shown.map((c) => (
              <Table.Tr key={c.id} style={c.id === tracedId ? { background: '#e8f1fc' } : undefined}>
                <Table.Td>{c.id}</Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  <Group gap={6} wrap="nowrap">
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: BASKET_COLOURS[c.cat] }} />
                    {c.items} {c.items === 1 ? 'item' : 'items'}
                  </Group>
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }} title={c.legs.map(([s]) => sectionLabels[s]).join(', ')}>
                  {c.legs.map(([s]) => s.charAt(0).toUpperCase()).join(' ')}
                </Table.Td>
                <Table.Td ta="right">{t(c.a)}</Table.Td>
                <Table.Td ta="right">{t(c.co)}</Table.Td>
                <Table.Td ta="right">{c.c === null ? '-' : c.c + 1}</Table.Td>
                <Table.Td ta="right">{c.ss !== null && c.co !== null ? fmt(c.ss - c.co, 2) : '-'}</Table.Td>
                <Table.Td ta="right">{c.d !== null && c.ss !== null ? fmt(c.d - c.ss, 2) : '-'}</Table.Td>
                <Table.Td ta="right">{t(c.d)}</Table.Td>
                <Table.Td ta="right">{c.d !== null ? fmt(c.d - c.a, 2) : '-'}</Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>{STATE_LABEL[stateOf(c)]}</Table.Td>
                {onTrace && (
                  <Table.Td py={2}>
                    <Button size="compact-xs" variant="subtle" color="ink" leftSection={<IconRoute size={13} />}
                      onClick={() => onTrace(c.id)} aria-label={`Trace customer ${c.id} on the floor plan`}>
                      {c.id === tracedId ? 'Tracing' : 'Trace'}
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      {pages > 1 && (
        <Group justify="center" p="sm" style={{ borderTop: '1px solid var(--line)' }}>
          <Pagination total={pages} value={Math.min(page, pages)} onChange={setPage} size="sm" siblings={1} />
        </Group>
      )}
    </div>
  )
}
