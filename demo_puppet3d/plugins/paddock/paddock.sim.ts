// paddock's server half: the rules of the bodies shown at stations and of the seat that keeps them.
//
// `strider`, the rule of an animal shown at a station: it goes round a circle about where its `actors`
// entry put it on the land, at the speed of the pace the seat's `keeper` picks (its `gait`, 0 a stand,
// 1 on the slowest pace of its sheet), on its feet or upright as the keeper says (its `upright`), and
// leaps when the keeper asks. Its row: `stood`, `pos`, `yaw`, `vel`, `home`, `angle`, `speed`, `asked`,
// `leaps`, `leapHeight`, `upright`, `at` (its station), `lift` and `look` (the camera's,
// chasecamera3d's). Its definition: `sheet`, the loader entry of its sheet; `paces`, the block of the
// sheet whose `gait.paces` it goes at, on its feet and upright; `show { radius, accel, dist, lift }`,
// the circle's radius, how fast it gathers speed (m/s²), and how far off and how high the camera is held.
//
// `pacer`, the rule of a body shown at a station whose pace is its own list: the same circle, at the
// speed `speeds` gives the keeper's `gait`, and its `stride` going round once every `stride` metres it
// goes. Its row: as `strider`'s, and `stride`. Its definition: `speeds`, `stride`, `show`.
//
// `keeper`, the rule of the seat's `player` row, which is no body: `station`, the station the camera is
// on; `gait`; `orbit` and `swing`, the camera turned round what it looks at; `aloft`; `leaps` and
// `leapHeight`; `upright`, 0 on its feet, 1 upright. Its definition: `stations` and `view { yaw, pitch,
// orbit }`. Its acts: `station(by)`, `gait(i)`, `shift(by)`, `orbit(x)`, `aloft()`, `leap()`,
// `upright()`.
//
// The land is the ground the scene's walkers stand on (`groundOf`).
import type { Kind } from '#engine/engine.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf } from '#plugins/walker/walker.sim.ts'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const stick = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -1 && v <= 1

// Round its circle at `speed`, the camera held on it.
function circle(me: { data: Record<string, any>; kind: string }, dt: number, w: Parameters<NonNullable<Kind['tick']>>[2], want: number) {
  const d = def(w, me.kind), s = d.show, keeper = w.all('player')[0]
  me.data.speed += clamp(want - me.data.speed, -s.accel * dt, s.accel * dt)
  me.data.angle = wrap(me.data.angle + (me.data.speed / s.radius) * dt)
  const x = me.data.home[0] + math.sin(me.data.angle) * s.radius, z = me.data.home[1] + math.cos(me.data.angle) * s.radius
  me.data.yaw = wrap(me.data.angle + Math.PI / 2)
  me.data.pos = [x, groundOf(w).height(x, z), z]
  me.data.vel = [math.sin(me.data.yaw) * me.data.speed, 0, math.cos(me.data.yaw) * me.data.speed]
  const view = def(w, 'player').view
  me.data.lift = s.lift
  me.data.look = { yaw: me.data.yaw + view.yaw + keeper.data.swing, pitch: view.pitch, dist: s.dist }
}

const stand: Kind['before'] = me => {
  if (me.data.stood) return
  me.data.home = [me.data.pos[0], me.data.pos[2]]
  me.data.stood = true
}

export const strider: Kind = {
  before: stand,
  tick(me, dt, w) {
    const d = def(w, me.kind), keeper = w.all('player')[0], gait = keeper.data.gait
    me.data.upright = keeper.data.upright
    const paces = json(w, d.sheet)[d.paces[me.data.upright]].gait.paces
    const want = gait === 0 ? 0 : paces[Math.min(gait, paces.length) - 1].speed
    if (keeper.data.leaps !== me.data.asked) {
      me.data.asked = keeper.data.leaps
      me.data.leaps += 1
      me.data.leapHeight = keeper.data.leapHeight
    }
    circle(me, dt, w, want)
  },
}

export const pacer: Kind = {
  before: stand,
  tick(me, dt, w) {
    const d = def(w, me.kind), keeper = w.all('player')[0]
    circle(me, dt, w, d.speeds[Math.min(keeper.data.gait, d.speeds.length - 1)])
    me.data.stride = me.data.stride + me.data.speed * dt / d.stride
    me.data.stride -= Math.floor(me.data.stride)
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
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 5) return
      me.data.gait = i
    },
    shift(me, _w, _seat, by: unknown) {
      if (by !== 1 && by !== -1) return
      me.data.gait = Math.min(5, Math.max(0, me.data.gait + by))
    },
    orbit(me, _w, _seat, x: unknown) {
      if (stick(x)) me.data.orbit = x
    },
    aloft(me) {
      me.data.aloft = !me.data.aloft
    },
    leap(me) {
      me.data.leaps += 1
    },
    upright(me) {
      me.data.upright = 1 - me.data.upright
    },
  },
}
