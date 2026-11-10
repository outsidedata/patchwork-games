uniform sampler2D lookSettings;

varying float vLookId;
varying vec3 vLookInfo;
varying vec2 vLookUv;
varying vec3 vLookWorld;
varying vec3 vLookWN;
varying vec3 vS0;
varying vec3 vS1;
varying vec4 vS2;
varying vec2 vS3;
#define s0 vS0
#define s1 vS1
#define s2 vS2
#define s3 vS3
uniform float lookView;
uniform float lookDebug;
// the looks' clock: seconds, one for every look of the scene, set each frame by the page (install.js's `time`) or the
// game (core's supershader3d). It grows without end, and a hash of a large number is no longer random, so a look never
// feeds it to its noise as it is: it takes it through kcycle or kloop, whose numbers stay inside one period.
uniform float lookTime;
// the uv's change across the pixel, worked out once where every pixel of the quad runs it, so a picture read inside a
// look's branch still knows its sharpness
vec2 lookGx, lookGy;

float kh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float kh1(float x) { return fract(sin(x * 91.7) * 43758.5453); }
float kn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kh(i), kh(i + vec2(1, 0)), u.x), mix(kh(i + vec2(0, 1)), kh(i + vec2(1, 1)), u.x), u.y);
}
float kfbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * kn(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.97;
}
float kfbm4(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * kn(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// a feature f metres across fades to its mean where it is finer than a pixel
float kfade(float f) { vec2 fw = abs(lookGx) + abs(lookGy); return clamp(1.5 - (fw.x + fw.y) / f, 0.0, 1.0); }
// cells of jittered seeds: the distance to the nearest, its number (0 to 1), and how far the second is past it
float kvor(vec2 p, out float id, out float edge) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 best = vec2(0.0);
  for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(x, y);
    vec2 c = i + o;
    vec2 r = o + vec2(kh(c), kh(c + 7.3)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; best = c; } else if (d < d2) { d2 = d; }
  } }
  id = kh(best + 3.7);
  edge = sqrt(d2) - sqrt(d1);
  return sqrt(d1);
}
// a dimple field: the distance to the nearest of jittered cells' seeds
float kcell(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(x, y);
    vec2 r = o + vec2(kh(i + o), kh(i + o + 7.3)) - f;
    d = min(d, dot(r, r));
  } }
  return sqrt(d);
}
// courses: the row along v, the piece in it along u (each row offset), where in the piece (0 to 1 each way)
vec4 kcourse(vec2 uv, float row, float wide, float jitter, float seed, out vec2 id) {
  float r = floor(uv.y / row);
  float shift = kh1(r + seed) * wide;
  float w = wide * (1.0 - jitter * 0.5 + jitter * kh(vec2(r, floor((uv.x + shift) / wide) + seed)));
  float x = (uv.x + shift) / w;
  id = vec2(r, floor(x));
  return vec4(fract(x), fract(uv.y / row), r, w);
}
// marble's veins: thin lines wandering through a warped field, the main ones and finer ones across them
float kveins(vec2 p, float seed) {
  float w = kfbm(p * 1.3 + seed) * 4.0;
  float a = pow(1.0 - abs(sin((p.x * 1.6 + p.y * 0.6 + w) * 3.14159)), 22.0);
  float b = pow(1.0 - abs(sin((p.y * 2.7 - p.x * 1.1 + kfbm(p * 2.6 + seed + 7.0) * 3.0) * 3.14159)), 50.0);
  return clamp(a + 0.6 * b, 0.0, 1.0);
}
// wood's grain along u: its rings' lines (late wood 1, early 0) wandering across v, and its fibres
float kring(vec2 uv, float seed, float rings) {
  float w = kfbm(vec2(uv.x * 0.35, uv.y * 2.0) + seed) * 1.6;
  return smoothstep(0.5, 0.95, fract(uv.y * rings + w + uv.x * 0.04));
}
float kfibre(vec2 uv, float seed) { return kn(vec2(uv.x * 3.0, uv.y * 420.0) + seed) * kfade(0.003); }
// how strongly a cloth's weave shows: a plain weave of threads t metres across, over and under
float kweave(vec2 uv, float t) {
  vec2 q = uv / t;
  float warp = sin(q.x * 3.14159), weft = sin(q.y * 3.14159);
  float over = step(0.0, warp * weft);
  return mix(0.5, mix(0.8, 1.08, over) * (0.85 + 0.15 * abs(over > 0.5 ? weft : warp)), kfade(t * 2.0));
}
// a cycle of `period` seconds: how far through it the clock is, 0 to 1, for a look that pulses or goes round (anything
// of 6.28318 times it, a sin or a turn, comes back to where it began with no seam)
float kcycle(float period) { return fract(lookTime / period); }
// a drift that never repeats, for a look that flows, boils or creeps: two phases of one cycle of `period` seconds, half
// a cycle apart, each 0 to 1 (x and y), and the share of the first (z). A look moves its pattern on by each phase, reads
// it at both and mixes them by z; each phase jumps back to 0 only where its share is 0, so the drift shows no seam
vec3 kloop(float period) { float a = fract(lookTime / period); return vec3(a, fract(a + 0.5), 1.0 - abs(2.0 * a - 1.0)); }
// value noise in three numbers whose third repeats every `n` cells (a whole number): a pattern that churns in place,
// for what boils, breathes or glows and fades, never sliding as a drift does. Given p.z = kcycle(period) * n it changes
// n cells' worth over the period and comes back to where it began at its end with no seam, so nothing is mixed and
// nothing shows twice
float kh3(vec3 c) { return fract(sin(dot(c, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
float kn3(vec3 p, float n) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float z0 = mod(i.z, n), z1 = mod(i.z + 1.0, n);
  float a0 = mix(mix(kh3(vec3(i.xy, z0)), kh3(vec3(i.xy + vec2(1, 0), z0)), u.x),
                 mix(kh3(vec3(i.xy + vec2(0, 1), z0)), kh3(vec3(i.xy + vec2(1, 1), z0)), u.x), u.y);
  float a1 = mix(mix(kh3(vec3(i.xy, z1)), kh3(vec3(i.xy + vec2(1, 0), z1)), u.x),
                 mix(kh3(vec3(i.xy + vec2(0, 1), z1)), kh3(vec3(i.xy + vec2(1, 1), z1)), u.x), u.y);
  return mix(a0, a1, u.z);
}
// four sizes of it, each finer one churning twice as fast and still repeating on the same cycle
float kfbm3(vec3 p, float n) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * kn3(p, n); p = vec3(p.xy * 2.03 + 17.1, p.z * 2.0); n *= 2.0; a *= 0.5; }
  return s / 0.9375;
}
// the normal bent by a height field, as three's bump map bends it (perturbNormalArb)
vec3 kitBump(vec3 pos, vec3 n, float h, float faceDirection) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDirection;
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * n - grad);
}
// a normal in the surface's own ways (u, v, out) turned into the view's, the ways found from the uv's change across
// the pixel, as three's normal map without tangents finds them (getTangentFrame)
vec3 lookPerturb(vec3 n, vec3 nts, float faceDirection) {
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec3 q1perp = cross(q1, n), q0perp = cross(n, q0);
  vec3 T = q1perp * lookGx.x + q0perp * lookGy.x;
  vec3 B = q1perp * lookGx.y + q0perp * lookGy.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = det == 0.0 ? 0.0 : faceDirection * inversesqrt(det);
  return normalize(T * (nts.x * scale) + B * (nts.y * scale) + n * nts.z);
}

struct Look {
  vec3 colour; float rough; float metal; float height; vec3 nts; vec3 normal; bool ownNormal;
  float ao; float aoDirect; float alpha; vec3 glow;
  float clearcoat; float clearcoatRough; vec3 sheen; float sheenRough; float iridescence; float iridIor; float iridThick;
  float transmission; float thickness; vec3 attColour; float attDist; float ior; float dispersion;
};
Look lookStart() {
  Look k;
  k.colour = vec3(0.5); k.rough = 0.8; k.metal = 0.0; k.height = 0.0; k.nts = vec3(0.0, 0.0, 1.0);
  k.normal = vec3(0.0, 0.0, 1.0); k.ownNormal = false; k.ao = 1.0; k.aoDirect = 0.0; k.alpha = 1.0; k.glow = vec3(0.0);
  k.clearcoat = 0.0; k.clearcoatRough = 0.1; k.sheen = vec3(0.0); k.sheenRough = 0.5;
  k.iridescence = 0.0; k.iridIor = 1.3; k.iridThick = 400.0;
  k.transmission = 0.0; k.thickness = 0.0; k.attColour = vec3(1.0); k.attDist = 1e9; k.ior = 1.5; k.dispersion = 0.0;
  return k;
}


uniform sampler2DArray lookPictures;
uniform float lookMeans[9];
vec3 lookSrgb(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec4 picData(int t, vec2 uv, float scale) { return textureGrad(lookPictures, vec3(uv, float(t)), lookGx * scale, lookGy * scale); }
vec3 picColour(int t, vec2 uv, float scale) { return lookSrgb(picData(t, uv, scale).rgb); }
vec4 picDataLod(int t, vec2 uv, float lod) { return textureLod(lookPictures, vec3(uv, float(t)), lod); }
vec3 picColourLod(int t, vec2 uv, float lod) { return lookSrgb(picDataLod(t, uv, lod).rgb); }
float picMean(int t) { return lookMeans[t]; }

float p_stoneMin;
float p_stoneMax;
float p_rowMin;
float p_rowMax;
float p_joint;
float p_seed;
float p_recess;
float p_edgeRound;
float p_edgeDrop;
float p_corner;
float p_chip;
float p_bulge;
float p_tilt;
float p_detail;
float p_detailNormal;
float p_valueVar;
float p_warm;
float p_dark;
float p_mottle;
float p_grime;
float p_damp;
float p_moss;
float p_rockContrast;
float p_rockScale;
float p_mortScale;
float p_pom;
float p_pomOn;
float p_shadowOn;
vec3 p_stoneTint;
vec3 p_mortTint;
float p_gap;
float p_cup;
float p_grain;
float p_grainNormal;
float p_light;
float p_endDark;
float p_rings;
float p_grainScale;
float p_repeat;
vec3 p_tint;
float p_contrast;
float p_metres;
vec3 p_thDark;
vec3 p_thLight;
vec3 p_thAged;
float p_thAgeFrom;
float p_thAgeTo;
float p_thDeep;
float p_thRough;
vec3 p_glTint;
vec3 p_glTint2;
float p_glWaves;
float p_glWaveDepth;
float p_glSeeds;
float p_glRough;
float p_glAlpha;
float p_glAlphaVar;
float p_glRibs;
float p_glRibWide;
float p_glRibAlpha;
vec3 p_glGlow;
float p_glCrease;
float p_glCreaseFreq;
float p_glBands;
float p_glBandHigh;
float p_size;
float p_jitter;
float p_stretch;
float p_dome;
float p_flat;
float p_sink;
float p_fleck;
float p_polish;
float p_dirt;
float p_mossCover;
float p_mossTop;
float p_mossDepth;
float p_mossScale;
float p_wet;
vec3 p_grey;
vec3 p_brown;
vec3 p_sand;
vec3 p_mossDark;
vec3 p_mossLight;
float p_poSimmer;
float p_poRoll;
float p_poBits;
float p_fcHeat;
float p_fcAsh;
float p_fcGlow;
float p_fcBreath;
float p_fcFlicker;
float p_fcChecks;
float p_fcCheckShow;
float p_ssRow;
float p_ssLong;
float p_ssJitter;
float p_ssJoint;
float p_ssWorld;
float p_ssPillow;
float p_ssPitch;
float p_ssTool;
vec3 p_ssA;
vec3 p_ssB;
vec3 p_ssMortar;
float p_ssGrain;
float p_ssSpeck;
float p_ssIron;
float p_ssSoot;
float p_ssHeat;
float p_ssRough;
vec3 p_soLight;
vec3 p_soDark;
float p_soAge;
float p_soRings;
float p_soEndRings;
float p_soAdzeLen;
float p_soAdze;
float p_soChecks;
float p_soSoot;
float p_soRough;
vec3 p_siScale;
vec3 p_siIron;
vec3 p_siSteel;
float p_siPeen;
float p_siPeenDepth;
float p_siFlake;
float p_siRust;
float p_siRough;
vec3 p_slHide;
vec3 p_slRub;
float p_slCreases;
float p_slCreaseDepth;
float p_slPebble;
float p_slOil;
vec3 p_qwDeep;
vec3 p_qwScum;
float p_qwScumCover;
float p_qwRipple;
float p_qwStir;
float p_qwDrift;
float p_qwCycle;
float p_qwSheen;
vec3 p_opColour;
vec3 p_opRim;
float p_opThrough;
float p_opRough;
float p_opGrain;
float p_opGlow;
int t_rockCol;
int t_rockDisp;
int t_rockNrm;
int t_mortCol;
int t_mortDisp;
int t_woodCol;
int t_woodDisp;
int t_woodNrm;
int t_woodRough;
int t_col;
int t_nrm;
int t_rough;




















uniform sampler2D csNoise;
float csTN(vec2 p) { return texture(csNoise, p / 32.0).r; }


uniform sampler2D csCourses;

uint csU(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
// a number from 0 to 1 drawn from four whole numbers and the seed
float csH(int a, int b, int c, int d) {
  uint h = csU(uint(a + 0x40000000) ^ csU(uint(b + 0x40000000) ^ csU(uint(c + 0x40000000) ^ csU(uint(d + 0x40000000) + uint(p_seed) * 0x9e3779b9u))));
  return float(h) / 4294967295.0;
}

// the course holding height v in the row's table: its number, its foot and the next one's foot
void csCourse(int row, float v, out int c, out float b0, out float b1) {
  int lo = 0;
  int hi = 255;
  for (int s = 0; s < 8; s++) {
    int mid = (lo + hi + 1) / 2;
    if (texelFetch(csCourses, ivec2(mid, row), 0).r <= v) lo = mid; else hi = mid - 1;
  }
  c = lo;
  b0 = texelFetch(csCourses, ivec2(lo, row), 0).r;
  b1 = texelFetch(csCourses, ivec2(min(lo + 1, 255), row), 0).r;
}
// the row's building's walls' thickness, kept in the course table after its courses
float csWallDepth(int row) { return texelFetch(csCourses, ivec2(256, row), 0).r; }
// the k-th of n joints across a stretch cut into n stones, in stones from its start: each inner joint moved by
// up to jit / 2 of a stone each way, so each stone is (1 ± jit) of the mean
float csJ(int k, int n, float jit, int s1, int s2) {
  if (k <= 0) return 0.0;
  if (k >= n) return float(n);
  return float(k) + (csH(k, s1, s2, 3) - 0.5) * jit;
}
// the stretch from a to b cut into stones of mean length (1 ± jit): the stone i holding x, of n, from s0 to e0
void csPart(float a, float b, float x, float mean, float jit, int s1, int s2, out int i, out int n, out float s0, out float e0) {
  float L = b - a;
  n = max(1, int(floor(L / mean + 0.5)));
  float t = (x - a) / L * float(n);
  i = clamp(int(floor(t)), 0, n - 1);
  if (t < csJ(i, n, jit, s1, s2)) i = max(i - 1, 0);
  else if (t > csJ(i + 1, n, jit, s1, s2)) i = min(i + 1, n - 1);
  s0 = a + csJ(i, n, jit, s1, s2) * L / float(n);
  e0 = a + csJ(i + 1, n, jit, s1, s2) * L / float(n);
}

struct CsCell { float id; vec4 box; float off; vec4 arris; vec2 p; vec2 size; };
// the place along the face the stones are cut on: a round wall's turned by its course's start, a box's face held
// to its length
float csQx(float x, float off) {
  int kind = int(s2.x + 0.5);
  if (kind == 2) return mod(x + off, s2.z);
  if (kind == 1 || kind == 4) return x;
  return clamp(x, 0.0, s2.z);
}
// the stone at the place q on this face: its number, its box on the face (x0, y0, x1, y1, along the place
// csQx gives), its course's start round a round wall, and which of its sides (left, right, foot, top) are the
// building's corner or a cut, not a joint
CsCell csCell(vec2 q) {
  CsCell C;
  int kind = int(s2.x + 0.5);
  int f = int(s2.y + 0.5);
  float W = s2.z;
  int w = int(s2.w + 0.5);
  int row = w % 256;
  float mean = 0.5 * (p_stoneMin + p_stoneMax);
  float jit = clamp((p_stoneMax - p_stoneMin) / max(p_stoneMax + p_stoneMin, 1e-3), 0.0, 0.95);
  bool aL = false, aR = false;
  float x0, x1, y0, y1, qx = q.x;
  int i, n;
  float id;
  C.off = 0.0;
  if (kind == 4) {
    // a face of an arch's stone: the stone from 0 to s3.x up v, and along u from 0 to s2.z at its foot and s3.y at
    // its top, straight between (csStoneAt takes its length at the place); its number the stone's times 16 and which
    // of its sides are an arris (left 1, right 2, foot 4, top 8), the rest joints
    int a = f % 16;
    C.id = csH(w, f / 16, 0, 25);
    C.box = vec4(0.0, 0.0, max(W, s3.y), s3.x);
    C.arris = vec4(float(a & 1), float((a >> 1) & 1), float((a >> 2) & 1), float((a >> 3) & 1));
    return C;
  }
  if (kind == 1) {
    // a slab: rows up its v, stones along its u, in 16 m squares
    float mr = 0.5 * (p_rowMin + p_rowMax);
    float jr = clamp((p_rowMax - p_rowMin) / max(p_rowMax + p_rowMin, 1e-3), 0.0, 0.95);
    int ci = int(floor(q.y / 16.0));
    csPart(float(ci) * 16.0, float(ci) * 16.0 + 16.0, q.y, mr, jr, w, ci * 7 + 1, i, n, y0, y1);
    int r = ci * 64 + i;
    int ui = int(floor(q.x / 16.0));
    int k;
    csPart(float(ui) * 16.0, float(ui) * 16.0 + 16.0, q.x, mean, jit, w, r * 131 + ui + 5, k, n, x0, x1);
    id = csH(w, r, ui * 256 + k, 21);
  } else {
    int c;
    csCourse(row, q.y, c, y0, y1);
    if (kind == 2) {
      // round: the whole way round, from a place drawn for each course
      C.off = csH(w, c * 16 + f, 0, 41) * W;
      qx = mod(q.x + C.off, W);
      csPart(0.0, W, qx, mean, jit, w, c * 16 + f, i, n, x0, x1);
      id = csH(w, c * 16 + f, i, 22);
    } else {
      qx = clamp(q.x, 0.0, W);
      bool through = kind == 3 || (c + f) % 2 == 0;
      float depth = csWallDepth(row);
      if (!through && W < 2.0 * depth + 0.3) {
        // a face too short for the corner stones of its sides and a stone between: one stone, both corners'
        x0 = 0.0; x1 = W; aL = true; aR = true;
        id = csH(w, c, 1000 + f, 23);
      } else if (through) {
        csPart(0.0, W, qx, mean, jit, w, c * 16 + f, i, n, x0, x1);
        aL = kind == 0 && i == 0;
        aR = kind == 0 && i == n - 1;
        id = aL ? csH(w, c, 1000 + f, 23) : aR ? csH(w, c, 1000 + (f + 1) % 4, 23) : csH(w, c, f * 512 + i, 24);
      } else if (qx < depth) {
        // the end of the corner stone that runs through on the face before
        x0 = 0.0; x1 = depth; aL = true;
        id = csH(w, c, 1000 + f, 23);
      } else if (qx > W - depth) {
        x0 = W - depth; x1 = W; aR = true;
        id = csH(w, c, 1000 + (f + 1) % 4, 23);
      } else {
        csPart(depth, W - depth, qx, mean, jit, w, c * 16 + f, i, n, x0, x1);
        id = csH(w, c, f * 512 + i, 24);
      }
    }
  }
  C.id = id;
  C.box = vec4(x0, y0, x1, y1);
  C.arris = vec4(aL ? 1.0 : 0.0, aR ? 1.0 : 0.0, 0.0, 0.0);
  if (s3.x > -1e3) C.arris.xy = vec2(1.0);
  if (s3.y > -1e3) C.arris.zw = vec2(1.0);
  return C;
}
// the stone last found, kept while the places asked for stay in its box: the parallax's steps and the shadow's
// march mostly stay in one stone, so its course and its joints are worked out once
CsCell csCache;
bool csHave = false;
CsCell csStoneAt(vec2 q) {
  float qx = csQx(q.x, csCache.off);
  if (!csHave || qx < csCache.box.x || qx > csCache.box.z || q.y < csCache.box.y || q.y > csCache.box.w) {
    csCache = csCell(q);
    csHave = true;
    qx = csQx(q.x, csCache.off);
  }
  CsCell C = csCache;
  C.size = C.box.zw - C.box.xy;
  C.p = vec2(qx, q.y) - C.box.xy;
  if (int(s2.x + 0.5) == 4) {
    // an arch's stone: its length along u at this place up it
    C.size.x = mix(s2.z, s3.y, clamp(C.p.y / max(C.size.y, 1e-6), 0.0, 1.0));
  } else {
    if (s3.x > -1e3) C.p.x = 0.5 * C.size.x;
    if (s3.y > -1e3) C.p.y = 0.5 * C.size.y;
  }
  return C;
}
// how far in from its nearest joint a place in the stone is, its corners rounded, less half the joint
float csEdge(CsCell C) {
  float dl = C.arris.x > 0.5 ? 1e3 : C.p.x;
  float dr = C.arris.y > 0.5 ? 1e3 : C.size.x - C.p.x;
  float db = C.arris.z > 0.5 ? 1e3 : C.p.y;
  float dt = C.arris.w > 0.5 ? 1e3 : C.size.y - C.p.y;
  float dx = min(dl, dr), dy = min(db, dt);
  float r = p_corner;
  float d = (dx < r && dy < r) ? r - length(vec2(r - dx, r - dy)) : min(dx, dy);
  return d - 0.5 * p_joint;
}
// a building's own colour for the solids view: a hue from its row, castle-ng's saturation and brightness
vec3 csSolidColour(int row) {
  float h = fract(float(row) * 0.61803 + 0.13);
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  vec3 srgb = 0.85 * mix(vec3(1.0), k, 0.6);
  return pow(srgb, vec3(2.2));
}
// what a wall look works out for the lighting: the face's ways, its normal, the normal found, the place the
// parallax found and its height, the parallax's fade
vec3 csT, csB, csNg, csNts;
vec2 csUvP;
float csZ, csFade;


uniform sampler2D cbRand;


vec3 htGlow(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(vec3(0.0), vec3(0.28, 0.012, 0.0), smoothstep(0.12, 0.25, t));
  c = mix(c, vec3(0.85, 0.07, 0.005), smoothstep(0.25, 0.42, t));
  c = mix(c, vec3(1.5, 0.32, 0.02), smoothstep(0.42, 0.62, t));
  c = mix(c, vec3(1.9, 0.8, 0.07), smoothstep(0.62, 0.82, t));
  c = mix(c, vec3(2.6, 2.0, 1.0), smoothstep(0.82, 1.0, t));
  return c;
}


float csRockLod, csMortLod;
struct CsS { float h; float d; float id; vec2 tuv; float stone; };
// the wall's height at the place uv on this face (0 its proudest, down to -Relief depth): the stone's face, its
// rounded and chipped edges, its bulge and tilt and the rock's grain; the mortar's recess between
CsS csSample(vec2 uv) {
  // a cut's place where it gives one; an arch's stone's face (kind 4) its own place, s3 its stone's box
  vec2 q = int(s2.x + 0.5) == 4 ? uv : vec2(s3.x > -1e3 ? s3.x : uv.x, s3.y > -1e3 ? s3.y : uv.y);
  CsCell C = csStoneAt(q);
  // the edges' chips: the rock's own relief, on a patch of its own for each stone
  vec2 g = uv + vec2(C.id * 53.0, fract(C.id * 7.31) * 41.0);
  float warp = (textureLod(csNoise, g * 0.6, 0.0).r - 0.5) * 3.0 * p_chip;
  float d = csEdge(C) + warp;
  vec2 tuv = (uv + vec2(C.id * 97.13, fract(C.id * 7.31) * 61.7)) / p_rockScale;
  float rock = picDataLod(t_rockDisp, tuv, csRockLod).r;
  vec2 n01 = clamp(C.p / max(C.size, vec2(1e-3)), 0.0, 1.0) * 2.0 - 1.0;
  float pillow = (1.0 - 0.6 * n01.x * n01.x) * (1.0 - n01.y * n01.y);
  // the face: its proudest place at 0, rounded down at its edges, bulged, tilted, grained
  float hs = -p_edgeDrop * pow(1.0 - smoothstep(0.0, p_edgeRound, d), 2.0)
             - p_bulge * (1.0 - pillow)
             + (rock - 0.5) * p_detail - 0.5 * p_detail
             + ((fract(C.id * 131.7) - 0.5) + (fract(C.id * 71.3) - 0.5) * n01.x + (fract(C.id * 37.9) - 0.5) * n01.y - 1.0) * p_tilt;
  float hm = -p_recess + (picDataLod(t_mortDisp, uv / p_mortScale, csMortLod).r - 0.5) * 0.006;
  CsS S;
  // a stone where it is in from its joint
  S.stone = d > 0.0 ? 1.0 : 0.0;
  S.h = clamp(d > 0.0 ? max(hs, hm) : hm, -p_pom, 0.0);
  S.d = d;
  S.id = C.id;
  S.tuv = tuv;
  return S;
}






float cwLod;
struct CwS { float h; float d; float id; vec2 tuv; float board; float end; vec2 p; vec2 size; };
// whether a board is the end of a corner board running through on the face before or after: its end grain shows
CwS cwSample(vec2 uv) {
  // a cut's place where it gives one; an arch's stone's face (kind 4) its own place, s3 its stone's box
  vec2 q = int(s2.x + 0.5) == 4 ? uv : vec2(s3.x > -1e3 ? s3.x : uv.x, s3.y > -1e3 ? s3.y : uv.y);
  CsCell C = csStoneAt(q);
  float d = csEdge(C);
  int kind = int(s2.x + 0.5);
  bool isEnd = kind == 0 && (C.arris.x > 0.5 || C.arris.y > 0.5) && C.size.x <= csWallDepth(int(s2.w + 0.5) % 256) + 0.001;
  // the grain along u (up the board on an end, so its rings are drawn instead), each board its own patch
  vec2 tuv = (uv + vec2(C.id * 97.13, fract(C.id * 7.31) * 61.7)) / p_grainScale;
  float grain = picDataLod(t_woodDisp, tuv, cwLod).r;
  vec2 n01 = clamp(C.p / max(C.size, vec2(1e-3)), 0.0, 1.0) * 2.0 - 1.0;
  // the board's face: its proudest at 0, rounded down at its edges, cupped across, tilted, grained
  float hs = -p_edgeDrop * pow(1.0 - smoothstep(0.0, p_edgeRound, d), 2.0)
             - p_cup * n01.y * n01.y
             + (isEnd ? 0.0 : (grain - 0.5) * p_grain - 0.5 * p_grain)
             + ((fract(C.id * 131.7) - 0.5) + (fract(C.id * 37.9) - 0.5) * n01.y - 1.0) * p_tilt;
  CwS S;
  S.board = d > 0.0 ? 1.0 : 0.0;
  S.h = clamp(d > 0.0 ? hs : -p_gap, -p_pom, 0.0);
  S.d = d;
  S.id = C.id;
  S.tuv = tuv;
  S.end = isEnd ? 1.0 : 0.0;
  S.p = C.p;
  S.size = C.size;
  return S;
}













// the pixel's size on the ground (m), set before any sampling
float cbFp = 0.001;
// noise at the place p (m) with features 1/f m across, blurred to no finer than the pixel: csNoise has 8 texels to a
// unit, so f units to the metre is 8 f texels to the metre
float cbN(vec2 p, float f) { return textureLod(csNoise, p * f / 32.0, log2(max(cbFp * f * 8.0, 1.0))).r; }
// the four random numbers of the cobble cell c
vec4 cbR(ivec2 c) {
  ivec2 s = ivec2(int(p_seed) * 37, int(p_seed) * 91);
  return texelFetch(cbRand, (c + s) & 255, 0);
}
// a cell's seed, in cells from its corner
vec2 cbSeed(vec4 r) { return 0.5 + (r.xy - 0.5) * p_jitter; }

// the cobble at the place q (metres on the ground): how far in from its edge (d, m), how far from its seed (r, m),
// its numbers, its seed's place (m). The nine seeds round the place are read once; the nearest is the cobble, and
// its edge is the nearest of the lines halfway to the other eight, joined by a smooth minimum Corner round wide,
// so the cobble's corners are rounded, not a polygon's.
struct CbCell { float d; float r; vec4 rnd; vec2 middle; };
CbCell cbCell(vec2 q) {
  vec2 sc = p_size * vec2(p_stretch, 1.0);
  vec2 x = q / sc;
  vec2 n = floor(x), f = x - n;
  ivec2 ni = ivec2(n);
  vec2 o[9];
  vec4 rr[9];
  float md = 8.0;
  int mk = 4;
  for (int j = 0; j < 3; j++) { for (int i = 0; i < 3; i++) {
    vec4 r = cbR(ni + ivec2(i - 1, j - 1));
    vec2 rel = vec2(i - 1, j - 1) + cbSeed(r) - f;
    rr[j * 3 + i] = r;
    o[j * 3 + i] = rel;
    float d = dot(rel * sc, rel * sc);
    if (d < md) { md = d; mk = j * 3 + i; }
  } }
  vec2 mr = o[mk];
  vec2 a = mr * sc;
  float kk = max(p_corner, 1e-4);
  float bd = 8.0;
  for (int k = 0; k < 9; k++) {
    if (k == mk) continue;
    vec2 b = o[k] * sc;
    bd = min(bd, dot(0.5 * (a + b), normalize(b - a)));
  }
  // the smooth minimum, worked from the hard one so exp never overflows
  float sum = 0.0;
  for (int k = 0; k < 9; k++) {
    if (k == mk) continue;
    vec2 b = o[k] * sc;
    sum += exp(-(dot(0.5 * (a + b), normalize(b - a)) - bd) / kk);
  }
  CbCell C;
  C.d = bd - kk * log(sum);
  C.r = length(a);
  C.rnd = rr[mk];
  C.middle = q + a;
  return C;
}

struct CbS { float h; float d; float t; vec4 rnd; float stone; float moss; float mossH; };
// the path's height at q (0 its proudest, down to the sand's depth): the cobble's face domed, worn flat at its top,
// rounded and chipped at its edge, sunk and tilted in its bed, roughened; the sand between
CbS cbSample(vec2 q) {
  CbCell C = cbCell(q);
  float warp = (cbN(q + C.rnd.zw * 50.0, 22.0) - 0.5) * 3.0 * p_chip;
  float d = C.d - 0.5 * p_joint + warp;
  // 0 at the cobble's seed, 1 at its edge
  float t = clamp(C.r / max(C.r + max(C.d, 0.0), 1e-4), 0.0, 1.0);
  float tf = max(t - p_flat, 0.0) / max(1.0 - p_flat, 1e-3);
  vec2 lean = (vec2(C.rnd.z, C.rnd.w) - 0.5) * 2.0;
  float hs = -p_dome * tf * tf
             - p_edgeDrop * pow(1.0 - smoothstep(0.0, p_edgeRound, d), 2.0)
             - p_sink * (0.5 + 0.5 * cos(C.rnd.z * 40.0)) - p_sink * 0.25
             + dot(lean, (q - C.middle) / p_size) * p_tilt - p_tilt
             + (cbN(q + C.rnd.xy * 37.0, 45.0) - 0.5) * 2.0 * p_detail - 0.5 * p_detail;
  float hm = -p_recess + (cbN(q, 160.0) - 0.5) * 0.006;
  CbS S;
  S.stone = (d > 0.0 && hs > hm) ? 1.0 : 0.0;
  float base = d > 0.0 ? max(hs, hm) : hm;
  // the moss: a layer over the cobbles and the sand, in patches Moss patch size across. Where it grows: the joints
  // first, then the cobbles' edges, then (Moss on tops) over their faces. It fills the joints toward the cobbles'
  // shoulders and lies Moss depth thick in lumpy cushions over the rest.
  float spread = cbN(q + 11.3, 1.0 / p_mossScale) * 0.65 + cbN(q + 3.7, 3.0 / p_mossScale) * 0.35;
  float edge = 1.0 - smoothstep(0.0, p_edgeRound * 2.0, d);
  float want = S.stone > 0.5 ? mix(p_mossTop, 1.0, edge * 0.8) : 1.0;
  float thr = 1.0 - p_mossCover;
  S.moss = smoothstep(thr - 0.12, thr + 0.12, spread * (0.55 + 0.45 * want) + 0.25 * want - 0.25);
  float lump = cbN(q + 5.1, 90.0) * 0.6 + cbN(q + 9.9, 30.0) * 0.4;
  float fill = (1.0 - S.stone) * 0.45 * p_recess * smoothstep(0.0, p_edgeRound, -d + 0.004);
  S.mossH = S.moss * (p_mossDepth * (0.45 + 0.75 * lump) + fill);
  S.h = base - p_mossDepth + S.mossH;
  S.d = d;
  S.t = t;
  S.rnd = C.rnd;
  return S;
}










    // the place a stone's courses are laid by: along the face level, and up it; a level face takes the world's plan
    vec2 ssPlace(vec3 p, vec3 n) {
      if (abs(n.y) > 0.72) return p.xz;
      vec2 h = normalize(n.xz);
      return vec2(dot(p.xz, vec2(-h.y, h.x)), p.y);
    }
  


    // the temper colours steel runs through as it heats, cold to burnt
    vec3 siTemper(float t) {
      vec3 c = mix(vec3(1.0), vec3(1.25, 1.05, 0.6), smoothstep(0.05, 0.25, t));
      c = mix(c, vec3(1.1, 0.6, 0.3), smoothstep(0.25, 0.45, t));
      c = mix(c, vec3(0.6, 0.3, 0.75), smoothstep(0.45, 0.62, t));
      c = mix(c, vec3(0.35, 0.5, 1.1), smoothstep(0.62, 0.78, t));
      return mix(c, vec3(0.35, 0.3, 0.3), smoothstep(0.78, 1.0, t));
    }
  


    // the scum at one phase of its drift: soft rafts, their edges ragged
    float qwScumAt(vec2 uv, float phase, float seed) {
      vec2 q = uv + vec2(0.7, 0.4) * p_qwDrift * phase * p_qwCycle;
      return smoothstep(1.0 - p_qwScumCover, 1.0 - p_qwScumCover + 0.12, kfbm(q * 7.0 + seed) + 0.15 * kfbm(q * 40.0 + seed + 3.0) - 0.07);
    }
  


void look_0(inout Look k) {
  p_stoneMin = texelFetch(lookSettings, ivec2(0, 0), 0).r;
  p_stoneMax = texelFetch(lookSettings, ivec2(1, 0), 0).r;
  p_rowMin = texelFetch(lookSettings, ivec2(2, 0), 0).r;
  p_rowMax = texelFetch(lookSettings, ivec2(3, 0), 0).r;
  p_joint = texelFetch(lookSettings, ivec2(4, 0), 0).r;
  p_seed = texelFetch(lookSettings, ivec2(5, 0), 0).r;
  p_recess = texelFetch(lookSettings, ivec2(6, 0), 0).r;
  p_edgeRound = texelFetch(lookSettings, ivec2(7, 0), 0).r;
  p_edgeDrop = texelFetch(lookSettings, ivec2(8, 0), 0).r;
  p_corner = texelFetch(lookSettings, ivec2(9, 0), 0).r;
  p_chip = texelFetch(lookSettings, ivec2(10, 0), 0).r;
  p_bulge = texelFetch(lookSettings, ivec2(11, 0), 0).r;
  p_tilt = texelFetch(lookSettings, ivec2(12, 0), 0).r;
  p_detail = texelFetch(lookSettings, ivec2(13, 0), 0).r;
  p_detailNormal = texelFetch(lookSettings, ivec2(14, 0), 0).r;
  p_valueVar = texelFetch(lookSettings, ivec2(15, 0), 0).r;
  p_warm = texelFetch(lookSettings, ivec2(16, 0), 0).r;
  p_dark = texelFetch(lookSettings, ivec2(17, 0), 0).r;
  p_mottle = texelFetch(lookSettings, ivec2(18, 0), 0).r;
  p_grime = texelFetch(lookSettings, ivec2(19, 0), 0).r;
  p_damp = texelFetch(lookSettings, ivec2(20, 0), 0).r;
  p_moss = texelFetch(lookSettings, ivec2(21, 0), 0).r;
  p_rockContrast = texelFetch(lookSettings, ivec2(22, 0), 0).r;
  p_rockScale = texelFetch(lookSettings, ivec2(23, 0), 0).r;
  p_mortScale = texelFetch(lookSettings, ivec2(24, 0), 0).r;
  p_pom = texelFetch(lookSettings, ivec2(25, 0), 0).r;
  p_pomOn = texelFetch(lookSettings, ivec2(26, 0), 0).r;
  p_shadowOn = texelFetch(lookSettings, ivec2(27, 0), 0).r;
  p_stoneTint = texelFetch(lookSettings, ivec2(28, 0), 0).rgb;
  p_mortTint = texelFetch(lookSettings, ivec2(29, 0), 0).rgb;
  t_rockCol = 0;
  t_rockDisp = 1;
  t_rockNrm = 2;
  t_mortCol = 3;
  t_mortDisp = 4;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

  csNg = normalize(vNormal);
  csT = normalize(s0 - csNg * dot(s0, csNg));
  csB = normalize(s1 - csNg * dot(s1, csNg) - csT * dot(s1, csT));
  vec3 Vv = normalize(vViewPosition);
  vec3 Vts = vec3(dot(Vv, csT), dot(Vv, csB), dot(Vv, csNg));
  vec2 uv0 = vLookUv;
  vec2 fw = abs(lookGx) + abs(lookGy);
  float fp = max(max(fw.x, fw.y), 1e-6);
  csRockLod = log2(max(fp / p_rockScale * 1024.0, 1.0));
  csMortLod = log2(max(fp / p_mortScale * 1024.0, 1.0));
  csFade = p_pomOn * (1.0 - smoothstep(0.006, 0.03, fp));
  uv = uv0;
  float zr = 0.0;
  CsS S = csSample(uv);
  if (csFade > 0.0) {
    float vz = max(Vts.z, 0.1);
    // march down in coarse steps to the first below the surface, then halve the step four times between the
    // last above and the first below
    int steps = int(mix(14.0, 4.0, clamp(Vts.z, 0.0, 1.0)));
    float dz = p_pom / float(steps);
    vec2 duv = -Vts.xy / vz * dz * csFade;
    vec2 puv = uv;
    float pz = 0.0;
    for (int i = 0; i < 14; i++) {
      if (i >= steps || zr <= S.h) break;
      puv = uv; pz = zr;
      uv += duv; zr -= dz;
      S = csSample(uv);
    }
    if (zr <= S.h) {
      vec2 lo = puv, hi = uv;
      float zlo = pz, zhi = zr;
      for (int i = 0; i < 4; i++) {
        vec2 mu = 0.5 * (lo + hi);
        float mz = 0.5 * (zlo + zhi);
        CsS M = csSample(mu);
        if (mz <= M.h) { hi = mu; zhi = mz; S = M; } else { lo = mu; zlo = mz; }
      }
      uv = hi;
      zr = zhi;
    }
    S = csSample(uv);
  }
  csUvP = uv;
  csZ = S.h;
  // the normal from the height round the place, no finer than a pixel
  float e = max(0.002, fp * 0.75);
  float hx = csSample(uv + vec2(e, 0.0)).h - S.h;
  float hy = csSample(uv + vec2(0.0, e)).h - S.h;
  vec3 rn = picDataLod(t_rockNrm, S.tuv, csRockLod).xyz * 2.0 - 1.0;
  csNts = normalize(vec3(-hx / e, -hy / e, 1.0) + vec3(rn.xy * p_detailNormal * S.stone, 0.0));

  // the colour: the rock's picture taken grey, tinted, each stone its own lightness and warmth; the mortar's the same
  vec3 rockC = picColourLod(t_rockCol, S.tuv, csRockLod);
  float rl = mix(1.0, dot(rockC, vec3(0.2126, 0.7152, 0.0722)) / picMean(t_rockCol), p_rockContrast);
  float h1 = fract(S.id * 913.7), h2 = fract(S.id * 271.3), h3 = fract(S.id * 517.9);
  float val = 1.0 + (h1 - 0.5) * 2.0 * p_valueVar;
  if (h3 < p_dark) val *= 0.62;
  float warm = (h2 - 0.5) * 2.0 * p_warm;
  float mott = 1.0 + (csTN(uv * 0.9 + S.id * 13.0) - 0.5) * 2.0 * p_mottle;
  vec3 stoneC = p_stoneTint * rl * val * mott * vec3(1.0 + 0.16 * warm, 1.0 + 0.02 * warm, 1.0 - 0.2 * warm);
  vec3 mortC = p_mortTint * dot(picColourLod(t_mortCol, uv / p_mortScale, csMortLod), vec3(0.2126, 0.7152, 0.0722)) / picMean(t_mortCol);
  float sm = S.stone * smoothstep(-fp, fp, S.d);
  vec3 col = mix(mortC, stoneC, sm);
  // the cavity: the mortar darker toward the stones' edges, the stones' edges darker as they round down
  float aoM = mix(0.4, 0.85, smoothstep(0.0, 0.6 * p_joint + 0.004, -S.d));
  float aoS = mix(0.65, 1.0, smoothstep(0.0, p_edgeRound * 1.5, S.d));
  k.ao = mix(aoM, aoS, sm);
  k.aoDirect = 0.35;
  // streaks run down the walls, rising damp darkens their feet, moss in the damp and on the slabs
  int kind = int(s2.x + 0.5);
  float streak = kind == 1 ? 0.0 : smoothstep(0.5, 0.85, csTN(vec2(uv.x * 2.2, uv.y * 0.1 + csTN(vec2(uv.x * 0.5, 7.0)) * 3.0)));
  col *= 1.0 - p_grime * streak * 0.45;
  col = mix(col, col * vec3(0.92, 0.86, 0.76), p_grime * streak * 0.6);
  float dampM = 1.0 - smoothstep(0.0, 0.5 + 1.6 * csTN(vec2(uv.x * 0.45, 3.0)), vLookWorld.y);
  col *= 1.0 - 0.45 * p_damp * dampM;
  col = mix(col, col * vec3(0.85, 0.95, 0.75), p_damp * dampM * 0.5);
  float mossM = smoothstep(0.52, 0.78, csTN(uv * 1.7 + 3.1)) * clamp(dampM * 0.9 + (kind == 1 ? 0.7 : 0.0) + (1.0 - sm) * 0.4, 0.0, 1.0);
  mossM = clamp(mossM * p_moss * 1.6, 0.0, 1.0);
  col = mix(col, vec3(0.05, 0.075, 0.02) * (0.7 + 0.6 * rl), mossM);
  k.rough = mix(mix(0.96, 0.86, sm), 1.0, mossM);

  if (lookView > 0.5 && lookView < 1.5) col = mix(vec3(0.6), vec3(h1, h2, h3), sm);
  if (lookView > 1.5 && lookView < 2.5) col = vec3((S.h + p_pom) / p_pom);
  if (lookView > 3.5) col = csSolidColour(int(s2.w + 0.5) % 256);
  k.colour = col;
  k.normal = normalize(mat3(csT, csB, csNg) * csNts);
  k.ownNormal = true;

}

void look_1(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float strand = kn(vec2(uv.x * 4.0 + kn(uv * 3.0) * 2.0, uv.y * 120.0) + seed);
    float strand2 = kn(vec2(uv.y * 4.0 + kn(uv * 3.0 + 5.0) * 2.0, uv.x * 120.0) + seed + 9.0);
    float top = max(strand, strand2);
    k.colour = mix(vec3(0.35, 0.33, 0.18), vec3(0.6, 0.55, 0.32), top) * (0.85 + 0.2 * kfbm(uv * 4.0 + seed));
    k.rough = 0.95;
    k.height = 0.003 * top;

}

void look_2(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float row = floor(uv.y / 0.2);
    float inRow = fract(uv.y / 0.2);
    float r = kring(vec2(uv.x, uv.y + row * 1.7), seed + row, 9.0);
    float tone = kh1(row + seed);
    float joint = smoothstep(0.0, 0.02, min(inRow, 1.0 - inRow));
    float scuff = smoothstep(0.55, 0.85, kfbm(uv * 1.5 + seed)) * smoothstep(0.5, 0.9, wn.y);
    vec3 c = mix(vec3(0.42, 0.29, 0.16), vec3(0.55, 0.39, 0.22), tone) * (1.0 - 0.3 * r);
    k.colour = mix(c, c * 1.25 + 0.03, scuff * 0.5) * mix(0.4, 1.0, joint);
    k.rough = mix(0.65, 0.45, scuff);
    k.height = -0.002 * (1.0 - joint) - 0.0003 * r;

}

void look_3(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float id, e;
    float d = kvor(uv * 1.6 + seed, id, e);
    float joint = smoothstep(0.02, 0.05, e);
    float path = smoothstep(0.6, 0.0, abs(wp.x - floor(wp.x / 3.0) * 3.0 - 1.5)) * smoothstep(0.5, 0.9, wn.y);
    vec3 c = mix(vec3(0.42, 0.4, 0.36), vec3(0.55, 0.52, 0.46), id) * (0.88 + 0.2 * kfbm(uv * 5.0 + id * 9.0));
    k.colour = mix(vec3(0.25, 0.23, 0.2), c * (1.0 + 0.12 * path), joint);
    k.rough = mix(0.95, mix(0.8, 0.45, path), joint);
    k.height = mix(-0.008, 0.002 * (kfbm(uv * 4.0 + id) - 0.5) * (1.0 - path), joint);

}

void look_4(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float trodden = smoothstep(0.4, 0.7, kfbm(uv * 1.2 + seed));
    float grit = kn(uv * 500.0 + seed) * kfade(0.002);
    k.colour = mix(vec3(0.36, 0.28, 0.2), vec3(0.28, 0.22, 0.16), trodden) * (0.88 + 0.2 * grit);
    k.rough = mix(0.95, 0.7, trodden);
    k.height = 0.002 * (kfbm(uv * 8.0 + seed) - 0.5) * (1.0 - trodden);

}

void look_5(inout Look k) {
  p_stoneMin = texelFetch(lookSettings, ivec2(0, 5), 0).r;
  p_stoneMax = texelFetch(lookSettings, ivec2(1, 5), 0).r;
  p_rowMin = texelFetch(lookSettings, ivec2(2, 5), 0).r;
  p_rowMax = texelFetch(lookSettings, ivec2(3, 5), 0).r;
  p_joint = texelFetch(lookSettings, ivec2(4, 5), 0).r;
  p_seed = texelFetch(lookSettings, ivec2(5, 5), 0).r;
  p_recess = texelFetch(lookSettings, ivec2(6, 5), 0).r;
  p_edgeRound = texelFetch(lookSettings, ivec2(7, 5), 0).r;
  p_edgeDrop = texelFetch(lookSettings, ivec2(8, 5), 0).r;
  p_corner = texelFetch(lookSettings, ivec2(9, 5), 0).r;
  p_chip = texelFetch(lookSettings, ivec2(10, 5), 0).r;
  p_bulge = texelFetch(lookSettings, ivec2(11, 5), 0).r;
  p_tilt = texelFetch(lookSettings, ivec2(12, 5), 0).r;
  p_detail = texelFetch(lookSettings, ivec2(13, 5), 0).r;
  p_detailNormal = texelFetch(lookSettings, ivec2(14, 5), 0).r;
  p_valueVar = texelFetch(lookSettings, ivec2(15, 5), 0).r;
  p_warm = texelFetch(lookSettings, ivec2(16, 5), 0).r;
  p_dark = texelFetch(lookSettings, ivec2(17, 5), 0).r;
  p_mottle = texelFetch(lookSettings, ivec2(18, 5), 0).r;
  p_grime = texelFetch(lookSettings, ivec2(19, 5), 0).r;
  p_damp = texelFetch(lookSettings, ivec2(20, 5), 0).r;
  p_moss = texelFetch(lookSettings, ivec2(21, 5), 0).r;
  p_rockContrast = texelFetch(lookSettings, ivec2(22, 5), 0).r;
  p_rockScale = texelFetch(lookSettings, ivec2(23, 5), 0).r;
  p_mortScale = texelFetch(lookSettings, ivec2(24, 5), 0).r;
  p_pom = texelFetch(lookSettings, ivec2(25, 5), 0).r;
  p_pomOn = texelFetch(lookSettings, ivec2(26, 5), 0).r;
  p_shadowOn = texelFetch(lookSettings, ivec2(27, 5), 0).r;
  p_stoneTint = texelFetch(lookSettings, ivec2(28, 5), 0).rgb;
  p_mortTint = texelFetch(lookSettings, ivec2(29, 5), 0).rgb;
  t_rockCol = 0;
  t_rockDisp = 1;
  t_rockNrm = 2;
  t_mortCol = 3;
  t_mortDisp = 4;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

  csNg = normalize(vNormal);
  csT = normalize(s0 - csNg * dot(s0, csNg));
  csB = normalize(s1 - csNg * dot(s1, csNg) - csT * dot(s1, csT));
  vec3 Vv = normalize(vViewPosition);
  vec3 Vts = vec3(dot(Vv, csT), dot(Vv, csB), dot(Vv, csNg));
  vec2 uv0 = vLookUv;
  vec2 fw = abs(lookGx) + abs(lookGy);
  float fp = max(max(fw.x, fw.y), 1e-6);
  csRockLod = log2(max(fp / p_rockScale * 1024.0, 1.0));
  csMortLod = log2(max(fp / p_mortScale * 1024.0, 1.0));
  csFade = p_pomOn * (1.0 - smoothstep(0.006, 0.03, fp));
  uv = uv0;
  float zr = 0.0;
  CsS S = csSample(uv);
  if (csFade > 0.0) {
    float vz = max(Vts.z, 0.1);
    // march down in coarse steps to the first below the surface, then halve the step four times between the
    // last above and the first below
    int steps = int(mix(14.0, 4.0, clamp(Vts.z, 0.0, 1.0)));
    float dz = p_pom / float(steps);
    vec2 duv = -Vts.xy / vz * dz * csFade;
    vec2 puv = uv;
    float pz = 0.0;
    for (int i = 0; i < 14; i++) {
      if (i >= steps || zr <= S.h) break;
      puv = uv; pz = zr;
      uv += duv; zr -= dz;
      S = csSample(uv);
    }
    if (zr <= S.h) {
      vec2 lo = puv, hi = uv;
      float zlo = pz, zhi = zr;
      for (int i = 0; i < 4; i++) {
        vec2 mu = 0.5 * (lo + hi);
        float mz = 0.5 * (zlo + zhi);
        CsS M = csSample(mu);
        if (mz <= M.h) { hi = mu; zhi = mz; S = M; } else { lo = mu; zlo = mz; }
      }
      uv = hi;
      zr = zhi;
    }
    S = csSample(uv);
  }
  csUvP = uv;
  csZ = S.h;
  // the normal from the height round the place, no finer than a pixel
  float e = max(0.002, fp * 0.75);
  float hx = csSample(uv + vec2(e, 0.0)).h - S.h;
  float hy = csSample(uv + vec2(0.0, e)).h - S.h;
  vec3 rn = picDataLod(t_rockNrm, S.tuv, csRockLod).xyz * 2.0 - 1.0;
  csNts = normalize(vec3(-hx / e, -hy / e, 1.0) + vec3(rn.xy * p_detailNormal * S.stone, 0.0));

  // the colour: the rock's picture taken grey, tinted, each stone its own lightness and warmth; the mortar's the same
  vec3 rockC = picColourLod(t_rockCol, S.tuv, csRockLod);
  float rl = mix(1.0, dot(rockC, vec3(0.2126, 0.7152, 0.0722)) / picMean(t_rockCol), p_rockContrast);
  float h1 = fract(S.id * 913.7), h2 = fract(S.id * 271.3), h3 = fract(S.id * 517.9);
  float val = 1.0 + (h1 - 0.5) * 2.0 * p_valueVar;
  if (h3 < p_dark) val *= 0.62;
  float warm = (h2 - 0.5) * 2.0 * p_warm;
  float mott = 1.0 + (csTN(uv * 0.9 + S.id * 13.0) - 0.5) * 2.0 * p_mottle;
  vec3 stoneC = p_stoneTint * rl * val * mott * vec3(1.0 + 0.16 * warm, 1.0 + 0.02 * warm, 1.0 - 0.2 * warm);
  vec3 mortC = p_mortTint * dot(picColourLod(t_mortCol, uv / p_mortScale, csMortLod), vec3(0.2126, 0.7152, 0.0722)) / picMean(t_mortCol);
  float sm = S.stone * smoothstep(-fp, fp, S.d);
  vec3 col = mix(mortC, stoneC, sm);
  // the cavity: the mortar darker toward the stones' edges, the stones' edges darker as they round down
  float aoM = mix(0.4, 0.85, smoothstep(0.0, 0.6 * p_joint + 0.004, -S.d));
  float aoS = mix(0.65, 1.0, smoothstep(0.0, p_edgeRound * 1.5, S.d));
  k.ao = mix(aoM, aoS, sm);
  k.aoDirect = 0.35;
  // streaks run down the walls, rising damp darkens their feet, moss in the damp and on the slabs
  int kind = int(s2.x + 0.5);
  float streak = kind == 1 ? 0.0 : smoothstep(0.5, 0.85, csTN(vec2(uv.x * 2.2, uv.y * 0.1 + csTN(vec2(uv.x * 0.5, 7.0)) * 3.0)));
  col *= 1.0 - p_grime * streak * 0.45;
  col = mix(col, col * vec3(0.92, 0.86, 0.76), p_grime * streak * 0.6);
  float dampM = 1.0 - smoothstep(0.0, 0.5 + 1.6 * csTN(vec2(uv.x * 0.45, 3.0)), vLookWorld.y);
  col *= 1.0 - 0.45 * p_damp * dampM;
  col = mix(col, col * vec3(0.85, 0.95, 0.75), p_damp * dampM * 0.5);
  float mossM = smoothstep(0.52, 0.78, csTN(uv * 1.7 + 3.1)) * clamp(dampM * 0.9 + (kind == 1 ? 0.7 : 0.0) + (1.0 - sm) * 0.4, 0.0, 1.0);
  mossM = clamp(mossM * p_moss * 1.6, 0.0, 1.0);
  col = mix(col, vec3(0.05, 0.075, 0.02) * (0.7 + 0.6 * rl), mossM);
  k.rough = mix(mix(0.96, 0.86, sm), 1.0, mossM);

  if (lookView > 0.5 && lookView < 1.5) col = mix(vec3(0.6), vec3(h1, h2, h3), sm);
  if (lookView > 1.5 && lookView < 2.5) col = vec3((S.h + p_pom) / p_pom);
  if (lookView > 3.5) col = csSolidColour(int(s2.w + 0.5) % 256);
  k.colour = col;
  k.normal = normalize(mat3(csT, csB, csNg) * csNts);
  k.ownNormal = true;

}

void look_6(inout Look k) {
  p_stoneMin = texelFetch(lookSettings, ivec2(0, 6), 0).r;
  p_stoneMax = texelFetch(lookSettings, ivec2(1, 6), 0).r;
  p_rowMin = texelFetch(lookSettings, ivec2(2, 6), 0).r;
  p_rowMax = texelFetch(lookSettings, ivec2(3, 6), 0).r;
  p_joint = texelFetch(lookSettings, ivec2(4, 6), 0).r;
  p_seed = texelFetch(lookSettings, ivec2(5, 6), 0).r;
  p_gap = texelFetch(lookSettings, ivec2(6, 6), 0).r;
  p_edgeRound = texelFetch(lookSettings, ivec2(7, 6), 0).r;
  p_edgeDrop = texelFetch(lookSettings, ivec2(8, 6), 0).r;
  p_corner = texelFetch(lookSettings, ivec2(9, 6), 0).r;
  p_cup = texelFetch(lookSettings, ivec2(10, 6), 0).r;
  p_tilt = texelFetch(lookSettings, ivec2(11, 6), 0).r;
  p_grain = texelFetch(lookSettings, ivec2(12, 6), 0).r;
  p_grainNormal = texelFetch(lookSettings, ivec2(13, 6), 0).r;
  p_light = texelFetch(lookSettings, ivec2(14, 6), 0).r;
  p_valueVar = texelFetch(lookSettings, ivec2(15, 6), 0).r;
  p_warm = texelFetch(lookSettings, ivec2(16, 6), 0).r;
  p_endDark = texelFetch(lookSettings, ivec2(17, 6), 0).r;
  p_rings = texelFetch(lookSettings, ivec2(18, 6), 0).r;
  p_grainScale = texelFetch(lookSettings, ivec2(19, 6), 0).r;
  p_pom = texelFetch(lookSettings, ivec2(20, 6), 0).r;
  p_pomOn = texelFetch(lookSettings, ivec2(21, 6), 0).r;
  p_shadowOn = texelFetch(lookSettings, ivec2(22, 6), 0).r;
  t_woodCol = 5;
  t_woodDisp = 6;
  t_woodNrm = 7;
  t_woodRough = 8;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

  csNg = normalize(vNormal);
  csT = normalize(s0 - csNg * dot(s0, csNg));
  csB = normalize(s1 - csNg * dot(s1, csNg) - csT * dot(s1, csT));
  vec3 Vv = normalize(vViewPosition);
  vec3 Vts = vec3(dot(Vv, csT), dot(Vv, csB), dot(Vv, csNg));
  vec2 uv0 = vLookUv;
  vec2 fw = abs(lookGx) + abs(lookGy);
  float fp = max(max(fw.x, fw.y), 1e-6);
  cwLod = log2(max(fp / p_grainScale * 1024.0, 1.0));
  csFade = p_pomOn * (1.0 - smoothstep(0.006, 0.03, fp));
  uv = uv0;
  float zr = 0.0;
  CwS S = cwSample(uv);
  if (csFade > 0.0) {
    float vz = max(Vts.z, 0.1);
    int steps = int(mix(14.0, 4.0, clamp(Vts.z, 0.0, 1.0)));
    float dz = p_pom / float(steps);
    vec2 duv = -Vts.xy / vz * dz * csFade;
    vec2 puv = uv;
    float pz = 0.0;
    for (int i = 0; i < 14; i++) {
      if (i >= steps || zr <= S.h) break;
      puv = uv; pz = zr;
      uv += duv; zr -= dz;
      S = cwSample(uv);
    }
    if (zr <= S.h) {
      vec2 lo = puv, hi = uv;
      float zlo = pz, zhi = zr;
      for (int i = 0; i < 4; i++) {
        vec2 mu = 0.5 * (lo + hi);
        float mz = 0.5 * (zlo + zhi);
        CwS M = cwSample(mu);
        if (mz <= M.h) { hi = mu; zhi = mz; S = M; } else { lo = mu; zlo = mz; }
      }
      uv = hi;
      zr = zhi;
    }
    S = cwSample(uv);
  }
  csUvP = uv;
  csZ = S.h;
  float e = max(0.002, fp * 0.75);
  float hx = cwSample(uv + vec2(e, 0.0)).h - S.h;
  float hy = cwSample(uv + vec2(0.0, e)).h - S.h;
  vec3 gn = picDataLod(t_woodNrm, S.tuv, cwLod).xyz * 2.0 - 1.0;
  csNts = normalize(vec3(-hx / e, -hy / e, 1.0) + vec3(gn.xy * p_grainNormal * S.board * (1.0 - S.end), 0.0));

  // the colour: the wood's picture, each board its own lightness and warmth; an end its rings round its heart, darker
  vec3 woodC = picColourLod(t_woodCol, S.tuv, cwLod);
  float h1 = fract(S.id * 913.7), h2 = fract(S.id * 271.3), h3 = fract(S.id * 517.9);
  float val = 1.0 + (h1 - 0.5) * 2.0 * p_valueVar;
  float warm = (h2 - 0.5) * 2.0 * p_warm;
  vec3 boardC = woodC * p_light * val * vec3(1.0 + 0.14 * warm, 1.0, 1.0 - 0.18 * warm);
  if (S.end > 0.5) {
    vec2 heart = S.size * vec2(0.5 + (h3 - 0.5) * 0.4, 0.5 + (h1 - 0.5) * 0.4);
    float r = length(S.p - heart) * p_rings + csTN(S.p * 9.0 + S.id * 17.0) * 1.5;
    float ring = 0.5 + 0.5 * sin(r * 6.2832);
    boardC *= (1.0 - p_endDark) * (0.82 + 0.18 * ring);
  }
  float sb = S.board * smoothstep(-fp, fp, S.d);
  vec3 gapC = boardC * 0.18;
  vec3 col = mix(gapC, boardC, sb);
  float aoG = mix(0.3, 0.8, smoothstep(0.0, 0.6 * p_joint + 0.004, -S.d));
  float aoB = mix(0.75, 1.0, smoothstep(0.0, p_edgeRound * 1.5, S.d));
  k.ao = mix(aoG, aoB, sb);
  k.aoDirect = 0.35;
  k.rough = mix(1.0, picDataLod(t_woodRough, S.tuv, cwLod).r, sb);

  if (lookView > 0.5 && lookView < 1.5) col = mix(vec3(0.6), vec3(h1, h2, h3), sb);
  if (lookView > 1.5 && lookView < 2.5) col = vec3((S.h + p_pom) / p_pom);
  if (lookView > 3.5) col = csSolidColour(int(s2.w + 0.5) % 256);
  k.colour = col;
  k.normal = normalize(mat3(csT, csB, csNg) * csNts);
  k.ownNormal = true;

}

void look_7(inout Look k) {
  p_repeat = texelFetch(lookSettings, ivec2(0, 7), 0).r;
  t_col = 5;
  t_nrm = 7;
  t_rough = 8;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

  vec2 tuv = uv * p_repeat;
  k.colour = picColour(t_col, tuv, p_repeat);
  k.nts = picData(t_nrm, tuv, p_repeat).xyz * 2.0 - 1.0;
  k.rough = picData(t_rough, tuv, p_repeat).r;

}

void look_8(inout Look k) {
  p_tint = texelFetch(lookSettings, ivec2(0, 8), 0).rgb;
  p_contrast = texelFetch(lookSettings, ivec2(1, 8), 0).r;
  p_metres = texelFetch(lookSettings, ivec2(2, 8), 0).r;
  t_col = 0;
  t_nrm = 2;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

  // each part on its own patch of the pictures, from its thing's and its part's numbers
  vec2 kitPatch = vec2(fract(vLookInfo.y * 0.61803 + vLookInfo.z * 0.137) * 37.0, fract(vLookInfo.y * 0.75488 + vLookInfo.z * 0.291) * 23.0);
  vec2 tuv = uv / p_metres + kitPatch;
  vec3 picC = picColour(t_col, tuv, 1.0 / p_metres);
  float kitL = dot(picC, vec3(0.2126, 0.7152, 0.0722)) / picMean(t_col);
  vec3 kitN = picData(t_nrm, tuv, 1.0 / p_metres).xyz * 2.0 - 1.0;
  float kitSteep = 1.0 - clamp(kitN.z, 0.0, 1.0);
  float kitCav = clamp(smoothstep(0.05, 0.4, kitSteep) * 0.7 + smoothstep(0.7, 0.35, kitL) * 0.3, 0.0, 1.0);
  float kitBend = length(fwidth(wn)) / max(length(fwidth(wp)), 1e-5);
  float kitEdge = smoothstep(20.0, 70.0, kitBend) * (0.6 + 0.4 * kn(uv * 40.0 + seed));
  float kitUp = smoothstep(0.55, 0.95, wn.y);
  float kitDamp = 1.0 - smoothstep(0.0, 0.35 + 0.3 * kn(wp.xz * 2.0), wp.y);
  float kitMoss = clamp(smoothstep(0.55, 0.8, kfbm4(uv * 2.3 + seed * 1.7)) * (kitUp * 0.7 + kitDamp * 0.5) * (0.4 + kitCav), 0.0, 1.0) * 0.8;
  float kitV = 1.0 + (kh1(seed + 0.37) - 0.5) * 0.3;
  float kitWarm = (kh1(seed + 5.1) - 0.5) * 0.5;
  float kitMott = 1.0 + (kfbm4(uv * 1.3 + seed) - 0.5) * 0.35;
  vec3 kitC = p_tint * mix(1.0, kitL, p_contrast) * kitV * kitMott * vec3(1.0 + 0.16 * kitWarm, 1.0 + 0.02 * kitWarm, 1.0 - 0.2 * kitWarm);
  kitC *= mix(1.0, 0.75, kitCav);
  kitC = mix(kitC, kitC * vec3(0.8, 0.74, 0.64), kitCav * 0.6);
  kitC *= 1.0 - 0.35 * kitDamp;
  kitC = mix(kitC, min(kitC * 1.45 + 0.03, vec3(1.0)), kitEdge * (1.0 - kitCav));
  kitC = mix(kitC, vec3(0.05, 0.075, 0.02) * (0.7 + 0.6 * kitL), kitMoss);
  k.colour = kitC;
  // the roughness from the same: the cavity and the moss rougher, the worn edges smoother
  k.rough = clamp(0.8 + 0.18 * kitCav + 0.2 * kitMoss - 0.22 * kitEdge, 0.5, 1.0);
  // the relief: the normal picture, and over it the rock's lightness as a height, its dark sunk
  k.nts = kitN;
  k.height = (kitL - 1.0) * 0.003;
  // the cavity shades the light that comes from everywhere
  k.ao = mix(1.0, 0.7, kitCav);

}

void look_9(inout Look k) {
  p_repeat = texelFetch(lookSettings, ivec2(0, 9), 0).r;
  t_col = 5;
  t_nrm = 7;
  t_rough = 8;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

  vec2 tuv = uv * p_repeat;
  k.colour = picColour(t_col, tuv, p_repeat);
  k.nts = picData(t_nrm, tuv, p_repeat).xyz * 2.0 - 1.0;
  k.rough = picData(t_rough, tuv, p_repeat).r;

}

void look_10(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float dim = kcell(uv * 22.0 + seed);
    float big = kfbm4(uv * 3.0 + seed);
    float rust = smoothstep(0.5, 0.78, kfbm4(uv * 2.2 + seed * 3.1)) * 0.85 + smoothstep(0.45, 0.2, dim) * 0.06 * kfade(0.05);
    vec3 iron = mix(vec3(0.1, 0.095, 0.09), vec3(0.21, 0.2, 0.19), big);
    vec3 red = mix(vec3(0.14, 0.065, 0.03), vec3(0.24, 0.12, 0.055), kn(uv * 40.0 + seed));
    k.colour = mix(iron, red, clamp(rust, 0.0, 1.0));
    k.metal = mix(0.3, 0.05, clamp(rust, 0.0, 1.0));
    k.rough = mix(0.45 + 0.25 * big, 0.92, clamp(rust, 0.0, 1.0));
    k.height = -0.0012 * smoothstep(0.5, 0.0, dim) * kfade(0.05);

}

void look_11(inout Look k) {
  p_thDark = texelFetch(lookSettings, ivec2(0, 11), 0).rgb;
  p_thLight = texelFetch(lookSettings, ivec2(1, 11), 0).rgb;
  p_thAged = texelFetch(lookSettings, ivec2(2, 11), 0).rgb;
  p_thAgeFrom = texelFetch(lookSettings, ivec2(3, 11), 0).r;
  p_thAgeTo = texelFetch(lookSettings, ivec2(4, 11), 0).r;
  p_thDeep = texelFetch(lookSettings, ivec2(5, 11), 0).r;
  p_thRough = texelFetch(lookSettings, ivec2(6, 11), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float bundle = kn(vec2(uv.x * 2.5, uv.y * 9.0) + seed);
    float strand = kn(vec2(uv.x * 9.0, uv.y * 260.0) + seed) * kfade(0.004);
    float age = kfbm4(uv * 0.9 + seed);
    vec3 straw = mix(p_thDark, p_thLight, bundle);
    straw = mix(straw, p_thAged, smoothstep(p_thAgeFrom, p_thAgeTo, age));
    k.colour = straw * mix(p_thDeep, 1.1, strand);
    k.rough = p_thRough;
    k.metal = 0.0;
    k.height = 0.006 * (strand - 0.5) + 0.01 * (bundle - 0.5);

}

void look_12(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float pick = kh1(vLookInfo.y * 3.7 + 0.31);
    vec3 dye = pick < 0.22 ? vec3(0.42, 0.06, 0.05) : pick < 0.4 ? vec3(0.08, 0.13, 0.33) : pick < 0.52 ? vec3(0.62, 0.5, 0.16)
             : pick < 0.66 ? vec3(0.12, 0.25, 0.1) : pick < 0.84 ? vec3(0.66, 0.6, 0.48) : vec3(0.3, 0.19, 0.11);
    vec2 t = uv / 0.0015;
    float warp = sin(t.x * 3.14159), weft = sin(t.y * 3.14159);
    float over = step(0.0, warp * weft);
    float weave = mix(0.5, mix(0.82, 1.08, over) * (0.85 + 0.15 * abs(over > 0.5 ? weft : warp)), kfade(0.003));
    float wear = kfbm4(uv * 2.2 + seed);
    k.colour = dye * weave * mix(0.85, 1.12, kn(uv * 9.0 + seed));
    k.colour = mix(k.colour, k.colour * 0.7 + vec3(0.05, 0.045, 0.04), smoothstep(0.6, 0.85, wear));
    k.rough = 0.93;
    k.metal = 0.0;
    k.height = 0.0003 * (weave - 0.5);

}

void look_13(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float stroke = kn(vec2(uv.x * 1.8 + uv.y * 0.6, uv.y * 7.0) + seed);
    float grain = kn(uv * 70.0 + seed) * kfade(0.02);
    float grime = smoothstep(0.55, 0.85, kfbm4(uv * 1.2 + seed));
    k.colour = vec3(0.86, 0.82, 0.72) * (0.92 + 0.08 * stroke + 0.05 * grain);
    k.colour = mix(k.colour, vec3(0.55, 0.5, 0.42), grime * 0.45);
    k.rough = 0.92;
    k.metal = 0.0;
    k.height = 0.002 * (stroke - 0.5) + 0.0004 * grain;

}

void look_14(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float twist = fract(uv.x / 0.018 + uv.y / 0.012);
    float strand = smoothstep(0.0, 0.25, twist) * smoothstep(1.0, 0.75, twist);
    float fibre = kn(vec2(uv.x * 300.0, uv.y * 40.0) + seed) * kfade(0.003);
    k.colour = mix(vec3(0.38, 0.3, 0.17), vec3(0.62, 0.52, 0.32), mix(0.5, strand, kfade(0.01))) * (0.9 + 0.2 * fibre);
    k.rough = 0.9;
    k.metal = 0.0;
    k.height = 0.0015 * mix(0.5, strand, kfade(0.01));

}

void look_15(inout Look k) {
  p_glTint = texelFetch(lookSettings, ivec2(0, 15), 0).rgb;
  p_glTint2 = texelFetch(lookSettings, ivec2(1, 15), 0).rgb;
  p_glWaves = texelFetch(lookSettings, ivec2(2, 15), 0).r;
  p_glWaveDepth = texelFetch(lookSettings, ivec2(3, 15), 0).r;
  p_glSeeds = texelFetch(lookSettings, ivec2(4, 15), 0).r;
  p_glRough = texelFetch(lookSettings, ivec2(5, 15), 0).r;
  p_glAlpha = texelFetch(lookSettings, ivec2(6, 15), 0).r;
  p_glAlphaVar = texelFetch(lookSettings, ivec2(7, 15), 0).r;
  p_glRibs = texelFetch(lookSettings, ivec2(8, 15), 0).r;
  p_glRibWide = texelFetch(lookSettings, ivec2(9, 15), 0).r;
  p_glRibAlpha = texelFetch(lookSettings, ivec2(10, 15), 0).r;
  p_glGlow = texelFetch(lookSettings, ivec2(11, 15), 0).rgb;
  p_glCrease = texelFetch(lookSettings, ivec2(12, 15), 0).r;
  p_glCreaseFreq = texelFetch(lookSettings, ivec2(13, 15), 0).r;
  p_glBands = texelFetch(lookSettings, ivec2(14, 15), 0).r;
  p_glBandHigh = texelFetch(lookSettings, ivec2(15, 15), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float wave = kfbm4(uv * p_glWaves + seed);
    float seeds = smoothstep(0.08, 0.02, kcell(uv * 60.0 + seed)) * kfade(0.01);
    // the twin wall's ribs, along u, one every 1 / glRibs metres across v; under a pixel, their mean cover
    float glRib = 0.0;
    if (p_glRibs > 0.0) {
      float glRd = abs(fract(uv.y * p_glRibs) - 0.5) * 2.0;
      float glRw = fwidth(uv.y * p_glRibs) * 2.0;
      float glLine = 1.0 - smoothstep(p_glRibWide - glRw, p_glRibWide + glRw, 1.0 - glRd);
      glRib = mix(p_glRibWide, glLine, kfade(1.5 / p_glRibs));
    }
    // the film's creases and wound bands, level round the load (the world's height, and the way along the face)
    float glFold = 0.0, glBand = 0.0;
    if (p_glCrease > 0.0 || p_glBands > 0.0) {
      vec3 glSide = cross(vec3(0.0, 1.0, 0.0), wn);
      float glAlong = dot(glSide, glSide) > 0.01 ? dot(wp, normalize(glSide)) : wp.x;
      float glUp = wp.y + 0.03 * kn(vec2(glAlong * 2.0, 0.0) + seed);
      float glF = kn(vec2(glAlong * 1.6, glUp * p_glCreaseFreq) + seed * 1.7);
      float glF2 = kn(vec2(glAlong * 3.1, glUp * p_glCreaseFreq * 2.3) + seed + 5.0);
      glFold = p_glCrease * mix(0.35, pow(1.0 - abs(glF * 2.0 - 1.0), 6.0) * 0.75 + pow(1.0 - abs(glF2 * 2.0 - 1.0), 8.0) * 0.4,
                                kfade(1.0 / p_glCreaseFreq));
      float glB = fract(glUp / p_glBandHigh + 0.15 * kn(vec2(glAlong * 0.8, 3.0) + seed));
      glBand = p_glBands * smoothstep(0.55, 0.62, glB) * (0.8 + 0.4 * kn(vec2(glAlong * 4.0, glUp * 6.0) + seed));
    }
    k.colour = mix(p_glTint, p_glTint2, wave) + seeds * p_glSeeds + vec3(0.12 * glRib + 0.25 * glFold + 0.06 * glBand);
    k.rough = p_glRough + p_glRough * wave;
    k.metal = 0.0;
    k.height = p_glWaveDepth * (wave - 0.5) + 0.0003 * glFold;
    k.alpha = clamp(p_glAlpha + p_glAlphaVar * wave + p_glRibAlpha * glRib + 0.35 * glFold + 0.18 * glBand, 0.0, 1.0);
    k.glow = p_glGlow * (0.9 + 0.2 * wave) * (1.0 + 0.4 * glRib);

}

void look_16(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec2 id;
    vec4 c = kcourse(uv, 0.17, 0.26, 0.6, seed, id);
    float tone = kh(id + seed);
    float edge = smoothstep(0.0, 0.04, c.x) * smoothstep(1.0, 0.96, c.x) * smoothstep(0.0, 0.05, c.y);
    float split = kn(uv * 30.0 + id * 3.1) * kfade(0.02);
    k.colour = mix(vec3(0.07, 0.08, 0.095), vec3(0.16, 0.17, 0.19), tone) * mix(0.45, 1.0, mix(1.0, edge, kfade(0.05))) * (0.9 + 0.15 * split);
    k.rough = 0.72 + 0.15 * split;
    k.metal = 0.0;
    k.height = mix(0.0, 0.006 * (1.0 - c.y) * edge, kfade(0.05));

}

void look_17(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec2 id;
    vec4 c = kcourse(uv, 0.18, 0.22, 0.9, seed, id);
    float tone = kh(id + seed);
    float grain = kn(vec2((uv.x + id.x) * 60.0, uv.y * 4.0) + id) * kfade(0.008);
    float edge = smoothstep(0.0, 0.05, c.x) * smoothstep(1.0, 0.95, c.x) * smoothstep(0.0, 0.06, c.y);
    vec3 wood = mix(vec3(0.3, 0.2, 0.11), vec3(0.5, 0.37, 0.22), tone);
    wood = mix(wood, vec3(0.34, 0.33, 0.3), smoothstep(0.55, 0.85, kfbm4(uv * 1.5 + seed)) * 0.6);
    k.colour = wood * mix(0.4, 1.0, mix(1.0, edge, kfade(0.05))) * (0.85 + 0.25 * grain);
    k.rough = 0.88;
    k.metal = 0.0;
    k.height = mix(0.0, 0.008 * (1.0 - c.y) * edge, kfade(0.05)) + 0.0006 * grain;

}

void look_18(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float row = floor(uv.y / 0.25);
    float inRow = fract(uv.y / 0.25);
    float tone = kh1(row + seed);
    float grain = kn(vec2(uv.x * 3.0, (uv.y + row) * 90.0) + row) * kfade(0.006);
    float edge = smoothstep(0.0, 0.03, inRow) * smoothstep(1.0, 0.97, inRow);
    vec3 wood = mix(vec3(0.27, 0.17, 0.09), vec3(0.46, 0.31, 0.17), tone);
    k.colour = wood * mix(0.45, 1.0, mix(1.0, edge, kfade(0.04))) * (0.82 + 0.3 * grain);
    k.rough = 0.82;
    k.metal = 0.0;
    k.height = mix(0.0, -0.003 * (1.0 - edge), kfade(0.04)) + 0.0005 * grain;

}

void look_19(inout Look k) {
  p_size = texelFetch(lookSettings, ivec2(0, 19), 0).r;
  p_jitter = texelFetch(lookSettings, ivec2(1, 19), 0).r;
  p_stretch = texelFetch(lookSettings, ivec2(2, 19), 0).r;
  p_joint = texelFetch(lookSettings, ivec2(3, 19), 0).r;
  p_seed = texelFetch(lookSettings, ivec2(4, 19), 0).r;
  p_dome = texelFetch(lookSettings, ivec2(5, 19), 0).r;
  p_flat = texelFetch(lookSettings, ivec2(6, 19), 0).r;
  p_corner = texelFetch(lookSettings, ivec2(7, 19), 0).r;
  p_edgeRound = texelFetch(lookSettings, ivec2(8, 19), 0).r;
  p_edgeDrop = texelFetch(lookSettings, ivec2(9, 19), 0).r;
  p_chip = texelFetch(lookSettings, ivec2(10, 19), 0).r;
  p_sink = texelFetch(lookSettings, ivec2(11, 19), 0).r;
  p_tilt = texelFetch(lookSettings, ivec2(12, 19), 0).r;
  p_detail = texelFetch(lookSettings, ivec2(13, 19), 0).r;
  p_recess = texelFetch(lookSettings, ivec2(14, 19), 0).r;
  p_valueVar = texelFetch(lookSettings, ivec2(15, 19), 0).r;
  p_warm = texelFetch(lookSettings, ivec2(16, 19), 0).r;
  p_dark = texelFetch(lookSettings, ivec2(17, 19), 0).r;
  p_fleck = texelFetch(lookSettings, ivec2(18, 19), 0).r;
  p_polish = texelFetch(lookSettings, ivec2(19, 19), 0).r;
  p_dirt = texelFetch(lookSettings, ivec2(20, 19), 0).r;
  p_mossCover = texelFetch(lookSettings, ivec2(21, 19), 0).r;
  p_mossTop = texelFetch(lookSettings, ivec2(22, 19), 0).r;
  p_mossDepth = texelFetch(lookSettings, ivec2(23, 19), 0).r;
  p_mossScale = texelFetch(lookSettings, ivec2(24, 19), 0).r;
  p_wet = texelFetch(lookSettings, ivec2(25, 19), 0).r;
  p_grey = texelFetch(lookSettings, ivec2(26, 19), 0).rgb;
  p_brown = texelFetch(lookSettings, ivec2(27, 19), 0).rgb;
  p_sand = texelFetch(lookSettings, ivec2(28, 19), 0).rgb;
  p_mossDark = texelFetch(lookSettings, ivec2(29, 19), 0).rgb;
  p_mossLight = texelFetch(lookSettings, ivec2(30, 19), 0).rgb;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

  // the path's top: laid on the ground; any other face laid along its height
  bool top = vLookWN.y > 0.7;
  vec2 q;
  if (top) {
    q = vec2(vLookWorld.x, -vLookWorld.z);
  } else {
    vec3 n = normalize(vLookWN);
    vec3 along = normalize(vec3(-n.z, 0.0, n.x) + vec3(1e-5, 0.0, 0.0));
    q = vec2(dot(vLookWorld, along), vLookWorld.y);
  }
  vec2 fw = fwidth(q);
  float fp = max(max(fw.x, fw.y), 1e-6);
  cbFp = fp;
  CbS S = cbSample(q);

  // the cobble's colour: grey to brown by its own number, its lightness, a share of dark ones, flecks and mottling;
  // its worn top lighter and smoother, its edge dirtier
  vec4 R = S.rnd;
  float val = 1.0 + (R.x - 0.5) * 2.0 * p_valueVar;
  if (R.y < p_dark) val *= 0.55;
  vec3 stoneC = mix(p_grey, p_brown, clamp(R.w * p_warm * 2.0, 0.0, 1.0)) * val;
  float fl = cbN(q + R.xy * 91.0, 260.0);
  stoneC *= 1.0 + (smoothstep(0.6, 0.7, fl) * 0.6 - smoothstep(0.6, 0.7, 1.0 - fl) * 0.35) * p_fleck;
  stoneC *= 1.0 + (cbN(q + R.zw * 13.0, 12.0) - 0.5) * 0.45;
  float worn = (1.0 - smoothstep(0.0, 0.7, S.t)) * p_polish;
  stoneC *= 1.0 + 0.18 * worn;
  float edgeDirt = (1.0 - smoothstep(0.0, p_edgeRound * 1.6, S.d)) * p_dirt;
  stoneC *= 1.0 - 0.4 * edgeDirt;
  // the sand: its grains, darker in the joint's bottom
  vec3 sandC = p_sand * (0.7 + 0.6 * cbN(q, 300.0)) * (1.0 - 0.25 * p_dirt);
  float sm = S.stone * smoothstep(-fp, fp, S.d);
  vec3 col = mix(sandC, stoneC, sm);
  // the moss layer: dark to light green, lighter where its cushions stand up and catch the light, its thin fringe
  // letting the stone or sand under it show through
  float mossM = smoothstep(0.0, 0.6, S.moss);
  float lumpC = cbN(q + 5.1, 90.0);
  vec3 mossC = mix(p_mossDark, p_mossLight, clamp(cbN(q + 2.3, 2.0 / p_mossScale) * 1.4 - 0.2, 0.0, 1.0));
  mossC *= 0.7 + 0.6 * lumpC;
  col = mix(col, mossC, mossM);
  // the cavity: the sand darker toward the cobbles, a cobble's edge darker as it rounds down; the moss's own,
  // its cushions' hollows, over them
  float aoM = mix(0.45, 0.85, smoothstep(0.0, 0.6 * p_joint + 0.006, -S.d));
  float aoS = mix(0.6, 1.0, smoothstep(0.0, p_edgeRound * 1.4, S.d));
  float ao = mix(aoM, aoS, sm);
  k.ao = mix(ao, 0.7 + 0.3 * lumpC, mossM);
  k.aoDirect = 0.35;
  float rough = mix(0.97, mix(0.82, 0.5, worn), sm);
  rough = mix(rough, 1.0, mossM);
  // wet: the low places hold it first, darker and glossy; at full wet everything is
  float low = 1.0 - smoothstep(-p_recess - p_mossDepth - 0.004, -p_mossDepth - 0.004, S.h);
  float wetM = clamp(p_wet * 1.6 - (1.0 - low) * (1.0 - p_wet) * 1.6, 0.0, 1.0);
  col *= mix(1.0, 0.55, wetM);
  k.rough = mix(rough, 0.12, wetM);

  if (lookView > 0.5 && lookView < 1.5) col = mix(vec3(0.5), R.xyz, sm);
  if (lookView > 1.5 && lookView < 2.5) col = vec3((S.h + p_recess + p_mossDepth) / (p_recess + p_mossDepth));
  k.colour = col;
  // the relief as a height, bent into the normal by the pixel's neighbours; flat on a face that is not the top
  k.height = top ? S.h : 0.0;

}

void look_20(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float grain = kn(uv * 600.0 + seed) * kfade(0.002);
    float blush = kfbm(uv * 2.0 + seed);
    k.colour = mix(vec3(0.52, 0.22, 0.12), vec3(0.66, 0.34, 0.2), blush) * (0.9 + 0.15 * grain);
    k.rough = 0.88;
    k.height = 0.0002 * grain + 0.0006 * (kn(vec2(uv.x * 4.0, uv.y * 60.0) + seed) - 0.5);

}

void look_21(inout Look k) {
  p_poSimmer = texelFetch(lookSettings, ivec2(0, 21), 0).r;
  p_poRoll = texelFetch(lookSettings, ivec2(1, 21), 0).r;
  p_poBits = texelFetch(lookSettings, ivec2(2, 21), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float z = kcycle(p_poSimmer);
    // the simmer: the broth churning in place, and the way it carries what floats on it
    vec2 roll = vec2(kfbm3(vec3(uv * 5.0 + seed, z * 3.0), 3.0), kfbm3(vec3(uv * 5.0 + seed + 7.3, z * 3.0), 3.0)) - 0.5;
    vec2 q = uv + roll * p_poRoll;
    float body = kfbm3(vec3(uv * 9.0 + seed + 3.1, z * 4.0), 4.0);
    // grains of barley, round and drawn out a little, and ragged flecks of herb, where the broth carries them: each a cell,
    // there or not by its own number
    float gid, gedge, hid, hedge;
    float gd = kvor(vec2(q.x * 120.0, q.y * 80.0) + seed + 8.0, gid, gedge);
    float grain = (1.0 - smoothstep(0.2, 0.3, gd)) * step(1.0 - 0.4 * p_poBits, kh1(gid * 17.3)) * kfade(0.002);
    float hd = kvor(q * 115.0 + seed + 3.0, hid, hedge);
    float herb = (1.0 - smoothstep(0.16, 0.27, hd + 0.14 * kn(q * 700.0 + seed))) * step(1.0 - 0.45 * p_poBits, kh1(hid * 29.1)) * kfade(0.003);
    // eyes of fat on the surface, gathering and parting as it turns
    float fat = smoothstep(0.6, 0.7, kfbm3(vec3(uv * 7.0 + seed + 5.0, z * 2.0), 2.0)) * (1.0 - smoothstep(0.75, 0.8, kn(q * 60.0 + seed)));
    vec3 c = mix(vec3(0.03, 0.019, 0.009), vec3(0.075, 0.048, 0.021), body);
    c = mix(c, vec3(0.045, 0.085, 0.018), herb * 0.9);
    c = mix(c, vec3(0.22, 0.17, 0.1), grain * 0.75);
    c = mix(c, vec3(0.11, 0.075, 0.03), fat * 0.5);
    k.colour = c;
    // the fat is glossy, the broth less so
    k.rough = mix(0.55, 0.22, fat);
    k.height = 0.0015 * (body - 0.5) + 0.0006 * grain + 0.0004 * herb;

}

void look_22(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // the courses: u runs level along the face, v up or down it; each stone its id
    vec2 id;
    vec4 c = kcourse(uv, 0.28, 0.52, 0.45, seed, id);
    float jx = min(c.x, 1.0 - c.x) * c.w, jy = min(c.y, 1.0 - c.y) * 0.28;
    float edge = min(jx, jy);
    // a stone's arris rounded and chipped, the joint recessed
    float chip = (kn(uv * 38.0 + id * 7.0) - 0.5) * 0.008;
    float joint = smoothstep(0.006, 0.016, edge + chip);
    // each stone its own lightness and warmth, its face mottled and pitted
    float h1 = kh(id + seed), h2 = kh(id + seed + 5.0), h3 = kh(id + seed + 9.0);
    float val = 0.82 + 0.36 * h1;
    if (h3 < 0.08) val *= 0.66;
    float warm = (h2 - 0.5) * 0.8;
    vec3 stoneC = vec3(0.34, 0.32, 0.29) * val * vec3(1.0 + 0.14 * warm, 1.0 + 0.02 * warm, 1.0 - 0.18 * warm);
    float mott = kfbm(uv * 3.5 + id * 3.1);
    float pit = smoothstep(0.62, 0.7, kn(uv * 70.0 + id * 11.0)) * kfade(0.004);
    stoneC *= (0.84 + 0.3 * mott) * (1.0 - 0.3 * pit);
    vec3 mortC = vec3(0.4, 0.38, 0.34) * (0.85 + 0.25 * kn(uv * 160.0 + seed) * kfade(0.003));
    vec3 col = mix(mortC * 0.75, stoneC, joint);
    // grime run down from the joints and the cap: streaks along the face, slow up it
    float streak = smoothstep(0.52, 0.85, kfbm(vec2(uv.x * 3.0, uv.y * 0.25) + seed + 2.0));
    col *= 1.0 - 0.32 * streak;
    col = mix(col, col * vec3(0.9, 0.86, 0.78), streak * 0.5);
    // lichen in patches on the stones
    float lich = smoothstep(0.66, 0.8, kfbm(uv * 2.6 + seed + 4.0)) * joint;
    col = mix(col, vec3(0.52, 0.5, 0.36), lich * 0.45);
    k.colour = col;
    k.rough = mix(0.98, 0.9, joint);
    k.height = mix(-0.01, 0.0, joint) - 0.0015 * pit + 0.0012 * (mott - 0.5);

}

void look_23(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // a velvety near-black crust, browner where tar has run and glazed, flaking in places to a lighter grey ash
    float crust = kfbm(uv * 9.0 + seed);
    float tar = smoothstep(0.55, 0.8, kfbm(vec2(uv.x * 3.0, uv.y * 0.8) + seed + 3.0));
    float flake = smoothstep(0.72, 0.78, kfbm(uv * 14.0 + seed + 9.0));
    vec3 c = mix(vec3(0.016, 0.015, 0.015), vec3(0.04, 0.038, 0.036), crust);
    c = mix(c, vec3(0.05, 0.035, 0.022), tar * 0.5);
    c = mix(c, vec3(0.1, 0.098, 0.095), flake * 0.5);
    k.colour = c * (0.8 + 0.4 * kn(uv * 220.0 + seed) * kfade(0.003));
    k.rough = mix(1.0, 0.7, tar);
    k.height = 0.0012 * crust - 0.0006 * flake;

}

void look_24(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // a warm off-white lime with sharp sand and grit through it, trowel strokes in its face, darkened by rain and
    // soot running down it, with fine shrinkage cracks
    float grit = kn(uv * 520.0 + seed) * kfade(0.002);
    float pebble = smoothstep(0.78, 0.84, kn(uv * 140.0 + seed + 4.0)) * kfade(0.006);
    float trowel = kn(vec2(uv.x * 2.5, uv.y * 26.0) + seed) * kfade(0.01);
    float dirt = smoothstep(0.45, 0.85, kfbm(uv * 2.5 + seed + 1.0));
    float id, e;
    kvor(uv * 7.0 + seed, id, e);
    float crack = smoothstep(0.012, 0.0, e) * step(0.6, kh1(id * 7.0)) * kfade(0.004);
    vec3 c = mix(vec3(0.74, 0.71, 0.64), vec3(0.62, 0.58, 0.5), trowel);
    c *= 0.9 + 0.16 * grit;
    c = mix(c, vec3(0.45, 0.41, 0.36), pebble * 0.6);
    c = mix(c, vec3(0.3, 0.29, 0.27), dirt * 0.55);
    k.colour = c * (1.0 - 0.55 * crack);
    k.rough = 0.93;
    k.height = 0.0006 * grit + 0.0008 * trowel + 0.0006 * pebble - 0.0008 * crack;

}

void look_25(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float tarnish = smoothstep(0.5, 0.85, kfbm(uv * 2.5 + seed));
    vec3 c = mix(vec3(0.82, 0.62, 0.25), vec3(0.4, 0.3, 0.14), tarnish);
    k.colour = c;
    k.metal = mix(0.55, 0.35, tarnish);
    k.rough = mix(0.18, 0.5, tarnish);

}

void look_26(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float r = kring(uv, seed, 7.0);
    float fb = kfibre(uv, seed);
    float figure = kfbm(vec2(uv.x * 1.5, uv.y * 6.0) + seed);
    k.colour = mix(vec3(0.3, 0.19, 0.11), vec3(0.14, 0.08, 0.045), r) * (0.85 + 0.3 * figure) * (0.92 + 0.12 * fb);
    k.rough = 0.4;
    k.height = -0.0003 * r;
    k.clearcoat = 0.6;
    k.clearcoatRough = 0.15;

}

void look_27(inout Look k) {
  p_fcHeat = texelFetch(lookSettings, ivec2(0, 27), 0).r;
  p_fcAsh = texelFetch(lookSettings, ivec2(1, 27), 0).r;
  p_fcGlow = texelFetch(lookSettings, ivec2(2, 27), 0).r;
  p_fcBreath = texelFetch(lookSettings, ivec2(3, 27), 0).r;
  p_fcFlicker = texelFetch(lookSettings, ivec2(4, 27), 0).r;
  p_fcChecks = texelFetch(lookSettings, ivec2(5, 27), 0).r;
  p_fcCheckShow = texelFetch(lookSettings, ivec2(6, 27), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float heat = clamp(s3.x * p_fcHeat, 0.0, 1.0);
    // the breath: the heat churning in place over the bed, patches a hand across, finer flickers in them
    float breath = kfbm3(vec3(uv * 6.0 + seed, kcycle(p_fcBreath) * 4.0), 4.0);
    float h = heat * mix(1.0, 0.45 + 1.1 * breath, p_fcFlicker);
    // the checking: splits along the grain, each row of blocks broken across at its own places, the lines wandering
    vec2 g = uv * p_fcChecks;
    g.y += 0.35 * kn(vec2(g.x * 0.3, g.y * 0.2) + seed);
    float row = floor(g.y);
    float ax = g.x * 0.55 + kh1(row + seed) * 5.0 + 0.4 * kn(vec2(row, g.x * 0.5));
    float dy = min(fract(g.y), 1.0 - fract(g.y));
    float dx = min(fract(ax), 1.0 - fract(ax));
    float fade = kfade(2.0 / p_fcChecks);
    // each split thin, opening and closing along its length; a cross check only here and there
    float open = smoothstep(0.3, 0.7, kn(vec2(g.x * 0.4, row * 3.1) + seed));
    float split = (1.0 - smoothstep(0.0, 0.035, dy)) * open * fade;
    float across = (1.0 - smoothstep(0.0, 0.03, dx)) * step(0.55, kh(vec2(row, floor(ax)) + seed)) * fade;
    float check = max(split, across * 0.8);
    float block = kh(vec2(row, floor(ax)) + seed + 1.3);
    // the wood's fibres and growth lines along the grain, faint
    float fib = kn(vec2(uv.x * 20.0, uv.y * 900.0) + seed) * kfade(0.002);
    // a lump glows from underneath and from its splits outward: a face turned up to the air is the coolest, one turned
    // down into the bed the hottest; its face glows whole only once it is hot right through
    float under = mix(1.15, 0.7, smoothstep(-0.3, 0.9, wn.y));
    float hb = h * mix(0.85, 1.12, block) * under;
    float face = smoothstep(0.62, 0.95, hb) * (0.7 + 0.3 * kfbm(uv * 40.0 + seed));
    float lit = max(face, check * smoothstep(0.2, 0.55, hb));
    // ash: a soft grey powder lying over the cooler tops in drifts, burnt off where hot; it fills the checks
    float drift = kfbm(uv * 15.0 + seed + 2.0) + 0.25 * kfbm(uv * 55.0 + seed + 6.0);
    float ash = smoothstep(1.15 - p_fcAsh, 1.4 - p_fcAsh, drift) * (1.0 - smoothstep(0.25, 0.7, h)) * smoothstep(-0.1, 0.7, wn.y);
    vec3 cold = vec3(0.012, 0.0115, 0.0112) * (0.8 + 0.7 * block) * (0.9 + 0.2 * fib);
    cold *= 1.0 - 0.5 * check * p_fcCheckShow;
    vec3 c = mix(cold, vec3(0.26, 0.25, 0.235) * (0.8 + 0.35 * kfbm(uv * 90.0 + seed)), ash);
    k.colour = mix(c, vec3(0.22, 0.05, 0.012), lit * (1.0 - ash));
    // a lump not yet hot through still shows a dull red under its skin where it is warm
    float ember = smoothstep(0.25, 0.6, hb) * (1.0 - lit) * (0.5 + 0.5 * kfbm(uv * 25.0 + seed + 4.0));
    k.glow = (htGlow(hb) * lit + htGlow(hb * 0.55) * ember * 0.6) * p_fcGlow * (1.0 - 0.9 * ash);
    // charcoal's sheen: a dull silver only on the cold faces' best-lit facets, gone where ash or heat is
    k.rough = mix(mix(0.5, 0.75, block), 0.97, max(ash, lit));
    k.metal = 0.25 * (1.0 - max(ash, lit));
    k.height = (-0.0012 * check * (1.0 - 0.8 * ash) + 0.0002 * (fib - 0.5));
  
}

void look_28(inout Look k) {
  p_fcHeat = texelFetch(lookSettings, ivec2(0, 28), 0).r;
  p_fcAsh = texelFetch(lookSettings, ivec2(1, 28), 0).r;
  p_fcGlow = texelFetch(lookSettings, ivec2(2, 28), 0).r;
  p_fcBreath = texelFetch(lookSettings, ivec2(3, 28), 0).r;
  p_fcFlicker = texelFetch(lookSettings, ivec2(4, 28), 0).r;
  p_fcChecks = texelFetch(lookSettings, ivec2(5, 28), 0).r;
  p_fcCheckShow = texelFetch(lookSettings, ivec2(6, 28), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float heat = clamp(s3.x * p_fcHeat, 0.0, 1.0);
    // the breath: the heat churning in place over the bed, patches a hand across, finer flickers in them
    float breath = kfbm3(vec3(uv * 6.0 + seed, kcycle(p_fcBreath) * 4.0), 4.0);
    float h = heat * mix(1.0, 0.45 + 1.1 * breath, p_fcFlicker);
    // the checking: splits along the grain, each row of blocks broken across at its own places, the lines wandering
    vec2 g = uv * p_fcChecks;
    g.y += 0.35 * kn(vec2(g.x * 0.3, g.y * 0.2) + seed);
    float row = floor(g.y);
    float ax = g.x * 0.55 + kh1(row + seed) * 5.0 + 0.4 * kn(vec2(row, g.x * 0.5));
    float dy = min(fract(g.y), 1.0 - fract(g.y));
    float dx = min(fract(ax), 1.0 - fract(ax));
    float fade = kfade(2.0 / p_fcChecks);
    // each split thin, opening and closing along its length; a cross check only here and there
    float open = smoothstep(0.3, 0.7, kn(vec2(g.x * 0.4, row * 3.1) + seed));
    float split = (1.0 - smoothstep(0.0, 0.035, dy)) * open * fade;
    float across = (1.0 - smoothstep(0.0, 0.03, dx)) * step(0.55, kh(vec2(row, floor(ax)) + seed)) * fade;
    float check = max(split, across * 0.8);
    float block = kh(vec2(row, floor(ax)) + seed + 1.3);
    // the wood's fibres and growth lines along the grain, faint
    float fib = kn(vec2(uv.x * 20.0, uv.y * 900.0) + seed) * kfade(0.002);
    // a lump glows from underneath and from its splits outward: a face turned up to the air is the coolest, one turned
    // down into the bed the hottest; its face glows whole only once it is hot right through
    float under = mix(1.15, 0.7, smoothstep(-0.3, 0.9, wn.y));
    float hb = h * mix(0.85, 1.12, block) * under;
    float face = smoothstep(0.62, 0.95, hb) * (0.7 + 0.3 * kfbm(uv * 40.0 + seed));
    float lit = max(face, check * smoothstep(0.2, 0.55, hb));
    // ash: a soft grey powder lying over the cooler tops in drifts, burnt off where hot; it fills the checks
    float drift = kfbm(uv * 15.0 + seed + 2.0) + 0.25 * kfbm(uv * 55.0 + seed + 6.0);
    float ash = smoothstep(1.15 - p_fcAsh, 1.4 - p_fcAsh, drift) * (1.0 - smoothstep(0.25, 0.7, h)) * smoothstep(-0.1, 0.7, wn.y);
    vec3 cold = vec3(0.012, 0.0115, 0.0112) * (0.8 + 0.7 * block) * (0.9 + 0.2 * fib);
    cold *= 1.0 - 0.5 * check * p_fcCheckShow;
    vec3 c = mix(cold, vec3(0.26, 0.25, 0.235) * (0.8 + 0.35 * kfbm(uv * 90.0 + seed)), ash);
    k.colour = mix(c, vec3(0.22, 0.05, 0.012), lit * (1.0 - ash));
    // a lump not yet hot through still shows a dull red under its skin where it is warm
    float ember = smoothstep(0.25, 0.6, hb) * (1.0 - lit) * (0.5 + 0.5 * kfbm(uv * 25.0 + seed + 4.0));
    k.glow = (htGlow(hb) * lit + htGlow(hb * 0.55) * ember * 0.6) * p_fcGlow * (1.0 - 0.9 * ash);
    // charcoal's sheen: a dull silver only on the cold faces' best-lit facets, gone where ash or heat is
    k.rough = mix(mix(0.5, 0.75, block), 0.97, max(ash, lit));
    k.metal = 0.25 * (1.0 - max(ash, lit));
    k.height = (-0.0012 * check * (1.0 - 0.8 * ash) + 0.0002 * (fib - 0.5));
  
}

void look_29(inout Look k) {
  p_ssRow = texelFetch(lookSettings, ivec2(0, 29), 0).r;
  p_ssLong = texelFetch(lookSettings, ivec2(1, 29), 0).r;
  p_ssJitter = texelFetch(lookSettings, ivec2(2, 29), 0).r;
  p_ssJoint = texelFetch(lookSettings, ivec2(3, 29), 0).r;
  p_ssWorld = texelFetch(lookSettings, ivec2(4, 29), 0).r;
  p_ssPillow = texelFetch(lookSettings, ivec2(5, 29), 0).r;
  p_ssPitch = texelFetch(lookSettings, ivec2(6, 29), 0).r;
  p_ssTool = texelFetch(lookSettings, ivec2(7, 29), 0).r;
  p_ssA = texelFetch(lookSettings, ivec2(8, 29), 0).rgb;
  p_ssB = texelFetch(lookSettings, ivec2(9, 29), 0).rgb;
  p_ssMortar = texelFetch(lookSettings, ivec2(10, 29), 0).rgb;
  p_ssGrain = texelFetch(lookSettings, ivec2(11, 29), 0).r;
  p_ssSpeck = texelFetch(lookSettings, ivec2(12, 29), 0).r;
  p_ssIron = texelFetch(lookSettings, ivec2(13, 29), 0).r;
  p_ssSoot = texelFetch(lookSettings, ivec2(14, 29), 0).r;
  p_ssHeat = texelFetch(lookSettings, ivec2(15, 29), 0).r;
  p_ssRough = texelFetch(lookSettings, ivec2(16, 29), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec2 q = p_ssWorld > 0.5 ? ssPlace(wp, normalize(wn)) : uv;
    // the bond: one for the whole world, so a part's courses meet its neighbour's
    vec2 id = vec2(0.0);
    float bed = 1.0, stone = 1.0, ex = 1.0;
    vec3 sc = p_ssA;
    float own = kh(seed + vec2(3.1, 7.7));
    if (p_ssJoint > 0.0) {
      vec4 c = kcourse(q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id);
      // the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble
      float jx = min(c.x, 1.0 - c.x) * c.w, jy = min(c.y, 1.0 - c.y) * p_ssRow;
      float chip = (kfbm(q * 9.0 + id * 5.3) - 0.5) * p_ssJoint * 0.8;
      ex = min(jx, jy) + chip;
      // the joint's edge softened by the pixel's own size, so it never breaks into dashes far off
      float aa = max(length(lookGx) + length(lookGy), 0.0015);
      stone = smoothstep(p_ssJoint * 0.5 - aa, p_ssJoint * 0.5 + aa, ex);
      // the face bulges toward its middle, flattening, so its edges roll down to the joint
      bed = smoothstep(0.0, 0.05, ex) * (0.6 + 0.4 * kfbm(q * 5.0 + id * 2.1));
      own = kh(id + 2.3);
    }
    // each stone its shade between the two it is cut from, a few darker or warmer
    float h2 = kh(id + 8.1), h3 = kh(id + 4.4);
    sc = mix(p_ssA, p_ssB, own) * (0.9 + 0.18 * h2);
    if (h3 < 0.08) sc *= vec3(1.05, 0.98, 0.9);
    // pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it
    float facet = kfbm(q * 9.0 + id * 3.7);
    float cloud = kfbm(q * 2.3 + id * 1.9 + 4.0);
    float grain = kn(q * p_ssGrain + id * 13.0) * kfade(2.0 / p_ssGrain);
    float speck = smoothstep(0.78, 0.92, kn(q * p_ssGrain * 0.6 + id * 7.0 + 3.0)) * kfade(3.0 / p_ssGrain);
    sc *= (0.82 + 0.36 * cloud) * (1.0 + (grain - 0.5) * 0.18 * p_ssSpeck) * (1.0 - 0.35 * speck * p_ssSpeck);
    // iron bands through the odd stone: rust brown, wandering across it
    float band = smoothstep(0.55, 0.9, kfbm(vec2(q.x * 1.2, q.y * 5.0) + id * 2.0 + 9.0)) * step(0.72, kh(id + 6.6));
    sc = mix(sc, sc * vec3(1.25, 0.82, 0.55), band * p_ssIron);
    // the mortar: lime, gritty, back in the joint
    // the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant
    float trow = floor(q.y / 0.07);
    float tdir = kh1(trow + 3.0) > 0.5 ? 1.0 : -1.0;
    float tl = fract((q.x + tdir * (q.y - trow * 0.07)) * 45.0 + kh1(trow) * 9.0);
    float tool = (1.0 - smoothstep(0.0, 0.25, min(tl, 1.0 - tl))) * smoothstep(0.3, 0.6, kn(q * 12.0 + trow)) * p_ssTool * kfade(0.006);
    sc *= 1.0 - 0.18 * tool;
    vec3 mc = p_ssMortar * (0.85 + 0.25 * kn(q * 140.0 + 2.0) * kfade(0.006)) * (0.9 + 0.2 * cloud);
    vec3 col = mix(mc, sc, stone);
    float ht = stone * (p_ssPillow * bed * (0.75 + 0.5 * h2) + 0.004 * p_ssPitch * (facet - 0.5)) - (1.0 - stone) * 0.006 - 0.0006 * tool;

    // the fire's heat: reddened, then crazed and flaking pale where hottest
    float heat = clamp(s0.y * p_ssHeat, 0.0, 1.0);
    if (heat > 0.0) {
      // a few fine wandering cracks, only where the stone is hottest, never a net of cells
      float cn = kfbm(q * 7.0 + id * 3.3 + 2.0);
      float craze = (1.0 - smoothstep(0.0, 0.012, abs(cn - 0.5))) * smoothstep(0.55, 0.9, heat)
        * smoothstep(0.4, 0.6, kn(q * 3.0 + id)) * kfade(0.008);
      col = mix(col, col * vec3(1.3, 0.8, 0.6), smoothstep(0.0, 0.6, heat) * 0.8);
      float flake = smoothstep(0.55, 0.75, kfbm(q * 6.0 + id + 1.0)) * smoothstep(0.5, 1.0, heat);
      col = mix(col, vec3(0.5, 0.46, 0.42), flake * 0.6);
      col *= 1.0 - 0.6 * craze;
      ht -= 0.002 * craze;
    }
    // soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick
    float soot = clamp(s0.x * p_ssSoot, 0.0, 1.0);
    float patchy = kfbm(q * 3.1 + 21.0);
    float s = smoothstep(0.0, 1.0, soot * 1.5 - 0.35 * patchy + (1.0 - stone) * 0.35 + (0.5 - facet) * 0.25);
    vec3 sootC = vec3(0.022, 0.019, 0.017) * (0.8 + 0.5 * patchy);
    col = mix(col, sootC, s * 0.96);
    // wet: darker and glossy
    float wet = clamp(s0.z, 0.0, 1.0);
    col *= 1.0 - 0.45 * wet;
    k.colour = col;
    k.rough = mix(mix(p_ssRough, 0.97, 1.0 - stone), 0.55, max(s * smoothstep(0.7, 1.0, soot) * 0.6, wet * 0.75));
    k.height = ht;
    k.ao = mix(0.55, 1.0, stone);
  
}

void look_30(inout Look k) {
  p_ssRow = texelFetch(lookSettings, ivec2(0, 30), 0).r;
  p_ssLong = texelFetch(lookSettings, ivec2(1, 30), 0).r;
  p_ssJitter = texelFetch(lookSettings, ivec2(2, 30), 0).r;
  p_ssJoint = texelFetch(lookSettings, ivec2(3, 30), 0).r;
  p_ssWorld = texelFetch(lookSettings, ivec2(4, 30), 0).r;
  p_ssPillow = texelFetch(lookSettings, ivec2(5, 30), 0).r;
  p_ssPitch = texelFetch(lookSettings, ivec2(6, 30), 0).r;
  p_ssTool = texelFetch(lookSettings, ivec2(7, 30), 0).r;
  p_ssA = texelFetch(lookSettings, ivec2(8, 30), 0).rgb;
  p_ssB = texelFetch(lookSettings, ivec2(9, 30), 0).rgb;
  p_ssMortar = texelFetch(lookSettings, ivec2(10, 30), 0).rgb;
  p_ssGrain = texelFetch(lookSettings, ivec2(11, 30), 0).r;
  p_ssSpeck = texelFetch(lookSettings, ivec2(12, 30), 0).r;
  p_ssIron = texelFetch(lookSettings, ivec2(13, 30), 0).r;
  p_ssSoot = texelFetch(lookSettings, ivec2(14, 30), 0).r;
  p_ssHeat = texelFetch(lookSettings, ivec2(15, 30), 0).r;
  p_ssRough = texelFetch(lookSettings, ivec2(16, 30), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec2 q = p_ssWorld > 0.5 ? ssPlace(wp, normalize(wn)) : uv;
    // the bond: one for the whole world, so a part's courses meet its neighbour's
    vec2 id = vec2(0.0);
    float bed = 1.0, stone = 1.0, ex = 1.0;
    vec3 sc = p_ssA;
    float own = kh(seed + vec2(3.1, 7.7));
    if (p_ssJoint > 0.0) {
      vec4 c = kcourse(q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id);
      // the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble
      float jx = min(c.x, 1.0 - c.x) * c.w, jy = min(c.y, 1.0 - c.y) * p_ssRow;
      float chip = (kfbm(q * 9.0 + id * 5.3) - 0.5) * p_ssJoint * 0.8;
      ex = min(jx, jy) + chip;
      // the joint's edge softened by the pixel's own size, so it never breaks into dashes far off
      float aa = max(length(lookGx) + length(lookGy), 0.0015);
      stone = smoothstep(p_ssJoint * 0.5 - aa, p_ssJoint * 0.5 + aa, ex);
      // the face bulges toward its middle, flattening, so its edges roll down to the joint
      bed = smoothstep(0.0, 0.05, ex) * (0.6 + 0.4 * kfbm(q * 5.0 + id * 2.1));
      own = kh(id + 2.3);
    }
    // each stone its shade between the two it is cut from, a few darker or warmer
    float h2 = kh(id + 8.1), h3 = kh(id + 4.4);
    sc = mix(p_ssA, p_ssB, own) * (0.9 + 0.18 * h2);
    if (h3 < 0.08) sc *= vec3(1.05, 0.98, 0.9);
    // pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it
    float facet = kfbm(q * 9.0 + id * 3.7);
    float cloud = kfbm(q * 2.3 + id * 1.9 + 4.0);
    float grain = kn(q * p_ssGrain + id * 13.0) * kfade(2.0 / p_ssGrain);
    float speck = smoothstep(0.78, 0.92, kn(q * p_ssGrain * 0.6 + id * 7.0 + 3.0)) * kfade(3.0 / p_ssGrain);
    sc *= (0.82 + 0.36 * cloud) * (1.0 + (grain - 0.5) * 0.18 * p_ssSpeck) * (1.0 - 0.35 * speck * p_ssSpeck);
    // iron bands through the odd stone: rust brown, wandering across it
    float band = smoothstep(0.55, 0.9, kfbm(vec2(q.x * 1.2, q.y * 5.0) + id * 2.0 + 9.0)) * step(0.72, kh(id + 6.6));
    sc = mix(sc, sc * vec3(1.25, 0.82, 0.55), band * p_ssIron);
    // the mortar: lime, gritty, back in the joint
    // the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant
    float trow = floor(q.y / 0.07);
    float tdir = kh1(trow + 3.0) > 0.5 ? 1.0 : -1.0;
    float tl = fract((q.x + tdir * (q.y - trow * 0.07)) * 45.0 + kh1(trow) * 9.0);
    float tool = (1.0 - smoothstep(0.0, 0.25, min(tl, 1.0 - tl))) * smoothstep(0.3, 0.6, kn(q * 12.0 + trow)) * p_ssTool * kfade(0.006);
    sc *= 1.0 - 0.18 * tool;
    vec3 mc = p_ssMortar * (0.85 + 0.25 * kn(q * 140.0 + 2.0) * kfade(0.006)) * (0.9 + 0.2 * cloud);
    vec3 col = mix(mc, sc, stone);
    float ht = stone * (p_ssPillow * bed * (0.75 + 0.5 * h2) + 0.004 * p_ssPitch * (facet - 0.5)) - (1.0 - stone) * 0.006 - 0.0006 * tool;

    // the fire's heat: reddened, then crazed and flaking pale where hottest
    float heat = clamp(s0.y * p_ssHeat, 0.0, 1.0);
    if (heat > 0.0) {
      // a few fine wandering cracks, only where the stone is hottest, never a net of cells
      float cn = kfbm(q * 7.0 + id * 3.3 + 2.0);
      float craze = (1.0 - smoothstep(0.0, 0.012, abs(cn - 0.5))) * smoothstep(0.55, 0.9, heat)
        * smoothstep(0.4, 0.6, kn(q * 3.0 + id)) * kfade(0.008);
      col = mix(col, col * vec3(1.3, 0.8, 0.6), smoothstep(0.0, 0.6, heat) * 0.8);
      float flake = smoothstep(0.55, 0.75, kfbm(q * 6.0 + id + 1.0)) * smoothstep(0.5, 1.0, heat);
      col = mix(col, vec3(0.5, 0.46, 0.42), flake * 0.6);
      col *= 1.0 - 0.6 * craze;
      ht -= 0.002 * craze;
    }
    // soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick
    float soot = clamp(s0.x * p_ssSoot, 0.0, 1.0);
    float patchy = kfbm(q * 3.1 + 21.0);
    float s = smoothstep(0.0, 1.0, soot * 1.5 - 0.35 * patchy + (1.0 - stone) * 0.35 + (0.5 - facet) * 0.25);
    vec3 sootC = vec3(0.022, 0.019, 0.017) * (0.8 + 0.5 * patchy);
    col = mix(col, sootC, s * 0.96);
    // wet: darker and glossy
    float wet = clamp(s0.z, 0.0, 1.0);
    col *= 1.0 - 0.45 * wet;
    k.colour = col;
    k.rough = mix(mix(p_ssRough, 0.97, 1.0 - stone), 0.55, max(s * smoothstep(0.7, 1.0, soot) * 0.6, wet * 0.75));
    k.height = ht;
    k.ao = mix(0.55, 1.0, stone);
  
}

void look_31(inout Look k) {
  p_ssRow = texelFetch(lookSettings, ivec2(0, 31), 0).r;
  p_ssLong = texelFetch(lookSettings, ivec2(1, 31), 0).r;
  p_ssJitter = texelFetch(lookSettings, ivec2(2, 31), 0).r;
  p_ssJoint = texelFetch(lookSettings, ivec2(3, 31), 0).r;
  p_ssWorld = texelFetch(lookSettings, ivec2(4, 31), 0).r;
  p_ssPillow = texelFetch(lookSettings, ivec2(5, 31), 0).r;
  p_ssPitch = texelFetch(lookSettings, ivec2(6, 31), 0).r;
  p_ssTool = texelFetch(lookSettings, ivec2(7, 31), 0).r;
  p_ssA = texelFetch(lookSettings, ivec2(8, 31), 0).rgb;
  p_ssB = texelFetch(lookSettings, ivec2(9, 31), 0).rgb;
  p_ssMortar = texelFetch(lookSettings, ivec2(10, 31), 0).rgb;
  p_ssGrain = texelFetch(lookSettings, ivec2(11, 31), 0).r;
  p_ssSpeck = texelFetch(lookSettings, ivec2(12, 31), 0).r;
  p_ssIron = texelFetch(lookSettings, ivec2(13, 31), 0).r;
  p_ssSoot = texelFetch(lookSettings, ivec2(14, 31), 0).r;
  p_ssHeat = texelFetch(lookSettings, ivec2(15, 31), 0).r;
  p_ssRough = texelFetch(lookSettings, ivec2(16, 31), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec2 q = p_ssWorld > 0.5 ? ssPlace(wp, normalize(wn)) : uv;
    // the bond: one for the whole world, so a part's courses meet its neighbour's
    vec2 id = vec2(0.0);
    float bed = 1.0, stone = 1.0, ex = 1.0;
    vec3 sc = p_ssA;
    float own = kh(seed + vec2(3.1, 7.7));
    if (p_ssJoint > 0.0) {
      vec4 c = kcourse(q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id);
      // the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble
      float jx = min(c.x, 1.0 - c.x) * c.w, jy = min(c.y, 1.0 - c.y) * p_ssRow;
      float chip = (kfbm(q * 9.0 + id * 5.3) - 0.5) * p_ssJoint * 0.8;
      ex = min(jx, jy) + chip;
      // the joint's edge softened by the pixel's own size, so it never breaks into dashes far off
      float aa = max(length(lookGx) + length(lookGy), 0.0015);
      stone = smoothstep(p_ssJoint * 0.5 - aa, p_ssJoint * 0.5 + aa, ex);
      // the face bulges toward its middle, flattening, so its edges roll down to the joint
      bed = smoothstep(0.0, 0.05, ex) * (0.6 + 0.4 * kfbm(q * 5.0 + id * 2.1));
      own = kh(id + 2.3);
    }
    // each stone its shade between the two it is cut from, a few darker or warmer
    float h2 = kh(id + 8.1), h3 = kh(id + 4.4);
    sc = mix(p_ssA, p_ssB, own) * (0.9 + 0.18 * h2);
    if (h3 < 0.08) sc *= vec3(1.05, 0.98, 0.9);
    // pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it
    float facet = kfbm(q * 9.0 + id * 3.7);
    float cloud = kfbm(q * 2.3 + id * 1.9 + 4.0);
    float grain = kn(q * p_ssGrain + id * 13.0) * kfade(2.0 / p_ssGrain);
    float speck = smoothstep(0.78, 0.92, kn(q * p_ssGrain * 0.6 + id * 7.0 + 3.0)) * kfade(3.0 / p_ssGrain);
    sc *= (0.82 + 0.36 * cloud) * (1.0 + (grain - 0.5) * 0.18 * p_ssSpeck) * (1.0 - 0.35 * speck * p_ssSpeck);
    // iron bands through the odd stone: rust brown, wandering across it
    float band = smoothstep(0.55, 0.9, kfbm(vec2(q.x * 1.2, q.y * 5.0) + id * 2.0 + 9.0)) * step(0.72, kh(id + 6.6));
    sc = mix(sc, sc * vec3(1.25, 0.82, 0.55), band * p_ssIron);
    // the mortar: lime, gritty, back in the joint
    // the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant
    float trow = floor(q.y / 0.07);
    float tdir = kh1(trow + 3.0) > 0.5 ? 1.0 : -1.0;
    float tl = fract((q.x + tdir * (q.y - trow * 0.07)) * 45.0 + kh1(trow) * 9.0);
    float tool = (1.0 - smoothstep(0.0, 0.25, min(tl, 1.0 - tl))) * smoothstep(0.3, 0.6, kn(q * 12.0 + trow)) * p_ssTool * kfade(0.006);
    sc *= 1.0 - 0.18 * tool;
    vec3 mc = p_ssMortar * (0.85 + 0.25 * kn(q * 140.0 + 2.0) * kfade(0.006)) * (0.9 + 0.2 * cloud);
    vec3 col = mix(mc, sc, stone);
    float ht = stone * (p_ssPillow * bed * (0.75 + 0.5 * h2) + 0.004 * p_ssPitch * (facet - 0.5)) - (1.0 - stone) * 0.006 - 0.0006 * tool;

    // the fire's heat: reddened, then crazed and flaking pale where hottest
    float heat = clamp(s0.y * p_ssHeat, 0.0, 1.0);
    if (heat > 0.0) {
      // a few fine wandering cracks, only where the stone is hottest, never a net of cells
      float cn = kfbm(q * 7.0 + id * 3.3 + 2.0);
      float craze = (1.0 - smoothstep(0.0, 0.012, abs(cn - 0.5))) * smoothstep(0.55, 0.9, heat)
        * smoothstep(0.4, 0.6, kn(q * 3.0 + id)) * kfade(0.008);
      col = mix(col, col * vec3(1.3, 0.8, 0.6), smoothstep(0.0, 0.6, heat) * 0.8);
      float flake = smoothstep(0.55, 0.75, kfbm(q * 6.0 + id + 1.0)) * smoothstep(0.5, 1.0, heat);
      col = mix(col, vec3(0.5, 0.46, 0.42), flake * 0.6);
      col *= 1.0 - 0.6 * craze;
      ht -= 0.002 * craze;
    }
    // soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick
    float soot = clamp(s0.x * p_ssSoot, 0.0, 1.0);
    float patchy = kfbm(q * 3.1 + 21.0);
    float s = smoothstep(0.0, 1.0, soot * 1.5 - 0.35 * patchy + (1.0 - stone) * 0.35 + (0.5 - facet) * 0.25);
    vec3 sootC = vec3(0.022, 0.019, 0.017) * (0.8 + 0.5 * patchy);
    col = mix(col, sootC, s * 0.96);
    // wet: darker and glossy
    float wet = clamp(s0.z, 0.0, 1.0);
    col *= 1.0 - 0.45 * wet;
    k.colour = col;
    k.rough = mix(mix(p_ssRough, 0.97, 1.0 - stone), 0.55, max(s * smoothstep(0.7, 1.0, soot) * 0.6, wet * 0.75));
    k.height = ht;
    k.ao = mix(0.55, 1.0, stone);
  
}

void look_32(inout Look k) {
  p_ssRow = texelFetch(lookSettings, ivec2(0, 32), 0).r;
  p_ssLong = texelFetch(lookSettings, ivec2(1, 32), 0).r;
  p_ssJitter = texelFetch(lookSettings, ivec2(2, 32), 0).r;
  p_ssJoint = texelFetch(lookSettings, ivec2(3, 32), 0).r;
  p_ssWorld = texelFetch(lookSettings, ivec2(4, 32), 0).r;
  p_ssPillow = texelFetch(lookSettings, ivec2(5, 32), 0).r;
  p_ssPitch = texelFetch(lookSettings, ivec2(6, 32), 0).r;
  p_ssTool = texelFetch(lookSettings, ivec2(7, 32), 0).r;
  p_ssA = texelFetch(lookSettings, ivec2(8, 32), 0).rgb;
  p_ssB = texelFetch(lookSettings, ivec2(9, 32), 0).rgb;
  p_ssMortar = texelFetch(lookSettings, ivec2(10, 32), 0).rgb;
  p_ssGrain = texelFetch(lookSettings, ivec2(11, 32), 0).r;
  p_ssSpeck = texelFetch(lookSettings, ivec2(12, 32), 0).r;
  p_ssIron = texelFetch(lookSettings, ivec2(13, 32), 0).r;
  p_ssSoot = texelFetch(lookSettings, ivec2(14, 32), 0).r;
  p_ssHeat = texelFetch(lookSettings, ivec2(15, 32), 0).r;
  p_ssRough = texelFetch(lookSettings, ivec2(16, 32), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec2 q = p_ssWorld > 0.5 ? ssPlace(wp, normalize(wn)) : uv;
    // the bond: one for the whole world, so a part's courses meet its neighbour's
    vec2 id = vec2(0.0);
    float bed = 1.0, stone = 1.0, ex = 1.0;
    vec3 sc = p_ssA;
    float own = kh(seed + vec2(3.1, 7.7));
    if (p_ssJoint > 0.0) {
      vec4 c = kcourse(q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id);
      // the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble
      float jx = min(c.x, 1.0 - c.x) * c.w, jy = min(c.y, 1.0 - c.y) * p_ssRow;
      float chip = (kfbm(q * 9.0 + id * 5.3) - 0.5) * p_ssJoint * 0.8;
      ex = min(jx, jy) + chip;
      // the joint's edge softened by the pixel's own size, so it never breaks into dashes far off
      float aa = max(length(lookGx) + length(lookGy), 0.0015);
      stone = smoothstep(p_ssJoint * 0.5 - aa, p_ssJoint * 0.5 + aa, ex);
      // the face bulges toward its middle, flattening, so its edges roll down to the joint
      bed = smoothstep(0.0, 0.05, ex) * (0.6 + 0.4 * kfbm(q * 5.0 + id * 2.1));
      own = kh(id + 2.3);
    }
    // each stone its shade between the two it is cut from, a few darker or warmer
    float h2 = kh(id + 8.1), h3 = kh(id + 4.4);
    sc = mix(p_ssA, p_ssB, own) * (0.9 + 0.18 * h2);
    if (h3 < 0.08) sc *= vec3(1.05, 0.98, 0.9);
    // pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it
    float facet = kfbm(q * 9.0 + id * 3.7);
    float cloud = kfbm(q * 2.3 + id * 1.9 + 4.0);
    float grain = kn(q * p_ssGrain + id * 13.0) * kfade(2.0 / p_ssGrain);
    float speck = smoothstep(0.78, 0.92, kn(q * p_ssGrain * 0.6 + id * 7.0 + 3.0)) * kfade(3.0 / p_ssGrain);
    sc *= (0.82 + 0.36 * cloud) * (1.0 + (grain - 0.5) * 0.18 * p_ssSpeck) * (1.0 - 0.35 * speck * p_ssSpeck);
    // iron bands through the odd stone: rust brown, wandering across it
    float band = smoothstep(0.55, 0.9, kfbm(vec2(q.x * 1.2, q.y * 5.0) + id * 2.0 + 9.0)) * step(0.72, kh(id + 6.6));
    sc = mix(sc, sc * vec3(1.25, 0.82, 0.55), band * p_ssIron);
    // the mortar: lime, gritty, back in the joint
    // the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant
    float trow = floor(q.y / 0.07);
    float tdir = kh1(trow + 3.0) > 0.5 ? 1.0 : -1.0;
    float tl = fract((q.x + tdir * (q.y - trow * 0.07)) * 45.0 + kh1(trow) * 9.0);
    float tool = (1.0 - smoothstep(0.0, 0.25, min(tl, 1.0 - tl))) * smoothstep(0.3, 0.6, kn(q * 12.0 + trow)) * p_ssTool * kfade(0.006);
    sc *= 1.0 - 0.18 * tool;
    vec3 mc = p_ssMortar * (0.85 + 0.25 * kn(q * 140.0 + 2.0) * kfade(0.006)) * (0.9 + 0.2 * cloud);
    vec3 col = mix(mc, sc, stone);
    float ht = stone * (p_ssPillow * bed * (0.75 + 0.5 * h2) + 0.004 * p_ssPitch * (facet - 0.5)) - (1.0 - stone) * 0.006 - 0.0006 * tool;

    // the fire's heat: reddened, then crazed and flaking pale where hottest
    float heat = clamp(s0.y * p_ssHeat, 0.0, 1.0);
    if (heat > 0.0) {
      // a few fine wandering cracks, only where the stone is hottest, never a net of cells
      float cn = kfbm(q * 7.0 + id * 3.3 + 2.0);
      float craze = (1.0 - smoothstep(0.0, 0.012, abs(cn - 0.5))) * smoothstep(0.55, 0.9, heat)
        * smoothstep(0.4, 0.6, kn(q * 3.0 + id)) * kfade(0.008);
      col = mix(col, col * vec3(1.3, 0.8, 0.6), smoothstep(0.0, 0.6, heat) * 0.8);
      float flake = smoothstep(0.55, 0.75, kfbm(q * 6.0 + id + 1.0)) * smoothstep(0.5, 1.0, heat);
      col = mix(col, vec3(0.5, 0.46, 0.42), flake * 0.6);
      col *= 1.0 - 0.6 * craze;
      ht -= 0.002 * craze;
    }
    // soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick
    float soot = clamp(s0.x * p_ssSoot, 0.0, 1.0);
    float patchy = kfbm(q * 3.1 + 21.0);
    float s = smoothstep(0.0, 1.0, soot * 1.5 - 0.35 * patchy + (1.0 - stone) * 0.35 + (0.5 - facet) * 0.25);
    vec3 sootC = vec3(0.022, 0.019, 0.017) * (0.8 + 0.5 * patchy);
    col = mix(col, sootC, s * 0.96);
    // wet: darker and glossy
    float wet = clamp(s0.z, 0.0, 1.0);
    col *= 1.0 - 0.45 * wet;
    k.colour = col;
    k.rough = mix(mix(p_ssRough, 0.97, 1.0 - stone), 0.55, max(s * smoothstep(0.7, 1.0, soot) * 0.6, wet * 0.75));
    k.height = ht;
    k.ao = mix(0.55, 1.0, stone);
  
}

void look_33(inout Look k) {
  p_soLight = texelFetch(lookSettings, ivec2(0, 33), 0).rgb;
  p_soDark = texelFetch(lookSettings, ivec2(1, 33), 0).rgb;
  p_soAge = texelFetch(lookSettings, ivec2(2, 33), 0).r;
  p_soRings = texelFetch(lookSettings, ivec2(3, 33), 0).r;
  p_soEndRings = texelFetch(lookSettings, ivec2(4, 33), 0).r;
  p_soAdzeLen = texelFetch(lookSettings, ivec2(5, 33), 0).r;
  p_soAdze = texelFetch(lookSettings, ivec2(6, 33), 0).r;
  p_soChecks = texelFetch(lookSettings, ivec2(7, 33), 0).r;
  p_soSoot = texelFetch(lookSettings, ivec2(8, 33), 0).r;
  p_soRough = texelFetch(lookSettings, ivec2(9, 33), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // grain: rings wandering across, fibres along
    float ring = kring(uv * vec2(1.0, p_soRings / 9.0), seed, 9.0) * (0.45 + 0.55 * kfbm(uv * vec2(0.8, 6.0) + seed + 1.0));
    float fib = kfibre(uv, seed);
    float cloud = kfbm(vec2(uv.x * 1.3, uv.y * 4.0) + seed + 3.0);
    // the grain's long streaks: dark and light runs along u, wandering slowly, so it reads as wood and never as stripes
    float streak = kfbm(vec2(uv.x * 0.7, uv.y * 22.0) + seed + 4.0) * 0.7 + 0.3 * kfbm(vec2(uv.x * 2.0, uv.y * 90.0) + seed);
    vec3 col = mix(p_soLight, p_soDark, ring * 0.16 + 0.4 * streak) * (0.9 + 0.2 * cloud) * (0.94 + 0.12 * fib);
    // age: a silver grey laid over the brown, deepest on the open faces, the rings left darker under it
    vec3 grey = vec3(0.30, 0.285, 0.26) * (0.85 + 0.25 * cloud);
    col = mix(col, grey * (1.0 - 0.35 * ring), p_soAge * (0.6 + 0.4 * kfbm(uv * 2.0 + seed)));
    // the adze: shallow scallops across the grain, each stroke its own length, its edge wandering, the face between them
    // left flat in places where a stroke took off less
    float su = uv.x / p_soAdzeLen + 0.35 * kn(vec2(uv.x * 4.0, uv.y * 9.0) + seed + 2.0) + kh1(seed) * 7.0;
    float f = fract(su);
    float strokeAmt = 0.4 + 0.6 * kh(vec2(floor(su), seed + 3.0));
    float scallop = (f * (1.0 - f)) * 4.0;
    float adze = (scallop - 0.66) * p_soAdze * strokeAmt * kfade(p_soAdzeLen * 0.4);
    // the stroke's lip: a faint ridge where two scallops meet
    float lip = (1.0 - smoothstep(0.0, 0.05, min(f, 1.0 - f))) * strokeAmt * kfade(0.01) * step(1e-6, p_soAdze);
    col *= 1.0 + 0.015 * lip;
    // checks: a few long dark splits along the grain
    float cy = uv.y * 7.0 + kfbm(vec2(uv.x * 0.6, uv.y) + seed + 9.0) * 1.4;
    float crack = pow(1.0 - abs(2.0 * fract(cy) - 1.0), 60.0) * step(0.55, kh(vec2(floor(cy), seed)))
      * smoothstep(0.35, 0.6, kfbm(vec2(uv.x * 2.2, floor(cy)) + seed)) * p_soChecks * kfade(0.004);
    col *= 1.0 - 0.75 * crack;
    // a sawn end: the rings round the pith, wandering a little, the splits opening out from the pith, the saw's kerf
    float endg = step(0.5, s0.z);
    if (endg > 0.5) {
      float r = length(s1.xy);
      float ang = atan(s1.y, s1.x);
      float wob = 0.004 * kn(vec2(ang * 3.0, r * 20.0) + seed);
      float er = fract((r + wob) * p_soEndRings);
      float late = smoothstep(0.55, 0.95, er) * kfade(0.6 / p_soEndRings);
      vec3 sap = mix(p_soLight * 1.15, p_soDark, late * 0.6);
      // the splits: a few dark lines out from the pith, each its own angle, widening outward
      float split = 0.0;
      for (int i = 0; i < 4; i++) {
        float a = kh1(seed + float(i) * 3.7) * 6.28318;
        float d = abs(sin(ang - a)) * r;
        split = max(split, (1.0 - smoothstep(0.0, 0.0015 + r * 0.012, d)) * step(0.0, cos(ang - a)) * smoothstep(0.02, 0.06, r));
      }
      float saw = kn(vec2(dot(s1.xy, vec2(0.8, 0.6)) * 400.0, 0.0) + seed) * kfade(0.003);
      col = mix(sap * (0.9 + 0.15 * saw), grey * 0.9, p_soAge * 0.5) * (1.0 - 0.7 * split * p_soChecks);
      adze = 0.0;
      crack = split;
    }
    // soot: browning the wood toward a tarry black, deepest in the scallops' hollows
    float soot = clamp(s0.x * p_soSoot, 0.0, 1.0);
    // (the hollows only where the adze cut them: a timber with no adze has no rows of soot)
    float hollow = p_soAdze > 0.0 ? (0.66 - scallop) * 0.3 * kfade(p_soAdzeLen * 0.4) : 0.0;
    float s = smoothstep(0.0, 1.0, soot * 1.35 - 0.3 * kfbm(uv * 3.0 + seed + 5.0) + hollow);
    col = mix(col, vec3(0.03, 0.022, 0.016) * (0.8 + 0.4 * cloud), s * 0.92);
    // wear: hands polish it dark and smooth
    float wear = clamp(s0.y, 0.0, 1.0);
    col = mix(col, col * vec3(0.7, 0.62, 0.55), wear * 0.6);
    k.colour = col;
    k.rough = mix(mix(p_soRough, 0.6, s * soot), 0.45, wear);
    k.height = adze * (1.0 - wear * 0.8) - 0.0015 * crack + 0.0003 * (fib - 0.5) - 0.0004 * ring;
  
}

void look_34(inout Look k) {
  p_soLight = texelFetch(lookSettings, ivec2(0, 34), 0).rgb;
  p_soDark = texelFetch(lookSettings, ivec2(1, 34), 0).rgb;
  p_soAge = texelFetch(lookSettings, ivec2(2, 34), 0).r;
  p_soRings = texelFetch(lookSettings, ivec2(3, 34), 0).r;
  p_soEndRings = texelFetch(lookSettings, ivec2(4, 34), 0).r;
  p_soAdzeLen = texelFetch(lookSettings, ivec2(5, 34), 0).r;
  p_soAdze = texelFetch(lookSettings, ivec2(6, 34), 0).r;
  p_soChecks = texelFetch(lookSettings, ivec2(7, 34), 0).r;
  p_soSoot = texelFetch(lookSettings, ivec2(8, 34), 0).r;
  p_soRough = texelFetch(lookSettings, ivec2(9, 34), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // grain: rings wandering across, fibres along
    float ring = kring(uv * vec2(1.0, p_soRings / 9.0), seed, 9.0) * (0.45 + 0.55 * kfbm(uv * vec2(0.8, 6.0) + seed + 1.0));
    float fib = kfibre(uv, seed);
    float cloud = kfbm(vec2(uv.x * 1.3, uv.y * 4.0) + seed + 3.0);
    // the grain's long streaks: dark and light runs along u, wandering slowly, so it reads as wood and never as stripes
    float streak = kfbm(vec2(uv.x * 0.7, uv.y * 22.0) + seed + 4.0) * 0.7 + 0.3 * kfbm(vec2(uv.x * 2.0, uv.y * 90.0) + seed);
    vec3 col = mix(p_soLight, p_soDark, ring * 0.16 + 0.4 * streak) * (0.9 + 0.2 * cloud) * (0.94 + 0.12 * fib);
    // age: a silver grey laid over the brown, deepest on the open faces, the rings left darker under it
    vec3 grey = vec3(0.30, 0.285, 0.26) * (0.85 + 0.25 * cloud);
    col = mix(col, grey * (1.0 - 0.35 * ring), p_soAge * (0.6 + 0.4 * kfbm(uv * 2.0 + seed)));
    // the adze: shallow scallops across the grain, each stroke its own length, its edge wandering, the face between them
    // left flat in places where a stroke took off less
    float su = uv.x / p_soAdzeLen + 0.35 * kn(vec2(uv.x * 4.0, uv.y * 9.0) + seed + 2.0) + kh1(seed) * 7.0;
    float f = fract(su);
    float strokeAmt = 0.4 + 0.6 * kh(vec2(floor(su), seed + 3.0));
    float scallop = (f * (1.0 - f)) * 4.0;
    float adze = (scallop - 0.66) * p_soAdze * strokeAmt * kfade(p_soAdzeLen * 0.4);
    // the stroke's lip: a faint ridge where two scallops meet
    float lip = (1.0 - smoothstep(0.0, 0.05, min(f, 1.0 - f))) * strokeAmt * kfade(0.01) * step(1e-6, p_soAdze);
    col *= 1.0 + 0.015 * lip;
    // checks: a few long dark splits along the grain
    float cy = uv.y * 7.0 + kfbm(vec2(uv.x * 0.6, uv.y) + seed + 9.0) * 1.4;
    float crack = pow(1.0 - abs(2.0 * fract(cy) - 1.0), 60.0) * step(0.55, kh(vec2(floor(cy), seed)))
      * smoothstep(0.35, 0.6, kfbm(vec2(uv.x * 2.2, floor(cy)) + seed)) * p_soChecks * kfade(0.004);
    col *= 1.0 - 0.75 * crack;
    // a sawn end: the rings round the pith, wandering a little, the splits opening out from the pith, the saw's kerf
    float endg = step(0.5, s0.z);
    if (endg > 0.5) {
      float r = length(s1.xy);
      float ang = atan(s1.y, s1.x);
      float wob = 0.004 * kn(vec2(ang * 3.0, r * 20.0) + seed);
      float er = fract((r + wob) * p_soEndRings);
      float late = smoothstep(0.55, 0.95, er) * kfade(0.6 / p_soEndRings);
      vec3 sap = mix(p_soLight * 1.15, p_soDark, late * 0.6);
      // the splits: a few dark lines out from the pith, each its own angle, widening outward
      float split = 0.0;
      for (int i = 0; i < 4; i++) {
        float a = kh1(seed + float(i) * 3.7) * 6.28318;
        float d = abs(sin(ang - a)) * r;
        split = max(split, (1.0 - smoothstep(0.0, 0.0015 + r * 0.012, d)) * step(0.0, cos(ang - a)) * smoothstep(0.02, 0.06, r));
      }
      float saw = kn(vec2(dot(s1.xy, vec2(0.8, 0.6)) * 400.0, 0.0) + seed) * kfade(0.003);
      col = mix(sap * (0.9 + 0.15 * saw), grey * 0.9, p_soAge * 0.5) * (1.0 - 0.7 * split * p_soChecks);
      adze = 0.0;
      crack = split;
    }
    // soot: browning the wood toward a tarry black, deepest in the scallops' hollows
    float soot = clamp(s0.x * p_soSoot, 0.0, 1.0);
    // (the hollows only where the adze cut them: a timber with no adze has no rows of soot)
    float hollow = p_soAdze > 0.0 ? (0.66 - scallop) * 0.3 * kfade(p_soAdzeLen * 0.4) : 0.0;
    float s = smoothstep(0.0, 1.0, soot * 1.35 - 0.3 * kfbm(uv * 3.0 + seed + 5.0) + hollow);
    col = mix(col, vec3(0.03, 0.022, 0.016) * (0.8 + 0.4 * cloud), s * 0.92);
    // wear: hands polish it dark and smooth
    float wear = clamp(s0.y, 0.0, 1.0);
    col = mix(col, col * vec3(0.7, 0.62, 0.55), wear * 0.6);
    k.colour = col;
    k.rough = mix(mix(p_soRough, 0.6, s * soot), 0.45, wear);
    k.height = adze * (1.0 - wear * 0.8) - 0.0015 * crack + 0.0003 * (fib - 0.5) - 0.0004 * ring;
  
}

void look_35(inout Look k) {
  p_soLight = texelFetch(lookSettings, ivec2(0, 35), 0).rgb;
  p_soDark = texelFetch(lookSettings, ivec2(1, 35), 0).rgb;
  p_soAge = texelFetch(lookSettings, ivec2(2, 35), 0).r;
  p_soRings = texelFetch(lookSettings, ivec2(3, 35), 0).r;
  p_soEndRings = texelFetch(lookSettings, ivec2(4, 35), 0).r;
  p_soAdzeLen = texelFetch(lookSettings, ivec2(5, 35), 0).r;
  p_soAdze = texelFetch(lookSettings, ivec2(6, 35), 0).r;
  p_soChecks = texelFetch(lookSettings, ivec2(7, 35), 0).r;
  p_soSoot = texelFetch(lookSettings, ivec2(8, 35), 0).r;
  p_soRough = texelFetch(lookSettings, ivec2(9, 35), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // grain: rings wandering across, fibres along
    float ring = kring(uv * vec2(1.0, p_soRings / 9.0), seed, 9.0) * (0.45 + 0.55 * kfbm(uv * vec2(0.8, 6.0) + seed + 1.0));
    float fib = kfibre(uv, seed);
    float cloud = kfbm(vec2(uv.x * 1.3, uv.y * 4.0) + seed + 3.0);
    // the grain's long streaks: dark and light runs along u, wandering slowly, so it reads as wood and never as stripes
    float streak = kfbm(vec2(uv.x * 0.7, uv.y * 22.0) + seed + 4.0) * 0.7 + 0.3 * kfbm(vec2(uv.x * 2.0, uv.y * 90.0) + seed);
    vec3 col = mix(p_soLight, p_soDark, ring * 0.16 + 0.4 * streak) * (0.9 + 0.2 * cloud) * (0.94 + 0.12 * fib);
    // age: a silver grey laid over the brown, deepest on the open faces, the rings left darker under it
    vec3 grey = vec3(0.30, 0.285, 0.26) * (0.85 + 0.25 * cloud);
    col = mix(col, grey * (1.0 - 0.35 * ring), p_soAge * (0.6 + 0.4 * kfbm(uv * 2.0 + seed)));
    // the adze: shallow scallops across the grain, each stroke its own length, its edge wandering, the face between them
    // left flat in places where a stroke took off less
    float su = uv.x / p_soAdzeLen + 0.35 * kn(vec2(uv.x * 4.0, uv.y * 9.0) + seed + 2.0) + kh1(seed) * 7.0;
    float f = fract(su);
    float strokeAmt = 0.4 + 0.6 * kh(vec2(floor(su), seed + 3.0));
    float scallop = (f * (1.0 - f)) * 4.0;
    float adze = (scallop - 0.66) * p_soAdze * strokeAmt * kfade(p_soAdzeLen * 0.4);
    // the stroke's lip: a faint ridge where two scallops meet
    float lip = (1.0 - smoothstep(0.0, 0.05, min(f, 1.0 - f))) * strokeAmt * kfade(0.01) * step(1e-6, p_soAdze);
    col *= 1.0 + 0.015 * lip;
    // checks: a few long dark splits along the grain
    float cy = uv.y * 7.0 + kfbm(vec2(uv.x * 0.6, uv.y) + seed + 9.0) * 1.4;
    float crack = pow(1.0 - abs(2.0 * fract(cy) - 1.0), 60.0) * step(0.55, kh(vec2(floor(cy), seed)))
      * smoothstep(0.35, 0.6, kfbm(vec2(uv.x * 2.2, floor(cy)) + seed)) * p_soChecks * kfade(0.004);
    col *= 1.0 - 0.75 * crack;
    // a sawn end: the rings round the pith, wandering a little, the splits opening out from the pith, the saw's kerf
    float endg = step(0.5, s0.z);
    if (endg > 0.5) {
      float r = length(s1.xy);
      float ang = atan(s1.y, s1.x);
      float wob = 0.004 * kn(vec2(ang * 3.0, r * 20.0) + seed);
      float er = fract((r + wob) * p_soEndRings);
      float late = smoothstep(0.55, 0.95, er) * kfade(0.6 / p_soEndRings);
      vec3 sap = mix(p_soLight * 1.15, p_soDark, late * 0.6);
      // the splits: a few dark lines out from the pith, each its own angle, widening outward
      float split = 0.0;
      for (int i = 0; i < 4; i++) {
        float a = kh1(seed + float(i) * 3.7) * 6.28318;
        float d = abs(sin(ang - a)) * r;
        split = max(split, (1.0 - smoothstep(0.0, 0.0015 + r * 0.012, d)) * step(0.0, cos(ang - a)) * smoothstep(0.02, 0.06, r));
      }
      float saw = kn(vec2(dot(s1.xy, vec2(0.8, 0.6)) * 400.0, 0.0) + seed) * kfade(0.003);
      col = mix(sap * (0.9 + 0.15 * saw), grey * 0.9, p_soAge * 0.5) * (1.0 - 0.7 * split * p_soChecks);
      adze = 0.0;
      crack = split;
    }
    // soot: browning the wood toward a tarry black, deepest in the scallops' hollows
    float soot = clamp(s0.x * p_soSoot, 0.0, 1.0);
    // (the hollows only where the adze cut them: a timber with no adze has no rows of soot)
    float hollow = p_soAdze > 0.0 ? (0.66 - scallop) * 0.3 * kfade(p_soAdzeLen * 0.4) : 0.0;
    float s = smoothstep(0.0, 1.0, soot * 1.35 - 0.3 * kfbm(uv * 3.0 + seed + 5.0) + hollow);
    col = mix(col, vec3(0.03, 0.022, 0.016) * (0.8 + 0.4 * cloud), s * 0.92);
    // wear: hands polish it dark and smooth
    float wear = clamp(s0.y, 0.0, 1.0);
    col = mix(col, col * vec3(0.7, 0.62, 0.55), wear * 0.6);
    k.colour = col;
    k.rough = mix(mix(p_soRough, 0.6, s * soot), 0.45, wear);
    k.height = adze * (1.0 - wear * 0.8) - 0.0015 * crack + 0.0003 * (fib - 0.5) - 0.0004 * ring;
  
}

void look_36(inout Look k) {
  p_siScale = texelFetch(lookSettings, ivec2(0, 36), 0).rgb;
  p_siIron = texelFetch(lookSettings, ivec2(1, 36), 0).rgb;
  p_siSteel = texelFetch(lookSettings, ivec2(2, 36), 0).rgb;
  p_siPeen = texelFetch(lookSettings, ivec2(3, 36), 0).r;
  p_siPeenDepth = texelFetch(lookSettings, ivec2(4, 36), 0).r;
  p_siFlake = texelFetch(lookSettings, ivec2(5, 36), 0).r;
  p_siRust = texelFetch(lookSettings, ivec2(6, 36), 0).r;
  p_siRough = texelFetch(lookSettings, ivec2(7, 36), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // the hammer: overlapping shallow dimples, each blow its own
    float dimple = kcell(uv * p_siPeen + seed);
    float peen = (dimple * dimple - 0.35) * p_siPeenDepth * kfade(1.5 / p_siPeen) * (0.4 + 0.6 * kfbm(uv * 3.0 + seed));
    // the scale: a skin that flakes in patches, the edge of each flake a hair proud
    float flakeN = kfbm(uv * 14.0 + seed + 2.0);
    float flaked = smoothstep(1.0 - p_siFlake, 1.0 - p_siFlake + 0.06, flakeN);
    float lip = (1.0 - smoothstep(0.0, 0.05, abs(flakeN - (1.0 - p_siFlake) - 0.03))) * kfade(0.004);
    float mott = kfbm(uv * 5.0 + seed + 7.0);
    vec3 col = mix(p_siScale * (0.8 + 0.5 * mott), p_siIron * (0.75 + 0.4 * mott), flaked);
    // rust blooms where the hammer left hollows and the scale is off
    float rust = smoothstep(0.62, 0.8, kfbm(uv * 4.0 + seed + 13.0)) * smoothstep(0.3, 0.7, kfbm(uv * 30.0 + seed + 5.0)) * p_siRust;
    col = mix(col, vec3(0.16, 0.06, 0.025) * (0.7 + 0.6 * kn(uv * 120.0 + seed)), rust * 0.85);
    // polish: rubbed through to steel, fine scratches along u, the dimples' bottoms still dark
    float pol = clamp(s0.x, 0.0, 1.0);
    float scratch = kn(vec2(uv.x * 6.0, uv.y * 900.0) + seed) * kfade(0.002);
    vec3 steel = p_siSteel * (0.85 + 0.25 * scratch);
    float bright = pol * smoothstep(0.05, 0.4, dimple * (1.0 - pol * 0.6) + pol * 0.6);
    col = mix(col, steel, bright);
    // heat: the temper colours over the steel or the scale
    float heat = clamp(s0.y, 0.0, 1.0);
    col *= siTemper(heat * (0.85 + 0.3 * kfbm(uv * 6.0 + seed + 4.0)));
    k.colour = col;
    // the scale is an oxide, not a metal: it shows its own dark grey; the iron under it and the steel rubbed bright are
    k.metal = mix(mix(0.3, 0.8, flaked), 1.0, bright) * (1.0 - rust * 0.9);
    k.rough = mix(mix(p_siRough, 0.95, rust), 0.36 + 0.14 * scratch, bright);
    k.height = peen * (1.0 - 0.7 * pol) + 0.00015 * lip + 0.0002 * rust * kn(uv * 300.0 + seed);
  
}

void look_37(inout Look k) {
  p_slHide = texelFetch(lookSettings, ivec2(0, 37), 0).rgb;
  p_slRub = texelFetch(lookSettings, ivec2(1, 37), 0).rgb;
  p_slCreases = texelFetch(lookSettings, ivec2(2, 37), 0).r;
  p_slCreaseDepth = texelFetch(lookSettings, ivec2(3, 37), 0).r;
  p_slPebble = texelFetch(lookSettings, ivec2(4, 37), 0).r;
  p_slOil = texelFetch(lookSettings, ivec2(5, 37), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    // the creases: long wandering folds across v, deepest on the kind's fold lines
    float w = kfbm(vec2(uv.x * 1.2, uv.y * 0.8) + seed) * 3.0;
    float cy = uv.y * p_slCreases * (0.8 + 0.4 * kfbm(uv * 1.5 + seed + 9.0)) + w;
    // each fold its own strength, some barely there
    float cr = pow(1.0 - abs(2.0 * fract(cy) - 1.0), 2.5) * (0.3 + 0.7 * kh(vec2(floor(cy), seed)));
    float fold = clamp(s0.x, 0.0, 1.0);
    float crease = cr * (0.35 + 0.65 * fold) * kfade(1.0 / p_slCreases);
    // the grain pebbled, a hair's relief
    float peb = kcell(uv * p_slPebble + seed) * kfade(2.0 / p_slPebble);
    float mott = kfbm(uv * 4.0 + seed + 2.0);
    vec3 col = p_slHide * (0.75 + 0.5 * mott);
    // rubbed pale on the creases' ridges, cracked fine in them
    float rub = smoothstep(0.6, 1.0, cr) * (0.3 + 0.7 * fold) * kfade(0.01) * smoothstep(0.35, 0.65, kfbm(uv * 6.0 + seed + 3.0));
    col = mix(col, p_slRub * (0.8 + 0.3 * mott), rub * 0.45);
    // the folds' hollows a shade darker, so the hide reads as bent, not lined
    col *= 1.0 - 0.25 * (1.0 - cr) * (0.4 + 0.6 * fold);
    float crack = smoothstep(0.82, 0.95, kn(vec2(uv.x * 260.0, uv.y * 40.0) + seed)) * rub * kfade(0.003);
    col *= 1.0 - 0.5 * crack;
    // soot settled on it
    col = mix(col, vec3(0.02, 0.017, 0.015), clamp(s0.y, 0.0, 1.0) * (0.5 + 0.5 * kfbm(uv * 3.0 + seed + 8.0)) * 0.85);
    k.colour = col;
    k.rough = mix(0.75, 0.38, p_slOil * (0.6 + 0.4 * mott)) + 0.2 * rub;
    k.clearcoat = p_slOil * 0.35 * (1.0 - rub);
    k.clearcoatRough = 0.45;
    k.height = -crease * p_slCreaseDepth + 0.00012 * (peb - 0.5) - 0.0002 * crack;
  
}

void look_38(inout Look k) {
  p_qwDeep = texelFetch(lookSettings, ivec2(0, 38), 0).rgb;
  p_qwScum = texelFetch(lookSettings, ivec2(1, 38), 0).rgb;
  p_qwScumCover = texelFetch(lookSettings, ivec2(2, 38), 0).r;
  p_qwRipple = texelFetch(lookSettings, ivec2(3, 38), 0).r;
  p_qwStir = texelFetch(lookSettings, ivec2(4, 38), 0).r;
  p_qwDrift = texelFetch(lookSettings, ivec2(5, 38), 0).r;
  p_qwCycle = texelFetch(lookSettings, ivec2(6, 38), 0).r;
  p_qwSheen = texelFetch(lookSettings, ivec2(7, 38), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec3 ph = kloop(p_qwCycle);
    float scum = mix(qwScumAt(uv, ph.y, seed), qwScumAt(uv, ph.x, seed), ph.z);
    // the wavelets: two sizes churning in place, stilled under the scum
    float ripple = kfbm3(vec3(uv * 18.0 + seed, kcycle(p_qwStir) * 4.0), 4.0) * 0.7 +
      kn3(vec3(uv * 55.0 + seed + 9.0, kcycle(p_qwStir * 0.6) * 3.0), 3.0) * 0.3;
    k.height = p_qwRipple * ripple * (1.0 - 0.8 * scum);
    k.colour = mix(p_qwDeep, p_qwScum * (0.75 + 0.5 * kfbm(uv * 30.0 + seed + 4.0)), scum);
    k.rough = mix(0.03, 0.8, scum);
    // a clear coat for the water's mirror, gone where the scum lies on it
    k.clearcoat = 1.0 - scum;
    k.clearcoatRough = 0.02;
    // the oil's thin film between the rafts
    k.iridescence = p_qwSheen * (1.0 - scum) * smoothstep(0.4, 0.8, kfbm(uv * 4.0 + seed + 11.0));
    k.iridIor = 1.45;
    k.iridThick = 380.0 + 240.0 * kfbm(uv * 9.0 + seed + 2.0);

}

void look_39(inout Look k) {

  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    float seasoned = kfbm(uv * 4.0 + seed);
    float grain = kn(uv * 300.0 + seed) * kfade(0.003);
    k.colour = vec3(0.025, 0.024, 0.023) * (1.0 + seasoned + 0.5 * grain);
    k.metal = 0.3;
    k.rough = 0.45 + 0.2 * seasoned;
    k.height = 0.0002 * grain;

}

void look_40(inout Look k) {
  p_opColour = texelFetch(lookSettings, ivec2(0, 40), 0).rgb;
  p_opRim = texelFetch(lookSettings, ivec2(1, 40), 0).rgb;
  p_opThrough = texelFetch(lookSettings, ivec2(2, 40), 0).r;
  p_opRough = texelFetch(lookSettings, ivec2(3, 40), 0).r;
  p_opGrain = texelFetch(lookSettings, ivec2(4, 40), 0).r;
  p_opGlow = texelFetch(lookSettings, ivec2(5, 40), 0).r;
  vec2 uv = vLookUv;
  float seed = vLookInfo.y * 7.13 + vLookInfo.z * 1.71;
  vec3 wp = vLookWorld;
  vec3 wn = normalize(vLookWN);

    vec3 opV = normalize(cameraPosition - wp);
    float opFace = clamp(abs(dot(opV, normalize(wn))), 0.0, 1.0);
    float opG = mix(0.5, kn(uv * 1500.0 + seed), kfade(0.0015));
    vec3 opC = mix(p_opRim, p_opColour, smoothstep(0.0, 0.8, opFace)) * (1.0 + p_opGrain * (opG - 0.5) * 2.0);
    k.colour = opC;
    k.rough = p_opRough;
    k.metal = 0.0;
    k.glow = (p_opThrough + p_opGlow) * opC * (0.6 + 0.4 * opFace);

}










































Look lookRun(int id) {
  Look k = lookStart();
  switch (id) {
    case 0: look_0(k); break;
    case 1: look_1(k); break;
    case 2: look_2(k); break;
    case 3: look_3(k); break;
    case 4: look_4(k); break;
    case 5: look_5(k); break;
    case 6: look_6(k); break;
    case 7: look_7(k); break;
    case 8: look_8(k); break;
    case 9: look_9(k); break;
    case 10: look_10(k); break;
    case 11: look_11(k); break;
    case 12: look_12(k); break;
    case 13: look_13(k); break;
    case 14: look_14(k); break;
    case 15: look_15(k); break;
    case 16: look_16(k); break;
    case 17: look_17(k); break;
    case 18: look_18(k); break;
    case 19: look_19(k); break;
    case 20: look_20(k); break;
    case 21: look_21(k); break;
    case 22: look_22(k); break;
    case 23: look_23(k); break;
    case 24: look_24(k); break;
    case 25: look_25(k); break;
    case 26: look_26(k); break;
    case 27: look_27(k); break;
    case 28: look_28(k); break;
    case 29: look_29(k); break;
    case 30: look_30(k); break;
    case 31: look_31(k); break;
    case 32: look_32(k); break;
    case 33: look_33(k); break;
    case 34: look_34(k); break;
    case 35: look_35(k); break;
    case 36: look_36(k); break;
    case 37: look_37(k); break;
    case 38: look_38(k); break;
    case 39: look_39(k); break;
    case 40: look_40(k); break;
  }
  if (lookDebug > 0.5) {
    switch (id) {
      case 0: k.colour = vec3(0.26225065752969623, 0.26225065752969623, 0.26225065752969623); break;
      case 1: k.colour = vec3(0.019382360956935723, 0.7912979403326302, 0.04091519690685319); break;
      case 2: k.colour = vec3(0.7912979403326302, 0.019382360956935723, 0.6239603916750761); break;
      case 3: k.colour = vec3(0.14995978981060856, 0.7912979403326302, 0.019382360956935723); break;
      case 4: k.colour = vec3(0.5840784178911641, 0.019382360956935723, 0.7912979403326302); break;
      case 5: k.colour = vec3(0.042311410620809675, 0.05780543019106723, 0.08437621154414882); break;
      case 6: k.colour = vec3(0.5840784178911641, 0.32314320911295075, 0.1119324278369056); break;
      case 7: k.colour = vec3(0.25415209433082675, 0.10224173308810132, 0.024157632448504756); break;
      case 8: k.colour = vec3(0.26225065752969623, 0.26225065752969623, 0.26225065752969623); break;
      case 9: k.colour = vec3(0.25415209433082675, 0.10224173308810132, 0.024157632448504756); break;
      case 10: k.colour = vec3(0.013702083047289686, 0.11443537382697373, 1.0); break;
      case 11: k.colour = vec3(1.0, 0.25415209433082675, 0.0); break;
      case 12: k.colour = vec3(0.7454042095403874, 0.010960094006488246, 0.010960094006488246); break;
      case 13: k.colour = vec3(0.8631572134541023, 0.7912979403326302, 0.6239603916750761); break;
      case 14: k.colour = vec3(0.8879231178819663, 0.6514056374198242, 0.04518620438567554); break;
      case 15: k.colour = vec3(0.12213877222960187, 0.7454042095403874, 1.0); break;
      case 16: k.colour = vec3(0.042311410620809675, 0.05780543019106723, 0.08437621154414882); break;
      case 17: k.colour = vec3(0.5840784178911641, 0.32314320911295075, 0.1119324278369056); break;
      case 18: k.colour = vec3(0.39157247774972326, 0.14126329114027164, 0.028426039504420793); break;
      case 19: k.colour = vec3(0.32314320911295075, 0.27467731206038465, 0.20155625379439707); break;
      case 20: k.colour = vec3(0.3049873140698863, 0.7912979403326302, 0.019382360956935723); break;
      case 21: k.colour = vec3(0.10702310297826761, 0.04518620438567554, 0.011612245179743885); break;
      case 22: k.colour = vec3(0.10224173308810132, 0.08437621154414882, 0.06480326669290577); break;
      case 23: k.colour = vec3(0.042311410620809675, 0.02315336617811041, 0.014443843596092545); break;
      case 24: k.colour = vec3(0.6866853124353135, 0.5840784178911641, 0.35153259950043936); break;
      case 25: k.colour = vec3(0.7912979403326302, 0.019382360956935723, 0.25015828472995344); break;
      case 26: k.colour = vec3(0.7912979403326302, 0.019382360956935723, 0.6239603916750761); break;
      case 27: k.colour = vec3(1.0, 0.14412847085805777, 0.010329823029626936); break;
      case 28: k.colour = vec3(0.25415209433082675, 0.21586050011389926, 0.18782077230067787); break;
      case 29: k.colour = vec3(0.1946178304415758, 0.14412847085805777, 0.09758734714186246); break;
      case 30: k.colour = vec3(0.25415209433082675, 0.1946178304415758, 0.13286832155381798); break;
      case 31: k.colour = vec3(0.1559264637078274, 0.12213877222960187, 0.08437621154414882); break;
      case 32: k.colour = vec3(0.45078578283822346, 0.32314320911295075, 0.14412847085805777); break;
      case 33: k.colour = vec3(0.14702726649759498, 0.08437621154414882, 0.03954623527673284); break;
      case 34: k.colour = vec3(0.1946178304415758, 0.13286832155381798, 0.08021982031446832); break;
      case 35: k.colour = vec3(0.32314320911295075, 0.20155625379439707, 0.09084171118340768); break;
      case 36: k.colour = vec3(0.024157632448504756, 0.028426039504420793, 0.03954623527673284); break;
      case 37: k.colour = vec3(0.10224173308810132, 0.027320891639074894, 0.006995410187265387); break;
      case 38: k.colour = vec3(0.010329823029626936, 0.014443843596092545, 0.011612245179743885); break;
      case 39: k.colour = vec3(0.019382360956935723, 0.26225065752969623, 0.7912979403326302); break;
      case 40: k.colour = vec3(1.0, 0.9130986517934192, 0.7156935005064807); break;
    }
  }
  return k;
}
float lookShadow_0(vec3 Lview) {

  if (p_shadowOn < 0.5 || csFade <= 0.0) return 1.0;
  vec3 L = vec3(dot(Lview, csT), dot(Lview, csB), dot(Lview, csNg));
  if (L.z <= 0.0) return 1.0;
  float span = -csZ + 0.002;
  vec2 duv = L.xy / max(L.z, 0.06) * span / 6.0;
  float dz = span / 6.0;
  vec2 u = csUvP;
  float z = csZ + 0.0015;
  float s = 1.0;
  for (int i = 0; i < 6; i++) {
    u += duv;
    z += dz;
    s = min(s, clamp(1.0 - (csSample(u).h - z) * 250.0, 0.0, 1.0));
  }
  return mix(1.0, s, csFade);

}
float lookShadow_5(vec3 Lview) {

  if (p_shadowOn < 0.5 || csFade <= 0.0) return 1.0;
  vec3 L = vec3(dot(Lview, csT), dot(Lview, csB), dot(Lview, csNg));
  if (L.z <= 0.0) return 1.0;
  float span = -csZ + 0.002;
  vec2 duv = L.xy / max(L.z, 0.06) * span / 6.0;
  float dz = span / 6.0;
  vec2 u = csUvP;
  float z = csZ + 0.0015;
  float s = 1.0;
  for (int i = 0; i < 6; i++) {
    u += duv;
    z += dz;
    s = min(s, clamp(1.0 - (csSample(u).h - z) * 250.0, 0.0, 1.0));
  }
  return mix(1.0, s, csFade);

}
float lookShadow_6(vec3 Lview) {

  if (p_shadowOn < 0.5 || csFade <= 0.0) return 1.0;
  vec3 L = vec3(dot(Lview, csT), dot(Lview, csB), dot(Lview, csNg));
  if (L.z <= 0.0) return 1.0;
  float span = -csZ + 0.002;
  vec2 duv = L.xy / max(L.z, 0.06) * span / 6.0;
  float dz = span / 6.0;
  vec2 u = csUvP;
  float z = csZ + 0.0015;
  float s = 1.0;
  for (int i = 0; i < 6; i++) {
    u += duv;
    z += dz;
    s = min(s, clamp(1.0 - (cwSample(u).h - z) * 250.0, 0.0, 1.0));
  }
  return mix(1.0, s, csFade);

}
float lookShadow(int id, vec3 Lview) {
  switch (id) {
    case 0: return lookShadow_0(Lview);
    case 5: return lookShadow_5(Lview);
    case 6: return lookShadow_6(Lview);
  }
  return 1.0;
}
