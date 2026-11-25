// The light lab's rooms lit from its baked light file, as world3d reads and lights them in the page: every room,
// the nested rooms (a closet in a parlour in a hall in a house) among them, with the camera put in it. Each spot light
// that is on stands on one of that room's sky openings and shines into that room; every one of its sky openings has
// one; each sun patch lies on its floor; each shade lies under a thing standing in it; and outdoors all is off.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { expect, test } from 'vitest'
import { lighting, type Sky } from '../../plugins/world3d/world3d.light.ts'
import { darks, openings, roomAt, rooms } from '../../plugins/world3d/world3d.rooms.ts'

const here = import.meta.dirname
const file = JSON.parse(fs.readFileSync(path.join(here, 'assets', 'lightlab', 'lightlab.art.light.json'), 'utf8'))
const k = JSON.parse(fs.readFileSync(path.join(here, 'lightlab.scene.json'), 'utf8')).world.world3d.rooms
// a low sun from each side in turn, so every window's beam comes in under one of them
const suns = [[1, 0.6, 0], [-1, 0.6, 0], [0, 0.6, 1], [0, 0.6, -1]].map(s => new THREE.Vector3(...s).normalize())
const skyOf = (sun: THREE.Vector3): Sky => ({ sun, sunColor: new THREE.Color(1, 1, 1), zenith: new THREE.Color(0.3, 0.5, 1), horizon: new THREE.Color(1, 1, 1) })

const all = rooms(file)
const holes = openings(file, all, k.through)
const shaded = darks(file, all)

test('the lab has the nested rooms, each door opening into the room round it', () => {
  const into = Object.fromEntries(holes.filter(o => o.name.startsWith('nested rooms/')).map(o => [o.name, o.to ?? 'outdoors']))
  expect(into).toEqual({
    'nested rooms/house house door': 'outdoors',
    'nested rooms/house window 1': 'outdoors',
    'nested rooms/hall hall door': 'nested rooms/house',
    'nested rooms/hall window 1': 'nested rooms/house',
    'nested rooms/parlour parlour door': 'nested rooms/hall',
    'nested rooms/parlour window 1': 'nested rooms/hall',
    'nested rooms/closet closet door': 'nested rooms/parlour',
  })
})

test('with the camera in each room of the lab, only that room is lit and all of it is', () => {
  const scene = new THREE.Scene()
  const lit = lighting(THREE, scene, all, holes, shaded, k)
  const spots = scene.children.filter((c): c is THREE.SpotLight => (c as THREE.SpotLight).isSpotLight)
  const meshes = scene.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
  const points = (m: THREE.Mesh) => { const p = m.geometry.getAttribute('position'); return Array.from({ length: p.count }, (_, n) => [p.getX(n), p.getY(n), p.getZ(n)]) }
  const folded = (m: THREE.Mesh) => points(m).every(p => p[0] === 0 && p[1] === 0 && p[2] === 0)
  const shades = meshes.filter(m => Array.isArray(m.material))
  const patches = meshes.filter(m => !Array.isArray(m.material) && !(m.material as THREE.MeshBasicMaterial).vertexColors)

  for (const r of all) {
    const sky = holes.filter(o => o.sky && o.room === r.name)
    const under = shaded.filter(d => d.room === r.name)
    const sunLit = new Set<number>()
    for (const sun of suns) {
      lit.draw(r.name, skyOf(sun))
      const on = spots.filter(s => s.intensity > 0)
      // a light on each of its sky openings, at the opening, shining into this room and no other
      expect(on.map(s => s.position.toArray()).sort(), r.name).toEqual(sky.map(o => o.mid).sort())
      for (const s of on) expect(roomAt(all, s.target.position.toArray())?.name, `${r.name}: a light shines into`).toBe(r.name)
      // each sun patch on this room's floor
      patches.forEach((p, n) => {
        if (folded(p)) return
        sunLit.add(n)
        for (const v of points(p)) expect(v[1], `${r.name}: a sun patch's height`).toBeCloseTo(r.low[1] + 0.005, 3)
      })
      // a shade under each thing standing in this room, in this room
      const down = shades.filter(m => !folded(m))
      expect(down.length, `${r.name}: shades`).toBe(under.length)
      for (const m of down) {
        const ps = points(m).slice(0, 4)
        const mid = [0, 1, 2].map(i => ps.reduce((a, p) => a + p[i], 0) / 4)
        expect(roomAt(all, [mid[0], mid[1] + 0.1, mid[2]])?.name, `${r.name}: a shade lies in`).toBe(r.name)
      }
    }
    // every opening the sun comes through has its patch under one of the suns
    expect(sunLit.size, `${r.name}: sun patches`).toBe(holes.filter(o => o.beam && o.room === r.name).length)
  }

  lit.draw(undefined, skyOf(suns[0]))
  expect(spots.every(s => s.intensity === 0)).toBe(true)
  expect(meshes.every(folded)).toBe(true)
})
