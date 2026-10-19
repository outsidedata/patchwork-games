// demo_terrain3d's bake, `yarn bake demo_terrain3d` (core's `scripts/bake.ts`): every glb the scene's
// catalogue names, made by a Blender script beside it from the library's raw props, packed by gltfpack
// (meshopt geometry, WebP textures) and written where the catalogue reads it.
//   firs.glb     firs.py, from the library's `props/fir-trees`: scatter3d's trees pack, the tall, mid
//                and small firs at their four levels of detail
//   clumps.glb   clumps.py, from the library's `props/lod-grass`: scatter3d's clumps pack, the
//                grasses, dry grasses, flowers and reeds at their two levels of detail
// The ground's maps, `ground/<name>-<map>-<size>.webp`, are cut by the bake itself from the cc0-textures
// sets `cc0-textures.json` names, before this runs, and never committed.
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname

export default async ({ blender, pack, scratch }: Tools) => {
  await Promise.all(['firs', 'clumps'].map(async name => {
    const raw = scratch(`${name}.glb`)
    await blender(['--factory-startup', '--python', path.join(here, `${name}.py`), '--', raw])
    const out = path.join(here, `${name}.glb`)
    await pack(raw, out)
    console.log('wrote', path.relative(path.join(here, '..', '..', '..'), out))
  }))
}
