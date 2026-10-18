// The floor: a square of its definition's `size` metres in `colour`, lined every `cell` metres in
// `line` and every `major` cells in `bold`, lying on y 0 round the world's middle.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let made: THREE.Object3D[] = []

export function setup(row: Row, plugins: Plugins) {
  const { size, cell, major, colour, line, bold } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  const plane = new three.Mesh(new three.PlaneGeometry(size, size), new three.MeshBasicMaterial({ color: colour }))
  plane.quaternion.setFromAxisAngle(new three.Vector3(1, 0, 0), -Math.PI / 2)
  const fine = new three.GridHelper(size, size / cell, line, line)
  fine.position.y = 0.001
  const coarse = new three.GridHelper(size, size / cell / major, bold, bold)
  coarse.position.y = 0.002
  made = [plane, fine, coarse]
  plugins.render3d.scene.add(...made)
}

export function tick() {}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(...made)
  for (const o of made as (THREE.Mesh | THREE.LineSegments)[]) {
    o.geometry.dispose()
    ;(o.material as THREE.Material).dispose()
  }
}
