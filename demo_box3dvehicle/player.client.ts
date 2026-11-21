// One seat's keys, gamepad and camera, bound to the scene's actions (`world.player.actions` in
// `yard.scene.json`, which names every key of each): the arrows or w a s d, up and down the throttle and
// the brake (down brakes), left and right, the d-pad or the left stick, the steering; space or the pad's
// bottom button the brake (`player.sim.ts`). The pedal and the steering are read analog
// (`plugins/player`, Analog), so a trigger or a stick pushed part of the way asks for that much.
//
// The camera is this page's alone: nothing of it is on a row. It follows the bike this seat holds
// (`holding`, `plugins/player`), read off the rows the page draws: the pivot is the bike's frame, followed
// across the ground at `followHz` and up and down at `riseHz`; the eye is `back` metres behind the pivot
// along the heading and `high` above it, and looks at `aim` above it (the `player` definition's `camera`).
// The heading is the frame's forward laid flat and followed at `turnHz` as a vector. The springs are
// critically damped (the smooth-damp of Game Programming Gems 4, 1.10), and move only on a frame that took
// a step, by the steps' seconds since they last moved (at most a tenth of a second, after a hidden tab), so
// the camera is placed once a step, as the bike is, and render3d draws both between the last two steps.
// While something else holds render3d's camera (`claimed()`, dev.html's views) it is left alone, and the
// springs jump to the bike when it is given back. The frame leans and the camera does not: it follows the
// heading and the position, never the roll.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { holding, type Controls } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

type Camera = { back: number; high: number; aim: number; followHz: number; riseHz: number; turnHz: number }
type Spring = { x: number; v: number }

let followed = 0
let last = -1 // the step the camera was last placed on; -1 is none
let springs: Record<'x' | 'y' | 'z' | 'fx' | 'fz', Spring> | undefined

// One frame of a critically damped spring toward `to` at `hz`.
function spring(s: Spring, to: number, hz: number, dt: number) {
  const w = 2 * Math.PI * hz, k = w * dt
  const e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k)
  const off = s.x - to, t = (s.v + w * off) * dt
  s.v = (s.v - w * t) * e
  s.x = to + (off + t) * e
}

function setupOurs(plugins: Plugins) {
  followed = 0
  last = -1
  springs = undefined
  plugins.player.control({
    axis: { pedal: v => ['pedal', v], steer: v => ['steer', v] },
    hold: { brake: v => ['brake', v] },
    analog: ['pedal', 'steer'],
  } satisfies Controls)
}

function tickOurs(row: Row, plugins: Plugins) {
  const n = plugins.wire.n
  const held = holding(plugins.wire.rows)
  const frame = held && plugins.wire.rows.find(r => r.id === held.data.chassis)
  if (!frame || plugins.render3d.claimed() !== undefined) { last = -1; return }
  // A frame that took no step leaves the camera where the last step placed it, for render3d to draw
  // between the steps with the bike.
  if (springs && last >= 0 && n === last && frame.id === followed) return
  const c = def(plugins.wire, row.kind).camera as Camera
  const [px, py, pz] = frame.data.pos as number[]
  const [x, y, z, s] = frame.data.rot as number[]
  const fx = 1 - 2 * (y * y + z * z)
  const fz = 2 * (x * z - s * y)
  if (!springs || last < 0 || n < last || frame.id !== followed) {
    followed = frame.id
    springs = { x: { x: px, v: 0 }, y: { x: py, v: 0 }, z: { x: pz, v: 0 }, fx: { x: fx, v: 0 }, fz: { x: fz, v: 0 } }
  } else {
    const dt = Math.min(0.1, (n - last) * plugins.wire.scene.prefabs.engine.dt)
    spring(springs.x, px, c.followHz, dt)
    spring(springs.z, pz, c.followHz, dt)
    spring(springs.y, py, c.riseHz, dt)
    spring(springs.fx, fx, c.turnHz, dt)
    spring(springs.fz, fz, c.turnHz, dt)
  }
  last = n
  const len = Math.hypot(springs.fx.x, springs.fz.x) || 1
  const hx = springs.fx.x / len, hz = springs.fz.x / len
  const camera = plugins.render3d.camera as THREE.PerspectiveCamera
  camera.position.set(springs.x.x - hx * c.back, springs.y.x + c.high, springs.z.x - hz * c.back)
  camera.up.set(0, 1, 0)
  camera.lookAt(springs.x.x, springs.y.x + c.aim, springs.z.x)
}

// Every seat is sent every `player` row (`addons/player`), and this look is loaded for each: it binds keys
// and moves the camera only for the row that is this seat's, the one that is `mine`.
let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (ours) setupOurs(plugins)
}

export function tick(row: Row, plugins: Plugins) {
  if (ours) tickOurs(row, plugins)
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
