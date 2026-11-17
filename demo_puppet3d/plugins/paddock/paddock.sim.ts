// paddock's server half: the rules of the animals shown at stations and of the seat that keeps them.
//
// `strider`, the rule of an animal shown at a station: it goes round a circle about where its `actors`
// entry put it on the land, at the speed the seat's `keeper` picks (its `gait`, 0 a stand to 4 the
// fastest), posed as the puppet the keeper picks (its `puppet`, which of the animal's `puppets`). Its
// row: `stood`, `pos`, `yaw`, `vel`, `puppet` (the name puppet3d poses it as), `home`, `angle`,
// `speed`, `at` (its station), `lift` and `look` (the camera's, chasecamera3d's). Its definition:
// `puppets`, the names of its sheet's puppets the keeper steps through; `speeds { <puppet>: [five
// speeds, m/s] }`, the speed of each gait as each puppet; `show { radius, accel, dist, lift }`, the
// circle's radius, how fast it gathers speed (m/s²), and how far off and how high the camera is held.
//
// `keeper`, the rule of the seat's `player` row, which is no animal: `station`, the station the camera
// is on; `gait`; `puppet`; `orbit` and `swing`, the camera turned round what it looks at. Its
// definition: `stations` and `puppets`, how many of each there are, and `view { yaw, pitch, orbit }`.
// Its acts: `station(by)` on, 1, or back, -1, round; `gait(i)`; `puppet()`, on to the next puppet,
// round; `orbit(x)`.
//
// The land is the ground the scene's walkers stand on (`groundOf`).
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf } from '#plugins/walker/walker.sim.ts'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const stick = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -1 && v <= 1

export const strider: Kind = {
  before(me) {
    if (me.data.stood) return
    me.data.home = [me.data.pos[0], me.data.pos[2]]
    me.data.stood = true
  },
  tick(me, dt, w) {
    const d = def(w, me.kind), s = d.show, keeper = w.all('player')[0]
    me.data.puppet = d.puppets[keeper.data.puppet]
    const want = d.speeds[me.data.puppet][keeper.data.gait]
    me.data.speed += clamp(want - me.data.speed, -s.accel * dt, s.accel * dt)
    me.data.angle = wrap(me.data.angle + (me.data.speed / s.radius) * dt)
    const x = me.data.home[0] + math.sin(me.data.angle) * s.radius, z = me.data.home[1] + math.cos(me.data.angle) * s.radius
    me.data.yaw = wrap(me.data.angle + Math.PI / 2)
    me.data.pos = [x, groundOf(w).height(x, z), z]
    me.data.vel = [math.sin(me.data.yaw) * me.data.speed, 0, math.cos(me.data.yaw) * me.data.speed]
    const view = def(w, 'player').view
    me.data.lift = s.lift
    me.data.look = { yaw: me.data.yaw + view.yaw + keeper.data.swing, pitch: view.pitch, dist: s.dist }
  },
}

export const keeper: Kind = {
  tick(me, dt, w) {
    me.data.swing += me.data.orbit * def(w, me.kind).view.orbit * dt
  },
  acts: {
    station(me, w, _seat, by: unknown) {
      if (by !== 1 && by !== -1) return
      const n = def(w, me.kind).stations
      me.data.station = (me.data.station + by + n) % n
    },
    gait(me, _w, _seat, i: unknown) {
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 4) return
      me.data.gait = i
    },
    puppet(me, w) {
      me.data.puppet = (me.data.puppet + 1) % def(w, me.kind).puppets
    },
    orbit(me, _w, _seat, x: unknown) {
      if (stick(x)) me.data.orbit = x
    },
  },
}
