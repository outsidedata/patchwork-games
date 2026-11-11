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
//                 the place's people, which town_nav.py writes beside the nav graph: `verbs` (`{id, clips, type}`),
//                 `activities` (`{id, verbs}`), `landmarks` (`{<whole name>: {at, yaw, activities}}`) and `people`
//                 (`{person, model, chains, activities?}`); each verb's clips and each person's model, files in
//                 ~/troupe-collection, written as the names player.rig.json gives the clips and the bodies of those
//                 files
//   smallville.town.terrain3d_layers.json
//                 terrain3d's painted layer that flattens the ground under the whole town to 0, one flatten stroke,
//                 which procedural.py writes beside the glb; for a place laid on the land (`at`, below), what its
//                 solver cut into the land instead: its streets benched, its pads flattened, its ways painted
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
//                 jump, the torch stance's tcidle, tcwalk, tcrun, tcjump, and every clip the crowd files' verbs play)
//                 baked onto it by anim's export
//                 (`plugins/anim/anim.export.py`). crowd3d plays idle, walk and run; anim plays by the table
//                 the export measures on castle_walker, the rig's first body, written back into the rig in
//                 the rig's own layout (`.claude/skills/using-mixamo-assets/scripts/merge-table.mjs`).
//   xbot.glb, xbot.rig.baked.json, xbot.motion3d.baked.json
//                 the hills' hero, as demo_motion3d bakes it: Mixamo's X Bot with every clip of `xbot.rig.json`,
//                 the rig's measures, and each clip's offsets from `xbot.motion3d.json` (`motion3d.offsets.ts`)
//   zombie.glb, zombie_man.glb
//                 the hills' mobs' bodies, the library's `characters/zombie` and `characters/zombie_man`, each with every
//                 clip of `zombie.rig.json` (the Scary
//                 Zombie pack's idle, walk, run, death and attack, the Not So Scary pack's hit reaction) baked onto it by
//                 anim's export, its table written back into the rig
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
// `scene`, and its flatten laid into the field `field` (under this folder). A stronghold place with `at` is laid on
// the land of its field: its solver is handed the field, its own earlier layers taken out, and the point [x, z] on it
// its (0, 0) stands at (its asks' `ground`, the library's stronghold/src/lib/util/ground.mjs, which makes the land
// with core's own terrain3d, `PATCHWORK_CORE`), and the layer it hands back, what it cut into the land, is the place's
// painted layer in place of one flatten under the whole place. A stronghold place's `overrides` (under this folder) is
// its override strings, `{ "<key chain>": value }`, handed to its solver in its asks: each one either resolves on
// what the solvers placed or is refused in the run, by its key chain.
const PLACES: { pro?: string; stronghold?: string; folder: string; scene: string; field: string; at?: [number, number]; overrides?: string }[] = [
  // { pro: 'castle/smallville/smallville.town', folder: '', scene: 'main.scene.json', field: 'demo_world3d.field.json' },
  // { stronghold: 'winterfell/village', folder: 'village', scene: 'village.scene.json', field: 'village/village.field.json' },
  // { stronghold: 'winterfell/tavern', folder: 'tavern', scene: 'tavern.scene.json', field: 'tavern/tavern.field.json' },
  { stronghold: 'winterfell/village-terrain3d', folder: 'hills', scene: 'hills.scene.json', field: 'hills/hills.field.json', at: [0, 0], overrides: 'hills/hills.overrides.json' },
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
    else if (place.at) {
      // the land the solver is laid on: the field with no layers, every one of them the place's own from a bake before
      const land = scratch(`${name}.land.json`)
      fs.writeFileSync(land, JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(here, place.field), 'utf8')), layers: [] }))
      const asks = scratch(`${name}.asks.json`)
      const overrides = place.overrides ? JSON.parse(fs.readFileSync(path.join(here, place.overrides), 'utf8')) : {}
      fs.writeFileSync(asks, JSON.stringify({ ground: { field: land, at: place.at }, overrides }))
      execFileSync(process.execPath, [path.join(library, 'stronghold', 'build.mjs'), place.stronghold!, out, '--config', asks], { stdio: 'inherit', env: { ...process.env, PATCHWORK_CORE: root } })
    }
    else execFileSync(process.execPath, [path.join(library, 'stronghold', 'build.mjs'), place.stronghold!, out], { stdio: 'inherit' })
    const into = path.join(here, place.folder)
    fs.mkdirSync(into, { recursive: true })
    for (const suffix of MADE) {
      fs.copyFileSync(path.join(out, name + suffix), path.join(into, name + suffix))
      console.log('wrote', path.relative(root, path.join(into, name + suffix)))
    }
    // the crowd file's verbs, each clip named as the rig names the clip of that file, the name its bodies play it by
    const crowdFile = path.join(into, `${name}.crowd.json`)
    const crowd = JSON.parse(fs.readFileSync(crowdFile, 'utf8'))
    const clipOf = new Map(Object.entries(player.clips).map(([clip, c]) => [c.file, clip]))
    for (const verb of crowd.verbs) {
      verb.clips = verb.clips.map((file: string) => {
        const clip = clipOf.get(file)
        if (!clip) throw new Error(`demo_world3d's bake: the verb ${verb.id} plays ${file}, which no clip of player.rig.json is`)
        return clip
      })
    }
    // each person's model named as the rig names the body of that file, the name the game draws it by
    for (const person of crowd.people) {
      const body = Object.entries(player.bodies).find(([, file]) => file.endsWith(`/${person.model}`))?.[0]
      if (!body) throw new Error(`demo_world3d's bake: the person ${person.person} is ${person.model}, which no body of player.rig.json is`)
      person.model = body
    }
    fs.writeFileSync(crowdFile, JSON.stringify(crowd))
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

  // the hills' hero, copied from demo_motion3d's bake: Mixamo's X Bot with every clip of `xbot.rig.json` baked onto
  // it, the rig's measures, and each clip's offsets from `xbot.motion3d.json`
  const xrig = path.join(here, 'xbot.rig.json'), xtable = scratch('xbot.table.json'), xglb = path.join(here, 'xbot.glb')
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', exporter, '--', xrig, xtable, `xbot=${xglb}`])
  console.log('wrote', path.relative(root, xglb))
  const xmerged = scratch('xbot.merged.json')
  execFileSync(process.execPath, [merge, xrig, xtable, xmerged], { stdio: 'inherit' })
  const { table: measured, ends, grips, touches } = JSON.parse(fs.readFileSync(xmerged, 'utf8'))
  const xbaked = path.join(here, 'xbot.rig.baked.json')
  fs.writeFileSync(xbaked, JSON.stringify({ table: measured, ends, grips, touches }) + '\n')
  console.log('wrote', path.relative(root, xbaked))
  execFileSync(process.execPath, ['--experimental-strip-types', path.join(root, 'plugins', 'motion3d', 'motion3d.offsets.ts'), xrig, path.join(here, 'xbot.motion3d.json')], { stdio: 'inherit' })

  // the hills' mobs: the library's `characters/zombie/zombie.fbx` and `characters/zombie_man/zombie_man.fbx` with every
  // clip of `zombie.rig.json` baked onto each by anim's export, and the table, measured on the first, written back into
  // the rig
  const zrig = path.join(here, 'zombie.rig.json'), ztable = scratch('zombie.table.json'), zglb = path.join(here, 'zombie.glb')
  const zmglb = path.join(here, 'zombie_man.glb')
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', exporter, '--', zrig, ztable, `zombie=${zglb}`, `zombie_man=${zmglb}`])
  console.log('wrote', path.relative(root, zglb))
  console.log('wrote', path.relative(root, zmglb))
  execFileSync(process.execPath, [merge, zrig, ztable, zrig], { stdio: 'inherit' })
  console.log('wrote', path.relative(root, zrig), 'its table')
}
