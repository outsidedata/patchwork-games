// aviary's `aloft` on the hawk of main: its body stood and stepped by puppet3d's own `stand`, `stepped` and
// `sensed`, as the plugin poses it, flown along a straight line at the speed of its first pace.
import fs from 'node:fs'
import { expect, test } from 'vitest'
import { sensed, solvers, stand, stepped, type Def, type Ridden, type Skeleton } from '#plugins/puppet3d/puppet3d.plugin.ts'
import { behaviors } from './aviary.puppet3d.ts'
import scene from '../../main.scene.json' with { type: 'json' }
import defs from '../../assets/demo_puppet3d.json' with { type: 'json' }

const DT = scene.prefabs.engine.dt
const assets = scene.world.loader.assets as Record<string, { url: string }>
const read = (entry: string) => JSON.parse(fs.readFileSync(new URL(`../../../..${assets[entry].url}`, import.meta.url), 'utf8'))

// The hawk flown for `seconds` at its first pace, rising at `rise` metres a second: its senses each step.
function flown(seconds: number, rise: number): Record<string, number>[] {
  const d = defs.hawk as unknown as Def, table = behaviors(), speed = defs.hawk.speeds[1]
  const { drivers, blocks } = solvers(d, table, read)
  const sk = { ...read(d.layouts.body.skeleton), entry: d.layouts.body.skeleton } as Skeleton
  const at: Ridden = { pos: [0, 20, 0], yaw: 0, vel: [0, rise, speed] }
  const body = stand('hawk', d, table, blocks, [sk], at, () => 0, {})
  const out: Record<string, number>[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    at.pos = [0, at.pos[1] + rise * DT, at.pos[2] + speed * DT]
    stepped(table, drivers, blocks, body, {}, at, DT, () => 0)
    out.push(sensed('hawk', d, table, drivers, body, {}, at, i * DT))
  }
  return out
}

test('a hawk flying level beats its wings, glides and beats again, its beat never skipping', () => {
  const senses = flown(8, 0)
  const beating = senses.map(s => s.flap > 0.9), gliding = senses.map(s => s.glide > 0.9)
  const glide = gliding.indexOf(true)
  expect(glide).toBeGreaterThan(0)
  expect(beating.indexOf(true, glide)).toBeGreaterThan(glide)
  // from one step to the next the beat goes on by less than a tenth of a beat, round the turn of it too
  const skips = senses.slice(1).map((s, i) => { const by = s.beat - senses[i].beat; return by - Math.floor(by) })
  expect(Math.max(...skips)).toBeLessThan(0.1)
})

test('a hawk climbing beats its wings without a break, and harder', () => {
  const senses = flown(6, read('hawkSheet').aloft.rise).slice(Math.round(2 / DT))
  expect(Math.max(...senses.map(s => s.glide))).toBeLessThan(0.01)
  expect(Math.min(...senses.map(s => s.effort))).toBeGreaterThan(0.9)
})
