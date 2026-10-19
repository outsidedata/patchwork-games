// The server half of roles, farm2d's own plugin for who plays what. A seat's `player` row is the one
// who plays, never a body: it plays a farmer, a cow or a chicken by holding it (`take` in
// `plugins/player`). Every one of them lives in the field on its own, its kind's brain playing it while
// no seat holds it, so a seat that leaves hands its thing back to the brain, which carries on from
// where it stands, and nothing comes or goes.
//
//   ROLES                   the kinds a seat may play, each a role of the `player` definition's
//                           `roles`, and the acts its keys send it: `move` and `use`.
//   board(w, me)            `me`, a `player` row whose `role` is set and that holds nothing, takes
//                           the first of that role's kind no other seat holds. When people hold every
//                           one, a new one comes in for it at the `start` of that role for its slot:
//                           so a seat is never turned away for its role, and the world keeps every one
//                           when the seat leaves. A new one's `sheet`, for a kind whose definition
//                           lists `sheets`, is the next of them after the ones already there, so the
//                           cows and the chickens come in by turns in their two looks. The thing taken
//                           is gripped (its kind's `grip`): its keys let go and its brain's plans
//                           dropped, so it stands until the seat's keys move it.
import type { Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { holderOf, take } from '#plugins/player/player.sim.ts'

export const ROLES = ['farmer', 'cow', 'chicken'] as const
export const KEYS = ['move', 'use']

export function board(w: W, me: Row) {
  const kind: string = me.data.role
  let it = w.all(kind).find(r => !holderOf(w, r))
  if (!it) {
    const start = w.find('start', s => s.data.role === kind && s.data.slot === me.data.seat)
    const sheets: string[] | undefined = def(w, kind).sheets
    it = w.spawn(kind, { pos: [...start.data.pos], ...(sheets && { sheet: sheets[w.all(kind).length % sheets.length] }) })
  }
  take(me, w, it)
  w.call(it, 'grip', -1)
}
