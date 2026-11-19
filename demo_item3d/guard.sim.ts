// The guard: the library's soldier, standing where its actor puts it, walked by walker on terrain3d's land
// (`world.walker.kinds.guard`) and drawn by anim (`world.anim.kinds.guard`). Its rig has no clip
// (`assets/guard.rig.json`), so it stands as its model is at rest, in its T-pose: the pose the bake draped its
// tee on it in. It wears that tee, of the library's garment shop, moved as cloth by fabric3d (`world.fabric3d`,
// `assets/fabrics.json`), which the bodies sheet says it wears, against the capsules the sheet gives it
// (`assets/demo_item3d.bodies.json`). Its fields are walker's and the ones anim reads; each step it wants to go
// nowhere, so it stands.
import type { Kind } from '#engine/engine.ts'
import { groundOf, walk } from '#plugins/walker/walker.sim.ts'

export const guard: Kind = {
  tick(me, dt, w) {
    me.data.want = [0, 0]
    me.data.face = null
    walk(me, w, dt, groundOf(w))
  },
}
