// A portal's look on a page of the gym, as dev.html enters it, with no canvas. The scene holds one
// light for each portal the definition's `rims` names from its first frames, dark, so placing a portal
// never changes how many lights there are; placing one turns its own light up to `light.power`,
// `light.ahead` metres in front of the opening, and leaves the other's dark; its rim shines its glow at
// its power, its opening shows the other place once both stand; and a portal taken out of the world
// darkens its light again. Every number is read off the definitions.
import { expect, test } from 'vitest'
import type * as THREE from 'three'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { possessed } from '#plugins/player/player.plugin.ts'
import { sim } from './demo_wormhole.sim.ts'
import file from './demo_wormhole.scene.json' with { type: 'json' }
import defs from './assets/demo_wormhole.json' with { type: 'json' }

const here = new URL('./', import.meta.url).href
const DT = file.prefabs.engine.dt
const { rims, light, post } = defs.portal
const [first, second] = defs.player.portals as (keyof typeof rims)[]
// The player plugin listens on the page, and node has none.
;(globalThis as any).addEventListener = () => {}
;(globalThis as any).removeEventListener = () => {}

test('one dark light per portal from the start; placing a portal lights its own in front of it, and taking it out darkens it', async () => {
  const scene = structuredClone(file) as unknown as Scene
  scene.prefabs.scenemanager.entry = 'gym'
  const truth = boot(scene, sim)
  const room = (await load(truth, here)).get('gym')!
  const page = view(link(loopback(accept(manager(truth)))), scene, here, () => {})
  const frames = async (k: number) => { for (let i = 0; i < k; i++) { truth.step(DT); await page.frame() } }
  await frames(6)
  const plugins = page.client!.plugins
  const lights = () => {
    const found: THREE.PointLight[] = []
    plugins.render3d.scene.traverse((o: THREE.Object3D) => { if ((o as THREE.PointLight).isPointLight) found.push(o as THREE.PointLight) })
    return found
  }
  const three = plugins.render3d.THREE as typeof THREE
  const lamp = (name: string) => plugins.portal.lamp(name) as THREE.PointLight
  expect(lights()).toHaveLength(Object.keys(rims).length)
  for (const name of Object.keys(rims)) {
    expect(lamp(name).intensity).toBe(0)
    expect(lamp(name).color.equals(new three.Color(rims[name as keyof typeof rims].glow))).toBe(true)
  }

  // The seat stands facing a wall and clicks, as its look binds Mouse0 and Mouse2.
  const me = () => room.rows.find(r => r.id === possessed(plugins.wire.rows)!.id)!
  const place = async (which: number, pos: number[], yaw: number) => {
    Object.assign(me().data, { pos, vel: [0, 0, 0], view: [yaw, 0] })
    await frames(2)
    plugins.wire.send(me().id, 'place', which)
    await frames(4)
  }
  const portal = (name: string) => room.rows.find(r => r.kind === 'portal' && r.data.name === name) as Row
  const front = (p: Row) => p.data.pos.map((v: number, i: number) => v + p.data.normal[i] * (post / 2 + light.ahead))
  await place(0, [2, 0, -10], Math.PI)
  expect(portal(first)).toBeDefined()
  expect(lights()).toHaveLength(Object.keys(rims).length)
  expect(lamp(first).intensity).toBe(light.power)
  expect(lamp(first).position.toArray().map(v => +v.toFixed(9))).toEqual(front(portal(first)).map((v: number) => +v.toFixed(9)))
  expect(lamp(second).intensity).toBe(0)

  await place(1, [6, 0, 12], Math.PI / 2)
  expect(portal(second)).toBeDefined()
  expect(lights()).toHaveLength(Object.keys(rims).length)
  expect(lamp(second).intensity).toBe(light.power)
  expect(lamp(second).position.toArray().map(v => +v.toFixed(9))).toEqual(front(portal(second)).map((v: number) => +v.toFixed(9)))
  // Each rim shines its own glow at its power, and each opening shows the other place.
  const panes: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = []
  plugins.render3d.scene.traverse((o: THREE.Object3D) => { if (o.userData.portal) panes.push(o as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>) })
  expect(panes).toHaveLength(2)
  for (const pane of panes) expect(pane.material.uniforms.open.value).toBe(1)
  const shines = panes.map(p => ((p.parent!.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex())
  const want = [first, second].map(n => new three.Color(rims[n].glow).multiplyScalar(rims[n].power).getHex())
  expect(shines.sort()).toEqual(want.sort())

  room.end(portal(first))
  await frames(4)
  expect(lamp(first).intensity).toBe(0)
  expect(lamp(second).intensity).toBe(light.power)
  for (const pane of panes.filter(p => p.parent!.parent)) expect(pane.material.uniforms.open.value).toBe(0)
})
