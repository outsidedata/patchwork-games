// A laser: an emitter standing at `pos`, firing along the unit `dir`. Each step its beam is traced
// through the portals (`plugins/portal`'s `trace`): up to its definition's `reach` metres in all,
// through at most `passes` portals a stretch, ending on the first body, fixed thing or `marks` row it
// meets. A beam that ends on a row of a kind `bends` names goes on out of that row's front (its +z,
// turned as it is), from just past its `size`, as a redirection cube sends it, at most `bends.most`
// times. `beam` is each stretch's points, `hit` the row it ends on (null on the level or nothing).
// A `player` row within `hurt.radius` of a stretch, between its feet and `hurt.height` over them, is
// thrown along the beam at `hurt.push` metres a second and up at `hurt.lift` (its `zap`).
import type { Kind, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { rotate, trace } from './plugins/portal/portal.sim.ts'

type V = number[]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// The row of id `id` among the kinds named, or undefined.
const rowOf = (w: W, kinds: string[], id: number | null) => (id === null ? undefined : kinds.flatMap(k => w.all(k)).find(r => r.id === id))

// Whether the stretch from a to b passes within `radius` of the upright line over `foot`, between it
// and `height` above it.
function touches(a: V, b: V, foot: V, radius: number, height: number) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const len2 = dot(d, d)
  if (len2 === 0) return false
  // The point of the stretch nearest the upright line, found in the ground plane.
  const flat = d[0] * d[0] + d[2] * d[2]
  const t = flat === 0 ? 0 : Math.max(0, Math.min(1, ((foot[0] - a[0]) * d[0] + (foot[2] - a[2]) * d[2]) / flat))
  const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]
  return Math.hypot(p[0] - foot[0], p[2] - foot[2]) < radius && p[1] >= foot[1] && p[1] <= foot[1] + height
}

export const laser: Kind = {
  tick(me, _dt, w) {
    const { reach, passes, marks, bends, hurt } = def(w, me.kind)
    const beam: V[][] = []
    let from: V = me.data.pos, dir: V = me.data.dir, left = reach, hit: number | null = null
    for (let k = 0; k <= bends.most; k++) {
      const stretch = trace(w, from, dir, left, passes, marks)
      beam.push(stretch.points)
      hit = stretch.hit
      for (let i = 1; i < stretch.points.length; i += 2) {
        const a = stretch.points[i - 1], b = stretch.points[i]
        left -= Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      }
      const bend = rowOf(w, bends.kinds, hit)
      if (!bend || left <= 0) break
      dir = rotate(bend.data.rot, [0, 0, 1])
      const out = def(w, bend.kind).size * 0.75
      from = [0, 1, 2].map(i => bend.data.pos[i] + dir[i] * out)
    }
    me.data.beam = beam
    me.data.hit = hit
    for (const p of w.all('player')) {
      for (const stretch of beam) for (let i = 1; i < stretch.length; i += 2) {
        const a = stretch[i - 1], b = stretch[i]
        if (!touches(a, b, p.data.pos, hurt.radius, hurt.height)) continue
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
        w.call(p, 'zap', -1, ...[0, 1, 2].map(j => ((b[j] - a[j]) / len) * hurt.push), hurt.lift)
      }
    }
  },
}
