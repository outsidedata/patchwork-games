// Manure on the ground stinks for as long as it lies, and the stink goes when the farmer picks it up.
import { afterEach, expect, test, vi } from 'vitest'
import * as PIXI from 'pixi.js'
import { page } from './field.harness.ts'
import defs from './assets/farm2d.json' with { type: 'json' }

vi.setConfig({ testTimeout: 60_000 })
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})
// Node decodes the pictures the wad holds and no other: the bug's sheet, a plain file, is stood in for.
vi.spyOn(PIXI.Assets, 'load').mockImplementation((async () => new PIXI.Texture()) as typeof PIXI.Assets.load)
afterEach(() => { vi.clearAllMocks() })

test('manure stinks where it lies until the farmer picks it up', async () => {
  const { room, thing: farmer, frames, plugins, emitted } = await page('farmer')
  const manure = room.spawn('manure', { pos: [12.5, 11.5] })
  await frames(2)
  const [stink, ...more] = emitted.filter(e => e.effect === defs.manure.stink)
  expect(more).toEqual([])
  expect(stink.at).toEqual(manure.data.pos)
  expect(stink.fx.life).toBeGreaterThan(stink.fx.age)
  farmer.data.pos = [manure.data.pos[0] + defs.farmer.reach * 0.5, manure.data.pos[1]]
  plugins().player.use()
  await frames(3)
  expect(farmer.data.carry).toBe('manure')
  expect(stink.fx.life).toBeLessThanOrEqual(stink.fx.age)
})
