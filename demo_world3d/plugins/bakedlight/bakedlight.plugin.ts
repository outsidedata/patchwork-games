// bakedlight, demo_world3d's own plugin (loaded by `shipped`, `world.shipped.plugins`): a place lit by the light its
// bake worked out (`assets/demo_world3d.light.ts`), with no light running for it. It has no row and no server half.
// `world.bakedlight`:
//   file       the catalogue name of the place's `<place>.light.bin` (a `binary` entry; `preload` it)
//   fire       the fires' colour
//   fireGain   their intensity, as a point light's: a fire lights a face a metre off it facing it fireGain times its colour
//   flicker    the fires' flicker, each [amount, rate, phase]: the fires are 1 + Σ amount · sin(seconds · rate + phase)
//              times as bright
//   bake       the bake's own numbers (`demo_world3d.light.ts`), which the page never reads
//
// The file says, for every vertex of the place in the order world3d's one mesh holds them (`world3d.mesh()`), how it is
// lit: live, by its own four numbers, or by the map. Once the file has landed and world3d has built the place, the
// place's geometry is given two attributes from it: `bakeLight`, the vertex's sky, ground, key and fire, and `bakeAt`,
// its map uv, whether the map lights it, and how much of it is lit live (1 for a vertex the bake left live). On its first
// tick it registers a render3d splice under `bakedlight`, so every dressed material has it, supershader3d's that draw
// the place among them; a geometry without the attributes reads `bakeAt` as (0, 0, 0, 1), lit live, so every other mesh
// the same materials draw is lit as before. A baked fragment's light is the sky's, the ground's and the key's colours
// (skydome3d's `light()`: what its hemisphere and key lights give) and the fires' colour times its four numbers, and,
// on the map, the sun patch where its distance (the file's second map) crosses nought, lit by the key light's cosine
// there, in place of the hemisphere light, the key light and the sky's reflections; every other light (lights3d's,
// three's own point and spot lights) lights it as it lights everything. Between a baked vertex and a live one the two
// are blended. `close` disposes its textures.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'

type Settings = { file: string; fire: string; fireGain: number; flicker: [number, number, number][] }

export const SPLICE = {
  vertex: {
    common: [
      'attribute vec4 bakeLight;',
      'attribute vec4 bakeAt;',
      'varying vec4 vBakeLight;',
      'varying vec4 vBakeAt;',
    ].join('\n'),
    '?begin_vertex': [
      'vBakeLight = bakeLight;',
      'vBakeAt = bakeAt;',
    ].join('\n'),
  },
  fragment: {
    // the place's light, read before the lights; the key light taken out where it is baked
    '?lights_pars_begin': [
      'uniform sampler2D bakeMap;',
      'uniform sampler2D bakeEdges;',
      'uniform vec3 bakeKeyDir;',
      'uniform vec3 bakeSky;',
      'uniform vec3 bakeGround;',
      'uniform vec3 bakeKey;',
      'uniform vec3 bakeFire;',
      'varying vec4 vBakeLight;',
      'varying vec4 vBakeAt;',
      'float bakeLive = 1.0;',
      'float bakePatch = 0.0;',
      'vec4 bakeHere = vec4( 0.0 );',
      '#if NUM_DIR_LIGHTS > 0',
      'void bakeDirectional( const in DirectionalLight l, out IncidentLight d ) {',
      '  getDirectionalLightInfo( l, d );',
      '  d.color *= bakeLive;',
      '}',
      '#define getDirectionalLightInfo( l, d ) bakeDirectional( l, d )',
      '#endif',
    ].join('\n'),
    '?normal_fragment_maps': [
      'bakeLive = vBakeAt.w;',
      'vec4 bakeMapped = texture( bakeMap, vBakeAt.xy );',
      // the sun patch: its edge where the distance crosses nought, a pixel wide, lit by the key light's cosine
      'float bakeEdge = texture( bakeEdges, vBakeAt.xy ).r;',
      'float bakeSun = clamp( 0.5 + bakeEdge / max( fwidth( bakeEdge ), 1e-4 ), 0.0, 1.0 );',
      'bakeHere = vBakeAt.z > 0.5 ? bakeMapped : vBakeLight / max( 1.0 - bakeLive, 1e-3 );',
      'bakePatch = vBakeAt.z > 0.5 ? bakeSun * max( dot( inverseTransformDirection( normal, viewMatrix ), bakeKeyDir ), 0.0 ) : 0.0;',
    ].join('\n'),
    // the sky's and ground's light, the key's and the fires' from the bake in place of the hemisphere light's
    '?lights_fragment_begin': 'irradiance = mix( bakeHere.x * bakeSky + bakeHere.y * bakeGround + ( bakeHere.z + bakePatch ) * bakeKey + bakeHere.w * bakeFire, irradiance, bakeLive );',
    // the sky's reflections only as far as the sky is seen
    '?lights_fragment_maps': [
      'float bakeSeen = mix( clamp( bakeHere.x + bakeHere.y, 0.0, 1.0 ), 1.0, bakeLive );',
      'iblIrradiance *= bakeSeen;',
      '#if defined( RE_IndirectSpecular )',
      'radiance *= bakeSeen;',
      '#endif',
    ].join('\n'),
  },
}

// The file read: each vertex's two attributes, and its map's half floats and its sun patches' distances.
export function read(bytes: Uint8Array) {
  const copy = bytes.slice()
  const head = new Uint32Array(copy.buffer, 0, 8)
  if (head[0] !== 0x314b424c) throw new Error('bakedlight: the file is no light bake (LBK1); bake the place again')
  const count = head[1], w = head[2], h = head[3]
  const verts = new Float32Array(copy.buffer, 32, count * 8)
  const map = new Uint16Array(copy.buffer, 32 + count * 32, w * h * 4)
  const edges = new Uint16Array(copy.buffer, 32 + count * 32 + w * h * 8, w * h)
  const light = new Float32Array(count * 4), at = new Float32Array(count * 4)
  for (let v = 0; v < count; v++) {
    const mode = verts[v * 8 + 3]
    if (mode === 1) light.set(verts.subarray(v * 8 + 4, v * 8 + 8), v * 4)
    if (mode === 2) at.set([verts[v * 8 + 4], verts[v * 8 + 5], 1], v * 4)
    at[v * 4 + 3] = mode === 0 ? 1 : 0
  }
  return { count, w, h, light, at, map, edges }
}

export function bakedlight() {
  let started = false
  let made: THREE.Texture[] = []
  let got: ReturnType<typeof read> | undefined
  let given: THREE.BufferGeometry | undefined
  const uniforms: Record<string, THREE.IUniform> = {}
  let fire: THREE.Color | undefined

  return {
    tick(plugins: Plugins) {
      const T = plugins.render3d.THREE as typeof THREE
      const s = plugins.wire.scene.world!.bakedlight as Settings
      if (!started) {
        started = true
        fire = new T.Color(s.fire)
        Object.assign(uniforms, {
          bakeMap: { value: null }, bakeEdges: { value: null }, bakeKeyDir: { value: new T.Vector3(0, 1, 0) },
          bakeSky: { value: new T.Color(0, 0, 0) }, bakeGround: { value: new T.Color(0, 0, 0) },
          bakeKey: { value: new T.Color(0, 0, 0) }, bakeFire: { value: new T.Color(0, 0, 0) },
        })
        plugins.render3d.splice('bakedlight', { uniforms, ...SPLICE })
        plugins.loader.load(s.file).then((file: { bytes: Uint8Array }) => {
          if (!started) return
          got = read(file.bytes)
          const light = new T.DataTexture(got.map, got.w, got.h, T.RGBAFormat, T.HalfFloatType)
          light.magFilter = light.minFilter = T.LinearFilter
          light.wrapS = light.wrapT = T.ClampToEdgeWrapping
          light.needsUpdate = true
          const edge = new T.DataTexture(got.edges, got.w, got.h, T.RedFormat, T.HalfFloatType)
          edge.magFilter = edge.minFilter = T.LinearFilter
          edge.wrapS = edge.wrapT = T.ClampToEdgeWrapping
          edge.needsUpdate = true
          made = [light, edge]
          uniforms.bakeMap.value = light
          uniforms.bakeEdges.value = edge
        })
      }
      // the place's geometry given the file's attributes, once both are here
      const mesh = plugins.world3d.mesh() as THREE.Mesh | undefined
      if (got && mesh && mesh.geometry !== given) {
        const count = mesh.geometry.getAttribute('position').count
        if (count !== got.count) throw new Error(`bakedlight: the light file is for ${got.count} vertices and world3d's place has ${count}; bake the place again`)
        mesh.geometry.setAttribute('bakeLight', new T.BufferAttribute(got.light, 4))
        mesh.geometry.setAttribute('bakeAt', new T.BufferAttribute(got.at, 4))
        given = mesh.geometry
      }
      const sky = plugins.skydome3d.light()
      if (sky) {
        uniforms.bakeSky.value.copy(sky.sky)
        uniforms.bakeGround.value.copy(sky.ground)
        uniforms.bakeKey.value.copy(sky.keyColor)
        uniforms.bakeKeyDir.value.copy(sky.key).normalize()
      }
      const t = performance.now() / 1000
      const flicker = s.flicker.reduce((f, [amount, rate, phase]) => f + amount * Math.sin(t * rate + phase), 1)
      uniforms.bakeFire.value.copy(fire!).multiplyScalar(s.fireGain * flicker)
    },
    close() {
      started = false
      for (const t of made) t.dispose()
      made = []
      got = undefined
      given = undefined
      if (uniforms.bakeMap) uniforms.bakeMap.value = uniforms.bakeEdges.value = null
    },
  }
}
