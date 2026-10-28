// demo_nav3d's web: its graph and its ribbons as the bake writes them, and the manager booted with web
// loaded: a minute on, every person has stood only on a link of the web's graph, on a unit up, and the
// people have walked both faces of the ribbons, the outside and the underside.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { standing } from '#plugins/crowd3d/crowd3d.sim.ts'
import { sim } from './demo_nav3d.sim.ts'
import file from './demo_nav3d.scene.json' with { type: 'json' }
import defs from './assets/web.json' with { type: 'json' }
import nav from './assets/web.nav.json' with { type: 'json' }
import look from './assets/ribbons.json' with { type: 'json' }
import { graph, shape } from './assets/web.nav.ts'

const DT = file.prefabs.engine.dt
const web = defs.ribbons
const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i])
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

test('the web\'s ribbons: `points` points evenly apart, each up a unit, meeting each hub on its plane and on the face its half turns give', () => {
  expect(nav).toEqual(JSON.parse(JSON.stringify(graph(web))))
  expect(look).toEqual(JSON.parse(JSON.stringify(shape(web))))
  web.links.forEach((l, r) => {
    const { points, ups } = look.ribbons[r]
    expect(points).toHaveLength(web.points)
    const steps = points.slice(1).map((p, k) => Math.hypot(...sub(p, points[k])))
    for (const s of steps) expect(s / steps[0]).toBeCloseTo(1, 2)
    for (let k = 1; k < points.length - 1; k++) {
      expect(Math.hypot(...ups[k])).toBeCloseTo(1, 9)
    }
    const a = look.hubs[l.a], b = look.hubs[l.b]
    expect(points[0]).toEqual(a.at)
    expect(points[points.length - 1]).toEqual(b.at)
    // Leaving a and meeting b flat along each.
    expect(dot(sub(points[1], points[0]), a.normal) / steps[0]).toBeCloseTo(0, 1)
    expect(dot(sub(points[points.length - 1], points[points.length - 2]), b.normal) / steps[0]).toBeCloseTo(0, 1)
    expect(dot(ups[points.length - 2], b.normal)).toBeCloseTo(l.half % 2 ? -1 : 1, 2)
  })
  for (const n of nav.nodes) expect(Math.hypot(...n.normal)).toBeCloseTo(1, 9)
})

test('a minute on, every person has stood on a link of the web, on its unit up, and the people have walked both faces', async () => {
  const scene = structuredClone(file)
  scene.prefabs.scenemanager.entry = 'web'
  const truth = boot(scene as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('web')!
  connection(manager(truth), () => {})
  const segments = nav.links.map(l => [nav.nodes[l.a].at, nav.nodes[l.b].at])
  const off = (p: number[]) => Math.min(...segments.map(([a, b]) => {
    const ab = sub(b, a)
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)))
    return Math.hypot(...sub(p, a.map((v, i) => v + ab[i] * t)))
  }))
  let outside = 0, underside = 0
  for (let step = 1; step <= 60 * 60; step++) {
    truth.step(DT)
    if (step % 30) continue
    const time = room.rows.find(r => r.kind === 'npc3d')!.data.time
    for (const r of room.rows.filter(r => r.kind === 'wanderer')) {
      const { at, normal } = standing(r, time)
      expect(off(at)).toBeLessThan(1e-6)
      expect(Math.hypot(...normal)).toBeCloseTo(1, 9)
      if (dot(normal, sub(at, web.at)) > 0) outside++
      else underside++
    }
  }
  expect(outside).toBeGreaterThan(0)
  expect(underside).toBeGreaterThan(0)
}, 120000)
