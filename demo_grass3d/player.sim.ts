// The row one seat possesses: the driver. `addons/player` spawns it and writes the slot it gave the
// connection into `seat`, and every seat is sent it, the seat's own marked `mine`. The car is not it: the
// car is a `box3dvehicle` row a `spot` actor made (`spot.sim.ts`), and the seat holds it (`take` in
// `plugins/player`). A page running the scene ahead (`addons/predict`) runs every rule on its copy, so the
// car answers the keys on the next frame.
//
// Its row, the scene's `player` prefab, carries beside `seat` and `held`:
//   controls  `{ pedal, steer, brake }`, the last of each the seat sent, kept to its range: a page sends a
//             key or a trigger only when it changes, so one held down before the car is taken is handed
//             to the car the step it takes it.
//
// `before`: while it holds nothing, the first step its slot's `start`'s spot has made its car and no seat
// holds it, it takes it and hands it its controls.
//
// Its acts are the page's keys and gamepad (`player.client.ts`); each value arrives from outside the
// program, so one that is not a finite number does nothing, and one past its range is kept to it:
//   pedal, steer, brake   kept in `controls`, and passed on to the car it holds (`relay`): the one pedal,
//             the steering and the brake (box3dvehicle's acts).
import type { Act, Row, Kind, W } from '#engine/engine.ts'
import { holderOf, holding, relay, take } from '#plugins/player/player.sim.ts'
import { carOf } from './spot.sim.ts'

// The controls a car takes.
const TAKES: Record<string, Control[]> = { box3dvehicle: ['pedal', 'steer', 'brake'] }
const relayed = relay(TAKES)

// Each control, and the range it is kept to.
const RANGE = { pedal: [-1, 1], steer: [-1, 1], brake: [0, 1] } as const
type Control = keyof typeof RANGE

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// A control: kept in `controls`, and relayed to the car it holds.
const control = (name: Control): Act => (me, w, seat, v: unknown) => {
  if (!finite(v)) return
  const [lo, hi] = RANGE[name]
  me.data.controls = { ...me.data.controls, [name]: Math.max(lo, Math.min(hi, v)) }
  if (holding(w, me)) relayed[name](me, w, seat, v)
}

// `it` taken and handed the controls the seat last sent.
function drive(me: Row, w: W, it: Row) {
  take(me, w, it)
  for (const c of TAKES[it.kind]) w.call(it, c, -1, me.data.controls[c])
}

export const player: Kind = {
  before(me, _dt, w) {
    if (holding(w, me)) return
    const name = w.find('start', s => s.data.slot === me.data.seat).data.spot
    const car = carOf(w, w.find('spot', s => s.data.name === name))
    if (car && !holderOf(w, car)) drive(me, w, car)
  },
  acts: {
    pedal: control('pedal'),
    steer: control('steer'),
    brake: control('brake'),
  },
}
