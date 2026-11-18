// The posing page for a body of hung layouts: the kind `?kind=` names (`rider` when it names none) from
// `assets/demo_puppet3d.json`, its world layout standing at its rest, each other layout posed by its cues
// driver's cue sheet through puppet3d's own `played`, hung by puppet3d's own `hung` and skinned by its `skinned`, so
// what it shows is what the game draws. The camera orbits freely (drag, wheel), with buttons for the
// side, front, back and top. The sliders set the senses the cues read; `R` reads the definition again.
// A solver driver's layout is not stood here: the world layout shows its rest skeleton.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { cued, hung, played, posed, skinned, type Bone, type BoneCues, type Cue, type Skeleton, type Skinned, type V3 } from '../../plugins/puppet3d/puppet3d.plugin.ts'
import file from './main.scene.json' with { type: 'json' }

type Layout = { layout: string; on: string; along?: number; offset?: V3; turn?: V3; skeleton: string; skin: string; drivers: ({ name: string; weight: Cue[]; cues?: string; solver?: string })[] }

const kind = new URLSearchParams(location.search).get('kind') ?? 'rider'
const assets = file.world.loader.assets as Record<string, { url: string }>
const url = (entry: string) => assets[entry].url

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(devicePixelRatio)
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = THREE.NeutralToneMapping
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#20242c')
scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3226', 1.6))
const sun = new THREE.DirectionalLight('#ffffff', 2.2)
sun.position.set(3, 6, 2)
scene.add(sun)
scene.add(new THREE.GridHelper(6, 24, '#556', '#334'))
scene.add(new THREE.AxesHelper(0.5))
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 100)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.3, 0.4)
const views: Record<string, V3> = { side: [4, 1.6, 0.4], front: [0, 1.6, 4.4], back: [0, 1.6, -3.6], top: [0.01, 5.5, 0.4] }
const look = (v: V3) => { camera.position.set(...v); controls.update() }
look(views.side)
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const json = async (u: string) => (await fetch(u, { cache: 'no-store' })).json()
const senses: Record<string, number> = { clock: 0, speed: 0, stride: 0, upright: 0, upstride: 0 }
const ranges: Record<string, [number, number]> = { clock: [0, 20], speed: [0, 12], stride: [0, 1], upright: [0, 1], upstride: [0, 1] }

let layouts: { name: string; L: Layout; rest: Bone[]; body: Skinned }[] = []
let sheets: Record<string, BoneCues> = {}
const m = new THREE.Matrix4()
const readout = document.getElementById('readout')!

async function load() {
  for (const l of layouts) { for (const j of l.body.joints) scene.remove(j); scene.remove(l.body.body); l.body.geometry.dispose() }
  layouts = []
  const defs = await json(url(file.world.defs))
  const d = defs[kind] as { layouts: Record<string, Layout> }
  sheets = {}
  for (const L of Object.values(d.layouts)) for (const x of L.drivers) if (x.cues) sheets[x.cues] ??= await json(url(x.cues))
  for (const [name, L] of Object.entries(d.layouts)) {
    const sk = await json(url(L.skeleton)) as Skeleton
    const glb = await loader.loadAsync(url(L.skin))
    layouts.push({ name, L, rest: sk.bones, body: skinned(THREE, scene, glb.scene, { ...sk, entry: L.skeleton }, L.skin) })
  }
  draw()
}

function draw() {
  const done: Record<string, Bone[]> = {}
  for (const { name, L, rest, body } of layouts) {
    const cues = L.drivers.filter(x => !x.solver && x.cues)
    let own = rest
    if (cues.length) {
      const x = cues[0]
      own = played(`${kind}'s ${x.name}`, rest, sheets[x.cues!], senses)
      readout.textContent = `${kind}: ${name} posed by ${x.name} (weight ${cued('weight', x.weight, senses).toFixed(2)})`
    }
    if (L.on !== 'world') {
      const [parent, bone] = L.on.split(':'), on = done[parent].find(b => b.name === bone)!
      own = hung(own, on, { along: L.along!, offset: L.offset!, turn: L.turn! })
    }
    done[name] = own
    posed(THREE, body.joints, own, m)
  }
}

const panel = document.getElementById('panel')!
for (const [v, at] of Object.entries(views)) {
  const b = document.createElement('button')
  b.textContent = v
  b.onclick = () => look(at)
  panel.appendChild(b)
}
for (const s of Object.keys(senses)) {
  const row = document.createElement('label'), input = document.createElement('input'), value = document.createElement('span')
  const [lo, hi] = ranges[s]
  input.type = 'range'; input.min = String(lo); input.max = String(hi); input.step = String((hi - lo) / 400); input.value = '0'
  input.oninput = () => { senses[s] = Number(input.value); value.textContent = senses[s].toFixed(2); draw() }
  value.textContent = '0.00'
  row.append(s, input, value)
  panel.appendChild(row)
}
addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') void load() })
;(window as any).__pose = { senses, draw, load, look }

await load()
renderer.setAnimationLoop(() => renderer.render(scene, camera))
