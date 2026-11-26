// demo_render3d's bake, `yarn bake demo_render3d` (core's `scripts/bake.ts`): every built file the scenes'
// catalogues name, written where they read it.
//   marks/hole.png, marks/scorch.png, marks/splat.png, marks/crack.png
//                        the pictures decal3d presses in the marks scene (`marks.decal3d.json`): `flipbooks`
//                        renders each still `marks/marksConfig.json` lists from its node tree, in Blender
// Change a node tree and bake again.
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname

export default async ({ flipbooks }: Tools) => {
  console.log(await flipbooks(path.join(here, 'marks', 'marksConfig.json')))
}
