// The browser half of climb: the hands and feet of a body holding a net reach the points they touch,
// through ik3d. It has no row and no numbers of its own: what it reads is the holder's row and its
// kind's definition, `climb`. It is listed after anim, which poses the holder in its tick, and before
// ik3d, which bends the limbs this hands it (`climb.ik3d.ts`, the `limbs` mod) in its own.
//
// Each frame, for each row holding a net (climb's `NetHold`), its body is turned by its row's `lean`
// (`{ up, ahead }`, framed on the surface by the rules) in place of the yaw anim turned it by; and each
// limb its definition's `climb.ik`
// names (one of `climb.limbs`, `{ bones, touch, skin, across, side, bend, group, out }`: the three
// bones ik3d bends, the last the hand or the foot; `touch`, two bone suffixes whose places mixed by half
// are where it touches, the middle of a hand or the ball of a foot to its toe tip; `skin`, metres, how
// far its skin is past that middle toward what it touches; `group`, the limbs that step together, the
// diagonals) wants a point of the held row's net. A limb reaches a point when its end bone, placed for
// it, is no further from its first bone than its two bones' lengths less ik3d's millimetre, nor than the
// most angle of its `bend` spans, and no nearer than the least spans. How long it could hold a point is
// how long it would go on reaching it with `climb.step.slack` metres of room to spare if its first bone
// went on as his body carries it (as his body itself moved and turned when the rows last moved on, not as
// his clip moves it inside his body, and over the surface: what the held row moved it by, carrying him
// with it, is not counted): the first of `climb.step.ahead` seconds, looked at in eighths, at which it would not, or all of
// them. It could step from one point to another when its end bone would be within reach the whole way of
// its first bone carried along so (folding with `climb.step.slack` to spare at the middle of the step,
// none at its ends), looked at in sixteenths of the step as a step goes, unrested, and where the step's
// straight way comes nearest its first bone.
// Of the points out to `climb.near` links from the one nearest where it touches as its clip puts it this
// frame (ik3d's `unbend` first takes off last frame's reach), of the surface he holds (those reached from
// his hold's point over links he goes over, climb's `crosses`: each turning within `climb.bend`, or
// folding in toward him as an inside corner does; no further from his hold than a limb
// reaches from its first bone: so a hand by a wall's edge stays on its face, and a foot on a ball goes
// round it), not planted on or stepped to by another limb, and that it could step to from the point it
// is planted on or stepping to, it wants the one
// it could hold longest, and of those even, the nearest where its clip puts it. A planted limb holds its
// point as long as it reaches it at all.
//   A limb with `across` and `side` is a hand, laid flat on the surface there: turned the shortest way
// that takes the way its palm faces (`side` times the cross of the line across its knuckles, `across`,
// two bone suffixes, and the line from its first `touch` bone to its second) onto the way into the
// surface. A foot keeps the turn its clip gives it against the surface: turned as the surface turns
// from where he holds to its point. Either is moved, so turned, so where it touches is on that point and
// its `skin` out along the way out of the surface there; that is where it is reckoned to go when points
// are weighed. Where it is put, planted or landing a step, it is then moved along that way out until
// the nearest of its skin rests on the surface: its skin, the model's vertices bound most to its end
// bone or a bone under it, as the clip poses them, read again only when one of those bones has moved
// against the end bone; the surface, the net's triangles round that point and the points it links to
// (climb's `outOf`). Its middle joint bends the
// way its clip bends it but out from the surface: the pole ik3d is handed is where the clip has the
// elbow or knee, off the line from the limb's first bone to its target, turned so at least its `out`
// share points out of the surface where he holds (both square to that line), the rest kept along the
// surface as the clip has it (a knee the clip bends toward the wall swings out to the side, and an
// elbow stands off the wall, lifting the forearm off it), in the body's frame; and swung round the line
// from its first bone to its target, the least way, a twenty-fourth of a turn at a time, until the skin
// of its two bones keeps out of the surface (the vertices bound most to each, moved as the swing turns
// the bone the shortest way onto its new line; each out by at least how far the nearest of eight places
// down its bone is out (climb's `nearNet`) less how far it is from that place, and where that does not
// show it out, read off the net's field, climb's `fromNet`), so a knee by an inside corner bends away from
// the other wall; if no way does, the way that comes nearest. Its `bend`, the least and
// most angle at its elbow or knee (degrees, 180 straight), is ik3d's limit for it.
//
// Planted and stepping. Each limb's touch is the point it is planted on: it holds that point while the
// body moves. A limb first plants once the clip he holds by has faded in to full (anim's `blend` on his
// row), so it plants where that pose has it and not where the fade from his last clip has it. The point it wants is the one above, and the time it has left on its own is how long it
// could hold it (as above). A limb is behind when it has less than two steps' time (`climb.step.time`)
// left, so it can wait out the other group's step and take its own, and the point it wants would hold
// longer; or, his hold standing still, when the point it wants is more than `climb.step.far` metres from
// its own. A group steps together, each of its limbs whose wanted point is not its own, when one of them
// is behind and no group is stepping; when both groups are behind, the one whose limb has least time
// left goes, and when even, the one that did not step last. (His hold standing still is still on the
// surface: a shape that moves carries it and him.) A limb that can no longer reach its point
// steps at once, out of turn if another group is stepping (`forced`). A step goes from its point to the
// point it wants over `climb.step.time` seconds, eased in and out: its end bone on the straight way
// between where the two put it, then resting on the surface under that (as a planted one rests, read
// round the point of the net nearest where it touches there, moved along the way out between the two
// points' ways out), so it follows the surface over a curve; lifted off it along that way by
// `climb.step.lift` metres at the middle (sin of the way through), or the most of that which keeps it
// within the limb's reach (over a ball's top the way out points at his body), or if none does the lift
// that comes nearest; turned between the two turns; and
// off that by as far as its end bone was from it where last frame drew it (`off`; its place in his body as
// the last reach bent it, carried back by how his body has moved since, and on with the held row as it
// has moved since), fading out as it goes,
// so it begins where the limb really was though it fell short. A limb that can neither reach its point nor step lets go of it, and is drawn as its
// clip draws it. Time is the steps the rows have gone on since the last frame, each the scene's step, so
// a page reaches the same however fast it draws. Letting go of the net forgets every touch.
//
// The look of a shape to climb, which each such kind's look hands its row: `show(row, plugins)` draws
// it, the first time, as the mesh of its definition (climb's `meshOf`) in its definition's `colour`,
// casting and taking shadows, a mesh named after its kind, with its net (`netOn` of that mesh) over it,
// a line for each link, named `<kind> net`, in front of everything; and each time, puts it at its row's
// `pos`, tipped back by its `pitch` and turned by its `yaw`, its net shown while its definition's
// `shown` is true; a kind that bends (its definition's `bends`) drawn, mesh and net, bent as its row's
// `bend` bends it (climb's `bent`). `hide(id, plugins)` takes the shape of row `id` away.
//
// `limbs(row)` is a row's limbs this frame, `{ bones, pole, target, bend }` each, or undefined for a row
// that holds no net. `touches(row)` is its touches by limb, `{ point, step, room, left, clear }` (`step`
// `{ from, to, s, forced }`, `forced` when it began out of turn because it could no longer reach; `room`,
// how much more the limb could stretch to where its end bone is put this frame, or fold, the less,
// metres, under 0 out of reach; `left`, planted, how long it can still hold it, seconds; `clear`, how far
// the skin of its two bones keeps out of the surface as it is bent this frame, metres, under 0 in it),
// or undefined.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Handed } from '#plugins/ik3d/ik3d.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { bent, crosses, FIELD, fromNet, fromRest, heldLocal, heldPoint, heldWay, linked, meshOf, nearestOn, nearNet, netOf, netOn, onNet, outOf, placedOf, restOf, spotOn, type Placed } from './climb.sim.ts'

type Limb = { bones: [string, string, string]; touch: [string, string]; skin: number; across?: [string, string]; side?: number; bend: number[]; group: number; out: number }
// A limb's touch: the point it is planted on, and the step it is in, from one point to another, `s` 0
// to 1 of the way.
export type Touch = { point: number; step?: { from: number; to: number; s: number; forced: boolean; off?: number[] }; room?: number; left?: number; clear?: number }

// Metres: skin this near the surface, in or out, touches it (the skin by a wrist or an ankle lies on the
// surface with the hand or foot that rests there).
const TOUCH = 5e-4

export function climb() {
  // Each holder's limbs this frame, by row id.
  const reaching = new Map<number, Handed[]>()
  const targets = new Map<string, THREE.Object3D>()
  // Each holder's touches, by row id and limb, the step of the rows it last reached by, and the group
  // that stepped last; where its hold was in the held row's own frame (`spot`), how fast it went over
  // it (`going`); its body when the rows last moved on and where the held row stood then (`body`,
  // `then`), and how its body moved over the step before (`moved`, over `span` seconds, from where the
  // held row stood at its start, `was`).
  const touching = new Map<number, { n: number; touches: Map<string, Touch>; last: number; spot?: number[]; going?: THREE.Vector3; body?: THREE.Matrix4; then?: Placed; moved?: THREE.Matrix4; was?: Placed; span?: number }>()
  // Each holder's model's skin by limb: the vertices of its skinned meshes bound most to the limb's end
  // bone or a bone under it, found once a model.
  const skins = new WeakMap<THREE.Object3D, Map<string, { mesh: THREE.SkinnedMesh; i: number }[]>>()
  // Each shape drawn, by row id: its mesh, its net's lines over it, and for one that bends, where each
  // corner of each is at rest and the bend they were last posed at.
  const drawn = new Map<number, { mesh: THREE.Mesh; lines: THREE.LineSegments; rest: number[]; ends: number[]; bend: number }>()
  const undraw = (plugins: Plugins, id: number) => {
    const d = drawn.get(id)
    if (!d) return
    plugins.render3d.scene.remove(d.mesh)
    d.mesh.geometry.dispose()
    ;(d.mesh.material as THREE.Material).dispose()
    d.lines.geometry.dispose()
    ;(d.lines.material as THREE.Material).dispose()
    drawn.delete(id)
  }

  // The first bone under `root` whose name ends with `suffix`.
  function bone(root: THREE.Object3D, suffix: string): THREE.Object3D {
    let found: THREE.Object3D | undefined
    root.traverse(o => { if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o })
    if (!found) throw new Error(`climb: the holder's model has no bone ending ${suffix}`)
    return found
  }

  // A holder's skin by limb (`skins`), found the first time its model is seen: each vertex goes to the
  // limb whose end bone, or a bone under it, it is bound to most.
  function skinOf(root: THREE.Object3D, k: { ik: string[]; limbs: Record<string, Limb> }) {
    let found = skins.get(root)
    if (found) return found
    const limbOf = new Map<string, string>()
    for (const name of k.ik) bone(root, k.limbs[name].bones[2]).traverse(o => { if ((o as THREE.Bone).isBone) limbOf.set(o.name, name) })
    const made = new Map(k.ik.map(name => [name, [] as { mesh: THREE.SkinnedMesh; i: number }[]]))
    root.traverse(o => {
      const mesh = o as THREE.SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight')
      for (let i = 0; i < si.count; i++) {
        let most = 0
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, most)) most = j
        const name = limbOf.get(mesh.skeleton.bones[si.getComponent(i, most)].name)
        if (name) made.get(name)!.push({ mesh, i })
      }
    })
    skins.set(root, made)
    return made
  }
  // A holder's limbs' bone skin, found the first time its model is seen: for each limb, the vertices bound
  // most to its first bone (side 0) and to its middle bone (side 1).
  const boneSkins = new WeakMap<THREE.Object3D, Map<string, { mesh: THREE.SkinnedMesh; i: number; side: 0 | 1 }[]>>()
  function boneSkinOf(root: THREE.Object3D, k: { ik: string[]; limbs: Record<string, Limb> }) {
    let found = boneSkins.get(root)
    if (found) return found
    const of = new Map<string, { name: string; side: 0 | 1 }>()
    for (const name of k.ik) {
      const [first, middle] = k.limbs[name].bones.map(b => bone(root, b))
      of.set(first.name, { name, side: 0 })
      of.set(middle.name, { name, side: 1 })
    }
    const made = new Map(k.ik.map(name => [name, [] as { mesh: THREE.SkinnedMesh; i: number; side: 0 | 1 }[]]))
    root.traverse(o => {
      const mesh = o as THREE.SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight')
      for (let i = 0; i < si.count; i++) {
        let most = 0
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, most)) most = j
        const seg = of.get(mesh.skeleton.bones[si.getComponent(i, most)].name)
        if (seg) made.get(seg.name)!.push({ mesh, i, side: seg.side })
      }
    })
    boneSkins.set(root, made)
    return made
  }
  // A limb's bone skin as its clip poses it this frame: for each side (its first bone, its middle bone),
  // every vertex where it is (`at`, three numbers each) and which eighth along its bone it lies (`eighth`,
  // from the bone's start to the next joint). Each is kept in its own bone's frame, with its eighth, and
  // read again only when one of the bones it hangs on (the first bone's parent, the limb's three bones)
  // has moved or turned against its parent (the skeleton's top bone: turned).
  type Side = { local: Float64Array; eighth: Uint8Array; at: Float64Array }
  const boneKept = new WeakMap<THREE.Object3D, Map<string, { under: number[]; sides: Side[] }>>()
  function boneSkinNow(T: typeof THREE, root: THREE.Object3D, k: { ik: string[]; limbs: Record<string, Limb> }, name: string): Side[] {
    const [first, middle, end] = k.limbs[name].bones.map(b => bone(root, b))
    const hangs = [first.parent ?? first, first, middle, end]
    // The first bone's parent, when it is the skeleton's top bone (a leg's hips), by its turn and size only:
    // moved, it carries every bone, and so every vertex, the same way, which leaves each where it was in its
    // own bone's frame.
    const top = !(hangs[0].parent as THREE.Bone | null)?.isBone
    const under = hangs.flatMap((o, i) => [...(i || !top ? o.position.toArray() : []), ...o.quaternion.toArray(), ...o.scale.toArray()])
    let mine = boneKept.get(root)
    if (!mine) boneKept.set(root, (mine = new Map()))
    let was = mine.get(name)
    if (!was || was.under.length !== under.length || !was.under.every((x, i) => x === under[i])) {
      const into = [first.matrixWorld.clone().invert(), middle.matrixWorld.clone().invert()]
      const ends = [first, middle, end].map(o => new T.Vector3().setFromMatrixPosition(o.matrixWorld))
      const all = boneSkinOf(root, k).get(name)!
      const v = new T.Vector3()
      const sides = ([0, 1] as const).map(side => {
        const a = ends[side], ab = ends[side + 1].clone().sub(a)
        const mineOf = all.filter(x => x.side === side)
        const local = new Float64Array(mineOf.length * 3), eighth = new Uint8Array(mineOf.length)
        mineOf.forEach(({ mesh, i }, n) => {
          mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
          eighth[n] = Math.min(7, Math.max(0, Math.floor((v.clone().sub(a).dot(ab) / ab.lengthSq()) * 8)))
          v.applyMatrix4(into[side])
          local[n * 3] = v.x; local[n * 3 + 1] = v.y; local[n * 3 + 2] = v.z
        })
        return { local, eighth, at: new Float64Array(local.length) }
      })
      mine.set(name, (was = { under, sides }))
    }
    // Where each is this frame: its bone's matrix on its place in that bone's frame.
    ;[first, middle].forEach((o, side) => {
      const e = o.matrixWorld.elements, { local, at } = was!.sides[side]
      for (let n = 0; n < local.length; n += 3) {
        const x = local[n], y = local[n + 1], z = local[n + 2]
        at[n] = e[0] * x + e[4] * y + e[8] * z + e[12]
        at[n + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]
        at[n + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
      }
    })
    return was.sides
  }
  // A limb's skin in its end bone's frame this frame, and what it was read under: every local place,
  // turn and size of the end bone and the bones under it, which are all it hangs on (it is read again
  // only when one of them has changed).
  const kept = new WeakMap<THREE.Object3D, Map<string, { under: number[]; skin: THREE.Vector3[] }>>()
  function skinNow(T: typeof THREE, root: THREE.Object3D, k: { ik: string[]; limbs: Record<string, Limb> }, name: string, end: THREE.Object3D, endAt: THREE.Matrix4) {
    const under: number[] = []
    end.traverse(o => { if ((o as THREE.Bone).isBone) under.push(...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()) })
    let mine = kept.get(root)
    if (!mine) kept.set(root, (mine = new Map()))
    const was = mine.get(name)
    if (was && was.under.length === under.length && was.under.every((x, i) => x === under[i])) return was.skin
    const local = endAt.clone().invert()
    const skin = skinOf(root, k).get(name)!.map(({ mesh, i }) => mesh.getVertexPosition(i, new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(local))
    mine.set(name, { under, skin })
    return skin
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
        // His body framed on the surface: turned by the row's `lean` in place of the yaw anim turned it by.
        const lean = r.data.lean as { up: number[]; ahead: number[] } | null
        if (lean) {
          const up = new T.Vector3(...lean.up), ahead = new T.Vector3(...lean.ahead)
          root.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().crossVectors(up, ahead), up, ahead))
        }
        // A place in the world as the held row stood at `then`, carried on with it to where it stands now
        // (the same place on it, at rest, posed as it is bent now), so what moves with a moving shape is not
        // taken for moving over it.
        const shape = def(plugins.wire, held.kind)
        const carried = (p: THREE.Vector3, then?: Placed) => (then ? new T.Vector3(...fromRest(shape, held, restOf(shape, then, p.toArray()))) : p)
        // Where each end bone was drawn last frame, as last frame's reach left it: its place in his body
        // as that reach bends it, carried back by how his body has moved since, and on with the held row
        // as it has moved since. A step begins from there.
        root.updateMatrixWorld(true)
        const back = mine.body && dt > 0 ? mine.body.clone().multiply(root.matrixWorld.clone().invert()) : new T.Matrix4()
        const reached = new Map((k.ik as string[]).map(name => [name, carried(new T.Vector3().setFromMatrixPosition(bone(root, limbsOf[name].bones[2]).matrixWorld).applyMatrix4(back), dt > 0 ? mine.then : undefined)]))
        // The body as its clip draws it this frame, not as last frame's reach left it.
        plugins.ik3d.unbend(r.id)
        const net = netOf(plugins.wire, held)
        const place = (i: number) => heldPoint(held, [...net.at.subarray(i * 3, i * 3 + 3)])
        const faced = (i: number) => heldWay(held, [...net.out.subarray(i * 3, i * 3 + 3)])
        const face = (i: number) => new T.Vector3(...faced(i))
        root.updateMatrixWorld(true)
        const at = (o: THREE.Object3D) => new T.Vector3().setFromMatrixPosition(o.matrixWorld)
        // The way out of the surface where he holds, which his elbows and knees bend out along.
        const here = spotOn(plugins.wire, held, hold)
        const facing = new T.Vector3(...here.out)
        // How fast his hold goes over the surface, metres a second, from where it was on it when the rows
        // last moved on (in the held row's own frame at rest, so a shape that moves or bends does not move
        // it); still when they have not.
        const spot = new T.Vector3(...here.at)
        if (dt > 0) {
          const rest = restOf(shape, held, here.at)
          mine.going = mine.spot ? spot.clone().sub(new T.Vector3(...fromRest(shape, held, mine.spot))).divideScalar(dt) : new T.Vector3()
          mine.spot = rest
        }
        const going = mine.going ?? new T.Vector3()
        // How his body itself moved and turned since the rows last moved on: what takes a place held in
        // it now back to where that place was then (not what his clip does inside it), then from where
        // the held row stood (`was`); and where the held row stands now, for the next.
        if (dt > 0) {
          const body = root.matrixWorld.clone()
          mine.moved = mine.body ? mine.body.clone().multiply(body.clone().invert()) : new T.Matrix4()
          mine.was = mine.then
          mine.span = dt
          mine.body = body
          mine.then = placedOf(held)
        }
        const moved = mine.moved ?? new T.Matrix4()
        // The points of the surface he holds: from his hold's point, over links he goes over (`crosses`:
        // so a wall's sharp outside edge ends them, and a ball's round and an inside corner do not), out as far as
        // any limb could reach from its first bone.
        const out = Math.max(...(k.ik as string[]).map(name => {
          const [first, middle, end] = limbsOf[name].bones.map(b => at(bone(root, b)))
          return first.distanceTo(spot) + first.distanceTo(middle) + middle.distanceTo(end) + limbsOf[name].skin
        }))
        const on = new Set([hold.a])
        for (const queue = [hold.a]; queue.length; ) {
          const p = queue.pop()!
          for (const o of linked(net, p)) {
            if (on.has(o) || !crosses(place, faced, p, o, k.bend) || new T.Vector3(...place(o)).distanceTo(spot) > out) continue
            on.add(o)
            queue.push(o)
          }
        }
        // Each limb as its clip has it this frame: where its end bone goes for a point, how much more it
        // could stretch to one, whether it can reach one, and the point it wants.
        type Along = (p: number, q: number, e: number) => THREE.Vector3
        const reach = new Map<string, { limb: Limb; first: THREE.Object3D; middle: THREE.Object3D; end: THREE.Object3D; from: THREE.Vector3; goalOf: (i: number) => THREE.Vector3; turnAt: (p: number, q: number, e: number) => THREE.Quaternion; outAt: Along; pathAt: Along; spare: (goal: THREE.Vector3) => number; slack: (i: number) => number; ok: (i: number) => boolean; wants: number; holds: (i: number) => number; l1: number; l2: number; most: number; least: number }>()
        for (const name of k.ik as string[]) {
          const limb = limbsOf[name]
          const [first, middle, end] = limb.bones.map(b => bone(root, b))
          const [a, b] = limb.touch.map(t => at(bone(root, t)))
          const wrist = at(end), mid = a.clone().add(b).multiplyScalar(0.5)
          const from = at(first)
          // A hand turned the shortest way that lays its palm onto the surface at point `i`: its palm
          // faces `side` times the cross of the line across its knuckles and the line through its touch.
          const palmFaces = limb.across && at(bone(root, limb.across[1])).sub(at(bone(root, limb.across[0]))).cross(b.clone().sub(a)).normalize().multiplyScalar(limb.side!)
          // A foot keeps the turn its clip gives it against the surface: turned as the surface turns from
          // where he holds to point `i`.
          const flat = (i: number) => new T.Quaternion().setFromUnitVectors(palmFaces || facing, palmFaces ? face(i).negate() : face(i))
          // Where the end bone goes for point `i`: where it touches on it, its skin out, so turned.
          const goalOf = (i: number) => new T.Vector3(...place(i)).addScaledVector(face(i), limb.skin).add(wrist.clone().sub(mid).applyQuaternion(flat(i)))
          // Its skin, each vertex in its end bone's frame as the clip poses it this frame, and where the end
          // bone goes to rest on point `i`, turned `turn`: from `goal`, moved along the way out there until
          // the nearest of its skin is on the surface (read off the triangles round that point and the
          // points it links to).
          const endAt = end.matrixWorld.clone()
          const skin = skinNow(T, root, k, name, end, endAt)
          const scale = new T.Vector3().setFromMatrixScale(endAt)
          const rests = (i: number, goal: THREE.Vector3, turn: THREE.Quaternion, o = face(i)) => {
            const back = turn.clone().invert()
            // Each vertex read along a way where it is in the end bone's frame: the way turned into that
            // frame and sized by the bone's, from where the end bone stands.
            const dots = (ways: number[][]) => ways.map(w => {
              const way = new T.Vector3(...w), along = way.clone().applyQuaternion(back).multiply(scale), base = goal.dot(way)
              const out = new Float64Array(skin.length)
              for (let n = 0; n < skin.length; n++) out[n] = base + skin[n].x * along.x + skin[n].y * along.y + skin[n].z * along.z
              return out
            })
            const gap = outOf(net, place, { length: skin.length, dots }, o.toArray(), i, 1)
            return gap === undefined ? goal : goal.clone().addScaledVector(o, -gap)
          }
          // A step `e` of the way (eased) from point `p` to point `q`: its end bone turned between the two
          // turns of the clip's, and the way out of the surface between the two ways out there; and where
          // its end bone rests on the surface under the straight way between where each point puts it,
          // read round the point of the net nearest where it touches there, moved along that way out. So
          // a step follows the surface, over a ball's curve too, and lands resting on its point.
          const clipTurn = new T.Quaternion()
          endAt.decompose(new T.Vector3(), clipTurn, new T.Vector3())
          const turnAt = (p: number, q: number, e: number) => clipTurn.clone().premultiply(flat(p).slerp(flat(q), e))
          const outAt = (p: number, q: number, e: number) => face(p).lerp(face(q), e).normalize()
          const pathAt = (p: number, q: number, e: number) => {
            const touch = new T.Vector3(...place(p)).lerp(new T.Vector3(...place(q)), e)
            const near = nearestOn(net, place, touch.toArray(), e < 0.5 ? p : q)
            return rests(near, goalOf(p).lerp(goalOf(q), e), turnAt(p, q, e), outAt(p, q, e))
          }
          // How far and how near the limb reaches, as ik3d cuts it: no further than a millimetre short of
          // its two bones' lengths, nor than its `bend`'s most angle spans, and no nearer than its least.
          const l1 = from.distanceTo(at(middle)), l2 = at(middle).distanceTo(wrist)
          const spanAt = (deg: number) => Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((deg * Math.PI) / 180)))
          const most = Math.min(l1 + l2 - 1e-3, spanAt(limb.bend[1])), least = Math.max(Math.abs(l1 - l2) + 1e-4, spanAt(limb.bend[0]))
          // How much more the limb could stretch, or fold, to put its end bone at `goal`, the less of the
          // two: under 0 it cannot reach it. And to point `i`.
          const spare = (goal: THREE.Vector3, root = from) => {
            const d = goal.distanceTo(root)
            return Math.min(most - d, d - least)
          }
          const slack = (i: number) => spare(goalOf(i))
          const ok = (i: number) => on.has(i) && slack(i) >= 0
          // How fast its first bone goes over the surface as his body moves and turns, metres a second: from
          // where his body's last move had it (carried on with the held row as it moved over that step) to
          // where it is now, over the time between the rows' last two steps.
          const rootGoing = mine.span ? from.clone().sub(carried(from.clone().applyMatrix4(moved), mine.was)).divideScalar(mine.span) : new T.Vector3()
          // How long the limb could hold point `i` if its first bone went on as it is going: the first of
          // `step.ahead` seconds, looked at in eighths, at which its first bone, carried along, is out of
          // reach of it by `step.slack`; all of them while it stays in reach.
          const holds = (i: number) => {
            const goal = goalOf(i)
            for (let n = 0; n <= 8; n++) {
              const d = goal.distanceTo(from.clone().addScaledVector(rootGoing, (k.step.ahead * n) / 8))
              if (Math.min(most - d, d - least) < k.step.slack) return (k.step.ahead * n) / 8
            }
            return k.step.ahead
          }
          // Whether it could step from point `p` to point `q`: its end bone within reach the whole way of its
          // first bone, carried along as his body is going, looked at in sixteenths of the step and where
          // the straight way between the two comes nearest its first bone (where folding bites hardest),
          // each on that way (eased) and lifted as a step lifts it. (The point it steps to must hold for a
          // while to be wanted at all, which is room to spare there; the point it leaves may have next to
          // none, which is why it steps.)
          const steps = (p: number, q: number) => {
            const a = goalOf(p), b = goalOf(q), ab = b.clone().sub(a)
            const at = (s: number) => {
              const e = s * s * (3 - 2 * s)
              const goal = a.clone().addScaledVector(ab, e).addScaledVector(outAt(p, q, e), k.step.lift * Math.sin(Math.PI * s))
              const d = goal.distanceTo(from.clone().addScaledVector(rootGoing, s * k.step.time))
              // Reaching no further than it can, and folding no nearer with `step.slack` to spare at the
              // middle of the step, none at its ends (resting by its skin as it goes moves it a little
              // along the way out, which over a ball's top is toward his body).
              return d <= most && d - least >= k.step.slack * Math.sin(Math.PI * s)
            }
            for (let n = 1; n < 16; n++) if (!at(n / 16)) return false
            // The way of the step (eased) nearest its first bone, and how far through the step that is.
            const near = Math.max(0, Math.min(1, from.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)))
            let lo = 0, hi = 1
            for (let n = 0; n < 30; n++) {
              const mid = (lo + hi) / 2
              if (mid * mid * (3 - 2 * mid) < near) lo = mid
              else hi = mid
            }
            return at(lo)
          }
          // The point it wants: of the points out to `climb.near` links from the one of the surface he holds
          // nearest its middle, those of that surface it could step to from where it is planted (or is
          // stepping to), the one it could hold longest; even, the nearest its middle. Where none would hold
          // at all (none with `step.slack` to spare now, as over the dips of a bumpy surface, which his arms
          // only just reach into), the one in reach with the most room now.
          const was = touches.get(name), base = was && (was.step ? was.step.to : was.point)
          // The points the other limbs are planted on or stepping to are theirs.
          const taken = new Set([...touches].filter(([n]) => n !== name).flatMap(([, x]) => (x.step ? [x.point, x.step.to] : [x.point])))
          const nearest = nearestOn(net, place, mid.toArray(), hold.a, o => on.has(o))
          let wants = -1, best = 0, far = Infinity, room = 0
          let ring = [nearest]
          const seen = new Set(ring)
          for (let n = 0; n <= k.near && ring.length; n++) {
            for (const o of ring) {
              if (!on.has(o) || taken.has(o)) continue
              const h = holds(o), d = new T.Vector3(...place(o)).distanceTo(mid), r = h > 0 ? 0 : slack(o)
              if (!(h > best || (h === best && (h > 0 ? d < far : r >= room && (wants < 0 || r > room))))) continue
              if (base !== undefined && o !== base && !steps(base, o)) continue
              best = h; far = d; room = r; wants = o
            }
            ring = ring.flatMap(p => [...linked(net, p)]).filter(o => !seen.has(o) && (seen.add(o), true))
          }
          reach.set(name, { limb, first, middle, end, from, goalOf, turnAt, outAt, pathAt, spare, slack, ok, wants, holds, l1, l2, most, least })
          // A limb that touches nothing yet plants on the point it wants, once his clip has faded in to
          // full (anim's `blend`), so it plants where his pose holds it and not where the fade has it.
          if (!touches.has(name) && wants >= 0 && r.data.blend >= 1) touches.set(name, { point: wants })
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
        // A step begins where its end bone is, kept as how far that is from where its step starts (resting
        // on its point), so it begins where the limb really was even when it had fallen short of its point.
        const begin = (name: string, forced: boolean) => {
          const t = touches.get(name)!
          const off = reached.get(name)!.clone().sub(reach.get(name)!.pathAt(t.point, t.point, 0)).toArray()
          t.step = { from: t.point, to: reach.get(name)!.wants, s: 0, forced, off }
        }
        // One that has lost its point steps at once, and its group is then stepping.
        for (const name of reach.keys()) if (lost(name)) {
          begin(name, [...steppingGroups].some(g => g !== groupOf(name)))
          steppingGroups.add(groupOf(name))
        }
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
        for (const [name, t] of touches) t.left = left.get(name)
        const limbs: Handed[] = []
        for (const [name, { limb, middle, from, turnAt, outAt, pathAt, spare }] of reach) {
          const t = touches.get(name)
          if (!t) continue
          // Its end bone: resting on its point; or on its way between two, eased in and out, resting on the
          // surface under it and lifted off it by `step.lift` at the middle, with how far it began from
          // there fading out as it goes, so it starts where the limb was and lands resting on its point.
          const key = `${r.id} ${name}`
          let target = targets.get(key)
          if (!target) targets.set(key, (target = new T.Object3D()))
          if (t.step) {
            const { from: p, to: q, s } = t.step
            const e = s * s * (3 - 2 * s)
            target.quaternion.copy(turnAt(p, q, e))
            const under = pathAt(p, q, e).add(new T.Vector3(...(t.step.off ?? [0, 0, 0])).multiplyScalar(1 - e))
            // Lifted by `step.lift` at the middle, or the most of that which keeps it within reach, looked
            // at in sixteenths of the lift; if none does, the lift that comes nearest.
            const o = outAt(p, q, e), lift = k.step.lift * Math.sin(Math.PI * s)
            let by = 0, nearest = -Infinity
            for (let n = 16; n >= 0; n--) {
              const room = spare(under.clone().addScaledVector(o, (lift * n) / 16))
              if (room >= 0) { by = (lift * n) / 16; break }
              if (room > nearest) { nearest = room; by = (lift * n) / 16 }
            }
            target.position.copy(under).addScaledVector(o, by)
          } else {
            target.quaternion.copy(turnAt(t.point, t.point, 0))
            target.position.copy(pathAt(t.point, t.point, 0))
          }
          target.updateMatrixWorld(true)
          const goal = target.position.clone()
          t.room = spare(goal)
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
          // Of the ways the middle joint can swing round the line, the nearest this one that keeps the skin
          // of its two bones out of the surface (within `TOUCH` of it counting as out, touching), looked at
          // a twenty-fourth of a turn at a time either way;
          // if none does, the one that comes nearest. The skin is moved as the swing moves the bones, each
          // turned the shortest way from where its clip has it onto its new line, and read off the net's
          // field (`fromNet`) where its bone alone does not show it out.
          const { l1, l2, most, least, middle: midBone, end: endBone } = reach.get(name)!
          const d = Math.max(least, Math.min(most, goal.distanceTo(from)))
          const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
          const kneeAt = at(midBone), endAt = at(endBone)
          const skin = boneSkinNow(T, root, k, name)
          // The net's points in its own frame, and the one the limb touches, where walks to the surface
          // nearest a place start.
          const own = (i: number) => [net.at[i * 3], net.at[i * 3 + 1], net.at[i * 3 + 2]]
          const touchAt = t.step ? t.step.to : t.point
          // The world into the held row's own frame (the reverse of `heldPoint`).
          const toHeld = new T.Matrix4().makeBasis(new T.Vector3(...heldWay(held, [1, 0, 0])), new T.Vector3(...heldWay(held, [0, 1, 0])), new T.Vector3(...heldWay(held, [0, 0, 1]))).setPosition(...(held.data.pos as [number, number, number])).invert().elements
          // How far the skin keeps out of the surface for a swing `u`, the least; looking no further once it
          // is under `stop` (enough to know it is in).
          const margin = (u: THREE.Vector3, stop = -Infinity) => {
            const knee = from.clone().addScaledVector(line, l1 * cosA).addScaledVector(u, l1 * Math.sqrt(1 - cosA * cosA))
            const r1 = new T.Quaternion().setFromUnitVectors(kneeAt.clone().sub(from).normalize(), knee.clone().sub(from).normalize())
            const lower = endAt.clone().sub(kneeAt).applyQuaternion(r1)
            const r2 = new T.Quaternion().setFromUnitVectors(lower.clone().normalize(), goal.clone().sub(knee).normalize()).multiply(r1)
            // Eight places down each bone, and how far each is out of the surface (off the triangles round
            // the point of the net nearest it, two links out): a vertex near one is out by at least that
            // less how far it is from it, and is read off the net's field only when that is not enough to
            // know it is out.
            // Each read when first wanted.
            const down: { p: THREE.Vector3; by: number }[][] = [[], []]
            const downAt = (side: number, n: number) => {
              let d = down[side][n]
              if (d) return d
              const p = side === 0 ? from.clone().lerp(knee, (n + 0.5) / 8) : knee.clone().lerp(goal, (n + 0.5) / 8)
              const local = heldLocal(held, p.toArray())
              // Within the field's reach, read off it; further, off the triangles round its nearest point.
              const near = fromNet(net, local).by
              d = { p, by: Math.abs(near) < FIELD ? near : nearNet(net, local, nearestOn(net, own, local, touchAt), 2).by }
              down[side][n] = d
              return d
            }
            let leastOut = Infinity
            // Each side's skin turned about its pivot (the first bone's start; the middle joint, carried to
            // where the swing puts it) by that side's turn.
            const sides = [
              { m: new T.Matrix4().makeRotationFromQuaternion(r1).elements, pivot: from, to: from },
              { m: new T.Matrix4().makeRotationFromQuaternion(r2).elements, pivot: kneeAt, to: knee },
            ]
            for (const side of [0, 1]) {
              const { eighth, at: there } = skin[side]
              const { m, pivot, to } = sides[side]
              for (let n = 0; n < eighth.length; n++) {
                const x = there[n * 3] - pivot.x, y = there[n * 3 + 1] - pivot.y, z = there[n * 3 + 2] - pivot.z
                const vx = m[0] * x + m[4] * y + m[8] * z + to.x, vy = m[1] * x + m[5] * y + m[9] * z + to.y, vz = m[2] * x + m[6] * y + m[10] * z + to.z
                const by = downAt(side, eighth[n])
                let o = by.by - Math.hypot(vx - by.p.x, vy - by.p.y, vz - by.p.z)
                if (o < 0) {
                  const w = toHeld
                  o = fromNet(net, [w[0] * vx + w[4] * vy + w[8] * vz + w[12], w[1] * vx + w[5] * vy + w[9] * vz + w[13], w[2] * vx + w[6] * vy + w[10] * vz + w[14]]).by
                }
                if (o < leastOut) leastOut = o
                if (leastOut < stop) return leastOut
              }
            }
            return leastOut
          }
          const base = off.lengthSq() > 1e-18 ? off.clone().normalize() : new T.Vector3().crossVectors(line, facing).normalize()
          const ways = Array.from({ length: 25 }, (_, n) => {
            const angle = ((n % 2 ? 1 : -1) * Math.ceil(n / 2) * Math.PI) / 12
            return base.clone().multiplyScalar(Math.cos(angle)).addScaledVector(new T.Vector3().crossVectors(line, base), Math.sin(angle))
          })
          let swing = ways[0], best = -Infinity, found = false
          for (const u of ways) {
            const m = margin(u, -TOUCH)
            if (m >= -TOUCH) { swing = u; best = m; found = true; break }
          }
          // None keeps out: the one that comes nearest, each read whole.
          if (!found) {
            for (const u of ways) {
              const m = margin(u)
              if (m > best) { best = m; swing = u }
            }
          }
          t.clear = best
          off.copy(swing)
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
    show(row: Row, plugins: Plugins) {
      const T = plugins.render3d.THREE as typeof THREE
      const k = def(plugins.wire, row.kind)
      let d = drawn.get(row.id)
      if (!d) {
        const shape = meshOf(k)
        const g = new T.BufferGeometry()
        g.setAttribute('position', new T.Float32BufferAttribute(shape.position, 3))
        g.setIndex(shape.index)
        g.computeVertexNormals()
        const material = new T.MeshStandardMaterial({ color: k.colour, roughness: 0.9, flatShading: true })
        plugins.render3d.dress(material)
        const mesh = new T.Mesh(g, material)
        mesh.name = row.kind
        mesh.castShadow = true
        mesh.receiveShadow = true
        const net = netOn(shape)
        const ends: number[] = []
        for (let i = 0; i < net.points; i++) for (const o of linked(net, i)) if (o > i) ends.push(...net.at.subarray(i * 3, i * 3 + 3), ...net.at.subarray(o * 3, o * 3 + 3))
        const lg = new T.BufferGeometry()
        lg.setAttribute('position', new T.Float32BufferAttribute(ends, 3))
        const lines = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x3cff9a, depthTest: false, transparent: true, opacity: 0.7 }))
        lines.name = `${row.kind} net`
        lines.renderOrder = 10
        mesh.add(lines)
        plugins.render3d.scene.add(mesh)
        drawn.set(row.id, (d = { mesh, lines, rest: shape.position, ends, bend: 0 }))
      }
      // One that bends: its mesh and its net's lines posed as its row's bend has it, when that changes (each
      // corner the bend moves; it is drawn flat, its faces' own ways, so it needs no ways at its corners).
      const bend = row.data.bend ?? 0
      if (k.bends && bend !== d.bend) {
        const p: [number, number, number] = [0, 0, 0]
        const pose = (from: number[], into: THREE.BufferAttribute) => {
          const to = into.array as Float32Array
          for (let i = 0; i < from.length; i += 3) {
            if (from[i + 1] <= k.bends.at - k.bends.over) continue
            p[0] = from[i]; p[1] = from[i + 1]; p[2] = from[i + 2]
            const q = bent(k.bends, bend, p)
            to[i] = q[0]; to[i + 1] = q[1]; to[i + 2] = q[2]
          }
          into.needsUpdate = true
        }
        pose(d.rest, d.mesh.geometry.getAttribute('position') as THREE.BufferAttribute)
        d.mesh.geometry.computeBoundingSphere()
        pose(d.ends, d.lines.geometry.getAttribute('position') as THREE.BufferAttribute)
        d.lines.geometry.computeBoundingSphere()
        d.bend = bend
      }
      const [x, y, z] = row.data.pos
      d.mesh.position.set(x, y, z)
      // Tipped back by its pitch about its own x, then turned by its yaw, as `heldPoint` places it.
      d.mesh.rotation.set(-row.data.pitch, row.data.yaw, 0, 'YXZ')
      d.lines.visible = !!k.shown
    },
    hide(id: number, plugins: Plugins) {
      undraw(plugins, id)
    },
    close(plugins: Plugins) {
      reaching.clear()
      targets.clear()
      touching.clear()
      for (const id of [...drawn.keys()]) undraw(plugins, id)
    },
  }
}
