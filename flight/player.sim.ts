// The row one seat possesses: the pilot, who holds a `plane` (`plane.sim.ts`) with core's hold functions
// (`plugins/player/player.sim.ts`: `take`, `letGo`, `holding`, `relay`), its `held` field the plane it
// holds. `addons/player` spawns it and writes the slot it gave the connection into `seat`, and every
// seat is sent it; a page running the scene ahead (`addons/predict`) runs every rule on its copy, so the
// plane it holds answers the stick on the next frame. It holds what the seat picked: `type`, the plane;
// `mission`, `free`, `rings` or `formation`; `from`, where it starts, `ramp` (parked on its stand on the
// apron) or `air` (flying, at the mission's place); `picked`, whether the seat has picked them on the
// menu yet (until then it has the prefab's, and the page shows it the menu); `launched`, how many times
// its plane has been put on its start, 0 before the first, which the page's camera jumps on; and the
// seat's progress on its mission, `course` while it flies Rings and `formation` while it flies
// Formation, each null otherwise (`plugins/mission`).
//
// Its planes are the seat's slot's: the `plane` of each type kept on a `stand` whose `slot` is the seat's
// (`planeOf`). Boarding (`board`) lets go of the plane it holds, takes its slot's plane of `type`, and
// launches it: on the ramp the plane is put on its stand; in the air on the formation it is put in the
// seat's slot off the formation's lead (`inSlot`); in the air otherwise at the `start` actor
// (`start.sim.ts`) of its slot, its `type`, `air` and its mission. The plane is put down at rest
// otherwise (no turn, surfaces and stick centred, the lever still, no brakes, the gear down and locked,
// not crashed), and the mission begun afresh: a `course` for rings, a `formation` for formation, neither
// for free flight. A plane it lets go of is the pilot's (`plugins/pilot`), which flies it home.
//
// `before` boards the prefab's plane when the seat has never launched. `after`, each step, its mission is
// run on the plane it holds (`rings` and `formation`, `plugins/mission`).
//
// The controls, `pitch`, `roll`, `yaw`, `throttle`, `airbrake`, `brake` and `gear`, are relayed to the
// plane it holds, whose acts they are. `again` launches the plane it holds afresh. `pick(plane, mission,
// start)` takes the plane, mission and start at those places in the `menu` definition's lists, marks the
// seat `picked`, and boards; places outside the lists are refused.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { holding, letGo, relay, take } from '#plugins/player/player.sim.ts'
import { setDown, standOf, type Place } from './plugins/pilot/pilot.sim.ts'
import { formation, freshCourse, freshFormation, inSlot, rings } from './plugins/mission/mission.sim.ts'

/** The plane of `type` kept for seat slot `seat`. */
export function planeOf(w: W, seat: number, type: string): Row {
  const it = w.all('plane').find(p => p.data.type === type && p.data.traffic === '' && standOf(w, p).data.slot === seat)
  if (!it) throw new Error(`no ${type} is kept for seat slot ${seat}`)
  return it
}

function launch(me: Row, w: W) {
  const plane = holding(w, me)
  if (!plane) return
  const { seat, type, mission, from } = me.data
  if (from === 'ramp') setDown(plane.data, standOf(w, plane).data as Place)
  else if (mission === 'formation') inSlot(w, plane, seat)
  else setDown(plane.data, w.find('start', s => s.data.slot === seat && s.data.plane === type && s.data.from === 'air' && s.data.mission === mission).data as Place)
  plane.data.phase = 'seat'
  Object.assign(me.data, {
    launched: me.data.launched + 1,
    course: mission === 'rings' ? freshCourse() : null,
    formation: mission === 'formation' ? freshFormation() : null,
  })
}

function board(me: Row, w: W) {
  letGo(me)
  take(me, w, planeOf(w, me.data.seat, me.data.type))
  launch(me, w)
}

export const player: Kind = {
  before(me, _dt, w) {
    if (!me.data.launched) board(me, w)
  },
  after(me, dt, w) {
    const plane = holding(w, me)
    if (!plane) return
    if (me.data.course) rings(w, me, plane, dt)
    if (me.data.formation) formation(w, me, plane, dt)
  },
  acts: {
    ...relay({ plane: ['pitch', 'roll', 'yaw', 'throttle', 'airbrake', 'brake', 'gear'] }),
    again(me, w) {
      launch(me, w)
    },
    pick(me, w, _seat, plane: unknown, mission: unknown, start: unknown) {
      if (![plane, mission, start].every(i => Number.isInteger(i))) return
      const k = def(w, 'menu')
      const p = k.planes[plane as number], m = k.missions[mission as number], s = k.starts[start as number]
      if (!p || !m || !s) return
      me.data.type = p.type
      me.data.mission = m.name
      me.data.from = s.name
      me.data.picked = true
      board(me, w)
    },
  },
}
