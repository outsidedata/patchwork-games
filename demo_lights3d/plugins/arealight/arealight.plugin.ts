// arealight: every three.js `RectAreaLight` in render3d's scene lit by this plugin's own splice in place
// of three's, and a light may be a picture: the experiment of the panel scene, before it moves into
// lights3d. It has no row and no server half.
//
// A light is added the ordinary three.js way: a `RectAreaLight` of `color`, `intensity`, `width` and
// `height` on the scene, shining along its own −z, its middle where it stands. A light whose
// `userData.picture` is a three texture shines that picture: each point of the room is lit by the part
// of the picture it faces, its colour times the light's colour × `intensity`. The picture is laid on the
// light as on a plane facing the way it shines: its left edge at the light's +x, its top at its +y, so a
// panel facing +z, its light turned half round to shine out of it, shows the picture and lights with it
// the same way round.
//
// `world.arealight` holds its numbers: `{ size, levels, blur }`. Each picture is prefiltered into
// `levels` layers of `size` × `size` texels of a texture array: the picture in the middle, a border of
// its own edge round it a share `PAD` of the layer wide each side, so a blur reaching past the light's
// edge fades out instead of wrapping; layer 0 the picture as it is, and each layer after blurred by a
// Gaussian twice as wide as the one before, layer k's spread 2^k / 2^levels of the picture's width, so the
// last is the picture's average. It is filtered again whenever its texture's `version` changes, so a
// picture that is drawn into or played (a canvas, a video) lights the room as it is now.
//
// Each time the scene is drawn (three calls the scene's `onBeforeRender`):
//
// 1. Every visible `RectAreaLight` of the scene has its layers turned off, so three's own loop leaves it
//    out; the layers it had are given back on `close`.
// 2. Each light's middle, its half width and half height as vectors, its colour × `intensity` and the
//    first layer of its picture (−1 for none), in the world, are written into a float texture, four
//    texels a light, one row each, and the number of lights into a uniform. They are in the world, not
//    the view, so a scene drawn again inside a draw (lights3d's shadows, its probes) through another
//    camera reads the same texture: the splice puts each into the view of whichever camera is drawing by
//    that program's own `viewMatrix`.
//
// A splice (render3d's `splice`, under `arealight`, only into the shaders that light, and there only into
// standard and physical ones, which three's LTC code is written for) evaluates each light by three's own
// Linearly Transformed Cosines (Heitz et al. 2016), as three's `RE_Direct_RectArea_Physical` does: the
// rectangle's four corners turned into the space where the surface's lobe is a plain cosine, the
// specular lobe fitted from the LTC tables (`RectAreaLightTexturesLib`) by the surface's roughness and
// the angle it is seen at, the diffuse the same rectangle untransformed. A picture is read as Heitz's
// textured lights read it (Heitz, Dupuy, Hill, Neubelt, "Real-Time Polygonal-Light Shading with Linearly
// Transformed Cosines", 2016, the filtered texture fetch): where the lobe's middle, the point straight
// in front of the surface in that space, falls on the light's plane gives the place in the picture, and
// that point's distance from the plane over the square root of the light's area there gives how blurred:
// a lobe close to a big light sees a small piece of it sharp, one far off or wide (a rough or a diffuse
// surface) sees the whole light averaged. The spread read is `blur` times that ratio, as a share of the
// picture's width, between the two layers either side of it. The splice is on while a draw of the scene
// is under way, however deep, and off once the outermost has finished, so any other scene through the
// same renderer is left as three lights it.
//
// Shadows are lights3d's. A light whose `userData.shadow` is a three `SpotLight` that casts a shadow,
// hung at its middle and aimed the way it shines (its own light given nothing, intensity 0), is shadowed
// by that spot's shadow: lights3d gives the spot its tiles in the still atlas and the moving one as it
// gives any lamp, draws what never moves into the first once and what is marked moving
// (`userData.moving`) into the second each frame, and the splice reads them through lights3d's own
// `lights3dShadow`, the two shares multiplied, from the panel's middle, so the shadow is a point light's,
// hard at the tiles' texels, not an area light's that softens with distance. The splice finds the spot
// in lights3d's light texture by its place in lights3d's list, which it works out by lights3d's own
// rule: the scene's visible point and spot lights in the order the scene is walked, on a layer the
// camera sees (this hook runs before lights3d's, the scene listing lights3d before `shipped`, so it sees
// each light's layers before lights3d takes them). A point outside the spot's cone, or a spot given no
// tiles, is lit unshadowed. With no lights3d in the scene there are no shadows.
//
// It reads `count`, the lights lit the last draw, and `pictures`, those that shine a picture, and
// `filtered`, the times a picture has been prefiltered. `close` gives every light its layers back, frees
// its textures and gives the scene its hooks back.
import type * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import type { Plugins } from '#engine/browser.ts'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'

export type Settings = { size: number; levels: number; blur: number }

// Texels a light: middle and its picture's first layer, half width, half height, colour.
const TEXELS = 4
// The share of a layer's width left each side of the picture for its blurred edge.
const PAD = 0.125
// Taps each side of the middle in a blur pass.
const TAPS = 6

const checked = (s: Settings | undefined): Settings => {
  if (!s) throw new Error('arealight reads world.arealight, { size, levels, blur }, which this scene does not give')
  if (!(Number.isInteger(s.size) && s.size >= 8)) throw new Error(`arealight size ${s.size} is not a whole number of texels from 8`)
  if (!(Number.isInteger(s.levels) && s.levels >= 2)) throw new Error(`arealight levels ${s.levels} is not a whole number from 2`)
  if (!(s.blur > 0)) throw new Error(`arealight blur ${s.blur} is not above 0`)
  return s
}

const GLSL = (levels: number) => ({
  common: `
    uniform float uArealightOn;
    uniform int uArealightCount;
    uniform highp sampler2D uArealightLights;
    uniform highp sampler2DArray uArealightPictures;
    uniform float uArealightBlur;
    uniform sampler2D uArealightLtc1; uniform sampler2D uArealightLtc2;
    #define AREALIGHT_LEVELS ${levels}.0
    #define AREALIGHT_PAD ${PAD}`,
  '?lights_physical_pars_fragment': `
    // The picture's light seen by a lobe from corners p0, p1, p3 of the light (p0 its left bottom, p1 its
    // right bottom, p3 its left top) relative to the surface, in the lobe's own space, its picture's first
    // layer \`first\`.
    vec3 arealightFetch( vec3 p0, vec3 p1, vec3 p3, float first ) {
      vec3 v1 = p1 - p0, v2 = p3 - p0;
      vec3 across = cross( v1, v2 );
      float area2 = dot( across, across );
      float away = dot( across, p0 );
      // the foot of the lobe's middle on the light's plane, from p0
      vec3 foot = away * across / area2 - p0;
      float d12 = dot( v1, v2 ), i11 = 1.0 / dot( v1, v1 );
      vec3 up = v2 - v1 * d12 * i11;
      vec2 uv;
      uv.y = dot( up, foot ) / dot( up, up );
      uv.x = dot( v1, foot ) * i11 - d12 * i11 * uv.y;
      // distance over the square root of the area, how much of the light the lobe takes in
      float seen = abs( away ) / pow( area2, 0.75 );
      float level = clamp( log2( max( seen * uArealightBlur, 1e-6 ) ) + AREALIGHT_LEVELS, 0.0, AREALIGHT_LEVELS - 1.0 );
      vec2 at = AREALIGHT_PAD + ( 1.0 - 2.0 * AREALIGHT_PAD ) * uv;
      float lo = floor( level );
      vec3 a = texture( uArealightPictures, vec3( at, first + lo ) ).rgb;
      vec3 b = texture( uArealightPictures, vec3( at, first + min( lo + 1.0, AREALIGHT_LEVELS - 1.0 ) ) ).rgb;
      return mix( a, b, level - lo );
    }
    // three's LTC_Evaluate, the light's colour read from its picture where it has one.
    vec3 arealightEvaluate( vec3 N, vec3 V, vec3 P, mat3 mInv, vec3 rect[ 4 ], float first ) {
      vec3 v1 = rect[ 1 ] - rect[ 0 ], v2 = rect[ 3 ] - rect[ 0 ];
      if ( dot( cross( v1, v2 ), P - rect[ 0 ] ) < 0.0 ) return vec3( 0.0 );
      vec3 T1 = normalize( V - N * dot( V, N ) );
      vec3 T2 = - cross( N, T1 );
      mat3 m = mInv * transpose( mat3( T1, T2, N ) );
      vec3 c[ 4 ];
      for ( int i = 0; i < 4; i ++ ) c[ i ] = m * ( rect[ i ] - P );
      vec3 shone = first < 0.0 ? vec3( 1.0 ) : arealightFetch( c[ 0 ], c[ 1 ], c[ 3 ], first );
      for ( int i = 0; i < 4; i ++ ) c[ i ] = normalize( c[ i ] );
      vec3 f = LTC_EdgeVectorFormFactor( c[ 0 ], c[ 1 ] ) + LTC_EdgeVectorFormFactor( c[ 1 ], c[ 2 ] )
        + LTC_EdgeVectorFormFactor( c[ 2 ], c[ 3 ] ) + LTC_EdgeVectorFormFactor( c[ 3 ], c[ 0 ] );
      return shone * LTC_ClippedSphereFormFactor( f );
    }`,
  '?lights_fragment_begin': `
    #ifdef STANDARD
    if ( uArealightOn > 0.5 ) {
      vec2 alUv = LTC_Uv( geometryNormal, geometryViewDir, material.roughness );
      vec4 alT1 = texture2D( uArealightLtc1, alUv );
      vec4 alT2 = texture2D( uArealightLtc2, alUv );
      mat3 alInv = mat3( vec3( alT1.x, 0, alT1.y ), vec3( 0, 1, 0 ), vec3( alT1.z, 0, alT1.w ) );
      vec3 alFresnel = material.specularColorBlended * alT2.x + ( material.specularF90 - material.specularColorBlended ) * alT2.y;
      for ( int i = 0; i < uArealightCount; i ++ ) {
        vec4 alA = texelFetch( uArealightLights, ivec2( 0, i ), 0 );
        vec3 alAt = ( viewMatrix * vec4( alA.xyz, 1.0 ) ).xyz;
        vec4 alWk = texelFetch( uArealightLights, ivec2( 1, i ), 0 );
        vec3 alW = mat3( viewMatrix ) * alWk.xyz;
        vec3 alH = mat3( viewMatrix ) * texelFetch( uArealightLights, ivec2( 2, i ), 0 ).xyz;
        vec3 alColour = texelFetch( uArealightLights, ivec2( 3, i ), 0 ).rgb;
        #ifdef LIGHTS3D_ROW
        // its shadow: lights3d's own for the spot at its middle, lights3d's light alWk.w, read from its
        // tiles in the still atlas and the moving one as lights3d reads a lamp's
        if ( alWk.w >= 0.0 && uLights3dOn > 0.5 ) {
          int alK = int( alWk.w );
          ivec2 alT = ivec2( alK % LIGHTS3D_ROW, ( alK / LIGHTS3D_ROW ) * LIGHTS3D_TEXELS );
          vec3 alSpot = texelFetch( uLights3dLights, alT, 0 ).xyz;
          vec4 alP = texelFetch( uLights3dLights, alT + ivec2( 0, 3 ), 0 );
          vec4 alQ = texelFetch( uLights3dLights, alT + ivec2( 0, 4 ), 0 );
          if ( alP.z > 0.0 ) {
            vec3 alMoved = geometryPosition + geometryNormal * alQ.z;
            alColour *= lights3dShadow( alMoved, length( alSpot - alMoved ), alP, alQ );
          }
        }
        #endif
        // counterclockwise seen from the side it shines on, as three's RE_Direct_RectArea_Physical: the
        // light's +x and −y, −x and −y, −x and +y, +x and +y; seen from in front, its +x is on the left
        vec3 alRect[ 4 ];
        alRect[ 0 ] = alAt + alW - alH;
        alRect[ 1 ] = alAt - alW - alH;
        alRect[ 2 ] = alAt - alW + alH;
        alRect[ 3 ] = alAt + alW + alH;
        reflectedLight.directSpecular += alColour * alFresnel * arealightEvaluate( geometryNormal, geometryViewDir, geometryPosition, alInv, alRect, alA.w );
        reflectedLight.directDiffuse += alColour * material.diffuseContribution * arealightEvaluate( geometryNormal, geometryViewDir, geometryPosition, mat3( 1.0 ), alRect, alA.w );
      }
    }
    #endif`,
})

// The picture laid into a layer with its border: its own edge carried out to the layer's edge.
const LAY = `
  uniform sampler2D picture;
  varying vec2 vUv;
  void main() {
    vec2 at = clamp( ( vUv - ${PAD} ) / ( 1.0 - 2.0 * ${PAD} ), 0.0, 1.0 );
    gl_FragColor = vec4( texture2D( picture, at ).rgb, 1.0 );
  }`

// One pass of a Gaussian whose standard deviation is `spread` (a share of the layer's width) along
// `way`, out to three of them each side, from a 2D texture or a layer of the array.
const BLUR = (array: boolean) => `
  ${array ? 'uniform highp sampler2DArray from; uniform float layer;' : 'uniform sampler2D from;'}
  uniform vec2 way;
  uniform float spread;
  varying vec2 vUv;
  void main() {
    vec3 sum = vec3( 0.0 );
    float total = 0.0;
    for ( int i = -${TAPS}; i <= ${TAPS}; i ++ ) {
      float x = float( i ) / ${TAPS}.0 * 3.0;
      float w = exp( - 0.5 * x * x );
      vec2 at = vUv + way * x * spread;
      sum += w * ${array ? 'texture( from, vec3( at, layer ) ).rgb' : 'texture2D( from, at ).rgb'};
      total += w;
    }
    gl_FragColor = vec4( sum / total, 1.0 );
  }`

const VERTEX = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }'

export function arealight() {
  let built: {
    T: typeof THREE
    s: Settings
    scene: THREE.Scene
    before: THREE.Scene['onBeforeRender']
    after: THREE.Scene['onAfterRender']
    lights: THREE.DataTexture
    // the pictures' layers, `levels` a picture, and the target a blur pass is drawn into on its way
    pictures: THREE.WebGLArrayRenderTarget
    half: THREE.WebGLRenderTarget
    lay: THREE.ShaderMaterial
    across: THREE.ShaderMaterial
    down: THREE.ShaderMaterial
    quad: FullScreenQuad
  } | undefined
  // Each light whose layers this turned off, and the layers it had.
  const taken = new Map<THREE.RectAreaLight, number>()
  // Each picture's place in the array, counted in pictures, and the version of it last filtered there.
  const slots = new Map<THREE.Texture, { slot: number; version: number }>()
  const uniforms: Record<string, THREE.IUniform> = {}
  // Each point and spot light's layers as first seen, and its place in lights3d's list this draw.
  const masks = new Map<THREE.Light, number>()
  const place = new Map<THREE.Light, number>()
  // How many draws of the scene are under way, one inside another.
  let depth = 0

  // Filters `picture` into its slot's layers.
  const filter = (renderer: THREE.WebGLRenderer, picture: THREE.Texture, slot: number) => {
    const b = built!
    const was = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel()
    const first = slot * b.s.levels
    b.lay.uniforms.picture.value = picture
    b.quad.material = b.lay
    renderer.setRenderTarget(b.pictures, first)
    b.quad.render(renderer)
    for (let k = 1; k < b.s.levels; k++) {
      // the spread this layer adds to the one before, so the two together are 2^k / 2^levels
      const now = 2 ** k / 2 ** b.s.levels, then = k === 1 ? 0 : 2 ** (k - 1) / 2 ** b.s.levels
      const spread = Math.sqrt(now * now - then * then) * (1 - 2 * PAD)
      b.across.uniforms.layer.value = first + k - 1
      b.across.uniforms.spread.value = spread
      b.quad.material = b.across
      renderer.setRenderTarget(b.half)
      b.quad.render(renderer)
      b.down.uniforms.spread.value = spread
      b.quad.material = b.down
      renderer.setRenderTarget(b.pictures, first + k)
      b.quad.render(renderer)
    }
    renderer.setRenderTarget(was, face, level)
    me.filtered++
  }

  // The array grown to hold `n` pictures, the ones it held filtered again into the new one.
  const grow = (n: number) => {
    const b = built!
    if (b.pictures.depth >= n * b.s.levels) return
    b.pictures.dispose()
    b.pictures = array(b.T, b.s, n)
    uniforms.uArealightPictures.value = b.pictures.texture
    b.across.uniforms.from.value = b.pictures.texture
    for (const held of slots.values()) held.version = -1
  }

  const me = {
    uniforms,
    count: 0,
    pictures: 0,
    filtered: 0,
    tick(plugins: Plugins) {
      if (built) return
      const render3d = plugins.render3d
      if (!render3d) throw new Error('arealight needs render3d, which this scene does not name')
      const s = checked(plugins.wire.scene.world?.arealight as Settings | undefined)
      const T = render3d.THREE as typeof THREE
      const scene = render3d.scene as THREE.Scene
      const ltc = RectAreaLightTexturesLib.init()
      const lights = new T.DataTexture(new Float32Array(TEXELS * 4), TEXELS, 1, T.RGBAFormat, T.FloatType)
      lights.needsUpdate = true
      const pictures = array(T, s, 1)
      const half = new T.WebGLRenderTarget(s.size, s.size, { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, generateMipmaps: false, depthBuffer: false })
      const shader = (fragmentShader: string, more: Record<string, THREE.IUniform>) =>
        new T.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms: more, depthTest: false, depthWrite: false })
      const lay = shader(LAY, { picture: { value: null } })
      const across = shader(BLUR(true), { from: { value: pictures.texture }, layer: { value: 0 }, way: { value: new T.Vector2(1, 0) }, spread: { value: 0 } })
      const down = shader(BLUR(false), { from: { value: half.texture }, way: { value: new T.Vector2(0, 1) }, spread: { value: 0 } })
      built = { T, s, scene, before: scene.onBeforeRender, after: scene.onAfterRender, lights, pictures, half, lay, across, down, quad: new FullScreenQuad(lay) }
      Object.assign(uniforms, {
        uArealightOn: { value: 0 },
        uArealightCount: { value: 0 },
        uArealightLights: { value: lights },
        uArealightPictures: { value: pictures.texture },
        uArealightBlur: { value: s.blur },
        uArealightLtc1: { value: ltc.LTC_FLOAT_1 },
        uArealightLtc2: { value: ltc.LTC_FLOAT_2 },
      })
      render3d.splice('arealight', { uniforms, fragment: GLSL(s.levels) })
      const { before, after } = built
      const at = new T.Vector3(), w = new T.Vector3(), h = new T.Vector3()
      const turn = new T.Matrix4()
      const found: THREE.RectAreaLight[] = []
      scene.onBeforeRender = function (renderer, s3, camera, target, material, group) {
        depth++
        uniforms.uArealightOn.value = 1
        // the lights are written once, by the outermost draw, before whatever it draws inside
        if (depth === 1) {
          const b = built!
          uniforms.uArealightBlur.value = b.s.blur
          found.length = 0
          scene.traverseVisible(o => {
            const light = o as THREE.RectAreaLight
            if (!light.isRectAreaLight) return
            if (!taken.has(light)) { taken.set(light, light.layers.mask); light.layers.mask = 0 }
            found.push(light)
          })
          // each picture given a slot, and filtered again where it has changed
          const shown = new Set<THREE.Texture>()
          for (const light of found) {
            const picture = light.userData.picture as THREE.Texture | undefined
            if (picture?.image) shown.add(picture)
          }
          for (const picture of [...slots.keys()]) if (!shown.has(picture)) slots.delete(picture)
          const used = new Set([...slots.values()].map(v => v.slot))
          for (const picture of shown) {
            if (slots.has(picture)) continue
            let slot = 0
            while (used.has(slot)) slot++
            used.add(slot)
            slots.set(picture, { slot, version: -1 })
          }
          grow(Math.max(1, ...[...used].map(u => u + 1)))
          for (const [picture, held] of slots) {
            if (held.version === picture.version) continue
            filter(renderer, picture, held.slot)
            held.version = picture.version
          }
          me.pictures = shown.size
          // where lights3d writes each light: its visible point and spot lights in the scene's order, on a
          // layer the camera sees, by the layers each had before lights3d took them (seen here first,
          // since this hook runs before lights3d's; one first seen already taken had three's default)
          place.clear()
          let k = 0
          scene.traverseVisible(o => {
            const lamp = o as THREE.PointLight | THREE.SpotLight
            if (!(lamp as THREE.PointLight).isPointLight && !(lamp as THREE.SpotLight).isSpotLight) return
            if (!masks.has(lamp)) masks.set(lamp, lamp.layers.mask || 1)
            if (!(masks.get(lamp)! & camera.layers.mask)) return
            place.set(lamp, k++)
          })
          if (b.lights.image.height < found.length) {
            b.lights.dispose()
            b.lights = new b.T.DataTexture(new Float32Array(TEXELS * 4 * found.length), TEXELS, found.length, b.T.RGBAFormat, b.T.FloatType)
            uniforms.uArealightLights.value = b.lights
          }
          const data = b.lights.image.data as Float32Array
          found.forEach((light, i) => {
            turn.extractRotation(light.matrixWorld)
            at.setFromMatrixPosition(light.matrixWorld)
            w.set(light.width / 2, 0, 0).applyMatrix4(turn)
            h.set(0, light.height / 2, 0).applyMatrix4(turn)
            const held = slots.get(light.userData.picture)
            const first = held ? held.slot * b.s.levels : -1
            const shadow = light.userData.shadow as THREE.SpotLight | undefined
            const k = shadow ? place.get(shadow) ?? -1 : -1
            const o = i * TEXELS * 4
            data.set([at.x, at.y, at.z, first, w.x, w.y, w.z, k, h.x, h.y, h.z, 0], o)
            data.set([light.color.r * light.intensity, light.color.g * light.intensity, light.color.b * light.intensity, 1], o + 12)
          })
          b.lights.needsUpdate = true
          uniforms.uArealightCount.value = found.length
          me.count = found.length
        }
        before.call(this, renderer, s3, camera, target, material, group)
      }
      scene.onAfterRender = function (renderer, s3, camera, geometry, material, group) {
        after.call(this, renderer, s3, camera, geometry, material, group)
        depth--
        if (depth === 0) uniforms.uArealightOn.value = 0
      }
    },
    close() {
      if (!built) return
      for (const [light, mask] of taken) light.layers.mask = mask
      taken.clear()
      slots.clear()
      masks.clear()
      place.clear()
      built.scene.onBeforeRender = built.before
      built.scene.onAfterRender = built.after
      built.lights.dispose()
      for (const t of [built.pictures, built.half]) t.dispose()
      for (const m of [built.lay, built.across, built.down]) m.dispose()
      built.quad.dispose()
      uniforms.uArealightOn.value = 0
      depth = 0
      built = undefined
    },
  }
  return me
}

// The layers of `n` pictures, `levels` each, half floats read smoothly between texels.
function array(T: typeof THREE, s: Settings, n: number) {
  const target = new T.WebGLArrayRenderTarget(s.size, s.size, n * s.levels, { type: T.HalfFloatType, generateMipmaps: false, depthBuffer: false })
  target.texture.minFilter = T.LinearFilter
  target.texture.magFilter = T.LinearFilter
  return target
}
