// The sky's three planes, as sky.scene.json's `world.flight3d.planes` writes their sheets: each sheet
// comes to its aircraft's top and stall speeds.
import { expect, test } from 'vitest'
import { airframeOf, stallSpeed, topSpeed, type Flight } from '#plugins/flight3d/flight3d.sim.ts'
import sky from './sky.scene.json' with { type: 'json' }

const f = sky.world.flight3d as unknown as Flight
const TYPES = ['camel', 'cessna', 'trainer']
const stall = (type: string) => stallSpeed(airframeOf(f, type), f.gravity, f.air.density)

test('each plane\'s sheet comes to its aircraft: its top speed and stall speed at y = 0', () => {
  // The trainer is a Hawk given the afterburner the real one never had: 52 kN with the burner lit against
  // its 23.1 kN Adour, so it is faster, and the burner's weight stalls it a little faster.
  const want: Record<string, [number, number]> = { camel: [50, 21.5], cessna: [65, 25.7], trainer: [427, 61.6] }
  for (const type of TYPES) {
    const t = airframeOf(f, type)
    expect(Math.abs(topSpeed(t, f.air.density) - want[type][0]) / want[type][0]).toBeLessThan(0.02)
    expect(Math.abs(stall(type) - want[type][1]) / want[type][1]).toBeLessThan(0.02)
  }
  expect(() => airframeOf(f, 'spitfire')).toThrow('world.flight3d.planes has no spitfire: its planes are camel, cessna, trainer')
})
