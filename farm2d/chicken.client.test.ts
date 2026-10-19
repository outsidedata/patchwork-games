// A chicken's peck throws up dirt from its beak, a bug there or not, once a peck.
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

test('each peck throws up dirt from the chicken\'s beak, once a peck', async () => {
  const { thing: hen, frames, plugins, emitted } = await page('chicken')
  const scratches = () => emitted.filter(e => e.effect === defs.chicken.scratch.effect)
  plugins().player.use()
  await frames(3)
  expect(hen.data.peck).toBeGreaterThan(0)
  expect(scratches().length).toBe(1)
  await frames(Math.ceil(defs.chicken.peck * 60) + 2)
  expect(scratches().length).toBe(1)
  plugins().player.use()
  await frames(3)
  expect(scratches().length).toBe(2)
})
