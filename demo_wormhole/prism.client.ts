// A prism, drawn: a box of its definition's `size` in the chamber's surface its `surface` names, with a
// plate `plate.share` of its face across in the surface `plate.surface` on its front (+z), the face a
// beam leaves it by, `plate.lift` metres off it so it never lies on it, standing where its row's `pos` and `rot` put it every frame. Both
// cast and take shadows. On the frame its `jumps` changes it went through a portal, so its
// `userData.teleport` is up for that frame (`guide-to-smooth-gameplay`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { surfaced } from './plugins/chamber/chamber.plugin.ts'

let body: THREE.Group
let meshes: THREE.Mesh[] = []
let jumps = 0

export function setup(row: Row, plugins: Plugins) {
  const { size, surface, plate: front } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  const box = new three.Mesh(new three.BoxGeometry(size, size, size), surfaced(plugins, surface))
  const plate = new three.Mesh(new three.PlaneGeometry(size * front.share, size * front.share), surfaced(plugins, front.surface))
  plate.position.set(0, 0, size / 2 + front.lift)
  for (const m of [box, plate]) {
    m.castShadow = true
    m.receiveShadow = true
  }
  body = new three.Group()
  body.add(box, plate)
  meshes = [box, plate]
  plugins.render3d.scene.add(body)
  jumps = row.data.jumps
  tick(row)
}

export function tick(row: Row) {
  body.userData.teleport = row.data.jumps !== jumps
  jumps = row.data.jumps
  body.position.fromArray(row.data.pos)
  body.quaternion.fromArray(row.data.rot)
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(body)
  for (const m of meshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
}
