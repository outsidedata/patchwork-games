// laser: the beams of light the guns of the game throw, the browser's half. A gun's `beam` look word
// (`laser.guns3d.ts`) hands it, every frame the beam shines, the holder's row id, where the beam leaves the gun and
// where it lands, in the world, and the word's numbers; it draws each holder's beam that frame and no other.
//
// A beam is one mesh in render3d's scene, three strips drawn by one shader and placed by it from the two ends, so the
// mesh itself never moves and render3d has nothing to put between steps:
//   the beam   a strip from end to end, turned about the line between them to face the camera, `width` across: a
//              glow of `color` falling off from the middle out, and on it a core of `core`, `coreWidth` across
//   the ends   a square facing the camera at each end, `end` across, the same glow and core round its middle
// Each is added on the scene's light (additive), writes no depth and is hidden behind what stands in front of it. Its
// brightness is `gain`, shivered each frame by up to `flicker` of it.
//
// Each frame its `tick` puts every beam out; the beam word lights again the ones still shining, in guns3d's
// afterTick, before render3d draws. A beam whose holder's row is gone is taken away. `close` takes every one away.
// Listed in `world.shipped.plugins`, it ticks at `shipped`'s place, which is before guns3d and render3d in the scene's
// `plugins`; with render3d not named it throws.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import type { Row } from '#engine/engine.ts'

export type Beam = { color: string; core: string; width: number; coreWidth: number; end: number; gain: number; fade: number; flicker: number }
export type Laser = { draw(id: number, from: number[], to: number[], numbers: Beam): void }

const VERTEX = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uWidth;
uniform float uEnd;
attribute vec3 corner;
varying vec2 vAt;
varying float vPart;
void main() {
  vPart = corner.x;
  vec3 p;
  if (corner.x < 0.5) {
    vec3 at = mix(uA, uB, corner.y);
    vec3 side = cross(normalize(uB - uA), cameraPosition - at);
    float l = length(side);
    side = l > 1e-6 ? side / l : vec3(0.0, 1.0, 0.0);
    p = at + side * corner.z * uWidth * 0.5;
    vAt = vec2(0.0, corner.z);
  } else {
    vec3 c = corner.x < 1.5 ? uA : uB;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    p = c + (right * corner.y + up * corner.z) * uEnd * 0.5;
    vAt = corner.yz;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uWidth;
uniform float uEnd;
uniform float uCoreWidth;
uniform float uLevel;
varying vec2 vAt;
varying float vPart;
void main() {
  float across = length(vAt);
  if (across >= 1.0) discard;
  float wide = vPart < 0.5 ? uWidth : uEnd;
  float k = wide / uCoreWidth;
  float glow = exp(-across * across * 5.0) * (1.0 - across);
  float core = exp(-across * across * k * k * 2.0);
  gl_FragColor = vec4((uColor * glow + uCore * core) * uLevel, 1.0);
}`

// The three strips: the beam's four corners, then each end's square. `corner` is (part, along or x, across or y).
function shape(T: typeof THREE): THREE.BufferGeometry {
  const corner = [
    0, 0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1,
    1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1,
    2, -1, -1, 2, 1, -1, 2, 1, 1, 2, -1, 1,
  ]
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(corner.length), 3))
  g.setAttribute('corner', new T.Float32BufferAttribute(corner, 3))
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11])
  return g
}

// A beam word's numbers, checked once each: they come from the gun sheet, a file.
const checked = new WeakSet<Beam>()
function check(n: Beam) {
  if (checked.has(n)) return
  for (const k of ['width', 'coreWidth', 'end', 'gain', 'fade'] as const) if (typeof n[k] !== 'number' || !(n[k] > 0)) throw new Error(`laser: a beam's ${k} is ${JSON.stringify(n[k])}, and it is a number above 0`)
  if (n.coreWidth > n.width) throw new Error(`laser: a beam's coreWidth, ${n.coreWidth} m, is wider than its width, ${n.width} m`)
  if (typeof n.flicker !== 'number' || n.flicker < 0 || n.flicker > 1) throw new Error(`laser: a beam's flicker is ${JSON.stringify(n.flicker)}, and it is from 0 to 1`)
  for (const k of ['color', 'core'] as const) if (typeof n[k] !== 'string') throw new Error(`laser: a beam's ${k} is ${JSON.stringify(n[k])}, and it is a CSS colour`)
  checked.add(n)
}

export function laser() {
  const beams = new Map<number, { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }>()
  let T: typeof THREE | undefined
  let scene: THREE.Scene | undefined
  let geometry: THREE.BufferGeometry | undefined

  function take(id: number) {
    const b = beams.get(id)!
    b.mesh.removeFromParent()
    b.mat.dispose()
    beams.delete(id)
  }

  function make(id: number) {
    geometry ??= shape(T!)
    const mat = new T!.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uA: { value: new T!.Vector3() }, uB: { value: new T!.Vector3() },
        uWidth: { value: 0 }, uEnd: { value: 0 }, uCoreWidth: { value: 0 }, uLevel: { value: 0 },
        uColor: { value: new T!.Color() }, uCore: { value: new T!.Color() },
      },
      transparent: true,
      blending: T!.AdditiveBlending,
      depthWrite: false,
      // the strip faces the camera by its side, which turns its winding over as the camera goes round the beam
      side: T!.DoubleSide,
    })
    const mesh = new T!.Mesh(geometry, mat)
    mesh.frustumCulled = false
    mesh.name = `laser beam ${id}`
    scene!.add(mesh)
    const b = { mesh, mat }
    beams.set(id, b)
    return b
  }

  const me = {
    tick(plugins: Plugins) {
      if (!plugins.render3d) throw new Error('laser draws its beams through render3d, which this scene does not name')
      T = plugins.render3d.THREE
      scene = plugins.render3d.scene
      const live = new Set((plugins.wire.rows as Row[]).map(r => r.id))
      for (const id of [...beams.keys()]) if (!live.has(id)) take(id)
      for (const b of beams.values()) b.mesh.visible = false
    },
    draw(id: number, from: number[], to: number[], n: Beam) {
      if (!T) throw new Error('laser was asked to draw a beam before its first tick')
      check(n)
      const b = beams.get(id) ?? make(id)
      const u = b.mat.uniforms
      u.uA.value.fromArray(from)
      u.uB.value.fromArray(to)
      u.uWidth.value = n.width
      u.uEnd.value = n.end
      u.uCoreWidth.value = n.coreWidth
      u.uColor.value.set(n.color)
      u.uCore.value.set(n.core)
      u.uLevel.value = n.gain * (1 - n.flicker * Math.random())
      b.mesh.visible = true
    },
    close() {
      for (const id of [...beams.keys()]) take(id)
      geometry?.dispose()
      geometry = undefined
    },
  }
  return me
}
