// chamber, demo_wormhole's own: the level, the pieces the walker stands on and a portal is put on,
// read off the definition of the `chamber` row (one `actors` entry) in `assets/demo_wormhole.json`:
// `below`, metres, the ground's height where no piece stands, and `levels`, each level by name:
//   boxes   { min, max, colour, lines?, line? }: a solid box from `min` to `max` [x, y, z], metres.
//   ramps   { min, max, toward, colour }: a wedge over the box from `min` to `max`, its top rising
//           from `min`'s y at the edge `toward` points away from to `max`'s y at the edge it points
//           at; `toward` is [x, z], one of the four axes.
// The row's `level` names the level its scene stands in; it never changes.
//
// `heightAt(w, x, z)` is the top of the highest piece over (x, z), as the walker stands on it
// (`chamber.walker.ts`), with every portal's opening let in (the `portal` rows): a portal on a box's
// top makes a pit `pit` metres deep across its opening, so a body walks or falls into it; a portal
// on a box's side lowers the box, through its depth and across the opening's width, to the opening's
// bottom edge, so a body passes the face inside the opening and nowhere else.
//
// `ray(w, from, dir)` is where a line from `from` along `dir` first meets a piece: `{ t, point,
// normal, box }`, the outward normal of the face it meets and the index of the box it is on, or
// `box` -1 for a ramp; undefined where it meets none. `bounds(w)` is the floor plan every piece
// covers, [[x0, z0], [x1, z1]], which the walker is kept inside. `piecesOf(w)` is the row's level's
// `boxes` and `ramps`, with the definition's `below`, and `levelOf(chamber, defs)` the same for a
// chamber row and its definition, for a page.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export const chamber: Kind = {}

type V3 = [number, number, number]
type Box = { min: V3; max: V3 }
type Ramp = { min: V3; max: V3; toward: [number, number] }
type Plane = { n: V3; d: number }

type Pieces = { boxes: Box[]; ramps: Ramp[]; below: number }
export const levelOf = (row: Row, d: { below: number; levels: Record<string, { boxes: Box[]; ramps: Ramp[] }> }): Pieces => ({ ...d.levels[row.data.level], below: d.below })
export const piecesOf = (w: W): Pieces => {
  const row = w.find('chamber')
  return levelOf(row, def(w, row.kind))
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const within = (p: { min: V3; max: V3 }, x: number, z: number) => x >= p.min[0] && x <= p.max[0] && z >= p.min[2] && z <= p.max[2]

// A ramp's top at (x, z): its run along `toward` from the low edge, as a share of the whole run.
function rampTop(r: Ramp, x: number, z: number) {
  const [tx, tz] = r.toward
  const low = tx + tz > 0 ? r.min : r.max
  const run = Math.abs(tx) * (r.max[0] - r.min[0]) + Math.abs(tz) * (r.max[2] - r.min[2])
  const along = (x - low[0]) * tx + (z - low[2]) * tz
  return r.min[1] + (r.max[1] - r.min[1]) * (along / run)
}

export function heightAt(w: W, x: number, z: number): number {
  const { boxes, ramps, below } = piecesOf(w)
  const portals = w.all('portal')
  let top = below
  boxes.forEach((b, i) => {
    if (!within(b, x, z)) return
    let h = b.max[1]
    for (const p of portals) if (p.data.on === i) h = opened(w, p, h, x, z)
    top = Math.max(top, h)
  })
  for (const r of ramps) if (within(r, x, z)) top = Math.max(top, rampTop(r, x, z))
  return top
}

// A box's top `h` at (x, z) with portal `p` on it let in.
function opened(w: W, p: Row, h: number, x: number, z: number) {
  const { width, height, pit } = def(w, p.kind)
  const [px, py, pz] = p.data.pos
  const n: number[] = p.data.normal, u: number[] = p.data.up
  const r = cross(u, n)
  const d = [x - px, 0, z - pz]
  if (n[1] > 0.5) return Math.abs(dot(d, r)) < width / 2 && Math.abs(dot(d, u)) < height / 2 ? h - pit : h
  return Math.abs(dot(d, r)) < width / 2 ? Math.min(h, py - height / 2) : h
}

export const cross = (a: number[], b: number[]): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// A piece as the planes that bound it, each kept where dot(n, p) <= d.
function box(b: { min: V3; max: V3 }): Plane[] {
  return [
    { n: [1, 0, 0], d: b.max[0] }, { n: [-1, 0, 0], d: -b.min[0] },
    { n: [0, 1, 0], d: b.max[1] }, { n: [0, -1, 0], d: -b.min[1] },
    { n: [0, 0, 1], d: b.max[2] }, { n: [0, 0, -1], d: -b.min[2] },
  ]
}
function wedge(r: Ramp): Plane[] {
  const [tx, tz] = r.toward
  const low = tx + tz > 0 ? r.min : r.max
  const run = Math.abs(tx) * (r.max[0] - r.min[0]) + Math.abs(tz) * (r.max[2] - r.min[2])
  const k = (r.max[1] - r.min[1]) / run
  // y − k·((x, z) − low)·toward ≤ min.y, normalised.
  const n: V3 = [-k * tx, 1, -k * tz]
  const m = math.hypot(...n)
  const slope = { n: [n[0] / m, n[1] / m, n[2] / m] as V3, d: (r.min[1] - k * (low[0] * tx + low[2] * tz)) / m }
  return [...box(r).filter(p => p.n[1] !== 1), slope]
}

// Where the line enters the solid the planes bound, and that plane's normal; undefined if it misses.
function enter(planes: Plane[], from: number[], dir: number[]) {
  let t0 = 0, t1 = Infinity, normal: V3 | undefined
  for (const { n, d } of planes) {
    const along = dot(n, dir), gap = d - dot(n, from)
    if (along === 0) {
      if (gap < 0) return undefined
      continue
    }
    const t = gap / along
    if (along < 0) {
      if (t > t0) { t0 = t; normal = n }
    } else if (t < t1) t1 = t
    if (t0 > t1) return undefined
  }
  return normal ? { t: t0, normal } : undefined
}

export function ray(w: W, from: number[], dir: number[]) {
  const { boxes, ramps } = piecesOf(w)
  let best: { t: number; normal: V3; box: number } | undefined
  const take = (hit: { t: number; normal: V3 } | undefined, i: number) => {
    if (hit && (!best || hit.t < best.t)) best = { ...hit, box: i }
  }
  boxes.forEach((b, i) => take(enter(box(b), from, dir), i))
  for (const r of ramps) take(enter(wedge(r), from, dir), -1)
  if (!best) return undefined
  const { t } = best
  return { ...best, point: [from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t] as V3 }
}

export function bounds(w: W): [[number, number], [number, number]] {
  const { boxes, ramps } = piecesOf(w)
  const all = [...boxes, ...ramps]
  return [
    [Math.min(...all.map(p => p.min[0])), Math.min(...all.map(p => p.min[2]))],
    [Math.max(...all.map(p => p.max[0])), Math.max(...all.map(p => p.max[2]))],
  ]
}
