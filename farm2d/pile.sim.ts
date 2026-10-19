// The harvest pile in the chickens' yard: `items`, the produce on it, each by its crop's clip, the
// last put on last. It has no rule of its own. The farmer puts produce on it (`add`); a bug nibbles the
// last off (`nibble`), crumbs bursting from the pile (the effect `crumbs`) and the `sounds.nibble`
// sound ringing from it, and a bug at an empty pile nibbles nothing. It is drawn by its look
// (`pile.client.ts`).
import type { Kind } from '#engine/engine.ts'
import { sound } from '#plugins/audio/audio.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { emit } from '#plugins/particle2d/particle2d.sim.ts'

export const pile: Kind = {
  acts: {
    add(me, _w, _seat, clip: string) {
      me.data.items = [...me.data.items, clip]
    },
    nibble(me, w) {
      if (!me.data.items.length) return
      const k = def(w, me.kind)
      me.data.items = me.data.items.slice(0, -1)
      emit(w, k.crumbs, me.data.pos)
      sound(w, k.sounds.nibble, undefined, me.id)
    },
  },
}
