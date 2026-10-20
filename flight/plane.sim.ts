// A plane of the sky: a flight3d plane (`plugins/flight3d`), since the scene's `world.flight3d.kinds`
// lists `plane`, so flight3d's browser half draws every one and this rule flies each with flight3d's
// `step` over the scene's ground (`groundOf`) every step. Every aircraft in the sky is one: a seat's
// parked on the apron, the circuit's traffic, and the formation's leads. Beside flight3d's fields
// (`type`, the plane, a name in `world.flight3d.planes`; `pos`, `rot`, `vel`, `spin`, the surfaces, the
// stick, the lever, the gear, `press`, `crashed`) it holds:
//   stand     the `name` of the `stand` actor it is kept on (`stand.sim.ts`), where it starts and where
//             it goes home to.
//   traffic   what it does while no seat holds it: `circuit`, `lap`, `lead` or "" (a seat's plane), and
//   phase, leg, laps, wait, taxi   where it is in that (the pilot plugin's header,
//             `plugins/pilot/pilot.sim.ts`).
//   placed    whether it has been put on its stand yet.
//
// `before` puts it on its stand the first step, parked for its actor's `wait` seconds. Each step, while a
// seat's `player` row holds it (`holderOf`), the seat's presses fly it and its phase is `seat`; while
// none does, the pilot flies it (`pilot`): a lead on the formation's loop (`plugins/mission`'s `trackOf`,
// at the `formation` definition's `altitude` and its type's `speeds`), any other on the circuit. Then
// flight3d steps it.
//
// Its acts are the controls, each the one input it names: `pitch`, `roll` and `yaw` the stick, -1 to 1;
// `throttle` which way the lever is pushed, -1 to 1 (the plane's `throttling`); `airbrake` and `brake`
// 0 to 1; each clamped there and refused unless a finite number. `gear` throws the gear lever, down to up
// and up to down. None is `open`: a seat reaches them only through the `player` row that holds the plane
// (`relay`), so no seat flies a plane it does not hold.
import type { Act, Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { groundOf, step, type Flight, type Plane } from '#plugins/flight3d/flight3d.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'
import { fieldIn, onStand, pilot, standOf, toWorld, type Loop } from './plugins/pilot/pilot.sim.ts'
import { trackOf } from './plugins/mission/mission.sim.ts'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const input = (field: string, lo: number): Act => (me: Row, _w: W, _seat: number, v: unknown) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return
  me.data[field] = clamp(v, lo, 1)
}

/** The formation's loop as a lead of `type` flies it, in the world over the field. */
function loopOf(w: W, type: string): Loop {
  const k = def(w, 'formation')
  const fl = fieldIn(w)
  const speed = k.speeds[type]
  if (speed === undefined) throw new Error(`the formation definition has no speed for ${type}`)
  return { pts: trackOf(k.path).pts, y: toWorld(fl, 0, 0)[1] + k.altitude, speed }
}

export const plane: Kind = {
  before(me, _dt, w) {
    if (me.data.placed) return
    onStand(me, standOf(w, me), me.data.wait)
    me.data.placed = true
  },
  tick(me, dt, w) {
    if (holderOf(w, me)) me.data.phase = 'seat'
    else pilot(w, me, dt, standOf(w, me), me.data.traffic === 'lead' ? loopOf(w, me.data.type) : undefined)
    step(me.data as Plane, w.world.flight3d as Flight, dt, groundOf(w))
  },
  acts: {
    pitch: input('pitch', -1),
    roll: input('roll', -1),
    yaw: input('yaw', -1),
    throttle: input('throttling', -1),
    airbrake: input('airbrake', 0),
    brake: input('brake', 0),
    gear(me) {
      me.data.gearDown = !me.data.gearDown
    },
  },
}
