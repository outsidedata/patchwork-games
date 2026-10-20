// The row one seat possesses: the driver. `addons/player` spawns it and writes the slot it gave the
// connection into `seat`, and every seat is sent it, the seat's own marked `mine`. The cars are not
// it: each is a `box3dvehicle` row a `spot` actor made (`spot.sim.ts`), parked in a row, and the driver
// holds one (`take` in `plugins/player`). A page running the scene ahead (`addons/predict`) runs every
// rule on its copy, so the car it holds answers the keys on the next frame.
//
// Its row, the scene's `player` prefab, carries beside `seat` and `held`:
//   controls  `{ pedal, steer, brake }`, the last of each the seat sent, kept to its range: a page sends
//             a key or a trigger only when it changes, so one held down while the seat moves to another
//             car is handed to the car the step it takes it.
//
// `before`: while it holds no car, the first step its slot's `start`'s spot has made its car and no seat
// holds it, it takes it and hands it its controls.
//
// Its acts are the page's keys and gamepad (`player.client.ts`); each value arrives from outside the
// program, so one that is not a finite number does nothing, and one past its range is kept to it:
//   pedal, steer, brake   kept in `controls`, and passed on to the car it holds, which works the one
//             pedal (box3dvehicle's acts, `relay`).
//   next(), back()   it lets go of its car and takes the next one along the row, or the one before, in
//             the order the scene lists the spots and round, that no seat holds, so two seats never hold
//             one car, its controls handed to the car taken. The car let go is parked by its spot.
import type { Act, Row, Kind, W } from '#engine/engine.ts'
import { holderOf, holding, letGo, relay, take } from '#plugins/player/player.sim.ts'
import { carOf } from './spot.sim.ts'

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Every spot's car, in the order the scene lists the spots, once each is made.
const cars = (w: W): Row[] => w.all('spot').flatMap(s => carOf(w, s) ?? [])

const relayed = relay({ box3dvehicle: ['pedal', 'steer', 'brake'] })

// Each control of the car, and the range it is kept to.
const RANGE = { pedal: [-1, 1], steer: [-1, 1], brake: [0, 1] } as const
type Control = keyof typeof RANGE

// A control of the car: kept in `controls`, and relayed to the car it holds.
const control = (name: Control): Act => (me, w, seat, v: unknown) => {
  if (!finite(v)) return
  const [lo, hi] = RANGE[name]
  me.data.controls = { ...me.data.controls, [name]: Math.max(lo, Math.min(hi, v)) }
  if (holding(w, me)) relayed[name](me, w, seat, v)
}

// `car` taken and handed the controls the seat last sent.
function drive(me: Row, w: W, car: Row) {
  take(me, w, car)
  for (const c of Object.keys(RANGE) as Control[]) w.call(car, c, -1, me.data.controls[c])
}

// The car `by` along the row from the one it holds, round, that no seat holds, taken.
function move(me: Row, w: W, by: 1 | -1) {
  const all = cars(w), now = holding(w, me)
  const from = now ? all.indexOf(now) : -1
  for (let k = 1; k <= all.length; k++) {
    const car = all[(((from + by * k) % all.length) + all.length) % all.length]
    if (car === now || holderOf(w, car)) continue
    if (now) letGo(me)
    drive(me, w, car)
    return
  }
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
    next(me, w) { move(me, w, 1) },
    back(me, w) { move(me, w, -1) },
  },
}
