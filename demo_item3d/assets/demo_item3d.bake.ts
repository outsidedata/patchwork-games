// demo_item3d's bake, `yarn bake demo_item3d` (core's `scripts/bake.ts`): every built file the scene's
// catalogue names, written where the catalogue reads it.
//   sword.glb            the plain glb the worker and the villager hold as a loader model (`sword.mjs`)
//   soldier.glb          the villager's body: the library's soldier with every clip of `crowd.rig.json` baked
//                        onto it by anim's export (`plugins/anim/anim.export.py`), which packs it with gltfpack
//   worker.glb           the worker's body: Mixamo's X Bot with every clip of `worker.rig.json`, by the same
//                        export; the rig's measured `table` and `ends` are then written back into
//                        `worker.rig.json` by the mixamo skill's `merge-table.mjs`
//   xbot.glb             the runner's body: the X Bot with every clip of `xbot.rig.json`, by the same export
//   xbot.rig.baked.json  that rig's measured `table`, `ends`, `grips` and `touches`; `xbot.rig.json` is never
//                        written
//   xbot.motion3d.baked.json  each clip's offsets for each body, from the clips just measured, each clip's
//                        sidecar and `xbot.motion3d.json` (motion3d's `motion3d.offsets.ts`)
//   items/<item>.glb, items/<item>.item.json
//                        every item of `demo_item3d.items.json`, kit items of the library's pro-ng, by the
//                        bake's `items` tool (`scripts/items.ts`)
//   main.looks.json, looks/
//                        the scene's one looks file and its pictures, by the bake's `looks` tool: the
//                        scene's own materials (GROUND), then every material the items are drawn in, as
//                        the items tool hands them back; its pictures' stack listed in the scene's
//                        catalogue (`main.scene.json`), the entries of an earlier bake taken out first
//   guard.glb            the guard's body: the library's soldier with every clip of `guard.rig.json`, by the
//                        same export; the rig's measured `table` and `ends` are written back into
//                        `guard.rig.json`
//   tee.glb, tee.garment.json
//                        the guard's tee, by the bake's `garment` tool (`scripts/garment.ts`): the garment
//                        shop's tee draped on `guard.glb` as it stands at rest in that file, its T-pose,
//                        before any clip, a mesh a pattern piece, and its sidecar; fabric3d cuts its
//                        fabric `tee` from the two (`fabrics.json`)
// Change the sheet, a kind, a material or a look in the library and bake again.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Material, Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const SCENE = 'main.scene.json'
// the materials the scene draws that no item does: the ground's layer
const GROUND: Record<string, Material> = { cobble: { look: 'cobble', colour: '#9a8f7c' } }

const node = (args: string[]) =>
  new Promise<string>((done, fail) => execFile(process.execPath, args, (e, stdout, stderr) =>
    e ? fail(new Error(`node ${args.join(' ')} failed:\n${stdout}${stderr}`)) : done(`${stdout}${stderr}`)))

export default async ({ blender, scratch, items, looks, garment }: Tools) => {
  const exported = (rig: string, table: string, outs: string[]) =>
    blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.export.py'), '--', rig, table, ...outs])
  const merge = path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs')

  // the plain glb
  console.log(await node([path.join(here, 'sword.mjs')]))

  // the villager's body; crowd3d reads none of the rig's measures, so they are dropped with the scratch
  console.log(await exported(path.join(here, 'crowd.rig.json'), scratch('crowd.table.json'), [`soldier=${path.join(here, 'soldier.glb')}`]))
  console.log('wrote', path.relative(root, path.join(here, 'soldier.glb')))

  // the worker's body, and its rig's measures
  const workerRig = path.join(here, 'worker.rig.json'), workerTable = scratch('worker.table.json')
  console.log(await exported(workerRig, workerTable, [`worker=${path.join(here, 'worker.glb')}`]))
  console.log(await node([merge, workerRig, workerTable, workerRig]))
  console.log('wrote', path.relative(root, path.join(here, 'worker.glb')))

  // the guard's body and its rig's measures, then its tee, draped on that body as it stands at rest
  const guardRig = path.join(here, 'guard.rig.json'), guardTable = scratch('guard.table.json')
  console.log(await exported(guardRig, guardTable, [`guard=${path.join(here, 'guard.glb')}`]))
  console.log(await node([merge, guardRig, guardTable, guardRig]))
  console.log('wrote', path.relative(root, path.join(here, 'guard.glb')))
  const tee = await garment({ body: path.join(here, 'guard.glb'), figure: 'demo_item3d_guard', kit: 'tee', config: 'default', garment: 'tee', out: path.join(here, 'tee.glb') })
  console.log('wrote', path.relative(root, path.join(here, 'tee.glb')), `${tee.pieces.length} pieces, ${tee.points} points, ${tee.triangles} triangles`)

  // the runner's body, its rig's measures, and each clip's offsets
  const rig = path.join(here, 'xbot.rig.json'), table = scratch('xbot.table.json'), merged = scratch('xbot.merged.json')
  console.log(await exported(rig, table, [`xbot=${path.join(here, 'xbot.glb')}`]))
  console.log(await node([merge, rig, table, merged]))
  const { table: measured, ends, grips, touches } = JSON.parse(fs.readFileSync(merged, 'utf8'))
  fs.writeFileSync(path.join(here, 'xbot.rig.baked.json'), JSON.stringify({ table: measured, ends, grips, touches }) + '\n')
  console.log('wrote', path.relative(root, path.join(here, 'xbot.rig.baked.json')))
  console.log('wrote', path.relative(root, path.join(here, 'xbot.glb')))
  console.log(await node(['--experimental-strip-types', path.join(root, 'plugins', 'motion3d', 'motion3d.offsets.ts'), rig, path.join(here, 'xbot.motion3d.json')]))

  // the items, then the scene's one looks file: its own materials first, then the items'
  const built = await items({ sheet: path.join(here, 'demo_item3d.items.json'), out: path.join(here, 'items') })
  for (const name of Object.keys(built.items)) console.log('wrote', path.relative(root, path.join(here, 'items', `${name}.glb`)))
  for (const name of Object.keys(GROUND)) if (built.materials[name]) throw new Error(`the scene's own material ${name} is an item's too: name the scene's another way`)
  fs.rmSync(path.join(here, 'looks'), { recursive: true, force: true })
  const made = await looks({ materials: { ...GROUND, ...built.materials }, out: path.join(here, 'main.looks.json'), pictures: path.join(here, 'looks') })
  console.log('wrote', path.relative(root, path.join(here, 'main.looks.json')), `${made.materials.length} materials`)

  // the pictures' stack in the scene's catalogue, the entries of an earlier bake taken out first
  const url = '/games/demo_item3d/assets/looks/'
  const sceneFile = path.join(here, '..', SCENE)
  const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
  const assets: Record<string, { url: string }> = scene.world.loader.assets
  for (const [asset, a] of Object.entries(assets)) if (a.url.startsWith(url)) delete assets[asset]
  if (made.stack) assets[made.stack.asset] = { type: 'texture', url: `${url}${made.stack.file}`, preload: true } as { url: string }
  fs.writeFileSync(sceneFile, JSON.stringify(scene, null, 2) + '\n')
  console.log('wrote', path.relative(root, sceneFile), `its catalogue's ${made.stack ? 1 : 0} stack of ${made.pictures.length} pictures`)
}
