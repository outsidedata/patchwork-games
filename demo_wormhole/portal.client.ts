// A portal: a rim `post` metres thick round an opening `width` by `height`, unlit, shining its `rims`
// entry for its `name` (`glow` at `power`, past 1 brighter than white, so render3d's bloom takes it),
// centred on the row's `pos` a hair off the face it lies on, turned so its +z is the row's `normal`
// and its +y its `up`, set from the row every frame. The portal plugin's light for its `name`
// (`plugins/portal/portal.plugin.ts`, `lamp`) stands `light.ahead` metres in front of the opening while
// the row stands, lighting what is before it at `light.power`, and is dark again once the row ends;
// and the opening's own edge glows inward `halo.width` metres, the rim's glow at
// `halo.power`, fading to nothing. A portal only ever moves by being put somewhere new, so its
// `userData.teleport` is always up and render3d draws it where it is put, never sliding there
// (`guide-to-smooth-gameplay`). While the portal its row names in `to` stands, its opening shows the
// other place: the scene as seen through that portal, from where the camera would stand had it gone
// through this one's front (the walker's own move, `player.sim.ts`: taken from this portal's frame into
// that one's, turned half a turn about up). Each frame the opening is about to be drawn, a second camera
// stands there and draws the scene into a texture the size of the drawing buffer, everything behind
// that portal's plane clipped away; the opening then draws the texel under each of its pixels, so the
// two line up pixel for pixel. Every opening is hidden while one is drawn, so none draws itself. With
// no other portal, the opening is a film of the rim's glow `film` times as bright. A scene drawn into
// that texture takes programs of its own (three builds a program for each target a material is drawn
// into), so on its first frame with a renderer the look has three build them in the background
// (`compileAsync` with the texture bound), and the frame the other portal first opens finds them made.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let frame: THREE.Group
let target: THREE.WebGLRenderTarget
let pane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
let lamp: THREE.PointLight | undefined
let open: { value: number }
let warmed = false
let ahead: number, power: number
// This portal's row and the other's, as the last frame's packet had them.
let self: Row
let other: Row | undefined
let three: typeof THREE
let lift: number

// A portal's frame: its basis of right, up and normal at its `pos`.
const frameOf = (d: Row, out: THREE.Matrix4) => {
  const n = new three.Vector3().fromArray(d.data.normal), u = new three.Vector3().fromArray(d.data.up)
  return out.makeBasis(new three.Vector3().crossVectors(u, n), u, n).setPosition(new three.Vector3().fromArray(d.data.pos))
}

export function setup(row: Row, plugins: Plugins) {
  const { width, height, post, rims, halo, film, light } = def(plugins.wire, row.kind)
  three = plugins.render3d.THREE as typeof THREE
  lift = post / 2
  const rim = rims[row.data.name]
  const shine = new three.Color(rim.glow).multiplyScalar(rim.power)
  const solid = new three.MeshBasicMaterial({ color: shine })
  frame = new three.Group()
  frame.userData.teleport = true
  for (const x of [-(width + post) / 2, (width + post) / 2]) {
    const side = new three.Mesh(new three.BoxGeometry(post, height + post * 2, post), solid)
    side.position.set(x, 0, 0)
    frame.add(side)
  }
  for (const y of [-(height + post) / 2, (height + post) / 2]) {
    const bar = new three.Mesh(new three.BoxGeometry(width, post, post), solid)
    bar.position.set(0, y, 0)
    frame.add(bar)
  }
  ahead = light.ahead
  power = light.power

  target = new three.WebGLRenderTarget(1, 1, { type: three.HalfFloatType })
  const size = new three.Vector2(1, 1)
  // The scene's background, which the frame is cleared to: the second camera draws on a clear of
  // nothing, and the opening lays this colour where it drew nothing.
  const back = new three.Color()
  const clear = new three.Color()
  open = { value: 0 }
  pane = new three.Mesh(new three.PlaneGeometry(width, height), new three.ShaderMaterial({
    uniforms: {
      view: { value: target.texture }, size: { value: size }, back: { value: back }, open,
      rim: { value: new three.Color(rim.glow).multiplyScalar(halo.power) },
      extent: { value: new three.Vector2(width / 2, height / 2) }, halo: { value: halo.width }, film: { value: shine.clone().multiplyScalar(film) },
    },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    // Drawn into the composer's target, nothing is tone mapped here: the other place, the background
    // and the glow are mixed as light and tone mapped later with the rest of the frame. Drawn straight
    // to the canvas, the canvas is cleared to the background as given, so the background is mixed in
    // after the tone mapping, as the scene's own clear is.
    fragmentShader: `
      uniform sampler2D view;
      uniform vec2 size;
      uniform vec3 back;
      uniform float open;
      uniform vec3 rim;
      uniform vec2 extent;
      uniform float halo;
      uniform vec3 film;
      varying vec2 vLocal;
      void main() {
        float inside = min(extent.x - abs(vLocal.x), extent.y - abs(vLocal.y));
        float edge = 1.0 - clamp(inside / halo, 0.0, 1.0);
        vec3 glow = rim * edge * edge;
        vec4 seen = open > 0.5 ? texture2D(view, gl_FragCoord.xy / size) : vec4(film, 1.0);
        #ifdef TONE_MAPPING
          gl_FragColor = vec4(mix(back + toneMapping(glow), toneMapping(seen.rgb + glow), seen.a), 1.0);
        #else
          gl_FragColor = vec4(mix(back + glow, seen.rgb + glow, seen.a), 1.0);
        #endif
        #include <colorspace_fragment>
      }`,
    side: three.DoubleSide,
  }))
  pane.userData.portal = true
  frame.add(pane)
  plugins.render3d.scene.add(frame)
  stand(row, plugins)

  const eye = new three.PerspectiveCamera()
  const through = new three.Matrix4()
  const here = new three.Matrix4()
  const there = new three.Matrix4()
  const turn = new three.Matrix4().makeRotationY(Math.PI)
  const facing = new three.Vector3()
  const at = new three.Vector3()
  const clip = new three.Plane()
  const place = new three.Matrix4()
  const near = new three.Plane()
  const edge = new three.Vector4()
  const corner = new three.Vector4()
  const buffer = new three.Vector2()

  pane.onBeforeRender = (renderer, scene, camera) => {
    if (!other) return
    const seen = camera as THREE.PerspectiveCamera
    renderer.getDrawingBufferSize(buffer)
    if (target.width !== buffer.x || target.height !== buffer.y) target.setSize(buffer.x, buffer.y)
    size.copy(buffer)
    // A world point taken through this portal comes out at `there · turn · here⁻¹`, as the walker does.
    frameOf(self, here).invert()
    frameOf(other, there)
    through.multiplyMatrices(there, turn).multiply(here)
    eye.copy(seen, false)
    place.multiplyMatrices(through, seen.matrixWorld).decompose(eye.position, eye.quaternion, eye.scale)
    eye.updateMatrixWorld(true)
    // The near plane laid on that portal's plane, keeping what stands in front of it (an oblique
    // projection, as three's Reflector clips), so what stands between the second camera and the
    // portal is never drawn.
    clip.setFromNormalAndCoplanarPoint(facing.fromArray(other.data.normal), at.fromArray(other.data.pos))
    near.copy(clip).applyMatrix4(eye.matrixWorldInverse)
    edge.set(near.normal.x, near.normal.y, near.normal.z, near.constant)
    const p = eye.projectionMatrix.elements
    corner.set((Math.sign(edge.x) + p[8]) / p[0], (Math.sign(edge.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14])
    edge.multiplyScalar(2 / edge.dot(corner))
    p[2] = edge.x
    p[6] = edge.y
    p[10] = edge.z + 1
    p[14] = edge.w
    eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert()
    const portals: THREE.Object3D[] = []
    scene.traverse(o => { if (o.userData.portal && o.visible) portals.push(o) })
    for (const o of portals) o.visible = false
    const s = scene as THREE.Scene
    const was = { target: renderer.getRenderTarget(), shadows: renderer.shadowMap.autoUpdate, background: s.background, alpha: renderer.getClearAlpha() }
    renderer.getClearColor(clear)
    if ((was.background as THREE.Color | null)?.isColor) back.copy(was.background as THREE.Color)
    else back.copy(clear)
    s.background = null
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.render(scene, eye)
    renderer.setRenderTarget(was.target)
    renderer.setClearColor(clear, was.alpha)
    renderer.shadowMap.autoUpdate = was.shadows
    s.background = was.background
    for (const o of portals) o.visible = true
  }
}

// The frame where the row puts it, and whether the opening shows the other place.
function stand(row: Row, plugins: Plugins) {
  self = row
  other = plugins.wire.rows.find(r => r.kind === 'portal' && r.data.name === row.data.to)
  frameOf(row, frame.matrix).decompose(frame.position, frame.quaternion, frame.scale)
  frame.position.addScaledVector(new three.Vector3().fromArray(row.data.normal), lift)
  open.value = other === undefined ? 0 : 1
}

export function tick(row: Row, plugins: Plugins) {
  stand(row, plugins)
  const normal = new three.Vector3().fromArray(row.data.normal)
  // The portal plugin is on `plugins` from its first tick, which runs before every actor's tick.
  lamp = plugins.portal.lamp(row.data.name) as THREE.PointLight
  lamp.position.copy(frame.position).addScaledVector(normal, ahead)
  lamp.intensity = power
  lamp.userData.teleport = true
  const renderer: THREE.WebGLRenderer | undefined = plugins.render3d.renderer
  const camera: THREE.Camera | undefined = plugins.render3d.camera
  if (warmed || !renderer || !camera) return
  warmed = true
  const was = renderer.getRenderTarget()
  renderer.setRenderTarget(target)
  void renderer.compileAsync(plugins.render3d.scene, camera)
  renderer.setRenderTarget(was)
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(frame)
  frame.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    ;(m.material as THREE.Material).dispose()
  })
  if (lamp) lamp.intensity = 0
  target.dispose()
}
