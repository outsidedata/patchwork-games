// aviary's solver for puppet3d, `aloft`: a body that flies. It stands no bone: every bone of its layout is
// played by its driver's cue sheet, where the row is, lifted and let down by each wing beat. What it adds is
// what the body's own motion says, read off the row each step and given off as senses for the kind's cues and
// its drivers' weights:
//   aloftBank    radians, how far a body turning this fast at this speed leans into its turn (the angle whose
//                tangent is its speed times its turn a second over `gravity`), to its left above 0, no further
//                than `most` either way;
//   aloftClimb   radians, the way it goes above level (above 0) or below, no further than `steep` either way,
//                reckoned as if it went no slower than `slow` metres a second, so a body settling straight
//                down onto the ground does not stand on its head;
//   aloftAir     0 on the ground to 1 in the air: by its speed over the ground between `air`'s two speeds, or
//                by its height over the land between `clear`'s two heights, whichever says more, going from
//                one to the other in no less than `fold` seconds;
//   aloftBeat    where its wings are in their beat, 0 to 1 and round again: 0 at the top of the stroke, `down`
//                at the bottom. A beat takes `beat` seconds, less by `quicken` of itself at full effort;
//   aloftFlap    0 to 1, how much its wings are beating, and
//   aloftGlide   0 to 1, how much they are held still: the two add up to how far its wings are out, 0 to 1 as
//                aloftAir goes between `open`'s two values. It beats `flaps` whole beats,
//                then holds its wings at `held` of a beat and glides, the longer the less it needs to beat, no
//                longer than `longest` seconds, going between the two over `settle` seconds. What it needs is
//                `cruise`'s value at its speed (keys of [metres a second, need], 1 beating without a break, 0
//                gliding), more as it rises, gathers speed or brakes, less as it sinks;
//   aloftEffort  0 to 1, how hard it works: its rise over `rise` metres a second and its gain in speed over
//                `gain` metres a second squared;
//   aloftBrake   0 to 1, how hard it slows: the speed it loses over `shed` metres a second squared, or how fast
//                it sinks over `rise` while it goes slower over the ground than `drop`'s two speeds, whichever
//                says more;
//   aloftStoop   0 to 1, how far into a dive it is: its way below level between `stoop.from` and `stoop.full`
//                radians, by its speed between `stoop.speed`'s two, and less the harder it brakes.
// Effort, brake and stoop are each no more than its wings are out. Bank, climb, effort and brake follow the row
// over `ease` seconds, so a turn begun or a dive pulled out of leans in and out. Each beat lifts the body
// `heave` metres at the bottom of the stroke and lets it down as far at the top, twice as far at full effort
// and not at all while it glides. Its block of the body's sheet, `aloft`: `{ gravity, most, steep, slow, ease,
// air, clear, fold, open, drop, beat, quicken, down, flaps, held, longest, settle, cruise, rise, gain, shed,
// stoop { from, full, speed }, heave }`.
import type { Bone, Ridden, Solver } from '#plugins/puppet3d/puppet3d.plugin.ts'
import { placed } from '#plugins/puppet3d/puppet3d.plugin.ts'

type Block = {
  gravity: number; most: number; steep: number; slow: number; ease: number
  air: [number, number]; clear: [number, number]; fold: number; open: [number, number]; drop: [number, number]; beat: number; quicken: number; down: number; flaps: number; held: number; longest: number; settle: number
  cruise: [number, number][]; rise: number; gain: number; shed: number
  stoop: { from: number; full: number; speed: [number, number] }; heave: number
}
// `speed` over the ground and `gain`, its change a second, eased; `phase` of the beat; `left`, the beats left
// of this run of them while `beating`, and `glided`, the seconds its wings have been held since; `wings`, 1
// beating to 0 held
type Flying = {
  at: Ridden; bank: number; climb: number; speed: number; gain: number; air: number; out: number
  phase: number; beating: boolean; left: number; glided: number; wings: number
  effort: number; brake: number; stoop: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const between = (v: number, [lo, hi]: [number, number]) => clamp((v - lo) / (hi - lo), 0, 1)
// the value of `keys` at `at`, held past either end
function keyed(keys: [number, number][], at: number): number {
  if (at <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) if (at <= keys[i][0]) return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * (at - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])
  return keys[keys.length - 1][1]
}
// how far through its rise and fall the body is at `phase` of the beat: 0 at the top of the stroke, a half at
// the bottom, `down` of a beat later
const stroke = (phase: number, down: number) => phase < down ? 0.5 * phase / down : 0.5 + 0.5 * (phase - down) / (1 - down)

const aloft: Solver<Block, Flying> = {
  block: 'aloft',
  make(b, at, land) {
    const speed = Math.hypot(at.vel[0], at.vel[2]), air = Math.max(between(speed, b.air), between(at.pos[1] - land(at.pos[0], at.pos[2]), b.clear))
    return {
      at: { pos: [...at.pos], yaw: at.yaw, vel: [...at.vel] }, bank: 0, climb: 0, speed, gain: 0, air, out: between(air, b.open),
      phase: b.held, beating: true, left: b.flaps, glided: 0, wings: 1, effort: 0, brake: 0, stoop: 0,
    }
  },
  step(b, s, at, dt, land) {
    const speed = Math.hypot(at.vel[0], at.vel[2]), turn = wrap(at.yaw - s.at.yaw) / dt
    const bank = clamp(Math.atan(speed * turn / b.gravity), -b.most, b.most)
    const climb = clamp(Math.atan2(at.vel[1], Math.max(speed, b.slow)), -b.steep, b.steep)
    const k = 1 - Math.exp(-dt / b.ease)
    s.bank += (bank - s.bank) * k
    s.climb += (climb - s.climb) * k
    s.gain += ((speed - s.speed) / dt - s.gain) * k
    s.speed = speed
    const air = Math.max(between(speed, b.air), between(at.pos[1] - land(at.pos[0], at.pos[2]), b.clear))
    s.air += clamp(air - s.air, -dt / b.fold, dt / b.fold)
    const rising = clamp(at.vel[1] / b.rise, -1, 1), gaining = clamp(s.gain / b.gain, 0, 1)
    // slowing, or letting itself down with little speed over the ground
    const braking = Math.max(clamp(-s.gain / b.shed, 0, 1), clamp(-rising, 0, 1) * (1 - between(speed, b.drop)))
    s.out = between(s.air, b.open)
    s.effort += (clamp(rising + gaining, 0, 1) - s.effort) * k
    s.brake += (braking - s.brake) * k
    s.stoop = clamp((-s.climb - b.stoop.from) / (b.stoop.full - b.stoop.from), 0, 1) * between(speed, b.stoop.speed) * (1 - s.brake)
    // its wings: a run of whole beats, then held, the longer the less it needs to beat
    const need = clamp(keyed(b.cruise, speed) + rising + gaining + 2 * braking, 0, 1)
    if (s.beating) {
      const beats = (1 + b.quicken * s.effort) / b.beat * dt
      s.phase += beats
      s.left -= beats
      if (s.left <= 0) {
        // the run ends where the wings are held; a body that must go on beating beats one more
        if (need < 1) { s.beating = false; s.glided = 0; s.phase = b.held } else s.left += 1
      }
      s.phase -= Math.floor(s.phase)
    } else {
      s.glided += dt
      const run = b.flaps * b.beat
      if (s.glided >= (need > 0 ? Math.min(b.longest, run * (1 - need) / need) : b.longest)) { s.beating = true; s.left = b.flaps }
    }
    s.wings += ((s.beating ? 1 : 0) - s.wings) * (1 - Math.exp(-dt / b.settle))
    s.at = { pos: [...at.pos], yaw: at.yaw, vel: [...at.vel] }
  },
  senses(s) {
    return {
      aloftBank: s.bank, aloftClimb: s.climb, aloftAir: s.air, aloftBeat: s.phase, aloftFlap: s.out * s.wings, aloftGlide: s.out * (1 - s.wings),
      aloftEffort: s.out * s.effort, aloftBrake: s.out * s.brake, aloftStoop: s.out * s.stoop,
    }
  },
  bones(b, s, _layout, rest: Bone[], play) {
    const lift = -Math.cos(2 * Math.PI * stroke(s.phase, b.down)) * b.heave * s.out * s.wings * (1 + s.effort)
    return placed(play(rest), [s.at.pos[0], s.at.pos[1] + lift, s.at.pos[2]], s.at.yaw)
  },
}

export function behaviors(): Record<string, Solver> {
  return { aloft }
}
