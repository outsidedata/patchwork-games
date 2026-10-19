// A patch of the pasture's grass, one a cell: the `grass` sheet's `grass` clip, drawn by sprite2d,
// each frame a stage from eaten bare (the first) to grown tall (the last), `frame` the stage it is at.
// On its first step it is `sown` at a stage the die picks, partway through it, so the pasture does not
// grow all at once. It grows a stage every `stage` seconds of its definition, `grow` the seconds it
// has stood in this one, until the last, where it is `grown` and stands. The act `eat`, which a cow
// calls, takes it back to bare.
import type { Kind } from '#engine/engine.ts'
import { def, sheet } from '#plugins/loader/loader.sim.ts'

export const grass: Kind = {
  tick(me, dt, w) {
    const d = me.data, k = def(w, me.kind)
    const look = w.world.sprite2d.kinds[me.kind]
    const last = sheet(w, look.sheet).clips[look.clip].runs[0].length - 1
    if (!d.sown) {
      d.frame = Math.floor(w.die() * (last + 1))
      d.grow = w.die() * k.stage
      d.sown = true
    }
    if (d.frame < last) {
      d.grow += dt
      if (d.grow >= k.stage) {
        d.grow -= k.stage
        d.frame++
      }
    }
    d.grown = d.frame === last
  },
  acts: {
    eat(me) {
      me.data.frame = 0
      me.data.grow = 0
      me.data.grown = false
    },
  },
}
