// A cow kicks up dust as it walks and drops bits of grass from its mouth while it chews, and both stop
// when it does.
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

test('the cow kicks up dust at its feet as it walks and munches while it chews, each stopping when it does', async () => {
  const { kind, thing: cow, frames, plugins, emitted } = await page('cow')
  const named = (effect: string) => emitted.filter(e => e.effect === effect && e.spawn.scale === defs.cow.steps.scale)
  plugins().player.move(1, 0)
  await frames(10)
  const [steps] = named(defs.cow.steps.effect)
  expect(steps.fx.at).toEqual(cow.data.pos)
  expect(steps.fx.life).toBeGreaterThan(steps.fx.age)
  plugins().player.move(0, 0)
  await frames(3)
  expect(steps.fx.life).toBeLessThanOrEqual(steps.fx.age)
  // It eats the grass grown beside it, and munches until it has chewed.
  const grass = kind('grass').find(g => Math.abs(g.data.pos[1] - cow.data.pos[1]) < 1)!
  grass.data.frame = 3
  grass.data.grown = true
  cow.data.pos = [grass.data.pos[0] + defs.cow.reach * 0.5, grass.data.pos[1]]
  await frames(1)
  const before = emitted.length
  plugins().player.use()
  await frames(3)
  expect(cow.data.chew).toBeGreaterThan(0)
  const [munch] = emitted.slice(before).filter(e => e.effect === defs.cow.munch.effect)
  expect(munch.fx.life).toBeGreaterThan(munch.fx.age)
  cow.data.chew = 0.01
  await frames(3)
  expect(munch.fx.life).toBeLessThanOrEqual(munch.fx.age)
})
