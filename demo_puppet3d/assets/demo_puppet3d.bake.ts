// demo_puppet3d's bake, `yarn bake demo_puppet3d` (core's `scripts/bake.ts`). Every number and name it
// uses is `demo_puppet3d.bake.json`'s, beside this file:
//   cues     each cue sheet of its `sheets`, copied from the library's `cues/` into `cues/` beside this
//            file, where the scenes' catalogues read it (`<sheet>.cues.json`, the entry `<sheet>`);
//   clips    each animal of its `clips`, `{ kind, walk, stride, settle, idle }`: its kind in main's scene,
//            posed by puppet3d's own code from its definition and written with a `walk` (at `walk` metres a
//            second, a stride being `stride` coming round, after `settle` seconds) and an `idle` (`idle`
//            seconds), at `rate` frames a second, its solvers delivered by the mod files of its `mods`
//            (paths from the repo's root, in main's `world.puppet3d.mods.behaviors` order), into `awol/<animal>.clips.glb` by
//            `plugins/puppet3d/puppet3d.clips.ts`, for the herd scene's crowd3d to bake and play;
//   birds    each bird of its `birds`, `{ scene, layout, skeleton }`: `scene` a scene of the library's
//            pro-ng (`pro-ng/scenes/<scene>.json`) that stands one bird of its kit, made by the library's
//            pro-ng in one build (`pro-ng/build.mjs`: cut in Blender by `pro-ng/procedural.py`, packed by
//            `pro-ng/pack.mjs`) on core's Blender: one skinned mesh whose vertices carry their material's
//            number, written into `<bird>/` beside this file as:
//              <bird>.glb            the glb the build packed;
//              <bird>.looks.json     its one shader, supershader3d's file, which the build writes beside
//                                    the glb (`pro-ng/look_bake.mjs`) from the materials its triangles wear,
//                                    in the order its vertices count them, its settings moved into the
//                                    settings table by core's `packLooks`;
//              looks/<file>          the pictures its looks read (a wing's feather atlas, grown by the
//                                    library), each listed in main's catalogue by its name (the looks
//                                    file's `pictures`, each `asset`);
//              <bird>.skeleton.json  its rest skeleton for puppet3d, the layout `layout`, the loader entry
//                                    `skeleton`: every joint of its skin under its own name, every parent
//                                    before its children, its head where the joint rests. A joint the kit
//                                    gives an axis (the glb's `pro-ng` node, `kit.joints`) has that axis
//                                    as its `across`, so its `bend` is the kit's own angle about it, and
//                                    its tail toward the first joint that hangs on it, square to the axis.
//                                    Every other joint stands along the world's axes: its `across` +x and
//                                    its tail straight up, so its `bend` pitches it about x, its `twist`
//                                    turns it about y and its `swing` rolls it about z.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import type { Looks, Tools } from '#scripts/bake.ts'
import { packLooks } from '#scripts/pack-looks.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

type Bird = { scene: string; layout: string; skeleton: string }
type Bake = { sheets: string[]; rate: number; mods: string[]; clips: Record<string, { kind: string; walk: number; stride: string; settle: number; idle: number }>; birds: Record<string, Bird> }
type V3 = [number, number, number]
type Node = { name: string; children?: number[]; translation?: V3; rotation?: number[]; scale?: number[]; extras?: { kit: { joints: { joint: number; axis: V3 }[] } } }

// How long a bone with nothing to point at is drawn, metres.
const STUB = 0.05

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const round = (v: V3): V3 => [+v[0].toFixed(6), +v[1].toFixed(6), +v[2].toFixed(6)]

// A pro-ng glb's skin as puppet3d's rest skeleton (the header's `<bird>.skeleton.json`).
function skeletonOf(file: string, entry: string, layout: string) {
  const glb = fs.readFileSync(file)
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: Node[]; skins: { joints: number[] }[] }
  const nodes = gltf.nodes, joints = gltf.skins[0].joints
  const kit = nodes.find(n => n.name === 'pro-ng')?.extras?.kit
  if (!kit) throw new Error(`${file} has no node pro-ng with its kit's joints: it is no glb of pro-ng's`)
  const above = new Map<number, number>()
  nodes.forEach((n, i) => (n.children ?? []).forEach(c => above.set(c, i)))
  for (const j of joints) {
    const n = nodes[j]
    if ((n.rotation && n.rotation.join() !== '0,0,0,1') || n.scale) throw new Error(`${file}'s joint ${n.name} rests turned or scaled, and a pro-ng skin's joints rest moved only`)
  }
  const at = (j: number): V3 => {
    let p: V3 = [0, 0, 0]
    for (let k: number | undefined = j; k !== undefined; k = above.get(k)) { const t = nodes[k].translation ?? [0, 0, 0]; p = [p[0] + t[0], p[1] + t[1], p[2] + t[2]] }
    return p
  }
  const axes = new Map(kit.joints.map(j => [joints[j.joint], j.axis]))
  const bones: { name: string; parent: string | null; head: V3; tail: V3; across: V3 }[] = []
  const add = (j: number) => {
    const n = nodes[j], head = at(j), up = above.get(j), axis = axes.get(j)
    const under = (n.children ?? []).filter(c => joints.includes(c))
    let across: V3 = [1, 0, 0], tail: V3 = [head[0], head[1] + STUB, head[2]]
    if (axis) {
      across = axis
      // toward the first joint on it that is not where it is, else on from the joint it hangs on, square to the axis
      const ways = [...under.map(c => sub(at(c), head)), ...(up !== undefined && joints.includes(up) ? [sub(head, at(up))] : []), [0, 1, 0] as V3, [0, 0, 1] as V3]
      const square = ways.map((w): V3 => { const k = dot(w, axis); return [w[0] - axis[0] * k, w[1] - axis[1] * k, w[2] - axis[2] * k] }).find(w => Math.hypot(...w) > 1e-4)!
      const l = Math.hypot(...square), long = Math.max(l, STUB / 2)
      tail = [head[0] + square[0] / l * long, head[1] + square[1] / l * long, head[2] + square[2] / l * long]
    }
    bones.push({ name: n.name, parent: up !== undefined && joints.includes(up) ? nodes[up].name : null, head: round(head), tail: round(tail), across: round(across) })
    for (const c of under) add(c)
  }
  for (const j of joints) if (above.get(j) === undefined || !joints.includes(above.get(j)!)) add(j)
  return { entry, layout, bones }
}

export default async ({ library, scratch, blender }: Tools) => {
  const bake = JSON.parse(fs.readFileSync(path.join(here, 'demo_puppet3d.bake.json'), 'utf8')) as Bake

  fs.mkdirSync(path.join(here, 'cues'), { recursive: true })
  for (const s of bake.sheets) {
    fs.copyFileSync(path.join(library, 'cues', `${s}.cues.json`), path.join(here, 'cues', `${s}.cues.json`))
    console.log('wrote', path.relative(root, path.join(here, 'cues', `${s}.cues.json`)))
  }

  const { build } = await import(pathToFileURL(path.join(library, 'pro-ng', 'build.mjs')).href)
  for (const [bird, b] of Object.entries(bake.birds)) {
    const into = path.join(here, bird), out = scratch(bird), name = path.basename(b.scene), from = path.join(out, `${name}.glb`)
    await build(b.scene, out, blender)
    fs.mkdirSync(into, { recursive: true })
    fs.copyFileSync(from, path.join(into, `${bird}.glb`))
    console.log('wrote', path.relative(root, path.join(into, `${bird}.glb`)))
    const looks: Looks = packLooks(JSON.parse(fs.readFileSync(path.join(out, `${name}.looks.json`), 'utf8')))
    fs.writeFileSync(path.join(into, `${bird}.looks.json`), JSON.stringify(looks, null, 1) + '\n')
    console.log('wrote', path.relative(root, path.join(into, `${bird}.looks.json`)))
    fs.rmSync(path.join(into, 'looks'), { recursive: true, force: true })
    fs.mkdirSync(path.join(into, 'looks'))
    for (const p of looks.pictures) {
      fs.copyFileSync(path.join(out, 'looks', p.file), path.join(into, 'looks', p.file))
      console.log('wrote', path.relative(root, path.join(into, 'looks', p.file)))
    }
    fs.writeFileSync(path.join(into, `${bird}.skeleton.json`), JSON.stringify(skeletonOf(from, b.skeleton, b.layout), null, 1) + '\n')
    console.log('wrote', path.relative(root, path.join(into, `${bird}.skeleton.json`)))
  }

  for (const [animal, c] of Object.entries(bake.clips)) {
    const out = path.join(here, 'awol', `${animal}.clips.glb`)
    execFileSync('node', ['--experimental-strip-types', path.join(root, 'plugins', 'puppet3d', 'puppet3d.clips.ts'), path.join(here, '..', 'main.scene.json'), c.kind, out,
      `rate=${bake.rate}`, `walk=${c.walk},${c.stride},${c.settle}`, `idle=${c.idle}`, `mods=${bake.mods.map(m => path.join(root, m)).join(',')}`], { stdio: 'inherit' })
  }
}
