// A pad on the floor of the room, which plays one of particle3d's effects while a seat's body stands on
// it. Its row: `pos` [x, y, z], the middle of the pad on the floor; `plays`, the name of the entry of
// its definition's `plays` it plays; `on`, whether a body stands on it; `t`, the seconds since it last
// threw its effect; and `fx`, the id of the ledger entry of the stream it holds on, 0 when it holds none.
// Every number is the pad's definition in `assets/demo_particle3d.json`.
//
// Each step it looks for a `player` row standing on it: one whose feet are within `radius` metres of the
// pad's middle across the floor steps onto it, and one standing on it steps off once it is further than
// `leave`, so a body on the edge does not step on and off every step. What it plays is its entry of
// `plays`: `effect`, the effect of the scene's effects file; `lift`, [x, y, z] metres off the pad's
// middle it is thrown from, the middle itself when left out; and one of:
//   stream   the effect runs while a body stands on the pad: it is emitted the step one steps on, and
//            each step after its `life` is kept `hold` seconds past its age, so it stops `hold` seconds
//            after the body steps off and every page sees it through.
//   again    the effect is one burst, thrown the step a body steps on, and again every `again` seconds
//            while it stands there.
// Every effect is thrown with the floor, y 0, as the height its particles come to rest at.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { emit, entry } from '#plugins/particle3d/particle3d.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

type Play = { effect: string; colour: string; lift?: number[]; stream?: boolean; again?: number }

// Whether a `player` row's feet are within `r` metres of the pad's middle across the floor.
const within = (me: Row, w: W, r: number) =>
  w.all('player').some(p => math.hypot(p.data.pos[0] - me.data.pos[0], p.data.pos[2] - me.data.pos[2]) <= r)

// The effect of the pad's entry thrown from its point.
function play(me: Row, w: W, it: Play, life: number) {
  const lift = it.lift ?? [0, 0, 0]
  const at = [0, 1, 2].map(i => me.data.pos[i] + lift[i])
  me.data.t = 0
  return emit(w, it.effect, at, { life, dir: [0, 1, 0], floor: 0 })
}

export const pad: Kind = {
  tick(me, dt, w) {
    const d = me.data
    const k = def(w, me.kind)
    const it = k.plays[d.plays] as Play
    const was = d.on
    d.on = within(me, w, was ? k.leave : k.radius)
    d.t += dt
    if (it.stream) {
      const held = d.fx ? entry(w, d.fx) : undefined
      if (d.on && !held) d.fx = play(me, w, it, k.hold).id
      else if (d.on && held) held.life = held.age + k.hold
      else if (!d.on) d.fx = 0
      return
    }
    if (d.on && (!was || d.t >= it.again!)) play(me, w, it, 0)
  },
}
