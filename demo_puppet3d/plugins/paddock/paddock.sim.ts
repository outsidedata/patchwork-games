// paddock's server half: the rules of the bodies shown at stations and of the seat that keeps them.
//
// Every body is shown the same way. Held by no keeper, it goes round a circle about where its `actors`
// entry put it on the land, at the speed of the pace the scene's keeper picks (its `gait`, 0 a stand), the
// camera held beside it. While a seat's `keeper` holds it (`holderOf`), it is steered instead: it goes on
// the way it faces at the pace that keeper picks, turned by its `steer` (-1 left to 1 right) at its
// `show.turn` radians a second, the camera held behind it (the player's `chase { yaw, pitch }`, at its own
// `show.dist`). Let go of, its circle goes on from where it is, the way it faces. Every body's row has
// `stood`, `pos`, `yaw`, `vel`, `home`, `angle`, `speed`, `steer`, `piloted`, `at` (its station), and
// `lift` and `look` (the camera's, chasecamera3d's). Every body's definition has `show { radius, accel,
// turn, dist, lift }`: the circle's radius, how fast it gathers speed (m/s²), how fast it turns when
// steered, and how far off and how high the camera is held. Every body's act, a keeper's alone to pass
// on: `steer(v)`.
//
// `strider`, the rule of an animal: its pace is the keeper's `gait` on its sheet (1 the slowest pace), it
// is on its feet or upright as the keeper says (its `upright`), and it leaps when the keeper asks. Its row
// has `asked`, `leaps`, `leapHeight` and `upright` besides. Its definition: `sheet`, the loader entry of
// its sheet; `paces`, the block of the sheet whose `gait.paces` it goes at, on its feet and upright.
//
// `pacer`, the rule of a body whose pace is its own list: the speed `speeds` gives the keeper's `gait`,
// and its `stride` going round once every `stride` metres it goes. Its row has `stride` besides. Its
// definition: `speeds`, `stride`.
//
// `flier`, the rule of a bird: the speed `speeds` gives the keeper's `gait`, and in the air over the land.
// Held by none, by how fast it goes: on the ground at a stand, `flight.height` metres up at `flight.full`
// metres a second and faster, rising and sinking no faster than `flight.climb` metres a second; slowed to a
// pace it flies lower at, it comes down to that height first and goes no slower than the height it is at
// needs, so it lands along a slope and stops as it touches the ground. Held, it
// rises and sinks by its `climb` (-1 to 1) at `flight.climb`, between `flight.floor` metres over the land
// and `flight.ceiling`, and both that and its turning are less the slower than `flight.full` it goes, so
// at a stand it comes down. Its rise gathers and is shed at `flight.lift` metres a second squared, and it
// slows in time to come to rest at each of those heights. Its `vel` carries its rise. Its row has `alt`,
// metres over the land, `rise`, metres a second, and `climb` besides. Its definition: `speeds`,
// `flight { height, full, climb, lift, floor, ceiling }`. Its act besides: `climb(v)`.
//
// `keeper`, the rule of the seat's `player` row, which is no body: `station`, the station the camera is
// on; `gait`; `orbit` and `swing`, the camera turned round what it looks at; `aloft`; `leaps` and
// `leapHeight`; `upright`, 0 on its feet, 1 upright; `held`, the body it steers (core's `take`). Its
// definition: `stations`, `view { yaw, pitch, orbit }`, `pilots`, the kinds it can steer, and `chase`. Its
// acts: `station(by)` (not while it holds a body), `gait(i)`, `shift(by)`, `orbit(x)`, `aloft()`,
// `leap()`, `upright()`, `pilot()`, which takes hold of the body at its station when its kind is one of
// `pilots`, or lets go of the one it holds, and that body's `steer` and `climb`, passed on (`relay`).
//
// The land is the ground the scene's walkers stand on (`groundOf`).
import type { Kind } from '#engine/engine.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf } from '#plugins/walker/walker.sim.ts'
import { holderOf, holding, letGo, relay, take } from '#plugins/player/player.sim.ts'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const stick = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -1 && v <= 1

type Body = Parameters<NonNullable<Kind['tick']>>[0]
type W = Parameters<NonNullable<Kind['tick']>>[2]

// The keeper whose pace, leaps and stance a body goes by: the one that holds it, else the scene's first.
const keeperOf = (me: Body, w: W) => holderOf(w, me) ?? w.all('player')[0]

// Round its circle at `speed`, the camera held on it.
function circle(me: Body, dt: number, w: W, want: number) {
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

// A body a step on over the land, toward `want` metres a second, and whether a keeper holds it. Held, it is
// steered: on the way it faces, turned by its `steer` (-1 left to 1 right) at `show.turn` radians a second,
// less the slower than `full` it goes where `full` is given, the camera held behind it (the player's
// `chase { yaw, pitch }`, at its own `show.dist`). Held by none, its `steer` is at rest and it goes round its
// circle, which goes on from where it was let go of, the way it faced.
function go(me: Body, dt: number, w: W, want: number, full = 0): boolean {
  const s = def(w, me.kind).show, pilot = holderOf(w, me)
  if (!pilot) {
    me.data.steer = 0
    if (me.data.piloted) {
      me.data.piloted = false
      me.data.angle = wrap(me.data.yaw - Math.PI / 2)
      me.data.home = [me.data.pos[0] - math.sin(me.data.angle) * s.radius, me.data.pos[2] - math.cos(me.data.angle) * s.radius]
    }
    circle(me, dt, w, want)
    return false
  }
  me.data.piloted = true
  me.data.speed += clamp(want - me.data.speed, -s.accel * dt, s.accel * dt)
  me.data.yaw = wrap(me.data.yaw - me.data.steer * s.turn * (full > 0 ? clamp(me.data.speed / full, 0, 1) : 1) * dt)
  const x = me.data.pos[0] + math.sin(me.data.yaw) * me.data.speed * dt, z = me.data.pos[2] + math.cos(me.data.yaw) * me.data.speed * dt
  me.data.pos = [x, groundOf(w).height(x, z), z]
  me.data.vel = [math.sin(me.data.yaw) * me.data.speed, 0, math.cos(me.data.yaw) * me.data.speed]
  const chase = def(w, 'player').chase
  me.data.lift = s.lift
  me.data.look = { yaw: me.data.yaw + chase.yaw + pilot.data.swing, pitch: chase.pitch, dist: s.dist }
  return true
}

const stand: Kind['before'] = me => {
  if (me.data.stood) return
  me.data.home = [me.data.pos[0], me.data.pos[2]]
  me.data.stood = true
}

// A held body's act a keeper passes on: its `steer`.
const steer: NonNullable<Kind['acts']>[string] = (me, _w, _seat, v: unknown) => {
  if (stick(v)) me.data.steer = v
}

export const strider: Kind = {
  before: stand,
  tick(me, dt, w) {
    const d = def(w, me.kind), keeper = keeperOf(me, w), gait = keeper.data.gait
    me.data.upright = keeper.data.upright
    const paces = json(w, d.sheet)[d.paces[me.data.upright]].gait.paces
    const want = gait === 0 ? 0 : paces[Math.min(gait, paces.length) - 1].speed
    if (keeper.data.leaps !== me.data.asked) {
      me.data.asked = keeper.data.leaps
      me.data.leaps += 1
      me.data.leapHeight = keeper.data.leapHeight
    }
    go(me, dt, w, want)
  },
  acts: { steer },
}

export const pacer: Kind = {
  before: stand,
  tick(me, dt, w) {
    const d = def(w, me.kind), keeper = keeperOf(me, w)
    go(me, dt, w, d.speeds[Math.min(keeper.data.gait, d.speeds.length - 1)])
    me.data.stride = me.data.stride + me.data.speed * dt / d.stride
    me.data.stride -= Math.floor(me.data.stride)
  },
  acts: { steer },
}

export const flier: Kind = {
  before: stand,
  tick(me, dt, w) {
    const d = def(w, me.kind), f = d.flight, keeper = keeperOf(me, w), was = me.data.alt
    const pace = d.speeds[Math.min(keeper.data.gait, d.speeds.length - 1)]
    // held by none it goes no slower than its height needs, so it comes down along a slope and is at a stand
    // as it touches the ground
    const flown = go(me, dt, w, holderOf(w, me) ? pace : Math.max(pace, f.full * Math.min(1, was / f.height)), f.full)
    const share = clamp(me.data.speed / f.full, 0, 1)
    // the fastest it may rise or sink `gap` metres short of a height and still come to rest there, shedding
    // `flight.lift` a second from the step after this one
    const shed = f.lift * dt
    const stop = (gap: number) => Math.min(Math.sqrt(shed * shed + 2 * f.lift * gap) - shed, gap / dt)
    // the height it is coming to rest at, when it is: reached to within what a step's sum loses, it is there
    let want: number, rest = 0
    if (flown) {
      // sinking the slower it goes, coming to rest under its ceiling and over its floor
      const floor = f.floor * share
      want = Math.min((me.data.climb * share - (1 - share)) * f.climb, stop(Math.max(f.ceiling - was, 0)))
      want = Math.max(want, was < floor ? Math.min(f.climb, stop(floor - was)) : -stop(was - floor))
    } else {
      me.data.climb = 0
      rest = f.height * Math.min(share, clamp(pace / f.full, 0, 1))
      const gap = rest - was
      want = Math.sign(gap) * Math.min(f.climb, stop(Math.abs(gap)))
    }
    me.data.rise += clamp(want - me.data.rise, -f.lift * dt, f.lift * dt)
    const alt = Math.max(0, was + me.data.rise * dt)
    me.data.alt = Math.abs(alt - rest) < 1e-9 ? rest : alt
    if (me.data.alt === 0 && me.data.rise < 0) me.data.rise = 0
    me.data.pos = [me.data.pos[0], me.data.pos[1] + me.data.alt, me.data.pos[2]]
    me.data.vel = [me.data.vel[0], (me.data.alt - was) / dt, me.data.vel[2]]
  },
  acts: {
    steer,
    climb(me, _w, _seat, v: unknown) {
      if (stick(v)) me.data.climb = v
    },
  },
}

export const keeper: Kind = {
  tick(me, dt, w) {
    me.data.swing += me.data.orbit * def(w, me.kind).view.orbit * dt
  },
  acts: {
    station(me, w, _seat, by: unknown) {
      if (by !== 1 && by !== -1 || holding(w, me)) return
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
    pilot(me, w) {
      if (holding(w, me)) return letGo(me)
      const kinds: string[] = def(w, me.kind).pilots
      const it = kinds.flatMap(kind => w.all(kind)).find(r => r.data.at === me.data.station)
      if (it) take(me, w, it)
    },
    ...relay({ horse: ['steer'], tiger: ['steer'], xbot: ['steer'], lion: ['steer'], cheetah: ['steer'], rider: ['steer'], hawk: ['steer', 'climb'] }),
  },
}
