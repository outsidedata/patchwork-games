// demo_wormhole's bake, `yarn bake demo_wormhole` (core's `scripts/bake.ts`): every baked surface of
// `chamber.surfaces` in `demo_wormhole.json` (each one with a `set`, a cc0-textures set's name), made by
// `surfaces/panels.py` in Blender from the set's full-size maps, which the bake's `texture` takes from
// the library (downloading the set first when it is not there), and cut to the surface's `size` as
// WebP. Each map is written where the scene's catalogue reads it: the url of the entry the surface's
// `maps` (and its `glow.map`) names, in `demo_wormhole.partial_scene.json`'s `world.loader.assets`.
//   surfaces/<surface>/colour.webp, normal.webp, roughness.webp, and glow.webp for a surface with a glow
import fs from 'node:fs'
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const defsFile = path.join(here, 'demo_wormhole.json')
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

type Surface = { set?: string; size: number; maps: Record<'colour' | 'normal' | 'roughness', string>; glow?: { map: string } }

export default async ({ blender, webp, scratch, texture }: Tools) => {
  const surfaces: Record<string, Surface> = read(defsFile).chamber.surfaces
  const catalogue: Record<string, { url: string }> = read(path.join(here, '..', 'demo_wormhole.partial_scene.json')).world.loader.assets
  const at = (entry: string) => {
    const found = catalogue[entry]
    if (!found) throw new Error(`no catalogue entry ${entry} in demo_wormhole.partial_scene.json`)
    return path.join(root, found.url)
  }
  await Promise.all(Object.entries(surfaces).filter(([, s]) => s.set).map(async ([name, s]) => {
    const maps = await texture(s.set!)
    const raw = scratch(name)
    await blender(['--factory-startup', '--python', path.join(here, 'surfaces', 'panels.py'), '--', defsFile, name, maps.color!, maps.normal!, maps.roughness!, raw])
    const made = [...Object.entries(s.maps), ...(s.glow ? [['glow', s.glow.map]] : [])]
    await Promise.all(made.map(async ([map, entry]) => {
      const out = at(entry)
      await webp(path.join(raw, `${map}.png`), out, s.size)
      console.log('wrote', path.relative(root, out))
    }))
  }))
}
