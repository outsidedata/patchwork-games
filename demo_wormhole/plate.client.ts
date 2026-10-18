// A faith plate, drawn: a disc of its definition's `radius` and `height` lying on `pos`, in `colour`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>

export function setup(row: Row, plugins: Plugins) {
  const { radius, height, colour } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  mesh = new three.Mesh(new three.CylinderGeometry(radius, radius, height, 32), plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.3 })))
  mesh.position.set(row.data.pos[0], row.data.pos[1] + height / 2, row.data.pos[2])
  plugins.render3d.scene.add(mesh)
}

export function tick() {}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
