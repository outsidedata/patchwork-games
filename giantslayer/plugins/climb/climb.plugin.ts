// The browser half of climb: the hands and feet of a body holding a net reach the points they touch,
// through ik3d. It has no row and no numbers of its own: what it reads is the holder's row and its
// kind's definition, `climb`. It is listed after anim, which poses the holder in its tick, and before
// ik3d, which bends the limbs this hands it (`climb.ik3d.ts`, the `limbs` mod) in its own.
//
// Each frame, for each row holding a net (climb's `NetHold`), each limb its definition's `climb.ik`
// names (one of `climb.limbs`, `{ bones, touch, skin, across, side, bend, group, out }`: the three
// bones ik3d bends, the last the hand or the foot; `touch`, two bone suffixes whose places mixed by half
// are where it touches, the middle of a hand or the ball of a foot to its toe tip; `skin`, metres, how
// far its skin is past that middle toward what it touches; `group`, the limbs that step together, the
// diagonals) wants a point of the held row's net. A limb reaches a point when its end bone, placed for
// it, is no further from its first bone than its two bones' lengths less ik3d's millimetre, nor than the
// most angle of its `bend` spans, and no nearer than the least spans. How long it could hold a point is
// how long it would go on reaching it with `climb.step.slack` metres of room to spare if his body went
// on as his hold is going over the surface, its first bone carried along: the first of
// `climb.step.ahead` seconds, looked at in eighths, at which it would not, or all of them. Of the points
// out to `climb.near` links from the one nearest where it touches as its clip puts it this frame
// (ik3d's `unbend` first takes off last frame's reach), facing within `climb.bend` of the surface where
// he holds (so a hand by a wall's edge stays on its face), it wants the one it could hold longest, and of
// those even, the nearest where its clip puts it. A planted limb holds its point as long as it reaches it
// at all.
//   A limb with `across` and `side` is a hand, laid flat on the surface there: turned the shortest way
// that takes the way its palm faces (`side` times the cross of the line across its knuckles, `across`,
// two bone suffixes, and the line from its first `touch` bone to its second) onto the way into the
// surface. A foot keeps the turn its clip gives it. Either is moved, so turned, so where it touches is
// on that point and its `skin` out along the way out of the surface there. Its middle joint bends the
// way its clip bends it but out from the surface: the pole ik3d is handed is where the clip has the
// elbow or knee, off the line from the limb's first bone to its target, turned so at least its `out`
// share points out of the surface where he holds (both square to that line), the rest kept along the
// surface as the clip has it (a knee the clip bends toward the wall swings out to the side, and an
// elbow stands off the wall, lifting the forearm off it), in the body's frame. Its `bend`, the least and
// most angle at its elbow or knee (degrees, 180 straight), is ik3d's limit for it.
//
// Planted and stepping. Each limb's touch is the point it is planted on: it holds that point while the
// body moves. The point it wants is the one above, and the time it has left on its own is how long it
// could hold it (as above). A limb is behind when it has less than two steps' time (`climb.step.time`)
// left, so it can wait out the other group's step and take its own, and the point it wants would hold
// longer; or, his hold standing still, when the point it wants is more than `climb.step.far` metres from
// its own. A group steps together, each of its limbs whose wanted point is not its own, when one of them
// is behind and no group is stepping; when both groups are behind, the one whose limb has least time
// left goes, and when even, the one that did not step last. A limb that can no longer reach its point
// steps at once, out of turn if another group is stepping (`forced`). A step goes from where its end bone was as the last
// reach left it (kept as how far that was from where its point puts it, `off`, so it begins where the
// limb really was though it fell short) to the point it wants over `climb.step.time` seconds, its end
// bone eased in and out between the two, lifted off
// the surface by `climb.step.lift` metres at the middle (sin of the way through), and turned between the
// two flat turns. A limb that can neither reach its point nor step lets go of it, and is drawn as its
// clip draws it. Time is the steps the rows have gone on since the last frame, each the scene's step, so
// a page reaches the same however fast it draws. Letting go of the net forgets every touch.
//
// `limbs(row)` is a row's limbs this frame, `{ bones, pole, target, bend }` each, or undefined for a row
// that holds no net. `touches(row)` is its touches by limb, `{ point, step, room }` (`step` `{ from, to,
// s, forced }`, `forced` when it began out of turn because it could no longer reach; `room`, how much
// more the limb could stretch to its point this frame, metres, under 0 out of reach; `left`, planted,
// how long it can still hold it, seconds), or undefined.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Handed } from '#plugins/ik3d/ik3d.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { linked, nearestOn, netOf, onNet, spotOn } from './climb.sim.ts'

type Limb = { bones: [string, string, string]; touch: [string, string]; skin: number; across?: [string, string]; side?: number; bend: number[]; group: number; out: number }
// A limb's touch: the point it is planted on, and the step it is in, from one point to another, `s` 0
// to 1 of the way.
export type Touch = { point: number; step?: { from: number; to: number; s: number; forced: boolean; off?: number[] }; room?: number; left?: number }

export function climb() {
  // Each holder's limbs this frame, by row id.
  const reaching = new Map<number, Handed[]>()
  const targets = new Map<string, THREE.Object3D>()
  // Each holder's touches, by row id and limb, the step of the rows it last reached by, and the group
  // that stepped last.
  const touching = new Map<number, { n: number; touches: Map<string, Touch>; last: number; spot?: THREE.Vector3; going?: THREE.Vector3 }>()

  // The first bone under `root` whose name ends with `suffix`.
  function bone(root: THREE.Object3D, suffix: string): THREE.Object3D {
    let found: THREE.Object3D | undefined
    root.traverse(o => { if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o })
    if (!found) throw new Error(`climb: the holder's model has no bone ending ${suffix}`)
    return found
  }

  return {
    tick(plugins: Plugins) {
      const T = plugins.render3d.THREE as typeof THREE
      reaching.clear()
      for (const r of plugins.wire.rows) {
        const hold = r.data.hold
        if (!hold || !onNet(hold)) {
          touching.delete(r.id)
          continue
        }
        const root: THREE.Object3D | undefined = plugins.anim.model(r.id)
        const held = plugins.wire.rows.find(o => o.id === hold.on)
        if (!root || !held) continue
        const k = def(plugins.wire, r.kind).climb
        // The time since it last reached: the steps the rows have gone on since, each the scene's step.
        let mine = touching.get(r.id)
        if (!mine) touching.set(r.id, (mine = { n: plugins.wire.n, touches: new Map(), last: -1 }))
        const dt = (plugins.wire.n - mine.n) * plugins.wire.scene.prefabs.engine.dt
        mine.n = plugins.wire.n
        const touches = mine.touches
        const limbsOf = k.limbs as Record<string, Limb>
        // Where each end bone is as last frame's reach left it, before that is taken off: a step begins
        // from there.
        root.updateMatrixWorld(true)
        const reached = new Map((k.ik as string[]).map(name => [name, new T.Vector3().setFromMatrixPosition(bone(root, limbsOf[name].bones[2]).matrixWorld)]))
        // The body as its clip draws it this frame, not as last frame's reach left it.
        plugins.ik3d.unbend(r.id)
        const net = netOf(plugins.wire, held)
        const [x, y, z] = held.data.pos, c = Math.cos(held.data.yaw), s = Math.sin(held.data.yaw)
        const place = (i: number) => {
          const p = net.at.subarray(i * 3, i * 3 + 3)
          return [x + p[0] * c + p[2] * s, y + p[1], z - p[0] * s + p[2] * c]
        }
        const face = (i: number) => {
          const o = net.out.subarray(i * 3, i * 3 + 3)
          return new T.Vector3(o[0] * c + o[2] * s, o[1], -o[0] * s + o[2] * c)
        }
        root.updateMatrixWorld(true)
        const at = (o: THREE.Object3D) => new T.Vector3().setFromMatrixPosition(o.matrixWorld)
        // The way out of the surface where he holds, which the points his limbs reach must face near.
        const here = spotOn(plugins.wire, held, hold)
        const facing = new T.Vector3(...here.out)
        // How fast his hold goes over the surface, metres a second, from where it was when the rows last
        // moved on; still when they have not.
        const spot = new T.Vector3(...here.at)
        if (dt > 0) {
          mine.going = mine.spot ? spot.clone().sub(mine.spot).divideScalar(dt) : new T.Vector3()
          mine.spot = spot
        }
        const going = mine.going ?? new T.Vector3()
        // Each limb as its clip has it this frame: where its end bone goes for a point, how much more it
        // could stretch to one, whether it can reach one, and the point it wants.
        const reach = new Map<string, { limb: Limb; first: THREE.Object3D; middle: THREE.Object3D; end: THREE.Object3D; from: THREE.Vector3; goalOf: (i: number) => THREE.Vector3; flat: (i: number) => THREE.Quaternion; slack: (i: number) => number; ok: (i: number) => boolean; wants: number; holds: (i: number) => number }>()
        for (const name of k.ik as string[]) {
          const limb = limbsOf[name]
          const [first, middle, end] = limb.bones.map(b => bone(root, b))
          const [a, b] = limb.touch.map(t => at(bone(root, t)))
          const wrist = at(end), mid = a.clone().add(b).multiplyScalar(0.5)
          const from = at(first)
          // A hand turned the shortest way that lays its palm onto the surface at point `i`: its palm
          // faces `side` times the cross of the line across its knuckles and the line through its touch.
          const palmFaces = limb.across && at(bone(root, limb.across[1])).sub(at(bone(root, limb.across[0]))).cross(b.clone().sub(a)).normalize().multiplyScalar(limb.side!)
          const flat = (i: number) => (palmFaces ? new T.Quaternion().setFromUnitVectors(palmFaces, face(i).negate()) : new T.Quaternion())
          // Where the end bone goes for point `i`: where it touches on it, its skin out, so turned.
          const goalOf = (i: number) => new T.Vector3(...place(i)).addScaledVector(face(i), limb.skin).add(wrist.clone().sub(mid).applyQuaternion(flat(i)))
          // How far and how near the limb reaches, as ik3d cuts it: no further than a millimetre short of
          // its two bones' lengths, nor than its `bend`'s most angle spans, and no nearer than its least.
          const l1 = from.distanceTo(at(middle)), l2 = at(middle).distanceTo(wrist)
          const spanAt = (deg: number) => Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((deg * Math.PI) / 180)))
          const most = Math.min(l1 + l2 - 1e-3, spanAt(limb.bend[1])), least = Math.max(Math.abs(l1 - l2) + 1e-4, spanAt(limb.bend[0]))
          // How much more the limb could stretch to point `i`: under 0 it cannot reach it.
          const slack = (i: number) => {
            const d = goalOf(i).distanceTo(from)
            return Math.min(most - d, d - least)
          }
          const ok = (i: number) => face(i).dot(facing) >= k.bend && slack(i) >= 0
          // How long the limb could hold point `i` if the body went on as his hold is going: the first of
          // `step.ahead` seconds, looked at in eighths, at which its first bone, carried along, is out of
          // reach of it by `step.slack`; all of them while it stays in reach.
          const holds = (i: number) => {
            const goal = goalOf(i)
            for (let n = 0; n <= 8; n++) {
              const d = goal.distanceTo(from.clone().addScaledVector(going, (k.step.ahead * n) / 8))
              if (Math.min(most - d, d - least) < k.step.slack) return (k.step.ahead * n) / 8
            }
            return k.step.ahead
          }
          // The point it wants: of the points out to `climb.near` links from the one nearest its middle,
          // facing near where he holds, the one it could hold longest; even, the nearest its middle.
          const nearest = nearestOn(net, place, mid.toArray(), hold.a)
          let wants = -1, best = 0, far = Infinity
          let ring = [nearest]
          const seen = new Set(ring)
          for (let n = 0; n <= k.near && ring.length; n++) {
            for (const o of ring) {
              if (face(o).dot(facing) < k.bend) continue
              const h = holds(o), d = new T.Vector3(...place(o)).distanceTo(mid)
              if (h > best || (h === best && h > 0 && d < far)) { best = h; far = d; wants = o }
            }
            ring = ring.flatMap(p => [...linked(net, p)]).filter(o => !seen.has(o) && (seen.add(o), true))
          }
          reach.set(name, { limb, first, middle, end, from, goalOf, flat, slack, ok, wants, holds })
          // A limb that touches nothing yet plants on the point it wants.
          if (!touches.has(name) && wants >= 0) touches.set(name, { point: wants })
        }
        // The steps going on, on by the time since; one that is through lands on its point.
        for (const t of touches.values()) {
          if (!t.step) continue
          t.step.s += dt / k.step.time
          if (t.step.s >= 1) {
            t.point = t.step.to
            t.step = undefined
          }
        }
        // Which limbs would step, and which must: one that can no longer reach its point steps at once;
        // one whose wanted point is `step.far` from its own, or with less than two steps' time left, is
        // behind, and its group steps when no other group is stepping, the group whose limb has least time
        // left first when both are behind, the one that did not step last when even. A group steps
        // together: each of its limbs whose wanted point is not its own.
        const free = (name: string) => {
          const t = touches.get(name), r = reach.get(name)
          return !!t && !!r && !t.step && r.wants >= 0 && r.wants !== t.point
        }
        const lost = (name: string) => free(name) && !reach.get(name)!.ok(touches.get(name)!.point)
        // How long a planted limb can still hold its point, the body going on as it goes.
        const left = new Map([...reach.keys()].filter(n => touches.has(n) && !touches.get(n)!.step).map(n => [n, reach.get(n)!.holds(touches.get(n)!.point)]))
        const behind = (name: string) => {
          if (!free(name)) return false
          const { wants, holds } = reach.get(name)!, point = touches.get(name)!.point
          // Far from where the clip has it, standing still; or short of time to wait out a step and take
          // its own, while a point it wants would hold longer.
          const still = going.lengthSq() === 0
          return (still && new T.Vector3(...place(point)).distanceTo(new T.Vector3(...place(wants))) > k.step.far) || (left.get(name)! < 2 * k.step.time && holds(wants) > left.get(name)!)
        }
        const groupOf = (name: string) => limbsOf[name].group
        const steppingGroups = new Set([...touches].filter(([, t]) => t.step).map(([name]) => groupOf(name)))
        // A step begins where its end bone is, kept as how far that is from where its point puts it, so
        // it begins where the limb really was even when it had fallen short of its point.
        const begin = (name: string, forced: boolean) => {
          const t = touches.get(name)!
          const off = reached.get(name)!.clone().sub(reach.get(name)!.goalOf(t.point)).toArray()
          t.step = { from: t.point, to: reach.get(name)!.wants, s: 0, forced, off }
        }
        for (const name of reach.keys()) if (lost(name)) begin(name, [...steppingGroups].some(g => g !== groupOf(name)))
        if (!steppingGroups.size) {
          // Of the groups with a limb behind, the one whose limb has least time left; even, the one that
          // did not step last.
          const timeOf = (g: number) => Math.min(...[...reach.keys()].filter(n => groupOf(n) === g && free(n)).map(n => left.get(n) ?? Infinity))
          const wanting = [...new Set([...reach.keys()].filter(behind).map(groupOf))]
          wanting.sort((x, y) => timeOf(x) - timeOf(y) || (x === mine!.last ? 1 : y === mine!.last ? -1 : 0))
          const group = wanting[0]
          if (group !== undefined) {
            for (const name of reach.keys()) if (groupOf(name) === group && free(name)) begin(name, false)
            mine.last = group
          }
        }
        // A limb that can neither reach its point nor step lets go of it.
        for (const [name, t] of [...touches]) if (!t.step && !reach.get(name)?.ok(t.point)) touches.delete(name)
        for (const [name, t] of touches) {
          t.room = reach.get(name)?.slack(t.point)
          t.left = left.get(name)
        }
        const limbs: Handed[] = []
        for (const [name, { limb, middle, end, from, goalOf, flat }] of reach) {
          const t = touches.get(name)
          if (!t) continue
          // Its end bone: on its point, or on the way between two, eased in and out and lifted off the
          // surface by `step.lift` at the middle; turned flat to the surface it is over.
          const key = `${r.id} ${name}`
          let target = targets.get(key)
          if (!target) targets.set(key, (target = new T.Object3D()))
          end.matrixWorld.decompose(new T.Vector3(), target.quaternion, new T.Vector3())
          if (t.step) {
            const e = t.step.s * t.step.s * (3 - 2 * t.step.s)
            const lift = face(t.step.from).lerp(face(t.step.to), e).normalize().multiplyScalar(k.step.lift * Math.sin(Math.PI * t.step.s))
            const begun = goalOf(t.step.from).add(new T.Vector3(...(t.step.off ?? [0, 0, 0])))
            target.position.copy(begun.lerp(goalOf(t.step.to), e).add(lift))
            target.quaternion.premultiply(flat(t.step.from).slerp(flat(t.step.to), e))
          } else {
            target.position.copy(goalOf(t.point))
            target.quaternion.premultiply(flat(t.point))
          }
          target.updateMatrixWorld(true)
          const goal = target.position.clone()
          // The bend: where the clip has the middle joint, off the line from the first bone to the target,
          // never into the surface: what of it points into the surface is taken off.
          const line = goal.clone().sub(from).normalize()
          const off = at(middle).sub(from)
          off.sub(line.clone().multiplyScalar(off.dot(line)))
          // The way out of the surface square to the line too, so taking it off keeps the bend square
          // to the line, as ik3d squares it.
          const across = facing.clone().sub(line.clone().multiplyScalar(facing.dot(line)))
          if (across.lengthSq() > 1e-12) {
            // At least its `out` share of the bend points out of the surface: the rest is kept as the
            // clip has it, along the surface.
            const a = across.normalize(), size = off.length(), outward = off.dot(a)
            if (size > 1e-9 && outward < limb.out * size) {
              const along = off.clone().sub(a.clone().multiplyScalar(outward))
              const keep = along.lengthSq() > 1e-18 ? along.normalize().multiplyScalar(size * Math.sqrt(1 - limb.out * limb.out)) : new T.Vector3()
              off.copy(keep.add(a.multiplyScalar(size * limb.out)))
            }
          }
          const pole = off.applyQuaternion(root.getWorldQuaternion(new T.Quaternion()).invert()).normalize()
          limbs.push({ bones: limb.bones, pole: pole.toArray(), target, bend: limb.bend })
        }
        reaching.set(r.id, limbs)
      }
    },
    limbs(row: Row): Handed[] | undefined {
      return reaching.get(row.id)
    },
    touches(row: Row): Map<string, Touch> | undefined {
      return touching.get(row.id)?.touches
    },
    close() {
      reaching.clear()
      targets.clear()
      touching.clear()
    },
  }
}
