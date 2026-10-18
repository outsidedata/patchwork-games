// A crate: a box3d body (`pos`, `rot`, `vel`, `spin`) of its definition's `size`, its body made from
// its definition by the chamber's `kinds` mod (`plugins/chamber/chamber.box3d.ts`). While it is in
// box3d's world box3d moves it; near a portal the portal's own world does (`plugins/portal`, which names
// it `inside` that portal and keeps its speed in `drift`).
//
// Out of the world. `out` takes it out (box3d's live `enabled`, false) and keeps the `vel` and `spin` it
// had in `drift`, since box3d writes a body it holds disabled back with no speed; from then on its own
// rule carries it, each step `pos` on by the drift's `vel` and `rot` on by its `spin`, in a straight
// line, nothing touching it. `in` puts it back (`enabled` true) moving at the drift's `vel` and `spin`,
// and box3d moves it from there. Neither is open: a seat reaches them through its `player` row's `take`.
// Neither does anything while the crate is inside a portal.
import type { Kind, Row } from '#engine/engine.ts'
import * as math from '#plugins/math/math.sim.ts'

export const crate: Kind = {
  tick(me, dt) {
    if (!me.data.drift || me.data.inside !== null) return
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
  },
  acts: {
    out(me) {
      if (me.data.drift) return
      me.data.drift = { vel: [...me.data.vel], spin: [...me.data.spin] }
      me.data.enabled = false
    },
    in(me: Row) {
      if (!me.data.drift || me.data.inside !== null) return
      me.data.vel = [...me.data.drift.vel]
      me.data.spin = [...me.data.drift.spin]
      me.data.drift = null
      me.data.enabled = true
    },
  },
}
