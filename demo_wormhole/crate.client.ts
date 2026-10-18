// A crate, drawn: a box of its definition's `size` and `colour`, dressed and lit, standing where its
// row's `pos` and `rot` put it every frame.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>

export function setup(row: Row, plugins: Plugins) {
  const { size, colour } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  mesh = new three.Mesh(new three.BoxGeometry(size, size, size), plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, roughness: 0.7 })))
  plugins.render3d.scene.add(mesh)
  tick(row)
}

export function tick(row: Row) {
  mesh.position.fromArray(row.data.pos)
  mesh.quaternion.fromArray(row.data.rot)
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
