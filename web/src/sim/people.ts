// Person figures for the floor plan. Customers are drawn as small standing
// pictograms with their feet on their position, so a top-down plan still reads
// as people: the shirt colour shows basket size, and each customer carries a
// hand basket (small and medium) or pushes a trolley (large).

import type { BasketKey } from '../api'
import { BASKET_COLOURS } from '../format'

const INK = '#2d3d50' // head, legs and arms
const INK_BACK = '#4a5b71' // the leg further from the viewer
const GEAR = '#687482' // basket and trolley outlines
const GEAR_FILL = '#ffffff'
export const TRACE = '#257de0' // route and highlight of the traced customer

export type Pose = 'walk' | 'stand' | 'reach'

export interface PersonStyle {
  cat: BasketKey
  facing: 1 | -1
  phase: number
  moving: boolean
  pose: Pose
  alpha: number
  /** Dark ring on the floor: being served at a till. */
  serving?: boolean
  /** Leaving with the shopping in a bag (small and medium baskets). */
  bag?: boolean
  highlight?: 'traced' | 'hover' | null
}

/** Figures stand this fraction of their height below their position, so they sit centred in an aisle. */
export const FOOT = 0.33

/** Figure height in pixels for a floor scale of `s` pixels per metre. */
export const figureHeight = (s: number) => Math.max(15, Math.min(34, 1.05 * s))

function limb(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}

function torsoPath(ctx: CanvasRenderingContext2D, x: number, y: number, H: number, grow: number) {
  const w = 0.3 * H + grow * 2
  const top = y - 0.8 * H - grow
  const h = 0.4 * H + grow * 2
  ctx.beginPath()
  ctx.roundRect(x - w / 2, top, w, h, [0.1 * H + grow, 0.1 * H + grow, 0.04 * H, 0.04 * H])
}

/** Draws one customer with the feet at (x, y). */
export function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, H: number, st: PersonStyle) {
  const f = st.facing
  const swing = st.moving ? 0.13 * H * Math.sin(2 * Math.PI * st.phase) : 0.035 * H
  const lift = st.moving ? 0.03 * H * Math.abs(Math.sin(2 * Math.PI * st.phase)) : 0
  const hipY = y - 0.44 * H - lift
  const legW = Math.max(2, 0.12 * H)
  const armW = Math.max(1.6, 0.075 * H)
  const headR = 0.105 * H
  const headY = y - 0.905 * H - lift
  const shoulder: [number, number] = [x + f * 0.1 * H, y - 0.72 * H - lift]
  const hand: [number, number] =
    st.pose === 'reach' ? [x + f * 0.27 * H, y - 0.98 * H] : [x + f * 0.21 * H, y - 0.47 * H - lift]

  ctx.save()
  ctx.globalAlpha = st.alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Floor marks: highlight, service ring and shadow
  if (st.highlight === 'traced') {
    ctx.beginPath()
    ctx.ellipse(x, y, 0.46 * H, 0.15 * H, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(37, 125, 224, 0.16)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = TRACE
    ctx.stroke()
  } else if (st.highlight === 'hover') {
    ctx.beginPath()
    ctx.ellipse(x, y, 0.42 * H, 0.14 * H, 0, 0, Math.PI * 2)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#8793a0'
    ctx.stroke()
  }
  if (st.serving) {
    ctx.beginPath()
    ctx.ellipse(x, y, 0.36 * H, 0.12 * H, 0, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#172331'
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(x, y, 0.2 * H, 0.06 * H, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(23, 35, 49, 0.16)'
  ctx.fill()

  const trolley = st.cat === 'large'
  if (trolley) drawTrolley(ctx, x, y, H, f, 'back')

  // White outline first, so overlapping people in a queue stay distinct
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = legW + 2
  limb(ctx, x, hipY, x - swing, y)
  limb(ctx, x, hipY, x + swing, y)
  ctx.lineWidth = armW + 2
  limb(ctx, shoulder[0], shoulder[1], hand[0], hand[1])
  torsoPath(ctx, x, y - lift, H, 1)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, headY, headR + 1, 0, Math.PI * 2)
  ctx.fill()

  // Legs, the far one slightly lighter
  ctx.lineWidth = legW
  ctx.strokeStyle = INK_BACK
  limb(ctx, x, hipY, x - swing, y)
  ctx.strokeStyle = INK
  limb(ctx, x, hipY, x + swing, y)
  // Body in the basket colour, then head and carrying arm
  torsoPath(ctx, x, y - lift, H, 0)
  ctx.fillStyle = BASKET_COLOURS[st.cat]
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, headY, headR, 0, Math.PI * 2)
  ctx.fillStyle = INK
  ctx.fill()
  ctx.lineWidth = armW
  ctx.strokeStyle = INK
  limb(ctx, shoulder[0], shoulder[1], hand[0], hand[1])

  if (trolley) drawTrolley(ctx, x, y, H, f, 'front')
  else if (st.pose !== 'reach') drawCarried(ctx, hand[0], hand[1], H, st.bag === true)

  ctx.restore()
}

function drawCarried(ctx: CanvasRenderingContext2D, hx: number, hy: number, H: number, bag: boolean) {
  const w = (bag ? 0.17 : 0.22) * H
  const h = (bag ? 0.2 : 0.13) * H
  const top = hy + 0.02 * H
  ctx.lineWidth = 1
  ctx.strokeStyle = GEAR
  ctx.fillStyle = GEAR_FILL
  ctx.beginPath()
  if (bag) ctx.roundRect(hx - w / 2, top, w, h, 1.5)
  else {
    // hand basket: slightly tapered box
    ctx.moveTo(hx - w / 2, top)
    ctx.lineTo(hx + w / 2, top)
    ctx.lineTo(hx + w / 2 - 0.03 * H, top + h)
    ctx.lineTo(hx - w / 2 + 0.03 * H, top + h)
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(hx, top, w * (bag ? 0.28 : 0.36), Math.PI, 0)
  ctx.stroke()
}

function drawTrolley(ctx: CanvasRenderingContext2D, x: number, y: number, H: number, f: 1 | -1, layer: 'back' | 'front') {
  const near = x + f * 0.27 * H
  const far = x + f * 0.72 * H
  const top = y - 0.64 * H
  const bottom = y - 0.36 * H
  if (layer === 'back') {
    // wheels and chassis sit behind the customer's legs
    ctx.strokeStyle = GEAR
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(near + f * 0.04 * H, bottom)
    ctx.lineTo(near + f * 0.08 * H, y - 0.05 * H)
    ctx.moveTo(far - f * 0.02 * H, bottom)
    ctx.lineTo(far - f * 0.06 * H, y - 0.05 * H)
    ctx.stroke()
    ctx.fillStyle = '#556270'
    for (const wx of [near + f * 0.08 * H, far - f * 0.06 * H]) {
      ctx.beginPath()
      ctx.arc(wx, y - 0.03 * H, Math.max(1.2, 0.045 * H), 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  const left = Math.min(near, far)
  const width = Math.abs(far - near)
  ctx.lineWidth = 1.2
  ctx.strokeStyle = GEAR
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(left + width, top)
  ctx.lineTo(left + width - (f > 0 ? 0.05 * H : 0), bottom)
  ctx.lineTo(left + (f < 0 ? 0.05 * H : 0), bottom)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // basket mesh and handle
  ctx.lineWidth = 0.8
  ctx.beginPath()
  for (const k of [1, 2]) {
    const mx = left + (width * k) / 3
    ctx.moveTo(mx, top)
    ctx.lineTo(mx - f * 0.02 * H, bottom)
  }
  ctx.stroke()
  ctx.lineWidth = 1.4
  ctx.strokeStyle = INK
  ctx.beginPath()
  ctx.moveTo(x + f * 0.2 * H, y - 0.52 * H)
  ctx.lineTo(near, top - 0.04 * H)
  ctx.stroke()
}

/** Small legend icon: a figure drawn into its own canvas-free SVG would duplicate code, so
 *  the legend renders the same function into a tiny canvas. */
export function drawLegendFigure(canvas: HTMLCanvasElement, cat: BasketKey, opts: Partial<PersonStyle> = {}) {
  const dpr = window.devicePixelRatio || 1
  const W = canvas.width / dpr
  const Hc = canvas.height / dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, Hc)
  const H = Hc - 4
  const x = cat === 'large' ? W * 0.3 : W / 2
  drawPerson(ctx, x, Hc - 2.5, H, {
    cat, facing: 1, phase: 0, moving: false, pose: 'stand', alpha: 1, ...opts,
  })
}
