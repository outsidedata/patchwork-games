// A hopper: where a scene's balls start. The first step its row stands, it spawns its definition's
// `count` [across x, up, across z] balls in a grid centred over its `pos`, `spacing` metres apart, the
// lowest layer `lift` metres up, each moved across by up to `jitter` metres either way on x and z (the
// scene's die, so a grid of balls does not stand in columns too true to fall), and marks itself
// `filled`. It has no other rule and is not drawn.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const hopper: Kind = {
  before(me, _dt, w) {
    if (me.data.filled) return
    const { count: [nx, ny, nz], spacing, lift, jitter } = def(w, me.kind)
    const [x0, y0, z0] = me.data.pos
    const shake = () => (w.die() * 2 - 1) * jitter
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      w.spawn('ball', {
        pos: [x0 + (i - (nx - 1) / 2) * spacing + shake(), y0 + lift + j * spacing, z0 + (k - (nz - 1) / 2) * spacing + shake()],
      })
    }
    me.data.filled = true
  },
}
