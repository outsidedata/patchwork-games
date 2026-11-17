// Writes `meadow.json`, demo_grass3d's terrain3d field, beside this file: `node games/demo_grass3d/assets/meadow.mjs`.
//
// Rolling meadow hills, flattened round the start, under one grass layer of ground (the cc0 Grass004 maps),
// rock on the steep slopes and a gravel track painted round the start as a closed loop, wobbling between
// RADIUS·(1 ± WOBBLE) metres out: benched into the hills, then painted with the `track` surface, whose cover
// is 0, so no grass grows on it.
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const RADIUS = 70
const WOBBLE = 0.18
const POINTS = 48

const loop = []
for (let k = 0; k <= POINTS; k++) {
  const a = (2 * Math.PI * k) / POINTS
  const r = RADIUS * (1 + WOBBLE * Math.sin(3 * a + 0.6))
  loop.push([Math.round(r * Math.cos(a) * 100) / 100, Math.round(r * Math.sin(a) * 100) / 100])
}

const warp = (rotate, big = 30) => [
  { freq: 0.005, amp: big, stretch: [1, 1, 1], rotate },
  { freq: 0.035, amp: 3, stretch: [1, 1, 1], rotate: rotate + 0.7 },
  { freq: 0.18, amp: 0.5, stretch: [1, 1, 1], rotate: rotate + 1.9 },
]

const field = {
  program: {
    world: 4000,
    hscale: 30,
    sea: 0.2,
    flood: false,
    out: 'ground',
    nodes: [
      { id: 'hills', op: 'noise', kind: 'simplex', freq: 9, seed: 3 },
      { id: 'swells', op: 'noise', kind: 'simplex', freq: 40, seed: 5 },
      { id: 'rolled', op: 'combine', mode: 'lerp', a: 'hills', b: 'swells', t: 0.18 },
      { id: 'shaped', op: 'remap', input: 'rolled', inLo: 0, inHi: 1, outLo: 0, outHi: 1, ease: 'smooth' },
      { id: 'ground', op: 'clearing', input: 'shaped', flat: 24, floor: 0 },
    ],
  },
  analysis: {
    slopeStep: 1, curveStep: 4, positionRadius: 20, occlusionRadius: 40, occlusionSteps: 6,
    cliffProbe: 10, cliffSlope: 0.6, cliffDrop: 10, flatAngle: 0.03, records: 50000,
  },
  ground: {
    compose: 'stack',
    layers: [
      { name: 'grass', map: 'grass-color', normal: 'grass-normal', scale: 18, warp: warp(0) },
      {
        name: 'rock', map: 'rock-color', normal: 'rock-normal', scale: 30, strength: 1.2, tri: true, sharp: 12,
        where: [{ q: 'slope', lo: 0.32, hi: 0.48 }], noise: { freq: 0.12, amp: 0.8 }, edge: 0.35, warp: warp(0.4, 18),
      },
      {
        name: 'track', map: 'gravel-color', normal: 'gravel-normal', scale: 12,
        where: [{ q: 'surface:track', lo: 0.2, hi: 0.8 }], edge: 0.2, warp: warp(1.1, 6),
      },
    ],
    heightBlend: { amount: 2, depth: 0.1 },
    far: { amount: 0.7, scale: 7.3 },
    roughness: 0.9,
  },
  surfaces: { track: { cover: 0, grip: 1, drag: 0.02, mark: 0.3 } },
  layers: [
    {
      at: [0, 0],
      size: 256,
      px: 512,
      strokes: [
        { verb: 'bench', radius: 7, hardness: 0.45, strength: 0, level: 0, surface: '', path: loop },
        { verb: 'surface', radius: 3.5, hardness: 0.7, strength: 0, level: 0, surface: 'track', path: loop },
      ],
    },
  ],
}

const out = path.join(import.meta.dirname, 'meadow.json')
writeFileSync(out, JSON.stringify(field, null, 2) + '\n')
console.log('wrote', out)
