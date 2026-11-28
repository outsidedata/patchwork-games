// demo_lod3d's bake, `yarn bake demo_lod3d` (core's `scripts/bake.ts`): the kit items its lod3d layer `junipers`
// scatters, written where the scene's catalogue reads them. The library's kit runtime (`yarn pro-ng:runtime`) runs
// while it bakes, since it shoots each item's LOD card.
//   items/<item>.glb, items/<item>.item.json, items/<item>_card.webp
//                        every item of `demo_lod3d.items.json`, kit items of the library's pro-ng, each with its LOD
//                        card (`"lod": true`), by the bake's `items` tool (`scripts/items.ts`)
//   main.looks.json, looks/
//                        the scene's one looks file and its pictures, by the bake's `looks` tool: every material
//                        the items are drawn in, their cards' too; its pictures' stack listed in the scene's
//                        catalogue (`main.scene.json`), the entry of an earlier bake taken out first
// The other glbs of `assets/` (firs, trees, clumps, rocks) are not made here.
import fs from 'node:fs'
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const SCENE = 'main.scene.json'

export default async ({ items, looks }: Tools) => {
  const built = await items({ sheet: path.join(here, 'demo_lod3d.items.json'), out: path.join(here, 'items') })
  for (const name of Object.keys(built.items)) console.log('wrote', path.relative(root, path.join(here, 'items', `${name}.glb`)))
  fs.rmSync(path.join(here, 'looks'), { recursive: true, force: true })
  const made = await looks({ materials: built.materials, out: path.join(here, 'main.looks.json'), pictures: path.join(here, 'looks') })
  console.log('wrote', path.relative(root, path.join(here, 'main.looks.json')), `${made.materials.length} materials`)

  // the pictures' stack in the scene's catalogue, the entry of an earlier bake taken out first
  const url = '/games/demo_lod3d/assets/looks/'
  const sceneFile = path.join(here, '..', SCENE)
  const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
  const assets: Record<string, { url: string }> = scene.world.loader.assets
  for (const [asset, a] of Object.entries(assets)) if (a.url.startsWith(url)) delete assets[asset]
  if (made.stack) assets[made.stack.asset] = { type: 'texture', url: `${url}${made.stack.file}`, preload: true } as { url: string }
  fs.writeFileSync(sceneFile, JSON.stringify(scene, null, 2) + '\n')
  console.log('wrote', path.relative(root, sceneFile), `its catalogue's ${made.stack ? 1 : 0} stack of ${made.pictures.length} pictures`)
}
