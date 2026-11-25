import { Arrow, Box, DC, Diagram, Diamond, Label, Pill, T, Wrap } from './kit'

// --------------------------------------------------------- 6. event graph
export function EventGraphDiagram() {
  const node = (x: number, y: number, w: number, name: string) => <Pill x={x} y={y} w={w} h={38} text={name} kind="event" mono size={12.5} />
  const note = (x: number, y: number, w: number, lines: string[]) => (
    <Box x={x} y={y} w={w} h={16 + lines.length * 16} kind="note" align="start" lines={lines} size={12.5} r={6} />
  )
  return (
    <Diagram width={1100} height={600} title="Event graph" desc="The five event types, the delay between an event and the events it schedules, the condition on each arrow, and the state changes each event makes.">
      {node(40, 110, 150, 'ARRIVAL')}
      {node(300, 110, 200, 'SECTION_ARRIVE')}
      {node(640, 110, 200, 'SECTION_DEPART')}
      {node(640, 330, 210, 'CHECKOUT_ARRIVE')}
      {node(300, 330, 170, 'SERVICE_END')}

      <Arrow points={[[190, 129], [300, 129]]} strong />
      <Label x={245} y={104} text="walk to the" />
      <Label x={245} y={118} text="first section" />
      <Arrow points={[[500, 129], [640, 129]]} strong />
      <Label x={570} y={104} text="pick k items" />
      <Label x={570} y={118} text="Gamma(k, m_p)" mono />
      <Arrow points={[[740, 110], [740, 60], [400, 60], [400, 110]]} strong />
      <Label x={570} y={48} text="walk to the next section   [more sections on the route]" />
      <Arrow points={[[745, 148], [745, 330]]} strong />
      <Label x={756} y={232} text="walk to the checkout" anchor="start" />
      <Label x={756} y={248} text="[last section]" anchor="start" />
      <Arrow points={[[640, 349], [470, 349]]} strong />
      <Label x={555} y={326} text="service time S" />
      <Label x={555} y={378} text="[counter was free]" />
      <path d="M330,368 C300,440 470,440 440,368" fill="none" stroke={DC.ink} strokeWidth={1.8} markerEnd="url(#arrow-strong)" />
      <Label x={385} y={446} text="service time of the next customer" />
      <Label x={385} y={462} text="[queue not empty]" />

      {note(40, 160, 200, ['customers in store + 1'])}
      {note(300, 160, 200, ['record the section arrival'])}
      {note(860, 100, 210, ['record the section departure'])}
      {note(860, 300, 210, ['strategy chooses counter c', 'free: start service, B_c = 1', 'busy: join queue, Q_c + 1'])}
      {note(30, 300, 230, ['record the departure', 'customers in store - 1', 'queue not empty: next starts, Q_c - 1', 'queue empty: B_c = 0'])}

      <rect x={30} y={500} width={1040} height={70} rx={8} fill="#f6f8fa" stroke="#e2e6eb" />
      <T x={46} y={524} weight={600} size={12.5}>Reading the graph</T>
      <Wrap x={46} y={544} width={1000} text="A dark arrow means the event schedules the next one after the delay written on it; a condition in brackets must be true. Events at the same instant run in this order: SERVICE_END, CHECKOUT_ARRIVE, SECTION_DEPART, SECTION_ARRIVE, ARRIVAL, so a cashier is freed before a new customer chooses a counter." />
    </Diagram>
  )
}

// ------------------------------------------------- 7. next-event time advance
export function EngineLoopDiagram() {
  const cx = 300
  const list: [string, string, string][] = [
    ['4.00', 'SERVICE_END', 'C1'],
    ['4.62', 'SECTION_DEPART', 'C7'],
    ['5.10', 'ARRIVAL', 'C9'],
    ['5.31', 'CHECKOUT_ARRIVE', 'C4'],
    ['6.85', 'SECTION_ARRIVE', 'C8'],
  ]
  return (
    <Diagram width={1100} height={720} title="Next-event time advance" desc="The engine's main loop: initialise, repeatedly take the earliest event, advance the clock, update the statistics and run the event handler, until the next event is after closing time; then close the statistics and compute the measures.">
      <Pill x={cx - 100} y={20} w={200} text="Start a run" />
      <Arrow points={[[cx, 54], [cx, 80]]} />
      <Box x={cx - 170} y={80} w={340} h={66} title="Initialise" lines={['generate every customer from the seed', 'schedule each ARRIVAL; set the clock t = 0']} />
      <Arrow points={[[cx, 146], [cx, 174]]} />
      <Diamond cx={cx} cy={226} w={300} h={104} lines={['Next event after closing', 'time T, or no events left?']} />
      <Arrow points={[[cx, 278], [cx, 306]]} label="no" labelAt={[cx + 18, 292]} labelAnchor="start" />
      <Box x={cx - 170} y={306} w={340} h={62} title="Take the earliest event" lines={['ties: event priority, then scheduling order']} />
      <Arrow points={[[cx, 368], [cx, 390]]} />
      <Box x={cx - 170} y={390} w={340} h={62} title="Advance the clock" lines={['t = event time: the clock jumps']} />
      <Arrow points={[[cx, 452], [cx, 474]]} />
      <Box x={cx - 170} y={474} w={340} h={62} title="Update time-weighted areas" lines={['area += Q_c x (t - time of last change)']} />
      <Arrow points={[[cx, 536], [cx, 558]]} />
      <Box x={cx - 170} y={558} w={340} h={62} kind="emphasis" title="Run the event's handler" lines={['change the state, schedule new events']} />
      <Arrow points={[[cx - 170, 589], [60, 589], [60, 226], [cx - 150, 226]]} />
      <Label x={60} y={410} text="repeat" />

      <Arrow points={[[cx + 150, 226], [560, 226]]} label="yes" labelAt={[505, 214]} />
      <Box x={560} y={193} w={280} h={66} title="Close the run at T" lines={['add the final areas; count busy time', 'only up to T']} />
      <Arrow points={[[700, 259], [700, 290]]} />
      <Box x={560} y={290} w={280} h={62} title="Compute the measures" lines={['waits, queues, utilisation, ...']} />
      <Arrow points={[[700, 352], [700, 380]]} />
      <Pill x={600} y={380} w={200} text="Results" />

      <T x={900} y={208} weight={600} size={12.5} colour={DC.ink2}>Event list (a priority queue)</T>
      <rect x={892} y={218} width={190} height={list.length * 30 + 10} rx={8} fill="#ffffff" stroke={DC.line} />
      {list.map(([t, e, c], i) => (
        <g key={i}>
          {i === 0 && <rect x={897} y={223} width={180} height={28} rx={5} fill="#eef4fd" />}
          <T x={906} y={242 + i * 30} size={11} mono colour={DC.ink2}>{t}</T>
          <T x={946} y={242 + i * 30} size={11} mono weight={i === 0 ? 600 : 400}>{e}</T>
          <T x={1072} y={242 + i * 30} size={11} mono colour={DC.ink2} anchor="end">{c}</T>
        </g>
      ))}
      <Wrap x={892} y={400} width={190} text="The earliest event is always taken next. Nothing happens between events, so no time is spent simulating idle moments." />
    </Diagram>
  )
}

// ---------------------------------------------------- 8. worked example
export function WorkedExampleDiagram() {
  const x0 = 590
  const sx = 62 // px per minute
  const X = (t: number) => x0 + t * sx
  const rows: { name: string; shop: [number, number]; wait?: [number, number]; serve: [number, number] }[] = [
    { name: 'C1', shop: [0, 1], serve: [1, 4] },
    { name: 'C2', shop: [1, 2], wait: [2, 4], serve: [4, 6] },
    { name: 'C3', shop: [2, 2.5], wait: [2.5, 6], serve: [6, 7] },
  ]
  const log: [string, string, string][] = [
    ['0.0', 'C1 arrives', 'shops for 1.0 min'],
    ['1.0', 'C1 at checkout', 'counter free: served for 3.0 min'],
    ['1.0', 'C2 arrives', 'shops for 1.0 min'],
    ['2.0', 'C2 at checkout', 'counter busy: queue Q = 1'],
    ['2.0', 'C3 arrives', 'shops for 0.5 min'],
    ['2.5', 'C3 at checkout', 'queue Q = 2'],
    ['4.0', 'C1 leaves', 'C2 served for 2.0 min, Q = 1'],
    ['6.0', 'C2 leaves', 'C3 served for 1.0 min, Q = 0'],
    ['7.0', 'C3 leaves', 'counter idle'],
  ]
  const q: [number, number][] = [[0, 0], [2, 1], [2.5, 2], [4, 1], [6, 0], [8, 0]]
  const qy0 = 336
  const qs = 26
  let qPath = `M${X(0)},${qy0}`
  for (let i = 1; i < q.length; i++) qPath += `H${X(q[i][0])}V${qy0 - q[i][1] * qs}`
  return (
    <Diagram width={1110} height={620} title="Worked example: three customers, one counter" desc="A hand-checkable run with three customers and one counter: the event log, a timeline of shopping, waiting and service, the queue length Q(t) with its area, and the measures computed from them.">
      <T x={30} y={34} weight={600} size={13}>Event log</T>
      <T x={30} y={54} size={11} colour={DC.ink2}>Walking takes no time here, to keep the table short.</T>
      <line x1={30} x2={540} y1={68} y2={68} stroke={DC.line} />
      <T x={30} y={86} size={11} weight={600} colour={DC.ink2}>t (min)</T>
      <T x={92} y={86} size={11} weight={600} colour={DC.ink2}>Event</T>
      <T x={240} y={86} size={11} weight={600} colour={DC.ink2}>What happens</T>
      {log.map(([t, e, w], i) => (
        <g key={i}>
          <line x1={30} x2={540} y1={96 + i * 27} y2={96 + i * 27} stroke={DC.grid} />
          <T x={30} y={114 + i * 27} size={12} mono>{t}</T>
          <T x={92} y={114 + i * 27} size={12} weight={500}>{e}</T>
          <T x={240} y={114 + i * 27} size={12} colour={DC.ink2}>{w}</T>
        </g>
      ))}

      <T x={x0} y={34} weight={600} size={13}>Timeline</T>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={60} y2={qy0} stroke={DC.grid} />
          <T x={X(t)} y={qy0 + 18} anchor="middle" size={11} colour={DC.ink2}>{t}</T>
        </g>
      ))}
      <T x={X(8) + 10} y={qy0 + 18} size={11} colour={DC.ink3}>min</T>
      {rows.map((r, i) => {
        const y = 70 + i * 40
        return (
          <g key={r.name}>
            <T x={x0 - 14} y={y + 16} anchor="end" weight={600} size={12}>{r.name}</T>
            <rect x={X(r.shop[0])} y={y} width={(r.shop[1] - r.shop[0]) * sx} height={22} rx={3} fill="#e4defc" />
            {r.wait && <rect x={X(r.wait[0])} y={y} width={(r.wait[1] - r.wait[0]) * sx} height={22} rx={3} fill="#fbd98a" />}
            <rect x={X(r.serve[0])} y={y} width={(r.serve[1] - r.serve[0]) * sx} height={22} rx={3} fill={DC.series} />
            {r.wait && <T x={X((r.wait[0] + r.wait[1]) / 2)} y={y + 15} anchor="middle" size={11}>{`waits ${r.wait[1] - r.wait[0]}`}</T>}
          </g>
        )
      })}
      <g>
        <rect x={x0} y={196} width={12} height={10} rx={2} fill="#e4defc" />
        <T x={x0 + 18} y={205} size={11} colour={DC.ink2}>shopping</T>
        <rect x={x0 + 90} y={196} width={12} height={10} rx={2} fill="#fbd98a" />
        <T x={x0 + 108} y={205} size={11} colour={DC.ink2}>waiting</T>
        <rect x={x0 + 172} y={196} width={12} height={10} rx={2} fill={DC.series} />
        <T x={x0 + 190} y={205} size={11} colour={DC.ink2}>being served</T>
      </g>
      <T x={x0 - 26} y={qy0 - qs + 4} anchor="end" weight={600} size={12}>Q(t)</T>
      <path d={`${qPath}V${qy0}Z`} fill={DC.series} fillOpacity={0.14} />
      <path d={qPath} fill="none" stroke={DC.series} strokeWidth={2} />
      <line x1={x0} x2={X(8)} y1={qy0} y2={qy0} stroke="#c2c8cf" />
      {[1, 2].map((v) => <T key={v} x={x0 - 6} y={qy0 - v * qs + 4} anchor="end" size={10.5} colour={DC.ink2}>{v}</T>)}
      <Label x={X(3.2)} y={qy0 - 2.6 * qs} text="area = 0.5 + 3.0 + 2.0 = 5.5 customer-min" size={11} colour={DC.ink} />
      <T x={x0 - 14} y={240} anchor="end" weight={600} size={12}>B(t)</T>
      <rect x={X(1)} y={228} width={6 * sx} height={16} rx={3} fill={DC.ink} />
      <T x={X(4)} y={240} anchor="middle" size={10.5} colour="#ffffff">cashier busy from 1 to 7: 6 min</T>

      <rect x={30} y={400} width={1050} height={190} rx={10} fill="#f6f8fa" stroke="#e2e6eb" />
      <T x={50} y={428} weight={600} size={13}>Measures for a run length of T = 20 min</T>
      {[
        ['Average wait', '(0 + 2 + 3.5) / 3 = 1.83 min'],
        ['Longest wait', '3.5 min (C3)'],
        ['Average queue length', '5.5 / 20 = 0.275 customers'],
        ['Longest queue', '2 customers, from 2.5 to 4.0'],
        ['Utilisation', '6 / 20 = 30%'],
        ['Average time in store', '(4 + 5 + 5) / 3 = 4.67 min'],
        ["Little's law", 'arrival rate x wait = (3 / 20) x 1.83 = 0.275'],
        ['Unit test', 'TestHandWorkedExample'],
      ].map(([k, v], i) => (
        <g key={k}>
          <T x={50 + (i % 2) * 520} y={458 + Math.floor(i / 2) * 32} size={12} colour={DC.ink2}>{k}</T>
          <T x={230 + (i % 2) * 520} y={458 + Math.floor(i / 2) * 32} size={12.5} weight={600} mono={i === 7}>{v}</T>
        </g>
      ))}
    </Diagram>
  )
}
