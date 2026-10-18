// A floor button, drawn: a disc of its definition's `radius` and `height`, `detail` segments round,
// lying on `pos`, in the chamber's surface its `surface` names, shining its `lit` `{ glow, power }`
// while the row is `on`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { glowing, surfaced, type Glow } from './plugins/chamber/chamber.plugin.ts'

let mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
let lit: Glow

export function setup(row: Row, plugins: Plugins) {
  const d = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  lit = d.lit
  mesh = new three.Mesh(new three.CylinderGeometry(d.radius, d.radius, d.height, d.detail), surfaced(plugins, d.surface))
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(row.data.pos[0], row.data.pos[1] + d.height / 2, row.data.pos[2])
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
