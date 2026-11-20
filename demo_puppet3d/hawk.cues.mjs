// Writes the `hawk` kind into demo_puppet3d.json, its cue sheets into `assets/cues/` and its sheet into
// `assets/hawk/hawk.json`: the red-tailed hawk, a pro-ng bird (`assets/hawk/`, the bake's `birds`). Its rest is
// a bird standing with its wings spread, facing -z. The poses and the strokes below are where it is tuned:
// change one, run `node games/demo_puppet3d/hawk.cues.mjs`, and look at station 6 of main.
//
// Its `aloft` solver (`plugins/aviary/aviary.puppet3d.ts`) reads the row's flight and gives off the senses the
// sheets and their weights read: `beat`, where the wings are in their beat (0 the top of the stroke, DOWN the
// bottom, 1 the top again); `air`, `flap` and `glide`, how much it is in the air, beating and gliding;
// `effort`, `brake` and `stoop`, how hard it works, slows and dives; `bank` and `climb`.
//
// The sheets, each naming only its own bones, laid in this order:
//   hawk.perch     always: the whole bird turned to face the way it goes, its wings folded at its sides
//   hawk.spread    over it as it leaves the ground (the first of `air`): the wings alone, opened. A folded hand
//                  and a hand folded back in flight are more than half a turn apart, and a bone goes between
//                  two turns the short way round, so the wings open first and beat from there
//   hawk.fly       over it in the air (the rest of `air`), the sheet of its `aloft` driver: the body tipped level, rolled
//                  into its turn and tipped the way it climbs or dives, nodding with each beat, the head held
//                  level against the roll and the nod, the tail rolled further into the turn, the legs trailed
//                  and the feet clenched, and the wings through one beat by `beat`: a long stroke down with
//                  the wing spread and swept forward, a short one up with the hand folded back and the leading
//                  edge lifted
//   hawk.power     over that by `effort`: the same beat, deeper and further folded
//   hawk.glide     over that by `glide`: the wings held spread, a little raised, rocking slowly, drawn back as
//                  it goes faster
//   hawk.tuck      over that by `stoop`: the wings pulled in and back for a dive
//   hawk.flare     over that by `brake`: the body reared back, the wings beating forward with their leading
//                  edges up, the tail lowered, the legs reached forward and the feet opened
//   hawk.feathers  always: the art bones alone, the long feathers of each wing (primaries, secondaries, alula)
//                  and of the tail (rectrices) ruffling slowly, the tail fanned as it gathers speed, turns and
//                  brakes
//   hawk.beat      over that by `flap`: the same feathers swept by each beat, their tips bent up by the stroke
//                  down and down by the stroke up
//   hawk.look      always: the neck's two turning joints, the head looking round, and into its turn
//
// Angles are written in degrees, and turn a bone from its rest: `bend` about its across, `swing` about its up,
// `twist` about its length. What each does to the hawk's bones (`up`, `fore`, `pitch` and the rest below):
//   a wing's shoulder   bend lifts the wing; swing sweeps the left wing forward and the right one back; twist
//                       lifts the left wing's leading edge and lowers the right's
//   a wing's elbow      bend swings the forearm forward
//   a wing's wrist      bend folds the hand back
//   primaries.last      bend sweeps the tip back; swing bends the left tip up and the right one down
//   the body            bend tips it forward, swing rolls the side at +x down
//   the tail            bend lifts it, twist rolls it
//   rectrices           bend moves the feather toward -x: `first` out, `last` in
//   body head           bend nods the beak down; `head head`'s twist rolls the head about its beak
//   a hip, a drum       bend swings the leg back; a toe's bend lifts it
// A joint of the kit's written by the kit's own angle (`k`) is bent the other way round: a wing's shoulder
// down, its elbow folding the forearm back, its wrist folding the hand forward, a toe curling.
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

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
// from 0 at `from` of a sense to `d` degrees at `full` of it
const by = (sense, from, full, d) => ({ by: sense, keys: [[from, 0], [full, rad(d)]] })
// `d` degrees at a bank of 1.6 radians to the left, as far the other way to the right
const byBank = d => ({ by: 'bank', keys: [[-1.6, rad(-d)], [1.6, rad(d)]] })
// 0 flying straight to `d` degrees at a bank of 1.6 radians either way
const byTurn = d => ({ by: 'bank', keys: [[-1.6, rad(d)], [0, 0], [1.6, rad(d)]] })
// a kit joint's angle: puppet3d bends the other way round from the kit
const k = list => list.map(c => c.keys ? { ...c, keys: c.keys.map(([x, v]) => [x, v === 0 ? 0 : -v]) } : { ...c, swing: -c.swing })
// a cue the other way round, for the side whose bone turns the other way
const sided = (c, s) => s === 1 ? c : c.keys ? { ...c, keys: c.keys.map(([x, v]) => [x, v === 0 ? 0 : -v]) } : { ...c, swing: -c.swing }
const bone = (bend = still, swing = still, twist = still) => ({ bend, swing, twist })
const sides = (name, f) => ({ [`${P}/left ${name}`]: f(1), [`${P}/right ${name}`]: f(-1) })

// one wing beat: the share of it that is the stroke down, and how many keys a stroke is written in
const DOWN = 0.58, KEYS = 24
// the pitch of the body in flight, degrees
const TIP = 58
// leaving the ground: the `air` the flying pose begins at, and the `air` the wings are open by
const OPEN = [0.15, 0.3]
// from `a` to `b` as `t` goes from 0 to 1, slow at both ends
const eased = (a, b, t) => a + (b - a) * (1 - Math.cos(Math.PI * t)) / 2
// through one beat: `top` at 0, `bottom` at DOWN, `top` again at 1
const stroke = (top, bottom) => p => p < DOWN ? eased(top, bottom, p / DOWN) : eased(bottom, top, (p - DOWN) / (1 - DOWN))
// 1 at `centre` of the beat, falling to 0 `width` of a beat either side
const pulse = (centre, width) => p => { const d = Math.abs(p - centre - Math.round(p - centre)); return d < width ? (1 + Math.cos(Math.PI * d / width)) / 2 : 0 }
// a cue through one beat: `f(p)` degrees at `p` of it
const beat = f => ({ by: 'beat', period: 1, keys: Array.from({ length: KEYS + 1 }, (_, i) => [+(i / KEYS).toFixed(4), rad(f(i / KEYS))]) })
// the body's rise and fall through a beat, -1 at the top of the stroke to 1 at the bottom
const heave = p => -Math.cos(2 * Math.PI * (p < DOWN ? 0.5 * p / DOWN : 0.5 + 0.5 * (p - DOWN) / (1 - DOWN)))
const midUp = DOWN + (1 - DOWN) * 0.55

// the body rolled into its turn by as much as it leans (`bank`, to its left above 0: the side at +x is its
// right once it is turned to face the way it goes), and tipped up or down the way it goes (`climb`)
const BANK = { by: 'bank', keys: [[-1.6, 1.6], [1.6, -1.6]] }
const LEVEL = { by: 'climb', keys: [[-1.6, 1.6], [1.6, -1.6]] }
// the nod of the body with each beat, degrees: its nose up as the stroke down ends
const NOD = 2.5
// how much of the body's roll the head undoes, and how much further than the body the tail rolls
const HEAD = 0.65, TAIL = 0.4
const TOES = { hind: 2, inner: 3, middle: 4, outer: 5 }
const toes = curl => Object.fromEntries(['left', 'right'].flatMap(side => Object.entries(TOES).flatMap(([toe, n]) =>
  Array.from({ length: n }, (_, i) => [`${P}/${side} foot ${toe}.${i}`, bone(k(at(curl)))]))))

// a wing through one beat. `up`: the shoulder's lift at the top and the bottom of the stroke. `fore`: how far
// the wing is swept forward as the stroke down ends, and back on the way up. `pitch`: the leading edge held
// down on the way down and lifted on the way up. `elbow`, `wrist`: the forearm swung forward and the hand
// folded back, spread and at the middle of the stroke up.
const wings = w => ({
  ...sides('wing shoulder', s => bone(
    [beat(stroke(w.up[0], w.up[1]))],
    [sided(beat(p => w.fore[2] + w.fore[0] * pulse(DOWN, 0.4)(p) - w.fore[1] * pulse(midUp + 0.04, 0.25)(p)), s)],
    [sided(beat(p => w.pitch[0] + (w.pitch[1] - w.pitch[0]) * pulse(midUp, 0.26)(p)), s)])),
  ...sides('wing elbow', () => bone([beat(p => w.elbow[0] + (w.elbow[1] - w.elbow[0]) * pulse(midUp, 0.28)(p))])),
  ...sides('wing wrist', () => bone([beat(p => w.wrist[0] + (w.wrist[1] - w.wrist[0]) * pulse(midUp + 0.02, 0.28)(p))])),
})
const FLY = { up: [36, -24], fore: [12, 12, 0], pitch: [-5, 16], elbow: [4, 20], wrist: [6, 58] }
const POWER = { up: [52, -36], fore: [18, 14, 0], pitch: [-8, 22], elbow: [4, 26], wrist: [6, 72] }
const FLARE = { up: [46, -22], fore: [10, 6, 14], pitch: [22, 32], elbow: [4, 18], wrist: [6, 46] }
// the lift the wings are held at in a glide, and where in the stroke down the beating wing passes it: the
// wings are held from there, and beat again from there
const HELD_UP = 9
let HELD = 0
for (let p = 0; p <= DOWN; p += 0.0005) if (Math.abs(stroke(...FLY.up)(p) - HELD_UP) < Math.abs(stroke(...FLY.up)(HELD) - HELD_UP)) HELD = +p.toFixed(4)

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

const spread = {
  ...sides('wing shoulder', () => bone(at(HELD_UP))),
  ...sides('wing elbow', () => bone(at(FLY.elbow[0]))),
  ...sides('wing wrist', () => bone(at(FLY.wrist[0]))),
}

const fly = {
  'kit bones': bone(still, still, at(180)),
  [`${P}/body body`]: bone([...at(TIP), beat(p => -NOD * heave(p)), LEVEL], [BANK]),
  [`${P}/body shoulder.L`]: bone(at(-TIP)),
  [`${P}/body shoulder.R`]: bone(at(-TIP)),
  [`${P}/body head`]: bone([...at(-14), beat(p => NOD * heave(p))]),
  [`${P}/head neck.0`]: bone(k(at(14))),
  [`${P}/head neck.2`]: bone(k(at(14))),
  [`${P}/head head`]: bone(k(at(14)), still, [byBank(HEAD * 1.6 * 180 / Math.PI)]),
  [`${P}/body tail`]: bone([...at(-4), beat(p => 3 * heave(p))], still, [byBank(TAIL * 1.6 * 180 / Math.PI)]),
  [`${P}/body hip.L`]: bone(k(at(-10))),
  [`${P}/body hip.R`]: bone(k(at(-10))),
  [`${P}/body drum.L`]: bone(k(at(-6))),
  [`${P}/body drum.R`]: bone(k(at(-6))),
  ...wings(FLY),
  ...toes(55),
}

const power = wings(POWER)

const glide = {
  [`${P}/body body`]: bone([...at(TIP), LEVEL], [BANK]),
  [`${P}/body head`]: bone(at(-14)),
  [`${P}/body tail`]: bone(at(-4), still, [byBank(TAIL * 1.6 * 180 / Math.PI)]),
  ...sides('wing shoulder', s => bone(
    [...at(HELD_UP), sway(2, 3.7), sided(sway(1.5, 4.3), s)],
    [sided(by('speed', 9, 14, -10), s)],
    [sided(sway(1.2, 2.9, 0.2), s)])),
  ...sides('wing elbow', () => bone([by('speed', 9, 14, 12)])),
  ...sides('wing wrist', () => bone([...at(4), by('speed', 9, 14, 20)])),
}

const tuck = {
  ...sides('wing shoulder', s => bone(at(4), [sided(...at(-32), s)])),
  ...sides('wing elbow', () => bone(at(30))),
  ...sides('wing wrist', () => bone(at(70))),
}

const flare = {
  [`${P}/body body`]: bone(at(TIP - 36), [BANK]),
  [`${P}/body shoulder.L`]: bone(at(36 - TIP)),
  [`${P}/body shoulder.R`]: bone(at(36 - TIP)),
  [`${P}/body head`]: bone(at(-6)),
  [`${P}/head neck.0`]: bone(k(at(4))),
  [`${P}/head neck.2`]: bone(k(at(4))),
  [`${P}/head head`]: bone(k(at(4)), still, [byBank(HEAD * 1.6 * 180 / Math.PI)]),
  [`${P}/body tail`]: bone(at(-22)),
  [`${P}/body hip.L`]: bone(at(-22)),
  [`${P}/body hip.R`]: bone(at(-22)),
  [`${P}/body drum.L`]: bone(at(-14)),
  [`${P}/body drum.R`]: bone(at(-14)),
  ...wings(FLARE),
  ...toes(8),
}

// the art bones: `beating` 1 with the sweep of each wing beat, 0 without
const feathered = beating => ({
  ...sides('wing wrist feathers primaries.first', s => bone(k([sway(3, 2.3, s * 0.1), ...(beating ? [beat(p => 6 * Math.sin(2 * Math.PI * (p - 0.4)))] : [])]))),
  ...sides('wing wrist feathers primaries.last', s => bone(
    k([sway(4, 2.9, s * 0.15), bySpeed(-8, 8), ...(beating ? [beat(p => 9 * Math.sin(2 * Math.PI * (p - 0.45)))] : [])]),
    beating ? [sided(beat(p => 10 * pulse(DOWN * 0.5, 0.3)(p) - 14 * pulse(midUp, 0.22)(p)), s)] : still)),
  ...sides('wing elbow feathers secondaries', s => bone(
    k([sway(3, 3.4, s * 0.2), ...(beating ? [beat(p => 5 * Math.sin(2 * Math.PI * (p - 0.35)))] : [])]),
    beating ? [sided(beat(p => 5 * pulse(DOWN * 0.5, 0.3)(p) - 6 * pulse(midUp, 0.22)(p)), s)] : still)),
  ...sides('wing wrist feathers alula', s => bone(k([sway(7, 1.7, s * 0.25), ...(beating ? [beat(p => 5 * Math.sin(2 * Math.PI * (p - 0.5)))] : [])]))),
  [`${P}/tail feathers rectrices.first`]: bone(k([sway(4, 3.1), bySpeed(-14, 8), by('brake', 0, 1, -24), byTurn(-12)])),
  [`${P}/tail feathers rectrices.last`]: bone(k([sway(4, 3.1), bySpeed(14, 8), by('brake', 0, 1, 24), byTurn(12)])),
})

const look = {
  [`${P}/head neck.1`]: bone([...k([sway(22, 7.3), sway(8, 2.1, 0.3)]), byBank(-30)]),
  [`${P}/head neck.3`]: bone(k([sway(16, 5.9, 0.2)])),
}

const sheets = { perch, spread, fly, power, glide, tuck, flare, feathers: feathered(0), beat: feathered(1), look }
for (const [name, sheet] of Object.entries(sheets)) {
  writeFileSync(new URL(`./assets/cues/hawk.${name}.cues.json`, import.meta.url), JSON.stringify(sheet, null, 2) + '\n')
  console.log(`hawk.${name}: ${Object.keys(sheet).length} bones cued`)
}
// the sheet `glide` took the place of
rmSync(new URL('./assets/cues/hawk.soar.cues.json', import.meta.url), { force: true })

// the hawk's sheet: the numbers of the solver that reads its flight (`plugins/aviary/aviary.puppet3d.ts`)
const aloft = {
  gravity: 9.81, most: 1, steep: 0.6, slow: 4, ease: 0.35,
  air: [0.3, 3], clear: [0.05, 0.5], fold: 0.5, open: OPEN, drop: [2, 5], beat: 0.46, quicken: 0.3, down: DOWN, flaps: 4, held: HELD, longest: 6, settle: 0.2,
  cruise: [[4, 1], [7, 0.75], [10, 0.45], [14, 0.1]], rise: 3.5, gain: 4, shed: 4,
  stoop: { from: 0.12, full: 0.4, speed: [5, 7] }, heave: 0.03,
}
writeFileSync(new URL('./assets/hawk/hawk.json', import.meta.url), JSON.stringify({ aloft }, null, 2) + '\n')

const always = [{ by: 'clock', keys: [[0, 1]] }]
const full =sense => [{ by: sense, keys: [[0, 0], [1, 1]] }]
const driver = (name, weight) => ({ name, cues: `hawk_${name}`, weight })
defs.hawk = {
  senses: {
    clock: 'clock', speed: 'velocity', bank: 'aloftBank', climb: 'aloftClimb', air: 'aloftAir', beat: 'aloftBeat',
    flap: 'aloftFlap', glide: 'aloftGlide', effort: 'aloftEffort', brake: 'aloftBrake', stoop: 'aloftStoop',
  },
  speeds: [0, 7, 10, 14],
  flight: { height: 9, full: 7, climb: 3.5, lift: 6, floor: 1.5, ceiling: 80 },
  layouts: {
    body: {
      layout: 'proNgBird',
      on: 'world',
      skeleton: 'hawkSkeleton',
      skin: 'hawkSkin',
      drivers: [
        driver('perch', always),
        driver('spread', [{ by: 'air', keys: [[0, 0], [OPEN[1], 1]] }]),
        { ...driver('fly', [{ by: 'air', keys: [[OPEN[0], 0], [1, 1]] }]), solver: 'aloft', gait: 'hawkSheet' },
        driver('power', full('effort')),
        driver('glide', full('glide')),
        driver('tuck', full('stoop')),
        driver('flare', full('brake')),
        driver('feathers', always),
        driver('beat', full('flap')),
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
console.log(`hawk written, its wings held at ${HELD} of a beat`)
