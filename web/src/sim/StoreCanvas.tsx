import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Trace } from '../api'
import { BASKET_COLOURS } from '../format'
import { prepare, servicePoint, snapshot } from './playback'

const SECTION_FILL: Record<string, string> = {
  grocery: '#ecfdf5',
  beverages: '#eff6ff',
  household: '#fefce8',
  personal_care: '#fdf2f8',
}
const SECTION_STROKE: Record<string, string> = {
  grocery: '#6ee7b7',
  beverages: '#93c5fd',
  household: '#fde047',
  personal_care: '#f9a8d4',
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
    let frame = 0
    let cssWidth = 0

    const resize = () => {
      cssWidth = wrap.clientWidth
      const cssHeight = (cssWidth * L.height) / L.width
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    resize()

    const draw = () => {
      const s = cssWidth / L.width // pixels per metre
      const X = (m: number) => m * s
      const t = timeRef.current ?? 0
      const snap = snapshot(prepared, trace, t)

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // Floor
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, X(L.width), X(L.height))
      ctx.strokeStyle = '#f1f5f9'
      ctx.lineWidth = 1
      for (let gx = 0; gx <= L.width; gx += 2) {
        ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), X(L.height)); ctx.stroke()
      }
      for (let gy = 0; gy <= L.height; gy += 2) {
        ctx.beginPath(); ctx.moveTo(0, X(gy)); ctx.lineTo(X(L.width), X(gy)); ctx.stroke()
      }
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, X(L.width) - 2, X(L.height) - 2)

      // Sections
      ctx.font = `600 ${Math.max(10, X(0.65))}px Inter, system-ui, sans-serif`
      ctx.textBaseline = 'top'
      for (const [name, r] of Object.entries(L.sections)) {
        ctx.fillStyle = SECTION_FILL[name] ?? '#f8fafc'
        ctx.strokeStyle = SECTION_STROKE[name] ?? '#cbd5e1'
        ctx.lineWidth = 1.5
        ctx.fillRect(X(r.x), X(r.y), X(r.w), X(r.h))
        ctx.strokeRect(X(r.x), X(r.y), X(r.w), X(r.h))
        ctx.fillStyle = '#334155'
        ctx.fillText(sectionLabels[name] ?? name, X(r.x + 0.5), X(r.y + 0.4))
        // shelves
        ctx.fillStyle = '#e2e8f0'
        for (let k = 0; k < 3; k++) ctx.fillRect(X(r.x + 0.6), X(r.y + 2.2 + k * 1.6), X(r.w - 1.2), X(0.25))
      }

      // Entrance, exit, checkout decision point
      const marker = (p: [number, number], label: string, colour: string) => {
        ctx.fillStyle = colour
        ctx.fillRect(X(p[0] - 1.6), X(L.height - 0.5), X(3.2), X(0.5))
        ctx.fillStyle = '#334155'
        ctx.textBaseline = 'bottom'
        ctx.textAlign = 'center'
        ctx.fillText(label, X(p[0]), X(L.height - 0.7))
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
      }
      marker(L.entrance, 'ENTRANCE', '#16a34a')
      marker(L.exit, 'EXIT', '#dc2626')
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(4), X(L.checkout_point[1] + 0.4))
      ctx.lineTo(X(36), X(L.checkout_point[1] + 0.4))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#64748b'
      ctx.font = `500 ${Math.max(9, X(0.5))}px Inter, system-ui, sans-serif`
      ctx.fillText('CHECKOUT AREA', X(4), X(L.checkout_point[1] + 0.6))

      // Counters
      trace.counters.forEach((c, i) => {
        const [cx, cy] = L.counters[i]
        const express = c.type === 'express'
        ctx.fillStyle = snap.busy[i] ? (express ? '#b45309' : '#1e3a8a') : '#94a3b8'
        ctx.fillRect(X(cx - 1.1), X(cy), X(2.2), X(1.3))
        ctx.fillStyle = '#ffffff'
        ctx.font = `600 ${Math.max(9, X(0.5))}px Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(express ? `C${i + 1} EXP` : `C${i + 1}`, X(cx), X(cy + 0.65))
        ctx.fillStyle = '#334155'
        ctx.textBaseline = 'top'
        ctx.fillText(`Queue ${snap.queues[i]}`, X(cx), X(cy + 1.45))
        ctx.textAlign = 'left'
        const sp = servicePoint(L, i)
        ctx.strokeStyle = '#cbd5e1'
        ctx.beginPath()
        ctx.moveTo(X(sp[0] - 0.55), X(sp[1] - 6.6))
        ctx.lineTo(X(sp[0] - 0.55), X(cy))
        ctx.moveTo(X(sp[0] + 0.55), X(sp[1] - 6.6))
        ctx.lineTo(X(sp[0] + 0.55), X(cy))
        ctx.stroke()
      })

      // Customers
      const radius = Math.max(2.5, X(0.32))
      for (const p of snap.placed) {
        ctx.beginPath()
        ctx.arc(X(p.x), X(p.y), radius, 0, Math.PI * 2)
        ctx.fillStyle = BASKET_COLOURS[p.cat]
        ctx.globalAlpha = p.status === 'leaving' ? 0.45 : 1
        ctx.fill()
        ctx.globalAlpha = 1
        if (p.status === 'waiting' || p.status === 'service') {
          ctx.lineWidth = 1.5
          ctx.strokeStyle = p.status === 'service' ? '#0f172a' : '#ffffff'
          ctx.stroke()
        }
      }

      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [trace, prepared, timeRef, sectionLabels])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6 }} />
    </div>
  )
}
