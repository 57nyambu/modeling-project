// Small geometry helpers for walking along routes.

import type { Point } from '../api'

export interface Polyline {
  pts: Point[]
  cum: number[] // distance from the start to each point
  length: number
}

/**
 * Rounds each corner of a route with a short curve so customers turn smoothly
 * instead of pivoting on the spot. The curve starts at most `radius` metres
 * before the corner, and never further than half of either segment.
 */
export function smooth(points: Point[], radius = 0.9, steps = 6): Point[] {
  if (points.length < 3) return points.map((p) => [p[0], p[1]] as Point)
  const out: Point[] = [[points[0][0], points[0][1]]]
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]
    const [cx, cy] = points[i]
    const [nx, ny] = points[i + 1]
    const d1 = Math.hypot(cx - px, cy - py)
    const d2 = Math.hypot(nx - cx, ny - cy)
    const r = Math.min(radius, d1 / 2, d2 / 2)
    if (r < 1e-6 || d1 < 1e-9 || d2 < 1e-9) {
      out.push([cx, cy])
      continue
    }
    const a: Point = [cx - ((cx - px) / d1) * r, cy - ((cy - py) / d1) * r]
    const b: Point = [cx + ((nx - cx) / d2) * r, cy + ((ny - cy) / d2) * r]
    out.push(a)
    for (let k = 1; k < steps; k++) {
      const t = k / steps
      const u = 1 - t
      out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]])
    }
    out.push(b)
  }
  const last = points[points.length - 1]
  out.push([last[0], last[1]])
  return out
}

export function polyline(pts: Point[]): Polyline {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  return { pts, cum, length: cum[cum.length - 1] ?? 0 }
}

export function rawLength(pts: Point[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return total
}

export interface Along {
  x: number
  y: number
  dx: number // unit direction of travel
  dy: number
}

/** The point `d` metres along a polyline, with the direction of travel there. */
export function pointAt(pl: Polyline, d: number): Along {
  const { pts, cum, length } = pl
  if (pts.length === 1 || length === 0) return { x: pts[0][0], y: pts[0][1], dx: 0, dy: 0 }
  const dist = Math.max(0, Math.min(length, d))
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= dist) lo = mid
    else hi = mid
  }
  const seg = cum[hi] - cum[lo]
  const f = seg > 0 ? (dist - cum[lo]) / seg : 0
  const [ax, ay] = pts[lo]
  const [bx, by] = pts[hi]
  const len = Math.hypot(bx - ax, by - ay) || 1
  return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, dx: (bx - ax) / len, dy: (by - ay) / len }
}

/** The part of a polyline between two distances, for drawing walked and remaining route. */
export function slice(pl: Polyline, from: number, to: number): Point[] {
  const a = Math.max(0, Math.min(pl.length, from))
  const b = Math.max(a, Math.min(pl.length, to))
  const start = pointAt(pl, a)
  const out: Point[] = [[start.x, start.y]]
  for (let i = 0; i < pl.pts.length; i++) {
    if (pl.cum[i] > a && pl.cum[i] < b) out.push(pl.pts[i])
  }
  const end = pointAt(pl, b)
  out.push([end.x, end.y])
  return out
}

/** Distance along a polyline to the point on it nearest (x, y). */
export function project(pl: Polyline, x: number, y: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 1; i < pl.pts.length; i++) {
    const [ax, ay] = pl.pts[i - 1]
    const [bx, by] = pl.pts[i]
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2
    const f = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2)) : 0
    const px = ax + (bx - ax) * f
    const py = ay + (by - ay) * f
    const d = (px - x) ** 2 + (py - y) ** 2
    if (d < bestD) {
      bestD = d
      best = pl.cum[i - 1] + f * (pl.cum[i] - pl.cum[i - 1])
    }
  }
  return best
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const smoothstep = (e0: number, e1: number, v: number) => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
