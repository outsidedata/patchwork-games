// A floor button, drawn: a disc of its definition's `radius` and `height` lying on `pos`, in `colour`,
// or glowing `lit` while the row is `on`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
let dark: string, lit: string

export function setup(row: Row, plugins: Plugins) {
  const d = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  dark = d.colour
  lit = d.lit
  mesh = new three.Mesh(new three.CylinderGeometry(d.radius, d.radius, d.height, 32), plugins.render3d.dress(new three.MeshStandardMaterial({ color: dark })))
  mesh.position.set(row.data.pos[0], row.data.pos[1] + d.height / 2, row.data.pos[2])
  plugins.render3d.scene.add(mesh)
  tick(row)
}

export function tick(row: Row) {
  mesh.material.color.set(row.data.on ? lit : dark)
  mesh.material.emissive.set(row.data.on ? lit : '#000000')
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
