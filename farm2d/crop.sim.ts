// A crop in the tilled plot, grown where the farmer put manure down: the `crops` sheet's clip its
// row's `clip` names (`strawberry`, `leek`, `potato`, `onion`), each frame of it a stage from seed to
// ripe, drawn by sprite2d. Its rule picks the stage, `frame`, and none of it is timed by the sheet.
//
// The farmer spawns it and calls `sow` at once, which picks its type with the die, one of its
// definition's `types`, from its first stage. Each stage lasts its type's `stage` seconds, `grow` the
// seconds it has stood in this one, until the last frame of its clip, where it is `ripe` and stands
// until it is picked. The act `pick`, which the farmer calls, bursts leaves and soil from it (the
// effect `burst`), lifts its produce from it (its type's `pop`), and takes it out of the field.
import type { Kind } from '#engine/engine.ts'
import { def, sheet } from '#plugins/loader/loader.sim.ts'
import { emit } from '#plugins/particle2d/particle2d.sim.ts'

export const crop: Kind = {
  tick(me, dt, w) {
    const d = me.data
    if (d.ripe) return
    const type = def(w, me.kind).types[d.clip]
    const last = sheet(w, w.world.sprite2d.kinds[me.kind].sheet).clips[d.clip].runs[0].length - 1
    d.grow += dt
    if (d.grow >= type.stage) {
      d.grow -= type.stage
      d.frame++
    }
    d.ripe = d.frame >= last
  },
  acts: {
    sow(me, w) {
      const types = Object.keys(def(w, me.kind).types)
      me.data.clip = types[Math.floor(w.die() * types.length)]
      me.data.frame = 0
      me.data.grow = 0
      me.data.ripe = false
    },
    pick(me, w) {
      const k = def(w, me.kind)
      emit(w, k.burst, me.data.pos)
      emit(w, k.types[me.data.clip].pop, me.data.pos)
      w.end(me)
    },
  },
}
