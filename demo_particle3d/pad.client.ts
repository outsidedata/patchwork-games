// A pad's look (`pad.sim.ts`): a disc `radius` metres round lying `disc.lift` metres over the floor,
// cut in `disc.segments`, of its entry's `colour` and `disc.roughness`, under a rim `disc.rim` metres
// wide of the same colour. While nobody stands on the pad the disc and the rim glow their colour at
// `disc.glow.off`, [disc, rim]; while somebody does, at `disc.glow.on`. Every number is the pad's
// definition in `assets/demo_particle3d.json`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let pad: THREE.Group | undefined
let paints: THREE.MeshStandardMaterial[] = []

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const it = k.plays[row.data.plays]
  const c = k.disc
  const paint = (glow: number) => plugins.render3d.dress(new T.MeshStandardMaterial({ color: it.colour, emissive: it.colour, emissiveIntensity: glow, roughness: c.roughness }))
  paints = [paint(c.glow.off[0]), paint(c.glow.off[1])]
  const disc = new T.Mesh(new T.CircleGeometry(k.radius - c.rim, c.segments).rotateX(-Math.PI / 2), paints[0])
  const rim = new T.Mesh(new T.RingGeometry(k.radius - c.rim, k.radius, c.segments).rotateX(-Math.PI / 2), paints[1])
  disc.receiveShadow = rim.receiveShadow = true
  pad = new T.Group()
  pad.add(disc, rim)
  pad.position.set(row.data.pos[0], row.data.pos[1] + c.lift, row.data.pos[2])
  plugins.render3d.scene.add(pad)
}

export function tick(row: Row, plugins: Plugins) {
  const glow = def(plugins.wire, row.kind).disc.glow[row.data.on ? 'on' : 'off']
  paints[0].emissiveIntensity = glow[0]
  paints[1].emissiveIntensity = glow[1]
}

export function remove(plugins: Plugins) {
  if (!pad) return
  plugins.render3d.scene.remove(pad)
  pad.traverse(o => {
    const m = o as THREE.Mesh
    if (m.isMesh) m.geometry.dispose()
  })
  for (const p of paints) p.dispose()
  pad = undefined
  paints = []
}
