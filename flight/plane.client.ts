// A plane (`plane.sim.ts`) as every page draws it, whoever flies it. flight3d's own browser half draws
// the plane itself; this is the game's look beside it, hung on that drawing: what every plane leaves in
// the air, the smoke of its engine, its afterburner's flame, and the streams off its wingtips. Every
// point it starts from is an object under the plane's own model, so it is where the plane is drawn,
// turned with it, between steps as the plane is. Nothing here is read by a rule.
//
// The `plane` definition's `planes`, by the plane's `type`, each point in flight3d's body frame (+x
// the right wing, +y up, +z the tail):
//   burner     the lever past which its afterburner is lit; a plane with none has no burner.
//   exhausts   [{ at, dir, ribbon, gap, every, stages, lit }]: from `at`, a ribbon of smoke (Ribbons,
//              below) as thick as the lever is open, and puffs of particle3d's effects thrown along
//              `dir`: one each time the point has moved `gap` metres or `every` seconds have gone,
//              whichever comes first, laid evenly along the way it went since the last. `stages`
//              [[lever, effect], …] in order: the effect of the last stage the lever has reached; `lit`
//              the effect it throws instead while the burner is lit.
//   flame      { at, radius, length, core, outer, glow, diamonds, flicker }: while the burner is lit, the
//              flame from the nozzle at `at` back along +z: a hot cone `radius` across in `core` inside a
//              wider one in `outer`, `length` [lit, full] metres long from the lever at the burner to the
//              lever full, each frame `flicker` of it longer or shorter; a glow `glow` metres across on
//              the nozzle; and a shock diamond `diamonds` metres down the flame each, scaled with it.
//   tips       { at, least, load, ribbon }: a ribbon of vapour from each point of `at` while the plane
//              flies faster than `least` m/s, as thick as its load, the wing's lift over its weight
//              (flight3d's `aero`), is from `load[0]` to `load[1]`: so a hard pull streams thick vapour.
// Ribbons. A ribbon `{ width, life, colour, opacity }` is a soft strip through the points its start has
// been drawn at, a sample a frame, each lasting `life` seconds: `width` [born, dying] metres across as it
// ages, turned to face the camera, `colour` an sRGB number, its opacity from `opacity[0]` to `opacity[1]`
// by how thick it was laid, fading to nothing as it ages and at its edges.
// A crashed plane leaves nothing; the plane going takes all of it out.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { aero, airframeOf, type Flight, type Plane } from '#plugins/flight3d/flight3d.sim.ts'

type Stage = [from: number, effect: string]
type Band = { width: number[]; life: number; colour: number; opacity: number[] }
type Exhaust = { at: number[]; dir: number[]; ribbon: Band; gap: number; every: number; stages: Stage[]; lit?: string }
type Flame = { at: number[]; radius: number; length: number[]; core: number; outer: number; glow: number; diamonds: number[]; flicker: number }
type Tips = { at: number[][]; least: number; load: number[]; ribbon: Band }
export type Look = { burner?: number; exhausts: Exhaust[]; flame?: Flame; tips: Tips }

// Where puffs were last thrown from, in the world, and when, on the page's clock in seconds.
type Laid = { at: number[]; t: number }
type Sample = { p: THREE.Vector3; t: number; k: number }
type Ribbon = { band: Band; mesh: THREE.Mesh; samples: Sample[] }
type Drawn = {
  root: THREE.Object3D
  marks: THREE.Object3D[] // the exhausts' points, then the tips'
  ribbons: Ribbon[] // the exhausts', then the tips'
  laid: Map<number, Laid>
  flame?: { group: THREE.Group; cones: THREE.Mesh[]; diamonds: THREE.Sprite[] }
}

// The most puffs one exhaust throws in a frame: a frame after a hidden tab throws this many, not thousands.
const MOST = 40

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// This plane as each page draws it, by its render3d: two pages in one process share this module.
const drawn = new WeakMap<object, Drawn>()

/** The effect of the last of `stages` that `value` has reached, or undefined when it has reached none. */
export function stageOf(stages: Stage[], value: number): string | undefined {
  let got: string | undefined
  for (const [from, effect] of stages) if (value >= from) got = effect
  return got
}

/** The points an exhaust throws a puff from this frame, from where it last threw one to where it is
 *  `now`: as many as the metres it has gone over `gap` or the seconds over `every`, whichever is more,
 *  at most `MOST`, spaced evenly along the way and ending where it is. */
export function lay(last: Laid, at: number[], now: number, gap: number, every: number): number[][] {
  const d = Math.hypot(at[0] - last.at[0], at[1] - last.at[1], at[2] - last.at[2])
  const n = Math.min(MOST, Math.max(Math.floor(d / gap), Math.floor((now - last.t) / every)))
  return Array.from({ length: n }, (_, k) => last.at.map((c, i) => c + (at[i] - c) * ((k + 1) / n)))
}

// A texture white in its middle row and clear at its top and bottom: a ribbon's soft edges across it,
// a flame's fade toward its tip, a glow's falloff from its middle (`round`).
function soft(T: typeof THREE, round: boolean): THREE.DataTexture {
  const n = 32
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = (y + 0.5) / n * 2 - 1, u = (x + 0.5) / n * 2 - 1
    const r = round ? Math.hypot(u, v) : Math.abs(v)
    const a = Math.max(0, 1 - r) ** 1.6
    data.set([255, 255, 255, Math.round(a * 255)], (y * n + x) * 4)
  }
  const t = new T.DataTexture(data, n, n)
  t.needsUpdate = true
  return t
}

// The plane's model as flight3d placed it: of the objects in the scene holding a node named for its
// type, the one nearest its row.
function modelOf(scene: THREE.Scene, p: Plane): THREE.Object3D | undefined {
  let best: THREE.Object3D | undefined, d = Infinity
  for (const o of scene.children) {
    if (!o.getObjectByName(p.type)) continue
    const e = o.position.distanceToSquared({ x: p.pos[0], y: p.pos[1], z: p.pos[2] } as THREE.Vector3)
    if (e < d) { best = o; d = e }
  }
  return best
}

function ribbonOf(T: typeof THREE, scene: THREE.Scene, band: Band, edge: THREE.Texture): Ribbon {
  const geometry = new T.BufferGeometry()
  const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, alphaMap: edge,
  }))
  mesh.frustumCulled = false
  scene.add(mesh)
  return { band, mesh, samples: [] }
}

// The ribbon's strip from its samples: two corners a sample, either side of it square to the way the
// ribbon runs and to the camera, its colour's alpha the sample's opacity faded by its age.
function strip(T: typeof THREE, r: Ribbon, now: number, eye: THREE.Vector3) {
  const { band, samples } = r
  while (samples.length && now - samples[0].t > band.life) samples.shift()
  const n = samples.length
  const g = r.mesh.geometry
  if (n < 2) { g.setDrawRange(0, 0); return }
  if (!g.getAttribute('position') || g.getAttribute('position').count < n * 2) {
    const room = Math.max(n * 2, 256)
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(room * 3), 3))
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(room * 4), 4))
    g.setAttribute('uv', new T.BufferAttribute(new Float32Array(room * 2), 2))
    const index: number[] = []
    for (let i = 0; i < room / 2 - 1; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
    g.setIndex(index)
  }
  const pos = g.getAttribute('position') as THREE.BufferAttribute, col = g.getAttribute('color') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute
  const c = new T.Color(band.colour)
  const along = new T.Vector3(), to = new T.Vector3(), side = new T.Vector3()
  samples.forEach((s, i) => {
    along.subVectors(samples[Math.min(n - 1, i + 1)].p, samples[Math.max(0, i - 1)].p)
    to.subVectors(eye, s.p)
    side.crossVectors(along, to).normalize()
    const age = clamp((now - s.t) / band.life, 0, 1)
    side.multiplyScalar((band.width[0] + (band.width[1] - band.width[0]) * age) / 2)
    // Faded in over its first samples, so it starts soft at its source, and out as it ages.
    const a = (band.opacity[0] + (band.opacity[1] - band.opacity[0]) * s.k) * (1 - age) * Math.min(1, (n - 1 - i) / 3)
    pos.setXYZ(2 * i, s.p.x + side.x, s.p.y + side.y, s.p.z + side.z)
    pos.setXYZ(2 * i + 1, s.p.x - side.x, s.p.y - side.y, s.p.z - side.z)
    col.setXYZW(2 * i, c.r, c.g, c.b, a)
    col.setXYZW(2 * i + 1, c.r, c.g, c.b, a)
    uv.setXY(2 * i, i / n, 0)
    uv.setXY(2 * i + 1, i / n, 1)
  })
  pos.needsUpdate = col.needsUpdate = uv.needsUpdate = true
  g.setDrawRange(0, (n - 1) * 6)
}

function make(plugins: Plugins, look: Look, root: THREE.Object3D): Drawn {
  const T = plugins.render3d.THREE as typeof THREE
  const scene = plugins.render3d.scene as THREE.Scene
  const edge = soft(T, false)
  const mark = (at: number[]) => { const o = new T.Object3D(); o.position.fromArray(at); root.add(o); return o }
  const marks = [...look.exhausts.map(e => mark(e.at)), ...look.tips.at.map(mark)]
  const ribbons = [...look.exhausts.map(e => ribbonOf(T, scene, e.ribbon, edge)), ...look.tips.at.map(() => ribbonOf(T, scene, look.tips.ribbon, edge))]
  const d: Drawn = { root, marks, ribbons, laid: new Map() }
  const F = look.flame
  if (F) {
    // Cones along +z from the nozzle, a unit long, stretched to the flame's length each frame; their
    // texture fades them toward the tip.
    const fade = soft(T, false)
    const glow = soft(T, true)
    const group = new T.Group()
    group.position.fromArray(F.at)
    const cone = (radius: number, colour: number, opacity: number) => {
      const geometry = new T.ConeGeometry(radius, 1, 24, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5)
      // From the base (v 0) to the tip (v 1): bright at the base, clear at the tip.
      const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 0.5 + 0.5 * (1 - uv.getY(i)))
      const m = new T.Mesh(geometry, new T.MeshBasicMaterial({
        color: colour, transparent: true, opacity, alphaMap: fade, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
      }))
      group.add(m)
      return m
    }
    const cones = [cone(F.radius * 1.5, F.outer, 0.55), cone(F.radius, F.core, 0.9)]
    const sprite = (colour: number, opacity: number) => new T.Sprite(new T.SpriteMaterial({ color: colour, map: glow, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false }))
    const nozzle = sprite(F.outer, 0.8)
    nozzle.scale.setScalar(F.glow)
    group.add(nozzle)
    const diamonds = F.diamonds.map(() => { const s = sprite(F.core, 0.85); group.add(s); return s })
    group.visible = false
    root.add(group)
    d.flame = { group, cones, diamonds }
  }
  return d
}

// The trails of this row's plane, drawn this frame.
function trail(row: Row, plugins: Plugins) {
  const { render3d, particle3d, wire } = plugins
  const T = render3d.THREE as typeof THREE
  const f: Flight = wire.scene.world!.flight3d
  const p = row.data as Plane
  const look = (def(wire, row.kind).planes as Record<string, Look>)[p.type]
  if (!look) throw new Error(`the plane definition has no look for plane ${p.type}`)
  let d = drawn.get(render3d)
  if (!d || !d.root.parent) {
    // flight3d draws the plane once its model has landed, and makes it again when its design changes.
    const root = modelOf(render3d.scene, p)
    if (!root) return
    if (d) untrail(plugins)
    drawn.set(render3d, (d = make(plugins, look, root)))
  }
  const now = performance.now() / 1000
  const lit = look.burner !== undefined && p.throttle >= look.burner && !p.crashed
  // Where each point is drawn: the model as it stands, the plane's last step.
  d.root.updateWorldMatrix(true, true)
  const at = d.marks.map(m => m.getWorldPosition(new T.Vector3()))
  const eye = (render3d.camera as THREE.Camera).getWorldPosition(new T.Vector3())

  const speed = Math.hypot(p.vel[0], p.vel[1], p.vel[2])
  const flying = !p.crashed && speed > look.tips.least
  const a = flying ? aero(p, p, f, airframeOf(f, p.type), 0) : undefined
  const load = a ? Math.abs(a.lift) / a.weight : 0
  const thick = [
    ...look.exhausts.map(() => (p.crashed ? undefined : p.throttle)),
    ...look.tips.at.map(() => (flying ? clamp((load - look.tips.load[0]) / (look.tips.load[1] - look.tips.load[0]), 0, 1) : undefined)),
  ]
  d.ribbons.forEach((r, i) => {
    if (thick[i] !== undefined) r.samples.push({ p: at[i], t: now, k: thick[i]! })
    strip(T, r, now, eye)
  })

  // Puffs from each exhaust, from where it is drawn, along the way it points.
  const turn = new T.Quaternion()
  d.root.getWorldQuaternion(turn)
  look.exhausts.forEach((e, i) => {
    const effect = p.crashed ? undefined : lit && e.lit ? e.lit : stageOf(e.stages, p.throttle)
    if (!effect || !particle3d?.has(effect)) { d!.laid.delete(i); return }
    const here = at[i].toArray(), dir = new T.Vector3().fromArray(e.dir).applyQuaternion(turn).toArray()
    const last = d!.laid.get(i)
    const points = last ? lay(last, here, now, e.gap, e.every) : [here]
    if (last && !points.length) return
    for (const q of points) particle3d.emit(effect, q, { dir })
    d!.laid.set(i, { at: here, t: now })
  })

  // The flame, on the nozzle, as long as the lever is past the burner, flickering.
  const F = look.flame
  if (F && d.flame) {
    d.flame.group.visible = lit
    if (lit) {
      const k = clamp((p.throttle - look.burner!) / (1 - look.burner!), 0, 1)
      const length = (F.length[0] + (F.length[1] - F.length[0]) * k) * (1 + F.flicker * (Math.random() * 2 - 1))
      d.flame.cones[0].scale.set(1, 1, length)
      d.flame.cones[1].scale.set(1, 1, length * 0.6)
      const scale = length / F.length[1]
      d.flame.diamonds.forEach((s, j) => {
        s.position.set(0, 0, F.diamonds[j] * scale)
        s.scale.setScalar(F.radius * 2.2 * (1 + F.flicker * (Math.random() * 2 - 1)))
      })
    }
  }
}

// The trails taken out.
function untrail(plugins: Plugins) {
  const d = drawn.get(plugins.render3d)
  if (!d) return
  for (const r of d.ribbons) {
    r.mesh.removeFromParent()
    r.mesh.geometry.dispose()
    ;(r.mesh.material as THREE.Material).dispose()
  }
  for (const m of d.marks) m.removeFromParent()
  d.flame?.group.removeFromParent()
  d.flame?.group.traverse(o => {
    if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose()
    const m = (o as THREE.Mesh).material as THREE.Material | undefined
    m?.dispose()
  })
  drawn.delete(plugins.render3d)
}

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  if (row.data.placed) trail(row, plugins)
}

export function remove(plugins: Plugins) {
  untrail(plugins)
}
