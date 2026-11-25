import { Anchor, Group, SegmentedControl, Table, Text, Title } from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { IconDownload } from '../components/Icons'

export interface TableData {
  columns: string[]
  rows: (string | number)[][]
  /** Columns (by index) aligned right; defaults to every column except the first. */
  numeric?: number[]
}

/**
 * Chart container: title, subtitle, the chart, a table view of the same data
 * (the accessible twin of the chart) and an optional report-ready PNG.
 */
export function ChartCard({ title, subtitle, children, table, pngHref, footer }: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  table?: TableData
  pngHref?: string
  footer?: ReactNode
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const numeric = table?.numeric ?? table?.columns.map((_, i) => i).filter((i) => i > 0) ?? []
  return (
    <figure className="panel" style={{ margin: 0, padding: '14px 16px 12px', minWidth: 0 }}>
      <Group justify="space-between" align="flex-start" gap="sm" mb={10} wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Title order={3} fz={14}>{title}</Title>
          {subtitle && <Text size="xs" c="var(--ink-2)" mt={2}>{subtitle}</Text>}
        </div>
        <Group gap={8} wrap="nowrap">
          {pngHref && (
            <Anchor href={pngHref} target="_blank" size="xs" c="var(--ink-2)" title="Report-ready PNG drawn with Matplotlib">
              <Group gap={4} wrap="nowrap"><IconDownload size={13} />PNG</Group>
            </Anchor>
          )}
          {table && (
            <SegmentedControl
              size="xs"
              value={view}
              onChange={(v) => setView(v as 'chart' | 'table')}
              data={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]}
              aria-label={`${title}: chart or table view`}
            />
          )}
        </Group>
      </Group>
      {view === 'chart' || !table ? children : (
        <div style={{ maxHeight: 340, overflow: 'auto' }}>
          <Table stickyHeader fz="xs" verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                {table.columns.map((c, i) => <Table.Th key={c} ta={numeric.includes(i) ? 'right' : 'left'}>{c}</Table.Th>)}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {table.rows.map((r, ri) => (
                <Table.Tr key={ri}>
                  {r.map((cell, ci) => <Table.Td key={ci} ta={numeric.includes(ci) ? 'right' : 'left'}>{cell}</Table.Td>)}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
      {footer && <div style={{ marginTop: 8 }}>{footer}</div>}
    </figure>
  )
}
