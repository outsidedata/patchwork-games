// arcaderacer's bake, `yarn bake arcaderacer` (core's `scripts/bake.ts`): every glb and texture the
// scene's catalogue names that is made from the library or by a Blender script beside it, written
// where the catalogue reads it. Each glb is exported plain by its script and packed by gltfpack
// (meshopt geometry, WebP textures); each surface map is cut from the library's full-size map to
// 1024 pixels square as WebP.
//   trees/firs.glb                     firs.py, from the library's `props/fir-trees`
//   paris/haussmann.glb                haussmann.py, high, its limestone and zinc from the library's `textures/`
//   paris/haussmann_medium.glb         haussmann.py, medium
//   paris/eiffel.glb, paris/lamp.glb   eiffel.py and lamp.py, from nothing
//   title/title.glb                    title.py, the title's words in 3D, from the Orbitron font beside it
//   supercar/supercar.glb              supercar.py builds the car and saves its scene; export_glb.py
//                                      exports the car from it, in a Blender of its own
//   surfaces/<set>/<map>.webp          the sets of surfaces/fetch.ts, fetched into the library when it lacks them
// The effects' sheet (`fx/fx.mjs`) and the songs (`music/jungle.song.ts`) read nothing from the library
// and are written by their own scripts.
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'
import { SETS, surface, type Map } from './surfaces/fetch.ts'

const here = import.meta.dirname
const script = (file: string) => path.join(here, file)

export default async ({ blender, pack, webp, scratch, library }: Tools) => {
  const made = (file: string) => console.log('wrote', path.relative(path.join(here, '..', '..', '..'), file))

  const glb = async (out: string, make: (raw: string) => Promise<unknown>) => {
    const raw = scratch(out.replace(/\//g, '_'))
    await make(raw)
    await pack(raw, path.join(here, out))
    made(path.join(here, out))
  }
  const python = (file: string, ...args: string[]) => (raw: string) =>
    blender(['--factory-startup', '--python', script(file), '--', ...args, raw])

  await Promise.all([
    glb('trees/firs.glb', python('trees/firs.py')),
    glb('paris/haussmann.glb', python('paris/haussmann.py', 'high')),
    glb('paris/haussmann_medium.glb', python('paris/haussmann.py', 'medium')),
    glb('paris/eiffel.glb', python('paris/eiffel.py')),
    glb('paris/lamp.glb', python('paris/lamp.py')),
    glb('title/title.glb', python('title/title.py')),
    glb('supercar/supercar.glb', async raw => {
      const scene = scratch('supercar.blend')
      await blender(['--factory-startup', '--python', script('supercar/supercar.py'), '--', scene])
      await blender([scene, '--python', script('supercar/export_glb.py'), '--', raw])
    }),
    ...Object.keys(SETS).map(async set => {
      const maps = await surface(set, library)
      await Promise.all((Object.keys(maps) as Map[]).map(async map => {
        const out = path.join(here, 'surfaces', set, `${map}.webp`)
        await webp(maps[map], out, 1024)
        made(out)
      }))
    }),
  ])
}
