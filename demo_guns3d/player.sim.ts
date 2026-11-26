// The row one seat possesses, and the body it plays: an X Bot (`as: "xbot"`) that walks on walker (its numbers
// `world.walker.kinds.xbot`), is drawn and played by anim (`world.anim.kinds.xbot`, the Rifle 8-Way Locomotion
// Pack's clips), and holds one of its definition's `guns` (the G95 and the RPG-7), each a gun of guns3d's sheet
// (`assets/demo_guns3d.guns.json`), the one in its hands and its state its `gun`.
// Every seat is sent every `player` row. Its own fields, beside walker's, anim's and guns3d's: `stick` [x, z], the
// keys' way, right and forward; `fast`, the run key held; `aiming`, the aim key held; `lowered`, the gun lowered by
// the lower key; `look` `{ yaw, pitch, dist, side }`, chasecamera3d's orbit about it, `lift` metres over its feet;
// `turning` [x, y], how far a gamepad's right stick is pushed right and down; `aim`, the pitch anim lifts its upper
// body by, radians up; and `stood`, once it stands on its slot's start.
//
// How it holds the gun is its definition's `carries`, each a carry move of the gun's (`{ stand, aim, run, low }`):
// `run` while it runs and walks, `aim` while the aim key is held, `low` while it is lowered, else `stand`, set each
// step with guns3d's `carry`. Its definition's `acts` are the moves its keys play (`{ inspect, charge, check }`).
//
// `before` stands it once on the land at its slot's `start`, facing the start's `yaw`, its look along it. Each step
// its look turns while `turning` is held, at the definition's `camera.turn` across and `tilt` up and down a second at
// full push, within `minPitch` and `maxPitch`; it faces the way the camera looks, so it walks and strafes with the
// gun on the reticle (anim's gears pick the clip of the way it goes against the way it faces), at `walk` m/s or `run`
// with `fast` held; its upper body is aimed up and down with the look (`aim`, the look's pitch turned the other way,
// since a camera that tilts down looks down); and its gun runs a step (guns3d's `run`).
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right stick, the same),
// `fast(v)`, `fire(v)` and `aim(v)` (1 held, 0 let go), `jump`, `reload`, `select` (the gun's next mode), `lower`
// (lowered or raised), `inspect`, `charge` and `check` (each the move its definition's `acts` names), `swap` (the
// next gun of its definition's `guns`, fresh in the hand, refused while an act plays), `scope` (the gun's scope view
// on or off, guns3d's `scope`),
// `look(dyaw, dpitch)` and `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the program, so each
// refuses arguments of the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf, relative, walk } from '#plugins/walker/walker.sim.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import * as guns3d from '#plugins/guns3d/guns3d.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1
const held = (v: unknown) => v === 0 || v === 1

// The view turned while the right stick is held, its pitch kept within the camera's.
function view(me: Row, dt: number, k: any) {
  const d = me.data
  const c = k.camera
  const turned = d.turning[0] !== 0 || d.turning[1] !== 0
  const yaw = turned ? wrap(d.look.yaw - d.turning[0] * c.turn * dt) : d.look.yaw
  const pitch = clamp(d.look.pitch + (turned ? d.turning[1] * c.tilt * dt : 0), c.minPitch, c.maxPitch)
  if (yaw !== d.look.yaw || pitch !== d.look.pitch) d.look = { ...d.look, yaw, pitch }
}

// The body stood once on the land at its slot's start, facing the start's yaw, its look along it.
function stood(me: Row, w: W) {
  const d = me.data
  const start = w.find('start', s => s.data.slot === d.seat).data
  const [x, z] = start.pos
  d.pos = [x, heightAt(w, x, z), z]
  d.yaw = start.yaw
  d.look = { ...d.look, yaw: start.yaw }
  d.grounded = true
  d.stood = true
}

export const player: Kind = {
  before(me, _dt, w) {
    if (!me.data.stood) stood(me, w)
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    view(me, dt, k)
    const [wx, wz] = relative(d.stick, d.look.yaw)
    const speed = d.fast ? k.run : k.walk
    d.want = [wx * speed, wz * speed]
    d.face = d.look.yaw
    walk(me, w, dt, groundOf(w))
    animate(me, w, dt)
    const running = d.fast && (d.stick[0] !== 0 || d.stick[1] !== 0)
    guns3d.carry(me, w, running ? k.carries.run : d.aiming ? k.carries.aim : d.lowered ? k.carries.low : k.carries.stand)
    guns3d.run(me, w, dt)
    // after the gun's kick has moved the look this step, the body aims where the camera looks
    d.aim = 0 - d.look.pitch
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    turn(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.turning = [x, y]
    },
    fast(me, _w, _seat, v: unknown) {
      if (held(v)) me.data.fast = v === 1
    },
    fire(me, w, _seat, v: unknown) {
      if (!held(v)) return
      guns3d.arm(me, w)
      guns3d.pull(me, v === 1)
    },
    jump(me) {
      me.data.jump = true
    },
    reload(me, w) {
      guns3d.reload(me, w)
    },
    select(me, w) {
      guns3d.select(me, w)
    },
    aim(me, _w, _seat, v: unknown) {
      if (held(v)) me.data.aiming = v === 1
    },
    lower(me) {
      me.data.lowered = !me.data.lowered
    },
    inspect(me, w) {
      guns3d.play(me, w, def(w, me.kind).acts.inspect)
    },
    charge(me, w) {
      guns3d.play(me, w, def(w, me.kind).acts.charge)
    },
    check(me, w) {
      guns3d.play(me, w, def(w, me.kind).acts.check)
    },
    swap(me, w) {
      guns3d.arm(me, w)
      if (me.data.gun.act) return
      const guns: string[] = def(w, me.kind).guns
      me.data.gun = { name: guns[(guns.indexOf(me.data.gun.name) + 1) % guns.length] }
      guns3d.arm(me, w)
    },
    scope(me, w) {
      guns3d.scope(me, w)
    },
    look(me, w, _seat, dyaw: unknown, dpitch: unknown) {
      if (!finite(dyaw, dpitch)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw + (dyaw as number)), pitch: clamp(l.pitch + (dpitch as number), c.minPitch, c.maxPitch) }
    },
    zoom(me, w, _seat, by: unknown) {
      if (!finite(by)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, dist: clamp(l.dist * math.exp((by as number) * c.zoom), c.minDist, c.maxDist) }
    },
  },
}
