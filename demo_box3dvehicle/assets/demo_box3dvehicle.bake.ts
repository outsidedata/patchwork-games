// demo_box3dvehicle's bake, `yarn bake demo_box3dvehicle` (core's `scripts/bake.ts`): the motorcycle's body and its two wheels from the
// library's pro-ng kit (`pro-ng/kit/modern/MOTORCYCLE_KIT.md`), each a pro-ng scene of one thing beside this file in `motorcycle/`:
//   body.kit.json         the compound modern/vehicles/motorcycle/motorcycle with Wheels false: every part but the wheels, its running
//                         gear the skeleton its ride clips pose, no hub models and no steering wheel (the bars are the fork's bones)
//   wheel-front.kit.json, wheel-rear.kit.json   modern/vehicles/motorcycle/wheels/wheel, End front (two discs) and rear (one disc and the
//                         sprocket's carrier): box3dvehicle draws one on each wheel row (`look.wheel`, a model for each axle)
//   kit.set.kit.json      the bike, the lit lamps and the two wheels in one scene, made only for its looks file: every material any of them
//                         draws, each lamp with its lit twin
// Each is cut in Blender by the library's `pro-ng/procedural.py` and packed by its `pro-ng/pack.mjs`, which writes the glb for supershader3d
// and its looks file beside it, `<name>.glb` and `<name>.looks.json` (which box3dvehicle's models mod reads the material names from); the
// set's looks file is made supershader3d's (`packLooks`) and written as `kit.looks.json`, the scene's `world.supershader3d.looks`, with every
// picture its looks read in `looks/`. The numbers of the bike's entry in `yard.scene.json` the ride clips are sampled by (each axle's spring
// `sag` and `travel`, the steering's `angle`) are written into the body scene's keys here, so the scene is the one place they are written.
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import type { Looks, Tools } from '#scripts/bake.ts'
import { packLooks } from '#scripts/pack-looks.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const SET = 'kit.set.kit'

type Entry = { axles: { spring: { sag: number; travel: number } }[]; steering: { angle: number } }
const bike = (): Entry => (JSON.parse(fs.readFileSync(path.join(here, '..', 'yard.scene.json'), 'utf8')) as { world: { box3dvehicle: { vehicles: { motorcycle: Entry } } } }).world.box3dvehicle.vehicles.motorcycle
const degrees = (radians: number) => Math.round(radians * 180 / Math.PI * 1e4) / 1e4

// The keys the bike's entry sets on the building that is its body, the springs and the steering's lock of the ride clips.
function rideKeys(): Record<string, number> {
  const v = bike()
  return { FrontSag: v.axles[0].spring.sag, FrontTravel: v.axles[0].spring.travel, RearSag: v.axles[1].spring.sag, RearTravel: v.axles[1].spring.travel, Lock: degrees(v.steering.angle) }
}
const withRide = (buildings: Record<string, unknown>[]) => buildings.map(b => (b.name === 'motorcycle' ? { ...b, ...rideKeys() } : b))

const node = (args: string[]) => new Promise<void>((done, fail) =>
  execFile(process.execPath, args, { maxBuffer: 1 << 26 }, (e, stdout, stderr) => (e ? fail(new Error(`${stdout}${stderr}`)) : done())))

// `scene` cut and packed in the scratch folder `key`, and the folder handed back
const cutter = ({ blender, scratch, library }: Tools) => async (scene: string, name: string, key: string) => {
  const out = scratch(key)
  fs.mkdirSync(out, { recursive: true })
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(library, 'pro-ng', 'procedural.py'), '--', 'file', scene, out])
  await node([path.join(library, 'pro-ng', 'pack.mjs'), path.join(out, `${name}.glb`)])
  return out
}

// A scene file written with the bike's ride keys set, one building a line.
function ridden(file: string) {
  const buildings = withRide((JSON.parse(fs.readFileSync(file, 'utf8')) as { buildings: Record<string, unknown>[] }).buildings)
  const text = `{\n "buildings": [\n${buildings.map(b => `  ${JSON.stringify(b)}`).join(',\n')}\n ]\n}\n`
  if (fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text)
}

export default async (tools: Tools) => {
  const cut = cutter(tools), { scratch } = tools
  const folder = path.join(here, 'motorcycle')
  for (const file of fs.readdirSync(folder).filter(f => f.endsWith('.kit.json')).sort()) {
    const name = file.replace(/\.json$/, '')
    if (file === 'body.kit.json') ridden(path.join(folder, file))
    const out = await cut(path.join(folder, file), name, `motorcycle-${name}`)
    for (const suffix of ['.glb', '.looks.json']) {
      fs.copyFileSync(path.join(out, name + suffix), path.join(folder, name + suffix))
      console.log('wrote', path.relative(root, path.join(folder, name + suffix)))
    }
  }
  // The set scene cut, its looks file written as `kit.looks.json` with every picture it reads in `looks/`.
  const set = JSON.parse(fs.readFileSync(path.join(here, `${SET}.json`), 'utf8')) as { buildings: Record<string, unknown>[] }
  set.buildings = withRide(set.buildings)
  const whole = path.join(scratch(`${SET}-scene`), `${SET}.json`)
  fs.mkdirSync(path.dirname(whole), { recursive: true })
  fs.writeFileSync(whole, JSON.stringify(set, null, 1))
  const out = await cut(whole, SET, SET)
  const looks: Looks = packLooks(JSON.parse(fs.readFileSync(path.join(out, `${SET}.looks.json`), 'utf8')))
  fs.writeFileSync(path.join(here, 'kit.looks.json'), JSON.stringify(looks, null, 1) + '\n')
  console.log('wrote', path.relative(root, path.join(here, 'kit.looks.json')))
  fs.rmSync(path.join(here, 'looks'), { recursive: true, force: true })
  if (looks.pictures.length) {
    fs.mkdirSync(path.join(here, 'looks'))
    for (const p of looks.pictures) fs.copyFileSync(path.join(out, 'looks', p.file), path.join(here, 'looks', p.file))
    console.log('wrote', path.relative(root, path.join(here, 'looks')), `${looks.pictures.length} pictures`)
  }
}
