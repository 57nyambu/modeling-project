import { STRATEGY_COLOURS } from '../format'
import { Arrow, Box, DC, Diagram, Diamond, Label, T, Wrap, textWidth } from './kit'

// ------------------------------------------------------ 9. strategies
export function StrategiesDiagram() {
  const head = (x: number, colour: string, name: string, rule: string) => (
    <g>
      <rect x={x} y={26} width={12} height={12} rx={2} fill={colour} />
      <T x={x + 20} y={37} weight={600} size={14}>{name}</T>
      <Wrap x={x} y={60} width={320} text={rule} size={12} />
    </g>
  )
  const E = (n: number) => 0.05 * n + 3.5 / 3
  const lanes = [
    { name: 'Counter 1', tag: 'express in Strategy 3', serving: 5, elapsed: 0.2, queue: [3, 4] },
    { name: 'Counter 2', tag: '', serving: 30, elapsed: 0.5, queue: [35] },
    { name: 'Counter 3', tag: '', serving: 12, elapsed: 1.0, queue: [6, 8] },
  ]
  const picks: Record<number, [string, string][]> = {
    0: [[STRATEGY_COLOURS.express, 'Express and Normal']],
    1: [[STRATEGY_COLOURS.shortest_queue, 'Shortest Queue']],
    2: [[STRATEGY_COLOURS.shortest_wait, 'Shortest Est. Wait']],
  }
  return (
    <Diagram width={1120} height={760} title="Checkout strategy decision rules" desc="How each of the three strategies chooses a counter, followed by one situation in which all three choose a different counter.">
      {head(30, STRATEGY_COLOURS.shortest_queue, 'Shortest Queue', 'Join the counter with the fewest customers, counting the one being served.')}
      {head(400, STRATEGY_COLOURS.shortest_wait, 'Shortest Estimated Waiting Time', 'Join the counter expected to start serving you soonest, judged from the basket sizes you can see.')}
      {head(770, STRATEGY_COLOURS.express, 'Express and Normal', 'Baskets of 5 items or fewer must use an express counter; larger baskets use normal counters.')}

      <Box x={30} y={110} w={320} h={70} title="For each counter c" lines={['n_c = customers waiting', '+ 1 if someone is being served']} />
      <Arrow points={[[190, 180], [190, 214]]} />
      <Box x={30} y={214} w={320} h={60} kind="decision" title="Choose the smallest n_c" lines={['ties go to the lowest counter number']} />

      <Box x={400} y={110} w={320} h={86} title="For each counter c" lines={['W_c = expected time left for the customer', 'being served + E[S | n] of everyone waiting', 'E[S | n] = n s + (a + b + c) / 3']} />
      <Arrow points={[[560, 196], [560, 214]]} />
      <Box x={400} y={214} w={320} h={60} kind="decision" title="Choose the smallest W_c" lines={['true service times stay hidden']} />

      <Diamond cx={930} cy={142} w={210} h={70} lines={['5 items', 'or fewer?']} />
      <Arrow points={[[825, 142], [800, 142], [800, 214]]} label="yes" labelAt={[808, 128]} />
      <Arrow points={[[1035, 142], [1060, 142], [1060, 214]]} label="no" labelAt={[1052, 128]} />
      <Box x={770} y={214} w={140} h={44} title="Express counters" size={12} />
      <Box x={950} y={214} w={140} h={44} title="Normal counters" size={12} />
      <Arrow points={[[840, 258], [840, 280], [930, 280], [930, 296]]} />
      <Arrow points={[[1020, 258], [1020, 280], [930, 280]]} />
      <Box x={790} y={296} w={280} h={52} kind="decision" title="Fewest customers in that group" lines={['a group with no counters: use all']} size={12.5} />

      <rect x={30} y={378} width={1060} height={356} rx={10} fill="#f8f9fb" stroke="#e2e6eb" />
      <T x={50} y={408} weight={600} size={13.5}>Example: a customer with 4 items reaches the checkout</T>
      <T x={50} y={428} size={11.5} colour={DC.ink2}>Numbers inside circles are basket sizes. Here s = 0.05 min per item and the average payment is 1.17 min.</T>
      <T x={600} y={462} size={11.5} weight={600} colour={DC.ink2}>Customers n_c</T>
      <T x={720} y={462} size={11.5} weight={600} colour={DC.ink2}>Expected wait W_c (min)</T>
      <T x={930} y={462} size={11.5} weight={600} colour={DC.ink2}>Chosen by</T>
      {lanes.map((l, i) => {
        const y = 500 + i * 72
        const left = E(l.serving) - l.elapsed
        const parts = [left, ...l.queue.map(E)]
        const w = parts.reduce((a, b) => a + b, 0)
        return (
          <g key={l.name}>
            <T x={50} y={y + 4} weight={600} size={12.5}>{l.name}</T>
            {l.tag && <T x={50} y={y + 22} size={11} colour={DC.ink2}>{l.tag}</T>}
            <rect x={470} y={y - 18} width={84} height={36} rx={6} fill={DC.ink} />
            <T x={512} y={y + 5} anchor="middle" size={11.5} weight={600} colour="#ffffff">till</T>
            <circle cx={440} cy={y} r={15} fill="#6a4ce2" stroke={DC.ink} strokeWidth={2.2} />
            <T x={440} y={y + 4} anchor="middle" size={11} weight={600} colour="#ffffff">{l.serving}</T>
            <T x={440} y={y + 30} anchor="middle" size={10} colour={DC.ink2}>{`${left.toFixed(2)} min left`}</T>
            {l.queue.map((n, k) => (
              <g key={k}>
                <circle cx={396 - k * 38} cy={y} r={15} fill="#a99af3" stroke="#ffffff" strokeWidth={2} />
                <T x={396 - k * 38} y={y + 4} anchor="middle" size={11} weight={600}>{n}</T>
              </g>
            ))}
            <T x={600} y={y + 5} size={13} weight={600}>{1 + l.queue.length}</T>
            <T x={720} y={y + 5} size={12} colour={DC.ink2}>{`${parts.map((p) => p.toFixed(3)).join(' + ')} =`}</T>
            <T x={726 + textWidth(`${parts.map((p) => p.toFixed(3)).join(' + ')} =`, 12)} y={y + 5} size={13} weight={600}>{w.toFixed(2)}</T>
            {(picks[i] ?? []).map(([c, name], k) => (
              <g key={name}>
                <rect x={930} y={y - 6 + k * 18} width={10} height={10} rx={2} fill={c} />
                <T x={946} y={y + 3 + k * 18} size={12} weight={500}>{name}</T>
              </g>
            ))}
          </g>
        )
      })}
      <Label x={560} y={716} text="Three strategies, three different choices: the fewest people is not always the shortest wait." size={12} colour={DC.ink} />
    </Diagram>
  )
}
