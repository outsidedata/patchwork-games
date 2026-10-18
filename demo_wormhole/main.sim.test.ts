// main played through by a bot on a page made as client.html makes it (the simulator's page `think`,
// `predict: true`), every press going through the player plugin as a bound key's does. From its start
// it puts the second portal on the wall it faces, walks to the ramp's foot and up onto the ledge, puts
// the first portal on the floor where a body run off the ledge's far edge lands, backs off for a
// run-up and runs off the edge. It falls into the floor portal and comes out of the wall portal's
// front, its fall turned into speed out of the wall, its run into speed up, and keeps both through
// the air (walker's `airAccel` 0) until it lands. Every target and number is worked out from the
// definitions and the scene: the chamber's pieces, the walker's numbers, the player's speed and eye.
// On the page, the camera is never drawn between the two portals.
import { expect, test } from 'vitest'
import type { Row, Scene } from '#engine/engine.ts'
import { possessed, type Think } from '#addons/player/player.addon.ts'
import { simulate, type FrameRecord, type StepRecord } from '#addons/simulator/simulator.addon.ts'
import { sim } from './demo_wormhole.sim.ts'
import file from './demo_wormhole.scene.json' with { type: 'json' }
import shared from './demo_wormhole.partial_scene.json' with { type: 'json' }
import defs from './assets/demo_wormhole.json' with { type: 'json' }

const here = new URL('./', import.meta.url).href
const DT = file.prefabs.engine.dt
const body = shared.world.walker.kinds.player
const { speed, eye, sens, portals: [red, white] } = defs.player
const [, wall, ledge] = defs.chamber.levels.main.boxes
const ramp = defs.chamber.levels.main.ramps[0]
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// Down the middle of the ramp, along the ledge's middle line, and its far (low x) edge.
const lane = (ledge.min[2] + ledge.max[2]) / 2
const across = (ramp.min[0] + ramp.max[0]) / 2
// Where a body run off the ledge's far edge at full speed has its centre cross the floor: it leaves
// once its footprint is off the edge, and falls the ledge's height and half its own.
const leaves = ledge.min[0] - body.span / 2
const flight = Math.sqrt((2 * (ledge.max[1] + body.height / 2)) / body.gravity)
const lands = [leaves - speed * flight, 0, lane]

function bot(): Think {
  let stage = 0
  let moving = false
  let sent = false
  const portal = (rows: Row[], name: string) => rows.find(r => r.kind === 'portal' && r.data.name === name)
  return rows => {
    const me = possessed(rows)
    if (!me) return
    const d = me.data
    // Turn the view to [yaw, pitch], the mouse's pixels the look act turns it by.
    const aim = (yaw: number, pitch: number): [string, number, number] | undefined => {
      const dx = wrap(d.view[0] - yaw), dy = d.view[1] - pitch
      return Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9 ? ['look', dx / sens, dy / sens] : undefined
    }
    // Walk to [x, z], held forward and kept facing it; let go within a stride's tenth.
    const go = (x: number, z: number) => {
      const dx = x - d.pos[0], dz = z - d.pos[2]
      if (Math.hypot(dx, dz) < speed * DT * 6) {
        if (!moving) { stage++; return undefined }
        moving = false
        return ['move', 0, 0] as [string, number, number]
      }
      const turn = aim(Math.atan2(dx, dz), 0)
      if (turn) return turn
      if (!moving) { moving = true; return ['move', 0, -1] as [string, number, number] }
      return undefined
    }
    // Put portal `which` down once and wait for it.
    const put = (which: number, name: string) => {
      if (portal(rows, name)) { stage++; sent = false; return undefined }
      if (sent) return undefined
      sent = true
      return ['place', which] as [string, number]
    }
    switch (stage) {
      case 0: return put(1, white)
      case 1: return go(across, ramp.max[2] + 1)
      case 2: return go(across, lane)
      case 3: return go(ledge.min[0] + 0.8, lane)
      case 4: {
        const from = [d.pos[0], d.pos[1] + eye, d.pos[2]]
        const look = aim(Math.atan2(lands[0] - from[0], lands[2] - from[2]), Math.atan2(lands[1] - from[1], Math.hypot(lands[0] - from[0], lands[2] - from[2])))
        return look ?? put(0, red)
      }
      case 5: return go(ledge.max[0] - 1.5, lane)
      case 6: {
        const look = aim(Math.atan2(-1, 0), 0)
        if (look) return look
        stage++
        moving = true
        return ['move', 0, -1]
      }
      case 7:
        if (d.jumps === 0) return undefined
        stage++
        moving = false
        return ['move', 0, 0]
      default: return undefined
    }
  }
}

test('a bot walks up the ramp, puts a portal on the floor and one on the wall, runs off the ledge, and comes out of the wall at the speed it fell', async () => {
  const records = await simulate({
    file: file as unknown as Scene, sim, base: here, seed: 1, ms: 20000,
    pages: [{ display: { hz: 60 }, up: { delay: 0.1 }, down: { delay: 0.1 }, think: bot(), predict: true }],
    watch: { kinds: ['player', 'portal'], fields: ['pos', 'vel', 'jumps', 'grounded', 'name', 'normal', 'up'], own: [], drawn: true },
  })
  const steps = records.filter((r): r is StepRecord => r.type === 'step' && !!r.rows?.main)
  const of = (s: StepRecord, kind: string) => Object.values(s.rows!.main).filter(r => r.kind === kind) as Record<string, any>[]
  const walker = (s: StepRecord) => of(s, 'player')[0]

  // Both portals stand: the second on the wall's face, the first on the floor.
  const end = steps[steps.length - 1]
  const named = (name: string) => of(end, 'portal').find(p => p.name === name)!
  expect(named(white).normal.map((v: number) => Math.round(v))).toEqual([0, 0, 1])
  expect(named(white).pos[2]).toBeCloseTo(wall.max[2], 9)
  expect(named(red).normal.map((v: number) => Math.round(v))).toEqual([0, 1, 0])
  expect(named(red).pos[1]).toBeCloseTo(ledge.min[1], 9)

  // It walked up the ramp onto the ledge.
  expect(Math.max(...steps.map(s => walker(s).pos[1]))).toBeCloseTo(ledge.max[1], 9)

  // The step it went through, once and only once.
  const k = steps.findIndex(s => walker(s).jumps === 1)
  expect(k).toBeGreaterThan(0)
  expect(walker(end).jumps).toBe(1)
  const before = walker(steps[k - 1]), after = walker(steps[k])
  // Falling at full run off the ledge, through the floor portal's plane.
  expect(before.grounded).toBe(false)
  expect(before.vel[0]).toBeCloseTo(-speed, 3)
  expect(after.pos[2]).toBeGreaterThan(wall.max[2])
  // Its fall, one more step of gravity, comes out of the wall along the wall portal's normal; its run,
  // along the floor portal's up (the way it looked), comes out along the wall portal's up.
  expect(after.vel[2]).toBeCloseTo(-(before.vel[1] - body.gravity * DT), 9)
  const up: number[] = named(red).up
  expect(after.vel[1]).toBeCloseTo(before.vel[0] * up[0] + before.vel[2] * up[2], 6)
  expect(after.vel[2]).toBeGreaterThan(10)

  // Through the air it keeps its speed out of the wall, until it lands.
  const out = after.vel[2]
  let air = k + 1
  for (; air < steps.length && !walker(steps[air]).grounded; air++) expect(walker(steps[air]).vel[2]).toBeCloseTo(out, 9)
  expect(air).toBeLessThan(steps.length)

  // On the page: every frame the camera moves no further than the fastest the body goes but once,
  // the frame it is drawn out of the wall portal, from by the floor portal.
  const frames = records.filter((r): r is FrameRecord => r.type === 'frame' && !!r.drawn)
  const fastest = Math.hypot(out, after.vel[1], speed) * 2 * DT
  const moves = frames.slice(1).map((f, i) => ({ from: frames[i].drawn!.camera, to: f.drawn!.camera }))
  const far = moves.filter(m => Math.hypot(m.to[0] - m.from[0], m.to[1] - m.from[1], m.to[2] - m.from[2]) > fastest)
  expect(far).toHaveLength(1)
  const by = (p: number[], c: number[]) => Math.hypot(c[0] - p[0], c[2] - p[2])
  expect(by(named(red).pos, far[0].from)).toBeLessThan(defs.portal.height)
  expect(by(named(white).pos, far[0].to)).toBeLessThan(defs.portal.height)
})
