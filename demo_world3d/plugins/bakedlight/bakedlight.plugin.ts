// bakedlight, demo_world3d's own plugin (loaded by `shipped`, `world.shipped.plugins`): a place lit by the light its
// bake worked out (`assets/demo_world3d.light.ts`), with no light running for it. It has no row and no server half.
// `world.bakedlight`:
//   file       the catalogue name of the place's `<place>.light.bin` (a `binary` entry; `preload` it)
//   fire       the fires' colour
//   fireGain   their intensity, as a point light's: a fire lights a face a metre off it facing it fireGain times its colour
//   flicker    the fires' flicker, each [amount, rate, phase]: the fires are 1 + Σ amount · sin(seconds · rate + phase)
//              times as bright
//   wide       the vertices' texture's width in texels, two texels a vertex
//   match      the metres within which a vertex stands where its entry says for it to be the place's
//   bake       the bake's own numbers (`demo_world3d.light.ts`), which the page never reads
//
// The file says, for every vertex of the place in the order world3d's one geometry holds them, where it stands and how
// it is lit: live, by its own four numbers, or by the map. On its first tick it registers a render3d splice under
// `bakedlight`, so every dressed material has it, supershader3d's that draw the place among them. Each vertex reads its
// entry by its number (`gl_VertexID`), and is the place's only where it stands where its entry says, so any other mesh
// the same materials draw is lit live. A baked fragment's light is the sky's, the ground's and the key's colours
// (skydome3d's `light()`: what its hemisphere and key lights give) and the fires' colour times its four numbers, in
// place of the hemisphere light, the key light and the sky's reflections; every other light (lights3d's, three's own
// point and spot lights) lights it as it lights everything. Between a baked vertex and a live one the two are blended.
// Before the file has landed every vertex is lit live. `close` disposes its textures.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'

type Settings = { file: string; fire: string; fireGain: number; flicker: [number, number, number][]; wide: number; match: number }

// The splice, the vertices' texture `wide` texels across (two a vertex), a vertex the place's where it stands within
// `match` metres of where its entry says.
export const splice = (WIDE: number, match: number) => ({
  vertex: {
    common: [
      'uniform highp sampler2D bakeVerts;',
      'uniform int bakeCount;',
      'varying vec4 vBakeLight;',
      'varying vec3 vBakeMap;',
      'varying float vBakeLive;',
    ].join('\n'),
    '?begin_vertex': [
      'vBakeLight = vec4( 0.0 );',
      'vBakeMap = vec3( 0.0 );',
      'vBakeLive = 1.0;',
      'if ( gl_VertexID < bakeCount ) {',
      `  int bakeAt = gl_VertexID * 2;`,
      `  vec4 bakeA = texelFetch( bakeVerts, ivec2( bakeAt % ${WIDE}, bakeAt / ${WIDE} ), 0 );`,
      `  if ( bakeA.w > 0.5 && distance( bakeA.xyz, position ) < ${match.toFixed(6)} ) {`,
      `    vec4 bakeB = texelFetch( bakeVerts, ivec2( ( bakeAt + 1 ) % ${WIDE}, ( bakeAt + 1 ) / ${WIDE} ), 0 );`,
      '    vBakeLive = 0.0;',
      '    if ( bakeA.w > 1.5 ) vBakeMap = vec3( bakeB.xy, 1.0 );',
      '    else vBakeLight = bakeB;',
      '  }',
      '}',
    ].join('\n'),
  },
  fragment: {
    // the place's light, read before the lights; the key light taken out where it is baked
    '?lights_pars_begin': [
      'uniform sampler2D bakeMap;',
      'uniform sampler2D bakeEdges;',
      'uniform vec3 bakeKeyDir;',
      'float bakePatch = 0.0;',
      'uniform vec3 bakeSky;',
      'uniform vec3 bakeGround;',
      'uniform vec3 bakeKey;',
      'uniform vec3 bakeFire;',
      'varying vec4 vBakeLight;',
      'varying vec3 vBakeMap;',
      'varying float vBakeLive;',
      'float bakeLive = 1.0;',
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
      'bakeLive = vBakeLive;',
      'vec4 bakeMapped = texture( bakeMap, vBakeMap.xy );',
      // the sun patch: its edge where the distance crosses nought, a pixel wide, lit by the key light's cosine
      'float bakeEdge = texture( bakeEdges, vBakeMap.xy ).r;',
      'float bakeSun = clamp( 0.5 + bakeEdge / max( fwidth( bakeEdge ), 1e-4 ), 0.0, 1.0 );',
      'bakeHere = vBakeMap.z > 0.5 ? bakeMapped : vBakeLight / max( 1.0 - vBakeLive, 1e-3 );',
      'bakePatch = vBakeMap.z > 0.5 ? bakeSun * max( dot( inverseTransformDirection( normal, viewMatrix ), bakeKeyDir ), 0.0 ) : 0.0;',
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
})

// The file read: its vertices' texture's texels (two a vertex, `WIDE` across) and its map's half floats.
export function read(bytes: Uint8Array, WIDE: number) {
  const copy = bytes.slice()
  const head = new Uint32Array(copy.buffer, 0, 8)
  if (head[0] !== 0x314b424c) throw new Error('bakedlight: the file is no light bake (LBK1); bake the place again')
  const count = head[1], w = head[2], h = head[3]
  const verts = new Float32Array(copy.buffer, 32, count * 8)
  const map = new Uint16Array(copy.buffer, 32 + count * 32, w * h * 4)
  const edges = new Uint16Array(copy.buffer, 32 + count * 32 + w * h * 8, w * h)
  const rows = Math.max(1, Math.ceil((count * 2) / WIDE))
  const texels = new Float32Array(WIDE * rows * 4)
  texels.set(verts)
  return { count, w, h, rows, texels, map, edges }
}

export function bakedlight() {
  let started = false
  let made: THREE.Texture[] = []
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
          bakeVerts: { value: null }, bakeCount: { value: 0 }, bakeMap: { value: null }, bakeEdges: { value: null },
          bakeKeyDir: { value: new T.Vector3(0, 1, 0) },
          bakeSky: { value: new T.Color(0, 0, 0) }, bakeGround: { value: new T.Color(0, 0, 0) },
          bakeKey: { value: new T.Color(0, 0, 0) }, bakeFire: { value: new T.Color(0, 0, 0) },
        })
        plugins.render3d.splice('bakedlight', { uniforms, ...splice(s.wide, s.match) })
        plugins.loader.load(s.file).then((got: { bytes: Uint8Array }) => {
          if (!started) return
          const { count, w, h, rows, texels, map, edges } = read(got.bytes, s.wide)
          const verts = new T.DataTexture(texels, s.wide, rows, T.RGBAFormat, T.FloatType)
          verts.magFilter = verts.minFilter = T.NearestFilter
          verts.needsUpdate = true
          const light = new T.DataTexture(map, w, h, T.RGBAFormat, T.HalfFloatType)
          light.magFilter = light.minFilter = T.LinearFilter
          light.wrapS = light.wrapT = T.ClampToEdgeWrapping
          light.needsUpdate = true
          const edge = new T.DataTexture(edges, w, h, T.RedFormat, T.HalfFloatType)
          edge.magFilter = edge.minFilter = T.LinearFilter
          edge.wrapS = edge.wrapT = T.ClampToEdgeWrapping
          edge.needsUpdate = true
          made = [verts, light, edge]
          uniforms.bakeVerts.value = verts
          uniforms.bakeMap.value = light
          uniforms.bakeEdges.value = edge
          uniforms.bakeCount.value = count
        })
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
      if (uniforms.bakeCount) {
        uniforms.bakeCount.value = 0
        uniforms.bakeVerts.value = uniforms.bakeMap.value = uniforms.bakeEdges.value = null
      }
    },
  }
}
