// The town's moving things, on the baked glb as the page unpacks it: the tavern fan's bone and skin, its spin at 180
// turns a minute moving the rotor's corners round the downrod and nothing else, and the fortress starting and
// stopping it by name.
import fs from 'node:fs'
import { expect, test } from 'vitest'
import * as THREE from 'three'
import { assemble, played, unpack, type TownClips } from './castle.client.ts'
import { fortress } from './plugins/fortress/fortress.plugin.ts'
import type { Looks } from '#plugins/supershader3d/supershader3d.plugin.ts'

const at = (f: string) => new URL(`./assets/${f}`, import.meta.url)
const FAN = 'tavern/tavern fan'

test('the tavern fan is skinned to its rotor, spins once in 1/3 s, and stops and starts by name', async () => {
  const town = await unpack(new Uint8Array(fs.readFileSync(at('smallville.town.glb'))))
  const looks: Looks = JSON.parse(fs.readFileSync(at('smallville.town.looks.json'), 'utf8'))
  const clips: TownClips = JSON.parse(fs.readFileSync(at('smallville.town.clips.json'), 'utf8'))
  const calls: string[] = []
  const mesh = assemble(THREE, town, looks, call => { calls.push(call); return new THREE.MeshBasicMaterial() }) as THREE.SkinnedMesh

  // one skinned mesh, in no more calls than the town's materials draw in, its skeleton the glb's skin
  expect(mesh.isSkinnedMesh).toBe(true)
  expect(mesh.geometry.groups.length).toBe(calls.length)
  expect(calls.length).toBeLessThanOrEqual(3)
  expect(mesh.skeleton.bones.map(b => b.name)).toEqual(['kit bones', `${FAN} rotor`])
  const [still, rotor] = mesh.skeleton.bones
  expect(still.parent).toBe(mesh)
  expect(rotor.parent).toBe(still)
  expect(still.position.toArray()).toEqual([0, 0, 0])
  expect(rotor.position.x).toBeCloseTo(-10.9, 4)
  expect(rotor.position.y).toBeCloseTo(2.46, 4)
  expect(rotor.position.z).toBeCloseTo(27.1, 4)
  // every vertex's weights add up to 1; the solids, coverings and timber wholly on the bone that never moves
  const index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight')
  const kitFrom = town.meshes.slice(0, -1).reduce((n, m) => n + m.count, 0)
  expect(town.meshes.at(-1)!.joints).toBeDefined()
  // the corner wholly on the rotor furthest from the downrod: a blade's tip
  const position = mesh.geometry.getAttribute('position')
  let onRotor = -1, reach = 0, rotorCorners = 0
  for (let v = 0; v < index.count; v++) {
    const sum = weight.getX(v) + weight.getY(v) + weight.getZ(v) + weight.getW(v)
    if (Math.abs(sum - 1) > 0.01) throw new Error(`vertex ${v}'s weights add up to ${sum}`)
    if (v < kitFrom && (index.getX(v) !== 0 || weight.getX(v) !== 1)) throw new Error(`vertex ${v}, not of the kit, is on joint ${index.getX(v)} by ${weight.getX(v)}`)
    if (index.getX(v) === 1 && weight.getX(v) === 1) {
      rotorCorners++
      const r = Math.hypot(position.getX(v) - rotor.position.x, position.getZ(v) - rotor.position.z)
      if (r > reach) { reach = r; onRotor = v }
    }
  }
  expect(onRotor).toBeGreaterThanOrEqual(kitFrom)
  // the blades reach half the fan's span, 1.32 m, from the downrod
  expect(reach).toBeCloseTo(0.66, 1)
  expect(rotorCorners).toBeGreaterThan(0)

  // the clips file's one clip, the glb's animation it names, a third of a second long, looping, on from the start
  const spin = clips.things.find(t => t.thing === FAN)!.clips.spin
  expect(spin).toMatchObject({ start: 'on', loop: true, animation: `${FAN} spin` })
  const mixer = new THREE.AnimationMixer(mesh)
  const clipsPlayed = played(THREE, mixer, mesh, town, clips)
  expect(clipsPlayed.map(p => [p.thing, p.clip, p.start, p.loop])).toEqual([[FAN, 'spin', true, true]])
  expect(clipsPlayed[0].action.getClip().duration).toBeCloseTo(1 / 3, 6)
  const f = fortress()
  f.animate(THREE, mixer, clipsPlayed)

  // where a corner of the rotor and a corner of the solids are drawn, after the mixer has gone on `seconds`
  const rest = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute, onRotor)
  const drawn = (v: number) => {
    mesh.updateMatrixWorld(true)
    mesh.skeleton.update()
    return mesh.applyBoneTransform(v, new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute, v))
  }
  // the rest corner turned `degrees` round the downrod (three's +y, anticlockwise seen from above)
  const turned = (degrees: number) => rest.clone().sub(rotor.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), (degrees * Math.PI) / 180).add(rotor.position)
  const angle = () => 2 * Math.atan2(rotor.quaternion.y, rotor.quaternion.w) * 180 / Math.PI
  expect(drawn(onRotor).distanceTo(rest)).toBeLessThan(1e-4)
  f.advance(1 / 12)
  expect(angle()).toBeCloseTo(90, 3)
  expect(drawn(onRotor).distanceTo(turned(90))).toBeLessThan(1e-4)
  expect(drawn(onRotor).distanceTo(rest)).toBeGreaterThan(0.05)
  expect(drawn(0).distanceTo(new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute, 0))).toBeLessThan(1e-6)
  // a whole turn in 1/3 s: from 90° on, another 1/3 s comes back to 90°, and 1/12 s more to 180°
  f.advance(1 / 3)
  expect(drawn(onRotor).distanceTo(turned(90))).toBeLessThan(1e-4)
  f.advance(1 / 12)
  expect(drawn(onRotor).distanceTo(turned(180))).toBeLessThan(1e-4)

  // stopped, it stands where it is however long the mixer goes on; started, it goes on from there
  f.clip(FAN, 'spin', false)
  f.advance(0.1)
  expect(drawn(onRotor).distanceTo(turned(180))).toBeLessThan(1e-4)
  f.clip(FAN, 'spin', true)
  f.advance(1 / 12)
  expect(drawn(onRotor).distanceTo(turned(270))).toBeLessThan(1e-4)

  expect(() => f.clip(FAN, 'wobble', true)).toThrow(/no clip wobble of tavern\/tavern fan; it has spin of tavern\/tavern fan/)
  f.still()
  expect(() => f.clip(FAN, 'spin', true)).toThrow(/no town is animated/)
})
