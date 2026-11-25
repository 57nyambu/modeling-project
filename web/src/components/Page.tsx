import { Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <Group justify="space-between" align="flex-end" gap="md" mb="lg" wrap="wrap">
      <Stack gap={4} maw={760}>
        <Title order={1}>{title}</Title>
        {description && <Text c="var(--ink-2)" size="md">{description}</Text>}
      </Stack>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  )
}

/** A bordered white panel with an optional header row. */
export function Panel({ title, description, actions, children, padded = true, id }: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  padded?: boolean
  id?: string
}) {
  return (
    <section className="panel" id={id}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <Title order={3}>{title}</Title>}
            {description && <Text size="sm" c="var(--ink-2)" mt={2}>{description}</Text>}
          </div>
          {actions && <Group gap={6} wrap="nowrap">{actions}</Group>}
        </div>
      )}
      <div className={padded ? 'panel-body' : undefined}>{children}</div>
    </section>
  )
}

/** Empty state that tells the reader what to do next. */
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel" style={{ padding: '40px 32px' }}>
      <Stack gap={6} maw={560}>
        <Title order={3}>{title}</Title>
        <Text c="var(--ink-2)">{children}</Text>
        {action && <div style={{ marginTop: 8 }}>{action}</div>}
      </Stack>
    </div>
  )
}

/** Label/value rows grouped under short headings: a compact, report-like sheet of results. */
export function MeasureSheet({ groups }: {
  groups: { title: string; rows: { label: ReactNode; value: ReactNode; note?: ReactNode; hint?: string }[] }[]
}) {
  return (
    <div className="sheet">
      {groups.map((g) => (
        <div className="sheet-group" key={g.title}>
          <h3>{g.title}</h3>
          <dl style={{ margin: 0 }}>
            {g.rows.map((r, i) => (
              <div className="sheet-row" key={i} title={r.hint}>
                <dt>{r.label}</dt>
                <dd>
                  {r.value}
                  {r.note && <small>{r.note}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

/** Coloured key used next to strategy names (identity never relies on text colour). */
export function Swatch({ colour, shape = 'square' }: { colour: string; shape?: 'square' | 'line' | 'dot' }) {
  const style =
    shape === 'line'
      ? { width: 14, height: 3, borderRadius: 2 }
      : shape === 'dot'
        ? { width: 10, height: 10, borderRadius: 10 }
        : { width: 10, height: 10, borderRadius: 2 }
  return <span aria-hidden style={{ display: 'inline-block', flex: 'none', background: colour, ...style }} />
}
