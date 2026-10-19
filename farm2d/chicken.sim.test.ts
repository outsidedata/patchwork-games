// A chicken's `use`, sent by the seat that plays it: it pecks, standing for its `peck` seconds, and a
// bug within reach is eaten; it pecks again only once it has done. With nobody playing them, the
// chickens hunt the bugs that come into their yard, and wander it, never leaving it, clucking now and
// then.
import { expect, test } from 'vitest'
import { farm, DT } from './field.harness.ts'
import defs from './assets/farm2d.json' with { type: 'json' }

test('a peck eats the bug within reach, stands the chicken while it pecks, and waits until it has done', async () => {
  const { join, steps, all } = await farm()
  const seat = await join('chicken')
  const hen = seat.held()!
  for (let i = 0; i < 600 && all('bug').length < 2; i++) steps(1)
  const [near, far] = all('bug')
  near.data.pos = [hen.data.pos[0] + defs.chicken.reach * 0.8, hen.data.pos[1]]
  far.data.pos = [hen.data.pos[0] + defs.chicken.reach * 0.8, hen.data.pos[1] + 0.01]
  // A bug's own wiggle moves it a step before the peck lands.
  seat.send('use')
  steps(1)
  expect(all('bug').some(b => b.id === near.id)).toBe(false)
  expect(hen.data.peck).toBeGreaterThan(0)
  expect(hen.data.clip).toBe('peck')
  expect(hen.data.facing).toBe(0)
  const at = [...hen.data.pos]
  seat.send('use')
  seat.send('move', -1, 0)
  steps(1)
  expect(all('bug').some(b => b.id === far.id)).toBe(true)
  expect(hen.data.pos).toEqual(at)
  steps(Math.ceil(defs.chicken.peck / DT))
  expect(hen.data.peck).toBe(0)
  expect(hen.data.pos[0]).toBeLessThan(at[0])
})

test('a peck with no bug in reach eats nothing', async () => {
  const { join, steps, all } = await farm()
  const seat = await join('chicken')
  const hen = seat.held()!
  for (let i = 0; i < 600 && all('bug').length < 1; i++) steps(1)
  const bug = all('bug')[0]
  bug.data.pos = [hen.data.pos[0] + defs.chicken.reach * 3, hen.data.pos[1]]
  seat.send('use')
  steps(1)
  expect(all('bug').some(b => b.id === bug.id)).toBe(true)
})

test('with nobody playing them, the chickens peck bugs, stay in their yard, and cluck now and then', async () => {
  const { all, steps, one } = await farm()
  const [[l, t], [r, b]] = defs.chicken.bounds
  const ledger = one('audio')
  const clucks = new Set<number>()
  let pecked = 0
  for (let i = 0; i < 60 * 120; i++) {
    const bugs = new Set(all('bug').map(x => x.id))
    steps(1)
    pecked += [...bugs].filter(id => !all('bug').some(x => x.id === id)).length
    for (const e of ledger.data.live) if (e.cue === defs.chicken.sounds.cluck) clucks.add(e.id)
    for (const c of all('chicken')) {
      expect(c.data.pos[0]).toBeGreaterThanOrEqual(l)
      expect(c.data.pos[0]).toBeLessThanOrEqual(r)
      expect(c.data.pos[1]).toBeGreaterThanOrEqual(t)
      expect(c.data.pos[1]).toBeLessThanOrEqual(b)
    }
  }
  expect(pecked).toBeGreaterThan(0)
  expect(clucks.size).toBeGreaterThan(0)
})
