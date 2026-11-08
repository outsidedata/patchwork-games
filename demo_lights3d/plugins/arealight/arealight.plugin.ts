// arealight: every three.js `RectAreaLight` in render3d's scene lit by this plugin's own splice in place
// of three's, so a light can be a picture: the experiment of the panel scene, before it moves into
// lights3d. It has no row, no numbers and no server half.
//
// A light is added the ordinary three.js way: a `RectAreaLight` of `color`, `intensity`, `width` and
// `height` on the scene, shining along its own −z, its middle where it stands. Each time the scene is
// drawn (three calls the scene's `onBeforeRender`):
//
// 1. Every visible `RectAreaLight` of the scene has its layers turned off, so three's own loop leaves it
//    out; the layers it had are given back on `close`.
// 2. Each light's middle, its half width and half height as vectors, and its colour × `intensity`, in
//    the world, are written into a float texture, four texels a light, one row each, and the number of
//    lights into a uniform. They are in the world, not the view, so a scene drawn again inside a draw
//    (lights3d's shadows, its probes) through another camera reads the same texture: the splice puts
//    each into the view of whichever camera is drawing by that program's own `viewMatrix`.
//
// A splice (render3d's `splice`, under `arealight`, `?lights_fragment_begin`: only into the shaders that
// light, and there only into standard and physical ones, which three's LTC code is written for) hands
// each light to three's own Linearly Transformed Cosines evaluation (Heitz et al. 2016), as three's
// `RE_Direct_RectArea_Physical` does: the rectangle's four corners, the specular lobe fitted from the
// LTC tables (`RectAreaLightTexturesLib`) by the surface's roughness and the angle it is seen at, the
// diffuse from the same rectangle untransformed, each times the light's colour. The splice is on while a
// draw of the scene is under way, however deep, and off once the outermost has finished, so any other
// scene through the same renderer is left as three lights it.
//
// It reads `count`, the lights lit the last draw. `close` gives every light its layers back, frees the
// texture and gives the scene its hooks back.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'

// Texels a light: middle, half width, half height, colour.
const TEXELS = 4

const GLSL = {
  common: `
    uniform float uArealightOn;
    uniform int uArealightCount;
    uniform highp sampler2D uArealightLights;
    uniform sampler2D uArealightLtc1; uniform sampler2D uArealightLtc2;`,
  '?lights_fragment_begin': `
    #ifdef STANDARD
    if ( uArealightOn > 0.5 ) {
      vec2 alUv = LTC_Uv( geometryNormal, geometryViewDir, material.roughness );
      vec4 alT1 = texture2D( uArealightLtc1, alUv );
      vec4 alT2 = texture2D( uArealightLtc2, alUv );
      mat3 alInv = mat3( vec3( alT1.x, 0, alT1.y ), vec3( 0, 1, 0 ), vec3( alT1.z, 0, alT1.w ) );
      vec3 alFresnel = material.specularColorBlended * alT2.x + ( material.specularF90 - material.specularColorBlended ) * alT2.y;
      for ( int i = 0; i < uArealightCount; i ++ ) {
        vec3 alAt = ( viewMatrix * vec4( texelFetch( uArealightLights, ivec2( 0, i ), 0 ).xyz, 1.0 ) ).xyz;
        vec3 alW = mat3( viewMatrix ) * texelFetch( uArealightLights, ivec2( 1, i ), 0 ).xyz;
        vec3 alH = mat3( viewMatrix ) * texelFetch( uArealightLights, ivec2( 2, i ), 0 ).xyz;
        vec3 alColour = texelFetch( uArealightLights, ivec2( 3, i ), 0 ).rgb;
        // counterclockwise seen from the side it shines on, as three's RE_Direct_RectArea_Physical
        vec3 alRect[ 4 ];
        alRect[ 0 ] = alAt + alW - alH;
        alRect[ 1 ] = alAt - alW - alH;
        alRect[ 2 ] = alAt - alW + alH;
        alRect[ 3 ] = alAt + alW + alH;
        reflectedLight.directSpecular += alColour * alFresnel * LTC_Evaluate( geometryNormal, geometryViewDir, geometryPosition, alInv, alRect );
        reflectedLight.directDiffuse += alColour * material.diffuseContribution * LTC_Evaluate( geometryNormal, geometryViewDir, geometryPosition, mat3( 1.0 ), alRect );
      }
    }
    #endif`,
}

export function arealight() {
  let built: {
    T: typeof THREE
    scene: THREE.Scene
    before: THREE.Scene['onBeforeRender']
    after: THREE.Scene['onAfterRender']
    lights: THREE.DataTexture
  } | undefined
  // Each light whose layers this turned off, and the layers it had.
  const taken = new Map<THREE.RectAreaLight, number>()
  const uniforms: Record<string, THREE.IUniform> = {}
  // How many draws of the scene are under way, one inside another.
  let depth = 0

  const me = {
    uniforms,
    count: 0,
    tick(plugins: Plugins) {
      if (built) return
      const render3d = plugins.render3d
      if (!render3d) throw new Error('arealight needs render3d, which this scene does not name')
      const T = render3d.THREE as typeof THREE
      const scene = render3d.scene as THREE.Scene
      RectAreaLightTexturesLib.init()
      const lights = new T.DataTexture(new Float32Array(TEXELS * 4), TEXELS, 1, T.RGBAFormat, T.FloatType)
      lights.needsUpdate = true
      built = { T, scene, before: scene.onBeforeRender, after: scene.onAfterRender, lights }
      Object.assign(uniforms, {
        uArealightOn: { value: 0 },
        uArealightCount: { value: 0 },
        uArealightLights: { value: lights },
        uArealightLtc1: { value: RectAreaLightTexturesLib.LTC_FLOAT_1 },
        uArealightLtc2: { value: RectAreaLightTexturesLib.LTC_FLOAT_2 },
      })
      render3d.splice('arealight', { uniforms, fragment: GLSL })
      const { before, after } = built
      const at = new T.Vector3(), w = new T.Vector3(), h = new T.Vector3()
      const turn = new T.Matrix4()
      const found: THREE.RectAreaLight[] = []
      scene.onBeforeRender = function (renderer, s3, camera, target, material, group) {
        depth++
        uniforms.uArealightOn.value = 1
        // the lights are written once, by the outermost draw, before whatever it draws inside
        if (depth === 1) {
          found.length = 0
          scene.traverseVisible(o => {
            const light = o as THREE.RectAreaLight
            if (!light.isRectAreaLight) return
            if (!taken.has(light)) { taken.set(light, light.layers.mask); light.layers.mask = 0 }
            found.push(light)
          })
          const b = built!
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
            const o = i * TEXELS * 4
            data.set([at.x, at.y, at.z, 1, w.x, w.y, w.z, 0, h.x, h.y, h.z, 0], o)
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
      built.scene.onBeforeRender = built.before
      built.scene.onAfterRender = built.after
      built.lights.dispose()
      uniforms.uArealightOn.value = 0
      depth = 0
      built = undefined
    },
  }
  return me
}
