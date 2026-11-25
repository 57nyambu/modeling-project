import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { tokens } from '../theme'

// ---------------------------------------------------------------- scales
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * power >= raw - 1e-12) return m * power
  return 10 * power
}

/** Round axis maximum so ticks land on clean numbers. */
export function niceMax(max: number, count = 4, integer = false): number {
  if (!(max > 0)) return integer ? 1 : 1
  let step = niceStep(max / count)
  if (integer) step = Math.max(1, Math.ceil(step))
  return Math.ceil(max / step - 1e-9) * step
}

export function ticks(max: number, count = 4, integer = false, min = 0): number[] {
  let step = niceStep((max - min) / count)
  if (integer) step = Math.max(1, Math.ceil(step))
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(10)))
  return out
}

export const linear = (d0: number, d1: number, r0: number, r1: number) =>
  (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0)

export function tickLabel(v: number): string {
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}K`
  if (Number.isInteger(v)) return v.toLocaleString('en-GB')
  return String(Number(v.toFixed(3)))
}

// ----------------------------------------------------------------- sizing
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// ---------------------------------------------------------------- tooltip
export interface TooltipRow {
  label: string
  value: string
  colour?: string
}

export interface TooltipState {
  x: number
  y: number
  title: string
  rows: TooltipRow[]
}

/** Values lead, labels follow; series keyed with a short line in the series colour. */
export function ChartTooltip({ state, width }: { state: TooltipState | null; width: number }) {
  if (!state) return null
  const flip = state.x > width - 190
  return (
    <div
      className="chart-tooltip"
      style={{ left: flip ? undefined : state.x + 14, right: flip ? width - state.x + 14 : undefined, top: Math.max(0, state.y - 12) }}
      role="status"
    >
      <div className="tt-title">{state.title}</div>
      {state.rows.map((r) => (
        <div className="tt-row" key={r.label}>
          {r.colour && <span className="tt-key" style={{ background: r.colour }} />}
          <span>{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------- axes
export function YGrid({ values, y, x0, x1, format = tickLabel }: {
  values: number[]
  y: (v: number) => number
  x0: number
  x1: number
  format?: (v: number) => string
}) {
  return (
    <g>
      {values.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={v === 0 ? tokens.axis : tokens.grid} strokeWidth={1} shapeRendering="crispEdges" />
          <text x={x0 - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={tokens.ink2} className="num">{format(v)}</text>
        </g>
      ))}
    </g>
  )
}

export function XTicks({ values, x, y, format = tickLabel, label, width }: {
  values: number[]
  x: (v: number) => number
  y: number
  format?: (v: number) => string
  label?: string
  width: number
}) {
  return (
    <g>
      {values.map((v) => (
        <text key={v} x={x(v)} y={y + 16} textAnchor="middle" fontSize={11} fill={tokens.ink2} className="num">{format(v)}</text>
      ))}
      {label && <text x={width - 4} y={y + 16} textAnchor="end" fontSize={11} fill={tokens.ink3}>{label}</text>}
    </g>
  )
}

/** Rectangle with 4px rounded data end and a square end at the baseline. */
export function barPath(x: number, y: number, w: number, h: number, dir: 'up' | 'right', r = 4): string {
  if (w <= 0 || h <= 0) return ''
  if (dir === 'up') {
    const rr = Math.min(r, w / 2, h)
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
  }
  const rr = Math.min(r, h / 2, w)
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`
}

export function Legend({ items }: { items: { label: string; colour: string; shape?: 'line' | 'square' | 'dot' }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
      {items.map((i) => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: tokens.ink2 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              background: i.colour,
              width: i.shape === 'line' ? 14 : 10,
              height: i.shape === 'line' ? 2.5 : 10,
              borderRadius: i.shape === 'dot' ? 10 : 2,
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export function ChartBox({ children, height }: { children: ReactNode; height?: number }) {
  return <div style={{ position: 'relative', width: '100%', minHeight: height }}>{children}</div>
}
