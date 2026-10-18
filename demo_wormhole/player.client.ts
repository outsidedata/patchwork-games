// The seat's eyes. For the row that is `mine`: render3d's camera stands its definition's `eye` metres
// over the row's `pos`, turned `yaw` about up and `pitch` up, set whole as a quaternion every frame;
// on the frame `jumps` changes, the walker went through a door, so the camera's `userData.teleport` is
// up for that frame and render3d draws it at the other door, never between
// (`guide-to-smooth-gameplay`). WASD and the arrows are a stick sent as `move`, y growing back; a
// click takes the pointer lock, and the mouse's pixels are sent as `look`. K puts the first door down
// ahead, L the second (`place` 0 and 1).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Binds } from '#plugins/player/player.plugin.ts'

let ours = false
let jumps = 0
let turn: THREE.Euler

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  jumps = row.data.jumps
  turn = new (plugins.render3d.THREE as typeof THREE).Euler(0, 0, 0, 'YXZ')
  const move = (x: number, y: number) => ['move', x, y] as ['move', number, number]
  plugins.player.bind({
    stick: [
      { keys: ['a', 'd', 'w', 's'], send: move },
      { keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], send: move },
    ],
    pointer: (dx, dy) => ['look', dx, dy],
    press: { k: ['place', 0], l: ['place', 1] },
  } satisfies Binds)
}

export function tick(row: Row, plugins: Plugins) {
  if (!ours) return
  const camera: THREE.PerspectiveCamera | undefined = plugins.render3d.camera
  if (!camera) return
  camera.userData.teleport = row.data.jumps !== jumps
  jumps = row.data.jumps
  const { eye } = def(plugins.wire, row.kind)
  camera.position.set(row.data.pos[0], row.data.pos[1] + eye, row.data.pos[2])
  camera.quaternion.setFromEuler(turn.set(row.data.pitch, row.data.yaw, 0))
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
