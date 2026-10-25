// zones' mod for motion3d: the activities demo_motion3d's yard offers (`world.motion3d.mods.behaviors:
// ['walker', 'zones']`, with `zones` in `world.shipped.plugins`). Each activity is its motions, the
// clips of the X Bot's rig (`assets/xbot.rig.json`) they play and the points of its space they are
// held to, and its logic. The keys press `use` (E) and `jump` (Space); the stick is the `player` row's
// own `stick` [x, forward].
//   walk    walking on the yard's shapes and land (`zones.sim.ts`'s `stride`), in the place of walker's
//           own `walk`, which walks on the land alone; `jump` sets the body's `jump`.
//   party   offered by `partyzone`: `use` plays `backflip`
//   sad     offered by `sadzone`: `use` plays `pickup`
//   ledge   offered by `ledgezone`, below the wall's lip up to it, its point `Lip` the line along the
//           lip; the wrists land on it:
//             use    `bracedjump`, from the ground up into the hang, ending on the lip; then `hang`
//             hang   `bracedidle`, hanging still
//             move   `bracedleft` with the stick left, `bracedright` with it right, along the lip until
//                    the hands would leave it; with the stick let go, `hang`
//             climb  `bracedclimb`, `use` with the stick forward while hanging: up onto the wall's top,
//                    then walking
//             drop   `braceddrop`, `use` with the stick back while hanging: down to the ground, then
//                    walking
//           Its row's `stuck` is the way the stick pushed when the lip's end stopped it, 0 for none: the
//           body hangs there until the stick lets go or pushes the other way.
//   chair   offered by `chairzone`, in front of the chair, its point `Seat` where the hips sit; the hips
//           land on it:
//             use     `sitdown`, ending on the seat; then `seated`
//             seated  `seated`, sitting; `use` stands up
//             stand   `standup`, up from the seat, then walking
// `party` and `sad` have no logic: motion3d holds the body still while the clip plays and hands it back to
// walking once it has played out.
import type { Activity } from '#plugins/motion3d/motion3d.sim.ts'
import { stride } from './zones.sim.ts'

const LIP = { LeftHand: 'Lip', RightHand: 'Lip' }
const SEAT = { Hips: 'Seat' }

export const behaviors = (): Record<string, Activity> => ({
  walk: {
    step: stride,
    jump: { press: me => { me.data.jump = true } },
  },
  party: { use: { clips: ['backflip'] } },
  sad: { use: { clips: ['pickup'] } },
  ledge: {
    use: { clips: ['bracedjump'], root: 'Lip', travel: 'to', ik: LIP },
    hang: { clips: ['bracedidle'], root: 'Lip', ik: LIP },
    move: { clips: ['bracedleft', 'bracedright'], root: 'Lip', ik: LIP },
    climb: { clips: ['bracedclimb'], root: 'Lip', travel: 'from', ik: LIP },
    drop: { clips: ['braceddrop'], root: 'Lip', travel: 'from', ik: LIP },
    press(me, _w, motion, handed) {
      const d = me.data
      if (motion === 'use' && (d.motion === 'hang' || d.motion === 'move')) {
        if (d.stick[1] > 0) handed.go('climb')
        else if (d.stick[1] < 0) handed.go('drop')
      }
      return true
    },
    step(me, _w, _dt, handed) {
      const d = me.data
      const { ended, stopped } = handed.hold()
      if (ended) {
        if (d.motion === 'use') handed.go('hang')
        else handed.leave()
        return
      }
      if (d.motion !== 'hang' && d.motion !== 'move') return
      const way = Math.sign(d.stick[0])
      if (stopped) d.stuck = way
      if (way !== d.stuck) d.stuck = 0
      if (way === 0 || way === d.stuck) handed.go('hang')
      else handed.go('move', way > 0 ? 'bracedright' : 'bracedleft')
    },
  },
  chair: {
    use: { clips: ['sitdown'], root: 'Seat', travel: 'to', ik: SEAT },
    seated: { clips: ['seated'], root: 'Seat', ik: SEAT },
    stand: { clips: ['standup'], root: 'Seat', travel: 'from', ik: SEAT },
    press(me, _w, motion, handed) {
      if (motion === 'use' && me.data.motion === 'seated') handed.go('stand')
      return true
    },
    step(me, _w, _dt, handed) {
      const { ended } = handed.hold()
      if (!ended) return
      if (me.data.motion === 'use') handed.go('seated')
      else handed.leave()
    },
  },
})
