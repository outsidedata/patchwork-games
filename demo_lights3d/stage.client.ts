// The stage the lights are tried on, drawn from the set of its definition (`assets/demo_lights3d.json`)
// its row's `set` names. A set has any of these parts:
//   room        [width, height, depth]: a floor and a back wall and two side walls of `wallColour`, open
//               to the front and above, so the camera looks in; without one, `floor`, a floor that many
//               metres square. The floor is `floorColour` and `floorRoughness`.
//   things      boxes (`size` [x, y, z], turned `turn` degrees) and spheres (`size` [across]) of
//               `colour`, `roughness` (0.55 when left out) and `metalness` (0), each standing on the
//               floor at `at`; with `repeat: { across, deep, spacing: [x, z] }`, that many in rows from
//               `at`, `spacing` apart
//   lamps.wall  a point light every `every` metres along the back and side walls, `height` up and `out`
//               off the wall, of `intensity`, `distance` and `decay`, its colour the next of `colours`,
//               casting a shadow where `shadow` is true
//   lamps.spots spot lights hung `height` up over each [x, z] of `at`, pointing down, each the next of
//               `colours`, casting a shadow where `shadow` is true, each aim sweeping a circle `sweep`
//               metres round its point at `sweepSpeed` turns a second, each a little behind the one
//               before
//   lamps.field `across` × `deep` point lights `spacing` apart, `height` up, of `intensity`, `distance`
//               and `decay`, each the next of `colours`, casting no shadow, each drifting round a
//               circle `drift` metres across at `driftSpeed` turns a second and rising and falling by
//               `bob`, each a little behind the one before
//   lamps.bulb  every lamp drawn as a glowing ball this across, in its own colour times `lamps.glow`, so
//               it is seen where the light comes from, brighter than white through the fog
//   weaver      a point light of `colour`, `intensity`, `distance` and `decay`, casting a shadow where
//               `shadow` is true, carried `speed` metres a second round a smooth closed loop through
//               the [x, z] points of `path`, `height` up, weaving between the things
//   orbiter     a ball of `size` across, `colour`, `roughness` and `metalness`, circling the middle
//               `radius` out (its depth times `squash`) at `speed` turns a second, `height` up and
//               rising and falling by `bob`
//   panels      glowing panels, each `size` [width, height] metres, its middle at `at`, facing +z turned
//               `turn` degrees about the up axis, showing the loader's texture `picture` at `glow` times
//               its own brightness (unlit: it is drawn as bright as the picture whatever lights it),
//               and a three `RectAreaLight` the panel's size over its face, shining out of it, of
//               `colour` and `intensity`, shining its picture (`userData.picture`), which the game's
//               lights3d lights the room with (its `areas`); with `scroll`, the picture plays, sliding left
//               that many of its widths a second and coming round again, so the light it shines moves;
//               with `shadow` true, the light casts a shadow, which lights3d draws from its middle;
//               each of these, and `floorRoughness`, read every frame, so the dev page moves them while
//               the page runs
//   kit         a pro-ng glb drawn through supershader3d by the game's prong plugin: `glb` its catalogue name,
//               standing at `at`, turned `turn` degrees about the up axis and on round it `spin` turns a second,
//               and rising and falling `bob` metres every `bobSeconds`, so what it lights is seen to follow it;
//               with `sway: { above, degrees, seconds }`, it is a SkinnedMesh of two bones, every vertex above
//               `above` metres hanging from the upper one, which swings `degrees` to and fro every `seconds`, so a
//               glowing part that is posed is seen to light where it swings; every one read every frame
//   people      people, each the loader's `model` (cloned with its skeleton) at `at`, turned `turn` degrees, playing
//               its `clip` at `speed` by the steps' clock, and wearing `wear`: `{ look, uvScale }`, a glowing material
//               of supershader3d's, so it lights the room from where it is posed, or `{ chrome, roughness }`, a mirror
//               metal, so it shows the room, its lights and what glows
//   ambient     a faint light everywhere
// The floor, the walls, the things and the ball cast shadows and take them; a bulb and a panel do
// neither.
// Every light is an ordinary three light; lights3d lights them when the scene lists it, and three does
// when it does not. Every lit material is dressed by render3d, so lights3d's splice reaches it. What
// moves moves by the steps' clock, the moment drawn (`(n − 1 + between) × dt`), so it is drawn smooth at
// any display's rate: it is only drawn, and no rule reads it. Every turn is set as a whole quaternion.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let made: THREE.Object3D[] = []
let spots: { light: THREE.SpotLight; x: number; z: number; phase: number }[] = []
let field: { light: THREE.PointLight; x: number; z: number; phase: number }[] = []
let ball: THREE.Mesh | undefined
let ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | undefined
let kit: THREE.Mesh | undefined
// the people, each its model and the mixer that plays its clip, and whether they have been made
let people: { mixer: THREE.AnimationMixer; speed: number; root: THREE.Object3D; p: { shown: boolean } }[] = []
let peopleMade = false
// whether the kit thing has been asked of prong
let asked = false
let panels: {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  light: THREE.RectAreaLight
  i: number
  // the picture played: drawn each frame into a canvas from the loader's picture, scrolled
  played?: { from: ImageBitmap; canvas: HTMLCanvasElement; pen: CanvasRenderingContext2D; texture: THREE.CanvasTexture }
}[] = []
let weaver: { light: THREE.PointLight; loop: THREE.CatmullRomCurve3; length: number } | undefined
// The axes turns are made about, every turn set as a whole quaternion.
let X: THREE.Vector3, Y: THREE.Vector3
// half a turn about the up axis
let half: THREE.Quaternion

// The set the row names.
const setOf = (row: Row, plugins: Plugins) => {
  const set = def(plugins.wire, row.kind)[row.data.set]
  if (!set) throw new Error(`the stage has no set ${row.data.set}: ${Object.keys(def(plugins.wire, row.kind)).join(', ')}`)
  return set
}

// The moment drawn, in seconds: a step behind the clock, `between` of the way past the step before the
// newest (`engine/browser.ts`, Drawing between steps), so what moves moves by the steps' clock and is
// drawn where render3d draws everything else.
const drawn = (plugins: Plugins) => (plugins.wire.n - 1 + (plugins.wire.between ?? 1)) * plugins.wire.scene.prefabs.engine.dt

// What a person wears, handed each of its meshes' geometry: with `look`, that material of supershader3d's, every
// vertex tagged with it (its `lookId`, its `lookInfo` the person's own row so no two people's glow is one thing, its uv
// times `uvScale`, since a look's uv is metres) so the glowmap's pass draws its glow where it is posed; with `chrome`,
// a mirror metal of that colour and `roughness`, dressed by render3d so the probes and the screen's reflections reach it.
function wearing(T: typeof THREE, plugins: Plugins, wear: any, person: number) {
  if (wear.chrome) {
    const metal = plugins.render3d.dress(new T.MeshStandardMaterial({ color: wear.chrome, metalness: 1, roughness: wear.roughness }))
    return () => metal
  }
  const ss = plugins.supershader3d
  const id = ss.idOf(wear.look)
  if (id === undefined) throw new Error(`a person wears the look ${wear.look}, which the looks file does not hold`)
  const material = ss.material(ss.callOf(wear.look))
  return (geometry: THREE.BufferGeometry) => {
    const n = geometry.getAttribute('position').count
    geometry.setAttribute('lookId', new T.Float32BufferAttribute(new Float32Array(n).fill(id), 1))
    const info = new Float32Array(n * 3)
    for (let v = 0; v < n; v++) { info[v * 3] = id; info[v * 3 + 1] = 1000 + person; info[v * 3 + 2] = 0 }
    geometry.setAttribute('lookInfo', new T.Float32BufferAttribute(info, 3))
    const uv = geometry.getAttribute('uv')
    if (uv) {
      const scaled = new Float32Array(uv.count * 2)
      for (let v = 0; v < uv.count; v++) { scaled[v * 2] = uv.getX(v) * wear.uvScale; scaled[v * 2 + 1] = uv.getY(v) * wear.uvScale }
      geometry.setAttribute('uv', new T.Float32BufferAttribute(scaled, 2))
    }
    return material
  }
}

// `drawn` made a SkinnedMesh of two bones in its own space: one at its foot, and one `above` metres up that every
// vertex above it hangs from, so what is above swings when that bone turns. Its materials, attributes and geometry
// are drawn's own, its weights added.
function swaying(T: typeof THREE, drawn: THREE.Mesh, above: number) {
  const geometry = drawn.geometry
  const position = geometry.getAttribute('position')
  const index = new Uint16Array(position.count * 4), weight = new Float32Array(position.count * 4)
  for (let v = 0; v < position.count; v++) {
    index[v * 4] = position.getY(v) > above ? 1 : 0
    weight[v * 4] = 1
  }
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(index, 4))
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weight, 4))
  const mesh = new T.SkinnedMesh(geometry, drawn.material)
  const foot = new T.Bone(), upper = new T.Bone()
  upper.position.set(0, above, 0)
  foot.add(upper)
  mesh.add(foot)
  mesh.bind(new T.Skeleton([foot, upper]))
  // a body that bends leaves its rest bounds: drawn wherever it is
  mesh.frustumCulled = false
  mesh.userData.moving = true
  return mesh
}

export function setup(row: Row, plugins: Plugins) {
  const { THREE: T, scene, dress } = plugins.render3d
  const d = setOf(row, plugins)
  X = new T.Vector3(1, 0, 0)
  Y = new T.Vector3(0, 1, 0)
  half = new T.Quaternion().setFromAxisAngle(Y, Math.PI)
  const lit = (colour: string, roughness = 0.8, metalness = 0) => dress(new T.MeshStandardMaterial({ color: colour, roughness, metalness }))
  made = [new T.AmbientLight(0xffffff, d.ambient)]
  spots = []
  field = []

  // the floor, and the walls where the set has a room
  const [w, h, dp] = d.room ?? [d.floor, 0, d.floor]
  const floor = new T.Mesh(new T.PlaneGeometry(w, dp), lit(d.floorColour, d.floorRoughness))
  floor.quaternion.setFromAxisAngle(X, -Math.PI / 2)
  floor.castShadow = floor.receiveShadow = true
  ground = floor
  made.push(floor)
  if (d.room) {
    const wall = lit(d.wallColour)
    const back = new T.Mesh(new T.PlaneGeometry(w, h), wall)
    back.position.set(0, h / 2, -dp / 2)
    const left = new T.Mesh(new T.PlaneGeometry(dp, h), wall)
    left.position.set(-w / 2, h / 2, 0)
    left.quaternion.setFromAxisAngle(Y, Math.PI / 2)
    const right = new T.Mesh(new T.PlaneGeometry(dp, h), wall)
    right.position.set(w / 2, h / 2, 0)
    right.quaternion.setFromAxisAngle(Y, -Math.PI / 2)
    for (const m of [back, left, right]) m.castShadow = m.receiveShadow = true
    made.push(back, left, right)
  }

  // the things, each once or in rows
  for (const t of d.things ?? []) {
    const geometry = t.shape === 'box' ? new T.BoxGeometry(...t.size) : new T.SphereGeometry(t.size[0] / 2, 48, 24)
    const material = lit(t.colour, t.roughness ?? 0.55, t.metalness ?? 0)
    const up = t.shape === 'box' ? t.size[1] / 2 : t.size[0] / 2
    const r = t.repeat ?? { across: 1, deep: 1, spacing: [0, 0] }
    for (let i = 0; i < r.across; i++) for (let j = 0; j < r.deep; j++) {
      const m = new T.Mesh(geometry, material)
      m.position.set(t.at[0] + i * r.spacing[0], t.at[1] + up, t.at[2] + j * r.spacing[1])
      m.quaternion.setFromAxisAngle(Y, ((t.turn ?? 0) * Math.PI) / 180)
      m.castShadow = m.receiveShadow = true
      made.push(m)
    }
  }

  // a glowing bulb where a lamp is
  const bulb = new T.SphereGeometry(d.lamps?.bulb ?? 0.15, 16, 8)
  const glow = (light: THREE.Light) => light.add(new T.Mesh(bulb, new T.MeshBasicMaterial({ color: light.color.clone().multiplyScalar(d.lamps?.glow ?? 1) })))

  // the wall lamps, along the back wall and down each side
  const wl = d.lamps?.wall
  if (wl) {
    let k = 0
    const lamp = (x: number, z: number) => {
      const light = new T.PointLight(wl.colours[k++ % wl.colours.length], wl.intensity, wl.distance, wl.decay)
      light.position.set(x, wl.height, z)
      light.castShadow = wl.shadow
      glow(light)
      made.push(light)
    }
    for (let x = -w / 2 + wl.every / 2; x < w / 2; x += wl.every) lamp(x, -dp / 2 + wl.out)
    for (let z = -dp / 2 + wl.every; z < dp / 2; z += wl.every) { lamp(-w / 2 + wl.out, z); lamp(w / 2 - wl.out, z) }
  }

  // the spots overhead
  const sp = d.lamps?.spots
  if (sp) {
    sp.at.forEach(([x, z]: [number, number], i: number) => {
      const light = new T.SpotLight(sp.colours[i % sp.colours.length], sp.intensity, sp.distance, sp.angle, sp.penumbra, sp.decay)
      light.position.set(x, sp.height, z)
      light.target.position.set(x, 0, z)
      light.castShadow = sp.shadow
      glow(light)
      spots.push({ light, x, z, phase: (i / sp.at.length) * Math.PI * 2 })
      made.push(light, light.target)
    })
  }

  // the field of drifting lamps
  const fl = d.lamps?.field
  if (fl) {
    const n = fl.across * fl.deep
    let k = 0
    for (let i = 0; i < fl.across; i++) for (let j = 0; j < fl.deep; j++) {
      const x = (i - (fl.across - 1) / 2) * fl.spacing, z = (j - (fl.deep - 1) / 2) * fl.spacing
      const light = new T.PointLight(fl.colours[k % fl.colours.length], fl.intensity, fl.distance, fl.decay)
      glow(light)
      field.push({ light, x, z, phase: (k / n) * Math.PI * 2 * 7 })
      made.push(light)
      k++
    }
  }

  // the lamp that weaves between the things
  const wv = d.weaver
  if (wv) {
    const loop = new T.CatmullRomCurve3(wv.path.map(([x, z]: [number, number]) => new T.Vector3(x, wv.height, z)), true, 'centripetal')
    const light = new T.PointLight(wv.colour, wv.intensity, wv.distance, wv.decay)
    light.castShadow = wv.shadow
    glow(light)
    weaver = { light, loop, length: loop.getLength() }
    made.push(light)
  }

  // the glowing panels, each showing its picture once the loader has it, placed by `tick`
  panels = []
  ;(d.panels ?? []).forEach((pn: any, i: number) => {
    const shown = new T.MeshBasicMaterial()
    const panel = new T.Mesh(new T.PlaneGeometry(1, 1), shown)
    // the light over its face, turned half round by `tick`, since a RectAreaLight shines along its own
    // −z and the panel faces its +z; it shines the picture once the loader has it
    const light = new T.RectAreaLight()
    // with `shadow`, it casts one, which lights3d draws from its middle
    light.castShadow = pn.shadow === true
    const held: (typeof panels)[number] = { mesh: panel, light, i }
    panels.push(held)
    plugins.loader.on(pn.picture, (picture: THREE.Texture) => {
      let shines = picture
      // a panel that scrolls plays its picture through a canvas of its own: the loader's bitmap was
      // turned over as it was decoded, a canvas drawn from it holds it the right way up again (as seen
      // in Chrome, 2026-11-08), so the canvas is turned over as it is uploaded, as three does a picture
      if (pn.scroll !== undefined) {
        const from = picture.image as ImageBitmap
        const canvas = document.createElement('canvas')
        canvas.width = from.width
        canvas.height = from.height
        const texture = new T.CanvasTexture(canvas)
        texture.colorSpace = T.SRGBColorSpace
        held.played = { from, canvas, pen: canvas.getContext('2d')!, texture }
        shines = texture
      }
      shown.map = shines
      shown.needsUpdate = true
      light.userData.picture = shines
    })
    made.push(panel, light)
  })

  asked = false
  peopleMade = false
  people = []
  const o = d.orbiter
  if (o) {
    const orb = new T.Mesh(new T.SphereGeometry(o.size / 2, 48, 24), lit(o.colour, o.roughness, o.metalness))
    orb.castShadow = orb.receiveShadow = true
    // it moves every frame: lights3d draws its shadow into the moving atlas
    orb.userData.moving = true
    ball = orb
    made.push(orb)
  }
  for (const m of made) scene.add(m)
  tick(row, plugins)
}

export function tick(row: Row, plugins: Plugins) {
  const d = setOf(row, plugins)
  const t = drawn(plugins)
  const sp = d.lamps?.spots
  for (const spot of spots) {
    const a = t * sp.sweepSpeed * Math.PI * 2 + spot.phase
    spot.light.target.position.set(spot.x + Math.cos(a) * sp.sweep, 0, spot.z + Math.sin(a) * sp.sweep)
    spot.light.target.updateMatrixWorld()
  }
  const fl = d.lamps?.field
  for (const lamp of field) {
    const a = t * fl.driftSpeed * Math.PI * 2 + lamp.phase
    lamp.light.position.set(lamp.x + Math.cos(a) * fl.drift / 2, fl.height + Math.sin(a * 2) * fl.bob, lamp.z + Math.sin(a) * fl.drift / 2)
  }
  // the floor's roughness and every panel read from the definition each frame, so the dev page's panel
  // moves them while the page runs
  if (ground) ground.material.roughness = d.floorRoughness
  for (const p of panels) {
    const pn = d.panels[p.i]
    p.mesh.position.set(pn.at[0], pn.at[1], pn.at[2])
    p.mesh.scale.set(pn.size[0], pn.size[1], 1)
    p.mesh.quaternion.setFromAxisAngle(Y, (pn.turn * Math.PI) / 180)
    p.mesh.material.color.setScalar(pn.glow)
    p.light.position.copy(p.mesh.position)
    p.light.quaternion.copy(p.mesh.quaternion).multiply(half)
    p.light.width = pn.size[0]
    p.light.height = pn.size[1]
    p.light.color.set(pn.colour)
    p.light.intensity = pn.intensity
    if (p.played) {
      const { from, pen, texture } = p.played
      const by = (((t * pn.scroll) % 1) + 1) % 1 * from.width
      pen.drawImage(from, -by, 0)
      pen.drawImage(from, from.width - by, 0)
      texture.needsUpdate = true
    }
  }
  // the kit thing asked of prong once `shipped` has loaded it, and drawn once prong has made it, unless the stage
  // was taken away first
  if (d.kit && !asked && plugins.prong) {
    asked = true
    const was = made
    plugins.prong.mesh(d.kit.glb).then((drawn: THREE.Mesh) => {
      if (made !== was) return
      const mesh = d.kit.sway ? swaying(plugins.render3d.THREE as typeof THREE, drawn, d.kit.sway.above) : drawn
      mesh.castShadow = mesh.receiveShadow = true
      kit = mesh
      made.push(mesh)
      plugins.render3d.scene.add(mesh)
    })
  }
  // the people, made once their models and supershader3d's looks have landed
  if (d.people && !peopleMade && plugins.supershader3d?.looks() && d.people.every((p: any) => plugins.loader.ready(p.model))) {
    peopleMade = true
    const T = plugins.render3d.THREE as typeof THREE
    d.people.forEach((p: any, i: number) => {
      const { scene: root, animations } = plugins.loader.model(p.model)
      root.position.set(p.at[0], p.at[1], p.at[2])
      root.quaternion.setFromAxisAngle(Y, (p.turn * Math.PI) / 180)
      const worn = wearing(T, plugins, p.wear, i)
      root.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry = m.geometry.clone()
        m.material = worn(m.geometry)
        m.castShadow = m.receiveShadow = true
        // a posed body leaves its rest bounds; anim marks what it poses moving, and so does this
        m.frustumCulled = false
        m.userData.moving = true
      })
      const clip = animations.find((a: THREE.AnimationClip) => a.name === p.clip)
      if (!clip) throw new Error(`the stage's person ${i} plays ${p.clip}, which ${p.model} has not: ${animations.map((a: THREE.AnimationClip) => a.name).join(', ')}`)
      const mixer = new T.AnimationMixer(root)
      mixer.clipAction(clip).play()
      people.push({ mixer, speed: p.speed, root, p })
      made.push(root)
      plugins.render3d.scene.add(root)
    })
  }
  // each person and the kit thing drawn while its definition's `shown` is true (the dev panel's toggles)
  for (const p of people) {
    p.root.visible = p.p.shown
    p.mixer.setTime(t * p.speed)
  }
  if (kit) {
    kit.visible = d.kit.shown
    const k = d.kit
    kit.position.set(k.at[0], k.at[1] + k.bob * Math.sin((t / k.bobSeconds) * Math.PI * 2), k.at[2])
    kit.quaternion.setFromAxisAngle(Y, ((k.turn + t * k.spin * 360) * Math.PI) / 180)
    // the upper bone swung to and fro about the thing's own x
    const s = k.sway
    if (s) (kit as THREE.SkinnedMesh).skeleton.bones[1].quaternion.setFromAxisAngle(X, ((s.degrees * Math.sin((t / s.seconds) * Math.PI * 2)) * Math.PI) / 180)
  }
  if (weaver) weaver.loop.getPointAt(((t * d.weaver.speed) / weaver.length) % 1, weaver.light.position)
  const o = d.orbiter
  if (ball) {
    const b = t * o.speed * Math.PI * 2
    ball.position.set(Math.cos(b) * o.radius, o.height + Math.sin(b * 3) * o.bob, Math.sin(b) * o.radius * o.squash)
  }
}

export function remove(plugins: Plugins) {
  for (const m of made) plugins.render3d.scene.remove(m)
  made = []
  spots = []
  field = []
  ball = undefined
  ground = undefined
  kit = undefined
  panels = []
  weaver = undefined
}
