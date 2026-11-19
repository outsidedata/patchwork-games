// The worker: an X Bot that stands where its actor puts it, walked by walker on terrain3d's land (its
// numbers `world.walker.kinds.worker`) and played and drawn by anim (`world.anim.kinds.worker`), which hangs
// what its `props` name on its bones: a wrench of item3d's in its right hand and a plain glb sword in its
// left. Its fields are walker's and the ones anim reads (`pos`, `yaw`, `vel`, `grounded`, `limp`); each
// step it wants to go nowhere, so it stands, and plays its rig's standing clip.
import type { Kind } from '#engine/engine.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { groundOf, walk } from '#plugins/walker/walker.sim.ts'

export const worker: Kind = {
  tick(me, dt, w) {
    me.data.want = [0, 0]
    me.data.face = null
    walk(me, w, dt, groundOf(w))
    animate(me, w, dt)
  },
}
