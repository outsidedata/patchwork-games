// demo_supershader3d's bake, `yarn bake demo_supershader3d` (core's `scripts/bake.ts`): the scene's one
// shader, put together from the library's pro-ng looks (`pro-ng/material/looks/`) by the bake's
// `looks` tool, written beside this file.
//   main.looks.json   the materials below in the order a vertex's `lookId` counts them, each a look of
//                     the library's and its settings: the ground's grass, sand and sandstone, the kit's
//                     rock (Rock013's pictures, taken grey and tinted) and timber (Wood036's pictures),
//                     and the cobbles, a relief look with the sun's shadow marched inside it; the GLSL
//                     of each draw call, every setting in the settings table, the shared textures it reads and its
//                     pictures in the stack's order
//   looks/<file>.webp the pictures those looks read, each cut from its cc0-textures set in the library
//                     to 1024 pixels square, named after the set's file, which the scene's catalogue
//                     lists by that name
// Change a material here, or a look in the library, and bake again.
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname

export default async ({ looks }: Tools) => {
  const made = await looks({
    materials: {
      grass: { look: 'grass', colour: '#2679e6' },
      sand: { look: 'sand', colour: '#7fe626' },
      sandstone: { look: 'sandstone', colour: '#e64326' },
      rock: { look: 'rock', colour: '#8c8c8c' },
      timber: { look: 'timber', colour: '#8a5a2b', settings: { repeat: 1 } },
      cobble: { look: 'cobble', colour: '#9a8f7c' },
    },
    out: path.join(here, 'main.looks.json'),
    pictures: path.join(here, 'looks'),
  })
  const calls = (['solid', 'relief', 'seeThrough'] as const).filter(c => made.calls[c])
  console.log(`wrote games/demo_supershader3d/assets/main.looks.json: ${made.materials.length} materials, ${made.pictures.length} pictures, ${calls.length} draw calls (${calls.join(', ')})`)
  for (const p of made.pictures) console.log(`wrote games/demo_supershader3d/assets/looks/${p.file}`)
}
