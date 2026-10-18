// A lift, drawn: a platform of its definition's `size` in the chamber's surface its `surface` names,
// casting and taking shadows, standing where its row's `pos` puts it every frame.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { surfaced } from './plugins/chamber/chamber.plugin.ts'

let mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>

export function setup(row: Row, plugins: Plugins) {
  const { size, surface } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  mesh = new three.Mesh(new three.BoxGeometry(size[0], size[1], size[2]), surfaced(plugins, surface))
  mesh.castShadow = true
  mesh.receiveShadow = true
  plugins.render3d.scene.add(mesh)
  tick(row)
}

export function tick(row: Row) {
  mesh.position.fromArray(row.data.pos)
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
