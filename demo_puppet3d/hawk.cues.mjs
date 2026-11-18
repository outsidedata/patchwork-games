// Writes the `hawk` kind into demo_puppet3d.json and its cue sheets into `assets/cues/`: the red-tailed
// hawk, a pro-ng bird (`assets/hawk/`, the bake's `birds`) posed by cues alone, no solver. Its rest is a
// bird standing with its wings spread, facing -z. The poses below are where it is tuned: change one, run
// `node games/demo_puppet3d/hawk.cues.mjs`, and look at station 6 of main.
//
// The sheets, each naming only its own bones, laid in this order:
//   hawk.perch     always: the whole bird turned to face the way it goes, its wings folded at its sides
//   hawk.fly       over it as it gathers speed, the sheet of its `aloft` solver driver: the body tipped level,
//                  rolled into its turn and tipped the way it climbs or dives by what the solver reads of its
//                  flight, the head held up, the legs trailed and the feet clenched, the wings beating by the clock
//   hawk.soar      over that at its fastest: the wings held still, a little raised
//   hawk.feathers  always: the art bones alone, the long feathers of each wing (primaries, secondaries, alula)
//                  and of the tail (rectrices) ruffling slowly, the tail fanned as it gathers speed
//   hawk.beat      over that while the wings beat: the same feathers swept by each beat as well
//   hawk.look      always: the neck's two turning joints, the head looking round
//
// Angles are written in degrees. A bone the kit gives a joint is bent by the kit's own angle (`k`): a wing's
// shoulder down, its elbow folding the forearm back, its wrist folding the hand forward, a toe curling, each
// from 0 at rest. Every other bone stands along the world's axes: `bend` tips it forward, `swing` rolls the
// side at +x down, `twist` turns it about straight up.
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('./assets/demo_puppet3d.json', import.meta.url)
const defs = JSON.parse(readFileSync(file, 'utf8'))

const rad = d => +(d * Math.PI / 180).toFixed(5)
const P = 'red-tailed hawk'
const still = [{ by: 'clock', keys: [[0, 0]] }]
// held at `d` degrees
const at = d => [{ by: 'clock', keys: [[0, rad(d)]] }]
// swaying `d` degrees each way every `period` seconds, `phase` of a period late
const sway = (d, period, phase = 0) => ({ by: 'clock', swing: rad(d), period, phase })
// from 0 at a stand to `d` degrees at `full` metres a second
const bySpeed = (d, full) => ({ by: 'speed', keys: [[0, 0], [full, rad(d)]] })
// a kit joint's angle: puppet3d bends the other way round from the kit
const k = list => list.map(c => c.keys ? { ...c, keys: c.keys.map(([x, v]) => [x, v === 0 ? 0 : -v]) } : { ...c, swing: -c.swing })
const bone = (bend = still, swing = still, twist = still) => ({ bend, swing, twist })
const sides = (name, f) => ({ [`${P}/left ${name}`]: f(1), [`${P}/right ${name}`]: f(-1) })

// one wing beat, seconds, and the pitch of the body in flight, degrees
const BEAT = 0.46, TIP = 58
// the body rolled into its turn by as much as it leans (the `aloft` solver's bank, to its left above 0: the
// side at +x is its right once it is turned to face the way it goes), and tipped up or down the way it goes
// (its climb, the body's bend tipping it forward)
const BANK = { by: 'bank', keys: [[-1.6, 1.6], [1.6, -1.6]] }
const LEVEL = { by: 'climb', keys: [[-1.6, 1.6], [1.6, -1.6]] }
const TOES = { hind: 2, inner: 3, middle: 4, outer: 5 }
const toes = curl => Object.fromEntries(['left', 'right'].flatMap(side => Object.entries(TOES).flatMap(([toe, n]) =>
  Array.from({ length: n }, (_, i) => [`${P}/${side} foot ${toe}.${i}`, bone(k(at(curl)))]))))

const perch = {
  'kit bones': bone(still, still, at(180)),
  [`${P}/body body`]: bone(at(6)),
  [`${P}/body shoulder.L`]: bone(at(-28)),
  [`${P}/body shoulder.R`]: bone(at(-28)),
  [`${P}/body head`]: bone(at(-4)),
  [`${P}/head neck.0`]: bone(k(at(0))),
  [`${P}/head neck.2`]: bone(k(at(0))),
  [`${P}/head head`]: bone(k(at(0))),
  [`${P}/body tail`]: bone(k(at(0))),
  [`${P}/body hip.L`]: bone(k(at(0))),
  [`${P}/body hip.R`]: bone(k(at(0))),
  [`${P}/body drum.L`]: bone(k(at(0))),
  [`${P}/body drum.R`]: bone(k(at(0))),
  ...sides('wing shoulder', () => bone(k(at(72)))),
  ...sides('wing elbow', () => bone(k(at(138)))),
  ...sides('wing wrist', () => bone(k(at(150)))),
  ...toes(0),
}

const fly = {
  'kit bones': bone(still, still, at(180)),
  [`${P}/body body`]: bone([...at(TIP), sway(2.5, BEAT, 0.5), LEVEL], [BANK]),
  [`${P}/body shoulder.L`]: bone(at(-TIP)),
  [`${P}/body shoulder.R`]: bone(at(-TIP)),
  [`${P}/body head`]: bone(at(-14)),
  [`${P}/head neck.0`]: bone(k(at(14))),
  [`${P}/head neck.2`]: bone(k(at(14))),
  [`${P}/head head`]: bone(k(at(14))),
  [`${P}/body tail`]: bone(k([...at(4), sway(3, BEAT, 0.3)])),
  [`${P}/body hip.L`]: bone(k(at(-10))),
  [`${P}/body hip.R`]: bone(k(at(-10))),
  [`${P}/body drum.L`]: bone(k(at(-6))),
  [`${P}/body drum.R`]: bone(k(at(-6))),
  ...sides('wing shoulder', () => bone(k([...at(-8), sway(26, BEAT)]))),
  ...sides('wing elbow', () => bone(k([...at(22), sway(14, BEAT, 0.22)]))),
  ...sides('wing wrist', () => bone(k([...at(20), sway(18, BEAT, 0.3)]))),
  ...toes(55),
}

const soar = {
  ...sides('wing shoulder', () => bone(k([...at(-9), sway(2, 3.7)]))),
  ...sides('wing elbow', () => bone(k(at(10)))),
  ...sides('wing wrist', () => bone(k(at(8)))),
}

// the art bones: `beat` 1 with the sweep of each wing beat, 0 without
const feathered = beat => ({
  ...sides('wing primaries.first', s => bone(k([sway(3, 2.3, s * 0.1), ...(beat ? [sway(6, BEAT, 0.4)] : [])]))),
  ...sides('wing primaries.last', s => bone(k([sway(4, 2.9, s * 0.15), bySpeed(-8, 8), ...(beat ? [sway(9, BEAT, 0.45)] : [])]))),
  ...sides('wing secondaries', s => bone(k([sway(3, 3.4, s * 0.2), ...(beat ? [sway(5, BEAT, 0.35)] : [])]))),
  ...sides('wing alula', s => bone(k([sway(7, 1.7, s * 0.25), ...(beat ? [sway(5, BEAT, 0.5)] : [])]))),
  [`${P}/body rectrices.first`]: bone(k([sway(4, 3.1), bySpeed(-14, 8)])),
  [`${P}/body rectrices.last`]: bone(k([sway(4, 3.1), bySpeed(14, 8)])),
})

const look = {
  [`${P}/head neck.1`]: bone(k([sway(22, 7.3), sway(8, 2.1, 0.3)])),
  [`${P}/head neck.3`]: bone(k([sway(16, 5.9, 0.2)])),
}

const sheets = { perch, fly, soar, feathers: feathered(0), beat: feathered(1), look }
for (const [name, sheet] of Object.entries(sheets)) {
  writeFileSync(new URL(`./assets/cues/hawk.${name}.cues.json`, import.meta.url), JSON.stringify(sheet, null, 2) + '\n')
  console.log(`hawk.${name}: ${Object.keys(sheet).length} bones cued`)
}

// the hawk's sheet: the numbers of the solver that reads its flight (`plugins/aviary/aviary.puppet3d.ts`)
writeFileSync(new URL('./assets/hawk/hawk.json', import.meta.url), JSON.stringify({ aloft: { gravity: 9.81, most: 1, steep: 0.6, slow: 4, ease: 0.35 } }, null, 2) + '\n')

const always = [{ by: 'clock', keys: [[0, 1]] }]
const driver = (name, weight) => ({ name, cues: `hawk_${name}`, weight })
defs.hawk = {
  senses: { clock: 'clock', speed: 'velocity', bank: 'aloftBank', climb: 'aloftClimb' },
  speeds: [0, 7, 10, 14],
  flight: { height: 9, full: 7, climb: 3.5, floor: 1.5, ceiling: 80 },
  layouts: {
    body: {
      layout: 'proNgBird',
      on: 'world',
      skeleton: 'hawkSkeleton',
      skin: 'hawkSkin',
      drivers: [
        driver('perch', always),
        { ...driver('fly', [{ by: 'speed', keys: [[0.3, 0], [3, 1]] }]), solver: 'aloft', gait: 'hawkSheet' },
        driver('soar', [{ by: 'speed', keys: [[11, 0], [13.5, 1]] }]),
        driver('feathers', always),
        driver('beat', [{ by: 'speed', keys: [[0.3, 0], [3, 1], [11, 1], [13.5, 0]] }]),
        driver('look', always),
      ],
    },
  },
  show: { radius: 30, accel: 4, turn: 1.1, dist: 2.4, lift: 0.3 },
}
defs.player.stations = 7
// the hawk among the bodies a seat can steer
if (!defs.player.pilots.includes('hawk')) defs.player.pilots.push('hawk')
const { meadow, ...kinds } = defs
writeFileSync(file, JSON.stringify({ ...kinds, meadow }, null, 2) + '\n')
console.log('hawk written')
