import type { Meta, Params } from '../api'
import { BASKET_COLOURS, STRATEGY_COLOURS, fmt } from '../format'
import {
  arrivalRateAt, expPdf, expectedService, itemsPmf, num, serviceSd, triangularPdf, validateParams,
} from '../model'
import { Arrow, Box, DC, Diagram, Frame, Label, Step, T, Wrap } from './kit'

interface Props {
  meta: Meta
  params: Params
}

/** Use the user's parameters when they are valid, otherwise the defaults. */
function usable(meta: Meta, params: Params): Params {
  return Object.keys(validateParams(params, meta)).length ? meta.defaults : params
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p
  return 10 * p
}

function axisTicks(min: number, max: number, count = 4) {
  const step = niceStep((max - min) / count)
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}

/** One small chart panel: a density curve, bars, or a mean line with a band. */
function Mini({ x, y, w, h, title, formula, xLabel, xMin, xMax, yMax, curve, bars, band, mean, yTicks = false }: {
  x: number
  y: number
  w: number
  h: number
  title: string
  formula: string
  xLabel: string
  xMin: number
  xMax: number
  yMax: number
  curve?: [number, number][]
  bars?: { x: number; y: number; colour: string }[]
  band?: [number, number, number][]
  mean?: { x: number; label: string }
  yTicks?: boolean
}) {
  const pl = x + (yTicks ? 40 : 14)
  const pr = x + w - 12
  const pt = y + 58
  const pb = y + h - 30
  const X = (v: number) => pl + ((v - xMin) / (xMax - xMin)) * (pr - pl)
  const Y = (v: number) => pb - (v / yMax) * (pb - pt)
  const line = curve ? curve.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('') : ''
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#ffffff" stroke={DC.line} />
      <T x={x + 14} y={y + 24} weight={600} size={13}>{title}</T>
      <T x={x + 14} y={y + 42} size={11} colour={DC.ink2} mono>{formula}</T>
      {yTicks && axisTicks(0, yMax, 4).map((v) => (
        <g key={v}>
          <line x1={pl} x2={pr} y1={Y(v)} y2={Y(v)} stroke={DC.grid} />
          <T x={pl - 6} y={Y(v) + 4} anchor="end" size={10} colour={DC.ink2}>{v}</T>
        </g>
      ))}
      {band && (
        <path
          d={`${band.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])},${Y(p[2])}`).join('')}${[...band].reverse().map((p) => `L${X(p[0])},${Y(p[1])}`).join('')}Z`}
          fill={DC.series} fillOpacity={0.12}
        />
      )}
      {curve && !band && <path d={`${line}L${X(curve[curve.length - 1][0])},${pb}L${X(curve[0][0])},${pb}Z`} fill={DC.series} fillOpacity={0.1} />}
      {curve && <path d={line} fill="none" stroke={DC.series} strokeWidth={2} strokeLinejoin="round" />}
      {bars && bars.map((b, i) => {
        const bw = Math.max(1.5, ((pr - pl) / (xMax - xMin)) * 0.72)
        return <rect key={i} x={X(b.x) - bw / 2} y={Y(b.y)} width={bw} height={pb - Y(b.y)} fill={b.colour} />
      })}
      <line x1={pl} x2={pr} y1={pb} y2={pb} stroke="#c2c8cf" />
      {axisTicks(xMin, xMax, 4).map((v) => (
        <T key={v} x={X(v)} y={pb + 15} anchor="middle" size={10} colour={DC.ink2}>{fmt(v, Number.isInteger(v) ? 0 : Number.isInteger(v * 10) ? 1 : 2)}</T>
      ))}
      <T x={pr} y={pb + 27} anchor="end" size={10} colour={DC.ink3}>{xLabel}</T>
      {mean && (
        <g>
          <line x1={X(mean.x)} x2={X(mean.x)} y1={pt - 2} y2={pb} stroke={DC.ink} strokeWidth={1.2} />
          <Label x={X(mean.x) + 5} y={pt + 6} text={mean.label} anchor="start" size={10.5} colour={DC.ink} />
        </g>
      )}
    </g>
  )
}

const range = (a: number, b: number, n = 80) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n)

// ------------------------------------------------- 10. input distributions
export function InputsDiagram({ meta, params }: Props) {
  const p = usable(meta, params)
  const lam = num(p, 'arrival_rate')
  const mp = num(p, 'mean_pick_time')
  const a = num(p, 'payment_min')
  const c = num(p, 'payment_mode')
  const b = num(p, 'payment_max')
  const v0 = num(p, 'walk_speed_min')
  const v1 = num(p, 'walk_speed_max')
  const L = num(p, 'large_max_items')
  const pmf = itemsPmf(p)
  const W = 345
  const H = 240
  const col = (i: number) => 30 + i * (W + 17)
  const row = (j: number) => 30 + j * (H + 18)
  const arrX = range(0, 4 / lam).map((x) => [x, expPdf(x, 1 / lam)] as [number, number])
  const pickX = range(0, 4 * mp).map((x) => [x, expPdf(x, mp)] as [number, number])
  const payX = range(a, b).map((x) => [x, triangularPdf(x, a, c, b)] as [number, number])
  const pad = (v1 - v0) * 0.25 || 0.1
  const walk: [number, number][] = [[v0 - pad, 0], [v0, 0], [v0, 1 / (v1 - v0 || 1)], [v1, 1 / (v1 - v0 || 1)], [v1, 0], [v1 + pad, 0]]
  const svc = Array.from({ length: L }, (_, i) => i + 1).map((n) => {
    const m = expectedService(p, n)
    const sd = serviceSd(p, n)
    return [n, Math.max(0, m - sd), m + sd] as [number, number, number]
  })
  const svcMax = Math.max(...svc.map((s) => s[2]))
  return (
    <Diagram width={1110} height={560} title="Random input distributions" desc="The probability distributions that generate arrivals, baskets, picking, payment, walking speed and service times, drawn from the current parameters.">
      <Mini x={col(0)} y={row(0)} w={W} h={H} title="Time between arrivals" formula={`Exponential, mean 1/lambda = ${fmt(1 / lam, 2)} min`}
        xLabel="minutes" xMin={0} xMax={4 / lam} yMax={lam * 1.1} curve={arrX} mean={{ x: 1 / lam, label: `mean ${fmt(1 / lam, 2)}` }} />
      <Mini x={col(1)} y={row(0)} w={W} h={H} title="Items in a basket" formula="uniform within small, medium and large"
        xLabel="items" xMin={0} xMax={L + 1} yMax={Math.max(...pmf.map((q) => q.p)) * 1.15} yTicks
        bars={pmf.map((q) => ({ x: q.n, y: q.p, colour: BASKET_COLOURS[q.n <= 5 ? 'small' : q.n <= 15 ? 'medium' : 'large'] }))} />
      <Mini x={col(2)} y={row(0)} w={W} h={H} title="Picking one item" formula={`Exponential, mean m_p = ${fmt(mp, 2)} min`}
        xLabel="minutes" xMin={0} xMax={4 * mp} yMax={(1 / mp) * 1.1} curve={pickX} mean={{ x: mp, label: `mean ${fmt(mp, 2)}` }} />
      <Mini x={col(0)} y={row(1)} w={W} h={H} title="Paying" formula={`Triangular(a = ${a}, c = ${c}, b = ${b}) min`}
        xLabel="minutes" xMin={a} xMax={b} yMax={(2 / (b - a)) * 1.15} curve={payX} mean={{ x: (a + b + c) / 3, label: `mean ${fmt((a + b + c) / 3, 2)}` }} />
      <Mini x={col(1)} y={row(1)} w={W} h={H} title="Walking speed" formula={`Uniform(${v0}, ${v1}) m/s`}
        xLabel="metres per second" xMin={v0 - pad} xMax={v1 + pad} yMax={(1 / (v1 - v0 || 1)) * 1.3} curve={walk} />
      <Mini x={col(2)} y={row(1)} w={W} h={H} title="Service time by basket size" formula="E[S | n] = n s + (a + b + c) / 3"
        xLabel="items in the basket" xMin={0} xMax={L} yMax={svcMax * 1.1} yTicks
        curve={svc.map((s) => [s[0], (s[1] + s[2]) / 2] as [number, number])} band={svc} />
      <T x={30} y={548} size={11} colour={DC.ink2}>
        {`Drawn from the current parameters. The service-time band is one standard deviation each side of the mean; the basket bars use the basket-size colours (small, medium, large).`}
      </T>
    </Diagram>
  )
}

// ------------------------------------------------------ 11. arrival process
export function ArrivalsDiagram({ meta, params }: Props) {
  const p = usable(meta, params)
  const T0 = num(p, 'duration')
  const lam = num(p, 'arrival_rate')
  const peakParams: Params = { ...p, arrival_profile: 'peak', peak_amplitude: p.arrival_profile === 'peak' ? num(p, 'peak_amplitude') : 1 }
  const A = num(peakParams, 'peak_amplitude')
  const xs = range(0, T0, 120)
  const yMax = lam * (1 + A / 2) * 1.15
  const pl = 80
  const pr = 620
  const pt = 70
  const pb = 380
  const X = (t: number) => pl + (t / T0) * (pr - pl)
  const Y = (v: number) => pb - (v / yMax) * (pb - pt)
  const peakLine = xs.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(arrivalRateAt(peakParams, t)).toFixed(1)}`).join('')
  return (
    <Diagram width={1100} height={470} title="Arrival process" desc="Arrival rate over the run for the constant and midday-peak profiles, and how the thinning method generates arrivals for a changing rate.">
      <T x={30} y={34} weight={600} size={13.5}>Arrival rate over the run</T>
      <T x={30} y={54} size={11.5} colour={DC.ink2}>{`lambda(t) = lambda ((1 - A/2) + A sin^2(pi t / T)), here lambda = ${lam}/min and A = ${A}`}</T>
      {axisTicks(0, yMax, 4).map((v) => (
        <g key={v}>
          <line x1={pl} x2={pr} y1={Y(v)} y2={Y(v)} stroke={DC.grid} />
          <T x={pl - 8} y={Y(v) + 4} anchor="end" size={10.5} colour={DC.ink2}>{v}</T>
        </g>
      ))}
      <path d={`${peakLine}L${X(T0)},${pb}L${X(0)},${pb}Z`} fill={DC.series} fillOpacity={0.1} />
      <path d={peakLine} fill="none" stroke={DC.series} strokeWidth={2.2} />
      <line x1={X(0)} x2={X(T0)} y1={Y(lam)} y2={Y(lam)} stroke={DC.ink} strokeWidth={1.6} />
      <Label x={X(T0 * 0.03)} y={Y(lam) - 8} text={`Constant profile: ${lam} per min all day`} anchor="start" colour={DC.ink} bg={false} />
      <Label x={X(T0 / 2)} y={Y(lam * (1 + A / 2)) - 10} text={`Midday peak: ${fmt(lam * (1 + A / 2), 2)} per min`} colour={DC.ink} bg={false} />
      <Label x={X(T0 * 0.03)} y={Y(lam * (1 - A / 2)) + 20} text={`${fmt(lam * (1 - A / 2), 2)} at opening and closing`} anchor="start" bg={false} />
      <line x1={pl} x2={pr} y1={pb} y2={pb} stroke="#c2c8cf" />
      {axisTicks(0, T0, 4).map((t) => <T key={t} x={X(t)} y={pb + 18} anchor="middle" size={10.5} colour={DC.ink2}>{t}</T>)}
      <T x={pr} y={pb + 34} anchor="end" size={10.5} colour={DC.ink3}>minutes after opening</T>
      <g transform={`translate(36,${(pt + pb) / 2}) rotate(-90)`}><T x={0} y={0} anchor="middle" size={10.5} colour={DC.ink3}>customers per minute</T></g>
      <Wrap x={pl} y={438} width={540} text="Both profiles bring the same number of customers on average: the area under each line is the same." />

      <T x={680} y={34} weight={600} size={13.5}>Thinning: arrivals for a changing rate</T>
      <Step x={690} y={84} n={1} />
      <Box x={710} y={62} w={360} h={62} align="start" title="Draw a candidate at the peak rate" lines={['t = t - ln(1 - U) / lambda_max, U ~ Uniform(0, 1)']} size={12.5} />
      <Arrow points={[[890, 124], [890, 146]]} />
      <Step x={690} y={168} n={2} />
      <Box x={710} y={146} w={360} h={62} align="start" title="Keep it with probability lambda(t) / lambda_max" lines={['a second uniform number decides']} size={12.5} />
      <Arrow points={[[890, 208], [890, 230]]} />
      <Step x={690} y={252} n={3} />
      <Box x={710} y={230} w={360} h={62} align="start" title="Repeat until t passes closing time T" lines={['kept candidates are the arrival times']} size={12.5} />
      <Wrap x={690} y={330} width={380} text="With the constant profile every candidate is kept, which is the ordinary Poisson process: exponential gaps with mean 1/lambda. All arrival times are generated from the seed before the run starts." />
    </Diagram>
  )
}

// ---------------------------------------------------- 12. measuring performance
export function MeasuresDiagram() {
  const pl = 70
  const pr = 590
  const X = (t: number) => pl + (t / 8) * (pr - pl)
  const qb = 250
  const qs = 52
  const q: [number, number][] = [[0, 0], [2, 1], [2.5, 2], [4, 1], [6, 0], [8, 0]]
  let path = `M${X(0)},${qb}`
  for (let i = 1; i < q.length; i++) path += `H${X(q[i][0])}V${qb - q[i][1] * qs}`
  const cards: [string, string, string][] = [
    ['Average queue length', 'Lq = (1/T) x area under Q(t)', 'time-weighted: a long queue counts for as long as it lasts'],
    ['Average waiting time', 'Wq = (1/N) x sum of (service start - queue join)', 'over customers whose service started'],
    ['Cashier utilisation', 'rho_c = busy time of counter c / T', 'busy time is clipped at closing time'],
    ['Average time in store', 'W = (1/N) x sum of (departure - arrival)', 'over customers who were served'],
    ["Little's law", 'Lq = arrival rate x Wq', 'a built-in consistency check on every run'],
  ]
  return (
    <Diagram width={1100} height={480} title="Measuring performance" desc="How time-weighted queue length, waiting time, utilisation, time in store and Little's law are calculated, illustrated with the three-customer example.">
      <T x={30} y={34} weight={600} size={13.5}>Queue length is a step function</T>
      <Wrap x={30} y={54} width={560} text="Q(t) only changes at events, so its area is an exact sum of rectangles: value x how long it lasted. Dividing by T gives the time-weighted average." />
      {[0, 1, 2].map((v) => (
        <g key={v}>
          <line x1={pl} x2={pr} y1={qb - v * qs} y2={qb - v * qs} stroke={v ? DC.grid : '#c2c8cf'} />
          <T x={pl - 8} y={qb - v * qs + 4} anchor="end" size={10.5} colour={DC.ink2}>{v}</T>
        </g>
      ))}
      <rect x={X(2)} y={qb - qs} width={X(2.5) - X(2)} height={qs} fill={DC.series} fillOpacity={0.12} />
      <rect x={X(2.5)} y={qb - 2 * qs} width={X(4) - X(2.5)} height={2 * qs} fill={DC.series} fillOpacity={0.2} />
      <rect x={X(4)} y={qb - qs} width={X(6) - X(4)} height={qs} fill={DC.series} fillOpacity={0.12} />
      <path d={path} fill="none" stroke={DC.series} strokeWidth={2.2} />
      <Label x={X(2.25)} y={qb - qs - 10} text="0.5" colour={DC.ink} />
      <Label x={X(3.25)} y={qb - 2 * qs - 10} text="1.5 x 2 = 3.0" colour={DC.ink} />
      <Label x={X(5)} y={qb - qs - 10} text="2 x 1 = 2.0" colour={DC.ink} />
      {[0, 2, 4, 6, 8].map((t) => <T key={t} x={X(t)} y={qb + 18} anchor="middle" size={10.5} colour={DC.ink2}>{t}</T>)}
      <T x={pr} y={qb + 34} anchor="end" size={10.5} colour={DC.ink3}>minutes</T>
      <T x={pl} y={qb + 70} size={12.5} weight={600}>Area = 0.5 + 3.0 + 2.0 = 5.5 customer-minutes</T>
      <T x={pl} y={qb + 92} size={12.5}>Over T = 20 minutes: Lq = 5.5 / 20 = 0.275 customers waiting on average</T>
      <rect x={X(1)} y={qb + 112} width={X(7) - X(1)} height={18} rx={3} fill={DC.ink} />
      <T x={(X(1) + X(7)) / 2} y={qb + 125} anchor="middle" size={11} colour="#ffffff">cashier busy 6 of 20 minutes: utilisation 30%</T>

      {cards.map(([title, formula, note], i) => (
        <g key={title}>
          <rect x={650} y={30 + i * 92} width={420} height={80} rx={8} fill={i === 0 ? '#eef4fd' : '#ffffff'} stroke={i === 0 ? '#9dbbe8' : DC.line} />
          <T x={666} y={54 + i * 92} weight={600} size={13}>{title}</T>
          <T x={666} y={74 + i * 92} size={12} mono>{formula}</T>
          <T x={666} y={94 + i * 92} size={11} colour={DC.ink2}>{note}</T>
        </g>
      ))}
    </Diagram>
  )
}

// -------------------------------------------------- 13. experiment design
export function ExperimentDiagram() {
  const strategies: [string, string][] = [
    [STRATEGY_COLOURS.shortest_queue, 'Shortest Queue'],
    [STRATEGY_COLOURS.shortest_wait, 'Shortest Estimated Wait'],
    [STRATEGY_COLOURS.express, 'Express and Normal'],
  ]
  return (
    <Diagram width={1100} height={500} title="Experiment design" desc="Each replication uses a new seed to generate one set of customers that all three strategies serve (common random numbers); results over replications give means, confidence intervals and paired differences.">
      <Frame x={30} y={30} w={660} h={330} title="Repeat for each replication r = 1, 2, ..., R" />
      <Box x={56} y={74} w={170} h={60} kind="data" title="Seed + r - 1" lines={['a new random stream']} />
      <Arrow points={[[226, 104], [262, 104]]} />
      <Box x={262} y={64} w={190} h={80} kind="process" title="Generate customers" lines={['once per replication:', 'arrivals, baskets, routes,', 'service times']} />
      {strategies.map(([c, name], i) => {
        const y = 170 + i * 60
        return (
          <g key={name}>
            <Arrow points={[[357, 144], [357, 158], [490, 158], [490, y + 22], [500, y + 22]]} />
            <rect x={500} y={y} width={172} height={44} rx={8} fill="#ffffff" stroke={DC.line} />
            <rect x={512} y={y + 17} width={10} height={10} rx={2} fill={c} />
            <T x={530} y={y + 27} size={12} weight={600}>{name}</T>
          </g>
        )
      })}
      <Label x={425} y={174} text="identical customers" size={10.5} />
      <Box x={56} y={186} w={380} h={150} kind="note" align="start" title="Common random numbers"
        lines={['All three strategies see the same arrivals,', 'baskets, routes and service times. Any', 'difference in a replication is caused by', 'the strategy, so the comparison is fair and', 'needs fewer replications.']} size={12.5} />

      <Arrow points={[[690, 120], [736, 120]]} strong />
      <Arrow points={[[690, 270], [736, 270]]} strong />
      <Box x={736} y={60} w={334} h={120} kind="process" align="start" title="Summarise each measure"
        lines={['mean over R replications', 'standard deviation s', '95% CI = mean +/- t(R-1) x s / sqrt(R)']} size={12.5} />
      <Box x={736} y={200} w={334} h={140} kind="decision" align="start" title="Paired differences"
        lines={['d_r = X_r(strategy) - X_r(Shortest Queue)', 'mean of d with its own 95% CI', 'interval excludes 0: significant difference', 'interval includes 0: no evidence of one']} size={12.5} />
      <rect x={30} y={390} width={1040} height={80} rx={8} fill="#f6f8fa" stroke="#e2e6eb" />
      <Wrap x={48} y={416} width={1000} size={12} text="Why replications? One run is one random day. Ten or more replications show how much the results vary from day to day, and the confidence interval says how precisely the average is known. The comparison page and its CSV export show every replication." />
    </Diagram>
  )
}
