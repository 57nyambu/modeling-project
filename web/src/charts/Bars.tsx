import { useState } from 'react'
import { fmt } from '../format'
import { tokens } from '../theme'
import { ChartTooltip, Legend, XTicks, YGrid, barPath, linear, niceMax, ticks, useWidth } from './core'
import type { TooltipState } from './core'

// ------------------------------------------------- horizontal bars with CI
export interface CiRow {
  key: string
  label: string
  colour: string
  mean: number
  ci?: number
  n?: number
}

/** Horizontal bars with 95% confidence whiskers; the value sits at the end of each whisker. */
export function BarsCI({ rows, unit = '', digits = 2, ariaLabel, labelWidth = 136, scale = 1 }: {
  rows: CiRow[]
  unit?: string
  digits?: number
  ariaLabel: string
  labelWidth?: number
  scale?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const band = 34
  const thick = 18
  const m = { top: 4, right: 92, bottom: 24, left: labelWidth }
  const height = m.top + rows.length * band + m.bottom
  const innerW = Math.max(10, width - m.left - m.right)
  const maxVal = Math.max(...rows.map((r) => (r.mean + (r.ci ?? 0)) * scale), 0)
  const top = niceMax(maxVal, 4)
  const x = linear(0, top, m.left, m.left + innerW)
  const xTicks = ticks(top, Math.max(2, Math.floor(innerW / 80)))
  const f = (v: number) => fmt(v * scale, digits)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} className="chart-svg" role="img" aria-label={ariaLabel}>
          {xTicks.map((v) => (
            <line key={v} x1={x(v)} x2={x(v)} y1={m.top} y2={height - m.bottom} stroke={v === 0 ? tokens.axis : tokens.grid} shapeRendering="crispEdges" />
          ))}
          <XTicks values={xTicks} x={x} y={height - m.bottom} width={width} label={unit} />
          {rows.map((r, i) => {
            const cy = m.top + i * band + band / 2
            const w = x(r.mean * scale) - x(0)
            const lo = x(Math.max(0, (r.mean - (r.ci ?? 0)) * scale))
            const hi = x((r.mean + (r.ci ?? 0)) * scale)
            return (
              <g
                key={r.key}
                tabIndex={0}
                onPointerEnter={() => setTip({
                  x: hi, y: cy, title: r.label,
                  rows: [
                    { label: 'Mean', value: `${f(r.mean)} ${unit}`.trim() },
                    ...(r.ci !== undefined ? [{ label: '95% CI', value: `${f(r.mean - r.ci)} to ${f(r.mean + r.ci)}` }] : []),
                    ...(r.n ? [{ label: 'Replications', value: String(r.n) }] : []),
                  ],
                })}
                onPointerLeave={() => setTip(null)}
                onFocus={() => setTip({ x: hi, y: cy, title: r.label, rows: [{ label: 'Mean', value: f(r.mean) }] })}
                onBlur={() => setTip(null)}
                style={{ outline: 'none' }}
              >
                <rect x={0} y={cy - band / 2} width={width} height={band} fill="transparent" />
                <text x={m.left - 10} y={cy} dy="0.32em" textAnchor="end" fontSize={12} fill={tokens.ink}>{r.label}</text>
                <path d={barPath(x(0), cy - thick / 2, w, thick, 'right')} fill={r.colour} />
                {r.ci !== undefined && r.ci > 0 && (
                  <g stroke={tokens.ink} strokeWidth={1.25}>
                    <line x1={lo} x2={hi} y1={cy} y2={cy} />
                    <line x1={lo} x2={lo} y1={cy - 5} y2={cy + 5} />
                    <line x1={hi} x2={hi} y1={cy - 5} y2={cy + 5} />
                  </g>
                )}
                <text x={Math.max(hi, x(0) + w) + 8} y={cy} dy="0.32em" fontSize={12} fill={tokens.ink} className="num">
                  <tspan fontWeight={600}>{f(r.mean)}</tspan>
                  {r.ci !== undefined && <tspan fill={tokens.ink2}>{` ± ${f(r.ci)}`}</tspan>}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <ChartTooltip state={tip} width={width} />
    </div>
  )
}

// ------------------------------------------------------- grouped columns
export interface GroupedSeries {
  key: string
  label: string
  colour: string
  values: { mean: number; ci?: number }[]
}

export function GroupedColumns({ groups, series, unit = '', height = 220, digits = 2, ariaLabel }: {
  groups: string[]
  series: GroupedSeries[]
  unit?: string
  height?: number
  digits?: number
  ariaLabel: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const m = { top: 10, right: 8, bottom: 26, left: 40 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const maxVal = Math.max(0, ...series.flatMap((s) => s.values.map((v) => v.mean + (v.ci ?? 0))))
  const top = niceMax(maxVal, 4)
  const y = linear(0, top, m.top + innerH, m.top)
  const groupW = innerW / groups.length
  const colW = Math.min(24, (groupW * 0.7 - 2 * (series.length - 1)) / series.length)
  const clusterW = colW * series.length + 2 * (series.length - 1)

  return (
    <div>
      <div style={{ marginBottom: 8 }}><Legend items={series.map((s) => ({ label: s.label, colour: s.colour }))} /></div>
      <div ref={ref} style={{ position: 'relative' }}>
        {width > 0 && (
          <svg width={width} height={height} className="chart-svg" role="img" aria-label={ariaLabel}>
            <YGrid values={ticks(top, 4)} y={y} x0={m.left} x1={m.left + innerW} />
            {groups.map((g, gi) => {
              const gx = m.left + gi * groupW + (groupW - clusterW) / 2
              return (
                <g key={g}>
                  <text x={m.left + gi * groupW + groupW / 2} y={height - m.bottom + 16} textAnchor="middle" fontSize={11} fill={tokens.ink2}>{g}</text>
                  {series.map((s, si) => {
                    const v = s.values[gi]
                    const cx = gx + si * (colW + 2)
                    const h = y(0) - y(v.mean)
                    const hiY = y(v.mean + (v.ci ?? 0))
                    const loY = y(Math.max(0, v.mean - (v.ci ?? 0)))
                    return (
                      <g
                        key={s.key}
                        onPointerEnter={() => setTip({
                          x: cx + colW, y: hiY, title: `${s.label}, ${g}`,
                          rows: [
                            { label: 'Mean', value: `${fmt(v.mean, digits)} ${unit}`.trim() },
                            ...(v.ci !== undefined ? [{ label: '95% CI', value: `± ${fmt(v.ci, digits)}` }] : []),
                          ],
                        })}
                        onPointerLeave={() => setTip(null)}
                      >
                        <rect x={cx - 1} y={m.top} width={colW + 2} height={innerH} fill="transparent" />
                        <path d={barPath(cx, y(v.mean), colW, h, 'up')} fill={s.colour} />
                        {v.ci !== undefined && v.ci > 0 && (
                          <g stroke={tokens.ink} strokeWidth={1.1}>
                            <line x1={cx + colW / 2} x2={cx + colW / 2} y1={hiY} y2={loY} />
                            <line x1={cx + colW / 2 - 3.5} x2={cx + colW / 2 + 3.5} y1={hiY} y2={hiY} />
                            <line x1={cx + colW / 2 - 3.5} x2={cx + colW / 2 + 3.5} y1={loY} y2={loY} />
                          </g>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        )}
        <ChartTooltip state={tip} width={width} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------- histogram
export function Histogram({ edges, counts, mean, unit = 'min', height = 200, ariaLabel, colour = tokens.series }: {
  edges: number[]
  counts: number[]
  mean?: number
  unit?: string
  height?: number
  ariaLabel: string
  colour?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const m = { top: 18, right: 10, bottom: 26, left: 40 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const lastEdge = edges[edges.length - 1] ?? 1
  const x = linear(0, lastEdge, m.left, m.left + innerW)
  const top = niceMax(Math.max(1, ...counts), 4, true)
  const y = linear(0, top, m.top + innerH, m.top)
  const xTicks = ticks(lastEdge, Math.max(2, Math.floor(innerW / 70)))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} className="chart-svg" role="img" aria-label={ariaLabel}>
          <YGrid values={ticks(top, 4, true)} y={y} x0={m.left} x1={m.left + innerW} />
          {counts.map((c, i) => {
            const x0 = x(edges[i]) + 1
            const w = Math.max(1, x(edges[i + 1]) - x(edges[i]) - 2)
            return (
              <g key={i}
                onPointerEnter={() => setTip({
                  x: x0 + w, y: y(c), title: `${fmt(edges[i], 2)} to ${fmt(edges[i + 1], 2)} ${unit}`,
                  rows: [{ label: 'Customers', value: String(c) }],
                })}
                onPointerLeave={() => setTip(null)}>
                <rect x={x0 - 1} y={m.top} width={w + 2} height={innerH} fill="transparent" />
                <path d={barPath(x0, y(c), w, y(0) - y(c), 'up', 3)} fill={colour} />
              </g>
            )
          })}
          {mean !== undefined && mean > 0 && (
            <g>
              <line x1={x(mean)} x2={x(mean)} y1={m.top - 4} y2={m.top + innerH} stroke={tokens.ink} strokeWidth={1.25} />
              <text x={x(mean) + 5} y={m.top - 6} fontSize={11} fill={tokens.ink} dy="0.6em">Mean {fmt(mean, 2)} {unit}</text>
            </g>
          )}
          <XTicks values={xTicks} x={x} y={m.top + innerH} width={width} label={unit} />
        </svg>
      )}
      <ChartTooltip state={tip} width={width} />
    </div>
  )
}

// ------------------------------------------------- paired replication dots
export function PairedDots({ columns, replications, digits = 2, unit = 'min', height = 260, ariaLabel }: {
  columns: { key: string; label: string; colour: string; values: number[] }[]
  replications: number
  digits?: number
  unit?: string
  height?: number
  ariaLabel: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const m = { top: 10, right: 12, bottom: 28, left: 44 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const top = niceMax(Math.max(0.01, ...columns.flatMap((c) => c.values)), 4)
  const y = linear(0, top, m.top + innerH, m.top)
  const colX = (i: number) => m.left + innerW * ((i + 0.5) / columns.length)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} className="chart-svg" role="img" aria-label={ariaLabel}>
          <YGrid values={ticks(top, 4)} y={y} x0={m.left} x1={m.left + innerW} />
          {Array.from({ length: replications }, (_, r) => (
            <polyline
              key={r}
              points={columns.map((c, i) => `${colX(i)},${y(c.values[r] ?? 0)}`).join(' ')}
              fill="none" stroke={tokens.lineStrong} strokeWidth={1}
            />
          ))}
          {columns.map((c, i) => {
            const mean = c.values.reduce((s, v) => s + v, 0) / Math.max(1, c.values.length)
            return (
              <g key={c.key}>
                <text x={colX(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={tokens.ink2}>{c.label}</text>
                <line x1={colX(i) - 26} x2={colX(i) + 26} y1={y(mean)} y2={y(mean)} stroke={tokens.ink} strokeWidth={2.5} strokeLinecap="round" />
                {c.values.map((v, r) => (
                  <g key={r}
                    onPointerEnter={() => setTip({
                      x: colX(i), y: y(v), title: `Replication ${r + 1}`,
                      rows: [{ label: c.label, value: `${fmt(v, digits)} ${unit}`, colour: c.colour }],
                    })}
                    onPointerLeave={() => setTip(null)}>
                    <circle cx={colX(i)} cy={y(v)} r={12} fill="transparent" />
                    <circle cx={colX(i)} cy={y(v)} r={4.5} fill={c.colour} stroke="#ffffff" strokeWidth={2} />
                  </g>
                ))}
              </g>
            )
          })}
        </svg>
      )}
      <ChartTooltip state={tip} width={width} />
    </div>
  )
}
