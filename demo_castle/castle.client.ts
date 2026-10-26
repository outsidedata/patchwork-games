// The fortress drawn: the model the castle's definition names (`model`), castle-plus's glb, each stone,
// tread and timber in the colour castle-plus gave it, casting and taking shadows; and under it the land, a
// square `land.size` metres across in `land.colour` and `land.roughness`, at y = 0, where the walkers
// stand where no shape is.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let fortress: THREE.Object3D | undefined
let land: THREE.Mesh | undefined
let gone = false

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  // An actor is set up before the loader's first tick, so the model is put in once it has landed.
  plugins.loader.on(k.model, () => {
    if (gone) return
    fortress = plugins.loader.model(k.model).scene as THREE.Object3D
    fortress.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = m.receiveShadow = true
      m.material = plugins.render3d.dress(m.material as THREE.Material)
    })
    plugins.render3d.scene.add(fortress)
  })
  const skin = plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.land.colour, roughness: k.land.roughness }))
  land = new T.Mesh(new T.PlaneGeometry(k.land.size, k.land.size).rotateX(-Math.PI / 2), skin)
  land.receiveShadow = true
  plugins.render3d.scene.add(land)
}

export function tick() {}

export function remove(plugins: Plugins) {
  gone = true
  if (fortress) plugins.render3d.scene.remove(fortress)
  if (land) {
    plugins.render3d.scene.remove(land)
    land.geometry.dispose()
    ;(land.material as THREE.Material).dispose()
  }
  fortress = land = undefined
}
