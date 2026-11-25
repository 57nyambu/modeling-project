import { Alert, AppShell, Container, Group, Loader, Tabs, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { api } from './api'
import type { Meta, Params, StrategyKey } from './api'
import { ComparePage } from './pages/ComparePage'
import { HistoryPage } from './pages/HistoryPage'
import { SimulationPage } from './pages/SimulationPage'
import { ValidationPage } from './pages/ValidationPage'

type Tab = 'simulation' | 'compare' | 'history' | 'validation'

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('simulation')
  const [params, setParams] = useState<Params>({})
  const [strategy, setStrategy] = useState<StrategyKey>('shortest_queue')
  const [openRunId, setOpenRunId] = useState<number | null>(null)
  const [openComparisonId, setOpenComparisonId] = useState<number | null>(null)

  useEffect(() => {
    api.meta()
      .then((m) => { setMeta(m); setParams({ ...m.defaults }) })
      .catch((e: Error) => setError(`Cannot reach the API. Is Django running on port 8000? (${e.message})`))
  }, [])

  return (
    <AppShell header={{ height: 64 }} padding="lg">
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <div>
              <Title order={4} lh={1.1}>Supermarket Checkout Simulation</Title>
              <Text size="xs" c="dimmed">Discrete-event model of customer movement, queues and checkout</Text>
            </div>
            <Tabs value={tab} onChange={(v) => v && setTab(v as Tab)} variant="pills" radius="md">
              <Tabs.List>
                <Tabs.Tab value="simulation">Simulation</Tabs.Tab>
                <Tabs.Tab value="compare">Compare strategies</Tabs.Tab>
                <Tabs.Tab value="history">History</Tabs.Tab>
                <Tabs.Tab value="validation">Validation</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main bg="gray.0">
        <Container size="xl">
          {error && <Alert color="red" title="Connection problem">{error}</Alert>}
          {!meta && !error && <Group justify="center" p="xl"><Loader /></Group>}
          {meta && (
            <>
              <div hidden={tab !== 'simulation'}>
                <SimulationPage meta={meta} params={params} setParams={setParams}
                  strategy={strategy} setStrategy={setStrategy} openRunId={openRunId} />
              </div>
              <div hidden={tab !== 'compare'}>
                <ComparePage meta={meta} params={params} setParams={setParams} openComparisonId={openComparisonId} />
              </div>
              {tab === 'history' && (
                <HistoryPage
                  meta={meta}
                  onOpenRun={(id) => { setOpenRunId(id); setTab('simulation') }}
                  onOpenComparison={(id) => { setOpenComparisonId(id); setTab('compare') }}
                />
              )}
              <div hidden={tab !== 'validation'}>
                <ValidationPage />
              </div>
            </>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
