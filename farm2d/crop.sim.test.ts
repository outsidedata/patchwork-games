// Every effect a definition names is one the effects file has, so none is silently never drawn. A
// crop, sown, stands at its first stage and moves on a stage every `stage` seconds of its type, to the
// last frame of its clip, where it is ripe and stands. Picked, it bursts leaves and soil and lifts its
// produce, and leaves the field. And a patch of grass: the pasture starts at stages the die picks, and a
// patch grows a stage every `stage` seconds to grown, where it stands until a cow eats it bare.
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { sheetAt } from '#plugins/loader/loader.sim.ts'
import { farm, DT } from './field.harness.ts'
import file from './farm2d.scene.json' with { type: 'json' }
import defs from './assets/farm2d.json' with { type: 'json' }

const crops = await sheetAt('crops', file.world.loader.assets.crops.url)
const grassSheet = await sheetAt('grass', file.world.loader.assets.grass.url)
const lastOf = (clip: string) => crops.clips[clip].runs[0].length - 1

test('every crop type is a clip of the crops sheet, and every effect a definition names is in the effects file', () => {
  const effects = JSON.parse(readFileSync(new URL('./assets/effects.json', import.meta.url), 'utf8')).effects
  for (const [clip, type] of Object.entries(defs.crop.types)) {
    expect(crops.clips).toHaveProperty(clip)
    expect(effects).toHaveProperty(type.pop)
  }
  for (const name of [
    defs.crop.burst,
    defs.farmer.sow, ...Object.values(defs.farmer.effects), defs.farmer.dust, defs.farmer.carry.glint,
    defs.cow.plop, defs.cow.graze, defs.cow.fart.effect, defs.cow.steps.effect, defs.cow.munch.effect,
    defs.chicken.burst, defs.chicken.steps.effect, defs.chicken.scratch.effect,
    defs.crop.sprout, defs.crop.ripen, defs.crop.glint, defs.grass.regrow, defs.grass.grown,
    defs.manure.stink, defs.house.smoke, defs.tree.leaves, defs.pile.crumbs, defs.pile.shine, defs.player.air.effect,
  ]) expect(effects).toHaveProperty(name)
})

test('a crop sown grows a stage every stage seconds of its type, stands ripe at the last, and leaves the field when picked', async () => {
  const { join, steps, all, one, room } = await farm()
  const seat = await join('farmer')
  const farmer = seat.held()!
  farmer.data.pos = [11.5, 2.5]
  farmer.data.carry = 'manure'
  seat.send('use')
  steps(1)
  const crop = one('crop')
  const type = (defs.crop.types as Record<string, { stage: number }>)[crop.data.clip]
  const per = Math.round(type.stage / DT)
  expect(crop.data.frame).toBe(0)
  steps(per - 2)
  expect(crop.data.frame).toBe(0)
  steps(2)
  expect(crop.data.frame).toBe(1)
  steps(per * lastOf(crop.data.clip))
  expect(crop.data.frame).toBe(lastOf(crop.data.clip))
  expect(crop.data.ripe).toBe(true)
  steps(per * 2)
  expect(crop.data.frame).toBe(lastOf(crop.data.clip))
  const ledger = room.rows.find(r => r.kind === 'particle2d')!
  seat.send('use')
  steps(1)
  expect(all('crop')).toEqual([])
  expect(ledger.data.live.map((e: any) => e.effect)).toEqual(expect.arrayContaining([defs.crop.burst, (defs.crop.types as any)[crop.data.clip].pop]))
})

test('the pasture starts at stages the die picks, and a patch grows a stage every stage seconds to grown, and stands', async () => {
  const { all, steps } = await farm()
  const last = grassSheet.clips.grass.runs[0].length - 1
  steps(1)
  expect(new Set(all('grass').map(g => g.data.frame)).size).toBeGreaterThan(1)
  const g = all('grass')[0]
  g.data.frame = 0
  g.data.grow = 0
  g.data.grown = false
  const per = Math.round(defs.grass.stage / DT)
  steps(per - 2)
  expect(g.data.frame).toBe(0)
  steps(per * last + 2)
  expect(g.data.frame).toBe(last)
  expect(g.data.grown).toBe(true)
})
