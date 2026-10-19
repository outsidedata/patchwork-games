// A cow's `use`, sent by the seat that plays it: of the grass grown tall within reach, the nearest is
// eaten bare and the cow chews, standing whatever its keys say and eating nothing more, then drops a
// pile of manure where it stands. Grass not grown is not eaten. With nobody playing it, its brain
// grazes and wanders inside its pasture.
import { expect, test } from 'vitest'
import { farm, DT } from './field.harness.ts'
import defs from './assets/farm2d.json' with { type: 'json' }

async function played() {
  const f = await farm()
  const seat = await f.join('cow')
  const cow = seat.held()!
  // Done with any meal its brain began, and every patch short, but the one the cow is put by.
  for (const g of f.all('grass')) { g.data.frame = 0; g.data.grow = 0; g.data.grown = false }
  const patch = f.all('grass')[0]
  cow.data.chew = 0
  cow.data.pos = [patch.data.pos[0] + defs.cow.reach * 0.6, patch.data.pos[1]]
  return { ...f, seat, cow, patch }
}

test('grass not grown is not eaten', async () => {
  const { seat, cow, steps, all } = await played()
  seat.send('use')
  steps(1)
  expect(cow.data.chew).toBe(0)
  expect(all('manure')).toEqual([])
})

test('the cow eats the grown patch, chews standing, eats nothing more, and drops manure where it stands', async () => {
  const { seat, cow, patch, steps, all } = await played()
  patch.data.frame = 3
  patch.data.grown = true
  const other = all('grass')[1]
  other.data.frame = 3
  other.data.grown = true
  other.data.pos = [...patch.data.pos]
  seat.send('use')
  steps(1)
  expect(patch.data.grown).toBe(false)
  expect(patch.data.frame).toBe(0)
  expect(other.data.grown).toBe(true)
  expect(cow.data.chew).toBeGreaterThan(0)
  expect(cow.data.clip).toBe('eat')
  const at = [...cow.data.pos]
  seat.send('move', 1, 0)
  seat.send('use')
  steps(Math.round(defs.cow.chew / DT) - 3)
  expect(cow.data.pos).toEqual(at)
  expect(other.data.grown).toBe(true)
  // The other cow, its brain's, drops its own; this one's lies where it stood.
  const here = () => all('manure').filter(m => m.data.pos[0] === at[0] && m.data.pos[1] === at[1])
  expect(here()).toEqual([])
  steps(4)
  expect(cow.data.chew).toBe(0)
  expect(here().length).toBe(1)
})

test('with nobody playing them, the cows graze the grown grass and stay in their pasture', async () => {
  const { all, steps } = await farm()
  const [[l, t], [r, b]] = defs.cow.bounds
  let eaten = 0
  for (let i = 0; i < 60 * 60; i++) {
    const grown = new Set(all('grass').filter(g => g.data.grown).map(g => g.id))
    steps(1)
    eaten += all('grass').filter(g => grown.has(g.id) && !g.data.grown).length
    for (const c of all('cow')) {
      expect(c.data.pos[0]).toBeGreaterThanOrEqual(l)
      expect(c.data.pos[0]).toBeLessThanOrEqual(r)
      expect(c.data.pos[1]).toBeGreaterThanOrEqual(t)
      expect(c.data.pos[1]).toBeLessThanOrEqual(b)
    }
  }
  expect(eaten).toBeGreaterThan(0)
})
