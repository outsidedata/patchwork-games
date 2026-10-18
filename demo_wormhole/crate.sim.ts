// A crate: a box3d body (`pos`, `rot`, `vel`, `spin`) of its definition's `size`, its body made from
// its definition by the chamber's `kinds` mod (`plugins/chamber/chamber.box3d.ts`). While it is in
// box3d's world box3d moves it.
//
// Out of the world. `out` takes it out (box3d's live `enabled`, false) and keeps the `vel` and `spin` it
// had in `drift`, since box3d writes a body it holds disabled back with no speed; from then on its own
// rule carries it, each step `pos` on by the drift's `vel` and `rot` on by its `spin`, in a straight
// line, nothing touching it. `in` puts it back (`enabled` true) moving at the drift's `vel` and `spin`,
// and box3d moves it from there. Neither is open: a seat reaches them through its `player` row's `take`.
//
// Through a portal (`plugins/portal`). A crate in the world is taken out the step before it would
// touch a portal's plane, moving toward its front, when the other portal stands and its centre is over
// the opening; `inside` names that portal. A crate partly past the opening's edge goes through all the
// same, nothing stopping the part past the edge. It drifts. The step its centre crosses the plane, its place, its
// turn, and its drift's `vel` and `spin` are carried to the other portal, `inside` names that one, and
// `jumps` counts it, so its look draws it there at once (`guide-to-smooth-gameplay`). The step it
// stands clear of the plane it is in front of, moving away from it, it is put back in the world moving
// as it drifted. A crate that misses the opening
// meets the wall the portal is on, as box3d has it.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { ahead, other, over, point, rotate, turned, vector } from './plugins/portal/portal.sim.ts'

type V = number[]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// How far the crate reaches from its centre along `n`.
const reach = (me: Row, half: number, n: V) =>
  half * [[1, 0, 0], [0, 1, 0], [0, 0, 1]].reduce((sum, axis) => sum + Math.abs(dot(rotate(me.data.rot, axis), n)), 0)

function drift(me: Row, dt: number) {
  const [px, py, pz] = me.data.pos, [vx, vy, vz] = me.data.drift.vel
  me.data.pos = [px + vx * dt, py + vy * dt, pz + vz * dt]
  // q' = q + ½·(spin, 0)·q·dt, kept to a unit's length.
  const [x, y, z, s] = me.data.rot, [wx, wy, wz] = me.data.drift.spin
  const h = dt / 2
  const q = [
    x + h * (s * wx + wy * z - wz * y),
    y + h * (s * wy + wz * x - wx * z),
    z + h * (s * wz + wx * y - wy * x),
    s - h * (wx * x + wy * y + wz * z),
  ]
  const m = math.hypot(q[0], q[1], q[2], q[3])
  me.data.rot = q.map(v => v / m)
}

const out = (me: Row) => {
  me.data.drift = { vel: [...me.data.vel], spin: [...me.data.spin] }
  me.data.enabled = false
}
const back = (me: Row) => {
  me.data.vel = [...me.data.drift.vel]
  me.data.spin = [...me.data.drift.spin]
  me.data.drift = null
  me.data.inside = null
  me.data.enabled = true
}

// Taken out by the portal it is about to touch, if any.
function eaten(me: Row, w: W, dt: number, half: number) {
  const v: V = me.data.vel
  for (const a of w.all('portal')) {
    if (!other(w, a)) continue
    const n: V = a.data.normal
    const toward = -dot(v, n)
    const gap = ahead(a, me.data.pos)
    if (toward <= 0 || gap <= 0 || gap - reach(me, half, n) > toward * dt || !over(w, a, me.data.pos)) continue
    out(me)
    me.data.inside = a.data.name
    return
  }
}

export const crate: Kind = {
  tick(me, dt, w) {
    const half = def(w, me.kind).size / 2
    if (!me.data.drift) {
      eaten(me, w, dt, half)
      return
    }
    const from = me.data.pos
    drift(me, dt)
    const a = me.data.inside === null ? undefined : w.all('portal').find(p => p.data.name === me.data.inside)
    if (!a) return
    const b = other(w, a)
    if (b && ahead(a, from) > 0 && ahead(a, me.data.pos) <= 0) {
      me.data.pos = point(a, b, me.data.pos)
      me.data.rot = turned(a, b, me.data.rot)
      me.data.drift = { vel: vector(a, b, me.data.drift.vel), spin: vector(a, b, me.data.drift.spin) }
      me.data.inside = b.data.name
      me.data.jumps += 1
      return
    }
    // Moving away from the plane it is in front of and clear of it: back in the world.
    const n: V = a.data.normal
    if (dot(me.data.drift.vel, n) > 0 && ahead(a, me.data.pos) > reach(me, half, n)) back(me)
  },
  acts: {
    out(me) {
      if (!me.data.drift) out(me)
    },
    in(me) {
      if (me.data.drift) back(me)
    },
  },
}
