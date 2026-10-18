// A catcher, drawn: a sphere of its definition's `radius`, `detail` [around, down] segments, at `pos`,
// in the chamber's surface its `surface` names, shining its `lit` `{ glow, power }` while the row is
// `on`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { glowing, surfaced, type Glow } from './plugins/chamber/chamber.plugin.ts'

let mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
let lit: Glow

export function setup(row: Row, plugins: Plugins) {
  const d = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  lit = d.lit
  mesh = new three.Mesh(new three.SphereGeometry(d.radius, d.detail[0], d.detail[1]), surfaced(plugins, d.surface))
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.fromArray(row.data.pos)
  plugins.render3d.scene.add(mesh)
  tick(row)
}

export function tick(row: Row) {
  glowing(mesh.material, row.data.on ? lit : null)
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
