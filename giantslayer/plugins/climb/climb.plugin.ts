// The browser half of climb: the hands and feet of a body holding a net reach the points they touch,
// through ik3d. It has no row and no numbers of its own: what it reads is the holder's row and its
// kind's definition, `climb`. It is listed after anim, which poses the holder in its tick, and before
// ik3d, which bends the limbs this hands it (`climb.ik3d.ts`, the `limbs` mod) in its own.
//
// Each frame, for each row holding a net (climb's `NetHold`) where it held it last frame, each limb its
// definition's `climb.ik` names
// (one of `climb.limbs`, `{ bones, end, tip }`: the three bones ik3d bends, and the suffixes of the end
// bone and of the bone at its tip, whose places mixed by half are the middle of the hand or foot) reaches:
// the point of the held row's net nearest the middle of that hand or foot as its clip puts it this
// frame (ik3d's `unbend` first takes off last frame's reach), if that point faces within `climb.bend`
// of the surface where he holds (so a hand by a wall's edge stays on its face) and the limb reaches it
// (its end bone, placed for it, within its two bones' lengths of its first bone, less ik3d's
// millimetre); failing that, the nearest to the middle of the points that do, out to `climb.near`
// links from it; failing those, the limb is drawn as its clip draws it. The hand
// or foot moved, as it is turned, so its middle is on that point and `climb.palm` metres out along the
// way out of the surface there. Its middle joint bends the way its clip bends it: the pole ik3d is
// handed is where the clip has the elbow or knee, off the line from the limb's first bone to its target,
// in the body's frame.
//
// A hold that moved since last frame reaches with nothing: the body is drawn as its clip draws it while
// it climbs.
//
// `limbs(row)` is a row's limbs this frame, `{ bones, pole, target }` each, or undefined for a row that
// holds no net or whose hold moved.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Handed } from '#plugins/ik3d/ik3d.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { linked, nearestOn, netOf, onNet, spotOn } from './climb.sim.ts'

type Limb = { bones: [string, string, string]; end: string; tip: string }

export function climb() {
  // Each holder's limbs this frame, by row id.
  const reaching = new Map<number, Handed[]>()
  const targets = new Map<string, THREE.Object3D>()
  // Each holder's hold as it was last frame, to tell a hold that moved.
  const was = new Map<number, string>()

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
          was.delete(r.id)
          continue
        }
        // Only a hold that stays where it was last frame reaches; one moving over the net is drawn as
        // its clip draws it.
        const now = `${hold.on} ${hold.a} ${hold.b} ${hold.t}`
        const still = was.get(r.id) === now
        was.set(r.id, now)
        if (!still) continue
        const root: THREE.Object3D | undefined = plugins.anim.model(r.id)
        const held = plugins.wire.rows.find(o => o.id === hold.on)
        if (!root || !held) continue
        const k = def(plugins.wire, r.kind).climb
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
        const facing = new T.Vector3(...spotOn(plugins.wire, held, hold).out)
        const limbs: Handed[] = []
        for (const name of k.ik as string[]) {
          const limb = (k.limbs as Record<string, Limb>)[name]
          const [first, middle] = limb.bones.map(b => bone(root, b))
          const end = bone(root, limb.end), tip = bone(root, limb.tip)
          const wrist = at(end), mid = wrist.clone().add(at(tip)).multiplyScalar(0.5)
          const from = at(first)
          // Where the end bone goes for point `i`: the middle on it a palm out, as the hand is turned.
          const goalOf = (i: number) => new T.Vector3(...place(i)).addScaledVector(face(i), k.palm).add(wrist.clone().sub(mid))
          // How far the limb reaches, as ik3d cuts it: a millimetre short of its two bones' lengths.
          const span = from.distanceTo(at(middle)) + at(middle).distanceTo(wrist) - 1e-3
          const ok = (i: number) => face(i).dot(facing) >= k.bend && goalOf(i).distanceTo(from) <= span
          // The point nearest its middle; failing it, the nearest of those it can reach that face near
          // where he holds, out to `climb.near` links from it.
          const nearest = nearestOn(net, place, mid.toArray(), hold.a)
          let point = ok(nearest) ? nearest : -1
          if (point < 0) {
            let ring = [nearest], far = Infinity
            const seen = new Set(ring)
            for (let n = 0; n < k.near && ring.length; n++) {
              ring = ring.flatMap(p => [...linked(net, p)]).filter(o => !seen.has(o) && (seen.add(o), true))
              for (const o of ring) {
                const d = new T.Vector3(...place(o)).distanceTo(mid)
                if (ok(o) && d < far) { far = d; point = o }
              }
            }
          }
          if (point < 0) continue
          const goal = goalOf(point)
          const key = `${r.id} ${name}`
          let target = targets.get(key)
          if (!target) targets.set(key, (target = new T.Object3D()))
          target.position.copy(goal)
          end.matrixWorld.decompose(new T.Vector3(), target.quaternion, new T.Vector3())
          target.updateMatrixWorld(true)
          // The bend: where the clip has the middle joint, off the line from the first bone to the target.
          const line = goal.clone().sub(from).normalize()
          const off = at(middle).sub(from)
          off.sub(line.clone().multiplyScalar(off.dot(line)))
          const pole = off.applyQuaternion(root.getWorldQuaternion(new T.Quaternion()).invert()).normalize()
          limbs.push({ bones: limb.bones, pole: pole.toArray(), target })
        }
        reaching.set(r.id, limbs)
      }
    },
    limbs(row: Row): Handed[] | undefined {
      return reaching.get(row.id)
    },
    close() {
      reaching.clear()
      targets.clear()
      was.clear()
    },
  }
}
