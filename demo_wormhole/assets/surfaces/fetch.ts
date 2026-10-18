// The CC0 PBR sets the chamber's baked surfaces are made from, and where each comes from. A set is kept
// in the library flat, under its own name, as `textures/<set>/<set>.jpg` (colour, sRGB),
// `<set>.normal.jpg` (OpenGL convention, +y up, as Blender and three read it) and
// `<set>.roughness.jpg`, each at the vendor's full size; `panels.py` reads them there and
// `demo_wormhole.bake.ts` writes what it bakes from them into the game. Every set is CC0, from
// cc0-textures.com's mirror of ambientCG (`cc0t`). Run on its own, it fetches every set the library lacks:
//
//   node --experimental-strip-types games/demo_wormhole/assets/surfaces/fetch.ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { resolve } from '#scripts/health.ts'

// each set by the name a surface's `set` gives, and the zip it comes from
export const SETS: Record<string, string> = {
  metal029: 'cc0t/Metal029_4K-JPG.zip', // black steel, powder-coated, glossy: the panels a portal takes, and the crates
  metal027: 'cc0t/Metal027_4K-JPG.zip', // black steel, powder-coated, satin: the panels a portal refuses, and the ramps
}

export type Map = 'colour' | 'normal' | 'roughness'

// which file of a vendor's zip is which map, and the suffix it is kept under in the library
const MAPS: Record<Map, { vendor: RegExp; kept: string }> = {
  colour: { vendor: /_color\.jpe?g$/i, kept: '' },
  normal: { vendor: /_normalgl\.jpe?g$/i, kept: '.normal' },
  roughness: { vendor: /_roughness\.jpe?g$/i, kept: '.roughness' },
}

const kept = (library: string, set: string, map: Map) => path.join(library, 'textures', set, `${set}${MAPS[map].kept}.jpg`)

// The full-size maps of a set, fetched into the library when it lacks any of them.
export const surface = async (set: string, library: string): Promise<Record<Map, string>> => {
  const source = SETS[set]
  if (!source) throw new Error(`no set ${set} in surfaces/fetch.ts`)
  const maps = Object.keys(MAPS) as Map[]
  if (!maps.every(m => fs.existsSync(kept(library, set, m)))) {
    const response = await fetch(`https://download.cc0-textures.com/${source}`)
    if (!response.ok) throw new Error(`${set}: ${source} answered ${response.status}`)
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
    fs.mkdirSync(path.join(library, 'textures', set), { recursive: true })
    for (const map of maps) {
      const found = Object.keys(files).find(f => MAPS[map].vendor.test(path.basename(f)))
      if (!found) throw new Error(`${set}: no ${map} map among ${Object.keys(files).map(f => path.basename(f)).join(', ')}`)
      fs.writeFileSync(kept(library, set, map), files[found])
    }
  }
  return Object.fromEntries(maps.map(m => [m, kept(library, set, m)])) as Record<Map, string>
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { library } = resolve(process.cwd(), process.env)
  for (const set of Object.keys(SETS)) console.log(set, Object.values(await surface(set, library)).join(' '))
}
