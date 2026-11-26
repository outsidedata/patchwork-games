// laser's browser half handed a wire's rows and render3d's THREE and scene: a beam drawn shines that frame between
// its two ends, goes out on the next tick unless drawn again, is taken away when its holder's row is gone, and every
// one is taken away on close. A beam's numbers that are not what a beam takes throw, naming the number.
import { expect, test } from 'vitest'
import * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import sheet from '../../assets/demo_guns3d.guns.json' with { type: 'json' }
import { laser, type Beam } from './laser.plugin.ts'

const numbers = sheet.guns['g95-L'].look.beam as Beam

function page(ids: number[]) {
  const scene = new THREE.Scene()
  const plugins = { render3d: { THREE, scene }, wire: { rows: ids.map(id => ({ id, kind: 'player', data: {} })) } } as unknown as Plugins
  return { scene, plugins }
}
const beams = (scene: THREE.Scene) => scene.children.filter(o => o.name.startsWith('laser beam')) as THREE.Mesh[]

test('a beam shines the frame it is drawn, between its two ends, and goes out on the next tick', () => {
  const { scene, plugins } = page([7])
  const l = laser()
  l.tick(plugins)
  l.draw(7, [0, 1.5, 0], [0, 1.2, 10], numbers)
  const [b] = beams(scene)
  expect(b.visible).toBe(true)
  const u = (b.material as THREE.ShaderMaterial).uniforms
  expect(u.uA.value.toArray()).toEqual([0, 1.5, 0])
  expect(u.uB.value.toArray()).toEqual([0, 1.2, 10])
  expect(u.uWidth.value).toBe(numbers.width)
  expect(u.uLevel.value).toBeLessThanOrEqual(numbers.gain)
  expect(u.uLevel.value).toBeGreaterThanOrEqual(numbers.gain * (1 - numbers.flicker))
  l.tick(plugins)
  expect(b.visible).toBe(false)
  l.draw(7, [0, 1.5, 0], [1, 1, 10], numbers)
  expect(beams(scene)).toHaveLength(1)
  expect(b.visible).toBe(true)
})

test("a beam whose holder's row is gone is taken away, and close takes every one away", () => {
  const { scene, plugins } = page([1, 2])
  const l = laser()
  l.tick(plugins)
  l.draw(1, [0, 0, 0], [0, 0, 5], numbers)
  l.draw(2, [0, 0, 0], [0, 0, 5], numbers)
  expect(beams(scene)).toHaveLength(2)
  ;(plugins.wire as any).rows = [{ id: 2, kind: 'player', data: {} }]
  l.tick(plugins)
  expect(beams(scene).map(b => b.name)).toEqual(['laser beam 2'])
  l.close()
  expect(beams(scene)).toHaveLength(0)
})

test("a beam's numbers out of their bounds throw, naming the number", () => {
  const { plugins } = page([1])
  const l = laser()
  l.tick(plugins)
  expect(() => l.draw(1, [0, 0, 0], [0, 0, 1], { ...numbers, width: 0 })).toThrow("a beam's width is 0")
  expect(() => l.draw(1, [0, 0, 0], [0, 0, 1], { ...numbers, coreWidth: 1 })).toThrow('is wider than its width')
  expect(() => l.draw(1, [0, 0, 0], [0, 0, 1], { ...numbers, flicker: 2 })).toThrow("a beam's flicker is 2")
})
