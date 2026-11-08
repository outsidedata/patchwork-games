// demo_lights3d: the manager booted as its page boots it and main loaded; a seat joins and is sent
// the stage.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_lights3d.sim.ts'
import file from './demo_lights3d.scene.json' with { type: 'json' }

test('a seat joins main and is sent the stage', async () => {
  const truth = boot(file as Scene, sim)
  await load(truth, import.meta.url)
  const heard: Down[] = []
  connection(manager(truth), d => heard.push(d))
  truth.step(file.prefabs.engine.dt)
  const last = heard[heard.length - 1]
  expect(last.packet.rows.some(r => r.kind === 'stage')).toBe(true)
  expect(last.packet.rows.some(r => r.kind === 'player')).toBe(true)
})
