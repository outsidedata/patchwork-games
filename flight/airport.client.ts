// The airfield drawn (`airport.sim.ts`): the loader's model its definition in `assets/flight.json` names
// (`model`), at the row's `pos`, turned by its `yaw` about the vertical. Its materials are dressed by
// render3d, and every mesh casts and takes shadows. Nothing is drawn until the model has landed.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

// What each client draws, by its render3d: two pages in one process share this module.
const drawn = new WeakMap<object, THREE.Object3D>()

export function setup(row: Row, plugins: Plugins) {
  // The loader writes a failure to the console once itself.
  plugins.loader.load(def(plugins.wire, row.kind).model).catch(() => {})
}

export function tick(row: Row, plugins: Plugins) {
  const { render3d, loader } = plugins
  const k = def(plugins.wire, row.kind)
  let root = drawn.get(render3d)
  if (!root) {
    if (!loader.ready(k.model)) return
    root = loader.model(k.model).scene as THREE.Object3D
    root.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) render3d.dress(m)
    })
    render3d.scene.add(root)
    drawn.set(render3d, root)
  }
  root.position.fromArray(row.data.pos)
  root.rotation.set(0, row.data.yaw, 0)
}

export function remove(plugins: Plugins) {
  const root = drawn.get(plugins.render3d)
  if (!root) return
  plugins.render3d.scene.remove(root)
  drawn.delete(plugins.render3d)
}
