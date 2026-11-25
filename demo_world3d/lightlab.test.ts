// The light lab's rooms as world3d lights them (`plugins/world3d/world3d.rooms.ts`), from the lab's baked light hints
// (`assets/lightlab/lightlab.art.light.json`, read off the run by the library's `stronghold/light-hints.mjs`) and its
// scene's `world.world3d.rooms`, in node.
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { sun } from '#plugins/skydome3d/skydome3d.sim.ts'
import { cells, lightAt, read, type Settings } from '#plugins/world3d/world3d.rooms.ts'

const at = (p: string) => new URL(p, import.meta.url)
const hints = JSON.parse(readFileSync(at('assets/lightlab/lightlab.art.light.json'), 'utf8'))
const scene = JSON.parse(readFileSync(at('lightlab.scene.json'), 'utf8'))
const s: Settings = scene.world.world3d.rooms
const h = read(hints)
const room = (name: string) => h.rooms.find(r => r.name === name)!

test('the sun at the scene\'s hour lands through the sun room\'s window on its floor, and not in the corner behind it', () => {
  const sky = scene.prefabs.skydome3d
  const key = sun({ t: sky.t, day: scene.world.skydome3d.day, doy: sky.doy, lat: sky.lat }) as [number, number, number]
  const r = room('sun room/building')
  const window = r.openings.find(o => o.name === 'sun room/building window 1')!
  // where the window's middle falls on the floor, along the sun
  const down = (window.mid[1] - r.low[1]) / key[1]
  const patch: [number, number, number] = [window.mid[0] - key[0] * down, r.low[1] + 0.01, window.mid[2] - key[2] * down]
  const lit = lightAt(r, patch, [0, 1, 0], key, s)
  expect(lit[2]).toBeGreaterThan(0)
  // the floor's far corner, back from the window, sees less sky and has no sun
  const corner = lightAt(r, [r.low[0] + r.u[0] * (r.a - 0.2) + r.w[0] * (r.b - 0.2), r.low[1] + 0.01, r.low[2] + r.u[2] * (r.a - 0.2) + r.w[2] * (r.b - 0.2)], [0, 1, 0], key, s)
  expect(corner[2]).toBe(0)
  expect(corner[0]).toBeLessThan(lit[0])
})

test('the east room has no opening to the sky, only the doorway to the west room, and the crowded room\'s table darkens the floor under it', () => {
  const east = room('two rooms/east building'), west = room('two rooms/west building')
  expect(east.openings.map(o => o.other)).toEqual([h.rooms.indexOf(west)])
  const r = room('crowded room/building')
  const table = r.darks.find(d => d.top - d.low[1] > 0.5 && d.a > 1.5)!
  const under: [number, number, number] = [table.low[0] + table.u[0] * table.a / 2 + table.w[0] * table.b / 2, r.low[1] + 0.01, table.low[2] + table.u[2] * table.a / 2 + table.w[2] * table.b / 2]
  // the same spot, lit as it would be with nothing standing on the floor
  const key: [number, number, number] = [0, -1, 0]
  expect(lightAt(r, under, [0, 1, 0], key, s)[0]).toBeLessThan(lightAt({ ...r, darks: [] }, under, [0, 1, 0], key, s)[0])
})

test('one wall face running up both storeys of the stairwell is drawn with either room', () => {
  const lower = room('stairwell/lower floor'), upper = room('stairwell/upper floor')
  // the west wall's inside face, from the ground to the upper room's top, as one quad of two triangles
  const x = lower.low[0], z0 = lower.low[2] - 1, z1 = lower.low[2] - 5
  const corners = [[x, 0, z0], [x, 0, z1], [x, 6.2, z1], [x, 6.2, z0]]
  const position = { getX: (i: number) => corners[i][0], getY: (i: number) => corners[i][1], getZ: (i: number) => corners[i][2] }
  const [a, b] = cells(position, [0, 1, 2, 0, 2, 3], h.rooms, s.margin)
  for (const t of [a, b]) expect(t).toEqual(expect.arrayContaining([h.rooms.indexOf(lower), h.rooms.indexOf(upper)]))
})
