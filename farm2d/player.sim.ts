// The seat, its `player` row: who plays, never a body. `addons/player` spawns it when a connection
// takes a slot and writes that slot into `seat`; every seat is sent every seat's row, and its own with
// `mine: true`. It plays a farmer, a cow or a chicken by holding it (`held`, core's `take`), and which
// one is the `roles` plugin's (`plugins/roles`): every one lives in the field on its own, played by its
// kind's brain while no seat holds it, so a seat that leaves hands it back and the farm goes on.
//
// The row: `seat`, its slot; `conn`, the seat's number on this scene, which `arrive` writes from the
// seat it was handed; `role`, the role it plays, one of the `player` definition's `roles`, null until
// it arrives with one; `held`, what it plays, `{ kind, id }`, or null.
//
// The acts:
//   arrive(role)   from the title (core's `go` args): the role chosen there, taken once, while `role`
//                  is still null, and only one the definition's `roles` names; anything else is
//                  ignored.
//   move, use      the keys, each relayed to the thing the seat plays (core's `relay`), whose own acts
//                  they are, and nothing while it plays none.
//
// Each step, `before`: a seat with a role that plays nothing boards (`board` in `plugins/roles`), so
// it plays one from the step it arrives on.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { holding, relay } from '#plugins/player/player.sim.ts'
import { board, KEYS, ROLES } from './plugins/roles/roles.sim.ts'

export const player: Kind = {
  before(me, _dt, w) {
    if (me.data.role !== null && !holding(w, me)) board(w, me)
  },
  acts: {
    arrive(me, w, seat, role: unknown) {
      me.data.conn = seat
      if (me.data.role === null && typeof role === 'string' && Object.hasOwn(def(w, me.kind).roles, role)) me.data.role = role
    },
    ...relay(Object.fromEntries(ROLES.map(k => [k, KEYS]))),
  },
}
