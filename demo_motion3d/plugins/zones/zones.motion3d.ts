// zones' mod for motion3d: the activities demo_motion3d's yard offers (`world.motion3d.mods.behaviors:
// ['walker', 'zones']`, with `zones` in `world.shipped.plugins`). Each activity is its motions, the
// clips of the X Bot's rig (`assets/xbot.rig.json`) they play and the points of its space they are
// held to, the hands and feet its `ik` bends onto points, and its logic. What each clip's spot is and
// where it stands from its point is the rig's alone (each clip's `held` and `offsets`). The keys press
// `use` (E) and `jump` (Space); the stick is the `player` row's
// own `stick` [x, forward]. Every limb a motion bends onto a point is bent as its clip bends it
// (motion3d's `asDrawn`).
//   walk     walking on the yard's shapes and land (`zones.sim.ts`'s `stride`), in the place of walker's
//            own `walk`, which walks on the land alone; `jump` sets the body's `jump`.
//   party    offered by `partyzone`: `use` plays `backflip`
//   sad      offered by `sadzone`: `use` plays `pickup`
//   cold     offered by `coldroom`: its `idle`, `coldrub` or `coldlook`, is played over walking's idle
//            while the body stands in it (motion3d's layers)
//   ledge    offered by `ledgezone`, below the wall's lip up to it, its point `Lip` the line along the
//            lip; the wrists land on it:
//              use    `bracedjump`, from the ground up into the hang, ending on the lip; then `hang`
//              hang   `bracedidle`, hanging still
//              move   along the lip the way the stick pushes, until the hands would leave it (`hanging`)
//              climb  `bracedclimb`, `use` with the stick forward while hanging: up onto the wall's top,
//                     then walking
//              drop   `braceddrop`, `use` with the stick back while hanging: down to the ground, ending
//                     on its `Drop` line, then walking
//   bar      offered by `barzone`, under the bar, its `Bar` line where the wrists hold it, and
//   ceiling  offered by `hallzone`, under the slab, its `Ceiling` plane face down where they hold it:
//              use    `freejump`, up into the hang, ending on it; then `hang`
//              hang   `freeidle`, hanging still
//              move   `barmove` and `barleft` along the bar, `freeleft` and `freeright` across the
//                     ceiling, the way the stick pushes, until the hands would leave it
//              drop   `freedrop`, `use` while hanging: down to the ground, ending on its `Drop` line or
//                     plane, then walking
//   rope     offered by `ropezone`: `use` takes hold of the `Rope` line where the wrists hold it,
//            `ropeclimb` playing while the stick is forward and held still while not, up to the top;
//            `use` again lets go, to fall
//   swing    offered by `swingzone`: `use` swings from its `Start` (`ropeswing`) onto the platform
//   climb    offered by `climbzone`, and by `tiltzone` on a wall leaning back, the body leaning onto it
//            (motion3d's Tilt): `use` takes hold of the wall's `Face` plane where the hands and
//            the feet hold it, `wallclimb` up while the stick is forward, `walldown` down while it is
//            back, held still while it is neither, stopping at its top and its foot; `use` again lets go
//   wallrun  offered by `runzone`: `use` runs along the wall's `Wall` plane (`wallside`), the feet kicking
//            off its face, from where the body stands along it, ending in the air off the wall; then
//            `land`, down onto the ground where the run ends the root, still held to the `Wall`,
//            picked up where its hips come down as low as the run ends them, then walking
//   vault    offered by `vaultzone`: `use` vaults the low wall from its `Vault` (`vaultone`)
//   edge     offered by `edgezone`, on the block's top at its front, its `Edge` line where the ankles
//            stand: `use` teeters at it (`teeter`); `use` again steps down off it (`jumpdown`), ending
//            on its `Drop` line on the ground, then walking; the stick back steps away, walking
//   stairs   offered by `stairzone`, at the stairs' foot: `use` climbs the `Flight` (`stairsup`) while
//            the stick is forward, standing while it is not, and walks from the landing at its top
//   pool     offered by `pool`, on the deck at the water's edge: `use` falls in (`poolin`), ending on
//            the `Float` plane; then floating (`tread`), swimming ahead (`swimunder`) while the stick is
//            forward, until the far wall; `use` by the far wall climbs out at its `Lip` (`bracedclimb`)
//            onto the far deck, then walking
//   desk     offered by `deskzone`, by the chair: `use` sits at the desk typing (`typing`), its hips on
//            the `Seat`; `use` again stands at the `Side`, walking
//   bed      offered by `bedzone`, at the bed's foot: `use` lies down (`liedown`) ending on the `Bed`,
//            then lies there (`bedidle`); `use` again gets up at the `Foot`, walking
//   car      offered by `carzone`, at the car's door: `use` gets in (`carin`), ending on the `Seat`; then
//            drives (`drive`), the hands on `WheelL` and `WheelR` (the car takes the stick: `car.sim.ts`);
//            `jump` honks (`honk`); `use` gets out (`carout`), then walking
//   chair    offered by `chairzone`, in front of the chair, its point `Seat` where the hips sit; the hips
//            land on it:
//              use     `sitdown`, ending on the seat; then `seated`
//              seated  `seated`, sitting; `use` stands up
//              stand   `standup`, up from the seat, then walking
// `party`, `sad`, `swing` and `vault` have no logic: motion3d holds the body still while the
// clip plays and hands it back to walking once it has played out.
//
// A body hanging from a lip, a bar or a ceiling has the row's `stuck`: the way the stick pushed when
// the end stopped it, 0 for none; it hangs there until the stick lets go or pushes the other way.
//
// `object(plugins, space)`, the page's (motion3d's `object`, `world.motion3d.mods.object: 'zones'`):
// the frame a space is drawn in this frame, for the one space of the yard that moves, the car's
// (`carzone`): the frame of its car as solids draws the car's first part, its part's own place on its
// row taken off and the space's put on. Undefined for every other space, which stands still where its
// row does, and for a car not drawn yet; solids is listed before motion3d, which checks it.
import type { Object3D } from 'three'
import type { Plugins } from '#engine/browser.ts'
import type { Row, W } from '#engine/engine.ts'
import { animKind, clipOf, ends, numbersOf, rigOf } from '#plugins/anim/anim.sim.ts'
import { asDrawn, type Activity, type Handed, type Motion } from '#plugins/motion3d/motion3d.sim.ts'
import { stride } from './zones.sim.ts'

const hands = (p: string) => ({ LeftHand: p, RightHand: p })
const feet = (p: string) => ({ LeftFoot: p, RightFoot: p })

// One step of a body hanging (`hang`) or moving along what it hangs from (`move`): the clip of `move`'s
// that goes the way the stick pushes across (its measured travel, left or right of the body) until the
// end stops it, hanging still while the stick lets go or the end stops it.
function hanging(me: Row, w: W, handed: Handed, move: Motion) {
  const d = me.data
  const way = Math.sign(d.stick[0])
  const { stopped } = handed.hold()
  if (stopped) d.stuck = way
  if (way !== d.stuck) d.stuck = 0
  if (way === 0 || way === d.stuck) return handed.go('hang')
  const rig = rigOf(w, animKind(me))
  // The stick pushes right for a clip that travels to the body's right, its measured left below 0.
  const clip = move.clips!.find(c => Math.sign(-clipOf(rig, c).measure.left) === way)
  if (!clip) throw new Error(`zones: no clip of ${move.clips!.join(', ')} moves the body ${way > 0 ? 'right' : 'left'}`)
  handed.go('move', clip)
}

// A body hanging from its hands under a bar or a ceiling, held to its point `p`.
function freehang(p: string, across: string[]): Activity {
  const move: Motion = { clips: across, root: p, ik: hands(p) }
  return {
    use: { clips: ['freejump'], root: p, ik: hands(p) },
    hang: { clips: ['freeidle'], root: p, ik: hands(p) },
    move,
    drop: { clips: ['freedrop'], root: 'Drop' },
    pole: asDrawn,
    press(me, _w, motion, handed) {
      if (motion === 'use' && (me.data.motion === 'hang' || me.data.motion === 'move')) handed.go('drop')
      return true
    },
    step(me, w, _dt, handed) {
      const d = me.data
      if (d.motion === 'hang' || d.motion === 'move') return hanging(me, w, handed, move)
      const { ended } = handed.hold()
      if (!ended) return
      if (d.motion === 'use') handed.go('hang')
      else handed.leave()
    },
  }
}

export function object(plugins: Plugins, space: number): Object3D | undefined {
  const zone = plugins.wire.rows.find(r => r.id === space)
  if (zone?.kind !== 'carzone') return undefined
  const car = plugins.wire.rows.find(r => r.id === zone.data.car)
  const part = car && plugins.wire.rows.find(r => r.id === car.data.parts[0])
  const drawn: Object3D | undefined = part && plugins.solids.group(part.id)
  if (!part || !drawn) return undefined
  const T = plugins.render3d.THREE
  const frame = (d: { pos: number[]; yaw: number }) => new T.Matrix4().compose(new T.Vector3(...d.pos), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), d.yaw), new T.Vector3(1, 1, 1))
  drawn.updateWorldMatrix(true, false)
  const p = new T.Vector3(), q = new T.Quaternion()
  drawn.matrixWorld.decompose(p, q, new T.Vector3())
  const out = new T.Object3D()
  new T.Matrix4().compose(p, q, new T.Vector3(1, 1, 1)).multiply(frame(part.data).invert()).multiply(frame(zone.data)).decompose(out.position, out.quaternion, out.scale)
  out.updateMatrixWorld(true)
  return out
}

// How far into `to`, seconds, its hips first come down as low as `from` ends them, by the rig's measures
// (anim's `ends`): where a clip that comes down picks up a body another left in the air, so the body
// goes on down from there and is never lifted back up to where `to` starts. 0 when `to`'s hips start
// that low already.
function pickUp(me: Row, w: W, from: string, to: string): number {
  const kind = animKind(me)
  const rig = rigOf(w, kind)
  const hips = (clip: string, t: number) => ends(w, me, 'torso', { clip, clipT: t })[1]
  const low = hips(from, clipOf(rig, from).dur)
  const c = clipOf(rig, to)
  // anim's measures are taken a frame apart and drawn straight between, so the hips cross `low` straight
  // between the first frame at or under it and the one before.
  const fps: number = rig.ends![numbersOf(w).kinds[kind].model][c.source].fps
  let was = hips(to, 0)
  if (was <= low) return 0
  for (let i = 1; i / fps <= c.dur; i++) {
    const now = hips(to, i / fps)
    if (now <= low) return (i - 1 + (was - low) / (was - now)) / fps
    was = now
  }
  throw new Error(`zones: ${to}'s hips never come down as low as ${from} ends them, ${low.toFixed(3)} m`)
}

// The clip a held loop plays at, playing while `on` and held still while not (anim's row `rate`).
const pace = (me: Row, on: boolean) => { me.data.rate = on ? 1 : 0 }

export const behaviors = (): Record<string, Activity> => {
  const ledgeMove: Motion = { clips: ['bracedleft', 'bracedright'], root: 'Lip', ik: hands('Lip') }
  return {
    walk: {
      step: stride,
      jump: { press: me => { me.data.jump = true } },
    },
    party: { use: { clips: ['backflip'] } },
    sad: { use: { clips: ['pickup'] } },
    cold: { idle: { clips: ['coldrub', 'coldlook'] } },
    ledge: {
      use: { clips: ['bracedjump'], root: 'Lip', ik: hands('Lip') },
      hang: { clips: ['bracedidle'], root: 'Lip', ik: hands('Lip') },
      move: ledgeMove,
      climb: { clips: ['bracedclimb'], root: 'Lip', ik: hands('Lip') },
      drop: { clips: ['braceddrop'], root: 'Drop' },
      pole: asDrawn,
      press(me, _w, motion, handed) {
        const d = me.data
        if (motion === 'use' && (d.motion === 'hang' || d.motion === 'move')) {
          if (d.stick[1] > 0) handed.go('climb')
          else if (d.stick[1] < 0) handed.go('drop')
        }
        return true
      },
      step(me, w, _dt, handed) {
        const d = me.data
        if (d.motion === 'hang' || d.motion === 'move') return hanging(me, w, handed, ledgeMove)
        const { ended } = handed.hold()
        if (!ended) return
        if (d.motion === 'use') handed.go('hang')
        else handed.leave()
      },
    },
    bar: freehang('Bar', ['barmove', 'barleft']),
    ceiling: freehang('Ceiling', ['freeleft', 'freeright']),
    rope: {
      use: { clips: ['ropeclimb'], root: 'Rope', ik: hands('Rope') },
      pole: asDrawn,
      press(_me, _w, motion, handed) {
        if (motion === 'use') handed.leave()
        return true
      },
      step(me, _w, _dt, handed) {
        const { stopped } = handed.hold()
        pace(me, me.data.stick[1] > 0 && !stopped)
      },
    },
    swing: { use: { clips: ['ropeswing'], root: 'Start' } },
    climb: {
      use: { clips: ['wallclimb'], root: 'Face', ik: { ...hands('Face'), ...feet('Face') } },
      down: { clips: ['walldown'], root: 'Face', ik: { ...hands('Face'), ...feet('Face') } },
      pole: asDrawn,
      press(_me, _w, motion, handed) {
        if (motion === 'use') handed.leave()
        return true
      },
      step(me, _w, _dt, handed) {
        const d = me.data
        const way = Math.sign(d.stick[1])
        if (way > 0 && d.motion !== 'use') handed.go('use')
        if (way < 0 && d.motion !== 'down') handed.go('down')
        const { stopped } = handed.hold()
        pace(me, way !== 0 && !stopped)
      },
    },
    wallrun: {
      use: { clips: ['wallside'], root: 'Wall', ik: feet('Wall') },
      land: { clips: ['land'], root: 'Wall' },
      pole: asDrawn,
      step(me, w, _dt, handed) {
        const { ended } = handed.hold()
        if (!ended) return
        if (me.data.motion !== 'use') return handed.leave()
        const ran = me.data.clip
        handed.go('land')
        me.data.clipT = pickUp(me, w, ran, me.data.clip)
      },
    },
    vault: { use: { clips: ['vaultone'], root: 'Vault' } },
    edge: {
      use: { clips: ['teeter'], root: 'Edge', ik: feet('Edge') },
      down: { clips: ['jumpdown'], root: 'Drop' },
      pole: asDrawn,
      press(me, _w, motion, handed) {
        if (motion === 'use' && me.data.motion === 'use') handed.go('down')
        return true
      },
      step(me, _w, _dt, handed) {
        const d = me.data
        const { ended } = handed.hold()
        if (d.motion === 'down') {
          if (ended) handed.leave()
          return
        }
        if (d.stick[1] < 0) handed.leave()
      },
    },
    stairs: {
      use: { clips: ['stairsup'], root: 'Flight' },
      step(me, _w, _dt, handed) {
        // Before the first step is taken, the root at the flight's foot, where the clip's first lap
        // stands its feet on the first step; a lap on, on the next two.
        if (me.data.clipT === 0) me.data.along = 0
        const { stopped } = handed.hold()
        if (stopped) return handed.leave()
        pace(me, me.data.stick[1] > 0)
      },
    },
    pool: {
      use: { clips: ['poolin'], root: 'Float' },
      float: { clips: ['tread'], root: 'Float' },
      swim: { clips: ['swimunder'], root: 'Float' },
      out: { clips: ['bracedclimb'], root: 'Lip', ik: hands('Lip') },
      pole: asDrawn,
      press(me, _w, motion, handed) {
        const d = me.data
        // Out by the far wall: the body's place on the water within a body's length of its far side.
        if (motion === 'use' && (d.motion === 'float' || d.motion === 'swim')) {
          const far = handed.point('Lip').at
          if (Math.abs(far[2] - d.pos[2]) < 1.2) handed.go('out')
        }
        return true
      },
      step(me, _w, _dt, handed) {
        const d = me.data
        if (d.motion === 'float' || d.motion === 'swim') {
          const { stopped } = handed.hold()
          handed.go(d.stick[1] > 0 && !stopped ? 'swim' : 'float')
          return
        }
        const { ended } = handed.hold()
        if (!ended) return
        if (d.motion === 'use') handed.go('float')
        else handed.leave()
      },
    },
    desk: {
      use: { clips: ['typing'], root: 'Seat' },
      press(_me, _w, motion, handed) {
        if (motion === 'use') {
          const { at, yaw } = handed.point('Side')
          handed.leave([...at, yaw])
        }
        return true
      },
      step(_me, _w, _dt, handed) { handed.hold() },
    },
    bed: {
      use: { clips: ['liedown'], root: 'Bed' },
      lie: { clips: ['bedidle'], root: 'Bed' },
      press(me, _w, motion, handed) {
        if (motion === 'use' && me.data.motion === 'lie') {
          const { at, yaw } = handed.point('Foot')
          handed.leave([...at, yaw])
        }
        return true
      },
      step(me, _w, _dt, handed) {
        const { ended } = handed.hold()
        if (ended && me.data.motion === 'use') handed.go('lie')
      },
    },
    car: {
      use: { clips: ['carin'], root: 'Seat' },
      pilot: { clips: ['drive'], root: 'Seat', ik: { LeftHand: 'WheelL', RightHand: 'WheelR' } },
      honk: { clips: ['honk'], root: 'Seat' },
      out: { clips: ['carout'], root: 'Seat' },
      pole: asDrawn,
      press(me, _w, motion, handed) {
        const d = me.data
        if (d.motion === 'pilot' && motion === 'use') handed.go('out')
        if (d.motion === 'pilot' && motion === 'jump') handed.go('honk')
        return true
      },
      step(me, _w, _dt, handed) {
        const { ended } = handed.hold()
        if (!ended) return
        if (me.data.motion === 'out') handed.leave()
        else handed.go('pilot')
      },
    },
    chair: {
      use: { clips: ['sitdown'], root: 'Seat' },
      seated: { clips: ['seated'], root: 'Seat' },
      stand: { clips: ['standup'], root: 'Seat' },
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
  }
}
