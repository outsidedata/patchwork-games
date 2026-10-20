// The trails every plane leaves beside flight3d's drawing (`plane.client.ts`): which effect a stage
// lays, how a trail lays its puffs, and that every effect the `plane` definition's `planes` names is in
// the effects file the scene names, which particle3d reads without a complaint.
import { expect, test } from 'vitest'
import sky from '#games/flight/sky.scene.json' with { type: 'json' }
import defs from '#games/flight/assets/flight.json' with { type: 'json' }
import effects from '#games/flight/assets/fx/effects.json' with { type: 'json' }
import { check, type Effects } from '#plugins/particle3d/particle3d.plugin.ts'
import { lay, stageOf, type Look } from './plane.client.ts'

const looks = defs.plane.planes as unknown as Record<string, Look>

test('a stage is the last one its value has reached, and none below the first', () => {
  const stages: [number, string][] = [[0.2, 'a'], [0.5, 'b'], [0.8, 'c']]
  expect(stageOf(stages, 0.1)).toBeUndefined()
  expect(stageOf(stages, 0.2)).toBe('a')
  expect(stageOf(stages, 0.79)).toBe('b')
  expect(stageOf(stages, 1)).toBe('c')
})

test('an exhaust throws a puff each gap it has gone or each every it has waited, whichever is more, evenly to where it is', () => {
  // 10 m in a hundredth of a second, a gap of 2: five puffs, the last where it is.
  const fast = lay({ at: [0, 0, 0], t: 0 }, [0, 0, -10], 0.01, 2, 0.05)
  expect(fast).toHaveLength(5)
  expect(fast[0]).toEqual([0, 0, -2])
  expect(fast[4]).toEqual([0, 0, -10])
  // Standing still: a puff each `every`.
  expect(lay({ at: [1, 2, 3], t: 0 }, [1, 2, 3], 0.16, 2, 0.05)).toEqual([[1, 2, 3], [1, 2, 3], [1, 2, 3]])
  // Neither yet: none.
  expect(lay({ at: [0, 0, 0], t: 0 }, [0, 0, -1], 0.01, 2, 0.05)).toEqual([])
  // A frame after a long pause lays no more than 40.
  expect(lay({ at: [0, 0, 0], t: 0 }, [0, 0, -5000], 30, 0.5, 0.05)).toHaveLength(40)
})

test('every plane has a look, every effect it names is in the scene\'s effects file, and particle3d reads that file', () => {
  const world = sky.world as any
  expect(world.particle3d.effects).toBe('effects')
  expect(world.loader.assets.effects.url).toBe('/games/flight/assets/fx/effects.json')
  check(effects as unknown as Effects, world.particle3d)
  for (const type of Object.keys(world.flight3d.planes)) {
    const look = looks[type]
    expect(look).toBeDefined()
    const named = look.exhausts.flatMap(e => [...e.stages.map(s => s[1]), ...(e.lit ? [e.lit] : [])])
    for (const name of named) expect(Object.keys(effects.effects)).toContain(name)
    // A plane with a flame or a lit exhaust has a burner to light them.
    if (look.flame || look.exhausts.some(e => e.lit)) expect(look.burner).toBeGreaterThan(0)
    // Every ribbon fades as it ages and widens or holds, never thinning to nothing at birth.
    for (const r of [...look.exhausts.map(e => e.ribbon), look.tips.ribbon]) {
      expect(r.width[0]).toBeGreaterThan(0)
      expect(r.width[1]).toBeGreaterThanOrEqual(r.width[0])
      expect(r.life).toBeGreaterThan(0)
    }
  }
  // particle3d lists after flight3d and before render3d, which would draw every particle before it is turned.
  expect(sky.plugins.indexOf('particle3d')).toBeLessThan(sky.plugins.indexOf('render3d'))
})
