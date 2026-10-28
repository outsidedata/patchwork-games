// The seat's eye, for the row that is `mine`: render3d's camera at the row's `pos`, looking along its
// `view` [yaw, pitch], set whole as a quaternion every frame. A click on the game takes the pointer
// lock, and the mouse then looks, its definition's `sens` radians a pixel; Escape gives it back. Without
// the lock, the mouse dragged with its left button held looks the same way. W and S
// fly the way it looks, A and D across, E and Q straight up and down, Shift held flies fast, and the
// wheel paces.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Binds, Input } from '#plugins/player/player.plugin.ts'

let ours = false
let turn: THREE.Euler

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
}

export function tick(row: Row, plugins: Plugins) {
  if (!ours) return
  const camera: THREE.PerspectiveCamera | undefined = plugins.render3d.camera
  if (!camera) return
  camera.position.fromArray(row.data.pos)
  // Three's camera looks down −z; yaw θ + π turns it to (sin θ, cos θ).
  camera.quaternion.setFromEuler(turn.set(row.data.view[1], row.data.view[0] + Math.PI, 0))
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
