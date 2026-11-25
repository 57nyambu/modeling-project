import { useMemo, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Steps } from '../api'
import { linear, ticks, useWidth } from '../charts/core'
import { maxOf } from '../charts/StepChart'
import { clock } from '../format'
import { tokens } from '../theme'

interface Props {
  duration: number
  time: number
  waiting: Steps
  onSeek: (t: number) => void
  onScrubStart?: () => void
  /** Time span of the traced customer, shaded on the timeline. */
  band?: { start: number; end: number; label: string } | null
}

/**
 * Timeline you can drag to move through the run. Behind it, the number of
 * customers waiting over the whole run, so busy moments are easy to find.
 */
export function Scrubber({ duration, time, waiting, onSeek, onScrubStart, band }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const dragging = useRef(false)
  const height = 58
  const m = { left: 6, right: 6, top: 8, bottom: 18 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const top = Math.max(1, maxOf(waiting))
  const x = linear(0, duration, m.left, m.left + innerW)
  const y = linear(0, top, m.top + innerH, m.top)

  const area = useMemo(() => {
    if (!waiting.length || width === 0) return ''
    let d = `M${x(0)},${y(0)}`
    for (const [t, v] of waiting) d += `H${x(t).toFixed(1)}V${y(v).toFixed(1)}`
    return `${d}H${x(duration)}V${y(0)}Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, width, duration, top])

  const toTime = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(duration, ((e.clientX - rect.left - m.left) / innerW) * duration))
  }
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onScrubStart?.()
    onSeek(toTime(e))
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) onSeek(toTime(e))
  }
  const onUp = () => { dragging.current = false }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 10 : 1
    const moves: Record<string, number> = {
      ArrowRight: time + step, ArrowLeft: time - step, Home: 0, End: duration, PageUp: time + 30, PageDown: time - 30,
    }
    if (e.key in moves) {
      e.preventDefault()
      onScrubStart?.()
      onSeek(Math.max(0, Math.min(duration, moves[e.key])))
    }
  }
  const px = x(time)
  const tickValues = ticks(duration, Math.max(2, Math.floor(innerW / 90)))

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="chart-svg"
          role="slider"
          tabIndex={0}
          aria-label="Playback time"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(time * 10) / 10}
          aria-valuetext={`${clock(time)} after opening`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
          style={{ cursor: 'pointer', touchAction: 'none', display: 'block' }}
        >
          <defs>
            <clipPath id="played">
              <rect x={0} y={0} width={Math.max(0, px)} height={height} />
            </clipPath>
          </defs>
          <rect x={m.left} y={m.top} width={innerW} height={innerH} rx={4} fill={tokens.surface2} />
          {band && (
            <g>
              <rect x={x(band.start)} y={m.top - 3} width={Math.max(2, x(band.end) - x(band.start))} height={innerH + 3}
                fill={tokens.series} fillOpacity={0.12} />
              <line x1={x(band.start)} x2={x(band.end)} y1={m.top - 3} y2={m.top - 3} stroke={tokens.series} strokeWidth={3} strokeLinecap="round">
                <title>{band.label}</title>
              </line>
            </g>
          )}
          <path d={area} fill={tokens.series} fillOpacity={0.16} />
          <path d={area} fill={tokens.series} fillOpacity={0.45} clipPath="url(#played)" />
          <line x1={m.left} x2={m.left + innerW} y1={m.top + innerH} y2={m.top + innerH} stroke={tokens.axis} />
          {tickValues.map((v) => (
            <text key={v} x={x(v)} y={height - 4} fontSize={10} fill={tokens.ink3} textAnchor={v === 0 ? 'start' : v >= duration ? 'end' : 'middle'}>
              {clock(v).replace(/:00$/, '')}
            </text>
          ))}
          <line x1={px} x2={px} y1={m.top - 3} y2={m.top + innerH + 3} stroke={tokens.ink} strokeWidth={2} />
          <circle cx={px} cy={m.top + innerH + 3} r={4.5} fill={tokens.ink} stroke="#ffffff" strokeWidth={2} />
        </svg>
      )}
    </div>
  )
}
