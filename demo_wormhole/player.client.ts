// The seat's eyes. For the row that is `mine`: render3d's camera stands its definition's `eye` metres
// over the row's `pos`, looking along its `view` [yaw, pitch] (yaw θ faces (sin θ, cos θ), as walker
// has it), set whole as a quaternion every frame; on the frame `jumps` changes, the body went through
// a portal, so the camera's `userData.teleport` is up for that frame and render3d draws it at the
// other portal, never between (`guide-to-smooth-gameplay`). A dot of the definition's `reticle`
// `radius` and `colour` stands in the middle of the ui's `reticle` panel. WASD and the arrows are a
// stick sent as `move`, y growing back; Space is `jump`; E is `throw`; F is `take`; a click takes the pointer lock, the mouse's
// pixels are sent as `look`, and under the lock the left button puts the first portal where the
// reticle points and the right button the second (`place` 0 and 1).
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
    press: { ' ': ['jump'], e: ['throw'], f: ['take'], Mouse0: ['place', 0], Mouse2: ['place', 1] },
    locked: ['Mouse0', 'Mouse2'],
  } satisfies Binds)
}

export function tick(row: Row, plugins: Plugins) {
  if (!ours) return
  const { eye, reticle } = def(plugins.wire, row.kind)
  const ui = plugins.ui
  const box = ui.panel('reticle').boundsArea
  ui.show('reticle', 'dot', () => new ui.PIXI.Graphics().circle(box.width / 2, box.height / 2, reticle.radius).fill(reticle.colour))
  const camera: THREE.PerspectiveCamera | undefined = plugins.render3d.camera
  if (!camera) return
  camera.userData.teleport = row.data.jumps !== jumps
  jumps = row.data.jumps
  camera.position.set(row.data.pos[0], row.data.pos[1] + eye, row.data.pos[2])
  // Three's camera looks down −z; yaw θ + π turns it to (sin θ, cos θ).
  camera.quaternion.setFromEuler(turn.set(row.data.view[1], row.data.view[0] + Math.PI, 0))
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
