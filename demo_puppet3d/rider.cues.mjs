// Writes the `rider` kind into demo_puppet3d.json: the horse's definition, and the X Bot hung on the
// horse's back as a second layout, posed by its seat, a cue sheet on the horse's own senses,
// `assets/cues/rider.rider.seat.cues.json` (the catalogue entry `rider_rider_seat`). The pose below is where
// the rider's angles are tuned: change it, run `node games/demo_puppet3d/rider.cues.mjs`, and press R
// on `pose.html` to see it from every side.
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('./assets/demo_puppet3d.json', import.meta.url)
const defs = JSON.parse(readFileSync(file, 'utf8'))
const skel = JSON.parse(readFileSync(new URL('./assets/xbot/xbot.skeleton.json', import.meta.url), 'utf8'))

const still = [{ by: 'clock', keys: [[0, 0]] }]
const at = v => [{ by: 'clock', keys: [[0, v]] }]

// The seat: thighs forward and spread round the barrel, shins hanging back down, arms down and
// forward to the reins, elbows bent. Each [bend, swing, twist] cue list.
const pose = {
  Hips: [at(0), still, still],
  Spine: [[...at(0.05), { by: 'speed', keys: [[0, 0], [3, 0.08], [12, 0.3]] }, { by: 'stride', swing: 0.05, period: 0.5 }], still, still],
  Spine1: [[...at(0.03), { by: 'stride', swing: 0.04, period: 0.5, phase: 0.1 }], [{ by: 'clock', swing: 0.04, period: 7 }], still],
  Spine2: [at(0), still, still],
  Neck: [[...at(0), { by: 'stride', swing: -0.05, period: 0.5, phase: 0.2 }], still, still],
  Head: [[...at(-0.05), { by: 'speed', keys: [[0, 0], [12, -0.2]] }], [{ by: 'clock', swing: 0.35, period: 11 }, { by: 'speed', keys: [[0, 0], [6, 0]] }], [{ by: 'clock', swing: 0.08, period: 13, phase: 0.3 }]],
  LeftUpLeg: [at(1.35), at(-0.45), still],
  RightUpLeg: [at(1.35), at(0.45), still],
  LeftLeg: [[...at(-1.6), { by: 'stride', swing: 0.06, period: 0.5 }], still, still],
  RightLeg: [[...at(-1.6), { by: 'stride', swing: 0.06, period: 0.5 }], still, still],
  LeftFoot: [at(0.25), still, still],
  RightFoot: [at(0.25), still, still],
  LeftShoulder: [at(0.15), still, still],
  RightShoulder: [at(0.15), still, still],
  LeftArm: [at(1.15), at(-0.55), still],
  RightArm: [at(1.15), at(0.55), still],
  LeftForeArm: [still, [...at(-1.0), { by: 'stride', swing: 0.08, period: 0.5 }], still],
  RightForeArm: [still, [...at(1.0), { by: 'stride', swing: -0.08, period: 0.5 }], still],
}
const cues = {}
for (const b of skel.bones) {
  const [bend, swing, twist] = pose[b.name] ?? [still, still, still]
  // puppet3d bends the other way round from the bends written above: every bend negated.
  const neg = list => list.map(c => c.keys ? { ...c, keys: c.keys.map(([k, v]) => [k, v === 0 ? 0 : -v]) } : { ...c, swing: -c.swing })
  cues[b.name] = { bend: neg(bend), swing, twist }
}

const horse = defs.horse
const rider = structuredClone(horse)
rider.layouts.rider = {
  layout: 'mixamo',
  on: 'body:spine 2',
  along: 0.5,
  offset: [0, -0.8, 0],
  turn: [0, 0, 0],
  skeleton: 'xbotSkeleton',
  skin: 'xbotSkin',
  drivers: [{ name: 'seat', weight: [{ by: 'clock', keys: [[0, 1]] }], cues: 'rider_rider_seat' }],
}
defs.rider = rider
writeFileSync(new URL('./assets/cues/rider.rider.seat.cues.json', import.meta.url), JSON.stringify(cues, null, 2) + '\n')
writeFileSync(file, JSON.stringify(defs, null, 2) + '\n')
console.log('rider written,', Object.keys(cues).length, 'bones cued')
