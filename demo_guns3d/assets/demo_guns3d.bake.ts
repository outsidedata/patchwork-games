// demo_guns3d's bake, `yarn bake demo_guns3d` (core's `scripts/bake.ts`): every built file the scene's catalogue
// names, written where the catalogue reads it.
//   xbot.glb             the player's body: Mixamo's X Bot with every clip of `xbot.rig.json` (the Rifle 8-Way
//                        Locomotion Pack's) baked onto it by anim's export (`plugins/anim/anim.export.py`), which packs
//                        it with gltfpack; the rig's measured `table` and `ends` are then written back into
//                        `xbot.rig.json` by the mixamo skill's `merge-table.mjs`
//   items/<item>.glb, items/<item>.item.json
//                        every item of `demo_guns3d.items.json`, kit items of the library's pro-ng, by the bake's
//                        `items` tool (`scripts/items.ts`): the G95A1, its sidecar carrying its gun file, and the
//                        spent 5.56 case its port throws
//   main.looks.json, looks/
//                        the scene's one looks file and its pictures, by the bake's `looks` tool: the ground's
//                        material (GROUND), then every material the items are drawn in; its pictures' stack listed
//                        in the scene's catalogue (`main.scene.json`), the entries of an earlier bake taken out first
// Change the sheet, a kind, a material or a look in the library and bake again.
import { execFile } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import type { Material, Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const SCENE = 'main.scene.json'
// the materials the scene draws that no item does: none, the ground is terrain3d's checker texture
const GROUND: Record<string, Material> = {}

const node = (args: string[]) =>
  new Promise<string>((done, fail) => execFile(process.execPath, args, (e, stdout, stderr) =>
    e ? fail(new Error(`node ${args.join(' ')} failed:\n${stdout}${stderr}`)) : done(`${stdout}${stderr}`)))

export default async ({ blender, scratch, items, looks }: Tools) => {
  // the player's body and its rig's measures
  const rig = path.join(here, 'xbot.rig.json'), table = scratch('xbot.table.json')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.export.py'), '--', rig, table, `xbot=${path.join(here, 'xbot.glb')}`]))
  console.log(await node([path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs'), rig, table, rig]))
  console.log('wrote', path.relative(root, path.join(here, 'xbot.glb')))

  // the items, then the scene's one looks file: the ground's material first, then the items'
  const built = await items({ sheet: path.join(here, 'demo_guns3d.items.json'), out: path.join(here, 'items') })
  for (const name of Object.keys(built.items)) console.log('wrote', path.relative(root, path.join(here, 'items', `${name}.glb`)))
  for (const name of Object.keys(GROUND)) if (built.materials[name]) throw new Error(`the scene's own material ${name} is an item's too: name the scene's another way`)
  fs.rmSync(path.join(here, 'looks'), { recursive: true, force: true })
  const made = await looks({ materials: { ...GROUND, ...built.materials }, out: path.join(here, 'main.looks.json'), pictures: path.join(here, 'looks') })
  console.log('wrote', path.relative(root, path.join(here, 'main.looks.json')), `${made.materials.length} materials`)

  // the pictures' stack in the scene's catalogue, the entries of an earlier bake taken out first
  const url = '/games/demo_guns3d/assets/looks/'
  const sceneFile = path.join(here, '..', SCENE)
  const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
  const assets: Record<string, { url: string }> = scene.world.loader.assets
  for (const [asset, a] of Object.entries(assets)) if (a.url.startsWith(url)) delete assets[asset]
  if (made.stack) assets[made.stack.asset] = { type: 'texture', url: `${url}${made.stack.file}`, preload: true } as { url: string }
  fs.writeFileSync(sceneFile, JSON.stringify(scene, null, 2) + '\n')
  console.log('wrote', path.relative(root, sceneFile), `its catalogue's ${made.stack ? 1 : 0} stack of ${made.pictures.length} pictures`)
}
