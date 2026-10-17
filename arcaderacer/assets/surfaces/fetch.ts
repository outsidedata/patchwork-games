// The CC0 PBR sets the courses' ground and road are textured with, and where each comes from. A set's
// three maps at full size, colour (sRGB), normal (OpenGL convention, +y up, as three reads it) and
// roughness, are kept in the library as `textures/<set's zip name>/` under the vendor's file names;
// `arcaderacer.bake.ts` cuts each to `<set>/<map>.webp`, 1024 pixels square, the files the game reads.
// Every set is CC0, from cc0-textures.com, which mirrors ambientCG (`cc0t`) and Poly Haven (`th`).
// Run on its own, it fetches every set the library lacks:
//
//   node --experimental-strip-types games/arcaderacer/assets/surfaces/fetch.ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { resolve } from '#scripts/health.ts'

// the folder each set is cut into, and where it comes from
export const SETS: Record<string, string> = {
  'forest-floor': 'cc0t/Ground037_4K-JPG.zip', // moss, needles and twigs: Cascade Forest's ground
  'mossy-rock': 'cc0t/Rock013_4K-JPG.zip', // grey rock with moss: its banks
  'concrete': 'cc0t/Concrete034_4K-JPG.zip', // pale cast concrete: Tokyo's ground
  'lawn': 'cc0t/Grass004_4K-JPG.zip', // mown grass: Tokyo's embankments
  'cobbles': 'th/cobblestone_floor_05_4K-JPG.zip', // setts in a dirty bed: Paris's ground
  'grimy-concrete': 'cc0t/Concrete035_4K-JPG.zip', // stained old concrete: Paris's banks
  'asphalt': 'cc0t/Asphalt015_4K-JPG.zip', // grey road asphalt: the day courses' road
  'asphalt-dark': 'cc0t/Asphalt010_4K-JPG.zip', // dark fresh asphalt: Paris's road
}

export type Map = 'colour' | 'normal' | 'roughness'

// which file of a set is which map, by the vendors' names for them
const MAPS: Record<Map, RegExp[]> = {
  colour: [/_color\./i, /_diff_/i, /basecolor/i],
  normal: [/normalgl/i, /_nor_gl_/i],
  roughness: [/_roughness\./i, /_rough_/i],
}

const pick = (names: string[], map: Map) => names.find(n => MAPS[map].some(r => r.test(path.basename(n))) && /\.(jpe?g|png)$/i.test(n))

// The full-size maps of the set cut into `name`, fetched into the library when it lacks them.
export const surface = async (name: string, library: string): Promise<Record<Map, string>> => {
  const source = SETS[name]
  const dir = path.join(library, 'textures', path.basename(source, '.zip'))
  const have = fs.existsSync(dir) ? fs.readdirSync(dir) : []
  const maps = Object.keys(MAPS) as Map[]
  if (!maps.every(m => pick(have, m))) {
    const response = await fetch(`https://download.cc0-textures.com/${source}`)
    if (!response.ok) throw new Error(`${name}: ${source} answered ${response.status}`)
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
    fs.mkdirSync(dir, { recursive: true })
    for (const map of maps) {
      const found = pick(Object.keys(files), map)
      if (!found) throw new Error(`${name}: no ${map} map among ${Object.keys(files).map(f => path.basename(f)).join(', ')}`)
      fs.writeFileSync(path.join(dir, path.basename(found)), files[found])
    }
  }
  const names = fs.readdirSync(dir)
  return Object.fromEntries(maps.map(m => [m, path.join(dir, pick(names, m)!)])) as Record<Map, string>
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { library } = resolve(process.cwd(), process.env)
  for (const name of Object.keys(SETS)) console.log(name, Object.values(await surface(name, library)).join(' '))
}
