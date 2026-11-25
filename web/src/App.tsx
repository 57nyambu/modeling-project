import { Alert, AppShell, Box, Burger, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import type { Meta, Params, StrategyKey } from './api'
import {
  IconCompare, IconDiagrams, IconHistory, IconSimulation, IconValidation, Logomark,
} from './components/Icons'
import { ComparePage } from './pages/ComparePage'
import { DiagramsPage } from './pages/DiagramsPage'
import { HistoryPage } from './pages/HistoryPage'
import { SimulationPage } from './pages/SimulationPage'
import { ValidationPage } from './pages/ValidationPage'
import { hrefFor, useRoute } from './router'
import type { Page } from './router'

const NAV: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'simulation', label: 'Simulation', icon: <IconSimulation /> },
  { page: 'compare', label: 'Compare strategies', icon: <IconCompare /> },
  { page: 'model', label: 'How the model works', icon: <IconDiagrams /> },
  { page: 'validation', label: 'Validation', icon: <IconValidation /> },
  { page: 'history', label: 'Saved results', icon: <IconHistory /> },
]

type ApiState = 'loading' | 'ok' | 'down'

export default function App() {
  const { route, navigate } = useRoute()
  const [navOpen, { toggle, close }] = useDisclosure(false)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [apiState, setApiState] = useState<ApiState>('loading')
  const [params, setParams] = useState<Params>({})
  const [strategy, setStrategy] = useState<StrategyKey>('shortest_queue')

  const connect = useCallback(() => {
    setApiState('loading')
    api.meta()
      .then((m) => {
        setMeta(m)
        setParams((p) => (Object.keys(p).length ? p : { ...m.defaults }))
        setApiState('ok')
      })
      .catch(() => setApiState('down'))
  }, [])
  useEffect(connect, [connect])

  useEffect(() => {
    const titles: Record<Page, string> = {
      simulation: 'Simulation', compare: 'Compare strategies', model: 'How the model works',
      validation: 'Validation', history: 'Saved results',
    }
    document.title = `${titles[route.page]} - Supermarket Checkout Simulation`
    close()
  }, [route.page, close])

  const routeId = route.param && /^\d+$/.test(route.param) ? Number(route.param) : null

  return (
    <AppShell
      navbar={{ width: 248, breakpoint: 'md', collapsed: { mobile: !navOpen } }}
      header={{ height: { base: 52, md: 0 } }}
      padding={0}
    >
      <AppShell.Header bg="var(--nav)" bd={0} px="md" hiddenFrom="md">
        <Group gap="sm" h="100%">
          <Burger opened={navOpen} onClick={toggle} color="#ffffff" size="sm" aria-label="Toggle navigation" />
          <Text c="white" fw={600}>Checkout Simulation</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar bg="var(--nav)" bd={0} p="md">
        <Stack justify="space-between" h="100%" gap="lg">
          <Stack gap="xl">
            <Group gap={10} wrap="nowrap" px={4} pt={4}>
              <Logomark />
              <div>
                <Text c="white" fw={600} size="md" lh={1.2}>Checkout Simulation</Text>
                <Text c="var(--nav-muted)" size="xs" lh={1.3}>Supermarket queue model</Text>
              </div>
            </Group>
            <nav aria-label="Main">
              <Stack gap={2}>
                {NAV.map((item, i) => (
                  <Box key={item.page} mt={i === 2 ? 14 : 0}>
                    <a
                      className="nav-link"
                      href={hrefFor(item.page)}
                      aria-current={route.page === item.page ? 'page' : undefined}
                    >
                      {item.icon}
                      {item.label}
                    </a>
                  </Box>
                ))}
              </Stack>
            </nav>
          </Stack>
          <Stack gap={4} px={6} pb={4}>
            <Group gap={8} wrap="nowrap">
              <span
                aria-hidden
                style={{
                  width: 8, height: 8, borderRadius: 8, flex: 'none',
                  background: apiState === 'ok' ? '#0aac23' : apiState === 'down' ? '#dc3c3d' : '#8793a0',
                }}
              />
              <Text size="xs" c="var(--nav-ink)">
                {apiState === 'ok' ? 'Simulation engine connected' : apiState === 'down' ? 'Engine not reachable' : 'Connecting to engine'}
              </Text>
            </Group>
            <Text size="xs" c="var(--nav-muted)">Discrete-event simulation in Python</Text>
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box px={{ base: 'md', sm: 28 }} py={{ base: 'md', sm: 24 }} maw={1560}>
          {apiState === 'down' && (
            <Alert color="red" variant="light" title="The simulation engine is not reachable" mb="lg">
              <Text size="sm" mb="sm">
                Start the Django API in the api folder with <code>python manage.py runserver</code>, then try again.
              </Text>
              <Button size="xs" variant="white" color="red" onClick={connect}>Try again</Button>
            </Alert>
          )}
          {apiState === 'loading' && !meta && <Group justify="center" p="xl"><Loader color="ink" /></Group>}
          {meta && (
            <>
              <div hidden={route.page !== 'simulation'}>
                <SimulationPage
                  meta={meta} params={params} setParams={setParams} strategy={strategy} setStrategy={setStrategy}
                  runId={route.page === 'simulation' ? routeId : null}
                  onRunCreated={(id) => navigate('simulation', id, true)}
                />
              </div>
              <div hidden={route.page !== 'compare'}>
                <ComparePage
                  meta={meta} params={params} setParams={setParams}
                  comparisonId={route.page === 'compare' ? routeId : null}
                  onCreated={(id) => navigate('compare', id, true)}
                />
              </div>
              {route.page === 'model' && (
                <DiagramsPage meta={meta} params={params} diagramId={route.param}
                  onSelect={(id) => navigate('model', id)} />
              )}
              <div hidden={route.page !== 'validation'}>
                <ValidationPage onOpenDiagram={(id) => navigate('model', id)} />
              </div>
              {route.page === 'history' && (
                <HistoryPage
                  meta={meta}
                  onOpenRun={(id) => navigate('simulation', id)}
                  onOpenComparison={(id) => navigate('compare', id)}
                />
              )}
            </>
          )}
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
