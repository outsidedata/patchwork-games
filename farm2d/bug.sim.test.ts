// The bugs: the swarm sends one in along the field's edge by the yard every few seconds, never more than
// `most` at once, whether anyone pecks them or not; a bug creeps to the pile, and there nibbles the last
// thing off it as it arrives and again every `nibble` seconds it stays, crumbs bursting; at an empty pile
// it nibbles nothing.
import { expect, test } from 'vitest'
import { farm, DT } from './field.harness.ts'
import defs from './assets/farm2d.json' with { type: 'json' }

// The field with a seat playing every chicken, so each stands where it is and pecks no bug.
async function unguarded() {
  const f = await farm()
  for (let i = f.all('chicken').length; i > 0; i--) await f.join('chicken')
  return f
}

test('bugs keep coming along the edges the swarm names, never more than most at once', async () => {
  const { all, steps } = await unguarded()
  // Those that came in while the seats joined have crept on since.
  const seen = new Set<number>(all('bug').map(b => b.id))
  for (let i = 0; i < 60 * 120; i++) {
    for (const b of all('bug')) {
      if (seen.has(b.id)) continue
      seen.add(b.id)
      const on = defs.swarm.from.some(([[x0, y0], [x1, y1]]) => {
        const t = x1 !== x0 ? (b.data.pos[0] - x0) / (x1 - x0) : (b.data.pos[1] - y0) / (y1 - y0)
        return t >= 0 && t <= 1 && Math.abs(x0 + (x1 - x0) * t - b.data.pos[0]) < 1e-9 && Math.abs(y0 + (y1 - y0) * t - b.data.pos[1]) < 1e-9
      })
      expect(on).toBe(true)
    }
    steps(1)
    expect(all('bug').length).toBeLessThanOrEqual(defs.swarm.most)
  }
  expect(all('bug').length).toBe(defs.swarm.most)
})

test('a bug at the pile nibbles the last thing off it as it arrives and every nibble seconds after, and nothing off an empty pile', async () => {
  const { all, one, steps } = await unguarded()
  for (let i = 0; i < 600 && all('bug').length < 1; i++) steps(1)
  const pile = one('pile'), bug = all('bug')[0]
  for (const b of all('bug')) if (b !== bug) b.data.pos = [0, 0]
  pile.data.items = ['leek', 'onion', 'potato']
  bug.data.pos = [pile.data.pos[0] + defs.bug.reach * 0.5, pile.data.pos[1]]
  bug.data.nib = 0
  steps(1)
  expect(pile.data.items).toEqual(['leek', 'onion'])
  steps(Math.round(defs.bug.nibble / DT) - 2)
  expect(pile.data.items).toEqual(['leek', 'onion'])
  steps(3)
  expect(pile.data.items).toEqual(['leek'])
  pile.data.items = []
  steps(Math.round(defs.bug.nibble / DT) * 3)
  expect(pile.data.items).toEqual([])
})
