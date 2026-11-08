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

export type Settings = { size: number; levels: number; blur: number; glow: number }

// Texels a light: middle and its picture's first layer, half width, half height, colour.
const TEXELS = 4
// The share of a layer's width left each side of the picture for its blurred edge.
const PAD = 0.125
// Taps each side of the middle in a blur pass.
const TAPS = 6
// The glowing triangles. A catalogued triangle is a row of `corners`: each of its three corners CORNER texels, (its
// lookInfo, its lookId), (uv, s3), (s0, 0), (s1, 0), s2, (position as cut, 1), (normal as cut, 0); then one texel,
// (its mesh's number, 0, 0, 0), at MESH. Each mesh's matrix is a row of the lights texture after the rectangles',
// its four columns its first four texels. The glow is ROW texels across.
const CORNER = 7
const MESH = 3 * CORNER
const ROW = 256
// The glow of a triangle is read at SIDE × SIDE points over it.
const SIDE = 4

const checked = (s: Settings | undefined): Settings => {
  if (!s) throw new Error('arealight reads world.arealight, { size, levels, blur }, which this scene does not give')
  if (!(Number.isInteger(s.size) && s.size >= 8)) throw new Error(`arealight size ${s.size} is not a whole number of texels from 8`)
  if (!(Number.isInteger(s.levels) && s.levels >= 2)) throw new Error(`arealight levels ${s.levels} is not a whole number from 2`)
  if (!(s.blur > 0)) throw new Error(`arealight blur ${s.blur} is not above 0`)
  if (!(s.glow >= 0)) throw new Error(`arealight glow ${s.glow} is not 0 or more`)
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
    uniform int uArealightGlowCount; uniform int uArealightMeshRow; uniform float uArealightGlowGain;
    uniform highp sampler2D uArealightCorners; uniform highp sampler2D uArealightGlow;
    #define AREALIGHT_ROW ${ROW}
    #define AREALIGHT_CORNER ${CORNER}
    #define AREALIGHT_MESH ${MESH}
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
    }
    // LTC over a triangle t0, t1, t2, counterclockwise seen from the side it shines on: three edges in place of
    // a rectangle's four.
    float arealightTriangle( vec3 N, vec3 V, vec3 P, mat3 mInv, vec3 t0, vec3 t1, vec3 t2 ) {
      if ( dot( cross( t1 - t0, t2 - t0 ), P - t0 ) <= 0.0 ) return 0.0;
      vec3 T1 = normalize( V - N * dot( V, N ) );
      vec3 T2 = - cross( N, T1 );
      mat3 m = mInv * transpose( mat3( T1, T2, N ) );
      vec3 c0 = normalize( m * ( t0 - P ) ), c1 = normalize( m * ( t1 - P ) ), c2 = normalize( m * ( t2 - P ) );
      vec3 f = LTC_EdgeVectorFormFactor( c0, c1 ) + LTC_EdgeVectorFormFactor( c1, c2 ) + LTC_EdgeVectorFormFactor( c2, c0 );
      return LTC_ClippedSphereFormFactor( f );
    }
    // A glowing triangle's corner \`c\` in the view: triangle \`i\`'s corner as cut, put through its mesh's matrix.
    vec3 arealightCorner( int i, int c, mat4 toView ) {
      return ( toView * vec4( texelFetch( uArealightCorners, ivec2( c * AREALIGHT_CORNER + 5, i ), 0 ).xyz, 1.0 ) ).xyz;
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
      // every glowing triangle, by its own glow this frame, where its mesh stands
      for ( int i = 0; i < uArealightGlowCount; i ++ ) {
        int alMesh = uArealightMeshRow + int( texelFetch( uArealightCorners, ivec2( AREALIGHT_MESH, i ), 0 ).x );
        mat4 alToView = viewMatrix * mat4( texelFetch( uArealightLights, ivec2( 0, alMesh ), 0 ), texelFetch( uArealightLights, ivec2( 1, alMesh ), 0 ),
          texelFetch( uArealightLights, ivec2( 2, alMesh ), 0 ), texelFetch( uArealightLights, ivec2( 3, alMesh ), 0 ) );
        vec3 t0 = arealightCorner( i, 0, alToView ), t1 = arealightCorner( i, 1, alToView ), t2 = arealightCorner( i, 2, alToView );
        vec3 alGlow = uArealightGlowGain * texelFetch( uArealightGlow, ivec2( i % AREALIGHT_ROW, i / AREALIGHT_ROW ), 0 ).rgb;
        reflectedLight.directSpecular += alGlow * alFresnel * arealightTriangle( geometryNormal, geometryViewDir, geometryPosition, alInv, t0, t1, t2 );
        reflectedLight.directDiffuse += alGlow * material.diffuseContribution * arealightTriangle( geometryNormal, geometryViewDir, geometryPosition, mat3( 1.0 ), t0, t1, t2 );
      }
    }
    #endif`,
})

// The glow of every catalogued triangle: a texel each, ROW across, the mean of the material's own glow at SAMPLES
// points spread over it, each point given what a vertex there hands the look (its corners' inputs weighted by where
// it lies), put through its mesh's matrix as it stands, then the material's own `lookRun`. The look's screen
// derivatives are nought, so it reads its finest detail.
const SAMPLE = (pars: string) => `
  #include <common>
  vec3 vNormal;
  vec3 vViewPosition;
  ${pars}
  uniform highp sampler2D alCorners;
  uniform highp sampler2D alMatrices;
  uniform int alMeshRow;
  uniform int alCount;
  vec4 alAt( int i, int c, int k ) { return texelFetch( alCorners, ivec2( c * ${CORNER} + k, i ), 0 ); }
  void main() {
    int i = int( gl_FragCoord.x ) + int( gl_FragCoord.y ) * ${ROW};
    if ( i >= alCount ) { gl_FragColor = vec4( 0.0 ); return; }
    int mesh = alMeshRow + int( texelFetch( alCorners, ivec2( ${MESH}, i ), 0 ).x );
    mat4 M = mat4( texelFetch( alMatrices, ivec2( 0, mesh ), 0 ), texelFetch( alMatrices, ivec2( 1, mesh ), 0 ),
      texelFetch( alMatrices, ivec2( 2, mesh ), 0 ), texelFetch( alMatrices, ivec2( 3, mesh ), 0 ) );
    vec3 sum = vec3( 0.0 );
    for ( int a = 0; a < ${SIDE}; a ++ ) for ( int b = 0; b < ${SIDE}; b ++ ) {
      // a point of a grid over the square, folded into the triangle
      float u = ( float( a ) + 0.5 ) / ${SIDE}.0, v = ( float( b ) + 0.5 ) / ${SIDE}.0;
      if ( u + v > 1.0 ) { u = 1.0 - u; v = 1.0 - v; }
      vec3 w = vec3( 1.0 - u - v, u, v );
      vec4 t[ ${CORNER} ];
      for ( int k = 0; k < ${CORNER}; k ++ ) t[ k ] = w.x * alAt( i, 0, k ) + w.y * alAt( i, 1, k ) + w.z * alAt( i, 2, k );
      vLookId = alAt( i, 0, 0 ).w;
      vLookInfo = alAt( i, 0, 0 ).xyz;
      vLookUv = t[ 1 ].xy;
      vS3 = t[ 1 ].zw;
      vS0 = t[ 2 ].xyz;
      vS1 = t[ 3 ].xyz;
      vS2 = t[ 4 ];
      vLookWorld = ( M * vec4( t[ 5 ].xyz, 1.0 ) ).xyz;
      vLookWN = normalize( mat3( M ) * t[ 6 ].xyz );
      vNormal = vLookWN;
      vViewPosition = vec3( 0.0, 0.0, 1.0 );
      lookGx = vec2( 0.0 );
      lookGy = vec2( 0.0 );
      Look k = lookRun( int( vLookId + 0.5 ) );
      sum += k.glow;
    }
    gl_FragColor = vec4( sum / float( ${SIDE * SIDE} ), 1.0 );
  }`

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
  // The page's plugins, as the last tick handed them.
  let plugins: Plugins | undefined
  // The glowing triangles: the meshes drawn by supershader3d's materials, catalogued, each by its number; their
  // triangles rows of `corners`, every one of them until the first glow has been read back (`decided` false), then
  // only those of every thing's material that glows; each triangle's glow this frame in `target`, drawn by `sample`.
  let glowing: {
    meshes: THREE.Mesh[]
    count: number
    corners: THREE.DataTexture
    target: THREE.WebGLRenderTarget
    sample: THREE.ShaderMaterial
    quad: FullScreenQuad
    // each thing's material on each mesh, by its key, its triangles' rows
    groups: Map<string, number[]>
    decided: boolean
  } | undefined
  // the stand-ins bound before there are glowing triangles, so every sampler is bound
  let stand: THREE.DataTexture | undefined

  // The meshes of the scene drawn by supershader3d's materials, in the order the scene is walked.
  const drawnBySupershader = (scene: THREE.Scene, p: Plugins): THREE.Mesh[] => {
    const ss = p.supershader3d
    if (!ss?.looks()) return []
    const own = new Set((['solid', 'relief', 'seeThrough'] as const).map(c => ss.material(c)).filter(Boolean))
    const found: THREE.Mesh[] = []
    scene.traverseVisible(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.geometry.getAttribute('lookId') || !m.geometry.getAttribute('lookInfo')) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      if (mats.some(x => own.has(x))) found.push(m)
    })
    return found
  }

  // The glowing triangles catalogued again from `meshes`: each triangle a row of the corners texture (every one, or
  // with `keep` only those of the things' materials it names), and the sampling pass made with the composed shader's
  // preamble.
  const catalogue = (renderer: THREE.WebGLRenderer, meshes: THREE.Mesh[], p: Plugins, keep?: Set<string>) => {
    const T = built!.T
    drop()
    const groups = new Map<string, number[]>()
    const rows: number[] = []
    let count = 0
    meshes.forEach((m, mi) => {
      const g = m.geometry
      // an attribute's kth number at vertex v, 0 where the geometry has not the attribute
      const read = (name: string) => {
        const a = g.getAttribute(name)
        return (v: number, k: number) => (a && k < a.itemSize ? a.array[v * a.itemSize + k] : 0)
      }
      const pos = read('position'), nrm = read('normal'), uv = read('uv'), id = read('lookId'), info = read('lookInfo')
      const s0 = read('s0'), s1 = read('s1'), s2 = read('s2'), s3 = read('s3')
      const index = g.getIndex()
      const n = index ? index.count : g.getAttribute('position').count
      for (let t = 0; t < n; t += 3) {
        const first = index ? index.array[t] : t
        const key = `${mi} ${Math.round(id(first, 0))} ${Math.round(info(first, 1))}`
        if (keep && !keep.has(key)) continue
        const row: number[] = []
        for (let c = 0; c < 3; c++) {
          const v = index ? index.array[t + c] : t + c
          row.push(info(v, 0), info(v, 1), info(v, 2), id(v, 0))
          row.push(uv(v, 0), uv(v, 1), s3(v, 0), s3(v, 1))
          row.push(s0(v, 0), s0(v, 1), s0(v, 2), 0)
          row.push(s1(v, 0), s1(v, 1), s1(v, 2), 0)
          row.push(s2(v, 0), s2(v, 1), s2(v, 2), s2(v, 3))
          row.push(pos(v, 0), pos(v, 1), pos(v, 2), 1)
          row.push(nrm(v, 0), nrm(v, 1), nrm(v, 2), 0)
        }
        row.push(mi, 0, 0, 0)
        rows.push(...row)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(count)
        count++
      }
    })
    if (!count) return
    const most = renderer.capabilities.maxTextureSize
    if (count > most) throw new Error(`arealight: ${count} triangles drawn by supershader3d, and a texture holds ${most} rows`)
    const corners = new T.DataTexture(Float32Array.from(rows), MESH + 1, Math.max(1, count), T.RGBAFormat, T.FloatType)
    corners.needsUpdate = true
    const target = new T.WebGLRenderTarget(ROW, Math.max(1, Math.ceil(count / ROW)), { type: T.FloatType, minFilter: T.NearestFilter, magFilter: T.NearestFilter, generateMipmaps: false, depthBuffer: false })
    const sample = new T.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: SAMPLE(p.supershader3d.glsl()),
      uniforms: { ...p.supershader3d.uniforms, alCorners: { value: corners }, alMatrices: { value: built!.lights }, alMeshRow: { value: 0 }, alCount: { value: count } },
      depthTest: false,
      depthWrite: false,
    })
    glowing = { meshes, count, corners, target, sample, quad: new FullScreenQuad(sample), groups, decided: !!keep }
    me.glowing = keep ? count : 0
    me.glowGroups = keep ? keep.size : 0
  }

  // Every catalogued triangle's glow drawn this frame, its mesh's matrix in row `meshRow` of the lights texture on;
  // on the first, the glow read back and the catalogue made again of the things' materials that glow anywhere.
  const glow = (renderer: THREE.WebGLRenderer, meshRow: number) => {
    const draw = () => {
      const g = glowing!
      g.sample.uniforms.alMatrices.value = built!.lights
      g.sample.uniforms.alMeshRow.value = meshRow
      const was = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel()
      renderer.setRenderTarget(g.target)
      g.quad.render(renderer)
      renderer.setRenderTarget(was, face, level)
    }
    draw()
    if (!glowing!.decided) {
      const g = glowing!
      const h = g.target.height
      const read = new Float32Array(ROW * h * 4)
      renderer.readRenderTargetPixels(g.target, 0, 0, ROW, h, read)
      const keep = new Set<string>()
      for (const [key, tris] of g.groups) if (tris.some(t => read[t * 4] + read[t * 4 + 1] + read[t * 4 + 2] > 1e-4)) keep.add(key)
      catalogue(renderer, g.meshes, plugins!, keep)
      draw()
    }
    const g = glowing!
    uniforms.uArealightGlowCount.value = g.count
    uniforms.uArealightMeshRow.value = meshRow
    uniforms.uArealightCorners.value = g.corners
    uniforms.uArealightGlow.value = g.target.texture
  }

  // The catalogue let go of.
  const drop = () => {
    if (!glowing) return
    glowing.corners.dispose()
    glowing.target.dispose()
    glowing.sample.dispose()
    glowing.quad.dispose()
    glowing = undefined
    uniforms.uArealightGlowCount.value = 0
    uniforms.uArealightCorners.value = stand
    uniforms.uArealightGlow.value = stand
  }

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
    // the glowing triangles lit, and the things' materials they are of
    glowing: 0,
    glowGroups: 0,
    tick(p: Plugins) {
      plugins = p
      if (built) return
      const render3d = p.render3d
      if (!render3d) throw new Error('arealight needs render3d, which this scene does not name')
      const s = checked(p.wire.scene.world?.arealight as Settings | undefined)
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
      stand = new T.DataTexture(new Float32Array(4), 1, 1, T.RGBAFormat, T.FloatType)
      stand.needsUpdate = true
      Object.assign(uniforms, {
        uArealightGlowCount: { value: 0 },
        uArealightMeshRow: { value: 0 },
        uArealightGlowGain: { value: s.glow },
        uArealightCorners: { value: stand },
        uArealightGlow: { value: stand },
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
          uniforms.uArealightGlowGain.value = b.s.glow
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
          // the meshes drawn by supershader3d's materials, catalogued again when they change
          const meshes = drawnBySupershader(scene, plugins!)
          const had = glowing?.meshes ?? []
          if (meshes.length !== had.length || meshes.some((m, i) => m !== had[i])) {
            if (meshes.length) catalogue(renderer, meshes, plugins!)
            else drop()
          }
          const rows = found.length + meshes.length
          if (b.lights.image.height < rows) {
            b.lights.dispose()
            b.lights = new b.T.DataTexture(new Float32Array(TEXELS * 4 * rows), TEXELS, rows, b.T.RGBAFormat, b.T.FloatType)
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
          // each mesh's matrix as it stands, a row after the rectangles'
          meshes.forEach((m, i) => data.set(m.matrixWorld.elements, (found.length + i) * TEXELS * 4))
          b.lights.needsUpdate = true
          uniforms.uArealightCount.value = found.length
          me.count = found.length
          if (glowing) glow(renderer, found.length)
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
      drop()
      stand?.dispose()
      stand = undefined
      plugins = undefined
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
