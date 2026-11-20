// Writes the hairstyles of `hairs.json` that gather the hair to ties (`plugins/hair3d/hair3d.sim.ts`, `ties`):
// pigtails, a braid, braided pigtails with a tie at the end of each, and a head of braids. Each is the scalp's
// hair with its length, its links and its ties changed. Run `node games/demo_hair3d/assets/hairs.styles.mjs`
// from the repo root to lay them into the file in place, before its `fur`, each one replaced if it is there;
// after that they are tuned in the hair workshop (`yarn workshop hair3d demo_hair3d`), which saves into the
// file, so run it again only to start them over.
//
// A tie's place is in the frame of the X Bot's `Head` bone, whose origin is at the neck: the middle of the head
// is [0, 0.09, 0.015] and the skull is 0.105 round it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hairs.json')
const middle = [0, 0.09, 0.015]

const scalp = (changes) => ({
  on: { meshes: 'Alpha_Surface', bones: ['Head'], weight: 0.5, cuts: [{ bone: 'Head', normal: [0, 0.75, -0.66], offset: 0.07 }], planes: [], faces: [] },
  density: 9000,
  strands: 20,
  length: [0.55, 0.3],
  width: [0.0035, 0.5],
  taper: 0.3,
  thin: 0.0012,
  links: 12,
  segments: 12,
  comb: [0, -1.1, -0.7],
  stiffness: [12, 0.3],
  gravity: 9.8,
  damping: 2.5,
  drag: 1.5,
  clump: { radius: 0.012, tight: 0.6 },
  curl: { radius: 0.004, turns: 2 },
  ragged: 0.25,
  colours: { root: '#2a160c', tip: '#8a5a2e' },
  vary: 0.25,
  ao: 0.5,
  roughness: 0.55,
  shine: { strength: 0.1, power: 60 },
  translucency: 0.3,
  shadow: true,
  ...changes,
})

const tie = (changes) => ({
  bone: 'Head', at: [0, 0.13, -0.13], around: middle, lift: 0.02, hang: [0, -1, -0.4], fall: 0.6,
  reach: 0.35, share: 1, spread: 0.02, flare: 0.07, band: 0, side: [1, 0, 0], stiffness: [40, 2.5],
  braid: { radius: 0, pitch: 0.12 }, ...changes,
})

const round = (n) => Math.round(n * 1000) / 1000

// A head of braids: each one stands out from a place on the head, round its middle, and droops.
function braids() {
  const rings = [{ up: 90, count: 1 }, { up: 62, count: 5 }, { up: 32, count: 8 }, { up: 5, count: 9 }]
  const ties = []
  for (const ring of rings) {
    for (let k = 0; k < ring.count; k++) {
      // round the back of the head, from the left ear over the back to the right ear
      const turn = ring.count === 1 ? 0 : (-0.5 + (k + 0.5) / ring.count) * 2 * Math.PI * 0.85
      const e = (ring.up * Math.PI) / 180
      const out = [Math.sin(turn) * Math.cos(e), Math.sin(e), -Math.cos(turn) * Math.cos(e)]
      ties.push(tie({
        at: out.map((v, a) => round(middle[a] + v * 0.135)), lift: 0.01, hang: out.map(round), fall: 0.4,
        reach: 0.09, spread: 0.007, flare: 0.014, band: 0.24,
        side: ring.up === 90 ? [1, 0, 0] : [round(Math.cos(turn)), 0, round(Math.sin(turn))],
        stiffness: [40, 9], braid: { radius: 0.006, pitch: 0.1 },
      }))
    }
  }
  return ties
}

const styles = {
  ponytail: scalp({ ties: [tie({})] }),
  pigtails: scalp({
    length: [0.5, 0.3],
    ties: [-1, 1].map(s => tie({ at: [s * 0.125, 0.07, -0.03], hang: [s * 0.25, -1, -0.15], fall: 0.85, reach: 0.3, spread: 0.018, flare: 0.05, stiffness: [40, 2] })),
  }),
  braid: scalp({
    length: [0.8, 0.15], links: 28, segments: 24,
    clump: { radius: 0.006, tight: 0.5 },
    ties: [tie({ at: [0, 0.08, -0.12], hang: [0, -1, -0.12], fall: 0.9, reach: 0.3, spread: 0.008, flare: 0.035, band: 0.5, stiffness: [40, 16], braid: { radius: 0.015, pitch: 0.14 } })],
  }),
  braided_pigtails: scalp({
    length: [0.65, 0.2], links: 28, segments: 24,
    ties: [-1, 1].map(s => tie({ at: [s * 0.115, 0.075, -0.04], hang: [s * 0.2, -1, -0.15], fall: 0.9, reach: 0.3, spread: 0.01, flare: 0.03, band: 0.38, side: [1, 0, 0], stiffness: [40, 16], braid: { radius: 0.0095, pitch: 0.1 } })),
  }),
  coolio: scalp({
    length: [0.42, 0.3], links: 24, segments: 20, density: 14000, strands: 12,
    colours: { root: '#0e0806', tip: '#2a1a12' },
    ties: braids(),
  }),
}

// A value as the file lays it out: what fits on one line is on one line.
function lay(v, indent) {
  const flat = (x) => (Array.isArray(x) ? `[${x.map(flat).join(', ')}]` : x && typeof x === 'object' ? `{ ${Object.entries(x).map(([k, y]) => `"${k}": ${flat(y)}`).join(', ')} }` : JSON.stringify(x))
  const one = flat(v)
  if (typeof v !== 'object' || v === null || indent.length + one.length <= 150) return one
  const inner = indent + '  '
  if (Array.isArray(v)) return `[\n${v.map(x => inner + lay(x, inner)).join(',\n')}\n${indent}]`
  return `{\n${Object.entries(v).map(([k, y]) => `${inner}"${k}": ${lay(y, inner)}`).join(',\n')}\n${indent}}`
}

// The kinds of the file, each style worn by the kind of its own name: laid in where the file's `kinds` lists
// them, each replaced if it is there.
let text = fs.readFileSync(file, 'utf8')
for (const name of Object.keys(styles)) {
  const line = `    "${name}": { "hairs": ["${name}"] }`
  const kinds = text.indexOf('\n  "kinds": {')
  const end = text.indexOf('\n  },', kinds)
  const had = text.indexOf(`\n    "${name}": {`, kinds)
  if (had >= 0 && had < end) continue
  text = text.slice(0, end).replace(/\s*$/, '') + `,\n${line}` + text.slice(end)
}
// The hairs: each starts a line at four spaces, after the file's `"hairs": {`; a key of the same word deeper
// in, or in the kinds before it, is not one.
for (const [name, hair] of Object.entries(styles)) {
  const entry = `    "${name}": ${lay(hair, '    ')},\n`
  const section = text.indexOf('\n  "hairs": {')
  const at = text.indexOf(`\n    "${name}": {`, section) + 1
  if (at > 0) {
    const next = text.indexOf('\n    "', at)
    text = text.slice(0, at) + entry + text.slice(next + 1)
  } else {
    const fur = text.indexOf('\n    "fur": {', section) + 1
    text = text.slice(0, fur) + entry + text.slice(fur)
  }
}
try {
  JSON.parse(text)
} catch (e) {
  fs.writeFileSync(file + '.bad', text)
  const lines = text.split('\n')
  const bad = Number(/line (\d+)/.exec(e.message)?.[1] ?? 1)
  throw new Error(`${e.message}\n${lines.slice(Math.max(0, bad - 6), bad + 1).join('\n')}`)
}
fs.writeFileSync(file, text)
console.log(`wrote ${Object.keys(styles).join(', ')}`)
