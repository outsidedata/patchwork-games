// The seat's eye, for the row that is `mine`: render3d's camera at the row's `pos`, looking along its
// `view` [yaw, pitch], set whole as a quaternion every frame. A click on the game takes the pointer
// lock, and the mouse then looks, its definition's `sens` radians a pixel; Escape gives it back. Without
// the lock, the mouse dragged with its left button held looks the same way. W and S
// fly the way it looks, A and D across, E and Q straight up and down, Shift held flies fast, and the
// wheel paces.
//
// ] and [ lock the eye behind the next and the last of the wanderers, by their place among the rows, and
// on past the last or the first back to flying. Locked, the eye is behind the person and over it on the
// up of the ground under it, by the definition's `follow`: `back` metres behind and `up` over, looking at
// the point `at` over its feet, and turned so its up is the person's; each eased toward where it should
// be at `ease` a second. The wheel still paces, and the pace takes the eye in and out: its `back` and
// `up` are halved for every power of two it paces up. Which person it follows is this page's alone.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { frame, standing } from '#plugins/crowd3d/crowd3d.sim.ts'
import type { Binds, Input } from '#plugins/player/player.plugin.ts'

let ours = false
let turn: THREE.Euler
// The wanderer followed, by its place among them; −1 flies.
let following = -1
let keys: ((e: KeyboardEvent) => void) | undefined
let last = 0
let eye: THREE.Vector3 | undefined
let up: THREE.Vector3 | undefined

const times = (m: number[][], v: number[]) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  turn = new (plugins.render3d.THREE as typeof THREE).Euler(0, 0, 0, 'YXZ')
  const { sens } = def(plugins.wire, row.kind)
  // Right turns the view right, down tilts it down.
  const look = (dx: number, dy: number): Input => ['look', -dx * sens, -dy * sens]
  plugins.player.bind({
    stick: [{ keys: ['a', 'd', 'w', 's'], send: (x, y) => ['stick', x, y] }],
    axis: [{ keys: ['q', 'e'], send: v => ['rise', v] }],
    hold: [{ keys: ['Shift'], send: v => ['fast', v] }],
    pointer: look,
    drag: { key: 'Mouse0', send: look },
    wheel: dy => ['pace', dy],
  } satisfies Binds)
  keys = e => {
    if (e.key !== '[' && e.key !== ']') return
    const count = plugins.wire.rows.filter(r => r.kind === 'wanderer').length
    // −1 and the wanderers in a ring.
    following = ((following + 1 + (e.key === ']' ? 1 : -1) + count + 1) % (count + 1)) - 1
    eye = undefined
  }
  addEventListener('keydown', keys)
}

export function tick(row: Row, plugins: Plugins) {
  if (!ours) return
  const camera: THREE.PerspectiveCamera | undefined = plugins.render3d.camera
  if (!camera) return
  const T = plugins.render3d.THREE as typeof THREE
  const now = performance.now() / 1000
  const dt = Math.min(now - last, 0.1)
  last = now
  const person = following >= 0 ? plugins.wire.rows.filter(r => r.kind === 'wanderer')[following] : undefined
  const clock = plugins.wire.rows.find(r => r.kind === 'npc3d')
  if (!person || !clock) {
    camera.up.set(0, 1, 0)
    camera.position.fromArray(row.data.pos)
    // Three's camera looks down −z; yaw θ + π turns it to (sin θ, cos θ).
    camera.quaternion.setFromEuler(turn.set(row.data.view[1], row.data.view[0] + Math.PI, 0))
    return
  }
  const { back, up: over, at, ease } = def(plugins.wire, row.kind).follow
  const near = Math.pow(2, -row.data.pace)
  const { at: feet, normal, yaw } = standing(person, clock.data.time)
  const ahead = times(frame(normal), [Math.sin(yaw), 0, Math.cos(yaw)])
  const n = new T.Vector3().fromArray(normal)
  const target = new T.Vector3().fromArray(feet).addScaledVector(n, over * near).addScaledVector(new T.Vector3().fromArray(ahead), -back * near)
  const k = eye ? 1 - Math.exp(-ease * dt) : 1
  eye = (eye ?? target.clone()).lerp(target, k)
  up = (up && k < 1 ? up : n.clone()).lerp(n, k).normalize()
  camera.position.copy(eye)
  camera.up.copy(up)
  camera.lookAt(new T.Vector3().fromArray(feet).addScaledVector(n, at))
}

export function remove(plugins: Plugins) {
  if (!ours) return
  plugins.player.unbind()
  if (keys) removeEventListener('keydown', keys)
  keys = undefined
  following = -1
  eye = undefined
  up = undefined
}
