// A mob: a row the `mmo3d` row spawns from a template of `type: "mob"` in the place's mmo3d file
// (`plugins/mmo3d/mmo3d.sim.ts`). A walker (`plugins/walker`, its numbers `world.walker.kinds.<as>`) on the place's
// shapes and the land (shapes3d's ground at its own feet, `plugins/shapes3d`, and round lod3d's trees and boulders in a
// scene that has them), drawn by anim (`world.anim.kinds.<as>`), which plays its rig's idle, walk and run by how it
// moves. It wants to go nowhere, so it stands and plays its idle. Its fields, beside walker's and anim's: `template`,
// the template it was made from; `as`, its body's kind; `gas`, gas3d's (`plugins/gas3d/gas3d.sim.ts`), started on its
// first step from its template's `attributes` and stepped every step; and `dead`, which hitscan3d reads
// (`world.hitscan3d.kinds.mob.off`) so a round passes a dead one.
//
// Its act `hit` is handed a `Struck` naming the `ability` that struck it and the row it was `by`: gas3d puts that
// ability's effects on it, and, while its health is over 0, it plays its template's `hit.clip` once through from
// `hit.from` seconds in, past the still start of the clip. The step its health reaches 0, by a strike or by an effect
// on it (a burn), it plays its template's `death` and holds it there, and is `dead`; a dead mob takes no strikes.
// The hero's blow and a firebolt's round, met by hitscan3d, strike it (`plugins/hero/hero.sim.ts`).
import type { Kind, Row, W } from '#engine/engine.ts'
import type { Struck } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { ground } from '#plugins/shapes3d/shapes3d.walker.ts'
import { solids as trees } from '#plugins/lod3d/lod3d.walker.ts'
import { numbers, walk } from '#plugins/walker/walker.sim.ts'
import { animate, play } from '#plugins/anim/anim.sim.ts'
import { templateOf } from './plugins/mmo3d/mmo3d.sim.ts'
import { receive, start, step, value } from './plugins/gas3d/gas3d.sim.ts'

// Its death, the step its health reaches 0.
function dies(me: Row, w: W) {
  const d = me.data
  if (d.dead || value(w, me, 'health') > 0) return
  play(me, templateOf(w, me).death, { holds: true })
  d.dead = true
}

export const mob: Kind = {
  tick(me, dt, w) {
    const d = me.data
    if (!d.gas) start(w, me, templateOf(w, me).attributes)
    step(w, me, dt)
    dies(me, w)
    d.want = [0, 0]
    d.face = null
    const on = ground(w, d.pos[1], numbers(me, w))
    walk(me, w, dt, w.world.lod3d ? { ...on, solids: (x, z, r) => [...on.solids(x, z, r), ...trees(w, x, z, r)] } : on)
    animate(me, w, dt)
  },
  acts: {
    hit(me, w, _seat, struck: unknown) {
      const d = me.data
      const s = struck as Struck
      if (d.dead || !d.gas || typeof s.ability !== 'string') return
      receive(w, me, s.ability, s.by)
      if (value(w, me, 'health') > 0) {
        const t = templateOf(w, me)
        play(me, t.hit.clip)
        d.clipT = t.hit.from
      } else dies(me, w)
    },
  },
}
