// A bug, a beetle creeping in to the harvest pile: the `bug` sheet's `walk` clip, drawn by sprite2d,
// facing the nearer of right, up, left and down as it creeps (`facing`, a quarter turn apart), its
// legs stepping as it goes (`frame` and `ft`). It walks through fences and everything else, too small
// for any to stop it.
//
// Each step it creeps `speed` cells a second, along the way to the pile with a wiggle added: `way`, a
// way the die picks again every `turn` [least, most] seconds of its definition (`turn` on its row
// counting down), `wiggle` times as strong as the pull. Within `around` of the pile it feels no pull
// and only wiggles, so it mills round the pile. Within `reach` of a pile with anything on it, it
// nibbles: the pile's `nibble` as soon as it gets there, and again every `nibble` seconds it stays
// (`nib`, the seconds until its next bite, which counts down only there). A chicken's peck ends it.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { animate, apart, between } from './plugins/walk/walk.sim.ts'

export const bug: Kind = {
  tick(me, dt, w) {
    const d = me.data, k = def(w, me.kind)
    const pile = w.all('pile')[0]
    d.turn -= dt
    if (d.turn <= 0) {
      const a = w.die() * 2 * Math.PI
      d.way = [math.cos(a), math.sin(a)]
      d.turn = between(w, k.turn)
    }
    const gap = apart(d.pos, pile.data.pos)
    if (gap <= k.reach && pile.data.items.length) {
      if (d.nib <= 0) {
        d.nib += k.nibble
        w.call(pile, 'nibble', -1)
      }
      d.nib -= dt
    }
    const pull = gap > k.around ? [(pile.data.pos[0] - d.pos[0]) / gap, (pile.data.pos[1] - d.pos[1]) / gap] : [0, 0]
    const x = pull[0] + d.way[0] * k.wiggle, y = pull[1] + d.way[1] * k.wiggle
    const len = math.hypot(x, y)
    if (len === 0) return
    const step = k.speed * dt
    d.pos = [d.pos[0] + (x / len) * step, d.pos[1] + (y / len) * step]
    d.facing = Math.abs(x) >= Math.abs(y) ? (x > 0 ? 0 : 0.5) : y < 0 ? 0.25 : 0.75
    animate(w, me, 'walk', dt)
  },
}
