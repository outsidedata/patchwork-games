// A dropper, drawn: an open tube of its definition's `radius` and `height` in `colour`, its foot at the
// row's `pos`, where its crates appear.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>

export function setup(row: Row, plugins: Plugins) {
  const { radius, height, colour } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  mesh = new three.Mesh(new three.CylinderGeometry(radius, radius, height, 24, 1, true), plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, side: three.DoubleSide })))
  mesh.position.set(row.data.pos[0], row.data.pos[1] + height / 2, row.data.pos[2])
  plugins.render3d.scene.add(mesh)
}

export function tick() {}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
