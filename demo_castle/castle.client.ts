// The fortress drawn as the library's procedural-castle cuts it (its `procedural.py`, the scene
// `procedural-castle/scenes/fortress.json`), no stone laid: each building one solid, the stone or the wood the
// material's (`castle.material.ts`) on every face, each building's courses its own; the roofs' coverings, shingles and
// boards in the wood's material and slate in the stone's, each sized for it; the stairs, timber floors, roofs and
// supports in the look `timber`. Each from the files the definition names (`solids`): the solids' layout and every
// building's courses (`info`), and the solids', coverings' and timber's vertices (`solids`, `cover`, `timber`), each
// vertex its floats as procedural.py wrote them; and the pictures the materials read (`pictures`). Everything casts
// and takes shadows. Under it the land, a square `land.size` metres across in `land.colour` and `land.roughness`, at
// y = 0, where the walkers stand where no shape is.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { createStone, createWood, type Dress, type Pictures } from './castle.material.ts'

type Info = {
  depth: number
  stride: number
  buildings: { name: string; material: 'stone' | 'wood'; triangles: number; courses: number[] }[]
  covers: { covering: 'shingles' | 'boards' | 'slate'; triangles: number }[]
  timber: { stride: number }
}

let built: THREE.Object3D[] = []
let disposers: (() => void)[] = []
let land: THREE.Mesh | undefined
let ticks: (() => void)[] = []
let gone = false

// a binary file's bytes as floats
const floats = (thing: { bytes: Uint8Array }) => {
  const b = thing.bytes
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const dress: Dress = m => plugins.render3d.dress(m)
  const k = def(plugins.wire, row.kind)
  const pictureNames = Object.entries(k.pictures as Record<keyof Pictures, string>)
  const names = [k.solids.info, k.solids.solids, k.solids.cover, k.solids.timber, ...pictureNames.map(([, name]) => name)]
  // An actor is set up before the loader's first tick, so the fortress is built once every file has landed.
  Promise.all(names.map(name => plugins.loader.load(name))).then(([info, solidsFile, coverFile, timberFile, ...pics]: any[]) => {
    if (gone) return
    const pictures = Object.fromEntries(pictureNames.map(([key], i) => [key, pics[i]])) as Pictures
    build(T, dress, plugins, info as Info, floats(solidsFile), floats(coverFile), floats(timberFile), pictures)
  })
  const skin = plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.land.colour, roughness: k.land.roughness }))
  land = new T.Mesh(new T.PlaneGeometry(k.land.size, k.land.size).rotateX(-Math.PI / 2), skin)
  land.receiveShadow = true
  plugins.render3d.scene.add(land)
}

// a geometry of a wall's vertices as procedural.py writes them: place 3, normal 3, uv 2, wT 3, wB 3, wall 4, wfix 2
function wallGeometry(T: typeof THREE, data: Float32Array, stride: number) {
  const buffer = new T.InterleavedBuffer(data, stride)
  const geo = new T.BufferGeometry()
  const at = (name: string, size: number, offset: number) => geo.setAttribute(name, new T.InterleavedBufferAttribute(buffer, size, offset))
  at('position', 3, 0)
  at('normal', 3, 3)
  at('uv', 2, 6)
  at('wT', 3, 8)
  at('wB', 3, 11)
  at('wall', 4, 14)
  at('wfix', 2, 18)
  return geo
}

function build(T: typeof THREE, dress: Dress, plugins: Plugins, info: Info, solids: Float32Array, cover: Float32Array, timber: Float32Array, pictures: Pictures) {
  const scene = plugins.render3d.scene as THREE.Scene
  const place = (mesh: THREE.Mesh) => {
    mesh.castShadow = mesh.receiveShadow = true
    scene.add(mesh)
    built.push(mesh)
  }
  // the solids: each building's triangles, in order, drawn by its material, the stone's (0) or the wood's (1)
  const stone = createStone(T, dress, { rows: info.buildings.length, depth: info.depth, pictures })
  info.buildings.forEach((b, row) => stone.courses(row, b.courses))
  const wood = createWood(T, dress, { courseTex: stone.courseTex, depth: info.depth, pictures })
  const geo = wallGeometry(T, solids, info.stride)
  let start = 0
  for (const b of info.buildings) {
    geo.addGroup(start, b.triangles * 3, b.material === 'wood' ? 1 : 0)
    start += b.triangles * 3
  }
  geo.computeBoundingSphere()
  place(new T.Mesh(geo, [stone.material, wood.material]))
  ticks.push(stone.tick)
  disposers.push(() => geo.dispose(), stone.dispose, wood.dispose)

  // the roofs' coverings, each vertex as the solids' (a slab), each covering its own material on the walls' layout:
  // shingles and boards the wood's, slate the stone's, each sized for it (procedural-castle's viewer's sizes)
  if (cover.length) {
    const kinds = ['shingles', 'boards', 'slate'] as const
    const shingles = createWood(T, dress, { courseTex: stone.courseTex, depth: info.depth, pictures, knobs: {
      stoneMin: 0.14, stoneMax: 0.34, rowMin: 0.18, rowMax: 0.18, joint: 0.006, gap: 0.012, edgeRound: 0.004,
      edgeDrop: 0.004, corner: 0.002, cup: 0.0, tilt: 0.006, grain: 0.003, valueVar: 0.22, pom: 0.02 } })
    const boards = createWood(T, dress, { courseTex: stone.courseTex, depth: info.depth, pictures, knobs: {
      stoneMin: 100.0, stoneMax: 100.0, rowMin: 0.25, rowMax: 0.25, joint: 0.006, cup: 0.003, pom: 0.02 } })
    const slate = createStone(T, dress, { rows: 1, depth: info.depth, pictures, knobs: {
      stoneMin: 0.2, stoneMax: 0.32, rowMin: 0.17, rowMax: 0.17, joint: 0.004, recess: 0.008, edgeRound: 0.006,
      edgeDrop: 0.004, corner: 0.01, chip: 0.006, bulge: 0.0, tilt: 0.004, detail: 0.002, valueVar: 0.1, warm: 0.15,
      dark: 0.12, mottle: 0.1, grime: 0.15, damp: 0.0, moss: 0.15, rockScale: 0.8, pom: 0.015 },
    colours: { stone: new T.Color(0.075, 0.08, 0.09), mortar: new T.Color(0.05, 0.05, 0.055) } })
    const coverGeo = wallGeometry(T, cover, info.stride)
    let at = 0
    for (const c of info.covers) {
      coverGeo.addGroup(at, c.triangles * 3, kinds.indexOf(c.covering))
      at += c.triangles * 3
    }
    coverGeo.computeBoundingSphere()
    place(new T.Mesh(coverGeo, [shingles.material, boards.material, slate.material]))
    ticks.push(slate.tick)
    disposers.push(() => coverGeo.dispose(), shingles.dispose, boards.dispose, slate.dispose)
  }

  // the timber: each vertex its place, normal and uv as procedural.py wrote them, in the look `timber`
  if (timber.length) {
    const buffer = new T.InterleavedBuffer(timber, info.timber.stride)
    const woodGeo = new T.BufferGeometry()
    woodGeo.setAttribute('position', new T.InterleavedBufferAttribute(buffer, 3, 0))
    woodGeo.setAttribute('normal', new T.InterleavedBufferAttribute(buffer, 3, 3))
    woodGeo.setAttribute('uv', new T.InterleavedBufferAttribute(buffer, 2, 6))
    woodGeo.computeBoundingSphere()
    const skin = dress(new T.MeshStandardMaterial({
      map: pictures.woodCol, normalMap: pictures.woodNrm, roughnessMap: pictures.woodRough, metalness: 0, shadowSide: T.FrontSide,
    }))
    place(new T.Mesh(woodGeo, skin))
    disposers.push(() => woodGeo.dispose(), () => skin.dispose())
  }
}

export function tick() {
  for (const f of ticks) f()
}

export function remove(plugins: Plugins) {
  gone = true
  for (const o of built) plugins.render3d.scene.remove(o)
  for (const f of disposers) f()
  if (land) {
    plugins.render3d.scene.remove(land)
    land.geometry.dispose()
    ;(land.material as THREE.Material).dispose()
  }
  built = []
  disposers = []
  ticks = []
  land = undefined
}
