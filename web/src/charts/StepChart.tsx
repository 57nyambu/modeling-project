import { useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Steps } from '../api'
import { clock, fmt } from '../format'
import { tokens } from '../theme'
import { ChartTooltip, XTicks, YGrid, linear, niceMax, ticks, useWidth } from './core'
import type { TooltipState } from './core'

export interface StepSeries {
  key: string
  label: string
  colour: string
  points: Steps
}

/** Value of a step function at time t (last change point at or before t). */
export function valueAt(points: Steps, t: number): number {
  let lo = 0
  let hi = points.length - 1
  if (hi < 0 || t < points[0][0]) return 0
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid][0] <= t) lo = mid
    else hi = mid - 1
  }
  return points[lo][1]
}

export function maxOf(points: Steps): number {
  let m = 0
  for (const p of points) if (p[1] > m) m = p[1]
  return m
}

interface Props {
  series: StepSeries[]
  end: number
  height?: number
  yMax?: number
  integer?: boolean
  area?: boolean
  playhead?: number | null
  xLabel?: string
  showXAxis?: boolean
  valueFormat?: (v: number) => string
  ariaLabel: string
}

/** Step-function line chart (values change only at events) with crosshair tooltip and playhead. */
export function StepChart({
  series, end, height = 180, yMax, integer = true, area = series.length === 1, playhead = null,
  xLabel = 'min', showXAxis = true, valueFormat = (v) => (integer ? String(v) : fmt(v, 2)), ariaLabel,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const m = { top: 8, right: 10, bottom: showXAxis ? 26 : 6, left: 34 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const top = yMax ?? niceMax(Math.max(1, ...series.map((s) => maxOf(s.points))), 4, integer)
  const x = linear(0, end, m.left, m.left + innerW)
  const y = linear(0, top, m.top + innerH, m.top)
  const yTicks = ticks(top, innerH < 80 ? 2 : 4, integer)
  const xTicks = ticks(end, Math.max(2, Math.floor(innerW / 90)))

  const paths = useMemo(() => {
    return series.map((s) => {
      if (!s.points.length || width === 0) return { line: '', fill: '' }
      let d = `M${x(s.points[0][0]).toFixed(1)},${y(s.points[0][1]).toFixed(1)}`
      for (let i = 1; i < s.points.length; i++) {
        d += `H${x(s.points[i][0]).toFixed(1)}V${y(s.points[i][1]).toFixed(1)}`
      }
      d += `H${x(end).toFixed(1)}`
      const fill = `${d}V${y(0).toFixed(1)}H${x(s.points[0][0]).toFixed(1)}Z`
      return { line: d, fill }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, width, height, top, end])

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    const t = Math.max(0, Math.min(end, ((px - m.left) / innerW) * end))
    setTip({
      x: x(t),
      y: e.clientY - rect.top,
      title: `${fmt(t, 1)} min (${clock(t)})`,
      rows: series.map((s) => ({ label: s.label, value: valueFormat(valueAt(s.points, t)), colour: s.colour })),
    })
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {width > 0 && (
        <svg width={width} height={height} className="chart-svg" role="img" aria-label={ariaLabel}>
          <YGrid values={yTicks} y={y} x0={m.left} x1={m.left + innerW} />
          {paths.map((p, i) => (
            <g key={series[i].key}>
              {area && <path d={p.fill} fill={series[i].colour} fillOpacity={0.1} />}
              <path d={p.line} fill="none" stroke={series[i].colour} strokeWidth={series.length > 1 ? 1.5 : 1.6} strokeLinejoin="round" />
            </g>
          ))}
          {showXAxis && <XTicks values={xTicks} x={x} y={m.top + innerH} label={xLabel} width={width} />}
          {playhead !== null && playhead >= 0 && (
            <line x1={x(playhead)} x2={x(playhead)} y1={m.top} y2={m.top + innerH} stroke={tokens.ink} strokeWidth={1.5} />
          )}
          {tip && <line x1={tip.x} x2={tip.x} y1={m.top} y2={m.top + innerH} stroke={tokens.ink3} strokeWidth={1} />}
          <rect
            x={m.left} y={m.top} width={innerW} height={innerH} fill="transparent"
            onPointerMove={onMove} onPointerLeave={() => setTip(null)}
          />
        </svg>
      )}
      <ChartTooltip state={tip} width={width} />
    </div>
  )
}
