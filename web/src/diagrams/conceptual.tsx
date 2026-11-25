import { Arrow, Box, ClassBox, DC, Diagram, Diamond, KindLegend, Label, Pill, T, Wrap } from './kit'

// ----------------------------------------------------- 3. conceptual model
export function ConceptualDiagram() {
  return (
    <Diagram width={1100} height={640} title="Entities, attributes and resources" desc="The conceptual model: the customer entity and its attributes, checkout counters and sections as resources, the strategy as a decision rule, and the global simulation state.">
      <ClassBox x={30} y={30} w={318} kind="entity" title="Customer" subtitle="Entity: moves through the store"
        rows={[
          'id and arrival time',
          'basket category: small, medium or large',
          'number of items n',
          'items per section and route',
          'walking speed v',
          'pick time in each section',
          'service time S (hidden from other customers)',
          'expected service E[S | n] (visible)',
          'recorded: queue join, service start, departure',
        ]} />
      <ClassBox x={752} y={30} w={318} kind="resource" title="Checkout counter" subtitle="Resource: one cashier, capacity 1"
        rows={[
          'number and type (normal or express)',
          'first-in, first-out queue',
          'customer being served',
          'busy time, for utilisation',
          'area under the queue length, for averages',
          'customers served',
        ]} />
      <ClassBox x={392} y={176} w={316} kind="data" title="Simulation state" subtitle="Global variables, changed only at events"
        rows={[
          'clock t',
          'event list, ordered by time',
          'Q_c(t): customers waiting at counter c',
          'B_c(t): 1 if counter c is busy, else 0',
          'customers in the store',
          'customers generated and served',
        ]} />
      <ClassBox x={30} y={340} w={318} kind="resource" title="Shopping section" subtitle="Unlimited capacity: nobody queues to shop"
        rows={['Grocery, Beverages, Household, Personal Care', 'share of basket items', 'position on the floor plan']} />
      <ClassBox x={752} y={340} w={318} kind="decision" title="Checkout strategy" subtitle="Decision rule applied at the checkout area"
        rows={['Shortest Queue', 'Shortest Estimated Waiting Time', 'Express and Normal (5 items or fewer)']} />

      <Arrow points={[[189, 254], [189, 340]]} label="visits 1 to 4, in store order" labelAt={[189, 300]} />
      <Arrow points={[[348, 110], [752, 110]]} label="queues at, then is served by, exactly one" labelAt={[550, 110]} />
      <Arrow points={[[911, 340], [911, 210]]} label="assigns each customer to one" labelAt={[911, 278]} />
      <Arrow points={[[392, 250], [348, 250]]} dashed />
      <Arrow points={[[708, 250], [752, 250]]} dashed />
      <Label x={550} y={366} text="events change the state of customers and counters" size={10.5} />

      <Box x={30} y={480} w={520} h={120} kind="process" align="start" title="Activities: things that take time"
        lines={['walking between points (distance / speed)', 'picking items in a section', 'waiting in a queue (an output of the model)', 'scanning the items and paying']} />
      <Box x={570} y={480} w={500} h={120} kind="note" align="start" title="Events: instants where the state changes"
        lines={['ARRIVAL and SECTION_ARRIVE', 'SECTION_DEPART', 'CHECKOUT_ARRIVE: the strategy chooses a counter', 'SERVICE_END: pay, leave, next customer starts']} />
      <KindLegend x={30} y={622} kinds={['entity', 'resource', 'decision', 'data', 'process']} />
    </Diagram>
  )
}

// ---------------------------------------------------------- 4. process flow
export function ProcessFlowDiagram() {
  const cx = 330
  const notes: [number, string, string][] = [
    [47, 'Arrivals', 'Time between arrivals ~ Exponential, mean 1/lambda'],
    [119, 'Walking', 'distance / (60 v), with v ~ Uniform(0.8, 1.4) m/s'],
    [195, 'Picking k items', 'Gamma(k, m_p): the sum of k exponential pick times'],
    [363, 'Walking', 'from the last section to the checkout area'],
    [433, 'Choosing', 'the selected strategy; see the strategies diagram'],
    [583, 'Waiting', 'not an input: it is what the model measures'],
    [623, 'Service', 'Gamma(n, s) scanning + Triangular(a, c, b) payment'],
  ]
  return (
    <Diagram width={1100} height={760} title="Customer process flow" desc="Flowchart of one customer: arrive, walk to and shop in each section on the route, walk to the checkout, let the strategy choose a counter, wait if it is busy, be served and leave.">
      <Pill x={cx - 110} y={30} w={220} text="Customer arrives" />
      <Arrow points={[[cx, 64], [cx, 96]]} />
      <Box x={cx - 120} y={96} w={240} h={46} title="Walk to the first section" />
      <Arrow points={[[cx, 142], [cx, 172]]} />
      <Box x={cx - 120} y={172} w={240} h={46} title="Pick this section's items" />
      <Arrow points={[[cx, 218], [cx, 238]]} />
      <Diamond cx={cx} cy={276} w={240} h={76} lines={['More sections', 'on the route?']} />
      <Arrow points={[[cx + 120, 276], [500, 276]]} label="yes" labelAt={[460, 276]} />
      <Box x={500} y={253} w={190} h={46} title="Walk to the next section" size={12.5} />
      <Arrow points={[[595, 253], [595, 195], [cx + 120, 195]]} />
      <Arrow points={[[cx, 314], [cx, 340]]} label="no" labelAt={[cx + 18, 326]} labelAnchor="start" />
      <Box x={cx - 120} y={340} w={240} h={46} title="Walk to the checkout area" />
      <Arrow points={[[cx, 386], [cx, 410]]} />
      <Box x={cx - 120} y={410} w={240} h={46} kind="decision" title="Strategy chooses counter c" r={8} />
      <Arrow points={[[cx, 456], [cx, 472]]} />
      <Diamond cx={cx} cy={512} w={250} h={80} lines={['Counter c free and', 'queue empty?']} />
      <Arrow points={[[cx - 125, 512], [196, 512]]} label="no" labelAt={[214, 500]} />
      <Box x={20} y={489} w={176} h={46} title="Join the end of queue c" size={12.5} />
      <Arrow points={[[108, 535], [108, 560]]} />
      <Box x={20} y={560} w={176} h={46} title="Wait for the cashier" lines={['first in, first out']} size={12.5} />
      <Arrow points={[[108, 606], [108, 623], [cx - 120, 623]]} />
      <Arrow points={[[cx, 552], [cx, 600]]} label="yes" labelAt={[cx + 20, 578]} labelAnchor="start" />
      <Box x={cx - 120} y={600} w={240} h={46} kind="resource" title="Scan the items and pay" />
      <Arrow points={[[cx, 646], [cx, 676]]} />
      <Pill x={cx - 110} y={676} w={220} text="Customer leaves" />

      <line x1={740} x2={740} y1={30} y2={700} stroke={DC.line} />
      <T x={760} y={22} weight={600} size={12.5} colour={DC.ink2}>How long each step takes</T>
      {notes.map(([y, head, body]) => (
        <g key={y}>
          <line x1={736} x2={744} y1={y} y2={y} stroke={DC.ink3} />
          <T x={760} y={y - 2} weight={600} size={12.5}>{head}</T>
          <Wrap x={760} y={y + 14} width={320} text={body} />
        </g>
      ))}
      <KindLegend x={20} y={736} kinds={['terminal', 'process', 'decision', 'resource']} />
    </Diagram>
  )
}

// -------------------------------------------------------- 5. state machine
export function StatesDiagram() {
  const ev = (x: number, y: number, name: string, anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <Label x={x} y={y} text={name} size={11} mono colour={DC.ink} anchor={anchor} weight={500} />
  )
  return (
    <Diagram width={1100} height={500} title="Customer life cycle" desc="State machine of a customer: walking, shopping, walking to the checkout, waiting, being served and departed, with the event that causes each change.">
      <circle cx={46} cy={150} r={9} fill={DC.ink} />
      <Arrow points={[[55, 150], [130, 150]]} />
      {ev(92, 136, 'ARRIVAL')}
      <Box x={130} y={118} w={170} h={64} kind="entity" title="Walking" lines={['between points']} />
      <Box x={420} y={118} w={190} h={64} kind="entity" title="Shopping" lines={['in a section']} />
      <Arrow points={[[300, 138], [420, 138]]} />
      {ev(360, 126, 'SECTION_ARRIVE')}
      <Arrow points={[[420, 166], [300, 166]]} />
      {ev(360, 188, 'SECTION_DEPART')}
      <T x={360} y={206} anchor="middle" size={10.5} colour={DC.ink2}>more sections to visit</T>
      <Box x={760} y={118} w={210} h={64} kind="entity" title="Walking to checkout" lines={['after the last section']} />
      <Arrow points={[[610, 150], [760, 150]]} />
      {ev(685, 138, 'SECTION_DEPART')}
      <T x={685} y={170} anchor="middle" size={10.5} colour={DC.ink2}>last section done</T>

      <Box x={760} y={318} w={210} h={64} kind="entity" title="Waiting in queue" lines={['first in, first out']} />
      <Box x={420} y={318} w={190} h={64} kind="entity" title="Being served" lines={['scan and pay']} />
      <Box x={130} y={318} w={170} h={64} kind="entity" title="Departed" lines={['left through the exit']} />
      <Arrow points={[[865, 182], [865, 318]]} />
      {ev(875, 236, 'CHECKOUT_ARRIVE', 'start')}
      <T x={875} y={256} size={10.5} colour={DC.ink2}>counter busy or queue not empty</T>
      <Arrow points={[[800, 182], [560, 318]]} />
      {ev(640, 236, 'CHECKOUT_ARRIVE')}
      <T x={640} y={256} anchor="middle" size={10.5} colour={DC.ink2}>counter free: start service at once</T>
      <Arrow points={[[760, 350], [610, 350]]} />
      {ev(685, 338, 'SERVICE_END')}
      <T x={685} y={372} anchor="middle" size={10.5} colour={DC.ink2}>of the customer ahead</T>
      <Arrow points={[[420, 350], [300, 350]]} />
      {ev(360, 338, 'SERVICE_END')}
      <Arrow points={[[130, 350], [70, 350]]} />
      <circle cx={58} cy={350} r={11} fill="none" stroke={DC.ink} strokeWidth={1.6} />
      <circle cx={58} cy={350} r={6} fill={DC.ink} />

      <rect x={130} y={418} width={840} height={52} rx={8} fill="#f6f8fa" stroke="#e2e6eb" />
      <Wrap x={148} y={440} width={800} text="When the run stops at closing time T, customers who are walking, shopping, waiting or being served are not lost: they are reported as remaining in the system, split by state." />
    </Diagram>
  )
}
