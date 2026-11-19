// The guard: the library's soldier, standing where its actor puts it, walked by walker on terrain3d's land
// (`world.walker.kinds.guard`) and played and drawn by anim (`world.anim.kinds.guard`). It wears a tee of the
// library's garment shop, draped on this body in its T-pose by the bake and moved as cloth by fabric3d
// (`world.fabric3d`, `assets/fabrics.json`): its sleeves held on its upper arms, the rest hanging from them
// against the body's capsules. Its fields are walker's and the ones anim reads; each step it wants to go
// nowhere, so it stands and plays its rig's standing clip.
import type { Kind } from '#engine/engine.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { groundOf, walk } from '#plugins/walker/walker.sim.ts'

export const guard: Kind = {
  tick(me, dt, w) {
    me.data.want = [0, 0]
    me.data.face = null
    walk(me, w, dt, groundOf(w))
    animate(me, w, dt)
  },
}
