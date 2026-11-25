import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent, PointerEvent, RefObject } from 'react'
import type { Layout, Point, Trace } from '../api'
import { DESK, DOOR_WIDTH, joinPath, laneTop, servicePoint, shelves } from './floorplan'
import type { Polyline } from './geometry'
import { polyline, project, slice, smooth } from './geometry'
import { describePlaced } from './journey'
import { FOOT, TRACE, drawPerson, figureHeight } from './people'
import { prepare, snapshot } from './playback'
import type { Placed, Prepared, Snapshot } from './playback'

const C = {
  floor: '#ffffff',
  tile: '#f3f5f8',
  wall: '#2d3d50',
  zone: '#f6f8fa',
  zoneLine: '#dde2e8',
  shelf: '#dfe4ea',
  shelfLine: '#cbd2da',
  rail: '#d3d9e0',
  desk: '#e9edf2',
  deskLine: '#c9d0d8',
  till: '#2d3d50',
  ink: '#172331',
  ink2: '#556270',
  ink3: '#8793a0',
  signIdle: '#ffffff',
  signBusy: '#172331',
}

const FONT = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif'

/** Everything that does not move: walls, doors, departments, shelving, lanes and desks. */
export function drawFloor(ctx: CanvasRenderingContext2D, L: Layout, s: number, labels: Record<string, string>,
  counterTypes: ('normal' | 'express')[]) {
  const X = (m: number) => m * s
  ctx.fillStyle = C.floor
  ctx.fillRect(0, 0, X(L.width), X(L.height))

  // Floor tiles every 2 m
  ctx.strokeStyle = C.tile
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let gx = 2; gx < L.width; gx += 2) { ctx.moveTo(X(gx) + 0.5, 0); ctx.lineTo(X(gx) + 0.5, X(L.height)) }
  for (let gy = 2; gy < L.height; gy += 2) { ctx.moveTo(0, X(gy) + 0.5); ctx.lineTo(X(L.width), X(gy) + 0.5) }
  ctx.stroke()

  // Departments with shelving runs
  for (const [name, r] of Object.entries(L.sections)) {
    ctx.fillStyle = C.zone
    ctx.fillRect(X(r.x), X(r.y), X(r.w), X(r.h))
    ctx.strokeStyle = C.zoneLine
    ctx.lineWidth = 1
    ctx.strokeRect(X(r.x) + 0.5, X(r.y) + 0.5, X(r.w) - 1, X(r.h) - 1)
    for (const g of shelves(L, name)) {
      ctx.fillStyle = C.shelf
      ctx.fillRect(X(g.x), X(g.y), X(g.w), X(g.h))
      ctx.strokeStyle = C.shelfLine
      ctx.beginPath()
      ctx.moveTo(X(g.x), X(g.y + g.h / 2))
      ctx.lineTo(X(g.x + g.w), X(g.y + g.h / 2))
      ctx.stroke()
    }
    ctx.fillStyle = C.ink
    ctx.font = `600 ${Math.max(11, Math.min(14, X(0.55)))}px ${FONT}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText(labels[name] ?? name, X(r.x + 0.6), X(r.y + L.header_depth / 2 + 0.05))
  }

  // Decision point where customers choose a counter
  const [dx, dy] = L.checkout_point
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = C.ink3
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(X(dx), X(dy - 0.45)); ctx.lineTo(X(dx + 0.45), X(dy)); ctx.lineTo(X(dx), X(dy + 0.45)); ctx.lineTo(X(dx - 0.45), X(dy))
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = C.ink3
  ctx.font = `400 ${Math.max(9, Math.min(12, X(0.42)))}px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('Customers choose a counter here', X(dx + 0.8), X(dy - 0.55))

  // Lanes and checkout desks
  L.counters.forEach(([cx, cy], i) => {
    const top = laneTop(L, i)
    ctx.strokeStyle = C.rail
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const off of [-0.55, 0.55]) { ctx.moveTo(X(cx + off), X(top)); ctx.lineTo(X(cx + off), X(cy + 0.6)) }
    ctx.stroke()
    // desk with conveyor belt, till at the far end
    const deskX = cx + DESK.dx
    ctx.fillStyle = C.desk
    ctx.fillRect(X(deskX), X(DESK.top), X(DESK.w), X(cy + 0.6 - DESK.top))
    ctx.strokeStyle = C.deskLine
    ctx.strokeRect(X(deskX) + 0.5, X(DESK.top) + 0.5, X(DESK.w) - 1, X(cy + 0.6 - DESK.top) - 1)
    ctx.beginPath()
    for (let yy = DESK.top + 0.35; yy < cy - 0.4; yy += 0.35) { ctx.moveTo(X(deskX + 0.15), X(yy)); ctx.lineTo(X(deskX + DESK.w - 0.15), X(yy)) }
    ctx.stroke()
    ctx.fillStyle = C.till
    ctx.fillRect(X(deskX + 0.12), X(cy - 0.25), X(DESK.w - 0.24), X(0.7))
    if (counterTypes[i] === 'express') {
      ctx.fillStyle = C.ink2
      ctx.font = `600 ${Math.max(9, Math.min(12, X(0.42)))}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('Express', X(cx + 0.35), X(cy + 1.0))
    }
  })

  // Walls with door openings in the front wall
  ctx.strokeStyle = C.wall
  ctx.lineWidth = Math.max(2, X(0.16))
  const half = DOOR_WIDTH / 2
  const doors = [L.entrance[0], L.exit[0]].sort((a, b) => a - b)
  ctx.beginPath()
  ctx.moveTo(X(0), X(L.height)); ctx.lineTo(X(0), X(0)); ctx.lineTo(X(L.width), X(0)); ctx.lineTo(X(L.width), X(L.height))
  ctx.lineTo(X(doors[1] + half), X(L.height))
  ctx.moveTo(X(doors[1] - half), X(L.height)); ctx.lineTo(X(doors[0] + half), X(L.height))
  ctx.moveTo(X(doors[0] - half), X(L.height)); ctx.lineTo(X(0), X(L.height))
  ctx.stroke()
  // Door labels and direction marks
  ctx.font = `500 ${Math.max(10, Math.min(13, X(0.48)))}px ${FONT}`
  ctx.fillStyle = C.ink2
  ctx.textBaseline = 'middle'
  const arrow = (x: number, up: boolean) => {
    const y0 = L.height - 0.25
    const y1 = L.height - 1.3
    ctx.strokeStyle = C.ink3
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(X(x), X(up ? y0 : y1)); ctx.lineTo(X(x), X(up ? y1 : y0))
    const tip = up ? y1 : y0
    const dir = up ? 1 : -1
    ctx.moveTo(X(x - 0.3), X(tip + dir * 0.35)); ctx.lineTo(X(x), X(tip)); ctx.lineTo(X(x + 0.3), X(tip + dir * 0.35))
    ctx.stroke()
  }
  arrow(L.entrance[0] + 1.0, true)
  arrow(L.exit[0] - 1.0, false)
  ctx.textAlign = 'left'
  ctx.fillText('Entrance', X(L.entrance[0] + half + 0.3), X(L.height - 0.8))
  ctx.textAlign = 'right'
  ctx.fillText('Exit', X(L.exit[0] - half - 0.3), X(L.height - 0.8))
}

// ------------------------------------------------------------------ tracing
interface RoutePart {
  pl: Polyline
  t0: number | null
  t1: number | null
  kind: 'walk' | 'join' | 'exit'
}

interface RoutePlan {
  id: number
  parts: RoutePart[]
  stops: { p: Point; n: number; t0: number | null; t1: number | null }[]
  counter: number | null
}

function planRoute(p: Prepared, L: Layout): RoutePlan {
  const { c } = p
  const parts: RoutePart[] = p.walks.map((w) => ({ pl: w.pl, t0: w.t0, t1: w.t1, kind: 'walk' as const }))
  if (c.c !== null && c.c < L.counters.length) {
    parts.push({ pl: polyline(smooth(joinPath(L, c.c, servicePoint(L, c.c)), 0.8)), t0: c.co, t1: c.ss, kind: 'join' })
    if (p.exit) parts.push({ pl: p.exit, t0: c.d, t1: c.d === null ? null : c.d + p.exitDur, kind: 'exit' })
  }
  const stops = p.stays.map((s, i) => ({ p: s.spot, n: i + 1, t0: s.t0, t1: s.t1 }))
  return { id: c.id, parts, stops, counter: c.c }
}

/** How far along a part of the route the traced customer has walked at time t. */
function walked(part: RoutePart, t: number, me: Placed | undefined): number {
  const { pl, t0, t1 } = part
  if (t0 === null || t < t0) return 0
  if (part.kind === 'join') {
    if (t1 !== null && t >= t1 + 0.1) return pl.length
    if (me && (me.status === 'joining' || me.status === 'waiting' || me.status === 'service')) return project(pl, me.x, me.y)
    return t1 !== null && t >= t1 ? pl.length : 0
  }
  if (t1 === null || t >= t1) return t1 === null ? 0 : pl.length
  return ((t - t0) / (t1 - t0)) * pl.length
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Point[], X: (m: number) => number) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(X(pts[0][0]), X(pts[0][1]))
  for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i][0]), X(pts[i][1]))
  ctx.stroke()
}

function drawRoute(ctx: CanvasRenderingContext2D, plan: RoutePlan, t: number, me: Placed | undefined, X: (m: number) => number, L: Layout) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const part of plan.parts) {
    const done = walked(part, t, me)
    // remaining route: dashed
    if (done < part.pl.length) {
      ctx.setLineDash([6, 5])
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(37, 125, 224, 0.55)'
      strokePath(ctx, slice(part.pl, done, part.pl.length), X)
    }
    if (done > 0) {
      ctx.setLineDash([])
      ctx.lineWidth = 3
      ctx.strokeStyle = TRACE
      strokePath(ctx, slice(part.pl, 0, done), X)
    }
  }
  ctx.setLineDash([])
  // Start point at the entrance
  ctx.beginPath()
  ctx.arc(X(L.entrance[0]), X(L.entrance[1]), 4, 0, Math.PI * 2)
  ctx.fillStyle = TRACE
  ctx.fill()
  // Decision point
  const [dx, dy] = L.checkout_point
  ctx.beginPath()
  ctx.moveTo(X(dx), X(dy - 0.6)); ctx.lineTo(X(dx + 0.6), X(dy)); ctx.lineTo(X(dx), X(dy + 0.6)); ctx.lineTo(X(dx - 0.6), X(dy))
  ctx.closePath()
  ctx.lineWidth = 2
  ctx.strokeStyle = TRACE
  ctx.stroke()
  // Numbered stops, filled once visited
  const r = Math.max(7.5, X(0.3))
  ctx.font = `600 ${Math.round(r * 1.2)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const stop of plan.stops) {
    const visited = stop.t0 !== null && t >= stop.t0
    const here = visited && (stop.t1 === null || t < stop.t1)
    const [sx, sy] = [X(stop.p[0]), X(stop.p[1])]
    if (here) {
      ctx.beginPath()
      ctx.arc(sx, sy, r + 3.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(37, 125, 224, 0.22)'
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fillStyle = visited ? TRACE : '#ffffff'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = TRACE
    ctx.stroke()
    ctx.fillStyle = visited ? '#ffffff' : TRACE
    ctx.fillText(String(stop.n), sx, sy + 0.5)
  }
  ctx.restore()
}

function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number) {
  ctx.save()
  ctx.font = `600 12px ${FONT}`
  const w = ctx.measureText(text).width + 14
  const h = 20
  const left = Math.max(2, Math.min(width - w - 2, x - w / 2))
  const top = Math.max(2, y - h - 6)
  ctx.beginPath()
  ctx.roundRect(left, top, w, h, 4)
  ctx.fillStyle = C.ink
  ctx.fill()
  ctx.beginPath()
  const px = Math.max(left + 6, Math.min(left + w - 6, x))
  ctx.moveTo(px - 5, top + h)
  ctx.lineTo(px, top + h + 5)
  ctx.lineTo(px + 5, top + h)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + 7, top + h / 2 + 0.5)
  ctx.restore()
}

// ----------------------------------------------------------------- component
interface Props {
  trace: Trace
  timeRef: RefObject<number>
  sectionLabels: Record<string, string>
  /** Customer whose route is drawn, if any. */
  tracedId?: number | null
  /** Fade everyone else while tracing. */
  dimOthers?: boolean
  onSelect?: (id: number) => void
}

export function StoreCanvas({ trace, timeRef, sectionLabels, tracedId = null, dimOthers = true, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const prepared = useMemo(() => prepare(trace), [trace])
  const byId = useMemo(() => new Map(prepared.map((p) => [p.c.id, p])), [prepared])
  const plan = useMemo(() => {
    const p = tracedId === null ? undefined : byId.get(tracedId)
    return p ? planRoute(p, trace.layout) : null
  }, [tracedId, byId, trace])

  // Values the animation loop reads without restarting
  const live = useRef({ plan, dimOthers, onSelect, labels: sectionLabels })
  useEffect(() => {
    live.current = { plan, dimOthers, onSelect, labels: sectionLabels }
  }, [plan, dimOthers, onSelect, sectionLabels])
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const hovered = useRef<number | null>(null)
  const last = useRef<{ snap: Snapshot; s: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const tip = tipRef.current
    if (!canvas || !wrap || !tip) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const L = trace.layout
    const types = trace.counters.map((c) => c.type)
    const background = document.createElement('canvas')
    let frame = 0
    let cssWidth = 0
    let dpr = 1
    let tipText = ''

    const resize = () => {
      cssWidth = wrap.clientWidth
      if (cssWidth === 0) return
      const cssHeight = (cssWidth * L.height) / L.width
      dpr = window.devicePixelRatio || 1
      for (const c of [canvas, background]) {
        c.width = Math.round(cssWidth * dpr)
        c.height = Math.round(cssHeight * dpr)
      }
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      const bg = background.getContext('2d')!
      bg.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawFloor(bg, L, cssWidth / L.width, live.current.labels, types)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    resize()

    const hitTest = (snap: Snapshot, s: number, px: number, py: number): Placed | null => {
      const H = figureHeight(s)
      for (let i = snap.placed.length - 1; i >= 0; i--) {
        const p = snap.placed[i]
        if (p.hidden || p.alpha < 0.25) continue
        const x = p.x * s
        const y = p.y * s + FOOT * H
        if (Math.abs(px - x) <= 0.36 * H && py >= y - H - 2 && py <= y + 0.2 * H) return p
      }
      return null
    }

    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (cssWidth === 0) return
      const { plan, dimOthers, labels } = live.current
      const s = cssWidth / L.width
      const X = (m: number) => m * s
      const t = timeRef.current ?? 0
      const snap = snapshot(prepared, trace, t)
      last.current = { snap, s }
      const H = figureHeight(s)
      const me = plan ? snap.placed.find((p) => p.id === plan.id) : undefined
      const dim = plan !== null && dimOthers

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(background, 0, 0)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Lane number signs: dark when the cashier is serving, outlined when idle
      const fontPx = Math.max(9, Math.min(12, X(0.44)))
      L.counters.forEach(([cx, cy], i) => {
        const busy = snap.busy[i]
        const sx = cx + DESK.dx + DESK.w / 2
        const sy = DESK.top - 0.55
        const w = 1.25
        const h = 0.8
        ctx.beginPath()
        ctx.roundRect(X(sx - w / 2), X(sy - h / 2), X(w), X(h), 3)
        ctx.fillStyle = busy ? C.signBusy : C.signIdle
        ctx.fill()
        const ours = plan !== null && plan.counter === i
        ctx.strokeStyle = ours ? TRACE : busy ? C.signBusy : '#aab3bd'
        ctx.lineWidth = ours ? 2.5 : 1
        ctx.stroke()
        ctx.fillStyle = busy ? '#ffffff' : C.ink2
        ctx.font = `600 ${fontPx}px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), X(sx), X(sy) + 0.5)
        ctx.font = `400 ${fontPx}px ${FONT}`
        ctx.fillStyle = C.ink2
        ctx.textBaseline = 'top'
        const q = snap.queues[i]
        const below = X(cy + 1.0) + (types[i] === 'express' ? fontPx * 1.3 : 0)
        // On a small plan only queues are labelled, so the labels do not run into each other
        if (q > 0 || s >= 12) ctx.fillText(q === 0 ? 'No queue' : `${q} waiting`, X(cx + 0.35), below)
      })

      if (plan) drawRoute(ctx, plan, t, me, X, L)

      // Queues longer than the lane: "+N" tag at the lane opening
      L.counters.forEach(([cx], i) => {
        const n = snap.overflow[i]
        if (n <= 0) return
        const text = `+${n}`
        ctx.font = `600 ${Math.max(10, Math.min(12, X(0.44)))}px ${FONT}`
        const w = ctx.measureText(text).width + 12
        const hgt = Math.max(16, X(0.62))
        const y = X(laneTop(L, i) + 0.4)
        ctx.beginPath()
        ctx.roundRect(X(cx) - w / 2, y - hgt / 2, w, hgt, hgt / 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.strokeStyle = '#aab3bd'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = C.ink2
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, X(cx), y + 0.5)
      })

      // Customers, nearest last so they overlap those behind them
      for (const p of snap.placed) {
        if (p.hidden && p.id !== plan?.id) continue
        const traced = p.id === plan?.id
        let alpha = p.alpha
        if (traced && (p.status === 'joining' || p.status === 'waiting')) alpha = 1
        else if (!traced && dim) alpha *= 0.28
        if (alpha <= 0.01) continue
        drawPerson(ctx, X(p.x), X(p.y) + FOOT * H, H, {
          cat: p.cat,
          facing: p.facing,
          phase: p.phase,
          moving: p.moving,
          pose: p.status === 'shopping' && !p.moving ? 'reach' : p.moving ? 'walk' : 'stand',
          alpha,
          serving: p.status === 'service',
          bag: p.status === 'leaving',
          highlight: traced ? 'traced' : hovered.current === p.id ? 'hover' : null,
        })
      }

      // Name tag over the traced customer
      if (plan && me) drawTag(ctx, `Customer ${me.id}`, X(me.x), X(me.y) + FOOT * H - H - 2, cssWidth)

      // Hover card
      const ptr = pointer.current
      const hit = ptr ? hitTest(snap, s, ptr.x, ptr.y) : null
      hovered.current = hit?.id ?? null
      canvas.style.cursor = hit ? 'pointer' : 'default'
      if (hit) {
        const p = byId.get(hit.id)!
        const text = `${hit.id}|${hit.status}|${hit.where}|${hit.counter}|${hit.slot}|${plan?.id === hit.id}`
        if (text !== tipText) {
          tipText = text
          const c = p.c
          tip.replaceChildren()
          const title = document.createElement('strong')
          title.textContent = `Customer ${c.id}`
          const basket = document.createElement('span')
          basket.textContent = `${c.items} ${c.items === 1 ? 'item' : 'items'}, ${c.cat} basket`
          const status = document.createElement('span')
          status.textContent = describePlaced(hit, labels)
          const hint = document.createElement('span')
          hint.className = 'store-tip-hint'
          hint.textContent = plan?.id === hit.id ? 'Being traced' : 'Click to trace this customer'
          tip.append(title, basket, status, hint)
        }
        const x = X(hit.x)
        const y = X(hit.y) + FOOT * H - H
        const tw = tip.offsetWidth
        const left = x + 0.5 * H + tw + 8 > cssWidth ? x - 0.5 * H - tw : x + 0.5 * H
        tip.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, y - 8)}px)`
        tip.style.opacity = '1'
      } else if (tipText !== '') {
        tipText = ''
        tip.style.opacity = '0'
      }
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [trace, prepared, byId, timeRef])

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'mouse') return
    const rect = e.currentTarget.getBoundingClientRect()
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const onClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const state = last.current
    const select = live.current.onSelect
    if (!state || !select) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const H = figureHeight(state.s)
    let best: Placed | null = null
    let bestD = Infinity
    for (const p of state.snap.placed) {
      if (p.hidden || p.alpha < 0.25) continue
      const cx = p.x * state.s
      const cy = p.y * state.s + FOOT * H - H / 2
      const d = Math.hypot(px - cx, py - cy)
      if (d < bestD) { bestD = d; best = p }
    }
    if (best && bestD <= Math.max(18, 0.75 * H)) select(best.id)
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Animated floor plan of the supermarket showing customers shopping, queueing and being served. Select a customer to trace their route."
        style={{ display: 'block', borderRadius: 6, touchAction: 'manipulation' }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => { pointer.current = null }}
        onClick={onClick}
      />
      <div ref={tipRef} className="store-tip" aria-hidden="true" />
    </div>
  )
}

