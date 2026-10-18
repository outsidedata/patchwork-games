// demo_terrain3d's bake, `yarn bake demo_terrain3d` (core's `scripts/bake.ts`): every glb the scene's
// catalogue names, packed by gltfpack (meshopt geometry, WebP textures) from its raw export in the
// library's `props/demo_terrain3d`, and written where the catalogue reads it.
//   firs.glb     scatter3d's trees pack: tall, mid and small firs at their levels of detail
//   clumps.glb   scatter3d's clumps pack: the grasses, dry grasses, flowers and reeds
// The ground's maps, `ground/<name>-<map>-<size>.webp`, are cut by the bake itself from the cc0-textures
// sets `cc0-textures.json` names, before this runs, and never committed.
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname

export default async ({ library, pack }: Tools) => {
  await Promise.all(['firs.glb', 'clumps.glb'].map(async file => {
    const out = path.join(here, file)
    await pack(path.join(library, 'props', 'demo_terrain3d', file), out)
    console.log('wrote', path.relative(path.join(here, '..', '..', '..'), out))
  }))
}
