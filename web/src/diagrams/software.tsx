import { Arrow, Box, Cylinder, DC, Diagram, Frame, Label, Step, T, Wrap } from './kit'

// ------------------------------------------------------ 14. architecture
export function ArchitectureDiagram() {
  return (
    <Diagram width={1100} height={560} title="Software architecture" desc="The React interface in the browser talks to the Django API over HTTP and JSON; Django calls the pure-Python simulation engine, stores results in SQLite and draws report figures with Matplotlib.">
      <Frame x={30} y={30} w={300} h={400} title="Browser: React + TypeScript (web/)" />
      <Box x={52} y={70} w={256} h={112} kind="process" align="start" title="Pages"
        lines={['Simulation', 'Compare strategies', 'How the model works', 'Validation and Saved results']} size={12.5} />
      <Box x={52} y={196} w={256} h={66} kind="process" align="start" title="Floor-plan replay" lines={['canvas animation of the event trace']} size={12.5} />
      <Box x={52} y={276} w={256} h={66} kind="process" align="start" title="Charts and diagrams" lines={['SVG, drawn in the browser']} size={12.5} />
      <Box x={52} y={356} w={256} h={52} kind="data" align="start" title="api.ts" lines={['typed calls to /api/...']} size={12.5} />

      <Box x={372} y={150} w={170} h={98} kind="note" title="Vite dev server" lines={['port 5173', 'forwards /api', 'to Django']} size={12.5} />
      <Wrap x={372} y={280} width={175} size={11} text="Single-server mode: after npm run build, Django serves the built app itself on port 8000." />

      <Frame x={584} y={30} w={250} h={400} title="Django API (api/simulator)" />
      <Box x={604} y={70} w={210} h={112} kind="process" align="start" title="views.py"
        lines={['/api/runs', '/api/comparisons', '/api/validation, /api/meta']} size={12.5} />
      <Box x={604} y={196} w={210} h={66} kind="process" align="start" title="charts.py" lines={['Matplotlib PNG figures']} size={12.5} />
      <Box x={604} y={276} w={210} h={66} kind="process" align="start" title="models.py" lines={['runs and comparisons']} size={12.5} />

      <Frame x={870} y={30} w={200} h={400} title="Engine (api/simulation)" />
      <Box x={888} y={70} w={164} h={340} kind="emphasis" align="start" title="Pure Python"
        lines={['config.py', 'layout.py', 'customers.py', 'engine.py', 'strategies.py', 'metrics.py', 'comparison.py', 'validation.py', 'cli.py', '', 'NumPy and Pandas', 'no Django imports']} size={12.5} />

      <Cylinder x={634} y={452} w={150} h={88} title="SQLite" lines={['db.sqlite3']} />
      <Arrow points={[[308, 382], [348, 382], [348, 210], [372, 210]]} both />
      <Label x={457} y={140} text="HTTP + JSON" size={10.5} />
      <Arrow points={[[542, 199], [604, 126]]} both />
      <Arrow points={[[814, 126], [888, 126]]} strong />
      <Label x={851} y={114} text="calls" size={10.5} />
      <Arrow points={[[709, 342], [709, 452]]} both />
      <Label x={716} y={404} text="save and reload results" size={10.5} anchor="start" />
      <Wrap x={30} y={470} width={560} size={11.5} text="The engine never imports Django, so it runs on its own from the command line (python -m simulation.cli) and its unit tests need no web server. Django only validates input, calls the engine, stores results and serves them." />
    </Diagram>
  )
}

// ----------------------------------------------------- 15. sequence
export function SequenceDiagram() {
  const lanes: [string, number][] = [['User', 80], ['React app', 290], ['Django API', 520], ['Simulation engine', 760], ['SQLite', 990]]
  const xOf = (name: string) => lanes.find((l) => l[0] === name)![1]
  const msgs: { from: string; to: string; text: string; ret?: boolean; self?: boolean }[] = [
    { from: 'User', to: 'React app', text: 'Start simulation' },
    { from: 'React app', to: 'Django API', text: 'POST /api/runs {strategy, parameters}' },
    { from: 'Django API', to: 'Django API', text: 'validate: SimulationConfig.from_dict', self: true },
    { from: 'Django API', to: 'Simulation engine', text: 'run_simulation(config, strategy)' },
    { from: 'Simulation engine', to: 'Simulation engine', text: 'generate customers, process events to T', self: true },
    { from: 'Simulation engine', to: 'Django API', text: 'SimulationResult', ret: true },
    { from: 'Django API', to: 'Simulation engine', text: 'compute_metrics, time_series, build_trace' },
    { from: 'Simulation engine', to: 'Django API', text: 'measures, series, trace', ret: true },
    { from: 'Django API', to: 'SQLite', text: 'save SimulationRun' },
    { from: 'Django API', to: 'React app', text: '201 Created: JSON', ret: true },
    { from: 'React app', to: 'React app', text: 'replay the trace, draw charts', self: true },
    { from: 'React app', to: 'User', text: 'animation, measures, charts', ret: true },
  ]
  const y0 = 100
  const dy = 42
  return (
    <Diagram width={1100} height={640} title="What happens when you press Start" desc="Sequence of messages between the user, the React app, the Django API, the simulation engine and SQLite during one simulation run.">
      {lanes.map(([name, x]) => (
        <g key={name}>
          <rect x={x - 80} y={24} width={160} height={40} rx={8} fill={name === 'Simulation engine' ? DC.ink : '#ffffff'} stroke={DC.ink} strokeWidth={1.3} />
          <T x={x} y={49} anchor="middle" weight={600} size={13} colour={name === 'Simulation engine' ? '#ffffff' : DC.ink}>{name}</T>
          <line x1={x} x2={x} y1={64} y2={y0 + msgs.length * dy} stroke={DC.ink3} strokeDasharray="4 4" />
        </g>
      ))}
      {msgs.map((m, i) => {
        const y = y0 + i * dy
        const x1 = xOf(m.from)
        const x2 = xOf(m.to)
        if (m.self) {
          return (
            <g key={i}>
              <Step x={x1 - 22} y={y} n={i + 1} dark={false} />
              <path d={`M${x1},${y - 6} h44 v18 h-40`} fill="none" stroke={DC.edge} strokeWidth={1.4} markerEnd="url(#arrow)" />
              <Label x={x1 + 52} y={y + 4} text={m.text} anchor="start" mono={m.text.includes('(') || m.text.includes('_')} />
            </g>
          )
        }
        const dir = x2 > x1 ? 1 : -1
        return (
          <g key={i}>
            <Step x={x1 - dir * 20} y={y} n={i + 1} dark={!m.ret} />
            <Arrow points={[[x1, y], [x2 - dir * 2, y]]} dashed={m.ret} strong={!m.ret} />
            <Label x={Math.min(x1, x2) + 14} y={y - 8} text={m.text} anchor="start" mono={m.text.includes('(') || m.text.includes('/api') || m.text.includes('_')} colour={DC.ink} />
          </g>
        )
      })}
      <T x={30} y={620} size={11} colour={DC.ink2}>Solid arrows are requests or calls; dashed arrows are replies. The whole day is simulated in step 5, before any animation starts.</T>
    </Diagram>
  )
}

// ------------------------------------------------------ 16. validation
export function ValidationDiagram() {
  const chain: [string, string[], 'data' | 'process' | 'resource' | 'decision'][] = [
    ['Poisson arrivals', ['rate lambda'], 'data'],
    ['Shopping', ['unlimited room:', 'an M/G/infinity stage'], 'process'],
    ['Still Poisson', ['customers reach the', 'checkout at rate lambda'], 'data'],
    ['One counter', ['exponential service,', 'rate mu: M/M/1'], 'resource'],
    ['Compare', ['simulation against', 'exact formulas'], 'decision'],
  ]
  const results: [string, string, string, string, string][] = [
    ['Utilisation', 'rho = lambda / mu', '0.7000', '0.6986', '0.6954 to 0.7017'],
    ['Average wait (min)', 'Wq = rho / (mu - lambda)', '2.3333', '2.2760', '2.1863 to 2.3657'],
    ['Average queue', 'Lq = rho^2 / (1 - rho)', '1.6333', '1.5942', '1.5292 to 1.6592'],
  ]
  return (
    <Diagram width={1100} height={470} title="Validation against queueing theory" desc="Why the full model reduces to an M/M/1 queue when it has one counter and exponential service, and the validation results for lambda 0.7 and mu 1.0.">
      {chain.map(([title, lines, kind], i) => (
        <g key={title}>
          <Box x={30 + i * 214} y={40} w={180} h={86} kind={kind} title={title} lines={lines} size={13} />
          {i < chain.length - 1 && <Arrow points={[[210 + i * 214, 83], [244 + i * 214, 83]]} strong />}
        </g>
      ))}
      <Wrap x={30} y={160} width={1040} size={12} text="A Poisson stream that passes through a stage with unlimited capacity leaves it as a Poisson stream with the same rate, whatever the shopping times are. So with one counter and exponential service times, the checkout is exactly an M/M/1 queue and the engine can be checked against known formulas." />
      <T x={30} y={228} weight={600} size={13}>Results: lambda = 0.7, mu = 1.0, 10 replications of 20,000 minutes</T>
      {['Measure', 'Formula', 'Theory', 'Simulated mean', '95% confidence interval', 'Result'].map((h, i) => (
        <T key={h} x={[30, 210, 450, 560, 700, 900][i]} y={260} size={11.5} weight={600} colour={DC.ink2}>{h}</T>
      ))}
      {results.map((r, i) => (
        <g key={r[0]}>
          <line x1={30} x2={1070} y1={270 + i * 34} y2={270 + i * 34} stroke={DC.grid} />
          <T x={30} y={292 + i * 34} size={12.5}>{r[0]}</T>
          <T x={210} y={292 + i * 34} size={12} mono>{r[1]}</T>
          <T x={450} y={292 + i * 34} size={12.5} weight={600}>{r[2]}</T>
          <T x={560} y={292 + i * 34} size={12.5}>{r[3]}</T>
          <T x={700} y={292 + i * 34} size={12.5}>{r[4]}</T>
          <T x={900} y={292 + i * 34} size={12.5} weight={600} colour="#006c10">Theory inside the CI</T>
        </g>
      ))}
      <rect x={30} y={390} width={1040} height={56} rx={8} fill="#f6f8fa" stroke="#e2e6eb" />
      <Wrap x={48} y={414} width={1000} size={12} text="The simulated values sit slightly below theory because every replication starts with an empty store. Run the check yourself on the Validation page, or with python -m simulation.cli --validate." />
    </Diagram>
  )
}

// -------------------------------------------------------- 17. roadmap
export function RoadmapDiagram() {
  const stages: [string, string, string][] = [
    ['Requirements analysis', 'docs/01-requirements.md', 'scope, objectives, measures'],
    ['Conceptual model', 'docs/02, diagrams 3 to 5', 'entities, events, state'],
    ['Mathematical model', 'docs/03, diagrams 10 to 13', 'distributions, formulas'],
    ['Architecture and setup', 'docs/04, diagrams 14 and 15', 'folders, API, database'],
    ['Simulation engine', 'api/simulation/engine.py', 'event list, handlers'],
    ['Checkout strategies', 'strategies.py, diagram 9', 'three decision rules'],
    ['Interface and replay', 'web/ and the Django API', 'dashboard, floor plan'],
    ['Performance analysis', 'Compare strategies page', 'replications, CIs'],
    ['Testing and validation', 'tests and Validation page', 'hand example, M/M/1'],
    ['Report and presentation', 'docs/06 and this walkthrough', 'figures and slides'],
  ]
  const W = 196
  const gap = 18
  return (
    <Diagram width={1100} height={430} title="Development stages" desc="The ten development stages of the project in order, with the document, code or page that each stage produced.">
      {stages.map(([title, where, what], i) => {
        const row = Math.floor(i / 5)
        const col = i % 5
        const x = 30 + col * (W + gap)
        const y = 40 + row * 170
        return (
          <g key={title}>
            <rect x={x} y={y} width={W} height={120} rx={8} fill={row ? '#ffffff' : '#ffffff'} stroke={DC.line} />
            <Step x={x + 22} y={y + 24} n={i + 1} />
            <T x={x + 40} y={y + 29} weight={600} size={12.5}>{title}</T>
            <line x1={x + 14} x2={x + W - 14} y1={y + 46} y2={y + 46} stroke={DC.grid} />
            <Wrap x={x + 14} y={y + 68} width={W - 28} size={11.5} colour={DC.ink} text={where} />
            <Wrap x={x + 14} y={y + 100} width={W - 28} size={11} text={what} />
            {col < 4 && <Arrow points={[[x + W, y + 60], [x + W + gap, y + 60]]} />}
          </g>
        )
      })}
      <Arrow points={[[30 + 4 * (W + gap) + W / 2, 160], [30 + 4 * (W + gap) + W / 2, 185], [30 + W / 2, 185], [30 + W / 2, 210]]} />
      <rect x={30} y={386} width={518} height={22} rx={4} fill="#eef4fd" stroke="#9dbbe8" />
      <T x={289} y={401} anchor="middle" size={11.5} weight={600}>Week 1: model and engine (stages 1 to 6)</T>
      <rect x={552} y={386} width={518} height={22} rx={4} fill="#e9f7f1" stroke="#74c7a5" />
      <T x={811} y={401} anchor="middle" size={11.5} weight={600}>Week 2: interface, analysis, report (stages 7 to 10)</T>
    </Diagram>
  )
}
