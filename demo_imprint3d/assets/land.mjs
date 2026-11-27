// Writes `land.json`, demo_imprint3d's terrain3d field, beside this file: `node games/demo_imprint3d/assets/land.mjs`.
//
// demo_grass3d's rolling meadow hills, flattened round the start, under one grass layer of ground (the cc0
// Grass004 maps). Over it the land itself says where its snow, sand and mud lie, each a ground layer of its own
// maps by rules over the land record: snow on the high ground, mud where the ground is wet, sand on the low
// ground. imprint3d lays its soft ground of the same name by the same rules (`grounds.json`), and each layer's
// edge is the whole of its rules' ramp, as the soft ground's is, so the two fade into the land together.
import { writeFileSync } from 'node:fs'
import path from 'node:path'

// Where each lies: the rules over the land record its ground layer and its soft ground share.
export const WHERE = {
  snow: [{ q: 'height', lo: 37.6, hi: 38.4 }],
  sand: [{ q: 'height', lo: 32.5, hi: 31.5 }],
  mud: [{ q: 'wet', lo: 0.1, hi: 0.22 }],
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
      ...Object.entries(WHERE).map(([name, where], k) => ({
        name, map: `${name}-color`, normal: `${name}-normal`, scale: 6, where, edge: 1, warp: warp(1.1 + k, 6),
      })),
    ],
    heightBlend: { amount: 2, depth: 0.1 },
    far: { amount: 0.7, scale: 7.3 },
    roughness: 0.9,
  },
  surfaces: {},
  layers: [],
}

const out = path.join(import.meta.dirname, 'land.json')
writeFileSync(out, JSON.stringify(field, null, 2) + '\n')
console.log('wrote', out)
