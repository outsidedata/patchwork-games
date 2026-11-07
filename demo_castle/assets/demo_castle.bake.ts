// demo_castle's bake, `yarn bake demo_castle` (core's `scripts/bake.ts`): every file main's catalogue names
// but the definitions, written beside this file. The town's six files and its pictures are made by the library's
// pro-ng in one build (`pro-ng/build.mjs`: the textures, the cut, the pack and the ways), run on core's Blender, and
// copied in.
//   smallville.town.glb
//                 the library's pro-ng town (its scene `pro-ng/scenes/castle/smallville/smallville.town.json`), each building cut into
//                 one solid in Blender (`pro-ng/procedural.py`): the solids, each face in the material its building's
//                 `material` names for its side, the roofs' coverings, the timber and the kit, each vertex its
//                 material's number and what its look reads, and on its node `pro-ng` the course table's rows and
//                 how its attributes make the shader's inputs,
//                 compressed by `pro-ng/pack.mjs`, drawn by `castle.client.ts` through supershader3d. A kit thing
//                 that moves (the tavern's ceiling fan) skins the mesh `kit`: its joints and weights, the skin's bones
//                 under the node `kit bones`, an animation `<thing> <clip>` for each clip of bones, morph targets for
//                 each clip of poses
//   smallville.town.clips.json
//                 each moving kit thing's clips as its kind wrote them (about, how, start, loop, seconds, and the
//                 glTF animation or the poses it plays), which procedural.py writes beside the glb and
//                 `castle.client.ts` plays (the fortress's `clip`)
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
//   smallville.town.hollows.json
//                 the boxes lod3d draws no grass, trees or stones in: one round each building standing at elevation 0,
//                 which procedural.py writes beside the glb, handed to lod3d by the fortress (`fortress.lod3d.ts`)
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
import { pathToFileURL } from 'node:url'
import type { Looks, Tools } from '#scripts/bake.ts'
import player from './player.rig.json' with { type: 'json' }

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const exporter = path.join(root, 'plugins', 'anim', 'anim.export.py')
const merge = path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs')
// The places baked, each a scene of the library's pro-ng/scenes (without its `.json`) made into a scene of the game:
// its files written into `folder` (under this one), its pictures into `folder/looks/`, listed in the catalogue of the
// game's scene file `scene`, and its flatten laid into the field `field` (under this folder)
const PLACES = [
  { pro: 'castle/smallville/smallville.town', folder: '', scene: 'main.scene.json', field: 'demo_castle.field.json' },
  { pro: 'village/village.art', folder: 'village', scene: 'village.scene.json', field: 'village/village.field.json' },
]
// what pro-ng's build writes for a scene, each `<name><suffix>`
const MADE = ['.glb', '.looks.json', '.clips.json', '.shapes3d.json', '.nav.json', '.terrain3d_layers.json', '.hollows.json']

export default async ({ blender, scratch, library }: Tools) => {
  // each place made into every file a game boots from by the library's pro-ng (`pro-ng/build.mjs`), on core's Blender
  const { build } = await import(pathToFileURL(path.join(library, 'pro-ng', 'build.mjs')).href)
  for (const place of PLACES) {
    const name = path.basename(place.pro)
    const out = scratch(name)
    await build(place.pro, out, blender)
    const into = path.join(here, place.folder)
    fs.mkdirSync(into, { recursive: true })
    for (const suffix of MADE) {
      fs.copyFileSync(path.join(out, name + suffix), path.join(into, name + suffix))
      console.log('wrote', path.relative(root, path.join(into, name + suffix)))
    }
    // the looks' pictures, the folder made again so no picture of an earlier bake is left
    const looks: Looks = JSON.parse(fs.readFileSync(path.join(into, `${name}.looks.json`), 'utf8'))
    fs.rmSync(path.join(into, 'looks'), { recursive: true, force: true })
    fs.mkdirSync(path.join(into, 'looks'))
    for (const p of looks.pictures) {
      fs.copyFileSync(path.join(out, 'looks', p.file), path.join(into, 'looks', p.file))
      console.log('wrote', path.relative(root, path.join(into, 'looks', p.file)))
    }
    // each picture in the scene's catalogue by its name, a colour picture in sRGB and every other linear
    const url = `/games/demo_castle/assets/${place.folder ? `${place.folder}/` : ''}looks/`
    const sceneFile = path.join(here, '..', place.scene)
    const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
    const assets: Record<string, { url: string }> = scene.world.loader.assets
    for (const [asset, a] of Object.entries(assets)) if (a.url.startsWith(url)) delete assets[asset]
    for (const p of looks.pictures) {
      assets[p.asset] = { type: 'texture', url: `${url}${p.file}`, ...(p.colour ? {} : { space: 'linear' }), wrap: 'repeat', preload: true } as any
    }
    fs.writeFileSync(sceneFile, JSON.stringify(scene, null, 2) + '\n')
    console.log('wrote', path.relative(root, sceneFile), `its catalogue's ${looks.pictures.length} pictures`)
    // the place's flatten laid into its field, its one painted layer
    const fieldFile = path.join(here, place.field)
    const field = JSON.parse(fs.readFileSync(fieldFile, 'utf8'))
    field.layers = [JSON.parse(fs.readFileSync(path.join(into, `${name}.terrain3d_layers.json`), 'utf8'))]
    fs.writeFileSync(fieldFile, JSON.stringify(field, null, 2) + '\n')
    console.log('wrote', path.relative(root, fieldFile), 'its layers')
  }
  const file = path.join(here, 'player.rig.json'), table = scratch('player.table.json')
  const bodies = Object.keys(player.bodies).map(body => `${body}=${path.join(here, `${body}.glb`)}`)
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', exporter, '--', file, table, ...bodies])
  for (const body of Object.keys(player.bodies)) console.log('wrote', path.relative(root, path.join(here, `${body}.glb`)))
  execFileSync(process.execPath, [merge, file, table, file], { stdio: 'inherit' })
  console.log('wrote', path.relative(root, file), 'its table')
}
