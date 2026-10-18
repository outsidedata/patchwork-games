// A door: two posts and a lintel `post` metres thick round an opening `width` by `height`, in the
// colour its definition gives its `name`, stood on the row's `pos` and turned `yaw` about up, set from
// the row every frame. A door only ever moves by being put somewhere new, so its frame's
// `userData.teleport` is always up and render3d draws it where it is put, never sliding there
// (`guide-to-smooth-gameplay`). While the door its row names in `to` stands, its opening shows the
// other place: the scene as seen through that door, from where the camera would stand had it gone
// through this door's front (the walker's own move, `player.sim.ts`: the camera taken from this door's
// frame into that one's, turned half a turn). Each frame the opening is about to be drawn, a second
// camera stands there and draws the scene into a texture the size of the drawing buffer, everything
// behind that door's plane clipped away; the opening then draws the texel under each of its pixels,
// so the two line up pixel for pixel. Every opening is hidden while one is drawn, so none draws
// itself. With no other door, the opening is empty.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let frame: THREE.Group
let target: THREE.WebGLRenderTarget
let pane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
// This door's row and the other's, as the last frame's packet had them.
let self: Row
let other: Row | undefined
let up: THREE.Vector3

export function setup(row: Row, plugins: Plugins) {
  const { width, height, post, colours } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  up = new three.Vector3(0, 1, 0)
  const solid = new three.MeshBasicMaterial({ color: colours[row.data.name] })
  frame = new three.Group()
  frame.userData.teleport = true
  for (const x of [-(width + post) / 2, (width + post) / 2]) {
    const side = new three.Mesh(new three.BoxGeometry(post, height + post, post), solid)
    side.position.set(x, (height + post) / 2, 0)
    frame.add(side)
  }
  const top = new three.Mesh(new three.BoxGeometry(width + post * 2, post, post), solid)
  top.position.set(0, height + post / 2, 0)
  frame.add(top)

  target = new three.WebGLRenderTarget(1, 1, { type: three.HalfFloatType })
  const size = new three.Vector2(1, 1)
  // The scene's background, which the screen is cleared to untouched by the tone mapping: the second
  // camera draws on a clear of nothing, and the opening lays this colour where it drew nothing.
  const back = new three.Color()
  const clear = new three.Color()
  pane = new three.Mesh(new three.PlaneGeometry(width, height), new three.ShaderMaterial({
    uniforms: { view: { value: target.texture }, size: { value: size }, back: { value: back } },
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D view;
      uniform vec2 size;
      uniform vec3 back;
      void main() {
        vec4 seen = texture2D(view, gl_FragCoord.xy / size);
        gl_FragColor = vec4(seen.rgb, 1.0);
        #include <tonemapping_fragment>
        gl_FragColor.rgb = mix(back, gl_FragColor.rgb, seen.a);
        #include <colorspace_fragment>
      }`,
    side: three.DoubleSide,
  }))
  pane.position.set(0, height / 2, 0)
  pane.userData.portal = true
  frame.add(pane)
  plugins.render3d.scene.add(frame)
  tick(row, plugins)

  const eye = new three.PerspectiveCamera()
  const through = new three.Matrix4()
  const here = new three.Matrix4()
  const there = new three.Matrix4()
  const half = new three.Matrix4().makeRotationY(Math.PI)
  const turn = new three.Quaternion()
  const at = new three.Vector3()
  const one = new three.Vector3(1, 1, 1)
  const facing = new three.Vector3()
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
    // A world point taken through this door comes out at `there · half · here⁻¹`, as the walker does.
    here.compose(at.fromArray(self.data.pos), turn.setFromAxisAngle(up, self.data.yaw), one).invert()
    there.compose(at.fromArray(other.data.pos), turn.setFromAxisAngle(up, other.data.yaw), one)
    through.multiplyMatrices(there, half).multiply(here)
    eye.copy(seen, false)
    place.multiplyMatrices(through, seen.matrixWorld).decompose(eye.position, eye.quaternion, eye.scale)
    eye.updateMatrixWorld(true)
    // The near plane laid on that door's plane, keeping what stands in front of it (an oblique
    // projection, as three's Reflector clips), so what stands between the second camera and the door
    // is never drawn.
    facing.set(Math.sin(other.data.yaw), 0, Math.cos(other.data.yaw))
    clip.setFromNormalAndCoplanarPoint(facing, at.fromArray(other.data.pos))
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

export function tick(row: Row, plugins: Plugins) {
  self = row
  other = plugins.wire.rows.find(r => r.kind === 'door' && r.data.name === row.data.to)
  frame.position.fromArray(row.data.pos)
  frame.quaternion.setFromAxisAngle(up, row.data.yaw)
  pane.visible = other !== undefined
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(frame)
  frame.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    ;(m.material as THREE.Material).dispose()
  })
  target.dispose()
}
