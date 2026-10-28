// The glass cube: a box of its definition's `size` metres about its middle `at`, in its `colour` at its
// `opacity`, both sides drawn, taking the people's shadows and casting none, writing no depth so every
// person inside it and through it is drawn; and its twelve edges as lines in its `edges` colour. Dressed by
// render3d; it never moves, so render3d never eases it between the steps (`userData.teleport`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let glass: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | undefined
let lines: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial> | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const { size, at, colour, opacity, edges, roughness } = def(plugins.wire, row.kind)
  const box = new T.BoxGeometry(size, size, size)
  glass = new T.Mesh(box, plugins.render3d.dress(new T.MeshStandardMaterial({ color: colour, roughness, transparent: true, opacity, side: T.DoubleSide, depthWrite: false })))
  glass.receiveShadow = true
  glass.name = 'cube'
  lines = new T.LineSegments(new T.EdgesGeometry(box), new T.LineBasicMaterial({ color: edges }))
  lines.name = 'cube edges'
  for (const o of [glass, lines]) {
    o.position.fromArray(at)
    o.userData.teleport = true
    plugins.render3d.scene.add(o)
  }
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (glass) {
    plugins.render3d.scene.remove(glass)
    glass.geometry.dispose()
    glass.material.dispose()
    glass = undefined
  }
  if (lines) {
    plugins.render3d.scene.remove(lines)
    lines.geometry.dispose()
    lines.material.dispose()
    lines = undefined
  }
}
