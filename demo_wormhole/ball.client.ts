// A ball, drawn: a sphere of its definition's `radius` and `colour`, dressed and lit, standing where its
// row's `pos` and `rot` put it every frame. On the frame its `jumps` changes it went through a portal,
// so its `userData.teleport` is up for that frame and render3d draws it at the other portal, never
// between (`guide-to-smooth-gameplay`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
let jumps = 0

export function setup(row: Row, plugins: Plugins) {
  const { radius, colour } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  mesh = new three.Mesh(new three.SphereGeometry(radius, 16, 12), plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, roughness: 0.5 })))
  plugins.render3d.scene.add(mesh)
  jumps = row.data.jumps
  tick(row)
}

export function tick(row: Row) {
  mesh.userData.teleport = row.data.jumps !== jumps
  jumps = row.data.jumps
  mesh.position.fromArray(row.data.pos)
  mesh.quaternion.fromArray(row.data.rot)
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
