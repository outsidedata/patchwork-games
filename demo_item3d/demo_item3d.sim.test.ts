// demo_item3d: the manager booted as its page boots it and a page made on it over the loopback, as
// index.html makes it. Once the scene's art has landed, each body holds what the scene says it holds: an
// item of item3d's is a mesh in supershader3d's looks (its vertices carry `lookId`), the plain glb sword is
// the loader's model; and the seat's `use` hands the loose wrench to the villager and has it put back.
import { expect, test, vi } from 'vitest'
import type * as THREE from 'three'
import { boot, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { possessed } from '#plugins/player/player.plugin.ts'
import { sim } from './demo_item3d.sim.ts'
import file from './demo_item3d.scene.json' with { type: 'json' }
import defs from './assets/demo_item3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
// The player plugin listens on the page, and node has none.
;(globalThis as any).addEventListener = () => {}
;(globalThis as any).removeEventListener = () => {}

// whether an object is drawn in supershader3d's looks: a mesh under it carries each vertex's `lookId`
const looked = (o: THREE.Object3D) => {
  let found = false
  o.traverse(m => { if ((m as THREE.Mesh).isMesh && (m as THREE.Mesh).geometry.getAttribute('lookId')) found = true })
  return found
}

test('each body holds its items of item3d\'s and its plain glb, and use hands the loose wrench to the villager and back', async () => {
  const truth = boot(structuredClone(file) as Scene, sim)
  const room = (await load(truth, here)).get('main')!
  const page = view(link(loopback(accept(manager(truth)))), file as Scene, here, () => {})
  const frame = async () => { truth.step(DT); await page.frame() }
  await frame()
  const plugins = () => page.client!.plugins
  const row = (kind: string) => room.rows.find(r => r.kind === kind)!
  // the scene's art lands over some frames
  await vi.waitFor(async () => {
    await frame()
    expect(plugins().item3d.ready('wrench') && plugins().item3d.ready('skullcap') && plugins().crowd3d.ready()).toBe(true)
    expect(plugins().anim.props(row('worker').id).length).toBe(2)
    expect(plugins().motion3d.props(row('runner').id).length).toBe(1)
  }, { timeout: 8000, interval: 0 })

  // the worker: the wrench of item3d's, then the plain sword, as its kind's props list them
  const [wrench, sword] = plugins().anim.props(row('worker').id) as THREE.Object3D[]
  expect(looked(wrench)).toBe(true)
  expect(looked(sword)).toBe(false)
  // the runner: the wrench of item3d's
  expect(looked((plugins().motion3d.props(row('runner').id) as THREE.Object3D[])[0])).toBe(true)
  // the villager: a skullcap and a sword, each a copy drawn; nobody holds the wrench yet. Beside it stand seven more
  // villagers, a suit of armor each, every piece of every suit a copy drawn
  const copies = () => Object.fromEntries(Object.entries(plugins().crowd3d.items() as Record<string, { copies: number }>).map(([k, v]) => [k, v.copies]))
  const villagers = room.rows.filter(r => r.kind === 'villager')
  expect(villagers.length).toBe(8)
  const worn = villagers.flatMap(r => Object.values(r.data.holding as Record<string, string>))
  expect(copies()).toEqual({ wrench: 0, ...Object.fromEntries(worn.map(item => [item, 1])) })
  // the loose wrench lies where its row says
  const scene: THREE.Scene = plugins().render3d.scene
  const lying = () => scene.children.find(o => o.name === `item3d wrench ${row('wrench')?.id}`)
  expect(lying()!.position.toArray()).toEqual(row('wrench').data.pos)

  // the seat sends `use` down the page's own wire, as its F key does
  const use = () => plugins().wire.send(possessed(plugins().wire.rows)!.id, 'use')
  use()
  await frame()
  await frame()
  expect(room.rows.some(r => r.kind === 'wrench')).toBe(false)
  expect(row('villager').data.holding[defs.villager.takes]).toBe('wrench')
  expect(copies().wrench).toBe(1)
  expect(scene.children.some(o => o.name.startsWith('item3d wrench'))).toBe(false)
  use()
  await frame()
  await frame()
  expect(row('wrench').data.pos).toEqual(defs.wrench.lies.pos)
  expect(copies().wrench).toBe(0)
  expect(lying()).toBeDefined()
  page.close()
})
