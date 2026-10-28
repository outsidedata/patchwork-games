// demo_nav3d: the cube's graph as its bake writes it, and the manager booted as its page boots it with
// main loaded: a minute on, every person has stood only on the inside of the cube, on the up of the face
// or the edge under it, and the people have walked over the edges onto the walls and the ceiling.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { standing } from '#plugins/crowd3d/crowd3d.sim.ts'
import { sim } from './demo_nav3d.sim.ts'
import file from './demo_nav3d.scene.json' with { type: 'json' }
import defs from './assets/demo_nav3d.json' with { type: 'json' }
import nav from './assets/cube.nav.json' with { type: 'json' }
import { graph } from './assets/cube.nav.ts'

const DT = file.prefabs.engine.dt
const H = defs.cube.size / 2

test('the cube\'s graph: 90 nodes on its faces and edges, each on its unit up turned in, 168 links each along one face', () => {
  expect(nav).toEqual(JSON.parse(JSON.stringify(graph(defs.cube.size, defs.cube.at))))
  expect(nav.nodes).toHaveLength(90)
  expect(nav.links).toHaveLength(168)
  for (const n of nav.nodes) {
    const p = n.at.map((v, i) => v - defs.cube.at[i])
    expect(Math.hypot(...n.normal)).toBeCloseTo(1, 12)
    // On a face (one of its places at ± H) or an edge (two), its up turned in from each.
    const out = [0, 1, 2].filter(i => Math.abs(Math.abs(p[i]) - H) < 1e-9)
    expect(out.length === 1 || out.length === 2).toBe(true)
    for (const i of out) expect(n.normal[i]).toBeCloseTo(-Math.sign(p[i]) / Math.sqrt(out.length), 12)
  }
  // Every link lies on one face: some place of both its ends is the same ± H.
  for (const l of nav.links) {
    const a = nav.nodes[l.a].at, b = nav.nodes[l.b].at
    expect([0, 1, 2].some(i => Math.abs(Math.abs(a[i]) - H) < 1e-9 && Math.abs(a[i] - b[i]) < 1e-9)).toBe(true)
    expect(l.cost).toBeCloseTo(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 12)
  }
})

test('a minute on, every person has stood only on the cube\'s inside, on the up under it, and some have walked onto every face', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  connection(manager(truth), () => {})
  const faces = new Set<string>()
  const visits = new Map<number, Set<string>>()
  for (let step = 1; step <= 60 * 60; step++) {
    truth.step(DT)
    if (step % 15) continue
    const time = room.rows.find(r => r.kind === 'npc3d')!.data.time
    for (const r of room.rows.filter(r => r.kind === 'wanderer')) {
      const { at, normal } = standing(r, time)
      const p = at.map((v, i) => v - defs.cube.at[i])
      // On the cube's surface: its farthest place out is H, and none is past it.
      expect(Math.max(...p.map(Math.abs))).toBeCloseTo(H, 6)
      expect(Math.hypot(...normal)).toBeCloseTo(1, 9)
      // Its up points in, off every face it stands on.
      for (const i of [0, 1, 2]) if (Math.abs(Math.abs(p[i]) - H) < 1e-6) expect(normal[i] * Math.sign(p[i])).toBeLessThanOrEqual(1e-9)
      // A person in the middle of a face, off its edges, stands on the face's own up.
      const on = [0, 1, 2].filter(i => Math.abs(Math.abs(p[i]) - H) < 1e-6)
      if (on.length === 1 && [0, 1, 2].every(i => i === on[0] || Math.abs(p[i]) <= H / 2 + 1e-6) && r.data.speed === 0) {
        const want = [0, 0, 0]
        want[on[0]] = -Math.sign(p[on[0]])
        for (let i = 0; i < 3; i++) expect(normal[i]).toBeCloseTo(want[i], 6)
        const face = `${on[0]}${Math.sign(p[on[0]])}`
        faces.add(face)
        if (!visits.has(r.id)) visits.set(r.id, new Set())
        visits.get(r.id)!.add(face)
      }
    }
  }
  // Stood on every one of the six faces: the floor, the ceiling and the four walls; and most people on
  // more than the one they started on, over an edge.
  expect(faces.size).toBe(6)
  const crossed = [...visits.values()].filter(v => v.size > 1).length
  expect(crossed).toBeGreaterThan(visits.size / 2)
}, 60000)
