import type { Meta, Params, Point } from '../api'
import { num } from '../model'
import { DESK, DOOR_WIDTH, LANE_LENGTH, SERVICE_OFFSET } from '../sim/floorplan'
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
  const P = (p: Point): [number, number] => [X(p[0]), Y(p[1])]
  const half = DOOR_WIDTH / 2
  const doors = [L.entrance[0], L.exit[0]].sort((a, b) => a - b)
  const rows = L.aisle_rows
  const cross = L.cross_aisles
  // The engine's example route, then the drawn-only walk into a lane and out of the store
  const route = meta.example_route
  const target = Math.min(1, n - 1)
  const [tx, ty] = counters[target]
  const service: Point = [tx, ty - SERVICE_OFFSET]
  const laneOpen: Point = [tx, ty - SERVICE_OFFSET - LANE_LENGTH - 0.2]
  const exitWalk: Point[] = [service, [tx, L.exit_walk_y], [L.exit[0], L.exit_walk_y], [L.exit[0], L.height + 0.2]]
  const lastStop = route.stops[route.stops.length - 1]?.point ?? L.checkout_point
  const notes = [
    ['Enter', 'Customers arrive at random through the entrance.'],
    ['Walk along the walkways', 'Shortest path on the walkways. Time = route length / speed.'],
    ['Shop', 'Pick items at one spot in each section on the route.'],
    ['Walk to the checkouts', 'Only sections with items in the basket are visited.'],
    ['Choose a counter', 'The checkout strategy picks one counter here.'],
    ['Queue', 'Each counter has its own first-in, first-out queue.'],
    ['Pay and leave', 'Service = scan every item + pay, then walk out.'],
  ]

  return (
    <Diagram width={1140} height={680} title="Store layout and customer route" desc="Floor plan of the simulated supermarket with its walkways and the route one customer takes from the entrance along the aisles to three sections, a checkout counter and the exit.">
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
          {(L.shelves[k] ?? []).map((g, i) => <rect key={i} x={X(g.x)} y={Y(g.y)} width={g.w * s} height={g.h * s} fill="#dfe4ea" />)}
          <T x={X(r.x + 0.6)} y={Y(r.y + L.header_depth / 2) + 4} weight={600} size={12}>{meta.sections[k]}</T>
        </g>
      ))}
      {/* walkways: aisle rows, cross-aisles and the entrance walkway */}
      <g stroke="#b9c4d1" strokeWidth={1.2} strokeDasharray="2 4" fill="none">
        {rows.map((y) => <line key={y} x1={X(cross[0])} x2={X(cross[cross.length - 1])} y1={Y(y)} y2={Y(y)} />)}
        {cross.map((x) => <line key={x} x1={X(x)} x2={X(x)} y1={Y(rows[0])} y2={Y(rows[rows.length - 1])} />)}
        <line x1={X(L.entrance[0])} x2={X(L.entry_turn[0])} y1={Y(L.entrance[1])} y2={Y(L.entry_turn[1])} />
      </g>
      <T x={X(5.2)} y={Y(11.2)} size={11} colour={DC.ink3}>Main aisle (open floor)</T>
      {/* checkout lanes */}
      {counters.map(([cx, cy], i) => (
        <g key={i}>
          <line x1={X(cx - 0.55)} x2={X(cx - 0.55)} y1={Y(cy - SERVICE_OFFSET - LANE_LENGTH)} y2={Y(cy + 0.6)} stroke="#d3d9e0" />
          <line x1={X(cx + 0.55)} x2={X(cx + 0.55)} y1={Y(cy - SERVICE_OFFSET - LANE_LENGTH)} y2={Y(cy + 0.6)} stroke="#d3d9e0" />
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
      <T x={X(L.exit[0]) + 30} y={Y(L.height) + 18} anchor="middle" size={11.5} colour={DC.ink2}>Exit</T>
      {/* decision point */}
      <path d={`M${X(L.checkout_point[0])},${Y(L.checkout_point[1]) - 9}l9,9l-9,9l-9,-9z`} fill="#fff7e0" stroke="#e0b43c" strokeWidth={1.3} />

      {/* route: engine walks, then the drawn-only walk into the lane and out */}
      {route.paths.map((path, i) => <Arrow key={i} points={path.map(P)} accent />)}
      <Arrow points={[P(L.checkout_point), P(laneOpen), P(service)]} accent />
      <Arrow points={exitWalk.map(P)} accent dashed />
      {route.stops.map((stop, i) => (
        <g key={stop.section}>
          <circle cx={X(stop.point[0])} cy={Y(stop.point[1])} r={8} fill={DC.series} stroke="#ffffff" strokeWidth={2} />
          <text x={X(stop.point[0])} y={Y(stop.point[1]) + 3.8} fontSize={10} fontWeight={600} fill="#ffffff" textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      <circle cx={X(service[0])} cy={Y(service[1])} r={4} fill={DC.series} stroke="#ffffff" strokeWidth={2} />
      <Step x={X(L.entrance[0]) + 24} y={Y(L.entrance[1]) - 12} n={1} />
      <Step x={X(L.entrance[0]) + 22} y={Y(17)} n={2} />
      <Step x={X(route.stops[0]?.point[0] ?? 6) + 2} y={Y(route.stops[0]?.point[1] ?? 6) + 26} n={3} />
      <Step x={X((lastStop[0] + L.checkout_point[0]) / 2) + 6} y={Y((lastStop[1] + L.checkout_point[1]) / 2) + 22} n={4} />
      <Step x={X(L.checkout_point[0]) + 24} y={Y(L.checkout_point[1]) + 6} n={5} />
      <Step x={X(service[0]) - 26} y={Y(service[1] - 3)} n={6} />
      <Step x={X(L.exit[0]) - 26} y={Y(L.exit_walk_y) - 18} n={7} />

      {/* annotations */}
      <T x={890} y={80} weight={600} size={13.5}>One customer's journey</T>
      {notes.map(([head, body], i) => (
        <g key={i}>
          <Step x={900} y={112 + i * 60} n={i + 1} />
          <T x={918} y={116 + i * 60} weight={600} size={12.5}>{head}</T>
          <Wrap x={918} y={134 + i * 60} width={205} text={body} />
        </g>
      ))}
      <g>
        <line x1={886} x2={912} y1={548} y2={548} stroke="#b9c4d1" strokeWidth={1.4} strokeDasharray="2 4" />
        <Wrap x={920} y={552} width={200} text="Walkways. Shelving blocks the way, so customers change aisle only at a cross-aisle." />
        <line x1={886} x2={912} y1={600} y2={600} stroke={DC.series} strokeWidth={1.8} />
        <Wrap x={920} y={604} width={200} text="Route from the engine. Dashed: the walk out, drawn only." />
        <circle cx={899} cy={646} r={8} fill={DC.series} />
        <text x={899} y={649.8} fontSize={10} fontWeight={600} fill="#ffffff" textAnchor="middle">1</text>
        <Wrap x={920} y={650} width={200} text="Shopping spots, in the order visited." />
      </g>
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
