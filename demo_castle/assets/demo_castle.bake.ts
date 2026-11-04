// demo_castle's bake, `yarn bake demo_castle` (core's `scripts/bake.ts`): every file main's catalogue names
// but the definitions, written beside this file.
//   smallville.town.glb
//                 the library's pro-ng town (its scene `pro-ng/scenes/smallville.town.json`), each building cut into
//                 one solid in Blender (`pro-ng/procedural.py`): the solids, the roofs' coverings, the timber, the
//                 kit and the kit's parts in a wall look, each vertex its material's number and what its look reads,
//                 and on its node `pro-ng` every building's courses and how its attributes make the shader's inputs,
//                 compressed by `pro-ng/pack.mjs`, drawn by `castle.client.ts` through supershader3d
//   smallville.town.looks.json, looks/<file>.webp
//                 the town's one shader, supershader3d's file, and the pictures it reads, which pack.mjs writes
//                 beside the glb (`pro-ng/look_bake.mjs`) from the library's looks and `pro-ng/materials.json`: every
//                 material the town draws. Each picture is listed in main's catalogue (`main.scene.json`) by its
//                 name, the entries of an earlier bake's pictures taken out first.
//   smallville.town.shapes3d.json
//                 what a walker stands on and bumps into, shapes3d's shapes file, which procedural.py writes beside the
//                 glb (`pro-ng/shapes.py`): `kinds`, every kind's shape, and `shapes`, each one's `kind`, `pos` and `yaw`
//   smallville.town.nav.json
//                 the town's ways, nav3d's graph of shapes, from its files' metadata (`pro-ng/town_nav.py`, no Blender)
//   smallville.town.terrain3d_layers.json
//                 terrain3d's painted layer that flattens the ground under the whole town to 0, one flatten stroke,
//                 which procedural.py writes beside the glb
//   demo_castle.field.json
//                 terrain3d's field, written by hand but for its `layers`, which the bake sets to the town's layer
//   ground/grass-color-2048.webp, ground/grass-normal-2048.webp
//                 the ground's grass, cut by core's bake from `cc0-textures.json` before this file runs
// Change the town, a material or a look in the library and bake again.
//   castle_walker.glb, castle_woman.glb
//                 the people of every scene: the player, castle_walker, drawn by anim, and every visitor,
//                 castle_woman, drawn by crowd3d, each with every clip of `player.rig.json` (idle, walk, run,
//                 jump, and the torch stance's tcidle, tcwalk, tcrun, tcjump) baked onto it by anim's export
//                 (`plugins/anim/anim.export.py`). crowd3d plays idle, walk and run; anim plays by the table
//                 the export measures on castle_walker, the rig's first body, written back into the rig in
//                 the rig's own layout (`.claude/skills/using-mixamo-assets/scripts/merge-table.mjs`).
// The rig's clips are read from ~/troupe-collection, its bodies from the paths its `bodies` give.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Looks, Tools } from '#scripts/bake.ts'
import player from './player.rig.json' with { type: 'json' }

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const exporter = path.join(root, 'plugins', 'anim', 'anim.export.py')
const merge = path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs')
const LOOKS_URL = '/games/demo_castle/assets/looks/'

export default async ({ blender, scratch, library }: Tools) => {
  const prong = path.join(library, 'pro-ng')
  // every cc0-textures set the looks wear, downloaded into the library when it is not there (`pro-ng/textures.mjs`)
  execFileSync(process.execPath, [path.join(prong, 'textures.mjs')], { stdio: 'inherit' })
  const out = scratch('smallville')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(prong, 'procedural.py'), '--', 'scene', 'smallville.town', out]))
  execFileSync(process.execPath, [path.join(prong, 'pack.mjs'), path.join(out, 'smallville.town.glb')], { stdio: 'inherit' })
  execFileSync('python3', [path.join(prong, 'town_nav.py'), 'smallville.town', out], { stdio: 'inherit' })
  for (const name of ['smallville.town.glb', 'smallville.town.looks.json', 'smallville.town.shapes3d.json', 'smallville.town.nav.json', 'smallville.town.terrain3d_layers.json']) {
    fs.copyFileSync(path.join(out, name), path.join(here, name))
    console.log('wrote', path.relative(root, path.join(here, name)))
  }
  // the looks' pictures, the folder made again so no picture of an earlier bake is left
  const looks: Looks = JSON.parse(fs.readFileSync(path.join(here, 'smallville.town.looks.json'), 'utf8'))
  fs.rmSync(path.join(here, 'looks'), { recursive: true, force: true })
  fs.mkdirSync(path.join(here, 'looks'))
  for (const p of looks.pictures) {
    fs.copyFileSync(path.join(out, 'looks', p.file), path.join(here, 'looks', p.file))
    console.log('wrote', path.relative(root, path.join(here, 'looks', p.file)))
  }
  // each picture in main's catalogue by its name, a colour picture in sRGB and every other linear
  const sceneFile = path.join(here, '..', 'main.scene.json')
  const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
  const assets: Record<string, { url: string }> = scene.world.loader.assets
  for (const [name, a] of Object.entries(assets)) if (a.url.startsWith(LOOKS_URL)) delete assets[name]
  for (const p of looks.pictures) {
    assets[p.asset] = { type: 'texture', url: `${LOOKS_URL}${p.file}`, ...(p.colour ? {} : { space: 'linear' }), wrap: 'repeat', preload: true } as any
  }
  fs.writeFileSync(sceneFile, JSON.stringify(scene, null, 2) + '\n')
  console.log('wrote', path.relative(root, sceneFile), `its catalogue's ${looks.pictures.length} pictures`)
  // the town's flatten laid into the field, its one painted layer
  const fieldFile = path.join(here, 'demo_castle.field.json')
  const field = JSON.parse(fs.readFileSync(fieldFile, 'utf8'))
  field.layers = [JSON.parse(fs.readFileSync(path.join(here, 'smallville.town.terrain3d_layers.json'), 'utf8'))]
  fs.writeFileSync(fieldFile, JSON.stringify(field, null, 2) + '\n')
  console.log('wrote', path.relative(root, fieldFile), 'its layers')
  const file = path.join(here, 'player.rig.json'), table = scratch('player.table.json')
  const bodies = Object.keys(player.bodies).map(body => `${body}=${path.join(here, `${body}.glb`)}`)
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', exporter, '--', file, table, ...bodies])
  for (const body of Object.keys(player.bodies)) console.log('wrote', path.relative(root, path.join(here, `${body}.glb`)))
  execFileSync(process.execPath, [merge, file, table, file], { stdio: 'inherit' })
  console.log('wrote', path.relative(root, file), 'its table')
}
