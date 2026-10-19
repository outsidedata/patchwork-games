// A crop sprouts as it grows, sparkles the step it ripens and twinkles until the farmer picks it; the
// twinkle goes with it.
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

test('a crop sprouts as it grows, ripens with a sparkle, and twinkles until the farmer picks it', async () => {
  const { room, thing: farmer, frames, plugins, emitted } = await page('farmer')
  const named = (effect: string) => emitted.filter(e => e.effect === effect)
  const crop = room.spawn('crop', { pos: [12.5, 3.5], clip: 'leek', frame: 0, grow: 0, ripe: false })
  await frames(2)
  expect(named(defs.crop.sprout)).toEqual([])
  const stage = defs.crop.types.leek.stage
  crop.data.grow = stage
  await frames(2)
  expect(named(defs.crop.sprout).length).toBe(1)
  expect(named(defs.crop.ripen)).toEqual([])
  // Grown on to its last stage, it ripens: one sparkle, and a twinkle kept going.
  crop.data.frame = 4
  crop.data.grow = stage
  await frames(3)
  expect(crop.data.ripe).toBe(true)
  expect(named(defs.crop.ripen).length).toBe(1)
  const [glint] = named(defs.crop.glint)
  expect(glint.fx.life).toBeGreaterThan(glint.fx.age)
  farmer.data.pos = [crop.data.pos[0] + defs.farmer.reach * 0.5, crop.data.pos[1]]
  plugins().player.use()
  await frames(3)
  expect(farmer.data.carry).toBe('leek')
  expect(glint.fx.life).toBeLessThanOrEqual(glint.fx.age)
})
