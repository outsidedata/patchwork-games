// demo_world3d's bake, `yarn bake demo_world3d` (core's `scripts/bake.ts`): every file main's catalogue names
// but the definitions, written beside this file. Each place's files and its pictures are made by the library's
// pro-ng in one build (`pro-ng/build.mjs`: the textures, the cut, the pack and the ways), run on core's Blender, and
// copied in. Each place is world3d's (`plugins/world3d/world3d.sim.ts`): the bake writes the scene's
// `world.world3d.place` and an entry of its catalogue for each of world3d's parts, `<place>.<part>`, every one
// `preload`ed, in place of the entries of an earlier bake. The town's files:
//   smallville.town.glb
//                 the library's pro-ng town (its scene `pro-ng/scenes/castle/smallville/smallville.town.json`), each building cut into
//                 one solid in Blender (`pro-ng/procedural.py`): the solids, each face in the material its building's
//                 `material` names for its side, the roofs' coverings, the timber and the kit, each vertex its
//                 material's number and what its look reads, and on its node `pro-ng` the course table's rows and
//                 how its attributes make the shader's inputs,
//                 compressed by `pro-ng/pack.mjs`, drawn by world3d through supershader3d. A kit thing
//                 that moves (the tavern's ceiling fan) skins the mesh `kit`: its joints and weights, the skin's bones
//                 under the node `kit bones`, an animation `<thing> <clip>` for each clip of bones, morph targets for
//                 each clip of poses
//   smallville.town.clips.json
//                 each moving kit thing's clips as its kind wrote them (about, how, start, loop, seconds, and the
//                 glTF animation or the poses it plays), which procedural.py writes beside the glb and world3d
//                 plays (its `clip`)
//   smallville.town.effects.json
//                 the particle3d effects that burn in the town, `{ spawns: [{ effect, at, dir }] }`, which world3d
//                 emits; `effects.json` lists the file, so particle3d holds its effects
//   smallville.town.looks.json, looks/<file>.webp
//                 the town's one shader, supershader3d's file, and the pictures it reads, which pack.mjs writes
//                 beside the glb (`pro-ng/look_bake.mjs`) from the library's looks and `pro-ng/materials.json`: every
//                 material the town draws, its settings then moved out of uniforms into supershader3d's settings
//                 table by core's `packLooks` (`scripts/pack-looks.ts`). Each picture is listed in main's catalogue (`main.scene.json`) by its
//                 name, the entries of an earlier bake's pictures taken out first.
//   smallville.town.shapes3d.json
//                 what a walker stands on and bumps into, shapes3d's shapes file, which procedural.py writes beside the
//                 glb (`pro-ng/shapes.py`): `kinds`, every kind's shape, and `shapes`, each one's `kind`, `pos` and `yaw`
//   smallville.town.nav.json
//                 the town's ways, nav3d's graph of shapes, from its files' metadata (`pro-ng/town_nav.py`, no Blender)
//   smallville.town.crowd.json
//                 the people standing at the town's landmarks, `{"people": [{landmark, model, clips, at, yaw}]}`,
//                 `{"people": []}` when it has none, which town_nav.py writes beside the nav graph
//   smallville.town.terrain3d_layers.json
//                 terrain3d's painted layer that flattens the ground under the whole town to 0, one flatten stroke,
//                 which procedural.py writes beside the glb
//   smallville.town.hollows.json
//                 the boxes lod3d draws no grass, trees or stones in: one round each building standing at elevation 0,
//                 which procedural.py writes beside the glb, handed to lod3d by world3d (`world3d.lod3d.ts`)
//   demo_world3d.field.json
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
import { packLooks } from '#scripts/pack-looks.ts'
import { PARTS } from '#plugins/world3d/world3d.sim.ts'
import player from './player.rig.json' with { type: 'json' }

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const exporter = path.join(root, 'plugins', 'anim', 'anim.export.py')
const merge = path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs')
// The places baked, each made into a scene of the game: a scene of the library's pro-ng/scenes (`pro`, without its
// `.json`) built by pro-ng's build, or a stronghold solver's run (`stronghold`, the solver's key) built by stronghold's
// (`stronghold/build.mjs`: the run, compiled into a pro-ng scene, then pro-ng's steps); its files written into
// `folder` (under this one), its pictures into `folder/looks/`, listed in the catalogue of the game's scene file
// `scene`, and its flatten laid into the field `field` (under this folder)
const PLACES: { pro?: string; stronghold?: string; folder: string; scene: string; field: string }[] = [
  { pro: 'castle/smallville/smallville.town', folder: '', scene: 'main.scene.json', field: 'demo_world3d.field.json' },
  { stronghold: 'winterfell/village', folder: 'village', scene: 'village.scene.json', field: 'village/village.field.json' },
  { stronghold: 'winterfell/tavern', folder: 'tavern', scene: 'tavern.scene.json', field: 'tavern/tavern.field.json' },
]
// what pro-ng's build writes for a scene, each `<name><suffix>`
const MADE = ['.glb', '.looks.json', '.clips.json', '.shapes3d.json', '.nav.json', '.terrain3d_layers.json', '.hollows.json', '.effects.json', '.crowd.json']

export default async ({ blender, scratch, library }: Tools) => {
  // each place made into every file a game boots from by the library's pro-ng (`pro-ng/build.mjs`), on core's Blender
  const { build } = await import(pathToFileURL(path.join(library, 'pro-ng', 'build.mjs')).href)
  for (const place of PLACES) {
    // a stronghold run's scene is named after its solver's last word, `<word>.art`
    const name = place.pro ? path.basename(place.pro) : `${path.basename(place.stronghold!)}.art`
    const out = scratch(name)
    if (place.pro) await build(place.pro, out, blender)
    else execFileSync(process.execPath, [path.join(library, 'stronghold', 'build.mjs'), place.stronghold!, out], { stdio: 'inherit' })
    const into = path.join(here, place.folder)
    fs.mkdirSync(into, { recursive: true })
    for (const suffix of MADE) {
      fs.copyFileSync(path.join(out, name + suffix), path.join(into, name + suffix))
      console.log('wrote', path.relative(root, path.join(into, name + suffix)))
    }
    // the looks file made supershader3d's, its settings in the table, not uniforms (`packLooks`)
    const looksFile = path.join(into, `${name}.looks.json`)
    const looks: Looks = packLooks(JSON.parse(fs.readFileSync(looksFile, 'utf8')))
    fs.writeFileSync(looksFile, JSON.stringify(looks, null, 1) + '\n')
    // the looks' pictures, the folder made again so no picture of an earlier bake is left
    fs.rmSync(path.join(into, 'looks'), { recursive: true, force: true })
    fs.mkdirSync(path.join(into, 'looks'))
    for (const p of looks.pictures) {
      fs.copyFileSync(path.join(out, 'looks', p.file), path.join(into, 'looks', p.file))
      console.log('wrote', path.relative(root, path.join(into, 'looks', p.file)))
    }
    // the place world3d's: its name, and each part of it an entry named as world3d reads it, standing where the entry of
    // its file stood in the catalogue, or after the rest
    const folder = `/games/demo_world3d/assets/${place.folder ? `${place.folder}/` : ''}`
    const sceneFile = path.join(here, '..', place.scene)
    const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
    scene.world.world3d = { ...scene.world.world3d, place: name }
    const parts = Object.fromEntries(PARTS.map(part => {
      const glb = part === 'glb'
      return [`${folder}${name}${glb ? '.glb' : `.${part}.json`}`, { name: `${name}.${part}`, entry: { type: glb ? 'binary' : 'json', url: `${folder}${name}${glb ? '.glb' : `.${part}.json`}`, preload: true } }]
    }))
    const catalogued: Record<string, { url: string }> = {}
    for (const [asset, a] of Object.entries(scene.world.loader.assets as Record<string, { url: string }>)) {
      const part = parts[a.url]
      if (part) catalogued[part.name] = part.entry
      else catalogued[asset] = a
    }
    for (const part of Object.values(parts)) catalogued[part.name] ??= part.entry
    scene.world.loader.assets = catalogued
    // each picture in the scene's catalogue by its name, a colour picture in sRGB and every other linear
    const url = `${folder}looks/`
    const assets: Record<string, { url: string }> = scene.world.loader.assets
    for (const [asset, a] of Object.entries(assets)) if (a.url.startsWith(url)) delete assets[asset]
    for (const p of looks.pictures) {
      assets[p.asset] = { type: 'texture', url: `${url}${p.file}`, ...(p.colour ? {} : { space: 'linear' }), wrap: 'repeat', preload: true } as any
    }
    fs.writeFileSync(sceneFile, JSON.stringify(scene, null, 2) + '\n')
    console.log('wrote', path.relative(root, sceneFile), `world3d's place ${name}, its catalogue's ${PARTS.length} parts and ${looks.pictures.length} pictures`)
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
