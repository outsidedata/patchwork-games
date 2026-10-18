// A field, drawn: the box of its definition's `size` round `pos`, see-through in `colour` at `opacity`,
// unlit, seen from both sides.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>

export function setup(row: Row, plugins: Plugins) {
  const { size, colour, opacity } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  mesh = new three.Mesh(new three.BoxGeometry(size[0], size[1], size[2]), new three.MeshBasicMaterial({ color: colour, transparent: true, opacity, side: three.DoubleSide, depthWrite: false }))
  mesh.position.fromArray(row.data.pos)
  plugins.render3d.scene.add(mesh)
}

export function tick() {}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
