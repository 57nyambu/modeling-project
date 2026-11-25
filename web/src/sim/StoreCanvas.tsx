import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Layout, Trace } from '../api'
import { BASKET_COLOURS } from '../format'
import { DESK, DOOR_WIDTH, HEADER_DEPTH, gondolas } from './floorplan'
import { prepare, servicePoint, snapshot } from './playback'

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

const RADIUS = { small: 0.26, medium: 0.32, large: 0.4 } as const
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
    for (const g of gondolas(r)) {
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
    ctx.fillText(labels[name] ?? name, X(r.x + 0.6), X(r.y + HEADER_DEPTH / 2 + 0.05))
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
  ctx.fillText('Customers choose a counter here', X(dx + 0.8), X(dy))

  // Lanes and checkout desks
  L.counters.forEach(([cx, cy], i) => {
    const [, sy] = servicePoint(L, i)
    ctx.strokeStyle = C.rail
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const off of [-0.55, 0.55]) { ctx.moveTo(X(cx + off), X(sy - 6.9)); ctx.lineTo(X(cx + off), X(cy + 0.6)) }
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
  arrow(L.entrance[0], true)
  arrow(L.exit[0], false)
  ctx.textAlign = 'left'
  ctx.fillText('Entrance', X(L.entrance[0] + half + 0.3), X(L.height - 0.8))
  ctx.textAlign = 'right'
  ctx.fillText('Exit', X(L.exit[0] - half - 0.3), X(L.height - 0.8))
}

interface Props {
  trace: Trace
  timeRef: RefObject<number>
  sectionLabels: Record<string, string>
}

export function StoreCanvas({ trace, timeRef, sectionLabels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const prepared = useMemo(() => prepare(trace), [trace])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const L = trace.layout
    const types = trace.counters.map((c) => c.type)
    const background = document.createElement('canvas')
    let frame = 0
    let cssWidth = 0
    let dpr = 1

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
      drawFloor(bg, L, cssWidth / L.width, sectionLabels, types)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    resize()

    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (cssWidth === 0) return
      const s = cssWidth / L.width
      const X = (m: number) => m * s
      const snap = snapshot(prepared, trace, timeRef.current ?? 0)

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
        ctx.strokeStyle = busy ? C.signBusy : '#aab3bd'
        ctx.lineWidth = 1
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
        ctx.fillText(q === 0 ? 'No queue' : `${q} waiting`, X(cx + 0.35), X(cy + (types[i] === 'express' ? 1.65 : 1.0)))
      })

      // Customers: size and shade show basket size; a dark ring marks the one being served
      for (const p of snap.placed) {
        const r = Math.max(2.6, X(RADIUS[p.cat]))
        ctx.beginPath()
        ctx.arc(X(p.x), X(p.y), r, 0, Math.PI * 2)
        ctx.globalAlpha = p.status === 'leaving' ? 0.35 : 1
        ctx.fillStyle = BASKET_COLOURS[p.cat]
        ctx.fill()
        ctx.lineWidth = p.status === 'service' ? 2 : 1.5
        ctx.strokeStyle = p.status === 'service' ? C.ink : '#ffffff'
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [trace, prepared, timeRef, sectionLabels])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Animated floor plan of the supermarket showing customers shopping, queueing and being served"
        style={{ display: 'block', borderRadius: 6 }}
      />
    </div>
  )
}
