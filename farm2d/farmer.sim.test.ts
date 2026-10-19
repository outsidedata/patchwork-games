// The farmer's `use`, sent by the seat that plays it: manure put down off the soil lies at its feet,
// and is picked up again; put down on an empty soil cell it sows a crop in the cell's middle, and on a
// cell already growing one it lies; a ripe crop is picked into its arms and an unripe one is left; the
// produce goes on the pile within reach, and lies on the ground anywhere else, where it is picked up
// again. With nobody playing it, its brain carries manure to the soil and produce to the pile.
import { expect, test } from 'vitest'
import { tiledAt } from '#plugins/loader/loader.sim.ts'
import { tileAt } from '#plugins/tilemap/tilemap.sim.ts'
import { farm } from './field.harness.ts'
import file from './farm2d.scene.json' with { type: 'json' }
import defs from './assets/farm2d.json' with { type: 'json' }

const map = await tiledAt('field', file.world.loader.assets.field.url)
const soil = (c: number, r: number) => map.tiles[tileAt(map, undefined, defs.farmer.soil.layer, c, r)]?.type === defs.farmer.soil.type
// The first soil cell of the map, by rows.
const plot = (() => {
  for (let r = 0; r < map.height; r++) for (let c = 0; c < map.width; c++) if (soil(c, r)) return [c, r]
  throw new Error('no soil')
})()

async function played() {
  const f = await farm()
  const seat = await f.join('farmer')
  const farmer = seat.held()!
  const use = () => { seat.send('use'); f.steps(1) }
  return { ...f, seat, farmer, use }
}

test('manure put down off the soil lies at the farmer\'s feet, and is picked up again', async () => {
  const { farmer, use, all } = await played()
  expect(soil(Math.floor(farmer.data.pos[0]), Math.floor(farmer.data.pos[1]))).toBe(false)
  farmer.data.carry = 'manure'
  use()
  expect(farmer.data.carry).toBe(null)
  expect(all('manure').map(m => m.data.pos)).toEqual([farmer.data.pos])
  expect(all('crop')).toEqual([])
  use()
  expect(farmer.data.carry).toBe('manure')
  expect(all('manure')).toEqual([])
})

test('manure put down on an empty soil cell sows a crop in its middle; on a cell growing one it lies', async () => {
  const { farmer, use, all } = await played()
  farmer.data.pos = [plot[0] + 0.2, plot[1] + 0.8]
  farmer.data.carry = 'manure'
  use()
  expect(farmer.data.carry).toBe(null)
  const [crop] = all('crop')
  expect(crop.data.pos).toEqual([plot[0] + 0.5, plot[1] + 0.5])
  farmer.data.carry = 'manure'
  use()
  expect(all('crop').length).toBe(1)
  expect(all('manure').length).toBe(1)
})

test('a ripe crop is picked into the farmer\'s arms, an unripe one is left, and the produce goes on the pile in reach and lies anywhere else', async () => {
  const { farmer, use, all, one } = await played()
  farmer.data.pos = [plot[0] + 0.5, plot[1] + 0.5]
  farmer.data.carry = 'manure'
  use()
  const crop = one('crop')
  use()
  expect(farmer.data.carry).toBe(null)
  expect(all('crop').length).toBe(1)
  crop.data.ripe = true
  use()
  expect(farmer.data.carry).toBe(crop.data.clip)
  expect(all('crop')).toEqual([])
  // Away from the pile it lies loose, and is picked up again.
  use()
  expect(all('produce').map(p => p.data.clip)).toEqual([crop.data.clip])
  expect(farmer.data.carry).toBe(null)
  use()
  expect(farmer.data.carry).toBe(crop.data.clip)
  expect(all('produce')).toEqual([])
  const pile = one('pile')
  farmer.data.pos = [pile.data.pos[0] - defs.farmer.reach * 0.9, pile.data.pos[1]]
  use()
  expect(farmer.data.carry).toBe(null)
  expect(pile.data.items).toEqual([crop.data.clip])
})

test('with nobody playing it, the farmer sows the manure it carries and piles the produce it carries', async () => {
  const { one, all, steps } = await farm()
  const farmer = one('farmer'), pile = one('pile')
  farmer.data.carry = 'manure'
  farmer.data.wait = 0
  for (let i = 0; i < 60 * 20 && farmer.data.carry !== null; i++) steps(1)
  expect(farmer.data.carry).toBe(null)
  expect(all('crop').length).toBe(1)
  const crop = one('crop')
  expect(soil(Math.floor(crop.data.pos[0]), Math.floor(crop.data.pos[1]))).toBe(true)
  farmer.data.carry = 'onion'
  for (let i = 0; i < 60 * 20 && farmer.data.carry !== null; i++) steps(1)
  expect(farmer.data.carry).toBe(null)
  expect(pile.data.items).toContain('onion')
})
