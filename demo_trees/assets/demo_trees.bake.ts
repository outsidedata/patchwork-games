// demo_trees' bake, `yarn bake demo_trees` (core's `scripts/bake.ts`): the one glb the scene's catalogue
// names, packed by gltfpack (meshopt geometry, WebP textures) and written where the catalogue reads it.
//   trees.glb   grown by the library's `trees/trees.py` (Blender's Sapling Tree Gen) from
//               `trees.trees.json`: every species of the library's `trees/species/`, one tree each, at
//               four levels of detail, named `<tree>-<lod>-<part>`, its leaves and its bark wearing the
//               cc0-textures leaf and bark sets their species name, which `texture` downloads into the
//               library first
// Change a species in the library or the spec here, bake again, and the page reloads with the new trees.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname

export default async ({ blender, pack, scratch, library, texture }: Tools) => {
  const spec = path.join(here, 'trees.trees.json')
  const { leafSets, barkSets } = await import(pathToFileURL(path.join(library, 'trees', 'trees.mjs')).href)
  for (const zip of [...leafSets(spec), ...barkSets(spec)] as string[]) await texture(zip)
  const raw = scratch('trees.glb')
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(library, 'trees', 'trees.py'), '--', spec, raw])
  const out = path.join(here, 'trees.glb')
  await pack(raw, out)
  console.log('wrote', path.relative(path.join(here, '..', '..', '..'), out))
}
