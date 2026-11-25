// rooms' reading and lighting of the light lab's hints, from the lab's own baked nav file and scene, in node.
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { sun } from '#plugins/skydome3d/skydome3d.sim.ts'
import { cells, lightAt, read, type Settings } from './rooms.plugin.ts'

const at = (p: string) => new URL(p, import.meta.url)
const nav = JSON.parse(readFileSync(at('../../assets/lightlab/lightlab.art.nav.json'), 'utf8'))
const scene = JSON.parse(readFileSync(at('../../lightlab.scene.json'), 'utf8'))
const s: Settings = scene.world.rooms
const h = read(nav, s.fires)
const room = (name: string) => h.rooms.find(r => r.name === name)!

test('the sun at the scene\'s hour lands through the sun room\'s window on its floor, and not in the corner behind it', () => {
  const sky = scene.prefabs.skydome3d
  const key = sun({ t: sky.t, day: scene.world.skydome3d.day, doy: sky.doy, lat: sky.lat }) as [number, number, number]
  const r = room('sun room/room')
  const window = r.openings.find(o => o.name === 'sun room/window')!
  // where the window's middle falls on the floor, along the sun
  const down = (window.mid[1] - r.low[1]) / key[1]
  const patch: [number, number, number] = [window.mid[0] - key[0] * down, r.low[1] + 0.01, window.mid[2] - key[2] * down]
  const lit = lightAt(r, patch, [0, 1, 0], key, s, h.fires.length)
  expect(lit[2]).toBeGreaterThan(0)
  // the floor's far corner, back from the window, sees less sky and has no sun
  const corner = lightAt(r, [r.low[0] + r.u[0] * (r.a - 0.2) + r.w[0] * (r.b - 0.2), r.low[1] + 0.01, r.low[2] + r.u[2] * (r.a - 0.2) + r.w[2] * (r.b - 0.2)], [0, 1, 0], key, s, h.fires.length)
  expect(corner[2]).toBe(0)
  expect(corner[0]).toBeLessThan(lit[0])
})

test('the east room has no opening to the sky, only the doorway to the west room, and the hearth room\'s fire lights its floor', () => {
  const east = room('two rooms/east room'), west = room('two rooms/west room')
  expect(east.openings.map(o => o.other)).toEqual([h.rooms.indexOf(west)])
  const hearth = room('hearth room/room')
  const fire = hearth.lamps[0]
  const floor = lightAt(hearth, [fire.at[0] + 1.5, hearth.low[1] + 0.01, fire.at[2] + 1.5], [0, 1, 0], [0, -1, 0], s, h.fires.length)
  expect(floor[3 + fire.fire]).toBeGreaterThan(0)
})

test('one wall face running up both storeys of the stairwell is drawn with either room', () => {
  const lower = room('stairwell/lower room'), upper = room('stairwell/upper room')
  // the west wall's inside face, from the ground to the upper room's top, as one quad of two triangles
  const x = lower.low[0], z0 = lower.low[2] - 1, z1 = lower.low[2] - 5
  const corners = [[x, 0, z0], [x, 0, z1], [x, 6.2, z1], [x, 6.2, z0]]
  const position = { getX: (i: number) => corners[i][0], getY: (i: number) => corners[i][1], getZ: (i: number) => corners[i][2] }
  const [a, b] = cells(position, [0, 1, 2, 0, 2, 3], h.rooms, s.margin)
  for (const t of [a, b]) expect(t).toEqual(expect.arrayContaining([h.rooms.indexOf(lower), h.rooms.indexOf(upper)]))
})
