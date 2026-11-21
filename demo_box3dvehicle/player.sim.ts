// The row one seat possesses: the rider. `addons/player` spawns it and writes the slot it gave the
// connection into `seat`, and every seat is sent it, the seat's own marked `mine`. The bike is not it: the
// bike is a `box3dvehicle` row of the scene's `actors` (`name`d, `world.box3dvehicle.vehicles.motorcycle`), and the
// seat holds it (`take` in `plugins/player`). A page running the scene ahead (`addons/predict`) runs every rule on its
// copy, so the bike answers the keys on the next frame.
//
// Its row, the scene's `player` prefab, carries beside `seat` and `held`:
//   controls  `{ pedal, steer, brake }`, the last of each the seat sent, kept to its range: a page sends a
//             key or a trigger only when it changes, so one held down before the bike is taken is handed
//             to the bike the step it takes it.
//
// `before`: while it holds nothing, the first step the bike its slot's `start` names has been made and no
// seat holds it, it takes it and hands it its controls.
//
// Its acts are the page's keys (`player.client.ts`); each value arrives from outside the program, so one
// that is not a finite number does nothing, and one past its range is kept to it:
//   pedal    -1 to 1: forward drive; below 0 it brakes (a bike has no reverse).
//   steer    -1 to 1, positive left.
//   brake    0 to 1.
// Each is passed on to the bike it holds as box3dvehicle's acts: `pedal` the forward part of the pedal, `steer`,
// and `brake` the greater of the brake and the pedal held back.
import type { Act, Kind, Row, W } from '#engine/engine.ts'
import { holderOf, holding, take } from '#plugins/player/player.sim.ts'

const RANGE = { pedal: [-1, 1], steer: [-1, 1], brake: [0, 1] } as const
type Control = keyof typeof RANGE

// The seat's controls handed to the bike `it`, each as the car's own act.
function hand(me: Row, w: W, it: Row) {
  const { pedal, steer, brake } = me.data.controls
  w.call(it, 'pedal', -1, Math.max(0, pedal))
  w.call(it, 'steer', -1, steer)
  w.call(it, 'brake', -1, Math.max(brake, -pedal))
}

const control = (name: Control): Act => (me, w, _seat, v: unknown) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return
  const [lo, hi] = RANGE[name]
  me.data.controls = { ...me.data.controls, [name]: Math.max(lo, Math.min(hi, v)) }
  const bike = holding(w, me)
  if (bike) hand(me, w, bike)
}

export const player: Kind = {
  before(me, _dt, w) {
    if (holding(w, me)) return
    const name = w.find('start', s => s.data.slot === me.data.seat).data.spot
    const bike = w.all('box3dvehicle').find(b => b.data.name === name && b.data.chassis !== undefined)
    if (bike && !holderOf(w, bike) && take(me, w, bike)) hand(me, w, bike)
  },
  acts: {
    pedal: control('pedal'),
    steer: control('steer'),
    brake: control('brake'),
  },
}
