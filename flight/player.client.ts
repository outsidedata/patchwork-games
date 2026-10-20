// The seat's pilot (`player.sim.ts`), which holds the plane it flies; the plane is drawn by flight3d and
// `plane.client.ts`, for every seat. This look is the seat's own keys and camera, and nothing for any
// other seat's pilot.
//
// One seat's keys and camera, bound to the scene's actions (`world.player.actions`), each on the
// keyboard and a gamepad. Held keys fly: w and s (or the up and down arrows, or the left stick) the
// stick forward and back, nose down and up; a and d (or left and right, or the left stick) roll left
// and right; q and e (or the bumpers, or the right stick) the rudder, nose left and right (and the
// steered wheel on the ground); Shift and Control (or the right and left triggers) push the throttle
// up and down while held; space (or X) the airbrake; b (or A) the wheel brakes; g (or Y) the gear
// lever; r (or View) starts the plane again at its start. The sticks, triggers and brakes are read
// analog, so a stick half over is half the stick. Each is sent when it changes, to the pilot, which
// relays it to the plane it holds.
//
// The camera is the rear view of the plane this seat holds (`holding`): this page's alone, nothing of it
// on a row. It sits behind the plane in the plane's own frame, so it climbs, dives, rolls and loops with
// it, with no lock to the horizon. The pivot is the plane's `pos` on three critically damped springs run
// on the steps' clock, followed across the ground at the `player` definition's `camera.followHz` and up
// and down at `camera.riseHz`. The camera's turn follows the plane's `rot`, slerped toward it at
// `camera.turnHz`. The eye is `camera.back` metres behind the pivot along that turn's +z (the tail)
// and `camera.high` above it along its +y, looking at `camera.aim` above the pivot along its +y, with
// the turn's +y as up: a plane rolled on its back puts the ground at the top of the view. A spring is
// critically damped (the smooth-damp of Game Programming Gems 4, 1.10), so it comes to rest without
// passing its target. The springs and the turn move only on a frame that took a step, by the
// steps' seconds since the last they moved (at most a tenth of a second, after a hidden tab), so the
// camera is placed once a step, as the plane is, and render3d draws both between the last two steps:
// a camera placed on the page's clock on a frame of no step would be drawn where it was set, a step
// ahead of the plane drawn behind it, and judder whenever the frames and steps fell unevenly. The
// camera jumps to the plane the frame it first follows it, as it does each time the plane starts again
// (the pilot's `launched` counted up by `again` or a pick, which may be a plane it did not hold before),
// and when the steps go back. While something else holds render3d's camera (`claimed()`: a cutscene,
// the editor's orbit) it is left alone, and the springs jump to the plane when it is given back. The
// plane's instruments are the HUD's (`plugins/hud`).
//
// `eye()` is `{ pos, dir, target }`: where the camera stands, the way it looks (its world −z), and
// the point the springs are following, the plane's `pos` raised `aim` along the plane's up, as the
// newest step stands.
//
// With the playtester in the scene the seat flies itself (`autopilot`): every frame the think reads the
// rows this seat sees and presses one of the keys' acts, as a hand would, with the pilot plugin's hands
// (`plugins/pilot`, the `pilot` definition). It picks the `autopilot` definition's `plane`, `mission` and
// `start` (the ramp); taxis from its stand along the taxiway to the southern link and onto the runway's
// line, and takes off north; in the air it flies through each ring of its course in turn, aiming `lead`
// metres short of a far ring along its face so it arrives lined up, at `cruise` times its stall speed,
// and `descend` times it coming down to a ring; after the last ring it flies the circuit's final down
// the runway's line onto its touchdown point and flares, and brakes to a stop on the runway. Each frame
// it presses whichever input is furthest from what it wants, if any is more than `dead` off. A crashed
// plane it starts again.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Controls } from '#plugins/player/player.plugin.ts'
import type { Think } from '#plugins/playtester/playtester.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { type Flight, type Plane } from '#plugins/flight3d/flight3d.sim.ts'
import { holding, possessed } from '#plugins/player/player.plugin.ts'
import {
  attitudeOf, fieldOf, final, fly, headingTo, legsOf, lineRoute, outRoute, press, still, takeoff, taxi,
  type Circuit, type Field, type Hands,
} from './plugins/pilot/pilot.sim.ts'

type Camera = { back: number; high: number; aim: number; followHz: number; riseHz: number; turnHz: number }
type Spring = { x: number; v: number }

let followed = 0 // the `launched` count of the flight the camera last followed; 0 is none
let last = -1 // the step the camera was last placed on; -1 is none
let springs: Record<'x' | 'y' | 'z', Spring> | undefined
let turn: THREE.Quaternion | undefined // the camera's turn, following the plane's rot
let render3d: Plugins['render3d'] | undefined
let target = [0, 0, 0]

// One frame of a critically damped spring toward `to` at `hz`.
function spring(s: Spring, to: number, hz: number, dt: number) {
  const w = 2 * Math.PI * hz, k = w * dt
  const e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k)
  const off = s.x - to, t = (s.v + w * off) * dt
  s.v = (s.v - w * t) * e
  s.x = to + (off + t) * e
}

type Autopilot = { plane: string; mission: string; start: string; cruise: number; descend: number; dead: number }
type Menu = { planes: { type: string }[]; missions: { name: string }[]; starts: { name: string }[] }

/** The think that flies this seat round the ring course and lands it, from the rows it sees: the
 *  `autopilot` definition `a`, the `pilot` definition `k`, the `circuit` definition `c`, the airport's
 *  definition, the `menu` definition and the scene's `world.flight3d`. */
export function autopilot(a: Autopilot, k: Hands, c: Circuit, airport: Omit<Field, 'pos' | 'yaw'>, menu: Menu, flight: Flight): Think {
  return rows => {
    const me = possessed(rows)
    if (!me) return
    if (!me.data.picked || me.data.type !== a.plane || me.data.mission !== a.mission || me.data.from !== a.start) {
      return ['pick', menu.planes.findIndex(p => p.type === a.plane), menu.missions.findIndex(m => m.name === a.mission), menu.starts.findIndex(s => s.name === a.start)]
    }
    const it = holding(rows)
    const course = me.data.course
    if (!it || !course || course.done) return
    const plane = it.data as Plane
    if (plane.crashed) return ['again']
    const fl = fieldOf(rows.find(r => r.kind === 'airport')!.data as Field, airport)
    const stand = rows.find(r => r.kind === 'stand' && r.data.name === it.data.stand)!.data
    const rings = rows.filter(r => r.kind === 'ring').map(r => r.data).sort((x, y) => x.order - y.order)
    const s = attitudeOf(plane, flight)
    const want = still(plane)

    if (s.ground && course.next === 0) {
      // Out from the stand along the taxiway to the southern link, onto the runway's line, and away.
      const out = outRoute(fl, stand.pos, c)
      const line = lineRoute(fl, c)
      const route = [...out.slice(0, -1), ...line.slice(1)]
      const { at } = taxi(want, plane, s, k, flight, route)
      if (at === route.length - 2) takeoff(want, plane, s, k, fl)
    } else if (course.next < rings.length) {
      // The next ring, pursued at its middle, the pursuit's L1 the distance to it, so the plane flies
      // the circle tangent to its heading through the middle: the course is laid on such circles. The
      // flight path is straight at the middle. A ring behind the plane is turned back to, `lead` short
      // of it.
      const r = rings[course.next]
      const face = [Math.sin(r.yaw), -Math.cos(r.yaw)]
      const d = [plane.pos[0] - r.pos[0], plane.pos[2] - r.pos[2]]
      const before = -(d[0] * face[0] + d[1] * face[1])
      const back = [r.pos[0] - face[0] * k.lead, 0, r.pos[2] - face[1] * k.lead]
      const to = before > 0 ? headingTo(plane.pos, r.pos) : headingTo(plane.pos, back)
      const l1 = before > 0 ? Math.hypot(d[0], d[1]) : Math.hypot(back[0] - plane.pos[0], back[2] - plane.pos[2])
      const path = Math.max(Math.atan2(r.pos[1] - plane.pos[1], Math.max(before, k.lead / 2)), -k.dive)
      if (s.ground) takeoff(want, plane, s, k, fl)
      // Coming down to the next ring the plane slows toward its approach speed.
      else fly(want, plane, s, k, flight, to, path, (path < -0.03 ? a.descend : a.cruise) * s.vs, l1)
    } else if (!s.ground) {
      // Every ring flown: the circuit's final down the runway's line, flared at the bottom.
      const { legs, R, touch } = legsOf(fl, flight, plane.type, c)
      final(want, plane, s, k, flight, fl, legs[4], R, touch)
    } else {
      // Down: brakes on, the lever shut, kept on the line.
      takeoff(want, plane, s, k, fl)
      want.lever = 0
      want.brake = 1
      want.pitch = 0
      want.roll = 0
    }
    return press(plane, want, a.dead)
  }
}

function setupOurs(_row: Row, plugins: Plugins) {
  followed = 0
  last = -1
  springs = undefined
  turn = undefined
  render3d = plugins.render3d
  plugins.player.control({
    axis: { pitch: v => ['pitch', v], roll: v => ['roll', v], yaw: v => ['yaw', v], throttle: v => ['throttle', v] },
    hold: { airbrake: v => ['airbrake', v], brake: v => ['brake', v] },
    press: { again: ['again'], gear: ['gear'] },
    analog: ['pitch', 'roll', 'yaw', 'throttle', 'airbrake', 'brake'],
  } satisfies Controls)
  if (plugins.playtester) {
    const { wire } = plugins
    plugins.playtester.play(plugins.player, autopilot(def(wire, 'autopilot'), def(wire, 'pilot'), def(wire, 'circuit'), def(wire, 'airport'), def(wire, 'menu'), wire.scene.world!.flight3d as Flight))
  }
}

function tickOurs(row: Row, plugins: Plugins) {
  const n = plugins.wire.n
  const plane = holding(plugins.wire.rows as Row[])
  if (!row.data.launched || !plane || plugins.render3d.claimed() !== undefined) { last = -1; return }
  // A frame that took no step leaves the camera where the last step placed it, for render3d to draw
  // between the steps with the plane.
  if (springs && last >= 0 && n === last && row.data.launched === followed) return
  const c = def(plugins.wire, row.kind).camera as Camera
  const T = plugins.render3d.THREE as typeof THREE
  const [px, py, pz] = plane.data.pos as number[]
  const rot = new T.Quaternion().fromArray(plane.data.rot as number[])
  if (!springs || !turn || last < 0 || n < last || row.data.launched !== followed) {
    followed = row.data.launched
    springs = { x: { x: px, v: 0 }, y: { x: py, v: 0 }, z: { x: pz, v: 0 } }
    turn = rot.clone()
  } else {
    const dt = Math.min(0.1, (n - last) * plugins.wire.scene.prefabs.engine.dt)
    spring(springs.x, px, c.followHz, dt)
    spring(springs.z, pz, c.followHz, dt)
    spring(springs.y, py, c.riseHz, dt)
    turn.slerp(rot, 1 - Math.exp(-2 * Math.PI * c.turnHz * dt))
  }
  last = n
  // In the plane's frame as the camera follows it: `back` behind along +z, `high` above along +y,
  // looking at `aim` above the pivot, its up the plane's up.
  const pivot = new T.Vector3(springs.x.x, springs.y.x, springs.z.x)
  const look = new T.Vector3(0, c.aim, 0).applyQuaternion(turn).add(pivot)
  const camera = plugins.render3d.camera as THREE.PerspectiveCamera
  camera.position.copy(new T.Vector3(0, c.high, c.back).applyQuaternion(turn).add(pivot))
  camera.up.set(0, 1, 0).applyQuaternion(turn)
  camera.lookAt(look)
  target = new T.Vector3(0, c.aim, 0).applyQuaternion(rot).add(new T.Vector3(px, py, pz)).toArray()
}

function removeOurs(plugins: Plugins) {
  plugins.player.unbind()
}

// The camera, for the seat's own row; another seat's row holds none.
export function eye(): { pos: number[]; dir: number[]; target: number[] } | undefined {
  if (!ours) return undefined
  const camera = render3d?.camera as THREE.PerspectiveCamera | undefined
  if (!camera) throw new Error('the flight camera has not been placed')
  const { Vector3 } = render3d!.THREE as typeof THREE
  return { pos: camera.getWorldPosition(new Vector3()).toArray(), dir: camera.getWorldDirection(new Vector3()).toArray(), target }
}

// Every seat is sent every `player` row (`addons/player`), and this look is loaded for each: it binds
// keys and moves the camera only for the row that is this seat's, the one that is `mine`.
let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (ours) setupOurs(row, plugins)
}

export function tick(row: Row, plugins: Plugins) {
  if (ours) return tickOurs(row, plugins)
}

export function remove(plugins: Plugins) {
  if (ours) removeOurs(plugins)
}
