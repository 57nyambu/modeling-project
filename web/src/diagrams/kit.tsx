// Diagram primitives. Every colour is a literal value (not a CSS variable) so a
// diagram exported as SVG or PNG looks exactly like it does in the app.

import type { ReactNode } from 'react'

export const DC = {
  ink: '#172331',
  ink2: '#556270',
  ink3: '#8793a0',
  line: '#d5dbe2',
  grid: '#eef1f4',
  edge: '#5d6b7a',
  white: '#ffffff',
  series: '#257de0',
  font: '"IBM Plex Sans", "Segoe UI", system-ui, -apple-system, sans-serif',
  mono: '"IBM Plex Mono", Consolas, ui-monospace, monospace',
}

export type Kind = 'process' | 'decision' | 'resource' | 'entity' | 'data' | 'note' | 'event' | 'terminal' | 'emphasis' | 'plain'

export const KIND: Record<Kind, { fill: string; stroke: string; text: string; sub: string }> = {
  process: { fill: '#eef4fd', stroke: '#9dbbe8', text: DC.ink, sub: DC.ink2 },
  decision: { fill: '#fff7e0', stroke: '#e0b43c', text: DC.ink, sub: DC.ink2 },
  resource: { fill: '#e9f7f1', stroke: '#74c7a5', text: DC.ink, sub: DC.ink2 },
  entity: { fill: '#f2effd', stroke: '#aa9cf0', text: DC.ink, sub: DC.ink2 },
  data: { fill: '#f5f7f9', stroke: '#b5bec8', text: DC.ink, sub: DC.ink2 },
  note: { fill: '#ffffff', stroke: '#d5dbe2', text: DC.ink, sub: DC.ink2 },
  event: { fill: '#172331', stroke: '#172331', text: '#ffffff', sub: '#c9d2dc' },
  terminal: { fill: '#ffffff', stroke: '#172331', text: DC.ink, sub: DC.ink2 },
  emphasis: { fill: '#172331', stroke: '#172331', text: '#ffffff', sub: '#c9d2dc' },
  plain: { fill: 'none', stroke: 'none', text: DC.ink, sub: DC.ink2 },
}

export const KIND_LABEL: Partial<Record<Kind, string>> = {
  process: 'Activity or step',
  decision: 'Decision',
  resource: 'Resource',
  entity: 'Entity',
  data: 'Data or input',
  event: 'Event',
  terminal: 'Start or end',
}

/** Rough text width for label backgrounds (IBM Plex Sans averages ~0.56 em). */
export const textWidth = (s: string, size: number, mono = false) => s.length * size * (mono ? 0.6 : 0.52)

export function Diagram({ width, height, title, desc, children }: {
  width: number
  height: number
  title: string
  desc: string
  children: ReactNode
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
      fontFamily={DC.font}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 z" fill={DC.edge} />
        </marker>
        <marker id="arrow-strong" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 z" fill={DC.ink} />
        </marker>
        <marker id="arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 z" fill={DC.series} />
        </marker>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={DC.white} />
      {children}
    </svg>
  )
}

export function T({ x, y, children, size = 12, weight = 400, colour = DC.ink, anchor = 'start', mono = false, italic = false }: {
  x: number
  y: number
  children: ReactNode
  size?: number
  weight?: number
  colour?: string
  anchor?: 'start' | 'middle' | 'end'
  mono?: boolean
  italic?: boolean
}) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} fill={colour} textAnchor={anchor}
      fontFamily={mono ? DC.mono : undefined} fontStyle={italic ? 'italic' : undefined}>
      {children}
    </text>
  )
}

/** Box with a bold title and optional lines underneath, centred or left aligned. */
export function Box({ x, y, w, h, kind = 'process', title, lines = [], align = 'middle', r = 8, size = 13, mono = false, strokeWidth = 1.3 }: {
  x: number
  y: number
  w: number
  h: number
  kind?: Kind
  title?: string
  lines?: string[]
  align?: 'middle' | 'start'
  r?: number
  size?: number
  mono?: boolean
  strokeWidth?: number
}) {
  const k = KIND[kind]
  const lineH = size + 4
  const block = (title ? size + 2 : 0) + lines.length * lineH
  const top = y + (h - block) / 2 + size - 1
  const tx = align === 'middle' ? x + w / 2 : x + 12
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={k.fill} stroke={k.stroke} strokeWidth={kind === 'terminal' ? 1.8 : strokeWidth} />
      {title && (
        <text x={tx} y={top} fontSize={size} fontWeight={600} fill={k.text} textAnchor={align} fontFamily={mono ? DC.mono : undefined}>
          {title}
        </text>
      )}
      {lines.map((l, i) => (
        <text key={i} x={tx} y={top + (title ? size + 4 : 0) + i * lineH} fontSize={size - 1.5} fill={k.sub} textAnchor={align}>
          {l}
        </text>
      ))}
    </g>
  )
}

/** Class-style box: a header band with the name, then attribute rows. */
export function ClassBox({ x, y, w, kind, title, subtitle, rows, rowH = 19 }: {
  x: number
  y: number
  w: number
  kind: Kind
  title: string
  subtitle?: string
  rows: string[]
  rowH?: number
}) {
  const k = KIND[kind]
  const head = subtitle ? 46 : 32
  const h = head + rows.length * rowH + 10
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={DC.white} stroke={k.stroke} strokeWidth={1.3} />
      <path d={`M${x},${y + head}V${y + 8}Q${x},${y} ${x + 8},${y}H${x + w - 8}Q${x + w},${y} ${x + w},${y + 8}V${y + head}Z`} fill={k.fill} />
      <line x1={x} x2={x + w} y1={y + head} y2={y + head} stroke={k.stroke} />
      <T x={x + 12} y={y + 21} weight={600} size={13.5}>{title}</T>
      {subtitle && <T x={x + 12} y={y + 38} size={11} colour={DC.ink2}>{subtitle}</T>}
      {rows.map((r, i) => (
        <T key={i} x={x + 12} y={y + head + 18 + i * rowH} size={11.5} colour={DC.ink2}>{r}</T>
      ))}
    </g>
  )
}

export function Diamond({ cx, cy, w, h, lines, size = 12 }: { cx: number; cy: number; w: number; h: number; lines: string[]; size?: number }) {
  const k = KIND.decision
  const lh = size + 3
  const top = cy - ((lines.length - 1) * lh) / 2 + size / 3
  return (
    <g>
      <path d={`M${cx},${cy - h / 2}L${cx + w / 2},${cy}L${cx},${cy + h / 2}L${cx - w / 2},${cy}Z`} fill={k.fill} stroke={k.stroke} strokeWidth={1.3} strokeLinejoin="round" />
      {lines.map((l, i) => (
        <text key={i} x={cx} y={top + i * lh} fontSize={size} fontWeight={i === 0 ? 600 : 400} fill={DC.ink} textAnchor="middle">{l}</text>
      ))}
    </g>
  )
}

export function Pill({ x, y, w, h = 34, text, kind = 'terminal', mono = false, size = 13 }: {
  x: number
  y: number
  w: number
  h?: number
  text: string
  kind?: Kind
  mono?: boolean
  size?: number
}) {
  const k = KIND[kind]
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={k.fill} stroke={k.stroke} strokeWidth={kind === 'terminal' ? 1.8 : 1.3} />
      <text x={x + w / 2} y={y + h / 2 + size / 3} fontSize={size} fontWeight={600} fill={k.text} textAnchor="middle" fontFamily={mono ? DC.mono : undefined}>{text}</text>
    </g>
  )
}

export function Cylinder({ x, y, w, h, title, lines = [] }: { x: number; y: number; w: number; h: number; title: string; lines?: string[] }) {
  const k = KIND.data
  const e = 9
  return (
    <g>
      <path d={`M${x},${y + e}V${y + h - e}A${w / 2},${e} 0 0 0 ${x + w},${y + h - e}V${y + e}`} fill={k.fill} stroke={k.stroke} strokeWidth={1.3} />
      <ellipse cx={x + w / 2} cy={y + e} rx={w / 2} ry={e} fill={k.fill} stroke={k.stroke} strokeWidth={1.3} />
      <T x={x + w / 2} y={y + e + 26} anchor="middle" weight={600} size={13}>{title}</T>
      {lines.map((l, i) => <T key={i} x={x + w / 2} y={y + e + 44 + i * 16} anchor="middle" size={11} colour={DC.ink2}>{l}</T>)}
    </g>
  )
}

export function Label({ x, y, text, size = 11, anchor = 'middle', colour = DC.ink2, bg = true, weight = 400, mono = false }: {
  x: number
  y: number
  text: string
  size?: number
  anchor?: 'start' | 'middle' | 'end'
  colour?: string
  bg?: boolean
  weight?: number
  mono?: boolean
}) {
  const w = textWidth(text, size, mono) + 8
  const bx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w + 4 : x - 4
  return (
    <g>
      {bg && <rect x={bx} y={y - size + 1} width={w} height={size + 5} rx={3} fill={DC.white} />}
      <text x={x} y={y + 1} fontSize={size} fill={colour} textAnchor={anchor} fontWeight={weight} fontFamily={mono ? DC.mono : undefined}>{text}</text>
    </g>
  )
}

type Pt = [number, number]

/** Polyline arrow through the given points, with an optional label. */
export function Arrow({ points, label, labelAt, labelAnchor = 'middle', strong = false, accent = false, dashed = false, both = false, labelSize = 11, curve = false }: {
  points: Pt[]
  label?: string
  labelAt?: Pt
  labelAnchor?: 'start' | 'middle' | 'end'
  strong?: boolean
  accent?: boolean
  dashed?: boolean
  both?: boolean
  labelSize?: number
  curve?: boolean
}) {
  let d = `M${points[0][0]},${points[0][1]}`
  if (curve && points.length === 3) d += ` Q${points[1][0]},${points[1][1]} ${points[2][0]},${points[2][1]}`
  else if (curve && points.length === 4) d += ` C${points[1][0]},${points[1][1]} ${points[2][0]},${points[2][1]} ${points[3][0]},${points[3][1]}`
  else for (const p of points.slice(1)) d += ` L${p[0]},${p[1]}`
  const colour = accent ? DC.series : strong ? DC.ink : DC.edge
  const marker = accent ? 'url(#arrow-accent)' : strong ? 'url(#arrow-strong)' : 'url(#arrow)'
  const mid: Pt = labelAt ?? (() => {
    const a = points[Math.floor((points.length - 1) / 2)]
    const b = points[Math.floor((points.length - 1) / 2) + 1] ?? a
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt
  })()
  return (
    <g>
      <path d={d} fill="none" stroke={colour} strokeWidth={strong || accent ? 1.8 : 1.4} strokeDasharray={dashed ? '5 4' : undefined}
        markerEnd={marker} markerStart={both ? marker : undefined} strokeLinejoin="round" />
      {label && <Label x={mid[0]} y={mid[1] + 4} text={label} anchor={labelAnchor} size={labelSize} />}
    </g>
  )
}

/** A frame grouping several elements, with its name in the top-left corner. */
export function Frame({ x, y, w, h, title, dashed = false }: { x: number; y: number; w: number; h: number; title: string; dashed?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#fafbfc" stroke={DC.line} strokeWidth={1.2} strokeDasharray={dashed ? '6 5' : undefined} />
      <T x={x + 14} y={y + 22} weight={600} size={12.5} colour={DC.ink2}>{title}</T>
    </g>
  )
}

export function KindLegend({ x, y, kinds }: { x: number; y: number; kinds: Kind[] }) {
  const starts: number[] = []
  let acc = x
  for (const kd of kinds) {
    starts.push(acc)
    acc += 24 + textWidth(KIND_LABEL[kd] ?? kd, 11) + 18
  }
  return (
    <g>
      {kinds.map((kd, i) => {
        const k = KIND[kd]
        const label = KIND_LABEL[kd] ?? kd
        const start = starts[i]
        return (
          <g key={kd}>
            {kd === 'decision'
              ? <path d={`M${start + 8},${y - 8}L${start + 16},${y}L${start + 8},${y + 8}L${start},${y}Z`} fill={k.fill} stroke={k.stroke} />
              : <rect x={start} y={y - 7} width={16} height={14} rx={kd === 'event' || kd === 'terminal' ? 7 : 3} fill={k.fill} stroke={k.stroke} strokeWidth={kd === 'terminal' ? 1.6 : 1.2} />}
            <T x={start + 22} y={y + 4} size={11} colour={DC.ink2}>{label}</T>
          </g>
        )
      })}
    </g>
  )
}

/** Number badge used to show the order of steps in a sequence. */
export function Step({ x, y, n, dark = true }: { x: number; y: number; n: number | string; dark?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill={dark ? DC.ink : DC.white} stroke={DC.ink} strokeWidth={1.2} />
      <text x={x} y={y + 4} fontSize={11} fontWeight={600} fill={dark ? DC.white : DC.ink} textAnchor="middle">{n}</text>
    </g>
  )
}

/** Wrap a sentence into lines that fit `width` (estimated), drawn as tspans. */
export function Wrap({ x, y, width, text, size = 11.5, lineHeight = 15, colour = DC.ink2, weight = 400, anchor = 'start' }: {
  x: number
  y: number
  width: number
  text: string
  size?: number
  lineHeight?: number
  colour?: string
  weight?: number
  anchor?: 'start' | 'middle' | 'end'
}) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (textWidth(next, size) > width && cur) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  return (
    <text x={x} y={y} fontSize={size} fill={colour} fontWeight={weight} textAnchor={anchor}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>{l}</tspan>)}
    </text>
  )
}
