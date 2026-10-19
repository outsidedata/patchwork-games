// The farmer kicks up dust as it walks, and the produce it carries glints until it is put on the pile.
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

test('the farmer kicks up dust as it walks, and what it carries glints until it is on the pile', async () => {
  const { kind, thing: farmer, frames, plugins, emitted } = await page('farmer')
  plugins().player.move(1, 0)
  await frames(10)
  const [dust] = emitted.filter(e => e.effect === defs.farmer.dust && e.spawn.scale === undefined)
  expect(dust.fx.at).toEqual(farmer.data.pos)
  plugins().player.move(0, 0)
  await frames(3)
  expect(dust.fx.life).toBeLessThanOrEqual(dust.fx.age)
  farmer.data.carry = 'onion'
  await frames(2)
  const [glint] = emitted.filter(e => e.effect === defs.farmer.carry.glint)
  expect(glint.fx.life).toBeGreaterThan(glint.fx.age)
  const pile = kind('pile')[0]
  farmer.data.pos = [pile.data.pos[0] - defs.farmer.reach * 0.5, pile.data.pos[1]]
  plugins().player.use()
  await frames(3)
  expect(pile.data.items).toEqual(['onion'])
  expect(glint.fx.life).toBeLessThanOrEqual(glint.fx.age)
})
