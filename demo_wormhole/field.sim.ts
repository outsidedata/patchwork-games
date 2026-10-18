// A field: a barrier, the box of its definition's `size` [x, y, z] round `pos`, that a body may not keep
// and a portal may not be put through. Each step, every row of a kind the portals take (the `portal`
// definition's `takes`) whose centre is in the box is ended, and a `player` row whose feet or head are
// in it ends both portals. A seat's `place` puts nothing down along a line that passes through it
// (`across`). Lasers pass it.
import type { Kind, Row } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

type V = number[]

const inside = (p: V, f: Row, size: V) => [0, 1, 2].every(i => Math.abs(p[i] - f.data.pos[i]) <= size[i] / 2)

// Whether the line from a to b passes through field f's box.
export function across(a: V, b: V, f: Row, size: V) {
  let t0 = 0, t1 = 1
  for (const i of [0, 1, 2]) {
    const lo = f.data.pos[i] - size[i] / 2, hi = f.data.pos[i] + size[i] / 2, d = b[i] - a[i]
    if (d === 0) {
      if (a[i] < lo || a[i] > hi) return false
      continue
    }
    let s0 = (lo - a[i]) / d, s1 = (hi - a[i]) / d
    if (s0 > s1) [s0, s1] = [s1, s0]
    t0 = Math.max(t0, s0)
    t1 = Math.min(t1, s1)
    if (t0 > t1) return false
  }
  return true
}

export const field: Kind = {
  tick(me, _dt, w) {
    const { size } = def(w, me.kind)
    for (const k of def(w, 'portal').takes as string[]) for (const r of w.all(k)) if (inside(r.data.pos, me, size)) w.end(r)
    for (const p of w.all('player')) {
      const [x, y, z] = p.data.pos
      if (inside([x, y, z], me, size) || inside([x, y + def(w, p.kind).eye, z], me, size)) for (const portal of w.all('portal')) w.end(portal)
    }
  },
}
