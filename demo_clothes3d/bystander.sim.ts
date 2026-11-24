// A robed person standing about the start, stood by walker (`plugins/walker`, its numbers
// `world.walker.kinds.bystander`) on terrain3d's land and drawn and played by anim (`world.anim.kinds.bystander`,
// the bare body), wearing what its `clothing`
// lists, which clothing3d draws with every other body's clothes as one mesh. Each is an `actors` entry
// giving its `pos` [x, z] and `yaw`; its other fields are its prefab's, walker's and anim's beside
// `stood`, once it stands on the ground, and `clothing`, the models it wears, its definition's.
//
// `before` stands it once on the ground where its entry puts it, facing its `yaw`, and dresses it in its
// definition's `clothing`. Each step walker holds it where it stands and anim plays it standing.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { groundOf, walk } from '#plugins/walker/walker.sim.ts'

export const bystander: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.stood) return
    const [x, z] = d.pos
    d.pos = [x, groundOf(w).height(x, z), z]
    d.grounded = true
    d.clothing = [...def(w, me.kind).clothing]
    d.stood = true
  },
  tick(me, dt, w) {
    me.data.want = [0, 0]
    walk(me, w, dt, groundOf(w))
    animate(me, w, dt)
  },
}
