// aviary's solver for puppet3d, `aloft`: a body that flies. It stands no bone: every bone of its layout is
// played by its driver's cue sheet, where the row is. What it adds is what the body's own motion says, read off
// the row each step and given off as senses for those cues:
//   aloftBank    radians, how far a body turning this fast at this speed leans into its turn (the angle whose
//                tangent is its speed times its turn a second over `gravity`), to its left above 0, no further
//                than `most` either way;
//   aloftClimb   radians, the way it goes above level (above 0) or below, no further than `steep` either way,
//                reckoned as if it went no slower than `slow` metres a second, so a body settling straight
//                down onto the ground does not stand on its head.
// Each follows the row over `ease` seconds, so a turn begun or a dive pulled out of leans in and out. Its block
// of the body's sheet, `aloft`: `{ gravity, most, steep, slow, ease }`.
import type { Bone, Ridden, Solver } from '#plugins/puppet3d/puppet3d.plugin.ts'
import { placed } from '#plugins/puppet3d/puppet3d.plugin.ts'

type Block = { gravity: number; most: number; steep: number; slow: number; ease: number }
type Flying = { at: Ridden; bank: number; climb: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

const aloft: Solver<Block, Flying> = {
  block: 'aloft',
  make(_b, at) {
    return { at: { pos: [...at.pos], yaw: at.yaw, vel: [...at.vel] }, bank: 0, climb: 0 }
  },
  step(b, s, at, dt) {
    const speed = Math.hypot(at.vel[0], at.vel[2]), turn = wrap(at.yaw - s.at.yaw) / dt
    const bank = clamp(Math.atan(speed * turn / b.gravity), -b.most, b.most)
    const climb = clamp(Math.atan2(at.vel[1], Math.max(speed, b.slow)), -b.steep, b.steep)
    const k = 1 - Math.exp(-dt / b.ease)
    s.bank += (bank - s.bank) * k
    s.climb += (climb - s.climb) * k
    s.at = { pos: [...at.pos], yaw: at.yaw, vel: [...at.vel] }
  },
  senses(s) {
    return { aloftBank: s.bank, aloftClimb: s.climb }
  },
  bones(_b, s, _layout, rest: Bone[], play) {
    return placed(play(rest), s.at.pos, s.at.yaw)
  },
}

export function behaviors(): Record<string, Solver> {
  return { aloft }
}
