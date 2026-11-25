import { Group, Image, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1.3}>{label}</Text>
      <Text size="xl" fw={700} mt={4} lh={1.2}>{value}</Text>
      {hint && <Text size="xs" c="dimmed" mt={2}>{hint}</Text>}
    </Paper>
  )
}

export function Section({ title, description, actions, children }: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={4}>{title}</Title>
          {description && <Text size="sm" c="dimmed">{description}</Text>}
        </div>
        {actions}
      </Group>
      {children}
    </Stack>
  )
}

export function ChartImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <Paper withBorder radius="md" p="xs">
      {!loaded && <Skeleton height={220} />}
      <a href={src} target="_blank" rel="noreferrer" title="Open full size">
        <Image src={src} alt={alt} onLoad={() => setLoaded(true)} style={{ display: loaded ? 'block' : 'none' }} />
      </a>
    </Paper>
  )
}

export function Legend({ items }: { items: { colour: string; label: string; ring?: boolean }[] }) {
  return (
    <Group gap="md">
      {items.map((i) => (
        <Group key={i.label} gap={6}>
          <span
            style={{
              width: 10, height: 10, borderRadius: 10, background: i.colour, display: 'inline-block',
              outline: i.ring ? '1.5px solid #0f172a' : undefined,
            }}
          />
          <Text size="xs" c="dimmed">{i.label}</Text>
        </Group>
      ))}
    </Group>
  )
}
