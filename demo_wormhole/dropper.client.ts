// A dropper, drawn: an open tube of its definition's `radius` and `height`, `detail` segments round, in
// the chamber's surface its `surface` names, seen from both sides, casting and taking shadows, its foot
// at the row's `pos`, where its crates appear.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { surfaced } from './plugins/chamber/chamber.plugin.ts'

let mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>

export function setup(row: Row, plugins: Plugins) {
  const { radius, height, detail, surface } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  const material = surfaced(plugins, surface)
  material.side = three.DoubleSide
  mesh = new three.Mesh(new three.CylinderGeometry(radius, radius, height, detail, 1, true), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(row.data.pos[0], row.data.pos[1] + height / 2, row.data.pos[2])
  plugins.render3d.scene.add(mesh)
}

export function tick() {}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
