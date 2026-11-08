// demo_lights3d's bake, `yarn bake demo_lights3d` (core's `scripts/bake.ts`): the kit the glow scene stands, made by
// the library's pro-ng in one build (`pro-ng/build.mjs`: the textures, the cut, the pack and the ways), run on core's
// Blender, and copied in beside this file:
//   kit-glow.glb  the library's pro-ng scene `pro-ng/scenes/kit_demos/kit-glow.json`, its kit cut in Blender
//                 (`pro-ng/procedural.py`), each vertex its material's number, its thing's row and its part, and the
//                 slots its look reads, packed by `pro-ng/pack.mjs`, drawn by `stage.client.ts` through supershader3d
//   kit-glow.looks.json, looks/<file>.webp
//                 the kit's one shader, supershader3d's file, and the pictures it reads, which pack.mjs writes beside
//                 the glb (`pro-ng/look_bake.mjs`), its settings then moved into supershader3d's settings table by
//                 core's `packLooks` (`scripts/pack-looks.ts`); each picture listed in the glow scene's catalogue
//                 (`glow.scene.json`) by its name, the entries of an earlier bake's pictures taken out first
// Change the scene, a kind, a material or a look in the library and bake again.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Looks, Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
// the pro-ng scene baked, and the game's scene whose catalogue lists its pictures
const PRO = 'kit_demos/kit-glow'
const SCENE = 'glow.scene.json'
// what pro-ng's build writes for it that the glow scene reads, each `<name><suffix>`
const MADE = ['.glb', '.looks.json']
// the materials the glow scene's people wear, which no kit thing does
const WORN = ['spirit_glow']

export default async (tools: Tools) => {
  const { blender, scratch, library } = tools
  const { build } = await import(pathToFileURL(path.join(library, 'pro-ng', 'build.mjs')).href)
  const name = path.basename(PRO)
  const out = scratch(name)
  await build(PRO, out, blender)
  for (const suffix of MADE) {
    fs.copyFileSync(path.join(out, name + suffix), path.join(here, name + suffix))
    console.log('wrote', path.relative(root, path.join(here, name + suffix)))
  }
  // the looks file composed again: the glb's materials in the order its vertices count them, then those only the
  // game's people wear (WORN), each from the library's pro-ng/materials.json
  const looksFile = path.join(here, `${name}.looks.json`)
  const used: string[] = JSON.parse(fs.readFileSync(looksFile, 'utf8')).materials.map((m: { name: string }) => m.name)
  const table = JSON.parse(fs.readFileSync(path.join(library, 'pro-ng', 'materials.json'), 'utf8')).materials
  const materials: Record<string, { look: string; settings?: Record<string, number | number[]>; colour?: string }> = {}
  for (const n of [...used, ...WORN]) materials[n] = { look: table[n].look, settings: table[n].settings, colour: table[n].colour }
  const looks: Looks = await tools.looks({ materials, out: looksFile, pictures: scratch('looks') })
  // the looks' pictures, the folder made again so no picture of an earlier bake is left
  fs.rmSync(path.join(here, 'looks'), { recursive: true, force: true })
  fs.mkdirSync(path.join(here, 'looks'))
  for (const p of looks.pictures) {
    fs.copyFileSync(path.join(scratch('looks'), p.file), path.join(here, 'looks', p.file))
    console.log('wrote', path.relative(root, path.join(here, 'looks', p.file)))
  }
  // each picture in the scene's catalogue by its name, a colour picture in sRGB and every other linear
  const url = '/games/demo_lights3d/assets/looks/'
  const sceneFile = path.join(here, '..', SCENE)
  const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
  const assets: Record<string, { url: string }> = scene.world.loader.assets
  for (const [asset, a] of Object.entries(assets)) if (a.url.startsWith(url)) delete assets[asset]
  for (const p of looks.pictures) {
    assets[p.asset] = { type: 'texture', url: `${url}${p.file}`, ...(p.colour ? {} : { space: 'linear' }), wrap: 'repeat', preload: true } as any
  }
  fs.writeFileSync(sceneFile, JSON.stringify(scene, null, 2) + '\n')
  console.log('wrote', path.relative(root, sceneFile), `its catalogue's ${looks.pictures.length} pictures`)
}
