// A pad's look (`pad.sim.ts`): a square tile `size` metres a side lying `tile.lift` metres over the
// floor, exactly over `size` by `size` squares of the checkerboard, of `tile.colour` and `tile.roughness`,
// seen through at `tile.opacity` so the floor shows under it, and never writing depth over the
// particles. While nobody stands on the pad it glows `tile.lit` at `tile.glow.off`; while somebody
// does, it lights up, glowing that colour at `tile.glow.on`. Every number is the pad's definition in
// `assets/demo_particle3d.json`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let pad: THREE.Mesh | undefined
let paint: THREE.MeshStandardMaterial | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const c = k.tile
  paint = plugins.render3d.dress(new T.MeshStandardMaterial({ color: c.colour, emissive: c.lit, emissiveIntensity: c.glow.off, roughness: c.roughness, transparent: true, opacity: c.opacity, depthWrite: false }))
  pad = new T.Mesh(new T.PlaneGeometry(k.size, k.size).rotateX(-Math.PI / 2), paint)
  pad.receiveShadow = true
  pad.position.set(row.data.pos[0], row.data.pos[1] + c.lift, row.data.pos[2])
  plugins.render3d.scene.add(pad)
}

export function tick(row: Row, plugins: Plugins) {
  paint!.emissiveIntensity = def(plugins.wire, row.kind).tile.glow[row.data.on ? 'on' : 'off']
}

export function remove(plugins: Plugins) {
  if (!pad) return
  plugins.render3d.scene.remove(pad)
  pad.geometry.dispose()
  paint!.dispose()
  pad = undefined
  paint = undefined
}
