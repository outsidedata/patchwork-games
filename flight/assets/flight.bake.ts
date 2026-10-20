// flight's bake, `yarn bake flight` (core's `scripts/bake.ts`): every glb the sky's catalogue names,
// exported plain by a Blender script beside it and packed by gltfpack (meshopt geometry, WebP textures),
// and the planes' pictures, each written where the catalogue reads it.
//   camel.glb, cessna.glb, trainer.glb   planes.py, the three planes, from nothing but their numbers in
//                                        `sky.scene.json`
//   camel.png, cessna.png, trainer.png   planes.py, each plane's picture for the pick screen, rendered
//                                        beside its glb
//   airport.glb                          airport.py, the airfield from the `airport` definition of
//                                        `flight.json`, its asphalt, concrete and steel the cc0-textures
//                                        sets Asphalt010, Concrete036 and CorrugatedSteel008A, through
//                                        `texture`
// The ground's maps, `ground/<name>-<map>-1024.webp`, are cut by the bake itself from the cc0-textures
// sets `cc0-textures.json` names, before this runs. The effects' sheet (`fx/fx.mjs`) reads nothing from
// the library and is written by its own script.
import fs from 'node:fs'
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const PLANES = ['camel', 'cessna', 'trainer']
const SETS = ['Asphalt010_4K-JPG', 'Concrete036_4K-JPG', 'CorrugatedSteel008A_4K-JPG']

export default async ({ blender, pack, scratch, texture }: Tools) => {
  const made = (file: string) => console.log('wrote', path.relative(path.join(here, '..', '..', '..'), file))

  const planes = async () => {
    const dir = scratch('planes')
    fs.mkdirSync(dir)
    await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(here, 'planes.py'), '--', dir, 'pictures'])
    for (const plane of PLANES) {
      const glb = path.join(here, `${plane}.glb`)
      await pack(path.join(dir, `${plane}.glb`), glb)
      made(glb)
      const png = path.join(here, `${plane}.png`)
      fs.copyFileSync(path.join(dir, `${plane}.png`), png)
      made(png)
    }
  }

  const airport = async () => {
    // each set's maps downloaded into the library first, then handed to the script by its folder
    const sets = await Promise.all(SETS.map(async zip => `${zip}=${path.dirname((await texture(zip)).color!)}`))
    const raw = scratch('airport.glb')
    await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(here, 'airport.py'), '--', raw, ...sets])
    const glb = path.join(here, 'airport.glb')
    await pack(raw, glb)
    made(glb)
  }

  await Promise.all([planes(), airport()])
}
