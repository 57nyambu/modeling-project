import type { Meta, Params } from '../api'
import { num } from '../model'
import { DESK, DOOR_WIDTH, HEADER_DEPTH, aisles, gondolas } from '../sim/floorplan'
import { Arrow, Box, DC, Diagram, Frame, KindLegend, Label, Step, T, Wrap } from './kit'

export interface DiagramProps {
  meta: Meta
  params: Params
}

export function counterPositions(meta: Meta, n: number): [number, number][] {
  const { x_min, x_max, y } = meta.counter_span
  if (n <= 1) return [[(x_min + x_max) / 2, y]]
  return Array.from({ length: n }, (_, i) => [x_min + (i * (x_max - x_min)) / (n - 1), y])
}

// --------------------------------------------------------------- 1. layout
export function StoreLayoutDiagram({ meta, params }: DiagramProps) {
  const L = meta.layout
  const n = Math.min(10, Math.max(1, Math.round(num(params, 'num_counters')) || 4))
  const express = Math.min(n, Math.max(0, Math.round(num(params, 'num_express')) || 0))
  const counters = counterPositions(meta, n)
  const s = 20
  const ox = 40
  const oy = 64
  const X = (m: number) => ox + m * s
  const Y = (m: number) => oy + m * s
  const route: [string, [number, number]][] = []
  const mid = (k: string) => {
    const r = L.sections[k]
    return [r.x + r.w / 2, aisles(r)[1]] as [number, number]
  }
  route.push(['entrance', L.entrance])
  for (const k of ['grocery', 'beverages', 'household', 'personal_care']) route.push([k, mid(k)])
  route.push(['decision', L.checkout_point])
  const target = Math.min(1, n - 1)
  const [tx, ty] = counters[target]
  route.push(['queue', [tx, ty - 1 - 0.9]])
  route.push(['service', [tx, ty - 1]])
  route.push(['exit', L.exit])
  const pts = route.map(([, p]) => [X(p[0]), Y(p[1])] as [number, number])
  const half = DOOR_WIDTH / 2
  const doors = [L.entrance[0], L.exit[0]].sort((a, b) => a - b)
  const notes = [
    ['Enter', 'Customers arrive at random through the entrance.'],
    ['Walk to the first section', 'Walking time = distance / walking speed.'],
    ['Shop', 'Pick items in each section on the route, in store order.'],
    ['Walk to the checkouts', 'Only sections with items in the basket are visited.'],
    ['Choose a counter', 'The checkout strategy picks one counter here.'],
    ['Queue', 'Each counter has its own first-in, first-out queue.'],
    ['Pay and leave', 'Service = scan every item + pay, then exit.'],
  ]

  return (
    <Diagram width={1140} height={660} title="Store layout and customer route" desc="Floor plan of the simulated supermarket with the route a customer takes from the entrance through the four sections to a checkout counter and the exit.">
      {/* dimensions */}
      <line x1={X(0)} x2={X(L.width)} y1={oy - 22} y2={oy - 22} stroke={DC.ink3} />
      <line x1={X(0)} x2={X(0)} y1={oy - 28} y2={oy - 16} stroke={DC.ink3} />
      <line x1={X(L.width)} x2={X(L.width)} y1={oy - 28} y2={oy - 16} stroke={DC.ink3} />
      <Label x={X(L.width / 2)} y={oy - 18} text={`${L.width} m`} />
      <line x1={ox - 22} x2={ox - 22} y1={Y(0)} y2={Y(L.height)} stroke={DC.ink3} />
      <line x1={ox - 28} x2={ox - 16} y1={Y(0)} y2={Y(0)} stroke={DC.ink3} />
      <line x1={ox - 28} x2={ox - 16} y1={Y(L.height)} y2={Y(L.height)} stroke={DC.ink3} />
      <g transform={`translate(${ox - 27},${Y(L.height / 2)}) rotate(-90)`}><Label x={0} y={0} text={`${L.height} m`} /></g>

      {/* floor and sections */}
      <rect x={X(0)} y={Y(0)} width={L.width * s} height={L.height * s} fill="#ffffff" />
      {Object.entries(L.sections).map(([k, r]) => (
        <g key={k}>
          <rect x={X(r.x)} y={Y(r.y)} width={r.w * s} height={r.h * s} fill="#f6f8fa" stroke="#d5dbe2" />
          {gondolas(r).map((g, i) => <rect key={i} x={X(g.x)} y={Y(g.y)} width={g.w * s} height={g.h * s} fill="#dfe4ea" />)}
          <T x={X(r.x + 0.6)} y={Y(r.y + HEADER_DEPTH / 2) + 4} weight={600} size={12}>{meta.sections[k]}</T>
        </g>
      ))}
      {/* checkout lanes */}
      {counters.map(([cx, cy], i) => (
        <g key={i}>
          <line x1={X(cx - 0.55)} x2={X(cx - 0.55)} y1={Y(cy - 7.9)} y2={Y(cy + 0.6)} stroke="#d3d9e0" />
          <line x1={X(cx + 0.55)} x2={X(cx + 0.55)} y1={Y(cy - 7.9)} y2={Y(cy + 0.6)} stroke="#d3d9e0" />
          <rect x={X(cx + DESK.dx)} y={Y(DESK.top)} width={DESK.w * s} height={(cy + 0.6 - DESK.top) * s} fill="#e9edf2" stroke="#c9d0d8" />
          <rect x={X(cx + DESK.dx + 0.12)} y={Y(cy - 0.25)} width={(DESK.w - 0.24) * s} height={0.7 * s} fill="#2d3d50" />
          <rect x={X(cx + DESK.dx + DESK.w / 2 - 0.62)} y={Y(DESK.top - 0.95)} width={1.25 * s} height={0.8 * s} rx={3} fill="#ffffff" stroke="#aab3bd" />
          <T x={X(cx + DESK.dx + DESK.w / 2)} y={Y(DESK.top - 0.95) + 12} anchor="middle" size={11} weight={600} colour={DC.ink2}>{i + 1}</T>
          {i < express && <T x={X(cx + 0.35)} y={Y(cy + 1.6)} anchor="middle" size={10.5} colour={DC.ink2}>Express</T>}
        </g>
      ))}
      {/* walls with doors */}
      <path
        d={`M${X(doors[0] - half)},${Y(L.height)}H${X(0)}V${Y(0)}H${X(L.width)}V${Y(L.height)}H${X(doors[1] + half)}M${X(doors[1] - half)},${Y(L.height)}H${X(doors[0] + half)}`}
        fill="none" stroke="#2d3d50" strokeWidth={3.2}
      />
      <T x={X(L.entrance[0])} y={Y(L.height) + 18} anchor="middle" size={11.5} colour={DC.ink2}>Entrance</T>
      <T x={X(L.exit[0])} y={Y(L.height) + 18} anchor="middle" size={11.5} colour={DC.ink2}>Exit</T>
      {/* decision point */}
      <path d={`M${X(L.checkout_point[0])},${Y(L.checkout_point[1]) - 9}l9,9l-9,9l-9,-9z`} fill="#fff7e0" stroke="#e0b43c" strokeWidth={1.3} />

      {/* route */}
      <Arrow points={pts.slice(0, 6)} accent />
      <Arrow points={[pts[5], [pts[6][0], pts[5][1] + 40], pts[6]]} accent />
      <Arrow points={[pts[7], [X(L.exit[0]), pts[7][1]], pts[8]]} accent />
      {pts.map((p, i) => i === 0 || i === 8 ? null : (
        <circle key={i} cx={p[0]} cy={p[1]} r={4} fill={DC.series} stroke="#ffffff" strokeWidth={2} />
      ))}
      <Step x={pts[0][0] + 22} y={pts[0][1] - 18} n={1} />
      <Step x={pts[1][0] - 18} y={pts[1][1] + 22} n={2} />
      <Step x={pts[2][0]} y={pts[2][1] - 22} n={3} />
      <Step x={pts[4][0] + 20} y={pts[4][1] + 24} n={4} />
      <Step x={pts[5][0] + 24} y={pts[5][1] - 16} n={5} />
      <Step x={pts[6][0] - 26} y={pts[6][1]} n={6} />
      <Step x={pts[8][0] - 24} y={pts[8][1] - 30} n={7} />

      {/* annotations */}
      <T x={890} y={80} weight={600} size={13.5}>One customer's journey</T>
      {notes.map(([head, body], i) => (
        <g key={i}>
          <Step x={900} y={112 + i * 56} n={i + 1} />
          <T x={918} y={116 + i * 56} weight={600} size={12.5}>{head}</T>
          <Wrap x={918} y={134 + i * 56} width={205} text={body} />
        </g>
      ))}
      <rect x={884} y={512} width={236} height={66} rx={8} fill="#f6f8fa" stroke="#e2e6eb" />
      <Wrap x={898} y={536} width={210} text="Sections have unlimited room, so nobody queues to shop. The only queues are at the counters." />
    </Diagram>
  )
}

// ------------------------------------------------------------- 2. overview
export function OverviewDiagram() {
  return (
    <Diagram width={1080} height={520} title="System overview" desc="Inputs feed the simulation engine, which produces performance measures, time series, an event trace and charts; experiments change the inputs and run again.">
      <T x={40} y={44} weight={600} size={13} colour={DC.ink2}>Inputs</T>
      <Box x={30} y={62} w={220} h={86} kind="data" title="Parameters" lines={['arrival rate and run length', 'counters and express counters', 'basket mix, scan and pay times']} />
      <Box x={30} y={166} w={220} h={70} kind="data" title="Random seed" lines={['drives every random draw', 'same seed gives the same day']} />
      <Box x={30} y={254} w={220} h={86} kind="data" title="Checkout strategy" lines={['Shortest Queue, Shortest', 'Estimated Waiting Time, or', 'Express and Normal']} />

      <Frame x={300} y={40} w={470} h={320} title="Simulation engine (Python package, no Django code)" />
      <Box x={326} y={80} w={196} h={70} kind="process" title="Customer generator" lines={['arrivals, baskets, routes', 'and service times']} />
      <Box x={548} y={80} w={196} h={70} kind="emphasis" title="Event list and clock" lines={['jumps from event to event']} />
      <Box x={548} y={196} w={196} h={70} kind="resource" title="Store state" lines={['queues, cashiers,', 'customers in the store']} />
      <Box x={326} y={196} w={196} h={70} kind="decision" title="Strategy" lines={['chooses a counter', 'at the checkout']} />
      <Box x={326} y={290} w={418} h={50} kind="process" title="Measures and statistics" lines={['time-weighted queue lengths, waits, utilisation']} />
      <Arrow points={[[522, 115], [548, 115]]} />
      <Label x={535} y={104} text="schedules" size={10} />
      <Arrow points={[[628, 150], [628, 196]]} />
      <Arrow points={[[664, 196], [664, 150]]} />
      <Label x={646} y={176} text="handlers change state" size={10} anchor="start" />
      <Arrow points={[[548, 220], [522, 220]]} />
      <Arrow points={[[522, 244], [548, 244]]} />
      <Label x={535} y={268} text="chosen counter" size={10} />
      <Label x={535} y={208} text="queues" size={10} />
      <Arrow points={[[646, 266], [646, 290]]} />

      <Arrow points={[[250, 105], [300, 105]]} />
      <Arrow points={[[250, 201], [300, 201]]} />
      <Arrow points={[[250, 297], [300, 297]]} />

      <T x={830} y={44} weight={600} size={13} colour={DC.ink2}>Outputs</T>
      <Box x={820} y={62} w={230} h={62} kind="data" title="Performance measures" lines={['waits, queues, utilisation']} />
      <Box x={820} y={136} w={230} h={62} kind="data" title="Time series" lines={['queue lengths, busy cashiers']} />
      <Box x={820} y={210} w={230} h={62} kind="data" title="Event trace" lines={['drives the floor-plan replay']} />
      <Box x={820} y={284} w={230} h={62} kind="data" title="Charts, tables, SQLite" lines={['dashboards and report figures']} />
      {[93, 167, 241, 315].map((y) => <Arrow key={y} points={[[770, y], [820, y]]} />)}

      <Arrow points={[[935, 346], [935, 420], [140, 420], [140, 340]]} dashed strong label="Experiment: change one input, run again, compare the outputs" labelAt={[540, 420]} />
      <KindLegend x={40} y={484} kinds={['data', 'process', 'decision', 'resource']} />
    </Diagram>
  )
}
