// Three.js Transpiler r187

import { bool, texture, varying, float, vec3, vec2, vec4, uniform, property, dot, sin, fract, Fn, floor, mul, sub, mix, Loop, abs, clamp, int, If, sqrt, min, uv, pow, smoothstep, step, select, add, mod, dFdx, dFdy, cross, sign, normalize, max, inverseSqrt, struct, uint, ivec2, length, log2, Continue, exp, log, cos, div, Break, mat3, fwidth, atan, cameraPosition, Switch } from 'three/tsl';

const B = globalThis.lookBindings;
const vViewPosition = B.vViewPosition;
const vNormal = B.vNormal;

const lookSettings = B.lookSettings;
const vLookId = B.vLookId;
const vLookInfo = B.vLookInfo;
const vLookUv = B.vLookUv;
const vLookWorld = B.vLookWorld;
const vLookWN = B.vLookWN;
const vS0 = B.vS0;
const vS1 = B.vS1;
const vS2 = B.vS2;
const vS3 = B.vS3;
const lookView = B.lookView;
const lookDebug = B.lookDebug;

// the looks' clock: seconds, one for every look of the scene, set each frame by the page (install.js's `time`) or the
// game (core's supershader3d). It grows without end, and a hash of a large number is no longer random, so a look never
// feeds it to its noise as it is: it takes it through kcycle or kloop, whose numbers stay inside one period.

const lookTime = B.lookTime;

// the uv's change across the pixel, worked out once where every pixel of the quad runs it, so a picture read inside a
// look's branch still knows its sharpness

const lookGx = property( 'vec2' ), lookGy = property( 'vec2' );

export const kh = /*@__PURE__*/ Fn( ( [ p ] ) => {

	return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ).mul( 43758.5453123 ) );

}, 'float' );

export const kh1 = /*@__PURE__*/ Fn( ( [ x ] ) => {

	return fract( sin( x.mul( 91.7 ) ).mul( 43758.5453 ) );

}, 'float' );

export const kn = /*@__PURE__*/ Fn( ( [ p ] ) => {

	const i = floor( p ), f = fract( p );
	const u = f.mul( f ).mul( sub( 3.0, mul( 2.0, f ) ) );

	return mix( mix( kh( i ), kh( i.add( vec2( 1, 0 ) ) ), u.x ), mix( kh( i.add( vec2( 0, 1 ) ) ), kh( i.add( vec2( 1, 1 ) ) ), u.x ), u.y );

}, 'float' );

export const kfbm = /*@__PURE__*/ Fn( ( [ p_immutable ] ) => {

	const p = p_immutable.toVar();
	const a = float( 0.5 ), s = float( 0.0 );

	Loop( 5, () => {

		s.addAssign( a.mul( kn( p ) ) );
		p.assign( p.mul( 2.03 ).add( 17.1 ) );
		a.mulAssign( 0.5 );

	} );

	return s.div( 0.97 );

}, 'float' );

export const kfbm4 = /*@__PURE__*/ Fn( ( [ p_immutable ] ) => {

	const p = p_immutable.toVar();
	const a = float( 0.5 ), s = float( 0.0 );

	Loop( 4, () => {

		s.addAssign( a.mul( kn( p ) ) );
		p.assign( p.mul( 2.03 ).add( 17.1 ) );
		a.mulAssign( 0.5 );

	} );

	return s;

}, 'float' );

// a feature f metres across fades to its mean where it is finer than a pixel

export const kfade = /*@__PURE__*/ Fn( ( [ f ] ) => {

	const fw = abs( lookGx ).add( abs( lookGy ) );

	return clamp( sub( 1.5, fw.x.add( fw.y ).div( f ) ), 0.0, 1.0 );

}, 'float' );

// cells of jittered seeds: the distance to the nearest, its number (0 to 1), and how far the second is past it

export const kvor = /*@__PURE__*/ Fn( ( [ p, id_immutable, edge_immutable ] ) => {

	const edge = edge_immutable;
	const id = id_immutable;
	const i = floor( p ), f = fract( p );
	const d1 = float( 8.0 ), d2 = float( 8.0 );
	const best = vec2( 0.0 );

	Loop( { start: int( - 1 ), end: 1, name: 'y', condition: '<=' }, ( { y } ) => {

		Loop( { start: int( - 1 ), end: 1, name: 'x', condition: '<=' }, ( { x } ) => {

			const o = vec2( x, y );
			const c = i.add( o );
			const r = o.add( vec2( kh( c ), kh( c.add( 7.3 ) ) ) ).sub( f );
			const d = dot( r, r );

			If( d.lessThan( d1 ), () => {

				d2.assign( d1 );
				d1.assign( d );
				best.assign( c );

			} ).ElseIf( d.lessThan( d2 ), () => {

				d2.assign( d );

			} );

		} );

	} );

	id.assign( kh( best.add( 3.7 ) ) );
	edge.assign( sqrt( d2 ).sub( sqrt( d1 ) ) );

	return sqrt( d1 );

}, 'void' );

// a dimple field: the distance to the nearest of jittered cells' seeds

export const kcell = /*@__PURE__*/ Fn( ( [ p ] ) => {

	const i = floor( p ), f = fract( p );
	const d = float( 8.0 );

	Loop( { start: int( - 1 ), end: 1, name: 'y', condition: '<=' }, ( { y } ) => {

		Loop( { start: int( - 1 ), end: 1, name: 'x', condition: '<=' }, ( { x } ) => {

			const o = vec2( x, y );
			const r = o.add( vec2( kh( i.add( o ) ), kh( i.add( o ).add( 7.3 ) ) ) ).sub( f );
			d.assign( min( d, dot( r, r ) ) );

		} );

	} );

	return sqrt( d );

}, 'float' );

// courses: the row along v, the piece in it along u (each row offset), where in the piece (0 to 1 each way)

export const kcourse = /*@__PURE__*/ Fn( ( [ uv, row, wide, jitter, seed, id_immutable ] ) => {

	const id = id_immutable;
	const r = floor( uv.y.div( row ) );
	const shift = kh1( r.add( seed ) ).mul( wide );
	const w = wide.mul( sub( 1.0, jitter.mul( 0.5 ) ).add( jitter.mul( kh( vec2( r, floor( uv.x.add( shift ).div( wide ) ).add( seed ) ) ) ) ) );
	const x = uv.x.add( shift ).div( w );
	id.assign( vec2( r, floor( x ) ) );

	return vec4( fract( x ), fract( uv.y.div( row ) ), r, w );

}, 'void' );

// marble's veins: thin lines wandering through a warped field, the main ones and finer ones across them

export const kveins = /*@__PURE__*/ Fn( ( [ p, seed ] ) => {

	const w = kfbm( p.mul( 1.3 ).add( seed ) ).mul( 4.0 );
	const a = pow( sub( 1.0, abs( sin( p.x.mul( 1.6 ).add( p.y.mul( 0.6 ) ).add( w ).mul( 3.14159 ) ) ) ), 22.0 );
	const b = pow( sub( 1.0, abs( sin( p.y.mul( 2.7 ).sub( p.x.mul( 1.1 ) ).add( kfbm( p.mul( 2.6 ).add( seed ).add( 7.0 ) ).mul( 3.0 ) ).mul( 3.14159 ) ) ) ), 50.0 );

	return clamp( a.add( mul( 0.6, b ) ), 0.0, 1.0 );

}, 'float' );

// wood's grain along u: its rings' lines (late wood 1, early 0) wandering across v, and its fibres

export const kring = /*@__PURE__*/ Fn( ( [ uv, seed, rings ] ) => {

	const w = kfbm( vec2( uv.x.mul( 0.35 ), uv.y.mul( 2.0 ) ).add( seed ) ).mul( 1.6 );

	return smoothstep( 0.5, 0.95, fract( uv.y.mul( rings ).add( w ).add( uv.x.mul( 0.04 ) ) ) );

}, 'float' );

export const kfibre = /*@__PURE__*/ Fn( ( [ uv, seed ] ) => {

	return kn( vec2( uv.x.mul( 3.0 ), uv.y.mul( 420.0 ) ).add( seed ) ).mul( kfade( 0.003 ) );

}, 'float' );

// how strongly a cloth's weave shows: a plain weave of threads t metres across, over and under

export const kweave = /*@__PURE__*/ Fn( ( [ uv, t ] ) => {

	const q = uv.div( t );
	const warp = sin( q.x.mul( 3.14159 ) ), weft = sin( q.y.mul( 3.14159 ) );
	const over = step( 0.0, warp.mul( weft ) );

	return mix( 0.5, mix( 0.8, 1.08, over ).mul( add( 0.85, mul( 0.15, abs( select( over.greaterThan( 0.5 ), weft, warp ) ) ) ) ), kfade( t.mul( 2.0 ) ) );

}, 'float' );

// a cycle of `period` seconds: how far through it the clock is, 0 to 1, for a look that pulses or goes round (anything
// of 6.28318 times it, a sin or a turn, comes back to where it began with no seam)

export const kcycle = /*@__PURE__*/ Fn( ( [ period ] ) => {

	return fract( lookTime.div( period ) );

}, 'float' );

// a drift that never repeats, for a look that flows, boils or creeps: two phases of one cycle of `period` seconds, half
// a cycle apart, each 0 to 1 (x and y), and the share of the first (z). A look moves its pattern on by each phase, reads
// it at both and mixes them by z; each phase jumps back to 0 only where its share is 0, so the drift shows no seam

export const kloop = /*@__PURE__*/ Fn( ( [ period ] ) => {

	const a = fract( lookTime.div( period ) );

	return vec3( a, fract( a.add( 0.5 ) ), sub( 1.0, abs( mul( 2.0, a ).sub( 1.0 ) ) ) );

}, 'vec3' );

// value noise in three numbers whose third repeats every `n` cells (a whole number): a pattern that churns in place,
// for what boils, breathes or glows and fades, never sliding as a drift does. Given p.z = kcycle(period) * n it changes
// n cells' worth over the period and comes back to where it began at its end with no seam, so nothing is mixed and
// nothing shows twice

export const kh3 = /*@__PURE__*/ Fn( ( [ c ] ) => {

	return fract( sin( dot( c, vec3( 127.1, 311.7, 74.7 ) ) ).mul( 43758.5453123 ) );

}, 'float' );

export const kn3 = /*@__PURE__*/ Fn( ( [ p, n ] ) => {

	const i = floor( p ), f = fract( p );
	const u = f.mul( f ).mul( sub( 3.0, mul( 2.0, f ) ) );
	const z0 = mod( i.z, n ), z1 = mod( i.z.add( 1.0 ), n );
	const a0 = mix( mix( kh3( vec3( i.xy, z0 ) ), kh3( vec3( i.xy.add( vec2( 1, 0 ) ), z0 ) ), u.x ), mix( kh3( vec3( i.xy.add( vec2( 0, 1 ) ), z0 ) ), kh3( vec3( i.xy.add( vec2( 1, 1 ) ), z0 ) ), u.x ), u.y );
	const a1 = mix( mix( kh3( vec3( i.xy, z1 ) ), kh3( vec3( i.xy.add( vec2( 1, 0 ) ), z1 ) ), u.x ), mix( kh3( vec3( i.xy.add( vec2( 0, 1 ) ), z1 ) ), kh3( vec3( i.xy.add( vec2( 1, 1 ) ), z1 ) ), u.x ), u.y );

	return mix( a0, a1, u.z );

}, 'float' );

// four sizes of it, each finer one churning twice as fast and still repeating on the same cycle

export const kfbm3 = /*@__PURE__*/ Fn( ( [ p_immutable, n_immutable ] ) => {

	const n = n_immutable.toVar();
	const p = p_immutable.toVar();
	const a = float( 0.5 ), s = float( 0.0 );

	Loop( 4, () => {

		s.addAssign( a.mul( kn3( p, n ) ) );
		p.assign( vec3( p.xy.mul( 2.03 ).add( 17.1 ), p.z.mul( 2.0 ) ) );
		n.mulAssign( 2.0 );
		a.mulAssign( 0.5 );

	} );

	return s.div( 0.9375 );

}, 'float' );

// the normal bent by a height field, as three's bump map bends it (perturbNormalArb)

export const kitBump = /*@__PURE__*/ Fn( ( [ pos, n, h, faceDirection ] ) => {

	const sx = dFdx( pos ), sy = dFdy( pos );
	const r1 = cross( sy, n ), r2 = cross( n, sx );
	const det = dot( sx, r1 ).mul( faceDirection );
	const dh = vec2( dFdx( h ), dFdy( h ) );
	const grad = sign( det ).mul( dh.x.mul( r1 ).add( dh.y.mul( r2 ) ) );

	return normalize( abs( det ).mul( n ).sub( grad ) );

}, 'vec3' );

// a normal in the surface's own ways (u, v, out) turned into the view's, the ways found from the uv's change across
// the pixel, as three's normal map without tangents finds them (getTangentFrame)

export const lookPerturb = /*@__PURE__*/ Fn( ( [ n, nts, faceDirection ] ) => {

	const q0 = dFdx( vViewPosition.negate() ), q1 = dFdy( vViewPosition.negate() );
	const q1perp = cross( q1, n ), q0perp = cross( n, q0 );
	const T = q1perp.mul( lookGx.x ).add( q0perp.mul( lookGy.x ) );
	const B = q1perp.mul( lookGx.y ).add( q0perp.mul( lookGy.y ) );
	const det = max( dot( T, T ), dot( B, B ) );
	const scale = select( det.equal( 0.0 ), 0.0, faceDirection.mul( inverseSqrt( det ) ) );

	return normalize( T.mul( nts.x.mul( scale ) ).add( B.mul( nts.y.mul( scale ) ) ).add( n.mul( nts.z ) ) );

}, 'vec3' );

const Look = struct( {
	colour: 'vec3',
	rough: 'float',
	metal: 'float',
	height: 'float',
	nts: 'vec3',
	normal: 'vec3',
	ownNormal: 'bool',
	ao: 'float',
	aoDirect: 'float',
	alpha: 'float',
	glow: 'vec3',
	clearcoat: 'float',
	clearcoatRough: 'float',
	sheen: 'vec3',
	sheenRough: 'float',
	iridescence: 'float',
	iridIor: 'float',
	iridThick: 'float',
	transmission: 'float',
	thickness: 'float',
	attColour: 'vec3',
	attDist: 'float',
	ior: 'float',
	dispersion: 'float'
}, 'Look' );

export const lookStart = /*@__PURE__*/ Fn( () => {

	const k = Look();
	k.get( 'colour' ).assign( vec3( 0.5 ) );
	k.get( 'rough' ).assign( 0.8 );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( 0.0 );
	k.get( 'nts' ).assign( vec3( 0.0, 0.0, 1.0 ) );
	k.get( 'normal' ).assign( vec3( 0.0, 0.0, 1.0 ) );
	k.get( 'ownNormal' ).assign( false );
	k.get( 'ao' ).assign( 1.0 );
	k.get( 'aoDirect' ).assign( 0.0 );
	k.get( 'alpha' ).assign( 1.0 );
	k.get( 'glow' ).assign( vec3( 0.0 ) );
	k.get( 'clearcoat' ).assign( 0.0 );
	k.get( 'clearcoatRough' ).assign( 0.1 );
	k.get( 'sheen' ).assign( vec3( 0.0 ) );
	k.get( 'sheenRough' ).assign( 0.5 );
	k.get( 'iridescence' ).assign( 0.0 );
	k.get( 'iridIor' ).assign( 1.3 );
	k.get( 'iridThick' ).assign( 400.0 );
	k.get( 'transmission' ).assign( 0.0 );
	k.get( 'thickness' ).assign( 0.0 );
	k.get( 'attColour' ).assign( vec3( 1.0 ) );
	k.get( 'attDist' ).assign( 1e9 );
	k.get( 'ior' ).assign( 1.5 );
	k.get( 'dispersion' ).assign( 0.0 );

	return k;

}, 'Look' );

const lookPictures = B.lookPictures;
const lookMeans = B.lookMeans;

export const lookSrgb = /*@__PURE__*/ Fn( ( [ c ] ) => {

	return mix( c.div( 12.92 ), pow( c.add( 0.055 ).div( 1.055 ), vec3( 2.4 ) ), step( 0.04045, c ) );

}, 'vec3' );

export const picData = /*@__PURE__*/ Fn( ( [ t, uv, scale ] ) => {

	return lookPictures.sample( vec3( uv, float( t ) ) ).grad( lookGx.mul( scale ), lookGy.mul( scale ) );

}, 'vec4' );

export const picColour = /*@__PURE__*/ Fn( ( [ t, uv, scale ] ) => {

	return lookSrgb( picData( t, uv, scale ).rgb );

}, 'vec3' );

export const picDataLod = /*@__PURE__*/ Fn( ( [ t, uv, lod ] ) => {

	return lookPictures.sample( vec3( uv, float( t ) ) ).level( lod );

}, 'vec4' );

export const picColourLod = /*@__PURE__*/ Fn( ( [ t, uv, lod ] ) => {

	return lookSrgb( picDataLod( t, uv, lod ).rgb );

}, 'vec3' );

export const picMean = /*@__PURE__*/ Fn( ( [ t ] ) => {

	return lookMeans.element( t );

}, 'float' );

const p_stoneMin = property( 'float' );
const p_stoneMax = property( 'float' );
const p_rowMin = property( 'float' );
const p_rowMax = property( 'float' );
const p_joint = property( 'float' );
const p_seed = property( 'float' );
const p_recess = property( 'float' );
const p_edgeRound = property( 'float' );
const p_edgeDrop = property( 'float' );
const p_corner = property( 'float' );
const p_chip = property( 'float' );
const p_bulge = property( 'float' );
const p_tilt = property( 'float' );
const p_detail = property( 'float' );
const p_detailNormal = property( 'float' );
const p_valueVar = property( 'float' );
const p_warm = property( 'float' );
const p_dark = property( 'float' );
const p_mottle = property( 'float' );
const p_grime = property( 'float' );
const p_damp = property( 'float' );
const p_moss = property( 'float' );
const p_rockContrast = property( 'float' );
const p_rockScale = property( 'float' );
const p_mortScale = property( 'float' );
const p_pom = property( 'float' );
const p_pomOn = property( 'float' );
const p_shadowOn = property( 'float' );
const p_stoneTint = property( 'vec3' );
const p_mortTint = property( 'vec3' );
const p_gap = property( 'float' );
const p_cup = property( 'float' );
const p_grain = property( 'float' );
const p_grainNormal = property( 'float' );
const p_light = property( 'float' );
const p_endDark = property( 'float' );
const p_rings = property( 'float' );
const p_grainScale = property( 'float' );
const p_repeat = property( 'float' );
const p_tint = property( 'vec3' );
const p_contrast = property( 'float' );
const p_metres = property( 'float' );
const p_thDark = property( 'vec3' );
const p_thLight = property( 'vec3' );
const p_thAged = property( 'vec3' );
const p_thAgeFrom = property( 'float' );
const p_thAgeTo = property( 'float' );
const p_thDeep = property( 'float' );
const p_thRough = property( 'float' );
const p_glTint = property( 'vec3' );
const p_glTint2 = property( 'vec3' );
const p_glWaves = property( 'float' );
const p_glWaveDepth = property( 'float' );
const p_glSeeds = property( 'float' );
const p_glRough = property( 'float' );
const p_glAlpha = property( 'float' );
const p_glAlphaVar = property( 'float' );
const p_glRibs = property( 'float' );
const p_glRibWide = property( 'float' );
const p_glRibAlpha = property( 'float' );
const p_glGlow = property( 'vec3' );
const p_glCrease = property( 'float' );
const p_glCreaseFreq = property( 'float' );
const p_glBands = property( 'float' );
const p_glBandHigh = property( 'float' );
const p_size = property( 'float' );
const p_jitter = property( 'float' );
const p_stretch = property( 'float' );
const p_dome = property( 'float' );
const p_flat = property( 'float' );
const p_sink = property( 'float' );
const p_fleck = property( 'float' );
const p_polish = property( 'float' );
const p_dirt = property( 'float' );
const p_mossCover = property( 'float' );
const p_mossTop = property( 'float' );
const p_mossDepth = property( 'float' );
const p_mossScale = property( 'float' );
const p_wet = property( 'float' );
const p_grey = property( 'vec3' );
const p_brown = property( 'vec3' );
const p_sand = property( 'vec3' );
const p_mossDark = property( 'vec3' );
const p_mossLight = property( 'vec3' );
const p_poSimmer = property( 'float' );
const p_poRoll = property( 'float' );
const p_poBits = property( 'float' );
const p_fcHeat = property( 'float' );
const p_fcAsh = property( 'float' );
const p_fcGlow = property( 'float' );
const p_fcBreath = property( 'float' );
const p_fcFlicker = property( 'float' );
const p_fcChecks = property( 'float' );
const p_fcCheckShow = property( 'float' );
const p_ssRow = property( 'float' );
const p_ssLong = property( 'float' );
const p_ssJitter = property( 'float' );
const p_ssJoint = property( 'float' );
const p_ssWorld = property( 'float' );
const p_ssPillow = property( 'float' );
const p_ssPitch = property( 'float' );
const p_ssTool = property( 'float' );
const p_ssA = property( 'vec3' );
const p_ssB = property( 'vec3' );
const p_ssMortar = property( 'vec3' );
const p_ssGrain = property( 'float' );
const p_ssSpeck = property( 'float' );
const p_ssIron = property( 'float' );
const p_ssSoot = property( 'float' );
const p_ssHeat = property( 'float' );
const p_ssRough = property( 'float' );
const p_soLight = property( 'vec3' );
const p_soDark = property( 'vec3' );
const p_soAge = property( 'float' );
const p_soRings = property( 'float' );
const p_soEndRings = property( 'float' );
const p_soAdzeLen = property( 'float' );
const p_soAdze = property( 'float' );
const p_soChecks = property( 'float' );
const p_soSoot = property( 'float' );
const p_soRough = property( 'float' );
const p_siScale = property( 'vec3' );
const p_siIron = property( 'vec3' );
const p_siSteel = property( 'vec3' );
const p_siPeen = property( 'float' );
const p_siPeenDepth = property( 'float' );
const p_siFlake = property( 'float' );
const p_siRust = property( 'float' );
const p_siRough = property( 'float' );
const p_slHide = property( 'vec3' );
const p_slRub = property( 'vec3' );
const p_slCreases = property( 'float' );
const p_slCreaseDepth = property( 'float' );
const p_slPebble = property( 'float' );
const p_slOil = property( 'float' );
const p_qwDeep = property( 'vec3' );
const p_qwScum = property( 'vec3' );
const p_qwScumCover = property( 'float' );
const p_qwRipple = property( 'float' );
const p_qwStir = property( 'float' );
const p_qwDrift = property( 'float' );
const p_qwCycle = property( 'float' );
const p_qwSheen = property( 'float' );
const p_opColour = property( 'vec3' );
const p_opRim = property( 'vec3' );
const p_opThrough = property( 'float' );
const p_opRough = property( 'float' );
const p_opGrain = property( 'float' );
const p_opGlow = property( 'float' );
const t_rockCol = property( 'int' );
const t_rockDisp = property( 'int' );
const t_rockNrm = property( 'int' );
const t_mortCol = property( 'int' );
const t_mortDisp = property( 'int' );
const t_woodCol = property( 'int' );
const t_woodDisp = property( 'int' );
const t_woodNrm = property( 'int' );
const t_woodRough = property( 'int' );
const t_col = property( 'int' );
const t_nrm = property( 'int' );
const t_rough = property( 'int' );
const csNoise = B.csNoise;

export const csTN = /*@__PURE__*/ Fn( ( [ p ] ) => {

	return csNoise.sample( p.div( 32.0 ) ).r;

}, 'float' );

const csCourses = B.csCourses;

export const csU = /*@__PURE__*/ Fn( ( [ x_immutable ] ) => {

	const x = x_immutable.toVar();
	x.bitXorAssign( x.shiftRight( 16 ) );
	x.mulAssign( 0x7feb352d );
	x.bitXorAssign( x.shiftRight( 15 ) );
	x.mulAssign( 0x846ca68b );
	x.bitXorAssign( x.shiftRight( 16 ) );

	return x;

}, 'uint' );

// a number from 0 to 1 drawn from four whole numbers and the seed

export const csH = /*@__PURE__*/ Fn( ( [ a, b, c, d ] ) => {

	const h = csU( uint( a.add( 0x40000000 ) ).bitXor( csU( uint( b.add( 0x40000000 ) ).bitXor( csU( uint( c.add( 0x40000000 ) ).bitXor( csU( uint( d.add( 0x40000000 ) ).add( uint( p_seed ).mul( 0x9e3779b9 ) ) ) ) ) ) ) ) );

	return float( h ).div( 4294967295.0 );

}, 'float' );

// the course holding height v in the row's table: its number, its foot and the next one's foot

export const csCourse = /*@__PURE__*/ Fn( ( [ row, v, c_immutable, b0_immutable, b1_immutable ] ) => {

	const b1 = b1_immutable;
	const b0 = b0_immutable;
	const c = c_immutable;
	const lo = int( 0 );
	const hi = int( 255 );

	Loop( { start: 0, end: 8, name: 's' }, () => {

		const mid = lo.add( hi ).add( 1 ).div( 2 );

		If( csCourses.sample( ivec2( mid, row ) ).setSampler( false ).r.lessThanEqual( v ), () => {

			lo.assign( mid );

		} ).Else( () => {

			hi.assign( mid.sub( 1 ) );

		} );

	} );

	c.assign( lo );
	b0.assign( csCourses.sample( ivec2( lo, row ) ).setSampler( false ).r );
	b1.assign( csCourses.sample( ivec2( min( lo.add( 1 ), 255 ), row ) ).setSampler( false ).r );

}, 'void' );

// the row's building's walls' thickness, kept in the course table after its courses

export const csWallDepth = /*@__PURE__*/ Fn( ( [ row ] ) => {

	return csCourses.sample( ivec2( 256, row ) ).setSampler( false ).r;

}, 'float' );

// the k-th of n joints across a stretch cut into n stones, in stones from its start: each inner joint moved by
// up to jit / 2 of a stone each way, so each stone is (1 ± jit) of the mean

export const csJ = /*@__PURE__*/ Fn( ( [ k, n, jit, vS1, vS2 ] ) => {

	If( k.lessThanEqual( 0 ), () => {

		return 0.0;

	} );

	If( k.greaterThanEqual( n ), () => {

		return float( n );

	} );

	return float( k ).add( csH( k, vS1, vS2, 3 ).sub( 0.5 ).mul( jit ) );

}, 'float' );

// the stretch from a to b cut into stones of mean length (1 ± jit): the stone i holding x, of n, from vS0 to e0

export const csPart = /*@__PURE__*/ Fn( ( [ a, b, x, mean, jit, vS1, vS2, i_immutable, n_immutable, vS0_immutable, e0_immutable ] ) => {

	const e0 = e0_immutable;
	const vS0 = vS0_immutable.toVar();
	const n = n_immutable;
	const i = i_immutable;
	const L = b.sub( a );
	n.assign( max( 1, int( floor( L.div( mean ).add( 0.5 ) ) ) ) );
	const t = x.sub( a ).div( L ).mul( float( n ) );
	i.assign( clamp( int( floor( t ) ), 0, n.sub( 1 ) ) );

	If( t.lessThan( csJ( i, n, jit, vS1, vS2 ) ), () => {

		i.assign( max( i.sub( 1 ), 0 ) );

	} ).ElseIf( t.greaterThan( csJ( i.add( 1 ), n, jit, vS1, vS2 ) ), () => {

		i.assign( min( i.add( 1 ), n.sub( 1 ) ) );

	} );

	vS0.assign( a.add( csJ( i, n, jit, vS1, vS2 ).mul( L ).div( float( n ) ) ) );
	e0.assign( a.add( csJ( i.add( 1 ), n, jit, vS1, vS2 ).mul( L ).div( float( n ) ) ) );

}, 'void' );

const CsCell = struct( {
	id: 'float',
	box: 'vec4',
	off: 'float',
	arris: 'vec4',
	p: 'vec2',
	size: 'vec2'
}, 'CsCell' );

// the place along the face the stones are cut on: a round wall's turned by its course's start, a box's face held
// to its length

export const csQx = /*@__PURE__*/ Fn( ( [ x, off ] ) => {

	const kind = int( vS2.x.add( 0.5 ) );

	If( kind.equal( 2 ), () => {

		return mod( x.add( off ), vS2.z );

	} );

	If( kind.equal( 1 ).or( kind.equal( 4 ) ), () => {

		return x;

	} );

	return clamp( x, 0.0, vS2.z );

}, 'float' );

// the stone at the place q on this face: its number, its box on the face (x0, y0, x1, y1, along the place
// csQx gives), its course's start round a round wall, and which of its sides (left, right, foot, top) are the
// building's corner or a cut, not a joint

export const csCell = /*@__PURE__*/ Fn( ( [ q ] ) => {

	const C = CsCell();
	const kind = int( vS2.x.add( 0.5 ) );
	const f = int( vS2.y.add( 0.5 ) );
	const W = vS2.z;
	const w = int( vS2.w.add( 0.5 ) );
	const row = w.mod( 256 );
	const mean = mul( 0.5, p_stoneMin.add( p_stoneMax ) );
	const jit = clamp( p_stoneMax.sub( p_stoneMin ).div( max( p_stoneMax.add( p_stoneMin ), 1e-3 ) ), 0.0, 0.95 );
	const aL = bool( false ).toVar(), aR = bool( false ).toVar();
	const x0 = property( 'float' ), x1 = property( 'float' ), y0 = property( 'float' ), y1 = property( 'float' ), qx = q.x;
	const i = property( 'int' ), n = property( 'int' );
	const id = property( 'float' );
	C.get( 'off' ).assign( 0.0 );

	If( kind.equal( 4 ), () => {

		// a face of an arch's stone: the stone from 0 to vS3.x up v, and along u from 0 to vS2.z at its foot and vS3.y at
		// its top, straight between (csStoneAt takes its length at the place); its number the stone's times 16 and which
		// of its sides are an arris (left 1, right 2, foot 4, top 8), the rest joints

		const a = f.mod( 16 );
		C.get( 'id' ).assign( csH( w, f.div( 16 ), 0, 25 ) );
		C.get( 'box' ).assign( vec4( 0.0, 0.0, max( W, vS3.y ), vS3.x ) );
		C.get( 'arris' ).assign( vec4( float( a.bitAnd( 1 ) ), float( a.shiftRight( 1 ).bitAnd( 1 ) ), float( a.shiftRight( 2 ).bitAnd( 1 ) ), float( a.shiftRight( 3 ).bitAnd( 1 ) ) ) );

		return C;

	} );

	If( kind.equal( 1 ), () => {

		// a slab: rows up its v, stones along its u, in 16 m squares

		const mr = mul( 0.5, p_rowMin.add( p_rowMax ) );
		const jr = clamp( p_rowMax.sub( p_rowMin ).div( max( p_rowMax.add( p_rowMin ), 1e-3 ) ), 0.0, 0.95 );
		const ci = int( floor( q.y.div( 16.0 ) ) );
		csPart( float( ci ).mul( 16.0 ), float( ci ).mul( 16.0 ).add( 16.0 ), q.y, mr, jr, w, ci.mul( 7 ).add( 1 ), i, n, y0, y1 );
		const r = ci.mul( 64 ).add( i );
		const ui = int( floor( q.x.div( 16.0 ) ) );
		const k = property( 'int' );
		csPart( float( ui ).mul( 16.0 ), float( ui ).mul( 16.0 ).add( 16.0 ), q.x, mean, jit, w, r.mul( 131 ).add( ui ).add( 5 ), k, n, x0, x1 );
		id.assign( csH( w, r, ui.mul( 256 ).add( k ), 21 ) );

	} ).Else( () => {

		const c = property( 'int' );
		csCourse( row, q.y, c, y0, y1 );

		If( kind.equal( 2 ), () => {

			// round: the whole way round, from a place drawn for each course

			C.get( 'off' ).assign( csH( w, c.mul( 16 ).add( f ), 0, 41 ).mul( W ) );
			qx.assign( mod( q.x.add( C.get( 'off' ) ), W ) );
			csPart( 0.0, W, qx, mean, jit, w, c.mul( 16 ).add( f ), i, n, x0, x1 );
			id.assign( csH( w, c.mul( 16 ).add( f ), i, 22 ) );

		} ).Else( () => {

			qx.assign( clamp( q.x, 0.0, W ) );
			const through = kind.equal( 3 ).or( c.add( f ).mod( 2 ).equal( 0 ) );
			const depth = csWallDepth( row );

			If( through.not().and( W.lessThan( mul( 2.0, depth ).add( 0.3 ) ) ), () => {

				// a face too short for the corner stones of its sides and a stone between: one stone, both corners'

				x0.assign( 0.0 );
				x1.assign( W );
				aL.assign( true );
				aR.assign( true );
				id.assign( csH( w, c, add( 1000, f ), 23 ) );

			} ).ElseIf( through, () => {

				csPart( 0.0, W, qx, mean, jit, w, c.mul( 16 ).add( f ), i, n, x0, x1 );
				aL.assign( kind.equal( 0 ).and( i.equal( 0 ) ) );
				aR.assign( kind.equal( 0 ).and( i.equal( n.sub( 1 ) ) ) );
				id.assign( select( aL, csH( w, c, add( 1000, f ), 23 ), select( aR, csH( w, c, add( 1000, f.add( 1 ).mod( 4 ) ), 23 ), csH( w, c, f.mul( 512 ).add( i ), 24 ) ) ) );

			} ).ElseIf( qx.lessThan( depth ), () => {

				// the end of the corner stone that runs through on the face before

				x0.assign( 0.0 );
				x1.assign( depth );
				aL.assign( true );
				id.assign( csH( w, c, add( 1000, f ), 23 ) );

			} ).ElseIf( qx.greaterThan( W.sub( depth ) ), () => {

				x0.assign( W.sub( depth ) );
				x1.assign( W );
				aR.assign( true );
				id.assign( csH( w, c, add( 1000, f.add( 1 ).mod( 4 ) ), 23 ) );

			} ).Else( () => {

				csPart( depth, W.sub( depth ), qx, mean, jit, w, c.mul( 16 ).add( f ), i, n, x0, x1 );
				id.assign( csH( w, c, f.mul( 512 ).add( i ), 24 ) );

			} );

		} );

	} );

	C.get( 'id' ).assign( id );
	C.get( 'box' ).assign( vec4( x0, y0, x1, y1 ) );
	C.get( 'arris' ).assign( vec4( select( aL, 1.0, 0.0 ), select( aR, 1.0, 0.0 ), 0.0, 0.0 ) );

	If( vS3.x.greaterThan( - 1e3 ), () => {

		C.get( 'arris' ).xy.assign( vec2( 1.0 ) );

	} );

	If( vS3.y.greaterThan( - 1e3 ), () => {

		C.get( 'arris' ).zw.assign( vec2( 1.0 ) );

	} );

	return C;

}, 'CsCell' );

// the stone last found, kept while the places asked for stay in its box: the parallax's steps and the shadow's
// march mostly stay in one stone, so its course and its joints are worked out once

const csCache = CsCell();
const csHave = bool( false ).toVar();

export const csStoneAt = /*@__PURE__*/ Fn( ( [ q ] ) => {

	const qx = csQx( q.x, csCache.get( 'off' ) );

	If( bool( true ).or( qx.lessThan( csCache.get( 'box' ).x ) ).or( qx.greaterThan( csCache.get( 'box' ).z ) ).or( q.y.lessThan( csCache.get( 'box' ).y ) ).or( q.y.greaterThan( csCache.get( 'box' ).w ) ), () => {

		csCache.assign( csCell( q ) );

		qx.assign( csQx( q.x, csCache.get( 'off' ) ) );

	} );

	const C = csCache;
	C.get( 'size' ).assign( C.get( 'box' ).zw.sub( C.get( 'box' ).xy ) );
	C.get( 'p' ).assign( vec2( qx, q.y ).sub( C.get( 'box' ).xy ) );

	If( int( vS2.x.add( 0.5 ) ).equal( 4 ), () => {

		// an arch's stone: its length along u at this place up it

		C.get( 'size' ).x.assign( mix( vS2.z, vS3.y, clamp( C.get( 'p' ).y.div( max( C.get( 'size' ).y, 1e-6 ) ), 0.0, 1.0 ) ) );

	} ).Else( () => {

		If( vS3.x.greaterThan( - 1e3 ), () => {

			C.get( 'p' ).x.assign( mul( 0.5, C.get( 'size' ).x ) );

		} );

		If( vS3.y.greaterThan( - 1e3 ), () => {

			C.get( 'p' ).y.assign( mul( 0.5, C.get( 'size' ).y ) );

		} );

	} );

	return C;

}, 'CsCell' );

// how far in from its nearest joint a place in the stone is, its corners rounded, less half the joint

export const csEdge = /*@__PURE__*/ Fn( ( [ C ] ) => {

	const dl = select( C.get( 'arris' ).x.greaterThan( 0.5 ), 1e3, C.get( 'p' ).x );
	const dr = select( C.get( 'arris' ).y.greaterThan( 0.5 ), 1e3, C.get( 'size' ).x.sub( C.get( 'p' ).x ) );
	const db = select( C.get( 'arris' ).z.greaterThan( 0.5 ), 1e3, C.get( 'p' ).y );
	const dt = select( C.get( 'arris' ).w.greaterThan( 0.5 ), 1e3, C.get( 'size' ).y.sub( C.get( 'p' ).y ) );
	const dx = min( dl, dr ), dy = min( db, dt );
	const r = p_corner;
	const d = select( dx.lessThan( r ).and( dy.lessThan( r ) ), r.sub( length( vec2( r.sub( dx ), r.sub( dy ) ) ) ), min( dx, dy ) );

	return d.sub( mul( 0.5, p_joint ) );

}, 'float' );

// a building's own colour for the solids view: a hue from its row, castle-ng's saturation and brightness

export const csSolidColour = /*@__PURE__*/ Fn( ( [ row ] ) => {

	const h = fract( float( row ).mul( 0.61803 ).add( 0.13 ) );
	const k = clamp( abs( mod( h.mul( 6.0 ).add( vec3( 0.0, 4.0, 2.0 ) ), 6.0 ).sub( 3.0 ) ).sub( 1.0 ), 0.0, 1.0 );
	const srgb = mul( 0.85, mix( vec3( 1.0 ), k, 0.6 ) );

	return pow( srgb, vec3( 2.2 ) );

}, 'vec3' );

// what a wall look works out for the lighting: the face's ways, its normal, the normal found, the place the
// parallax found and its height, the parallax's fade

const csT = property( 'vec3' ), csB = property( 'vec3' ), csNg = property( 'vec3' ), csNts = property( 'vec3' );
const csUvP = property( 'vec2' );
const csZ = property( 'float' ), csFade = property( 'float' );
const cbRand = B.cbRand;

export const htGlow = /*@__PURE__*/ Fn( ( [ t_immutable ] ) => {

	const t = t_immutable.toVar();
	t.assign( clamp( t, 0.0, 1.0 ) );
	const c = mix( vec3( 0.0 ), vec3( 0.28, 0.012, 0.0 ), smoothstep( 0.12, 0.25, t ) );
	c.assign( mix( c, vec3( 0.85, 0.07, 0.005 ), smoothstep( 0.25, 0.42, t ) ) );
	c.assign( mix( c, vec3( 1.5, 0.32, 0.02 ), smoothstep( 0.42, 0.62, t ) ) );
	c.assign( mix( c, vec3( 1.9, 0.8, 0.07 ), smoothstep( 0.62, 0.82, t ) ) );
	c.assign( mix( c, vec3( 2.6, 2.0, 1.0 ), smoothstep( 0.82, 1.0, t ) ) );

	return c;

}, 'vec3' );

const csRockLod = property( 'float' ), csMortLod = property( 'float' );

const CsS = struct( {
	h: 'float',
	d: 'float',
	id: 'float',
	tuv: 'vec2',
	stone: 'float'
}, 'CsS' );

// the wall's height at the place uv on this face (0 its proudest, down to -Relief depth): the stone's face, its
// rounded and chipped edges, its bulge and tilt and the rock's grain; the mortar's recess between

export const csSample = /*@__PURE__*/ Fn( ( [ uv ] ) => {

	// a cut's place where it gives one; an arch's stone's face (kind 4) its own place, vS3 its stone's box

	const q = select( int( vS2.x.add( 0.5 ) ).equal( 4 ), uv, vec2( select( vS3.x.greaterThan( - 1e3 ), vS3.x, uv.x ), select( vS3.y.greaterThan( - 1e3 ), vS3.y, uv.y ) ) );
	const C = csStoneAt( q );

	// the edges' chips: the rock's own relief, on a patch of its own for each stone

	const g = uv.add( vec2( C.get( 'id' ).mul( 53.0 ), fract( C.get( 'id' ).mul( 7.31 ) ).mul( 41.0 ) ) );
	const warp = csNoise.sample( g.mul( 0.6 ) ).level( 0.0 ).r.sub( 0.5 ).mul( 3.0 ).mul( p_chip );
	const d = csEdge( C ).add( warp );
	const tuv = uv.add( vec2( C.get( 'id' ).mul( 97.13 ), fract( C.get( 'id' ).mul( 7.31 ) ).mul( 61.7 ) ) ).div( p_rockScale );
	const rock = picDataLod( t_rockDisp, tuv, csRockLod ).r;
	const n01 = clamp( C.get( 'p' ).div( max( C.get( 'size' ), vec2( 1e-3 ) ) ), 0.0, 1.0 ).mul( 2.0 ).sub( 1.0 );
	const pillow = sub( 1.0, mul( 0.6, n01.x ).mul( n01.x ) ).mul( sub( 1.0, n01.y.mul( n01.y ) ) );

	// the face: its proudest place at 0, rounded down at its edges, bulged, tilted, grained

	const hs = p_edgeDrop.negate().mul( pow( sub( 1.0, smoothstep( 0.0, p_edgeRound, d ) ), 2.0 ) ).sub( p_bulge.mul( sub( 1.0, pillow ) ) ).add( rock.sub( 0.5 ).mul( p_detail ) ).sub( mul( 0.5, p_detail ) ).add( fract( C.get( 'id' ).mul( 131.7 ) ).sub( 0.5 ).add( fract( C.get( 'id' ).mul( 71.3 ) ).sub( 0.5 ).mul( n01.x ) ).add( fract( C.get( 'id' ).mul( 37.9 ) ).sub( 0.5 ).mul( n01.y ) ).sub( 1.0 ).mul( p_tilt ) );
	const hm = p_recess.negate().add( picDataLod( t_mortDisp, uv.div( p_mortScale ), csMortLod ).r.sub( 0.5 ).mul( 0.006 ) );
	const S = CsS();

	// a stone where it is in from its joint

	S.get( 'stone' ).assign( select( d.greaterThan( 0.0 ), 1.0, 0.0 ) );
	S.get( 'h' ).assign( clamp( select( d.greaterThan( 0.0 ), max( hs, hm ), hm ), p_pom.negate(), 0.0 ) );
	S.get( 'd' ).assign( d );
	S.get( 'id' ).assign( C.get( 'id' ) );
	S.get( 'tuv' ).assign( tuv );

	return S;

}, 'CsS' );

const cwLod = property( 'float' );

const CwS = struct( {
	h: 'float',
	d: 'float',
	id: 'float',
	tuv: 'vec2',
	board: 'float',
	end: 'float',
	p: 'vec2',
	size: 'vec2'
}, 'CwS' );

// whether a board is the end of a corner board running through on the face before or after: its end grain shows

export const cwSample = /*@__PURE__*/ Fn( ( [ uv ] ) => {

	// a cut's place where it gives one; an arch's stone's face (kind 4) its own place, vS3 its stone's box

	const q = select( int( vS2.x.add( 0.5 ) ).equal( 4 ), uv, vec2( select( vS3.x.greaterThan( - 1e3 ), vS3.x, uv.x ), select( vS3.y.greaterThan( - 1e3 ), vS3.y, uv.y ) ) );
	const C = csStoneAt( q );
	const d = csEdge( C );
	const kind = int( vS2.x.add( 0.5 ) );
	const isEnd = kind.equal( 0 ).and( C.get( 'arris' ).x.greaterThan( 0.5 ).or( C.get( 'arris' ).y.greaterThan( 0.5 ) ) ).and( C.get( 'size' ).x.lessThanEqual( csWallDepth( int( vS2.w.add( 0.5 ) ).mod( 256 ) ).add( 0.001 ) ) );

	// the grain along u (up the board on an end, so its rings are drawn instead), each board its own patch

	const tuv = uv.add( vec2( C.get( 'id' ).mul( 97.13 ), fract( C.get( 'id' ).mul( 7.31 ) ).mul( 61.7 ) ) ).div( p_grainScale );
	const grain = picDataLod( t_woodDisp, tuv, cwLod ).r;
	const n01 = clamp( C.get( 'p' ).div( max( C.get( 'size' ), vec2( 1e-3 ) ) ), 0.0, 1.0 ).mul( 2.0 ).sub( 1.0 );

	// the board's face: its proudest at 0, rounded down at its edges, cupped across, tilted, grained

	const hs = p_edgeDrop.negate().mul( pow( sub( 1.0, smoothstep( 0.0, p_edgeRound, d ) ), 2.0 ) ).sub( p_cup.mul( n01.y ).mul( n01.y ) ).add( select( isEnd, 0.0, grain.sub( 0.5 ).mul( p_grain ).sub( mul( 0.5, p_grain ) ) ) ).add( fract( C.get( 'id' ).mul( 131.7 ) ).sub( 0.5 ).add( fract( C.get( 'id' ).mul( 37.9 ) ).sub( 0.5 ).mul( n01.y ) ).sub( 1.0 ).mul( p_tilt ) );
	const S = CwS();
	S.get( 'board' ).assign( select( d.greaterThan( 0.0 ), 1.0, 0.0 ) );
	S.get( 'h' ).assign( clamp( select( d.greaterThan( 0.0 ), hs, p_gap.negate() ), p_pom.negate(), 0.0 ) );
	S.get( 'd' ).assign( d );
	S.get( 'id' ).assign( C.get( 'id' ) );
	S.get( 'tuv' ).assign( tuv );
	S.get( 'end' ).assign( select( isEnd, 1.0, 0.0 ) );
	S.get( 'p' ).assign( C.get( 'p' ) );
	S.get( 'size' ).assign( C.get( 'size' ) );

	return S;

}, 'CwS' );

// the pixel's size on the ground (m), set before any sampling

const cbFp = float( 0.001 );

// noise at the place p (m) with features 1/f m across, blurred to no finer than the pixel: csNoise has 8 texels to a
// unit, so f units to the metre is 8 f texels to the metre

export const cbN = /*@__PURE__*/ Fn( ( [ p, f ] ) => {

	return csNoise.sample( p.mul( f ).div( 32.0 ) ).level( log2( max( cbFp.mul( f ).mul( 8.0 ), 1.0 ) ) ).r;

}, 'float' );

// the four random numbers of the cobble cell c

export const cbR = /*@__PURE__*/ Fn( ( [ c ] ) => {

	const s = ivec2( int( p_seed ).mul( 37 ), int( p_seed ).mul( 91 ) );

	return cbRand.sample( c.add( s ).bitAnd( 255 ) ).setSampler( false );

}, 'vec4' );

// a cell's seed, in cells from its corner

export const cbSeed = /*@__PURE__*/ Fn( ( [ r ] ) => {

	return add( 0.5, r.xy.sub( 0.5 ).mul( p_jitter ) );

}, 'vec2' );

// the cobble at the place q (metres on the ground): how far in from its edge (d, m), how far from its seed (r, m),
// its numbers, its seed's place (m). The nine seeds round the place are read once; the nearest is the cobble, and
// its edge is the nearest of the lines halfway to the other eight, joined by a smooth minimum Corner round wide,
// so the cobble's corners are rounded, not a polygon's.

const CbCell = struct( {
	d: 'float',
	r: 'float',
	rnd: 'vec4',
	middle: 'vec2'
}, 'CbCell' );

export const cbCell = /*@__PURE__*/ Fn( ( [ q ] ) => {

	const sc = p_size.mul( vec2( p_stretch, 1.0 ) );
	const x = q.div( sc );
	const n = floor( x ), f = x.sub( n );
	const ni = ivec2( n );
	const o = property( 'vec2' );
	const rr = property( 'vec4' );
	const md = float( 8.0 );
	const mk = int( 4 );

	Loop( { start: 0, end: 3, name: 'j' }, ( { j } ) => {

		Loop( 3, ( { i } ) => {

			const r = cbR( ni.add( ivec2( i.sub( 1 ), j.sub( 1 ) ) ) );
			const rel = vec2( i.sub( 1 ), j.sub( 1 ) ).add( cbSeed( r ) ).sub( f );
			rr.element( j.mul( 3 ).add( i ) ).assign( r );
			o.element( j.mul( 3 ).add( i ) ).assign( rel );
			const d = dot( rel.mul( sc ), rel.mul( sc ) );

			If( d.lessThan( md ), () => {

				md.assign( d );
				mk.assign( j.mul( 3 ).add( i ) );

			} );

		} );

	} );

	const mr = o.element( mk );
	const a = mr.mul( sc );
	const kk = max( p_corner, 1e-4 );
	const bd = float( 8.0 );

	Loop( { start: 0, end: 9, name: 'k' }, ( { k } ) => {

		If( k.equal( mk ), () => {

			Continue();

		} );

		const b = o.element( k ).mul( sc );
		bd.assign( min( bd, dot( mul( 0.5, a.add( b ) ), normalize( b.sub( a ) ) ) ) );

	} );

	// the smooth minimum, worked from the hard one so exp never overflows

	const sum = float( 0.0 );

	Loop( { start: 0, end: 9, name: 'k' }, ( { k } ) => {

		If( k.equal( mk ), () => {

			Continue();

		} );

		const b = o.element( k ).mul( sc );
		sum.addAssign( exp( dot( mul( 0.5, a.add( b ) ), normalize( b.sub( a ) ) ).sub( bd ).negate().div( kk ) ) );

	} );

	const C = CbCell();
	C.get( 'd' ).assign( bd.sub( kk.mul( log( sum ) ) ) );
	C.get( 'r' ).assign( length( a ) );
	C.get( 'rnd' ).assign( rr.element( mk ) );
	C.get( 'middle' ).assign( q.add( a ) );

	return C;

}, 'CbCell' );

const CbS = struct( {
	h: 'float',
	d: 'float',
	t: 'float',
	rnd: 'vec4',
	stone: 'float',
	moss: 'float',
	mossH: 'float'
}, 'CbS' );

// the path's height at q (0 its proudest, down to the sand's depth): the cobble's face domed, worn flat at its top,
// rounded and chipped at its edge, sunk and tilted in its bed, roughened; the sand between

export const cbSample = /*@__PURE__*/ Fn( ( [ q ] ) => {

	const C = cbCell( q );
	const warp = cbN( q.add( C.get( 'rnd' ).zw.mul( 50.0 ) ), 22.0 ).sub( 0.5 ).mul( 3.0 ).mul( p_chip );
	const d = C.get( 'd' ).sub( mul( 0.5, p_joint ) ).add( warp );

	// 0 at the cobble's seed, 1 at its edge

	const t = clamp( C.get( 'r' ).div( max( C.get( 'r' ).add( max( C.get( 'd' ), 0.0 ) ), 1e-4 ) ), 0.0, 1.0 );
	const tf = max( t.sub( p_flat ), 0.0 ).div( max( sub( 1.0, p_flat ), 1e-3 ) );
	const lean = vec2( C.get( 'rnd' ).z, C.get( 'rnd' ).w ).sub( 0.5 ).mul( 2.0 );
	const hs = p_dome.negate().mul( tf ).mul( tf ).sub( p_edgeDrop.mul( pow( sub( 1.0, smoothstep( 0.0, p_edgeRound, d ) ), 2.0 ) ) ).sub( p_sink.mul( add( 0.5, mul( 0.5, cos( C.get( 'rnd' ).z.mul( 40.0 ) ) ) ) ) ).sub( p_sink.mul( 0.25 ) ).add( dot( lean, q.sub( C.get( 'middle' ) ).div( p_size ) ).mul( p_tilt ) ).sub( p_tilt ).add( cbN( q.add( C.get( 'rnd' ).xy.mul( 37.0 ) ), 45.0 ).sub( 0.5 ).mul( 2.0 ).mul( p_detail ) ).sub( mul( 0.5, p_detail ) );
	const hm = p_recess.negate().add( cbN( q, 160.0 ).sub( 0.5 ).mul( 0.006 ) );
	const S = CbS();
	S.get( 'stone' ).assign( select( d.greaterThan( 0.0 ).and( hs.greaterThan( hm ) ), 1.0, 0.0 ) );
	const base = select( d.greaterThan( 0.0 ), max( hs, hm ), hm );

	// the moss: a layer over the cobbles and the sand, in patches Moss patch size across. Where it grows: the joints
	// first, then the cobbles' edges, then (Moss on tops) over their faces. It fills the joints toward the cobbles'
	// shoulders and lies Moss depth thick in lumpy cushions over the rest.

	const spread = cbN( q.add( 11.3 ), div( 1.0, p_mossScale ) ).mul( 0.65 ).add( cbN( q.add( 3.7 ), div( 3.0, p_mossScale ) ).mul( 0.35 ) );
	const edge = sub( 1.0, smoothstep( 0.0, p_edgeRound.mul( 2.0 ), d ) );
	const want = select( S.get( 'stone' ).greaterThan( 0.5 ), mix( p_mossTop, 1.0, edge.mul( 0.8 ) ), 1.0 );
	const thr = sub( 1.0, p_mossCover );
	S.get( 'moss' ).assign( smoothstep( thr.sub( 0.12 ), thr.add( 0.12 ), spread.mul( add( 0.55, mul( 0.45, want ) ) ).add( mul( 0.25, want ) ).sub( 0.25 ) ) );
	const lump = cbN( q.add( 5.1 ), 90.0 ).mul( 0.6 ).add( cbN( q.add( 9.9 ), 30.0 ).mul( 0.4 ) );
	const fill = sub( 1.0, S.get( 'stone' ) ).mul( 0.45 ).mul( p_recess ).mul( smoothstep( 0.0, p_edgeRound, d.negate().add( 0.004 ) ) );
	S.get( 'mossH' ).assign( S.get( 'moss' ).mul( p_mossDepth.mul( add( 0.45, mul( 0.75, lump ) ) ).add( fill ) ) );
	S.get( 'h' ).assign( base.sub( p_mossDepth ).add( S.get( 'mossH' ) ) );
	S.get( 'd' ).assign( d );
	S.get( 't' ).assign( t );
	S.get( 'rnd' ).assign( C.get( 'rnd' ) );

	return S;

}, 'CbS' );

// the place a stone's courses are laid by: along the face level, and up it; a level face takes the world's plan

export const ssPlace = /*@__PURE__*/ Fn( ( [ p, n ] ) => {

	If( abs( n.y ).greaterThan( 0.72 ), () => {

		return p.xz;

	} );

	const h = normalize( n.xz );

	return vec2( dot( p.xz, vec2( h.y.negate(), h.x ) ), p.y );

}, 'vec2' );

// the temper colours steel runs through as it heats, cold to burnt

export const siTemper = /*@__PURE__*/ Fn( ( [ t ] ) => {

	const c = mix( vec3( 1.0 ), vec3( 1.25, 1.05, 0.6 ), smoothstep( 0.05, 0.25, t ) );
	c.assign( mix( c, vec3( 1.1, 0.6, 0.3 ), smoothstep( 0.25, 0.45, t ) ) );
	c.assign( mix( c, vec3( 0.6, 0.3, 0.75 ), smoothstep( 0.45, 0.62, t ) ) );
	c.assign( mix( c, vec3( 0.35, 0.5, 1.1 ), smoothstep( 0.62, 0.78, t ) ) );

	return mix( c, vec3( 0.35, 0.3, 0.3 ), smoothstep( 0.78, 1.0, t ) );

}, 'vec3' );

// the scum at one phase of its drift: soft rafts, their edges ragged

export const qwScumAt = /*@__PURE__*/ Fn( ( [ uv, phase, seed ] ) => {

	const q = uv.add( vec2( 0.7, 0.4 ).mul( p_qwDrift ).mul( phase ).mul( p_qwCycle ) );

	return smoothstep( sub( 1.0, p_qwScumCover ), sub( 1.0, p_qwScumCover ).add( 0.12 ), kfbm( q.mul( 7.0 ).add( seed ) ).add( mul( 0.15, kfbm( q.mul( 40.0 ).add( seed ).add( 3.0 ) ) ) ).sub( 0.07 ) );

}, 'float' );

export const look_0 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_stoneMin.assign( lookSettings.sample( ivec2( 0, 0 ) ).setSampler( false ).r );
	p_stoneMax.assign( lookSettings.sample( ivec2( 1, 0 ) ).setSampler( false ).r );
	p_rowMin.assign( lookSettings.sample( ivec2( 2, 0 ) ).setSampler( false ).r );
	p_rowMax.assign( lookSettings.sample( ivec2( 3, 0 ) ).setSampler( false ).r );
	p_joint.assign( lookSettings.sample( ivec2( 4, 0 ) ).setSampler( false ).r );
	p_seed.assign( lookSettings.sample( ivec2( 5, 0 ) ).setSampler( false ).r );
	p_recess.assign( lookSettings.sample( ivec2( 6, 0 ) ).setSampler( false ).r );
	p_edgeRound.assign( lookSettings.sample( ivec2( 7, 0 ) ).setSampler( false ).r );
	p_edgeDrop.assign( lookSettings.sample( ivec2( 8, 0 ) ).setSampler( false ).r );
	p_corner.assign( lookSettings.sample( ivec2( 9, 0 ) ).setSampler( false ).r );
	p_chip.assign( lookSettings.sample( ivec2( 10, 0 ) ).setSampler( false ).r );
	p_bulge.assign( lookSettings.sample( ivec2( 11, 0 ) ).setSampler( false ).r );
	p_tilt.assign( lookSettings.sample( ivec2( 12, 0 ) ).setSampler( false ).r );
	p_detail.assign( lookSettings.sample( ivec2( 13, 0 ) ).setSampler( false ).r );
	p_detailNormal.assign( lookSettings.sample( ivec2( 14, 0 ) ).setSampler( false ).r );
	p_valueVar.assign( lookSettings.sample( ivec2( 15, 0 ) ).setSampler( false ).r );
	p_warm.assign( lookSettings.sample( ivec2( 16, 0 ) ).setSampler( false ).r );
	p_dark.assign( lookSettings.sample( ivec2( 17, 0 ) ).setSampler( false ).r );
	p_mottle.assign( lookSettings.sample( ivec2( 18, 0 ) ).setSampler( false ).r );
	p_grime.assign( lookSettings.sample( ivec2( 19, 0 ) ).setSampler( false ).r );
	p_damp.assign( lookSettings.sample( ivec2( 20, 0 ) ).setSampler( false ).r );
	p_moss.assign( lookSettings.sample( ivec2( 21, 0 ) ).setSampler( false ).r );
	p_rockContrast.assign( lookSettings.sample( ivec2( 22, 0 ) ).setSampler( false ).r );
	p_rockScale.assign( lookSettings.sample( ivec2( 23, 0 ) ).setSampler( false ).r );
	p_mortScale.assign( lookSettings.sample( ivec2( 24, 0 ) ).setSampler( false ).r );
	p_pom.assign( lookSettings.sample( ivec2( 25, 0 ) ).setSampler( false ).r );
	p_pomOn.assign( lookSettings.sample( ivec2( 26, 0 ) ).setSampler( false ).r );
	p_shadowOn.assign( lookSettings.sample( ivec2( 27, 0 ) ).setSampler( false ).r );
	p_stoneTint.assign( lookSettings.sample( ivec2( 28, 0 ) ).setSampler( false ).rgb );
	p_mortTint.assign( lookSettings.sample( ivec2( 29, 0 ) ).setSampler( false ).rgb );
	t_rockCol.assign( 0 );
	t_rockDisp.assign( 1 );
	t_rockNrm.assign( 2 );
	t_mortCol.assign( 3 );
	t_mortDisp.assign( 4 );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	csNg.assign( normalize( vNormal ) );
	csT.assign( normalize( vS0.sub( csNg.mul( dot( vS0, csNg ) ) ) ) );
	csB.assign( normalize( vS1.sub( csNg.mul( dot( vS1, csNg ) ) ).sub( csT.mul( dot( vS1, csT ) ) ) ) );
	const Vv = normalize( vViewPosition );
	const Vts = vec3( dot( Vv, csT ), dot( Vv, csB ), dot( Vv, csNg ) );
	const uv0 = vLookUv.toVar();
	const fw = abs( lookGx ).add( abs( lookGy ) );
	const fp = max( max( fw.x, fw.y ), 1e-6 );
	csRockLod.assign( log2( max( fp.div( p_rockScale ).mul( 1024.0 ), 1.0 ) ) );
	csMortLod.assign( log2( max( fp.div( p_mortScale ).mul( 1024.0 ), 1.0 ) ) );
	csFade.assign( p_pomOn.mul( sub( 1.0, smoothstep( 0.006, 0.03, fp ) ) ) );
	uv.assign( uv0 );
	const zr = float( 0.0 );
	const S = csSample( uv );

	If( csFade.greaterThan( 0.0 ), () => {

		const vz = max( Vts.z, 0.1 );

		// march down in coarse steps to the first below the surface, then halve the step four times between the
		// last above and the first below

		const steps = int( mix( 14.0, 4.0, clamp( Vts.z, 0.0, 1.0 ) ) );
		const dz = p_pom.div( float( steps ) );
		const duv = Vts.xy.negate().div( vz ).mul( dz ).mul( csFade );
		const puv = uv;
		const pz = float( 0.0 );

		Loop( 14, ( { i } ) => {

			If( i.greaterThanEqual( steps ).or( zr.lessThanEqual( S.get( 'h' ) ) ), () => {

				Break();

			} );

			puv.assign( uv );
			pz.assign( zr );
			uv.addAssign( duv );
			zr.subAssign( dz );
			S.assign( csSample( uv ) );

		} );

		If( zr.lessThanEqual( S.get( 'h' ) ), () => {

			const lo = puv, hi = uv;
			const zlo = pz, zhi = zr;

			Loop( 4, () => {

				const mu = mul( 0.5, lo.add( hi ) );
				const mz = mul( 0.5, zlo.add( zhi ) );
				const M = csSample( mu );

				If( mz.lessThanEqual( M.get( 'h' ) ), () => {

					hi.assign( mu );
					zhi.assign( mz );
					S.assign( M );

				} ).Else( () => {

					lo.assign( mu );
					zlo.assign( mz );

				} );

			} );

			uv.assign( hi );
			zr.assign( zhi );

		} );

		S.assign( csSample( uv ) );

	} );

	csUvP.assign( uv );
	csZ.assign( S.get( 'h' ) );

	// the normal from the height round the place, no finer than a pixel

	const e = max( 0.002, fp.mul( 0.75 ) );
	const hx = csSample( uv.add( vec2( e, 0.0 ) ) ).get( 'h' ).sub( S.get( 'h' ) );
	const hy = csSample( uv.add( vec2( 0.0, e ) ) ).get( 'h' ).sub( S.get( 'h' ) );
	const rn = picDataLod( t_rockNrm, S.get( 'tuv' ), csRockLod ).xyz.mul( 2.0 ).sub( 1.0 );
	csNts.assign( normalize( vec3( hx.negate().div( e ), hy.negate().div( e ), 1.0 ).add( vec3( rn.xy.mul( p_detailNormal ).mul( S.get( 'stone' ) ), 0.0 ) ) ) );

	// the colour: the rock's picture taken grey, tinted, each stone its own lightness and warmth; the mortar's the same

	const rockC = picColourLod( t_rockCol, S.get( 'tuv' ), csRockLod );
	const rl = mix( 1.0, dot( rockC, vec3( 0.2126, 0.7152, 0.0722 ) ).div( picMean( t_rockCol ) ), p_rockContrast );
	const h1 = fract( S.get( 'id' ).mul( 913.7 ) ), h2 = fract( S.get( 'id' ).mul( 271.3 ) ), h3 = fract( S.get( 'id' ).mul( 517.9 ) );
	const val = add( 1.0, h1.sub( 0.5 ).mul( 2.0 ).mul( p_valueVar ) );

	If( h3.lessThan( p_dark ), () => {

		val.mulAssign( 0.62 );

	} );

	const warm = h2.sub( 0.5 ).mul( 2.0 ).mul( p_warm );
	const mott = add( 1.0, csTN( uv.mul( 0.9 ).add( S.get( 'id' ).mul( 13.0 ) ) ).sub( 0.5 ).mul( 2.0 ).mul( p_mottle ) );
	const stoneC = p_stoneTint.mul( rl ).mul( val ).mul( mott ).mul( vec3( add( 1.0, mul( 0.16, warm ) ), add( 1.0, mul( 0.02, warm ) ), sub( 1.0, mul( 0.2, warm ) ) ) );
	const mortC = p_mortTint.mul( dot( picColourLod( t_mortCol, uv.div( p_mortScale ), csMortLod ), vec3( 0.2126, 0.7152, 0.0722 ) ) ).div( picMean( t_mortCol ) );
	const sm = S.get( 'stone' ).mul( smoothstep( fp.negate(), fp, S.get( 'd' ) ) );
	const col = mix( mortC, stoneC, sm );

	// the cavity: the mortar darker toward the stones' edges, the stones' edges darker as they round down

	const aoM = mix( 0.4, 0.85, smoothstep( 0.0, mul( 0.6, p_joint ).add( 0.004 ), S.get( 'd' ).negate() ) );
	const aoS = mix( 0.65, 1.0, smoothstep( 0.0, p_edgeRound.mul( 1.5 ), S.get( 'd' ) ) );
	k.get( 'ao' ).assign( mix( aoM, aoS, sm ) );
	k.get( 'aoDirect' ).assign( 0.35 );

	// streaks run down the walls, rising damp darkens their feet, moss in the damp and on the slabs

	const kind = int( vS2.x.add( 0.5 ) );
	const streak = select( kind.equal( 1 ), 0.0, smoothstep( 0.5, 0.85, csTN( vec2( uv.x.mul( 2.2 ), uv.y.mul( 0.1 ).add( csTN( vec2( uv.x.mul( 0.5 ), 7.0 ) ).mul( 3.0 ) ) ) ) ) );
	col.mulAssign( sub( 1.0, p_grime.mul( streak ).mul( 0.45 ) ) );
	col.assign( mix( col, col.mul( vec3( 0.92, 0.86, 0.76 ) ), p_grime.mul( streak ).mul( 0.6 ) ) );
	const dampM = sub( 1.0, smoothstep( 0.0, add( 0.5, mul( 1.6, csTN( vec2( uv.x.mul( 0.45 ), 3.0 ) ) ) ), vLookWorld.y ) );
	col.mulAssign( sub( 1.0, mul( 0.45, p_damp ).mul( dampM ) ) );
	col.assign( mix( col, col.mul( vec3( 0.85, 0.95, 0.75 ) ), p_damp.mul( dampM ).mul( 0.5 ) ) );
	const mossM = smoothstep( 0.52, 0.78, csTN( uv.mul( 1.7 ).add( 3.1 ) ) ).mul( clamp( dampM.mul( 0.9 ).add( select( kind.equal( 1 ), 0.7, 0.0 ) ).add( sub( 1.0, sm ).mul( 0.4 ) ), 0.0, 1.0 ) );
	mossM.assign( clamp( mossM.mul( p_moss ).mul( 1.6 ), 0.0, 1.0 ) );
	col.assign( mix( col, vec3( 0.05, 0.075, 0.02 ).mul( add( 0.7, mul( 0.6, rl ) ) ), mossM ) );
	k.get( 'rough' ).assign( mix( mix( 0.96, 0.86, sm ), 1.0, mossM ) );

	If( lookView.greaterThan( 0.5 ).and( lookView.lessThan( 1.5 ) ), () => {

		col.assign( mix( vec3( 0.6 ), vec3( h1, h2, h3 ), sm ) );

	} );

	If( lookView.greaterThan( 1.5 ).and( lookView.lessThan( 2.5 ) ), () => {

		col.assign( vec3( S.get( 'h' ).add( p_pom ).div( p_pom ) ) );

	} );

	If( lookView.greaterThan( 3.5 ), () => {

		col.assign( csSolidColour( int( vS2.w.add( 0.5 ) ).mod( 256 ) ) );

	} );

	k.get( 'colour' ).assign( col );
	k.get( 'normal' ).assign( normalize( mat3( csT, csB, csNg ).mul( csNts ) ) );
	k.get( 'ownNormal' ).assign( true );

}, 'void' );

export const look_1 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const strand = kn( vec2( uv.x.mul( 4.0 ).add( kn( uv.mul( 3.0 ) ).mul( 2.0 ) ), uv.y.mul( 120.0 ) ).add( seed ) );
	const strand2 = kn( vec2( uv.y.mul( 4.0 ).add( kn( uv.mul( 3.0 ).add( 5.0 ) ).mul( 2.0 ) ), uv.x.mul( 120.0 ) ).add( seed ).add( 9.0 ) );
	const top = max( strand, strand2 );
	k.get( 'colour' ).assign( mix( vec3( 0.35, 0.33, 0.18 ), vec3( 0.6, 0.55, 0.32 ), top ).mul( add( 0.85, mul( 0.2, kfbm( uv.mul( 4.0 ).add( seed ) ) ) ) ) );
	k.get( 'rough' ).assign( 0.95 );
	k.get( 'height' ).assign( mul( 0.003, top ) );

}, 'void' );

export const look_2 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const row = floor( uv.y.div( 0.2 ) );
	const inRow = fract( uv.y.div( 0.2 ) );
	const r = kring( vec2( uv.x, uv.y.add( row.mul( 1.7 ) ) ), seed.add( row ), 9.0 );
	const tone = kh1( row.add( seed ) );
	const joint = smoothstep( 0.0, 0.02, min( inRow, sub( 1.0, inRow ) ) );
	const scuff = smoothstep( 0.55, 0.85, kfbm( uv.mul( 1.5 ).add( seed ) ) ).mul( smoothstep( 0.5, 0.9, wn.y ) );
	const c = mix( vec3( 0.42, 0.29, 0.16 ), vec3( 0.55, 0.39, 0.22 ), tone ).mul( sub( 1.0, mul( 0.3, r ) ) );
	k.get( 'colour' ).assign( mix( c, c.mul( 1.25 ).add( 0.03 ), scuff.mul( 0.5 ) ).mul( mix( 0.4, 1.0, joint ) ) );
	k.get( 'rough' ).assign( mix( 0.65, 0.45, scuff ) );
	k.get( 'height' ).assign( float( -0.002 ).mul( sub( 1.0, joint ) ).sub( mul( 0.0003, r ) ) );

}, 'void' );

export const look_3 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const id = property( 'float' ), e = property( 'float' );
	const d = kvor( uv.mul( 1.6 ).add( seed ), id, e );
	const joint = smoothstep( 0.02, 0.05, e );
	const path = smoothstep( 0.6, 0.0, abs( wp.x.sub( floor( wp.x.div( 3.0 ) ).mul( 3.0 ) ).sub( 1.5 ) ) ).mul( smoothstep( 0.5, 0.9, wn.y ) );
	const c = mix( vec3( 0.42, 0.4, 0.36 ), vec3( 0.55, 0.52, 0.46 ), id ).mul( add( 0.88, mul( 0.2, kfbm( uv.mul( 5.0 ).add( id.mul( 9.0 ) ) ) ) ) );
	k.get( 'colour' ).assign( mix( vec3( 0.25, 0.23, 0.2 ), c.mul( add( 1.0, mul( 0.12, path ) ) ), joint ) );
	k.get( 'rough' ).assign( mix( 0.95, mix( 0.8, 0.45, path ), joint ) );
	k.get( 'height' ).assign( mix( - 0.008, mul( 0.002, kfbm( uv.mul( 4.0 ).add( id ) ).sub( 0.5 ) ).mul( sub( 1.0, path ) ), joint ) );

}, 'void' );

export const look_4 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const trodden = smoothstep( 0.4, 0.7, kfbm( uv.mul( 1.2 ).add( seed ) ) );
	const grit = kn( uv.mul( 500.0 ).add( seed ) ).mul( kfade( 0.002 ) );
	k.get( 'colour' ).assign( mix( vec3( 0.36, 0.28, 0.2 ), vec3( 0.28, 0.22, 0.16 ), trodden ).mul( add( 0.88, mul( 0.2, grit ) ) ) );
	k.get( 'rough' ).assign( mix( 0.95, 0.7, trodden ) );
	k.get( 'height' ).assign( mul( 0.002, kfbm( uv.mul( 8.0 ).add( seed ) ).sub( 0.5 ) ).mul( sub( 1.0, trodden ) ) );

}, 'void' );

export const look_5 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_stoneMin.assign( lookSettings.sample( ivec2( 0, 5 ) ).setSampler( false ).r );
	p_stoneMax.assign( lookSettings.sample( ivec2( 1, 5 ) ).setSampler( false ).r );
	p_rowMin.assign( lookSettings.sample( ivec2( 2, 5 ) ).setSampler( false ).r );
	p_rowMax.assign( lookSettings.sample( ivec2( 3, 5 ) ).setSampler( false ).r );
	p_joint.assign( lookSettings.sample( ivec2( 4, 5 ) ).setSampler( false ).r );
	p_seed.assign( lookSettings.sample( ivec2( 5, 5 ) ).setSampler( false ).r );
	p_recess.assign( lookSettings.sample( ivec2( 6, 5 ) ).setSampler( false ).r );
	p_edgeRound.assign( lookSettings.sample( ivec2( 7, 5 ) ).setSampler( false ).r );
	p_edgeDrop.assign( lookSettings.sample( ivec2( 8, 5 ) ).setSampler( false ).r );
	p_corner.assign( lookSettings.sample( ivec2( 9, 5 ) ).setSampler( false ).r );
	p_chip.assign( lookSettings.sample( ivec2( 10, 5 ) ).setSampler( false ).r );
	p_bulge.assign( lookSettings.sample( ivec2( 11, 5 ) ).setSampler( false ).r );
	p_tilt.assign( lookSettings.sample( ivec2( 12, 5 ) ).setSampler( false ).r );
	p_detail.assign( lookSettings.sample( ivec2( 13, 5 ) ).setSampler( false ).r );
	p_detailNormal.assign( lookSettings.sample( ivec2( 14, 5 ) ).setSampler( false ).r );
	p_valueVar.assign( lookSettings.sample( ivec2( 15, 5 ) ).setSampler( false ).r );
	p_warm.assign( lookSettings.sample( ivec2( 16, 5 ) ).setSampler( false ).r );
	p_dark.assign( lookSettings.sample( ivec2( 17, 5 ) ).setSampler( false ).r );
	p_mottle.assign( lookSettings.sample( ivec2( 18, 5 ) ).setSampler( false ).r );
	p_grime.assign( lookSettings.sample( ivec2( 19, 5 ) ).setSampler( false ).r );
	p_damp.assign( lookSettings.sample( ivec2( 20, 5 ) ).setSampler( false ).r );
	p_moss.assign( lookSettings.sample( ivec2( 21, 5 ) ).setSampler( false ).r );
	p_rockContrast.assign( lookSettings.sample( ivec2( 22, 5 ) ).setSampler( false ).r );
	p_rockScale.assign( lookSettings.sample( ivec2( 23, 5 ) ).setSampler( false ).r );
	p_mortScale.assign( lookSettings.sample( ivec2( 24, 5 ) ).setSampler( false ).r );
	p_pom.assign( lookSettings.sample( ivec2( 25, 5 ) ).setSampler( false ).r );
	p_pomOn.assign( lookSettings.sample( ivec2( 26, 5 ) ).setSampler( false ).r );
	p_shadowOn.assign( lookSettings.sample( ivec2( 27, 5 ) ).setSampler( false ).r );
	p_stoneTint.assign( lookSettings.sample( ivec2( 28, 5 ) ).setSampler( false ).rgb );
	p_mortTint.assign( lookSettings.sample( ivec2( 29, 5 ) ).setSampler( false ).rgb );
	t_rockCol.assign( 0 );
	t_rockDisp.assign( 1 );
	t_rockNrm.assign( 2 );
	t_mortCol.assign( 3 );
	t_mortDisp.assign( 4 );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	csNg.assign( normalize( vNormal ) );
	csT.assign( normalize( vS0.sub( csNg.mul( dot( vS0, csNg ) ) ) ) );
	csB.assign( normalize( vS1.sub( csNg.mul( dot( vS1, csNg ) ) ).sub( csT.mul( dot( vS1, csT ) ) ) ) );
	const Vv = normalize( vViewPosition );
	const Vts = vec3( dot( Vv, csT ), dot( Vv, csB ), dot( Vv, csNg ) );
	const uv0 = vLookUv.toVar();
	const fw = abs( lookGx ).add( abs( lookGy ) );
	const fp = max( max( fw.x, fw.y ), 1e-6 );
	csRockLod.assign( log2( max( fp.div( p_rockScale ).mul( 1024.0 ), 1.0 ) ) );
	csMortLod.assign( log2( max( fp.div( p_mortScale ).mul( 1024.0 ), 1.0 ) ) );
	csFade.assign( p_pomOn.mul( sub( 1.0, smoothstep( 0.006, 0.03, fp ) ) ) );
	uv.assign( uv0 );
	const zr = float( 0.0 );
	const S = csSample( uv );

	If( csFade.greaterThan( 0.0 ), () => {

		const vz = max( Vts.z, 0.1 );

		// march down in coarse steps to the first below the surface, then halve the step four times between the
		// last above and the first below

		const steps = int( mix( 14.0, 4.0, clamp( Vts.z, 0.0, 1.0 ) ) );
		const dz = p_pom.div( float( steps ) );
		const duv = Vts.xy.negate().div( vz ).mul( dz ).mul( csFade );
		const puv = uv;
		const pz = float( 0.0 );

		Loop( 14, ( { i } ) => {

			If( i.greaterThanEqual( steps ).or( zr.lessThanEqual( S.get( 'h' ) ) ), () => {

				Break();

			} );

			puv.assign( uv );
			pz.assign( zr );
			uv.addAssign( duv );
			zr.subAssign( dz );
			S.assign( csSample( uv ) );

		} );

		If( zr.lessThanEqual( S.get( 'h' ) ), () => {

			const lo = puv, hi = uv;
			const zlo = pz, zhi = zr;

			Loop( 4, () => {

				const mu = mul( 0.5, lo.add( hi ) );
				const mz = mul( 0.5, zlo.add( zhi ) );
				const M = csSample( mu );

				If( mz.lessThanEqual( M.get( 'h' ) ), () => {

					hi.assign( mu );
					zhi.assign( mz );
					S.assign( M );

				} ).Else( () => {

					lo.assign( mu );
					zlo.assign( mz );

				} );

			} );

			uv.assign( hi );
			zr.assign( zhi );

		} );

		S.assign( csSample( uv ) );

	} );

	csUvP.assign( uv );
	csZ.assign( S.get( 'h' ) );

	// the normal from the height round the place, no finer than a pixel

	const e = max( 0.002, fp.mul( 0.75 ) );
	const hx = csSample( uv.add( vec2( e, 0.0 ) ) ).get( 'h' ).sub( S.get( 'h' ) );
	const hy = csSample( uv.add( vec2( 0.0, e ) ) ).get( 'h' ).sub( S.get( 'h' ) );
	const rn = picDataLod( t_rockNrm, S.get( 'tuv' ), csRockLod ).xyz.mul( 2.0 ).sub( 1.0 );
	csNts.assign( normalize( vec3( hx.negate().div( e ), hy.negate().div( e ), 1.0 ).add( vec3( rn.xy.mul( p_detailNormal ).mul( S.get( 'stone' ) ), 0.0 ) ) ) );

	// the colour: the rock's picture taken grey, tinted, each stone its own lightness and warmth; the mortar's the same

	const rockC = picColourLod( t_rockCol, S.get( 'tuv' ), csRockLod );
	const rl = mix( 1.0, dot( rockC, vec3( 0.2126, 0.7152, 0.0722 ) ).div( picMean( t_rockCol ) ), p_rockContrast );
	const h1 = fract( S.get( 'id' ).mul( 913.7 ) ), h2 = fract( S.get( 'id' ).mul( 271.3 ) ), h3 = fract( S.get( 'id' ).mul( 517.9 ) );
	const val = add( 1.0, h1.sub( 0.5 ).mul( 2.0 ).mul( p_valueVar ) );

	If( h3.lessThan( p_dark ), () => {

		val.mulAssign( 0.62 );

	} );

	const warm = h2.sub( 0.5 ).mul( 2.0 ).mul( p_warm );
	const mott = add( 1.0, csTN( uv.mul( 0.9 ).add( S.get( 'id' ).mul( 13.0 ) ) ).sub( 0.5 ).mul( 2.0 ).mul( p_mottle ) );
	const stoneC = p_stoneTint.mul( rl ).mul( val ).mul( mott ).mul( vec3( add( 1.0, mul( 0.16, warm ) ), add( 1.0, mul( 0.02, warm ) ), sub( 1.0, mul( 0.2, warm ) ) ) );
	const mortC = p_mortTint.mul( dot( picColourLod( t_mortCol, uv.div( p_mortScale ), csMortLod ), vec3( 0.2126, 0.7152, 0.0722 ) ) ).div( picMean( t_mortCol ) );
	const sm = S.get( 'stone' ).mul( smoothstep( fp.negate(), fp, S.get( 'd' ) ) );
	const col = mix( mortC, stoneC, sm );

	// the cavity: the mortar darker toward the stones' edges, the stones' edges darker as they round down

	const aoM = mix( 0.4, 0.85, smoothstep( 0.0, mul( 0.6, p_joint ).add( 0.004 ), S.get( 'd' ).negate() ) );
	const aoS = mix( 0.65, 1.0, smoothstep( 0.0, p_edgeRound.mul( 1.5 ), S.get( 'd' ) ) );
	k.get( 'ao' ).assign( mix( aoM, aoS, sm ) );
	k.get( 'aoDirect' ).assign( 0.35 );

	// streaks run down the walls, rising damp darkens their feet, moss in the damp and on the slabs

	const kind = int( vS2.x.add( 0.5 ) );
	const streak = select( kind.equal( 1 ), 0.0, smoothstep( 0.5, 0.85, csTN( vec2( uv.x.mul( 2.2 ), uv.y.mul( 0.1 ).add( csTN( vec2( uv.x.mul( 0.5 ), 7.0 ) ).mul( 3.0 ) ) ) ) ) );
	col.mulAssign( sub( 1.0, p_grime.mul( streak ).mul( 0.45 ) ) );
	col.assign( mix( col, col.mul( vec3( 0.92, 0.86, 0.76 ) ), p_grime.mul( streak ).mul( 0.6 ) ) );
	const dampM = sub( 1.0, smoothstep( 0.0, add( 0.5, mul( 1.6, csTN( vec2( uv.x.mul( 0.45 ), 3.0 ) ) ) ), vLookWorld.y ) );
	col.mulAssign( sub( 1.0, mul( 0.45, p_damp ).mul( dampM ) ) );
	col.assign( mix( col, col.mul( vec3( 0.85, 0.95, 0.75 ) ), p_damp.mul( dampM ).mul( 0.5 ) ) );
	const mossM = smoothstep( 0.52, 0.78, csTN( uv.mul( 1.7 ).add( 3.1 ) ) ).mul( clamp( dampM.mul( 0.9 ).add( select( kind.equal( 1 ), 0.7, 0.0 ) ).add( sub( 1.0, sm ).mul( 0.4 ) ), 0.0, 1.0 ) );
	mossM.assign( clamp( mossM.mul( p_moss ).mul( 1.6 ), 0.0, 1.0 ) );
	col.assign( mix( col, vec3( 0.05, 0.075, 0.02 ).mul( add( 0.7, mul( 0.6, rl ) ) ), mossM ) );
	k.get( 'rough' ).assign( mix( mix( 0.96, 0.86, sm ), 1.0, mossM ) );

	If( lookView.greaterThan( 0.5 ).and( lookView.lessThan( 1.5 ) ), () => {

		col.assign( mix( vec3( 0.6 ), vec3( h1, h2, h3 ), sm ) );

	} );

	If( lookView.greaterThan( 1.5 ).and( lookView.lessThan( 2.5 ) ), () => {

		col.assign( vec3( S.get( 'h' ).add( p_pom ).div( p_pom ) ) );

	} );

	If( lookView.greaterThan( 3.5 ), () => {

		col.assign( csSolidColour( int( vS2.w.add( 0.5 ) ).mod( 256 ) ) );

	} );

	k.get( 'colour' ).assign( col );
	k.get( 'normal' ).assign( normalize( mat3( csT, csB, csNg ).mul( csNts ) ) );
	k.get( 'ownNormal' ).assign( true );

}, 'void' );

export const look_6 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_stoneMin.assign( lookSettings.sample( ivec2( 0, 6 ) ).setSampler( false ).r );
	p_stoneMax.assign( lookSettings.sample( ivec2( 1, 6 ) ).setSampler( false ).r );
	p_rowMin.assign( lookSettings.sample( ivec2( 2, 6 ) ).setSampler( false ).r );
	p_rowMax.assign( lookSettings.sample( ivec2( 3, 6 ) ).setSampler( false ).r );
	p_joint.assign( lookSettings.sample( ivec2( 4, 6 ) ).setSampler( false ).r );
	p_seed.assign( lookSettings.sample( ivec2( 5, 6 ) ).setSampler( false ).r );
	p_gap.assign( lookSettings.sample( ivec2( 6, 6 ) ).setSampler( false ).r );
	p_edgeRound.assign( lookSettings.sample( ivec2( 7, 6 ) ).setSampler( false ).r );
	p_edgeDrop.assign( lookSettings.sample( ivec2( 8, 6 ) ).setSampler( false ).r );
	p_corner.assign( lookSettings.sample( ivec2( 9, 6 ) ).setSampler( false ).r );
	p_cup.assign( lookSettings.sample( ivec2( 10, 6 ) ).setSampler( false ).r );
	p_tilt.assign( lookSettings.sample( ivec2( 11, 6 ) ).setSampler( false ).r );
	p_grain.assign( lookSettings.sample( ivec2( 12, 6 ) ).setSampler( false ).r );
	p_grainNormal.assign( lookSettings.sample( ivec2( 13, 6 ) ).setSampler( false ).r );
	p_light.assign( lookSettings.sample( ivec2( 14, 6 ) ).setSampler( false ).r );
	p_valueVar.assign( lookSettings.sample( ivec2( 15, 6 ) ).setSampler( false ).r );
	p_warm.assign( lookSettings.sample( ivec2( 16, 6 ) ).setSampler( false ).r );
	p_endDark.assign( lookSettings.sample( ivec2( 17, 6 ) ).setSampler( false ).r );
	p_rings.assign( lookSettings.sample( ivec2( 18, 6 ) ).setSampler( false ).r );
	p_grainScale.assign( lookSettings.sample( ivec2( 19, 6 ) ).setSampler( false ).r );
	p_pom.assign( lookSettings.sample( ivec2( 20, 6 ) ).setSampler( false ).r );
	p_pomOn.assign( lookSettings.sample( ivec2( 21, 6 ) ).setSampler( false ).r );
	p_shadowOn.assign( lookSettings.sample( ivec2( 22, 6 ) ).setSampler( false ).r );
	t_woodCol.assign( 5 );
	t_woodDisp.assign( 6 );
	t_woodNrm.assign( 7 );
	t_woodRough.assign( 8 );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	csNg.assign( normalize( vNormal ) );
	csT.assign( normalize( vS0.sub( csNg.mul( dot( vS0, csNg ) ) ) ) );
	csB.assign( normalize( vS1.sub( csNg.mul( dot( vS1, csNg ) ) ).sub( csT.mul( dot( vS1, csT ) ) ) ) );
	const Vv = normalize( vViewPosition );
	const Vts = vec3( dot( Vv, csT ), dot( Vv, csB ), dot( Vv, csNg ) );
	const uv0 = vLookUv.toVar();
	const fw = abs( lookGx ).add( abs( lookGy ) );
	const fp = max( max( fw.x, fw.y ), 1e-6 );
	cwLod.assign( log2( max( fp.div( p_grainScale ).mul( 1024.0 ), 1.0 ) ) );
	csFade.assign( p_pomOn.mul( sub( 1.0, smoothstep( 0.006, 0.03, fp ) ) ) );
	uv.assign( uv0 );
	const zr = float( 0.0 );
	const S = cwSample( uv );

	If( csFade.greaterThan( 0.0 ), () => {

		const vz = max( Vts.z, 0.1 );
		const steps = int( mix( 14.0, 4.0, clamp( Vts.z, 0.0, 1.0 ) ) );
		const dz = p_pom.div( float( steps ) );
		const duv = Vts.xy.negate().div( vz ).mul( dz ).mul( csFade );
		const puv = uv;
		const pz = float( 0.0 );

		Loop( 14, ( { i } ) => {

			If( i.greaterThanEqual( steps ).or( zr.lessThanEqual( S.get( 'h' ) ) ), () => {

				Break();

			} );

			puv.assign( uv );
			pz.assign( zr );
			uv.addAssign( duv );
			zr.subAssign( dz );
			S.assign( cwSample( uv ) );

		} );

		If( zr.lessThanEqual( S.get( 'h' ) ), () => {

			const lo = puv, hi = uv;
			const zlo = pz, zhi = zr;

			Loop( 4, () => {

				const mu = mul( 0.5, lo.add( hi ) );
				const mz = mul( 0.5, zlo.add( zhi ) );
				const M = cwSample( mu );

				If( mz.lessThanEqual( M.get( 'h' ) ), () => {

					hi.assign( mu );
					zhi.assign( mz );
					S.assign( M );

				} ).Else( () => {

					lo.assign( mu );
					zlo.assign( mz );

				} );

			} );

			uv.assign( hi );
			zr.assign( zhi );

		} );

		S.assign( cwSample( uv ) );

	} );

	csUvP.assign( uv );
	csZ.assign( S.get( 'h' ) );
	const e = max( 0.002, fp.mul( 0.75 ) );
	const hx = cwSample( uv.add( vec2( e, 0.0 ) ) ).get( 'h' ).sub( S.get( 'h' ) );
	const hy = cwSample( uv.add( vec2( 0.0, e ) ) ).get( 'h' ).sub( S.get( 'h' ) );
	const gn = picDataLod( t_woodNrm, S.get( 'tuv' ), cwLod ).xyz.mul( 2.0 ).sub( 1.0 );
	csNts.assign( normalize( vec3( hx.negate().div( e ), hy.negate().div( e ), 1.0 ).add( vec3( gn.xy.mul( p_grainNormal ).mul( S.get( 'board' ) ).mul( sub( 1.0, S.get( 'end' ) ) ), 0.0 ) ) ) );

	// the colour: the wood's picture, each board its own lightness and warmth; an end its rings round its heart, darker

	const woodC = picColourLod( t_woodCol, S.get( 'tuv' ), cwLod );
	const h1 = fract( S.get( 'id' ).mul( 913.7 ) ), h2 = fract( S.get( 'id' ).mul( 271.3 ) ), h3 = fract( S.get( 'id' ).mul( 517.9 ) );
	const val = add( 1.0, h1.sub( 0.5 ).mul( 2.0 ).mul( p_valueVar ) );
	const warm = h2.sub( 0.5 ).mul( 2.0 ).mul( p_warm );
	const boardC = woodC.mul( p_light ).mul( val ).mul( vec3( add( 1.0, mul( 0.14, warm ) ), 1.0, sub( 1.0, mul( 0.18, warm ) ) ) );

	If( S.get( 'end' ).greaterThan( 0.5 ), () => {

		const heart = S.get( 'size' ).mul( vec2( add( 0.5, h3.sub( 0.5 ).mul( 0.4 ) ), add( 0.5, h1.sub( 0.5 ).mul( 0.4 ) ) ) );
		const r = length( S.get( 'p' ).sub( heart ) ).mul( p_rings ).add( csTN( S.get( 'p' ).mul( 9.0 ).add( S.get( 'id' ).mul( 17.0 ) ) ).mul( 1.5 ) );
		const ring = add( 0.5, mul( 0.5, sin( r.mul( 6.2832 ) ) ) );
		boardC.mulAssign( sub( 1.0, p_endDark ).mul( add( 0.82, mul( 0.18, ring ) ) ) );

	} );

	const sb = S.get( 'board' ).mul( smoothstep( fp.negate(), fp, S.get( 'd' ) ) );
	const gapC = boardC.mul( 0.18 );
	const col = mix( gapC, boardC, sb );
	const aoG = mix( 0.3, 0.8, smoothstep( 0.0, mul( 0.6, p_joint ).add( 0.004 ), S.get( 'd' ).negate() ) );
	const aoB = mix( 0.75, 1.0, smoothstep( 0.0, p_edgeRound.mul( 1.5 ), S.get( 'd' ) ) );
	k.get( 'ao' ).assign( mix( aoG, aoB, sb ) );
	k.get( 'aoDirect' ).assign( 0.35 );
	k.get( 'rough' ).assign( mix( 1.0, picDataLod( t_woodRough, S.get( 'tuv' ), cwLod ).r, sb ) );

	If( lookView.greaterThan( 0.5 ).and( lookView.lessThan( 1.5 ) ), () => {

		col.assign( mix( vec3( 0.6 ), vec3( h1, h2, h3 ), sb ) );

	} );

	If( lookView.greaterThan( 1.5 ).and( lookView.lessThan( 2.5 ) ), () => {

		col.assign( vec3( S.get( 'h' ).add( p_pom ).div( p_pom ) ) );

	} );

	If( lookView.greaterThan( 3.5 ), () => {

		col.assign( csSolidColour( int( vS2.w.add( 0.5 ) ).mod( 256 ) ) );

	} );

	k.get( 'colour' ).assign( col );
	k.get( 'normal' ).assign( normalize( mat3( csT, csB, csNg ).mul( csNts ) ) );
	k.get( 'ownNormal' ).assign( true );

}, 'void' );

export const look_7 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_repeat.assign( lookSettings.sample( ivec2( 0, 7 ) ).setSampler( false ).r );
	t_col.assign( 5 );
	t_nrm.assign( 7 );
	t_rough.assign( 8 );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const tuv = uv.mul( p_repeat );
	k.get( 'colour' ).assign( picColour( t_col, tuv, p_repeat ) );
	k.get( 'nts' ).assign( picData( t_nrm, tuv, p_repeat ).xyz.mul( 2.0 ).sub( 1.0 ) );
	k.get( 'rough' ).assign( picData( t_rough, tuv, p_repeat ).r );

}, 'void' );

export const look_8 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_tint.assign( lookSettings.sample( ivec2( 0, 8 ) ).setSampler( false ).rgb );
	p_contrast.assign( lookSettings.sample( ivec2( 1, 8 ) ).setSampler( false ).r );
	p_metres.assign( lookSettings.sample( ivec2( 2, 8 ) ).setSampler( false ).r );
	t_col.assign( 0 );
	t_nrm.assign( 2 );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// each part on its own patch of the pictures, from its thing's and its part's numbers

	const kitPatch = vec2( fract( vLookInfo.y.mul( 0.61803 ).add( vLookInfo.z.mul( 0.137 ) ) ).mul( 37.0 ), fract( vLookInfo.y.mul( 0.75488 ).add( vLookInfo.z.mul( 0.291 ) ) ).mul( 23.0 ) );
	const tuv = uv.div( p_metres ).add( kitPatch );
	const picC = picColour( t_col, tuv, div( 1.0, p_metres ) );
	const kitL = dot( picC, vec3( 0.2126, 0.7152, 0.0722 ) ).div( picMean( t_col ) );
	const kitN = picData( t_nrm, tuv, div( 1.0, p_metres ) ).xyz.mul( 2.0 ).sub( 1.0 );
	const kitSteep = sub( 1.0, clamp( kitN.z, 0.0, 1.0 ) );
	const kitCav = clamp( smoothstep( 0.05, 0.4, kitSteep ).mul( 0.7 ).add( smoothstep( 0.7, 0.35, kitL ).mul( 0.3 ) ), 0.0, 1.0 );
	const kitBend = length( fwidth( wn ) ).div( max( length( fwidth( wp ) ), 1e-5 ) );
	const kitEdge = smoothstep( 20.0, 70.0, kitBend ).mul( add( 0.6, mul( 0.4, kn( uv.mul( 40.0 ).add( seed ) ) ) ) );
	const kitUp = smoothstep( 0.55, 0.95, wn.y );
	const kitDamp = sub( 1.0, smoothstep( 0.0, add( 0.35, mul( 0.3, kn( wp.xz.mul( 2.0 ) ) ) ), wp.y ) );
	const kitMoss = clamp( smoothstep( 0.55, 0.8, kfbm4( uv.mul( 2.3 ).add( seed.mul( 1.7 ) ) ) ).mul( kitUp.mul( 0.7 ).add( kitDamp.mul( 0.5 ) ) ).mul( add( 0.4, kitCav ) ), 0.0, 1.0 ).mul( 0.8 );
	const kitV = add( 1.0, kh1( seed.add( 0.37 ) ).sub( 0.5 ).mul( 0.3 ) );
	const kitWarm = kh1( seed.add( 5.1 ) ).sub( 0.5 ).mul( 0.5 );
	const kitMott = add( 1.0, kfbm4( uv.mul( 1.3 ).add( seed ) ).sub( 0.5 ).mul( 0.35 ) );
	const kitC = p_tint.mul( mix( 1.0, kitL, p_contrast ) ).mul( kitV ).mul( kitMott ).mul( vec3( add( 1.0, mul( 0.16, kitWarm ) ), add( 1.0, mul( 0.02, kitWarm ) ), sub( 1.0, mul( 0.2, kitWarm ) ) ) );
	kitC.mulAssign( mix( 1.0, 0.75, kitCav ) );
	kitC.assign( mix( kitC, kitC.mul( vec3( 0.8, 0.74, 0.64 ) ), kitCav.mul( 0.6 ) ) );
	kitC.mulAssign( sub( 1.0, mul( 0.35, kitDamp ) ) );
	kitC.assign( mix( kitC, min( kitC.mul( 1.45 ).add( 0.03 ), vec3( 1.0 ) ), kitEdge.mul( sub( 1.0, kitCav ) ) ) );
	kitC.assign( mix( kitC, vec3( 0.05, 0.075, 0.02 ).mul( add( 0.7, mul( 0.6, kitL ) ) ), kitMoss ) );
	k.get( 'colour' ).assign( kitC );

	// the roughness from the same: the cavity and the moss rougher, the worn edges smoother

	k.get( 'rough' ).assign( clamp( add( 0.8, mul( 0.18, kitCav ) ).add( mul( 0.2, kitMoss ) ).sub( mul( 0.22, kitEdge ) ), 0.5, 1.0 ) );

	// the relief: the normal picture, and over it the rock's lightness as a height, its dark sunk

	k.get( 'nts' ).assign( kitN );
	k.get( 'height' ).assign( kitL.sub( 1.0 ).mul( 0.003 ) );

	// the cavity shades the light that comes from everywhere

	k.get( 'ao' ).assign( mix( 1.0, 0.7, kitCav ) );

}, 'void' );

export const look_9 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_repeat.assign( lookSettings.sample( ivec2( 0, 9 ) ).setSampler( false ).r );
	t_col.assign( 5 );
	t_nrm.assign( 7 );
	t_rough.assign( 8 );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const tuv = uv.mul( p_repeat );
	k.get( 'colour' ).assign( picColour( t_col, tuv, p_repeat ) );
	k.get( 'nts' ).assign( picData( t_nrm, tuv, p_repeat ).xyz.mul( 2.0 ).sub( 1.0 ) );
	k.get( 'rough' ).assign( picData( t_rough, tuv, p_repeat ).r );

}, 'void' );

export const look_10 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const dim = kcell( uv.mul( 22.0 ).add( seed ) );
	const big = kfbm4( uv.mul( 3.0 ).add( seed ) );
	const rust = smoothstep( 0.5, 0.78, kfbm4( uv.mul( 2.2 ).add( seed.mul( 3.1 ) ) ) ).mul( 0.85 ).add( smoothstep( 0.45, 0.2, dim ).mul( 0.06 ).mul( kfade( 0.05 ) ) );
	const iron = mix( vec3( 0.1, 0.095, 0.09 ), vec3( 0.21, 0.2, 0.19 ), big );
	const red = mix( vec3( 0.14, 0.065, 0.03 ), vec3( 0.24, 0.12, 0.055 ), kn( uv.mul( 40.0 ).add( seed ) ) );
	k.get( 'colour' ).assign( mix( iron, red, clamp( rust, 0.0, 1.0 ) ) );
	k.get( 'metal' ).assign( mix( 0.3, 0.05, clamp( rust, 0.0, 1.0 ) ) );
	k.get( 'rough' ).assign( mix( add( 0.45, mul( 0.25, big ) ), 0.92, clamp( rust, 0.0, 1.0 ) ) );
	k.get( 'height' ).assign( float( -0.0012 ).mul( smoothstep( 0.5, 0.0, dim ) ).mul( kfade( 0.05 ) ) );

}, 'void' );

export const look_11 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_thDark.assign( lookSettings.sample( ivec2( 0, 11 ) ).setSampler( false ).rgb );
	p_thLight.assign( lookSettings.sample( ivec2( 1, 11 ) ).setSampler( false ).rgb );
	p_thAged.assign( lookSettings.sample( ivec2( 2, 11 ) ).setSampler( false ).rgb );
	p_thAgeFrom.assign( lookSettings.sample( ivec2( 3, 11 ) ).setSampler( false ).r );
	p_thAgeTo.assign( lookSettings.sample( ivec2( 4, 11 ) ).setSampler( false ).r );
	p_thDeep.assign( lookSettings.sample( ivec2( 5, 11 ) ).setSampler( false ).r );
	p_thRough.assign( lookSettings.sample( ivec2( 6, 11 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const bundle = kn( vec2( uv.x.mul( 2.5 ), uv.y.mul( 9.0 ) ).add( seed ) );
	const strand = kn( vec2( uv.x.mul( 9.0 ), uv.y.mul( 260.0 ) ).add( seed ) ).mul( kfade( 0.004 ) );
	const age = kfbm4( uv.mul( 0.9 ).add( seed ) );
	const straw = mix( p_thDark, p_thLight, bundle );
	straw.assign( mix( straw, p_thAged, smoothstep( p_thAgeFrom, p_thAgeTo, age ) ) );
	k.get( 'colour' ).assign( straw.mul( mix( p_thDeep, 1.1, strand ) ) );
	k.get( 'rough' ).assign( p_thRough );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( mul( 0.006, strand.sub( 0.5 ) ).add( mul( 0.01, bundle.sub( 0.5 ) ) ) );

}, 'void' );

export const look_12 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const pick = kh1( vLookInfo.y.mul( 3.7 ).add( 0.31 ) );
	const dye = select( pick.lessThan( 0.22 ), vec3( 0.42, 0.06, 0.05 ), select( pick.lessThan( 0.4 ), vec3( 0.08, 0.13, 0.33 ), select( pick.lessThan( 0.52 ), vec3( 0.62, 0.5, 0.16 ), select( pick.lessThan( 0.66 ), vec3( 0.12, 0.25, 0.1 ), select( pick.lessThan( 0.84 ), vec3( 0.66, 0.6, 0.48 ), vec3( 0.3, 0.19, 0.11 ) ) ) ) ) );
	const t = uv.div( 0.0015 );
	const warp = sin( t.x.mul( 3.14159 ) ), weft = sin( t.y.mul( 3.14159 ) );
	const over = step( 0.0, warp.mul( weft ) );
	const weave = mix( 0.5, mix( 0.82, 1.08, over ).mul( add( 0.85, mul( 0.15, abs( select( over.greaterThan( 0.5 ), weft, warp ) ) ) ) ), kfade( 0.003 ) );
	const wear = kfbm4( uv.mul( 2.2 ).add( seed ) );
	k.get( 'colour' ).assign( dye.mul( weave ).mul( mix( 0.85, 1.12, kn( uv.mul( 9.0 ).add( seed ) ) ) ) );
	k.get( 'colour' ).assign( mix( k.get( 'colour' ), k.get( 'colour' ).mul( 0.7 ).add( vec3( 0.05, 0.045, 0.04 ) ), smoothstep( 0.6, 0.85, wear ) ) );
	k.get( 'rough' ).assign( 0.93 );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( mul( 0.0003, weave.sub( 0.5 ) ) );

}, 'void' );

export const look_13 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const stroke = kn( vec2( uv.x.mul( 1.8 ).add( uv.y.mul( 0.6 ) ), uv.y.mul( 7.0 ) ).add( seed ) );
	const grain = kn( uv.mul( 70.0 ).add( seed ) ).mul( kfade( 0.02 ) );
	const grime = smoothstep( 0.55, 0.85, kfbm4( uv.mul( 1.2 ).add( seed ) ) );
	k.get( 'colour' ).assign( vec3( 0.86, 0.82, 0.72 ).mul( add( 0.92, mul( 0.08, stroke ) ).add( mul( 0.05, grain ) ) ) );
	k.get( 'colour' ).assign( mix( k.get( 'colour' ), vec3( 0.55, 0.5, 0.42 ), grime.mul( 0.45 ) ) );
	k.get( 'rough' ).assign( 0.92 );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( mul( 0.002, stroke.sub( 0.5 ) ).add( mul( 0.0004, grain ) ) );

}, 'void' );

export const look_14 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const twist = fract( uv.x.div( 0.018 ).add( uv.y.div( 0.012 ) ) );
	const strand = smoothstep( 0.0, 0.25, twist ).mul( smoothstep( 1.0, 0.75, twist ) );
	const fibre = kn( vec2( uv.x.mul( 300.0 ), uv.y.mul( 40.0 ) ).add( seed ) ).mul( kfade( 0.003 ) );
	k.get( 'colour' ).assign( mix( vec3( 0.38, 0.3, 0.17 ), vec3( 0.62, 0.52, 0.32 ), mix( 0.5, strand, kfade( 0.01 ) ) ).mul( add( 0.9, mul( 0.2, fibre ) ) ) );
	k.get( 'rough' ).assign( 0.9 );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( mul( 0.0015, mix( 0.5, strand, kfade( 0.01 ) ) ) );

}, 'void' );

export const look_15 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_glTint.assign( lookSettings.sample( ivec2( 0, 15 ) ).setSampler( false ).rgb );
	p_glTint2.assign( lookSettings.sample( ivec2( 1, 15 ) ).setSampler( false ).rgb );
	p_glWaves.assign( lookSettings.sample( ivec2( 2, 15 ) ).setSampler( false ).r );
	p_glWaveDepth.assign( lookSettings.sample( ivec2( 3, 15 ) ).setSampler( false ).r );
	p_glSeeds.assign( lookSettings.sample( ivec2( 4, 15 ) ).setSampler( false ).r );
	p_glRough.assign( lookSettings.sample( ivec2( 5, 15 ) ).setSampler( false ).r );
	p_glAlpha.assign( lookSettings.sample( ivec2( 6, 15 ) ).setSampler( false ).r );
	p_glAlphaVar.assign( lookSettings.sample( ivec2( 7, 15 ) ).setSampler( false ).r );
	p_glRibs.assign( lookSettings.sample( ivec2( 8, 15 ) ).setSampler( false ).r );
	p_glRibWide.assign( lookSettings.sample( ivec2( 9, 15 ) ).setSampler( false ).r );
	p_glRibAlpha.assign( lookSettings.sample( ivec2( 10, 15 ) ).setSampler( false ).r );
	p_glGlow.assign( lookSettings.sample( ivec2( 11, 15 ) ).setSampler( false ).rgb );
	p_glCrease.assign( lookSettings.sample( ivec2( 12, 15 ) ).setSampler( false ).r );
	p_glCreaseFreq.assign( lookSettings.sample( ivec2( 13, 15 ) ).setSampler( false ).r );
	p_glBands.assign( lookSettings.sample( ivec2( 14, 15 ) ).setSampler( false ).r );
	p_glBandHigh.assign( lookSettings.sample( ivec2( 15, 15 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const wave = kfbm4( uv.mul( p_glWaves ).add( seed ) );
	const seeds = smoothstep( 0.08, 0.02, kcell( uv.mul( 60.0 ).add( seed ) ) ).mul( kfade( 0.01 ) );

	// the twin wall's ribs, along u, one every 1 / glRibs metres across v; under a pixel, their mean cover

	const glRib = float( 0.0 );

	If( p_glRibs.greaterThan( 0.0 ), () => {

		const glRd = abs( fract( uv.y.mul( p_glRibs ) ).sub( 0.5 ) ).mul( 2.0 );
		const glRw = fwidth( uv.y.mul( p_glRibs ) ).mul( 2.0 );
		const glLine = sub( 1.0, smoothstep( p_glRibWide.sub( glRw ), p_glRibWide.add( glRw ), sub( 1.0, glRd ) ) );
		glRib.assign( mix( p_glRibWide, glLine, kfade( div( 1.5, p_glRibs ) ) ) );

	} );

	// the film's creases and wound bands, level round the load (the world's height, and the way along the face)

	const glFold = float( 0.0 ), glBand = float( 0.0 );

	If( p_glCrease.greaterThan( 0.0 ).or( p_glBands.greaterThan( 0.0 ) ), () => {

		const glSide = cross( vec3( 0.0, 1.0, 0.0 ), wn );
		const glAlong = select( dot( glSide, glSide ).greaterThan( 0.01 ), dot( wp, normalize( glSide ) ), wp.x );
		const glUp = wp.y.add( mul( 0.03, kn( vec2( glAlong.mul( 2.0 ), 0.0 ).add( seed ) ) ) );
		const glF = kn( vec2( glAlong.mul( 1.6 ), glUp.mul( p_glCreaseFreq ) ).add( seed.mul( 1.7 ) ) );
		const glF2 = kn( vec2( glAlong.mul( 3.1 ), glUp.mul( p_glCreaseFreq ).mul( 2.3 ) ).add( seed ).add( 5.0 ) );
		glFold.assign( p_glCrease.mul( mix( 0.35, pow( sub( 1.0, abs( glF.mul( 2.0 ).sub( 1.0 ) ) ), 6.0 ).mul( 0.75 ).add( pow( sub( 1.0, abs( glF2.mul( 2.0 ).sub( 1.0 ) ) ), 8.0 ).mul( 0.4 ) ), kfade( div( 1.0, p_glCreaseFreq ) ) ) ) );
		const glB = fract( glUp.div( p_glBandHigh ).add( mul( 0.15, kn( vec2( glAlong.mul( 0.8 ), 3.0 ).add( seed ) ) ) ) );
		glBand.assign( p_glBands.mul( smoothstep( 0.55, 0.62, glB ) ).mul( add( 0.8, mul( 0.4, kn( vec2( glAlong.mul( 4.0 ), glUp.mul( 6.0 ) ).add( seed ) ) ) ) ) );

	} );

	k.get( 'colour' ).assign( mix( p_glTint, p_glTint2, wave ).add( seeds.mul( p_glSeeds ) ).add( vec3( mul( 0.12, glRib ).add( mul( 0.25, glFold ) ).add( mul( 0.06, glBand ) ) ) ) );
	k.get( 'rough' ).assign( p_glRough.add( p_glRough.mul( wave ) ) );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( p_glWaveDepth.mul( wave.sub( 0.5 ) ).add( mul( 0.0003, glFold ) ) );
	k.get( 'alpha' ).assign( clamp( p_glAlpha.add( p_glAlphaVar.mul( wave ) ).add( p_glRibAlpha.mul( glRib ) ).add( mul( 0.35, glFold ) ).add( mul( 0.18, glBand ) ), 0.0, 1.0 ) );
	k.get( 'glow' ).assign( p_glGlow.mul( add( 0.9, mul( 0.2, wave ) ) ).mul( add( 1.0, mul( 0.4, glRib ) ) ) );

}, 'void' );

export const look_16 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const id = property( 'vec2' );
	const c = kcourse( uv, 0.17, 0.26, 0.6, seed, id );
	const tone = kh( id.add( seed ) );
	const edge = smoothstep( 0.0, 0.04, c.x ).mul( smoothstep( 1.0, 0.96, c.x ) ).mul( smoothstep( 0.0, 0.05, c.y ) );
	const split = kn( uv.mul( 30.0 ).add( id.mul( 3.1 ) ) ).mul( kfade( 0.02 ) );
	k.get( 'colour' ).assign( mix( vec3( 0.07, 0.08, 0.095 ), vec3( 0.16, 0.17, 0.19 ), tone ).mul( mix( 0.45, 1.0, mix( 1.0, edge, kfade( 0.05 ) ) ) ).mul( add( 0.9, mul( 0.15, split ) ) ) );
	k.get( 'rough' ).assign( add( 0.72, mul( 0.15, split ) ) );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( mix( 0.0, mul( 0.006, sub( 1.0, c.y ) ).mul( edge ), kfade( 0.05 ) ) );

}, 'void' );

export const look_17 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const id = property( 'vec2' );
	const c = kcourse( uv, 0.18, 0.22, 0.9, seed, id );
	const tone = kh( id.add( seed ) );
	const grain = kn( vec2( uv.x.add( id.x ).mul( 60.0 ), uv.y.mul( 4.0 ) ).add( id ) ).mul( kfade( 0.008 ) );
	const edge = smoothstep( 0.0, 0.05, c.x ).mul( smoothstep( 1.0, 0.95, c.x ) ).mul( smoothstep( 0.0, 0.06, c.y ) );
	const wood = mix( vec3( 0.3, 0.2, 0.11 ), vec3( 0.5, 0.37, 0.22 ), tone );
	wood.assign( mix( wood, vec3( 0.34, 0.33, 0.3 ), smoothstep( 0.55, 0.85, kfbm4( uv.mul( 1.5 ).add( seed ) ) ).mul( 0.6 ) ) );
	k.get( 'colour' ).assign( wood.mul( mix( 0.4, 1.0, mix( 1.0, edge, kfade( 0.05 ) ) ) ).mul( add( 0.85, mul( 0.25, grain ) ) ) );
	k.get( 'rough' ).assign( 0.88 );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( mix( 0.0, mul( 0.008, sub( 1.0, c.y ) ).mul( edge ), kfade( 0.05 ) ).add( mul( 0.0006, grain ) ) );

}, 'void' );

export const look_18 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const row = floor( uv.y.div( 0.25 ) );
	const inRow = fract( uv.y.div( 0.25 ) );
	const tone = kh1( row.add( seed ) );
	const grain = kn( vec2( uv.x.mul( 3.0 ), uv.y.add( row ).mul( 90.0 ) ).add( row ) ).mul( kfade( 0.006 ) );
	const edge = smoothstep( 0.0, 0.03, inRow ).mul( smoothstep( 1.0, 0.97, inRow ) );
	const wood = mix( vec3( 0.27, 0.17, 0.09 ), vec3( 0.46, 0.31, 0.17 ), tone );
	k.get( 'colour' ).assign( wood.mul( mix( 0.45, 1.0, mix( 1.0, edge, kfade( 0.04 ) ) ) ).mul( add( 0.82, mul( 0.3, grain ) ) ) );
	k.get( 'rough' ).assign( 0.82 );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'height' ).assign( mix( 0.0, float( -0.003 ).mul( sub( 1.0, edge ) ), kfade( 0.04 ) ).add( mul( 0.0005, grain ) ) );

}, 'void' );

export const look_19 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_size.assign( lookSettings.sample( ivec2( 0, 19 ) ).setSampler( false ).r );
	p_jitter.assign( lookSettings.sample( ivec2( 1, 19 ) ).setSampler( false ).r );
	p_stretch.assign( lookSettings.sample( ivec2( 2, 19 ) ).setSampler( false ).r );
	p_joint.assign( lookSettings.sample( ivec2( 3, 19 ) ).setSampler( false ).r );
	p_seed.assign( lookSettings.sample( ivec2( 4, 19 ) ).setSampler( false ).r );
	p_dome.assign( lookSettings.sample( ivec2( 5, 19 ) ).setSampler( false ).r );
	p_flat.assign( lookSettings.sample( ivec2( 6, 19 ) ).setSampler( false ).r );
	p_corner.assign( lookSettings.sample( ivec2( 7, 19 ) ).setSampler( false ).r );
	p_edgeRound.assign( lookSettings.sample( ivec2( 8, 19 ) ).setSampler( false ).r );
	p_edgeDrop.assign( lookSettings.sample( ivec2( 9, 19 ) ).setSampler( false ).r );
	p_chip.assign( lookSettings.sample( ivec2( 10, 19 ) ).setSampler( false ).r );
	p_sink.assign( lookSettings.sample( ivec2( 11, 19 ) ).setSampler( false ).r );
	p_tilt.assign( lookSettings.sample( ivec2( 12, 19 ) ).setSampler( false ).r );
	p_detail.assign( lookSettings.sample( ivec2( 13, 19 ) ).setSampler( false ).r );
	p_recess.assign( lookSettings.sample( ivec2( 14, 19 ) ).setSampler( false ).r );
	p_valueVar.assign( lookSettings.sample( ivec2( 15, 19 ) ).setSampler( false ).r );
	p_warm.assign( lookSettings.sample( ivec2( 16, 19 ) ).setSampler( false ).r );
	p_dark.assign( lookSettings.sample( ivec2( 17, 19 ) ).setSampler( false ).r );
	p_fleck.assign( lookSettings.sample( ivec2( 18, 19 ) ).setSampler( false ).r );
	p_polish.assign( lookSettings.sample( ivec2( 19, 19 ) ).setSampler( false ).r );
	p_dirt.assign( lookSettings.sample( ivec2( 20, 19 ) ).setSampler( false ).r );
	p_mossCover.assign( lookSettings.sample( ivec2( 21, 19 ) ).setSampler( false ).r );
	p_mossTop.assign( lookSettings.sample( ivec2( 22, 19 ) ).setSampler( false ).r );
	p_mossDepth.assign( lookSettings.sample( ivec2( 23, 19 ) ).setSampler( false ).r );
	p_mossScale.assign( lookSettings.sample( ivec2( 24, 19 ) ).setSampler( false ).r );
	p_wet.assign( lookSettings.sample( ivec2( 25, 19 ) ).setSampler( false ).r );
	p_grey.assign( lookSettings.sample( ivec2( 26, 19 ) ).setSampler( false ).rgb );
	p_brown.assign( lookSettings.sample( ivec2( 27, 19 ) ).setSampler( false ).rgb );
	p_sand.assign( lookSettings.sample( ivec2( 28, 19 ) ).setSampler( false ).rgb );
	p_mossDark.assign( lookSettings.sample( ivec2( 29, 19 ) ).setSampler( false ).rgb );
	p_mossLight.assign( lookSettings.sample( ivec2( 30, 19 ) ).setSampler( false ).rgb );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// the path's top: laid on the ground; any other face laid along its height

	const top = vLookWN.y.greaterThan( 0.7 );
	const q = property( 'vec2' );

	If( top, () => {

		q.assign( vec2( vLookWorld.x, vLookWorld.z.negate() ) );

	} ).Else( () => {

		const n = normalize( vLookWN );
		const along = normalize( vec3( n.z.negate(), 0.0, n.x ).add( vec3( 1e-5, 0.0, 0.0 ) ) );
		q.assign( vec2( dot( vLookWorld, along ), vLookWorld.y ) );

	} );

	const fw = fwidth( q );
	const fp = max( max( fw.x, fw.y ), 1e-6 );
	cbFp.assign( fp );
	const S = cbSample( q );

	// the cobble's colour: grey to brown by its own number, its lightness, a share of dark ones, flecks and mottling;
	// its worn top lighter and smoother, its edge dirtier

	const R = S.get( 'rnd' );
	const val = add( 1.0, R.x.sub( 0.5 ).mul( 2.0 ).mul( p_valueVar ) );

	If( R.y.lessThan( p_dark ), () => {

		val.mulAssign( 0.55 );

	} );

	const stoneC = mix( p_grey, p_brown, clamp( R.w.mul( p_warm ).mul( 2.0 ), 0.0, 1.0 ) ).mul( val );
	const fl = cbN( q.add( R.xy.mul( 91.0 ) ), 260.0 );
	stoneC.mulAssign( add( 1.0, smoothstep( 0.6, 0.7, fl ).mul( 0.6 ).sub( smoothstep( 0.6, 0.7, sub( 1.0, fl ) ).mul( 0.35 ) ).mul( p_fleck ) ) );
	stoneC.mulAssign( add( 1.0, cbN( q.add( R.zw.mul( 13.0 ) ), 12.0 ).sub( 0.5 ).mul( 0.45 ) ) );
	const worn = sub( 1.0, smoothstep( 0.0, 0.7, S.get( 't' ) ) ).mul( p_polish );
	stoneC.mulAssign( add( 1.0, mul( 0.18, worn ) ) );
	const edgeDirt = sub( 1.0, smoothstep( 0.0, p_edgeRound.mul( 1.6 ), S.get( 'd' ) ) ).mul( p_dirt );
	stoneC.mulAssign( sub( 1.0, mul( 0.4, edgeDirt ) ) );

	// the sand: its grains, darker in the joint's bottom

	const sandC = p_sand.mul( add( 0.7, mul( 0.6, cbN( q, 300.0 ) ) ) ).mul( sub( 1.0, mul( 0.25, p_dirt ) ) );
	const sm = S.get( 'stone' ).mul( smoothstep( fp.negate(), fp, S.get( 'd' ) ) );
	const col = mix( sandC, stoneC, sm );

	// the moss layer: dark to light green, lighter where its cushions stand up and catch the light, its thin fringe
	// letting the stone or sand under it show through

	const mossM = smoothstep( 0.0, 0.6, S.get( 'moss' ) );
	const lumpC = cbN( q.add( 5.1 ), 90.0 );
	const mossC = mix( p_mossDark, p_mossLight, clamp( cbN( q.add( 2.3 ), div( 2.0, p_mossScale ) ).mul( 1.4 ).sub( 0.2 ), 0.0, 1.0 ) );
	mossC.mulAssign( add( 0.7, mul( 0.6, lumpC ) ) );
	col.assign( mix( col, mossC, mossM ) );

	// the cavity: the sand darker toward the cobbles, a cobble's edge darker as it rounds down; the moss's own,
	// its cushions' hollows, over them

	const aoM = mix( 0.45, 0.85, smoothstep( 0.0, mul( 0.6, p_joint ).add( 0.006 ), S.get( 'd' ).negate() ) );
	const aoS = mix( 0.6, 1.0, smoothstep( 0.0, p_edgeRound.mul( 1.4 ), S.get( 'd' ) ) );
	const ao = mix( aoM, aoS, sm );
	k.get( 'ao' ).assign( mix( ao, add( 0.7, mul( 0.3, lumpC ) ), mossM ) );
	k.get( 'aoDirect' ).assign( 0.35 );
	const rough = mix( 0.97, mix( 0.82, 0.5, worn ), sm );
	rough.assign( mix( rough, 1.0, mossM ) );

	// wet: the low places hold it first, darker and glossy; at full wet everything is

	const low = sub( 1.0, smoothstep( p_recess.negate().sub( p_mossDepth ).sub( 0.004 ), p_mossDepth.negate().sub( 0.004 ), S.get( 'h' ) ) );
	const wetM = clamp( p_wet.mul( 1.6 ).sub( sub( 1.0, low ).mul( sub( 1.0, p_wet ) ).mul( 1.6 ) ), 0.0, 1.0 );
	col.mulAssign( mix( 1.0, 0.55, wetM ) );
	k.get( 'rough' ).assign( mix( rough, 0.12, wetM ) );

	If( lookView.greaterThan( 0.5 ).and( lookView.lessThan( 1.5 ) ), () => {

		col.assign( mix( vec3( 0.5 ), R.xyz, sm ) );

	} );

	If( lookView.greaterThan( 1.5 ).and( lookView.lessThan( 2.5 ) ), () => {

		col.assign( vec3( S.get( 'h' ).add( p_recess ).add( p_mossDepth ).div( p_recess.add( p_mossDepth ) ) ) );

	} );

	k.get( 'colour' ).assign( col );

	// the relief as a height, bent into the normal by the pixel's neighbours; flat on a face that is not the top

	k.get( 'height' ).assign( select( top, S.get( 'h' ), 0.0 ) );

}, 'void' );

export const look_20 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const grain = kn( uv.mul( 600.0 ).add( seed ) ).mul( kfade( 0.002 ) );
	const blush = kfbm( uv.mul( 2.0 ).add( seed ) );
	k.get( 'colour' ).assign( mix( vec3( 0.52, 0.22, 0.12 ), vec3( 0.66, 0.34, 0.2 ), blush ).mul( add( 0.9, mul( 0.15, grain ) ) ) );
	k.get( 'rough' ).assign( 0.88 );
	k.get( 'height' ).assign( mul( 0.0002, grain ).add( mul( 0.0006, kn( vec2( uv.x.mul( 4.0 ), uv.y.mul( 60.0 ) ).add( seed ) ).sub( 0.5 ) ) ) );

}, 'void' );

export const look_21 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_poSimmer.assign( lookSettings.sample( ivec2( 0, 21 ) ).setSampler( false ).r );
	p_poRoll.assign( lookSettings.sample( ivec2( 1, 21 ) ).setSampler( false ).r );
	p_poBits.assign( lookSettings.sample( ivec2( 2, 21 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const z = kcycle( p_poSimmer );

	// the simmer: the broth churning in place, and the way it carries what floats on it

	const roll = vec2( kfbm3( vec3( uv.mul( 5.0 ).add( seed ), z.mul( 3.0 ) ), 3.0 ), kfbm3( vec3( uv.mul( 5.0 ).add( seed ).add( 7.3 ), z.mul( 3.0 ) ), 3.0 ) ).sub( 0.5 );
	const q = uv.add( roll.mul( p_poRoll ) );
	const body = kfbm3( vec3( uv.mul( 9.0 ).add( seed ).add( 3.1 ), z.mul( 4.0 ) ), 4.0 );

	// grains of barley, round and drawn out a little, and ragged flecks of herb, where the broth carries them: each a cell,
	// there or not by its own number

	const gid = property( 'float' ), gedge = property( 'float' ), hid = property( 'float' ), hedge = property( 'float' );
	const gd = kvor( vec2( q.x.mul( 120.0 ), q.y.mul( 80.0 ) ).add( seed ).add( 8.0 ), gid, gedge );
	const grain = sub( 1.0, smoothstep( 0.2, 0.3, gd ) ).mul( step( sub( 1.0, mul( 0.4, p_poBits ) ), kh1( gid.mul( 17.3 ) ) ) ).mul( kfade( 0.002 ) );
	const hd = kvor( q.mul( 115.0 ).add( seed ).add( 3.0 ), hid, hedge );
	const herb = sub( 1.0, smoothstep( 0.16, 0.27, hd.add( mul( 0.14, kn( q.mul( 700.0 ).add( seed ) ) ) ) ) ).mul( step( sub( 1.0, mul( 0.45, p_poBits ) ), kh1( hid.mul( 29.1 ) ) ) ).mul( kfade( 0.003 ) );

	// eyes of fat on the surface, gathering and parting as it turns

	const fat = smoothstep( 0.6, 0.7, kfbm3( vec3( uv.mul( 7.0 ).add( seed ).add( 5.0 ), z.mul( 2.0 ) ), 2.0 ) ).mul( sub( 1.0, smoothstep( 0.75, 0.8, kn( q.mul( 60.0 ).add( seed ) ) ) ) );
	const c = mix( vec3( 0.03, 0.019, 0.009 ), vec3( 0.075, 0.048, 0.021 ), body );
	c.assign( mix( c, vec3( 0.045, 0.085, 0.018 ), herb.mul( 0.9 ) ) );
	c.assign( mix( c, vec3( 0.22, 0.17, 0.1 ), grain.mul( 0.75 ) ) );
	c.assign( mix( c, vec3( 0.11, 0.075, 0.03 ), fat.mul( 0.5 ) ) );
	k.get( 'colour' ).assign( c );

	// the fat is glossy, the broth less so

	k.get( 'rough' ).assign( mix( 0.55, 0.22, fat ) );
	k.get( 'height' ).assign( mul( 0.0015, body.sub( 0.5 ) ).add( mul( 0.0006, grain ) ).add( mul( 0.0004, herb ) ) );

}, 'void' );

export const look_22 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// the courses: u runs level along the face, v up or down it; each stone its id

	const id = property( 'vec2' );
	const c = kcourse( uv, 0.28, 0.52, 0.45, seed, id );
	const jx = min( c.x, sub( 1.0, c.x ) ).mul( c.w ), jy = min( c.y, sub( 1.0, c.y ) ).mul( 0.28 );
	const edge = min( jx, jy );

	// a stone's arris rounded and chipped, the joint recessed

	const chip = kn( uv.mul( 38.0 ).add( id.mul( 7.0 ) ) ).sub( 0.5 ).mul( 0.008 );
	const joint = smoothstep( 0.006, 0.016, edge.add( chip ) );

	// each stone its own lightness and warmth, its face mottled and pitted

	const h1 = kh( id.add( seed ) ), h2 = kh( id.add( seed ).add( 5.0 ) ), h3 = kh( id.add( seed ).add( 9.0 ) );
	const val = add( 0.82, mul( 0.36, h1 ) );

	If( h3.lessThan( 0.08 ), () => {

		val.mulAssign( 0.66 );

	} );

	const warm = h2.sub( 0.5 ).mul( 0.8 );
	const stoneC = vec3( 0.34, 0.32, 0.29 ).mul( val ).mul( vec3( add( 1.0, mul( 0.14, warm ) ), add( 1.0, mul( 0.02, warm ) ), sub( 1.0, mul( 0.18, warm ) ) ) );
	const mott = kfbm( uv.mul( 3.5 ).add( id.mul( 3.1 ) ) );
	const pit = smoothstep( 0.62, 0.7, kn( uv.mul( 70.0 ).add( id.mul( 11.0 ) ) ) ).mul( kfade( 0.004 ) );
	stoneC.mulAssign( add( 0.84, mul( 0.3, mott ) ).mul( sub( 1.0, mul( 0.3, pit ) ) ) );
	const mortC = vec3( 0.4, 0.38, 0.34 ).mul( add( 0.85, mul( 0.25, kn( uv.mul( 160.0 ).add( seed ) ) ).mul( kfade( 0.003 ) ) ) );
	const col = mix( mortC.mul( 0.75 ), stoneC, joint );

	// grime run down from the joints and the cap: streaks along the face, slow up it

	const streak = smoothstep( 0.52, 0.85, kfbm( vec2( uv.x.mul( 3.0 ), uv.y.mul( 0.25 ) ).add( seed ).add( 2.0 ) ) );
	col.mulAssign( sub( 1.0, mul( 0.32, streak ) ) );
	col.assign( mix( col, col.mul( vec3( 0.9, 0.86, 0.78 ) ), streak.mul( 0.5 ) ) );

	// lichen in patches on the stones

	const lich = smoothstep( 0.66, 0.8, kfbm( uv.mul( 2.6 ).add( seed ).add( 4.0 ) ) ).mul( joint );
	col.assign( mix( col, vec3( 0.52, 0.5, 0.36 ), lich.mul( 0.45 ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( 0.98, 0.9, joint ) );
	k.get( 'height' ).assign( mix( - 0.01, 0.0, joint ).sub( mul( 0.0015, pit ) ).add( mul( 0.0012, mott.sub( 0.5 ) ) ) );

}, 'void' );

export const look_23 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// a velvety near-black crust, browner where tar has run and glazed, flaking in places to a lighter grey ash

	const crust = kfbm( uv.mul( 9.0 ).add( seed ) );
	const tar = smoothstep( 0.55, 0.8, kfbm( vec2( uv.x.mul( 3.0 ), uv.y.mul( 0.8 ) ).add( seed ).add( 3.0 ) ) );
	const flake = smoothstep( 0.72, 0.78, kfbm( uv.mul( 14.0 ).add( seed ).add( 9.0 ) ) );
	const c = mix( vec3( 0.016, 0.015, 0.015 ), vec3( 0.04, 0.038, 0.036 ), crust );
	c.assign( mix( c, vec3( 0.05, 0.035, 0.022 ), tar.mul( 0.5 ) ) );
	c.assign( mix( c, vec3( 0.1, 0.098, 0.095 ), flake.mul( 0.5 ) ) );
	k.get( 'colour' ).assign( c.mul( add( 0.8, mul( 0.4, kn( uv.mul( 220.0 ).add( seed ) ) ).mul( kfade( 0.003 ) ) ) ) );
	k.get( 'rough' ).assign( mix( 1.0, 0.7, tar ) );
	k.get( 'height' ).assign( mul( 0.0012, crust ).sub( mul( 0.0006, flake ) ) );

}, 'void' );

export const look_24 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// a warm off-white lime with sharp sand and grit through it, trowel strokes in its face, darkened by rain and
	// soot running down it, with fine shrinkage cracks

	const grit = kn( uv.mul( 520.0 ).add( seed ) ).mul( kfade( 0.002 ) );
	const pebble = smoothstep( 0.78, 0.84, kn( uv.mul( 140.0 ).add( seed ).add( 4.0 ) ) ).mul( kfade( 0.006 ) );
	const trowel = kn( vec2( uv.x.mul( 2.5 ), uv.y.mul( 26.0 ) ).add( seed ) ).mul( kfade( 0.01 ) );
	const dirt = smoothstep( 0.45, 0.85, kfbm( uv.mul( 2.5 ).add( seed ).add( 1.0 ) ) );
	const id = property( 'float' ), e = property( 'float' );
	kvor( uv.mul( 7.0 ).add( seed ), id, e );
	const crack = smoothstep( 0.012, 0.0, e ).mul( step( 0.6, kh1( id.mul( 7.0 ) ) ) ).mul( kfade( 0.004 ) );
	const c = mix( vec3( 0.74, 0.71, 0.64 ), vec3( 0.62, 0.58, 0.5 ), trowel );
	c.mulAssign( add( 0.9, mul( 0.16, grit ) ) );
	c.assign( mix( c, vec3( 0.45, 0.41, 0.36 ), pebble.mul( 0.6 ) ) );
	c.assign( mix( c, vec3( 0.3, 0.29, 0.27 ), dirt.mul( 0.55 ) ) );
	k.get( 'colour' ).assign( c.mul( sub( 1.0, mul( 0.55, crack ) ) ) );
	k.get( 'rough' ).assign( 0.93 );
	k.get( 'height' ).assign( mul( 0.0006, grit ).add( mul( 0.0008, trowel ) ).add( mul( 0.0006, pebble ) ).sub( mul( 0.0008, crack ) ) );

}, 'void' );

export const look_25 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const tarnish = smoothstep( 0.5, 0.85, kfbm( uv.mul( 2.5 ).add( seed ) ) );
	const c = mix( vec3( 0.82, 0.62, 0.25 ), vec3( 0.4, 0.3, 0.14 ), tarnish );
	k.get( 'colour' ).assign( c );
	k.get( 'metal' ).assign( mix( 0.55, 0.35, tarnish ) );
	k.get( 'rough' ).assign( mix( 0.18, 0.5, tarnish ) );

}, 'void' );

export const look_26 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const r = kring( uv, seed, 7.0 );
	const fb = kfibre( uv, seed );
	const figure = kfbm( vec2( uv.x.mul( 1.5 ), uv.y.mul( 6.0 ) ).add( seed ) );
	k.get( 'colour' ).assign( mix( vec3( 0.3, 0.19, 0.11 ), vec3( 0.14, 0.08, 0.045 ), r ).mul( add( 0.85, mul( 0.3, figure ) ) ).mul( add( 0.92, mul( 0.12, fb ) ) ) );
	k.get( 'rough' ).assign( 0.4 );
	k.get( 'height' ).assign( float( -0.0003 ).mul( r ) );
	k.get( 'clearcoat' ).assign( 0.6 );
	k.get( 'clearcoatRough' ).assign( 0.15 );

}, 'void' );

export const look_27 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_fcHeat.assign( lookSettings.sample( ivec2( 0, 27 ) ).setSampler( false ).r );
	p_fcAsh.assign( lookSettings.sample( ivec2( 1, 27 ) ).setSampler( false ).r );
	p_fcGlow.assign( lookSettings.sample( ivec2( 2, 27 ) ).setSampler( false ).r );
	p_fcBreath.assign( lookSettings.sample( ivec2( 3, 27 ) ).setSampler( false ).r );
	p_fcFlicker.assign( lookSettings.sample( ivec2( 4, 27 ) ).setSampler( false ).r );
	p_fcChecks.assign( lookSettings.sample( ivec2( 5, 27 ) ).setSampler( false ).r );
	p_fcCheckShow.assign( lookSettings.sample( ivec2( 6, 27 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const heat = clamp( vS3.x.mul( p_fcHeat ), 0.0, 1.0 );

	// the breath: the heat churning in place over the bed, patches a hand across, finer flickers in them

	const breath = kfbm3( vec3( uv.mul( 6.0 ).add( seed ), kcycle( p_fcBreath ).mul( 4.0 ) ), 4.0 );
	const h = heat.mul( mix( 1.0, add( 0.45, mul( 1.1, breath ) ), p_fcFlicker ) );

	// the checking: splits along the grain, each row of blocks broken across at its own places, the lines wandering

	const g = uv.mul( p_fcChecks );
	g.y.addAssign( mul( 0.35, kn( vec2( g.x.mul( 0.3 ), g.y.mul( 0.2 ) ).add( seed ) ) ) );
	const row = floor( g.y );
	const ax = g.x.mul( 0.55 ).add( kh1( row.add( seed ) ).mul( 5.0 ) ).add( mul( 0.4, kn( vec2( row, g.x.mul( 0.5 ) ) ) ) );
	const dy = min( fract( g.y ), sub( 1.0, fract( g.y ) ) );
	const dx = min( fract( ax ), sub( 1.0, fract( ax ) ) );
	const fade = kfade( div( 2.0, p_fcChecks ) );

	// each split thin, opening and closing along its length; a cross check only here and there

	const open = smoothstep( 0.3, 0.7, kn( vec2( g.x.mul( 0.4 ), row.mul( 3.1 ) ).add( seed ) ) );
	const split = sub( 1.0, smoothstep( 0.0, 0.035, dy ) ).mul( open ).mul( fade );
	const across = sub( 1.0, smoothstep( 0.0, 0.03, dx ) ).mul( step( 0.55, kh( vec2( row, floor( ax ) ).add( seed ) ) ) ).mul( fade );
	const check = max( split, across.mul( 0.8 ) );
	const block = kh( vec2( row, floor( ax ) ).add( seed ).add( 1.3 ) );

	// the wood's fibres and growth lines along the grain, faint

	const fib = kn( vec2( uv.x.mul( 20.0 ), uv.y.mul( 900.0 ) ).add( seed ) ).mul( kfade( 0.002 ) );

	// a lump glows from underneath and from its splits outward: a face turned up to the air is the coolest, one turned
	// down into the bed the hottest; its face glows whole only once it is hot right through

	const under = mix( 1.15, 0.7, smoothstep( - 0.3, 0.9, wn.y ) );
	const hb = h.mul( mix( 0.85, 1.12, block ) ).mul( under );
	const face = smoothstep( 0.62, 0.95, hb ).mul( add( 0.7, mul( 0.3, kfbm( uv.mul( 40.0 ).add( seed ) ) ) ) );
	const lit = max( face, check.mul( smoothstep( 0.2, 0.55, hb ) ) );

	// ash: a soft grey powder lying over the cooler tops in drifts, burnt off where hot; it fills the checks

	const drift = kfbm( uv.mul( 15.0 ).add( seed ).add( 2.0 ) ).add( mul( 0.25, kfbm( uv.mul( 55.0 ).add( seed ).add( 6.0 ) ) ) );
	const ash = smoothstep( sub( 1.15, p_fcAsh ), sub( 1.4, p_fcAsh ), drift ).mul( sub( 1.0, smoothstep( 0.25, 0.7, h ) ) ).mul( smoothstep( - 0.1, 0.7, wn.y ) );
	const cold = vec3( 0.012, 0.0115, 0.0112 ).mul( add( 0.8, mul( 0.7, block ) ) ).mul( add( 0.9, mul( 0.2, fib ) ) );
	cold.mulAssign( sub( 1.0, mul( 0.5, check ).mul( p_fcCheckShow ) ) );
	const c = mix( cold, vec3( 0.26, 0.25, 0.235 ).mul( add( 0.8, mul( 0.35, kfbm( uv.mul( 90.0 ).add( seed ) ) ) ) ), ash );
	k.get( 'colour' ).assign( mix( c, vec3( 0.22, 0.05, 0.012 ), lit.mul( sub( 1.0, ash ) ) ) );

	// a lump not yet hot through still shows a dull red under its skin where it is warm

	const ember = smoothstep( 0.25, 0.6, hb ).mul( sub( 1.0, lit ) ).mul( add( 0.5, mul( 0.5, kfbm( uv.mul( 25.0 ).add( seed ).add( 4.0 ) ) ) ) );
	k.get( 'glow' ).assign( htGlow( hb ).mul( lit ).add( htGlow( hb.mul( 0.55 ) ).mul( ember ).mul( 0.6 ) ).mul( p_fcGlow ).mul( sub( 1.0, mul( 0.9, ash ) ) ) );

	// charcoal's sheen: a dull silver only on the cold faces' best-lit facets, gone where ash or heat is

	k.get( 'rough' ).assign( mix( mix( 0.5, 0.75, block ), 0.97, max( ash, lit ) ) );
	k.get( 'metal' ).assign( mul( 0.25, sub( 1.0, max( ash, lit ) ) ) );
	k.get( 'height' ).assign( float( -0.0012 ).mul( check ).mul( sub( 1.0, mul( 0.8, ash ) ) ).add( mul( 0.0002, fib.sub( 0.5 ) ) ) );

}, 'void' );

export const look_28 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_fcHeat.assign( lookSettings.sample( ivec2( 0, 28 ) ).setSampler( false ).r );
	p_fcAsh.assign( lookSettings.sample( ivec2( 1, 28 ) ).setSampler( false ).r );
	p_fcGlow.assign( lookSettings.sample( ivec2( 2, 28 ) ).setSampler( false ).r );
	p_fcBreath.assign( lookSettings.sample( ivec2( 3, 28 ) ).setSampler( false ).r );
	p_fcFlicker.assign( lookSettings.sample( ivec2( 4, 28 ) ).setSampler( false ).r );
	p_fcChecks.assign( lookSettings.sample( ivec2( 5, 28 ) ).setSampler( false ).r );
	p_fcCheckShow.assign( lookSettings.sample( ivec2( 6, 28 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const heat = clamp( vS3.x.mul( p_fcHeat ), 0.0, 1.0 );

	// the breath: the heat churning in place over the bed, patches a hand across, finer flickers in them

	const breath = kfbm3( vec3( uv.mul( 6.0 ).add( seed ), kcycle( p_fcBreath ).mul( 4.0 ) ), 4.0 );
	const h = heat.mul( mix( 1.0, add( 0.45, mul( 1.1, breath ) ), p_fcFlicker ) );

	// the checking: splits along the grain, each row of blocks broken across at its own places, the lines wandering

	const g = uv.mul( p_fcChecks );
	g.y.addAssign( mul( 0.35, kn( vec2( g.x.mul( 0.3 ), g.y.mul( 0.2 ) ).add( seed ) ) ) );
	const row = floor( g.y );
	const ax = g.x.mul( 0.55 ).add( kh1( row.add( seed ) ).mul( 5.0 ) ).add( mul( 0.4, kn( vec2( row, g.x.mul( 0.5 ) ) ) ) );
	const dy = min( fract( g.y ), sub( 1.0, fract( g.y ) ) );
	const dx = min( fract( ax ), sub( 1.0, fract( ax ) ) );
	const fade = kfade( div( 2.0, p_fcChecks ) );

	// each split thin, opening and closing along its length; a cross check only here and there

	const open = smoothstep( 0.3, 0.7, kn( vec2( g.x.mul( 0.4 ), row.mul( 3.1 ) ).add( seed ) ) );
	const split = sub( 1.0, smoothstep( 0.0, 0.035, dy ) ).mul( open ).mul( fade );
	const across = sub( 1.0, smoothstep( 0.0, 0.03, dx ) ).mul( step( 0.55, kh( vec2( row, floor( ax ) ).add( seed ) ) ) ).mul( fade );
	const check = max( split, across.mul( 0.8 ) );
	const block = kh( vec2( row, floor( ax ) ).add( seed ).add( 1.3 ) );

	// the wood's fibres and growth lines along the grain, faint

	const fib = kn( vec2( uv.x.mul( 20.0 ), uv.y.mul( 900.0 ) ).add( seed ) ).mul( kfade( 0.002 ) );

	// a lump glows from underneath and from its splits outward: a face turned up to the air is the coolest, one turned
	// down into the bed the hottest; its face glows whole only once it is hot right through

	const under = mix( 1.15, 0.7, smoothstep( - 0.3, 0.9, wn.y ) );
	const hb = h.mul( mix( 0.85, 1.12, block ) ).mul( under );
	const face = smoothstep( 0.62, 0.95, hb ).mul( add( 0.7, mul( 0.3, kfbm( uv.mul( 40.0 ).add( seed ) ) ) ) );
	const lit = max( face, check.mul( smoothstep( 0.2, 0.55, hb ) ) );

	// ash: a soft grey powder lying over the cooler tops in drifts, burnt off where hot; it fills the checks

	const drift = kfbm( uv.mul( 15.0 ).add( seed ).add( 2.0 ) ).add( mul( 0.25, kfbm( uv.mul( 55.0 ).add( seed ).add( 6.0 ) ) ) );
	const ash = smoothstep( sub( 1.15, p_fcAsh ), sub( 1.4, p_fcAsh ), drift ).mul( sub( 1.0, smoothstep( 0.25, 0.7, h ) ) ).mul( smoothstep( - 0.1, 0.7, wn.y ) );
	const cold = vec3( 0.012, 0.0115, 0.0112 ).mul( add( 0.8, mul( 0.7, block ) ) ).mul( add( 0.9, mul( 0.2, fib ) ) );
	cold.mulAssign( sub( 1.0, mul( 0.5, check ).mul( p_fcCheckShow ) ) );
	const c = mix( cold, vec3( 0.26, 0.25, 0.235 ).mul( add( 0.8, mul( 0.35, kfbm( uv.mul( 90.0 ).add( seed ) ) ) ) ), ash );
	k.get( 'colour' ).assign( mix( c, vec3( 0.22, 0.05, 0.012 ), lit.mul( sub( 1.0, ash ) ) ) );

	// a lump not yet hot through still shows a dull red under its skin where it is warm

	const ember = smoothstep( 0.25, 0.6, hb ).mul( sub( 1.0, lit ) ).mul( add( 0.5, mul( 0.5, kfbm( uv.mul( 25.0 ).add( seed ).add( 4.0 ) ) ) ) );
	k.get( 'glow' ).assign( htGlow( hb ).mul( lit ).add( htGlow( hb.mul( 0.55 ) ).mul( ember ).mul( 0.6 ) ).mul( p_fcGlow ).mul( sub( 1.0, mul( 0.9, ash ) ) ) );

	// charcoal's sheen: a dull silver only on the cold faces' best-lit facets, gone where ash or heat is

	k.get( 'rough' ).assign( mix( mix( 0.5, 0.75, block ), 0.97, max( ash, lit ) ) );
	k.get( 'metal' ).assign( mul( 0.25, sub( 1.0, max( ash, lit ) ) ) );
	k.get( 'height' ).assign( float( -0.0012 ).mul( check ).mul( sub( 1.0, mul( 0.8, ash ) ) ).add( mul( 0.0002, fib.sub( 0.5 ) ) ) );

}, 'void' );

export const look_29 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_ssRow.assign( lookSettings.sample( ivec2( 0, 29 ) ).setSampler( false ).r );
	p_ssLong.assign( lookSettings.sample( ivec2( 1, 29 ) ).setSampler( false ).r );
	p_ssJitter.assign( lookSettings.sample( ivec2( 2, 29 ) ).setSampler( false ).r );
	p_ssJoint.assign( lookSettings.sample( ivec2( 3, 29 ) ).setSampler( false ).r );
	p_ssWorld.assign( lookSettings.sample( ivec2( 4, 29 ) ).setSampler( false ).r );
	p_ssPillow.assign( lookSettings.sample( ivec2( 5, 29 ) ).setSampler( false ).r );
	p_ssPitch.assign( lookSettings.sample( ivec2( 6, 29 ) ).setSampler( false ).r );
	p_ssTool.assign( lookSettings.sample( ivec2( 7, 29 ) ).setSampler( false ).r );
	p_ssA.assign( lookSettings.sample( ivec2( 8, 29 ) ).setSampler( false ).rgb );
	p_ssB.assign( lookSettings.sample( ivec2( 9, 29 ) ).setSampler( false ).rgb );
	p_ssMortar.assign( lookSettings.sample( ivec2( 10, 29 ) ).setSampler( false ).rgb );
	p_ssGrain.assign( lookSettings.sample( ivec2( 11, 29 ) ).setSampler( false ).r );
	p_ssSpeck.assign( lookSettings.sample( ivec2( 12, 29 ) ).setSampler( false ).r );
	p_ssIron.assign( lookSettings.sample( ivec2( 13, 29 ) ).setSampler( false ).r );
	p_ssSoot.assign( lookSettings.sample( ivec2( 14, 29 ) ).setSampler( false ).r );
	p_ssHeat.assign( lookSettings.sample( ivec2( 15, 29 ) ).setSampler( false ).r );
	p_ssRough.assign( lookSettings.sample( ivec2( 16, 29 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const q = select( p_ssWorld.greaterThan( 0.5 ), ssPlace( wp, normalize( wn ) ), uv );

	// the bond: one for the whole world, so a part's courses meet its neighbour's

	const id = vec2( 0.0 );
	const bed = float( 1.0 ), stone = float( 1.0 ), ex = float( 1.0 );
	const sc = p_ssA;
	const own = kh( seed.add( vec2( 3.1, 7.7 ) ) );

	If( p_ssJoint.greaterThan( 0.0 ), () => {

		const c = kcourse( q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id );

		// the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble

		const jx = min( c.x, sub( 1.0, c.x ) ).mul( c.w ), jy = min( c.y, sub( 1.0, c.y ) ).mul( p_ssRow );
		const chip = kfbm( q.mul( 9.0 ).add( id.mul( 5.3 ) ) ).sub( 0.5 ).mul( p_ssJoint ).mul( 0.8 );
		ex.assign( min( jx, jy ).add( chip ) );

		// the joint's edge softened by the pixel's own size, so it never breaks into dashes far off

		const aa = max( length( lookGx ).add( length( lookGy ) ), 0.0015 );
		stone.assign( smoothstep( p_ssJoint.mul( 0.5 ).sub( aa ), p_ssJoint.mul( 0.5 ).add( aa ), ex ) );

		// the face bulges toward its middle, flattening, so its edges roll down to the joint

		bed.assign( smoothstep( 0.0, 0.05, ex ).mul( add( 0.6, mul( 0.4, kfbm( q.mul( 5.0 ).add( id.mul( 2.1 ) ) ) ) ) ) );
		own.assign( kh( id.add( 2.3 ) ) );

	} );

	// each stone its shade between the two it is cut from, a few darker or warmer

	const h2 = kh( id.add( 8.1 ) ), h3 = kh( id.add( 4.4 ) );
	sc.assign( mix( p_ssA, p_ssB, own ).mul( add( 0.9, mul( 0.18, h2 ) ) ) );

	If( h3.lessThan( 0.08 ), () => {

		sc.mulAssign( vec3( 1.05, 0.98, 0.9 ) );

	} );

	// pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it

	const facet = kfbm( q.mul( 9.0 ).add( id.mul( 3.7 ) ) );
	const cloud = kfbm( q.mul( 2.3 ).add( id.mul( 1.9 ) ).add( 4.0 ) );
	const grain = kn( q.mul( p_ssGrain ).add( id.mul( 13.0 ) ) ).mul( kfade( div( 2.0, p_ssGrain ) ) );
	const speck = smoothstep( 0.78, 0.92, kn( q.mul( p_ssGrain ).mul( 0.6 ).add( id.mul( 7.0 ) ).add( 3.0 ) ) ).mul( kfade( div( 3.0, p_ssGrain ) ) );
	sc.mulAssign( add( 0.82, mul( 0.36, cloud ) ).mul( add( 1.0, grain.sub( 0.5 ).mul( 0.18 ).mul( p_ssSpeck ) ) ).mul( sub( 1.0, mul( 0.35, speck ).mul( p_ssSpeck ) ) ) );

	// iron bands through the odd stone: rust brown, wandering across it

	const band = smoothstep( 0.55, 0.9, kfbm( vec2( q.x.mul( 1.2 ), q.y.mul( 5.0 ) ).add( id.mul( 2.0 ) ).add( 9.0 ) ) ).mul( step( 0.72, kh( id.add( 6.6 ) ) ) );
	sc.assign( mix( sc, sc.mul( vec3( 1.25, 0.82, 0.55 ) ), band.mul( p_ssIron ) ) );

	// the mortar: lime, gritty, back in the joint
	// the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant

	const trow = floor( q.y.div( 0.07 ) );
	const tdir = select( kh1( trow.add( 3.0 ) ).greaterThan( 0.5 ), 1.0, - 1.0 );
	const tl = fract( q.x.add( tdir.mul( q.y.sub( trow.mul( 0.07 ) ) ) ).mul( 45.0 ).add( kh1( trow ).mul( 9.0 ) ) );
	const tool = sub( 1.0, smoothstep( 0.0, 0.25, min( tl, sub( 1.0, tl ) ) ) ).mul( smoothstep( 0.3, 0.6, kn( q.mul( 12.0 ).add( trow ) ) ) ).mul( p_ssTool ).mul( kfade( 0.006 ) );
	sc.mulAssign( sub( 1.0, mul( 0.18, tool ) ) );
	const mc = p_ssMortar.mul( add( 0.85, mul( 0.25, kn( q.mul( 140.0 ).add( 2.0 ) ) ).mul( kfade( 0.006 ) ) ) ).mul( add( 0.9, mul( 0.2, cloud ) ) );
	const col = mix( mc, sc, stone );
	const ht = stone.mul( p_ssPillow.mul( bed ).mul( add( 0.75, mul( 0.5, h2 ) ) ).add( mul( 0.004, p_ssPitch ).mul( facet.sub( 0.5 ) ) ) ).sub( sub( 1.0, stone ).mul( 0.006 ) ).sub( mul( 0.0006, tool ) );

	// the fire's heat: reddened, then crazed and flaking pale where hottest

	const heat = clamp( vS0.y.mul( p_ssHeat ), 0.0, 1.0 );

	If( heat.greaterThan( 0.0 ), () => {

		// a few fine wandering cracks, only where the stone is hottest, never a net of cells

		const cn = kfbm( q.mul( 7.0 ).add( id.mul( 3.3 ) ).add( 2.0 ) );
		const craze = sub( 1.0, smoothstep( 0.0, 0.012, abs( cn.sub( 0.5 ) ) ) ).mul( smoothstep( 0.55, 0.9, heat ) ).mul( smoothstep( 0.4, 0.6, kn( q.mul( 3.0 ).add( id ) ) ) ).mul( kfade( 0.008 ) );
		col.assign( mix( col, col.mul( vec3( 1.3, 0.8, 0.6 ) ), smoothstep( 0.0, 0.6, heat ).mul( 0.8 ) ) );
		const flake = smoothstep( 0.55, 0.75, kfbm( q.mul( 6.0 ).add( id ).add( 1.0 ) ) ).mul( smoothstep( 0.5, 1.0, heat ) );
		col.assign( mix( col, vec3( 0.5, 0.46, 0.42 ), flake.mul( 0.6 ) ) );
		col.mulAssign( sub( 1.0, mul( 0.6, craze ) ) );
		ht.subAssign( mul( 0.002, craze ) );

	} );

	// soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick

	const soot = clamp( vS0.x.mul( p_ssSoot ), 0.0, 1.0 );
	const patchy = kfbm( q.mul( 3.1 ).add( 21.0 ) );
	const s = smoothstep( 0.0, 1.0, soot.mul( 1.5 ).sub( mul( 0.35, patchy ) ).add( sub( 1.0, stone ).mul( 0.35 ) ).add( sub( 0.5, facet ).mul( 0.25 ) ) );
	const sootC = vec3( 0.022, 0.019, 0.017 ).mul( add( 0.8, mul( 0.5, patchy ) ) );
	col.assign( mix( col, sootC, s.mul( 0.96 ) ) );

	// wet: darker and glossy

	const wet = clamp( vS0.z, 0.0, 1.0 );
	col.mulAssign( sub( 1.0, mul( 0.45, wet ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( mix( p_ssRough, 0.97, sub( 1.0, stone ) ), 0.55, max( s.mul( smoothstep( 0.7, 1.0, soot ) ).mul( 0.6 ), wet.mul( 0.75 ) ) ) );
	k.get( 'height' ).assign( ht );
	k.get( 'ao' ).assign( mix( 0.55, 1.0, stone ) );

}, 'void' );

export const look_30 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_ssRow.assign( lookSettings.sample( ivec2( 0, 30 ) ).setSampler( false ).r );
	p_ssLong.assign( lookSettings.sample( ivec2( 1, 30 ) ).setSampler( false ).r );
	p_ssJitter.assign( lookSettings.sample( ivec2( 2, 30 ) ).setSampler( false ).r );
	p_ssJoint.assign( lookSettings.sample( ivec2( 3, 30 ) ).setSampler( false ).r );
	p_ssWorld.assign( lookSettings.sample( ivec2( 4, 30 ) ).setSampler( false ).r );
	p_ssPillow.assign( lookSettings.sample( ivec2( 5, 30 ) ).setSampler( false ).r );
	p_ssPitch.assign( lookSettings.sample( ivec2( 6, 30 ) ).setSampler( false ).r );
	p_ssTool.assign( lookSettings.sample( ivec2( 7, 30 ) ).setSampler( false ).r );
	p_ssA.assign( lookSettings.sample( ivec2( 8, 30 ) ).setSampler( false ).rgb );
	p_ssB.assign( lookSettings.sample( ivec2( 9, 30 ) ).setSampler( false ).rgb );
	p_ssMortar.assign( lookSettings.sample( ivec2( 10, 30 ) ).setSampler( false ).rgb );
	p_ssGrain.assign( lookSettings.sample( ivec2( 11, 30 ) ).setSampler( false ).r );
	p_ssSpeck.assign( lookSettings.sample( ivec2( 12, 30 ) ).setSampler( false ).r );
	p_ssIron.assign( lookSettings.sample( ivec2( 13, 30 ) ).setSampler( false ).r );
	p_ssSoot.assign( lookSettings.sample( ivec2( 14, 30 ) ).setSampler( false ).r );
	p_ssHeat.assign( lookSettings.sample( ivec2( 15, 30 ) ).setSampler( false ).r );
	p_ssRough.assign( lookSettings.sample( ivec2( 16, 30 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const q = select( p_ssWorld.greaterThan( 0.5 ), ssPlace( wp, normalize( wn ) ), uv );

	// the bond: one for the whole world, so a part's courses meet its neighbour's

	const id = vec2( 0.0 );
	const bed = float( 1.0 ), stone = float( 1.0 ), ex = float( 1.0 );
	const sc = p_ssA;
	const own = kh( seed.add( vec2( 3.1, 7.7 ) ) );

	If( p_ssJoint.greaterThan( 0.0 ), () => {

		const c = kcourse( q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id );

		// the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble

		const jx = min( c.x, sub( 1.0, c.x ) ).mul( c.w ), jy = min( c.y, sub( 1.0, c.y ) ).mul( p_ssRow );
		const chip = kfbm( q.mul( 9.0 ).add( id.mul( 5.3 ) ) ).sub( 0.5 ).mul( p_ssJoint ).mul( 0.8 );
		ex.assign( min( jx, jy ).add( chip ) );

		// the joint's edge softened by the pixel's own size, so it never breaks into dashes far off

		const aa = max( length( lookGx ).add( length( lookGy ) ), 0.0015 );
		stone.assign( smoothstep( p_ssJoint.mul( 0.5 ).sub( aa ), p_ssJoint.mul( 0.5 ).add( aa ), ex ) );

		// the face bulges toward its middle, flattening, so its edges roll down to the joint

		bed.assign( smoothstep( 0.0, 0.05, ex ).mul( add( 0.6, mul( 0.4, kfbm( q.mul( 5.0 ).add( id.mul( 2.1 ) ) ) ) ) ) );
		own.assign( kh( id.add( 2.3 ) ) );

	} );

	// each stone its shade between the two it is cut from, a few darker or warmer

	const h2 = kh( id.add( 8.1 ) ), h3 = kh( id.add( 4.4 ) );
	sc.assign( mix( p_ssA, p_ssB, own ).mul( add( 0.9, mul( 0.18, h2 ) ) ) );

	If( h3.lessThan( 0.08 ), () => {

		sc.mulAssign( vec3( 1.05, 0.98, 0.9 ) );

	} );

	// pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it

	const facet = kfbm( q.mul( 9.0 ).add( id.mul( 3.7 ) ) );
	const cloud = kfbm( q.mul( 2.3 ).add( id.mul( 1.9 ) ).add( 4.0 ) );
	const grain = kn( q.mul( p_ssGrain ).add( id.mul( 13.0 ) ) ).mul( kfade( div( 2.0, p_ssGrain ) ) );
	const speck = smoothstep( 0.78, 0.92, kn( q.mul( p_ssGrain ).mul( 0.6 ).add( id.mul( 7.0 ) ).add( 3.0 ) ) ).mul( kfade( div( 3.0, p_ssGrain ) ) );
	sc.mulAssign( add( 0.82, mul( 0.36, cloud ) ).mul( add( 1.0, grain.sub( 0.5 ).mul( 0.18 ).mul( p_ssSpeck ) ) ).mul( sub( 1.0, mul( 0.35, speck ).mul( p_ssSpeck ) ) ) );

	// iron bands through the odd stone: rust brown, wandering across it

	const band = smoothstep( 0.55, 0.9, kfbm( vec2( q.x.mul( 1.2 ), q.y.mul( 5.0 ) ).add( id.mul( 2.0 ) ).add( 9.0 ) ) ).mul( step( 0.72, kh( id.add( 6.6 ) ) ) );
	sc.assign( mix( sc, sc.mul( vec3( 1.25, 0.82, 0.55 ) ), band.mul( p_ssIron ) ) );

	// the mortar: lime, gritty, back in the joint
	// the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant

	const trow = floor( q.y.div( 0.07 ) );
	const tdir = select( kh1( trow.add( 3.0 ) ).greaterThan( 0.5 ), 1.0, - 1.0 );
	const tl = fract( q.x.add( tdir.mul( q.y.sub( trow.mul( 0.07 ) ) ) ).mul( 45.0 ).add( kh1( trow ).mul( 9.0 ) ) );
	const tool = sub( 1.0, smoothstep( 0.0, 0.25, min( tl, sub( 1.0, tl ) ) ) ).mul( smoothstep( 0.3, 0.6, kn( q.mul( 12.0 ).add( trow ) ) ) ).mul( p_ssTool ).mul( kfade( 0.006 ) );
	sc.mulAssign( sub( 1.0, mul( 0.18, tool ) ) );
	const mc = p_ssMortar.mul( add( 0.85, mul( 0.25, kn( q.mul( 140.0 ).add( 2.0 ) ) ).mul( kfade( 0.006 ) ) ) ).mul( add( 0.9, mul( 0.2, cloud ) ) );
	const col = mix( mc, sc, stone );
	const ht = stone.mul( p_ssPillow.mul( bed ).mul( add( 0.75, mul( 0.5, h2 ) ) ).add( mul( 0.004, p_ssPitch ).mul( facet.sub( 0.5 ) ) ) ).sub( sub( 1.0, stone ).mul( 0.006 ) ).sub( mul( 0.0006, tool ) );

	// the fire's heat: reddened, then crazed and flaking pale where hottest

	const heat = clamp( vS0.y.mul( p_ssHeat ), 0.0, 1.0 );

	If( heat.greaterThan( 0.0 ), () => {

		// a few fine wandering cracks, only where the stone is hottest, never a net of cells

		const cn = kfbm( q.mul( 7.0 ).add( id.mul( 3.3 ) ).add( 2.0 ) );
		const craze = sub( 1.0, smoothstep( 0.0, 0.012, abs( cn.sub( 0.5 ) ) ) ).mul( smoothstep( 0.55, 0.9, heat ) ).mul( smoothstep( 0.4, 0.6, kn( q.mul( 3.0 ).add( id ) ) ) ).mul( kfade( 0.008 ) );
		col.assign( mix( col, col.mul( vec3( 1.3, 0.8, 0.6 ) ), smoothstep( 0.0, 0.6, heat ).mul( 0.8 ) ) );
		const flake = smoothstep( 0.55, 0.75, kfbm( q.mul( 6.0 ).add( id ).add( 1.0 ) ) ).mul( smoothstep( 0.5, 1.0, heat ) );
		col.assign( mix( col, vec3( 0.5, 0.46, 0.42 ), flake.mul( 0.6 ) ) );
		col.mulAssign( sub( 1.0, mul( 0.6, craze ) ) );
		ht.subAssign( mul( 0.002, craze ) );

	} );

	// soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick

	const soot = clamp( vS0.x.mul( p_ssSoot ), 0.0, 1.0 );
	const patchy = kfbm( q.mul( 3.1 ).add( 21.0 ) );
	const s = smoothstep( 0.0, 1.0, soot.mul( 1.5 ).sub( mul( 0.35, patchy ) ).add( sub( 1.0, stone ).mul( 0.35 ) ).add( sub( 0.5, facet ).mul( 0.25 ) ) );
	const sootC = vec3( 0.022, 0.019, 0.017 ).mul( add( 0.8, mul( 0.5, patchy ) ) );
	col.assign( mix( col, sootC, s.mul( 0.96 ) ) );

	// wet: darker and glossy

	const wet = clamp( vS0.z, 0.0, 1.0 );
	col.mulAssign( sub( 1.0, mul( 0.45, wet ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( mix( p_ssRough, 0.97, sub( 1.0, stone ) ), 0.55, max( s.mul( smoothstep( 0.7, 1.0, soot ) ).mul( 0.6 ), wet.mul( 0.75 ) ) ) );
	k.get( 'height' ).assign( ht );
	k.get( 'ao' ).assign( mix( 0.55, 1.0, stone ) );

}, 'void' );

export const look_31 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_ssRow.assign( lookSettings.sample( ivec2( 0, 31 ) ).setSampler( false ).r );
	p_ssLong.assign( lookSettings.sample( ivec2( 1, 31 ) ).setSampler( false ).r );
	p_ssJitter.assign( lookSettings.sample( ivec2( 2, 31 ) ).setSampler( false ).r );
	p_ssJoint.assign( lookSettings.sample( ivec2( 3, 31 ) ).setSampler( false ).r );
	p_ssWorld.assign( lookSettings.sample( ivec2( 4, 31 ) ).setSampler( false ).r );
	p_ssPillow.assign( lookSettings.sample( ivec2( 5, 31 ) ).setSampler( false ).r );
	p_ssPitch.assign( lookSettings.sample( ivec2( 6, 31 ) ).setSampler( false ).r );
	p_ssTool.assign( lookSettings.sample( ivec2( 7, 31 ) ).setSampler( false ).r );
	p_ssA.assign( lookSettings.sample( ivec2( 8, 31 ) ).setSampler( false ).rgb );
	p_ssB.assign( lookSettings.sample( ivec2( 9, 31 ) ).setSampler( false ).rgb );
	p_ssMortar.assign( lookSettings.sample( ivec2( 10, 31 ) ).setSampler( false ).rgb );
	p_ssGrain.assign( lookSettings.sample( ivec2( 11, 31 ) ).setSampler( false ).r );
	p_ssSpeck.assign( lookSettings.sample( ivec2( 12, 31 ) ).setSampler( false ).r );
	p_ssIron.assign( lookSettings.sample( ivec2( 13, 31 ) ).setSampler( false ).r );
	p_ssSoot.assign( lookSettings.sample( ivec2( 14, 31 ) ).setSampler( false ).r );
	p_ssHeat.assign( lookSettings.sample( ivec2( 15, 31 ) ).setSampler( false ).r );
	p_ssRough.assign( lookSettings.sample( ivec2( 16, 31 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const q = select( p_ssWorld.greaterThan( 0.5 ), ssPlace( wp, normalize( wn ) ), uv );

	// the bond: one for the whole world, so a part's courses meet its neighbour's

	const id = vec2( 0.0 );
	const bed = float( 1.0 ), stone = float( 1.0 ), ex = float( 1.0 );
	const sc = p_ssA;
	const own = kh( seed.add( vec2( 3.1, 7.7 ) ) );

	If( p_ssJoint.greaterThan( 0.0 ), () => {

		const c = kcourse( q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id );

		// the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble

		const jx = min( c.x, sub( 1.0, c.x ) ).mul( c.w ), jy = min( c.y, sub( 1.0, c.y ) ).mul( p_ssRow );
		const chip = kfbm( q.mul( 9.0 ).add( id.mul( 5.3 ) ) ).sub( 0.5 ).mul( p_ssJoint ).mul( 0.8 );
		ex.assign( min( jx, jy ).add( chip ) );

		// the joint's edge softened by the pixel's own size, so it never breaks into dashes far off

		const aa = max( length( lookGx ).add( length( lookGy ) ), 0.0015 );
		stone.assign( smoothstep( p_ssJoint.mul( 0.5 ).sub( aa ), p_ssJoint.mul( 0.5 ).add( aa ), ex ) );

		// the face bulges toward its middle, flattening, so its edges roll down to the joint

		bed.assign( smoothstep( 0.0, 0.05, ex ).mul( add( 0.6, mul( 0.4, kfbm( q.mul( 5.0 ).add( id.mul( 2.1 ) ) ) ) ) ) );
		own.assign( kh( id.add( 2.3 ) ) );

	} );

	// each stone its shade between the two it is cut from, a few darker or warmer

	const h2 = kh( id.add( 8.1 ) ), h3 = kh( id.add( 4.4 ) );
	sc.assign( mix( p_ssA, p_ssB, own ).mul( add( 0.9, mul( 0.18, h2 ) ) ) );

	If( h3.lessThan( 0.08 ), () => {

		sc.mulAssign( vec3( 1.05, 0.98, 0.9 ) );

	} );

	// pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it

	const facet = kfbm( q.mul( 9.0 ).add( id.mul( 3.7 ) ) );
	const cloud = kfbm( q.mul( 2.3 ).add( id.mul( 1.9 ) ).add( 4.0 ) );
	const grain = kn( q.mul( p_ssGrain ).add( id.mul( 13.0 ) ) ).mul( kfade( div( 2.0, p_ssGrain ) ) );
	const speck = smoothstep( 0.78, 0.92, kn( q.mul( p_ssGrain ).mul( 0.6 ).add( id.mul( 7.0 ) ).add( 3.0 ) ) ).mul( kfade( div( 3.0, p_ssGrain ) ) );
	sc.mulAssign( add( 0.82, mul( 0.36, cloud ) ).mul( add( 1.0, grain.sub( 0.5 ).mul( 0.18 ).mul( p_ssSpeck ) ) ).mul( sub( 1.0, mul( 0.35, speck ).mul( p_ssSpeck ) ) ) );

	// iron bands through the odd stone: rust brown, wandering across it

	const band = smoothstep( 0.55, 0.9, kfbm( vec2( q.x.mul( 1.2 ), q.y.mul( 5.0 ) ).add( id.mul( 2.0 ) ).add( 9.0 ) ) ).mul( step( 0.72, kh( id.add( 6.6 ) ) ) );
	sc.assign( mix( sc, sc.mul( vec3( 1.25, 0.82, 0.55 ) ), band.mul( p_ssIron ) ) );

	// the mortar: lime, gritty, back in the joint
	// the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant

	const trow = floor( q.y.div( 0.07 ) );
	const tdir = select( kh1( trow.add( 3.0 ) ).greaterThan( 0.5 ), 1.0, - 1.0 );
	const tl = fract( q.x.add( tdir.mul( q.y.sub( trow.mul( 0.07 ) ) ) ).mul( 45.0 ).add( kh1( trow ).mul( 9.0 ) ) );
	const tool = sub( 1.0, smoothstep( 0.0, 0.25, min( tl, sub( 1.0, tl ) ) ) ).mul( smoothstep( 0.3, 0.6, kn( q.mul( 12.0 ).add( trow ) ) ) ).mul( p_ssTool ).mul( kfade( 0.006 ) );
	sc.mulAssign( sub( 1.0, mul( 0.18, tool ) ) );
	const mc = p_ssMortar.mul( add( 0.85, mul( 0.25, kn( q.mul( 140.0 ).add( 2.0 ) ) ).mul( kfade( 0.006 ) ) ) ).mul( add( 0.9, mul( 0.2, cloud ) ) );
	const col = mix( mc, sc, stone );
	const ht = stone.mul( p_ssPillow.mul( bed ).mul( add( 0.75, mul( 0.5, h2 ) ) ).add( mul( 0.004, p_ssPitch ).mul( facet.sub( 0.5 ) ) ) ).sub( sub( 1.0, stone ).mul( 0.006 ) ).sub( mul( 0.0006, tool ) );

	// the fire's heat: reddened, then crazed and flaking pale where hottest

	const heat = clamp( vS0.y.mul( p_ssHeat ), 0.0, 1.0 );

	If( heat.greaterThan( 0.0 ), () => {

		// a few fine wandering cracks, only where the stone is hottest, never a net of cells

		const cn = kfbm( q.mul( 7.0 ).add( id.mul( 3.3 ) ).add( 2.0 ) );
		const craze = sub( 1.0, smoothstep( 0.0, 0.012, abs( cn.sub( 0.5 ) ) ) ).mul( smoothstep( 0.55, 0.9, heat ) ).mul( smoothstep( 0.4, 0.6, kn( q.mul( 3.0 ).add( id ) ) ) ).mul( kfade( 0.008 ) );
		col.assign( mix( col, col.mul( vec3( 1.3, 0.8, 0.6 ) ), smoothstep( 0.0, 0.6, heat ).mul( 0.8 ) ) );
		const flake = smoothstep( 0.55, 0.75, kfbm( q.mul( 6.0 ).add( id ).add( 1.0 ) ) ).mul( smoothstep( 0.5, 1.0, heat ) );
		col.assign( mix( col, vec3( 0.5, 0.46, 0.42 ), flake.mul( 0.6 ) ) );
		col.mulAssign( sub( 1.0, mul( 0.6, craze ) ) );
		ht.subAssign( mul( 0.002, craze ) );

	} );

	// soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick

	const soot = clamp( vS0.x.mul( p_ssSoot ), 0.0, 1.0 );
	const patchy = kfbm( q.mul( 3.1 ).add( 21.0 ) );
	const s = smoothstep( 0.0, 1.0, soot.mul( 1.5 ).sub( mul( 0.35, patchy ) ).add( sub( 1.0, stone ).mul( 0.35 ) ).add( sub( 0.5, facet ).mul( 0.25 ) ) );
	const sootC = vec3( 0.022, 0.019, 0.017 ).mul( add( 0.8, mul( 0.5, patchy ) ) );
	col.assign( mix( col, sootC, s.mul( 0.96 ) ) );

	// wet: darker and glossy

	const wet = clamp( vS0.z, 0.0, 1.0 );
	col.mulAssign( sub( 1.0, mul( 0.45, wet ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( mix( p_ssRough, 0.97, sub( 1.0, stone ) ), 0.55, max( s.mul( smoothstep( 0.7, 1.0, soot ) ).mul( 0.6 ), wet.mul( 0.75 ) ) ) );
	k.get( 'height' ).assign( ht );
	k.get( 'ao' ).assign( mix( 0.55, 1.0, stone ) );

}, 'void' );

export const look_32 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_ssRow.assign( lookSettings.sample( ivec2( 0, 32 ) ).setSampler( false ).r );
	p_ssLong.assign( lookSettings.sample( ivec2( 1, 32 ) ).setSampler( false ).r );
	p_ssJitter.assign( lookSettings.sample( ivec2( 2, 32 ) ).setSampler( false ).r );
	p_ssJoint.assign( lookSettings.sample( ivec2( 3, 32 ) ).setSampler( false ).r );
	p_ssWorld.assign( lookSettings.sample( ivec2( 4, 32 ) ).setSampler( false ).r );
	p_ssPillow.assign( lookSettings.sample( ivec2( 5, 32 ) ).setSampler( false ).r );
	p_ssPitch.assign( lookSettings.sample( ivec2( 6, 32 ) ).setSampler( false ).r );
	p_ssTool.assign( lookSettings.sample( ivec2( 7, 32 ) ).setSampler( false ).r );
	p_ssA.assign( lookSettings.sample( ivec2( 8, 32 ) ).setSampler( false ).rgb );
	p_ssB.assign( lookSettings.sample( ivec2( 9, 32 ) ).setSampler( false ).rgb );
	p_ssMortar.assign( lookSettings.sample( ivec2( 10, 32 ) ).setSampler( false ).rgb );
	p_ssGrain.assign( lookSettings.sample( ivec2( 11, 32 ) ).setSampler( false ).r );
	p_ssSpeck.assign( lookSettings.sample( ivec2( 12, 32 ) ).setSampler( false ).r );
	p_ssIron.assign( lookSettings.sample( ivec2( 13, 32 ) ).setSampler( false ).r );
	p_ssSoot.assign( lookSettings.sample( ivec2( 14, 32 ) ).setSampler( false ).r );
	p_ssHeat.assign( lookSettings.sample( ivec2( 15, 32 ) ).setSampler( false ).r );
	p_ssRough.assign( lookSettings.sample( ivec2( 16, 32 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const q = select( p_ssWorld.greaterThan( 0.5 ), ssPlace( wp, normalize( wn ) ), uv );

	// the bond: one for the whole world, so a part's courses meet its neighbour's

	const id = vec2( 0.0 );
	const bed = float( 1.0 ), stone = float( 1.0 ), ex = float( 1.0 );
	const sc = p_ssA;
	const own = kh( seed.add( vec2( 3.1, 7.7 ) ) );

	If( p_ssJoint.greaterThan( 0.0 ), () => {

		const c = kcourse( q, p_ssRow, p_ssLong, p_ssJitter, 11.0, id );

		// the distance in metres to the stone's nearest joint, its arris chipped by a coarse wobble

		const jx = min( c.x, sub( 1.0, c.x ) ).mul( c.w ), jy = min( c.y, sub( 1.0, c.y ) ).mul( p_ssRow );
		const chip = kfbm( q.mul( 9.0 ).add( id.mul( 5.3 ) ) ).sub( 0.5 ).mul( p_ssJoint ).mul( 0.8 );
		ex.assign( min( jx, jy ).add( chip ) );

		// the joint's edge softened by the pixel's own size, so it never breaks into dashes far off

		const aa = max( length( lookGx ).add( length( lookGy ) ), 0.0015 );
		stone.assign( smoothstep( p_ssJoint.mul( 0.5 ).sub( aa ), p_ssJoint.mul( 0.5 ).add( aa ), ex ) );

		// the face bulges toward its middle, flattening, so its edges roll down to the joint

		bed.assign( smoothstep( 0.0, 0.05, ex ).mul( add( 0.6, mul( 0.4, kfbm( q.mul( 5.0 ).add( id.mul( 2.1 ) ) ) ) ) ) );
		own.assign( kh( id.add( 2.3 ) ) );

	} );

	// each stone its shade between the two it is cut from, a few darker or warmer

	const h2 = kh( id.add( 8.1 ) ), h3 = kh( id.add( 4.4 ) );
	sc.assign( mix( p_ssA, p_ssB, own ).mul( add( 0.9, mul( 0.18, h2 ) ) ) );

	If( h3.lessThan( 0.08 ), () => {

		sc.mulAssign( vec3( 1.05, 0.98, 0.9 ) );

	} );

	// pitching: the tooled face broken into shallow facets, coarse cloud and fine sand grain on it

	const facet = kfbm( q.mul( 9.0 ).add( id.mul( 3.7 ) ) );
	const cloud = kfbm( q.mul( 2.3 ).add( id.mul( 1.9 ) ).add( 4.0 ) );
	const grain = kn( q.mul( p_ssGrain ).add( id.mul( 13.0 ) ) ).mul( kfade( div( 2.0, p_ssGrain ) ) );
	const speck = smoothstep( 0.78, 0.92, kn( q.mul( p_ssGrain ).mul( 0.6 ).add( id.mul( 7.0 ) ).add( 3.0 ) ) ).mul( kfade( div( 3.0, p_ssGrain ) ) );
	sc.mulAssign( add( 0.82, mul( 0.36, cloud ) ).mul( add( 1.0, grain.sub( 0.5 ).mul( 0.18 ).mul( p_ssSpeck ) ) ).mul( sub( 1.0, mul( 0.35, speck ).mul( p_ssSpeck ) ) ) );

	// iron bands through the odd stone: rust brown, wandering across it

	const band = smoothstep( 0.55, 0.9, kfbm( vec2( q.x.mul( 1.2 ), q.y.mul( 5.0 ) ).add( id.mul( 2.0 ) ).add( 9.0 ) ) ).mul( step( 0.72, kh( id.add( 6.6 ) ) ) );
	sc.assign( mix( sc, sc.mul( vec3( 1.25, 0.82, 0.55 ) ), band.mul( p_ssIron ) ) );

	// the mortar: lime, gritty, back in the joint
	// the mason's tooling on a dressed stone: rows of short diagonal chisel strokes, each row its own slant

	const trow = floor( q.y.div( 0.07 ) );
	const tdir = select( kh1( trow.add( 3.0 ) ).greaterThan( 0.5 ), 1.0, - 1.0 );
	const tl = fract( q.x.add( tdir.mul( q.y.sub( trow.mul( 0.07 ) ) ) ).mul( 45.0 ).add( kh1( trow ).mul( 9.0 ) ) );
	const tool = sub( 1.0, smoothstep( 0.0, 0.25, min( tl, sub( 1.0, tl ) ) ) ).mul( smoothstep( 0.3, 0.6, kn( q.mul( 12.0 ).add( trow ) ) ) ).mul( p_ssTool ).mul( kfade( 0.006 ) );
	sc.mulAssign( sub( 1.0, mul( 0.18, tool ) ) );
	const mc = p_ssMortar.mul( add( 0.85, mul( 0.25, kn( q.mul( 140.0 ).add( 2.0 ) ) ).mul( kfade( 0.006 ) ) ) ).mul( add( 0.9, mul( 0.2, cloud ) ) );
	const col = mix( mc, sc, stone );
	const ht = stone.mul( p_ssPillow.mul( bed ).mul( add( 0.75, mul( 0.5, h2 ) ) ).add( mul( 0.004, p_ssPitch ).mul( facet.sub( 0.5 ) ) ) ).sub( sub( 1.0, stone ).mul( 0.006 ) ).sub( mul( 0.0006, tool ) );

	// the fire's heat: reddened, then crazed and flaking pale where hottest

	const heat = clamp( vS0.y.mul( p_ssHeat ), 0.0, 1.0 );

	If( heat.greaterThan( 0.0 ), () => {

		// a few fine wandering cracks, only where the stone is hottest, never a net of cells

		const cn = kfbm( q.mul( 7.0 ).add( id.mul( 3.3 ) ).add( 2.0 ) );
		const craze = sub( 1.0, smoothstep( 0.0, 0.012, abs( cn.sub( 0.5 ) ) ) ).mul( smoothstep( 0.55, 0.9, heat ) ).mul( smoothstep( 0.4, 0.6, kn( q.mul( 3.0 ).add( id ) ) ) ).mul( kfade( 0.008 ) );
		col.assign( mix( col, col.mul( vec3( 1.3, 0.8, 0.6 ) ), smoothstep( 0.0, 0.6, heat ).mul( 0.8 ) ) );
		const flake = smoothstep( 0.55, 0.75, kfbm( q.mul( 6.0 ).add( id ).add( 1.0 ) ) ).mul( smoothstep( 0.5, 1.0, heat ) );
		col.assign( mix( col, vec3( 0.5, 0.46, 0.42 ), flake.mul( 0.6 ) ) );
		col.mulAssign( sub( 1.0, mul( 0.6, craze ) ) );
		ht.subAssign( mul( 0.002, craze ) );

	} );

	// soot: settled first in the joints and the hollows of the pitching, then over every face, a tarry gloss where thick

	const soot = clamp( vS0.x.mul( p_ssSoot ), 0.0, 1.0 );
	const patchy = kfbm( q.mul( 3.1 ).add( 21.0 ) );
	const s = smoothstep( 0.0, 1.0, soot.mul( 1.5 ).sub( mul( 0.35, patchy ) ).add( sub( 1.0, stone ).mul( 0.35 ) ).add( sub( 0.5, facet ).mul( 0.25 ) ) );
	const sootC = vec3( 0.022, 0.019, 0.017 ).mul( add( 0.8, mul( 0.5, patchy ) ) );
	col.assign( mix( col, sootC, s.mul( 0.96 ) ) );

	// wet: darker and glossy

	const wet = clamp( vS0.z, 0.0, 1.0 );
	col.mulAssign( sub( 1.0, mul( 0.45, wet ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( mix( p_ssRough, 0.97, sub( 1.0, stone ) ), 0.55, max( s.mul( smoothstep( 0.7, 1.0, soot ) ).mul( 0.6 ), wet.mul( 0.75 ) ) ) );
	k.get( 'height' ).assign( ht );
	k.get( 'ao' ).assign( mix( 0.55, 1.0, stone ) );

}, 'void' );

export const look_33 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_soLight.assign( lookSettings.sample( ivec2( 0, 33 ) ).setSampler( false ).rgb );
	p_soDark.assign( lookSettings.sample( ivec2( 1, 33 ) ).setSampler( false ).rgb );
	p_soAge.assign( lookSettings.sample( ivec2( 2, 33 ) ).setSampler( false ).r );
	p_soRings.assign( lookSettings.sample( ivec2( 3, 33 ) ).setSampler( false ).r );
	p_soEndRings.assign( lookSettings.sample( ivec2( 4, 33 ) ).setSampler( false ).r );
	p_soAdzeLen.assign( lookSettings.sample( ivec2( 5, 33 ) ).setSampler( false ).r );
	p_soAdze.assign( lookSettings.sample( ivec2( 6, 33 ) ).setSampler( false ).r );
	p_soChecks.assign( lookSettings.sample( ivec2( 7, 33 ) ).setSampler( false ).r );
	p_soSoot.assign( lookSettings.sample( ivec2( 8, 33 ) ).setSampler( false ).r );
	p_soRough.assign( lookSettings.sample( ivec2( 9, 33 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// grain: rings wandering across, fibres along

	const ring = kring( uv.mul( vec2( 1.0, p_soRings.div( 9.0 ) ) ), seed, 9.0 ).mul( add( 0.45, mul( 0.55, kfbm( uv.mul( vec2( 0.8, 6.0 ) ).add( seed ).add( 1.0 ) ) ) ) );
	const fib = kfibre( uv, seed );
	const cloud = kfbm( vec2( uv.x.mul( 1.3 ), uv.y.mul( 4.0 ) ).add( seed ).add( 3.0 ) );

	// the grain's long streaks: dark and light runs along u, wandering slowly, so it reads as wood and never as stripes

	const streak = kfbm( vec2( uv.x.mul( 0.7 ), uv.y.mul( 22.0 ) ).add( seed ).add( 4.0 ) ).mul( 0.7 ).add( mul( 0.3, kfbm( vec2( uv.x.mul( 2.0 ), uv.y.mul( 90.0 ) ).add( seed ) ) ) );
	const col = mix( p_soLight, p_soDark, ring.mul( 0.16 ).add( mul( 0.4, streak ) ) ).mul( add( 0.9, mul( 0.2, cloud ) ) ).mul( add( 0.94, mul( 0.12, fib ) ) );

	// age: a silver grey laid over the brown, deepest on the open faces, the rings left darker under it

	const grey = vec3( 0.30, 0.285, 0.26 ).mul( add( 0.85, mul( 0.25, cloud ) ) );
	col.assign( mix( col, grey.mul( sub( 1.0, mul( 0.35, ring ) ) ), p_soAge.mul( add( 0.6, mul( 0.4, kfbm( uv.mul( 2.0 ).add( seed ) ) ) ) ) ) );

	// the adze: shallow scallops across the grain, each stroke its own length, its edge wandering, the face between them
	// left flat in places where a stroke took off less

	const su = uv.x.div( p_soAdzeLen ).add( mul( 0.35, kn( vec2( uv.x.mul( 4.0 ), uv.y.mul( 9.0 ) ).add( seed ).add( 2.0 ) ) ) ).add( kh1( seed ).mul( 7.0 ) );
	const f = fract( su );
	const strokeAmt = add( 0.4, mul( 0.6, kh( vec2( floor( su ), seed.add( 3.0 ) ) ) ) );
	const scallop = f.mul( sub( 1.0, f ) ).mul( 4.0 );
	const adze = scallop.sub( 0.66 ).mul( p_soAdze ).mul( strokeAmt ).mul( kfade( p_soAdzeLen.mul( 0.4 ) ) );

	// the stroke's lip: a faint ridge where two scallops meet

	const lip = sub( 1.0, smoothstep( 0.0, 0.05, min( f, sub( 1.0, f ) ) ) ).mul( strokeAmt ).mul( kfade( 0.01 ) ).mul( step( 1e-6, p_soAdze ) );
	col.mulAssign( add( 1.0, mul( 0.015, lip ) ) );

	// checks: a few long dark splits along the grain

	const cy = uv.y.mul( 7.0 ).add( kfbm( vec2( uv.x.mul( 0.6 ), uv.y ).add( seed ).add( 9.0 ) ).mul( 1.4 ) );
	const crack = pow( sub( 1.0, abs( mul( 2.0, fract( cy ) ).sub( 1.0 ) ) ), 60.0 ).mul( step( 0.55, kh( vec2( floor( cy ), seed ) ) ) ).mul( smoothstep( 0.35, 0.6, kfbm( vec2( uv.x.mul( 2.2 ), floor( cy ) ).add( seed ) ) ) ).mul( p_soChecks ).mul( kfade( 0.004 ) );
	col.mulAssign( sub( 1.0, mul( 0.75, crack ) ) );

	// a sawn end: the rings round the pith, wandering a little, the splits opening out from the pith, the saw's kerf

	const endg = step( 0.5, vS0.z );

	If( endg.greaterThan( 0.5 ), () => {

		const r = length( vS1.xy );
		const ang = atan( vS1.y, vS1.x );
		const wob = mul( 0.004, kn( vec2( ang.mul( 3.0 ), r.mul( 20.0 ) ).add( seed ) ) );
		const er = fract( r.add( wob ).mul( p_soEndRings ) );
		const late = smoothstep( 0.55, 0.95, er ).mul( kfade( div( 0.6, p_soEndRings ) ) );
		const sap = mix( p_soLight.mul( 1.15 ), p_soDark, late.mul( 0.6 ) );

		// the splits: a few dark lines out from the pith, each its own angle, widening outward

		const split = float( 0.0 );

		Loop( 4, ( { i } ) => {

			const a = kh1( seed.add( float( i ).mul( 3.7 ) ) ).mul( 6.28318 );
			const d = abs( sin( ang.sub( a ) ) ).mul( r );
			split.assign( max( split, sub( 1.0, smoothstep( 0.0, add( 0.0015, r.mul( 0.012 ) ), d ) ).mul( step( 0.0, cos( ang.sub( a ) ) ) ).mul( smoothstep( 0.02, 0.06, r ) ) ) );

		} );

		const saw = kn( vec2( dot( vS1.xy, vec2( 0.8, 0.6 ) ).mul( 400.0 ), 0.0 ).add( seed ) ).mul( kfade( 0.003 ) );
		col.assign( mix( sap.mul( add( 0.9, mul( 0.15, saw ) ) ), grey.mul( 0.9 ), p_soAge.mul( 0.5 ) ).mul( sub( 1.0, mul( 0.7, split ).mul( p_soChecks ) ) ) );
		adze.assign( 0.0 );
		crack.assign( split );

	} );

	// soot: browning the wood toward a tarry black, deepest in the scallops' hollows

	const soot = clamp( vS0.x.mul( p_soSoot ), 0.0, 1.0 );

	// (the hollows only where the adze cut them: a timber with no adze has no rows of soot)

	const hollow = select( p_soAdze.greaterThan( 0.0 ), sub( 0.66, scallop ).mul( 0.3 ).mul( kfade( p_soAdzeLen.mul( 0.4 ) ) ), 0.0 );
	const s = smoothstep( 0.0, 1.0, soot.mul( 1.35 ).sub( mul( 0.3, kfbm( uv.mul( 3.0 ).add( seed ).add( 5.0 ) ) ) ).add( hollow ) );
	col.assign( mix( col, vec3( 0.03, 0.022, 0.016 ).mul( add( 0.8, mul( 0.4, cloud ) ) ), s.mul( 0.92 ) ) );

	// wear: hands polish it dark and smooth

	const wear = clamp( vS0.y, 0.0, 1.0 );
	col.assign( mix( col, col.mul( vec3( 0.7, 0.62, 0.55 ) ), wear.mul( 0.6 ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( mix( p_soRough, 0.6, s.mul( soot ) ), 0.45, wear ) );
	k.get( 'height' ).assign( adze.mul( sub( 1.0, wear.mul( 0.8 ) ) ).sub( mul( 0.0015, crack ) ).add( mul( 0.0003, fib.sub( 0.5 ) ) ).sub( mul( 0.0004, ring ) ) );

}, 'void' );

export const look_34 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_soLight.assign( lookSettings.sample( ivec2( 0, 34 ) ).setSampler( false ).rgb );
	p_soDark.assign( lookSettings.sample( ivec2( 1, 34 ) ).setSampler( false ).rgb );
	p_soAge.assign( lookSettings.sample( ivec2( 2, 34 ) ).setSampler( false ).r );
	p_soRings.assign( lookSettings.sample( ivec2( 3, 34 ) ).setSampler( false ).r );
	p_soEndRings.assign( lookSettings.sample( ivec2( 4, 34 ) ).setSampler( false ).r );
	p_soAdzeLen.assign( lookSettings.sample( ivec2( 5, 34 ) ).setSampler( false ).r );
	p_soAdze.assign( lookSettings.sample( ivec2( 6, 34 ) ).setSampler( false ).r );
	p_soChecks.assign( lookSettings.sample( ivec2( 7, 34 ) ).setSampler( false ).r );
	p_soSoot.assign( lookSettings.sample( ivec2( 8, 34 ) ).setSampler( false ).r );
	p_soRough.assign( lookSettings.sample( ivec2( 9, 34 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// grain: rings wandering across, fibres along

	const ring = kring( uv.mul( vec2( 1.0, p_soRings.div( 9.0 ) ) ), seed, 9.0 ).mul( add( 0.45, mul( 0.55, kfbm( uv.mul( vec2( 0.8, 6.0 ) ).add( seed ).add( 1.0 ) ) ) ) );
	const fib = kfibre( uv, seed );
	const cloud = kfbm( vec2( uv.x.mul( 1.3 ), uv.y.mul( 4.0 ) ).add( seed ).add( 3.0 ) );

	// the grain's long streaks: dark and light runs along u, wandering slowly, so it reads as wood and never as stripes

	const streak = kfbm( vec2( uv.x.mul( 0.7 ), uv.y.mul( 22.0 ) ).add( seed ).add( 4.0 ) ).mul( 0.7 ).add( mul( 0.3, kfbm( vec2( uv.x.mul( 2.0 ), uv.y.mul( 90.0 ) ).add( seed ) ) ) );
	const col = mix( p_soLight, p_soDark, ring.mul( 0.16 ).add( mul( 0.4, streak ) ) ).mul( add( 0.9, mul( 0.2, cloud ) ) ).mul( add( 0.94, mul( 0.12, fib ) ) );

	// age: a silver grey laid over the brown, deepest on the open faces, the rings left darker under it

	const grey = vec3( 0.30, 0.285, 0.26 ).mul( add( 0.85, mul( 0.25, cloud ) ) );
	col.assign( mix( col, grey.mul( sub( 1.0, mul( 0.35, ring ) ) ), p_soAge.mul( add( 0.6, mul( 0.4, kfbm( uv.mul( 2.0 ).add( seed ) ) ) ) ) ) );

	// the adze: shallow scallops across the grain, each stroke its own length, its edge wandering, the face between them
	// left flat in places where a stroke took off less

	const su = uv.x.div( p_soAdzeLen ).add( mul( 0.35, kn( vec2( uv.x.mul( 4.0 ), uv.y.mul( 9.0 ) ).add( seed ).add( 2.0 ) ) ) ).add( kh1( seed ).mul( 7.0 ) );
	const f = fract( su );
	const strokeAmt = add( 0.4, mul( 0.6, kh( vec2( floor( su ), seed.add( 3.0 ) ) ) ) );
	const scallop = f.mul( sub( 1.0, f ) ).mul( 4.0 );
	const adze = scallop.sub( 0.66 ).mul( p_soAdze ).mul( strokeAmt ).mul( kfade( p_soAdzeLen.mul( 0.4 ) ) );

	// the stroke's lip: a faint ridge where two scallops meet

	const lip = sub( 1.0, smoothstep( 0.0, 0.05, min( f, sub( 1.0, f ) ) ) ).mul( strokeAmt ).mul( kfade( 0.01 ) ).mul( step( 1e-6, p_soAdze ) );
	col.mulAssign( add( 1.0, mul( 0.015, lip ) ) );

	// checks: a few long dark splits along the grain

	const cy = uv.y.mul( 7.0 ).add( kfbm( vec2( uv.x.mul( 0.6 ), uv.y ).add( seed ).add( 9.0 ) ).mul( 1.4 ) );
	const crack = pow( sub( 1.0, abs( mul( 2.0, fract( cy ) ).sub( 1.0 ) ) ), 60.0 ).mul( step( 0.55, kh( vec2( floor( cy ), seed ) ) ) ).mul( smoothstep( 0.35, 0.6, kfbm( vec2( uv.x.mul( 2.2 ), floor( cy ) ).add( seed ) ) ) ).mul( p_soChecks ).mul( kfade( 0.004 ) );
	col.mulAssign( sub( 1.0, mul( 0.75, crack ) ) );

	// a sawn end: the rings round the pith, wandering a little, the splits opening out from the pith, the saw's kerf

	const endg = step( 0.5, vS0.z );

	If( endg.greaterThan( 0.5 ), () => {

		const r = length( vS1.xy );
		const ang = atan( vS1.y, vS1.x );
		const wob = mul( 0.004, kn( vec2( ang.mul( 3.0 ), r.mul( 20.0 ) ).add( seed ) ) );
		const er = fract( r.add( wob ).mul( p_soEndRings ) );
		const late = smoothstep( 0.55, 0.95, er ).mul( kfade( div( 0.6, p_soEndRings ) ) );
		const sap = mix( p_soLight.mul( 1.15 ), p_soDark, late.mul( 0.6 ) );

		// the splits: a few dark lines out from the pith, each its own angle, widening outward

		const split = float( 0.0 );

		Loop( 4, ( { i } ) => {

			const a = kh1( seed.add( float( i ).mul( 3.7 ) ) ).mul( 6.28318 );
			const d = abs( sin( ang.sub( a ) ) ).mul( r );
			split.assign( max( split, sub( 1.0, smoothstep( 0.0, add( 0.0015, r.mul( 0.012 ) ), d ) ).mul( step( 0.0, cos( ang.sub( a ) ) ) ).mul( smoothstep( 0.02, 0.06, r ) ) ) );

		} );

		const saw = kn( vec2( dot( vS1.xy, vec2( 0.8, 0.6 ) ).mul( 400.0 ), 0.0 ).add( seed ) ).mul( kfade( 0.003 ) );
		col.assign( mix( sap.mul( add( 0.9, mul( 0.15, saw ) ) ), grey.mul( 0.9 ), p_soAge.mul( 0.5 ) ).mul( sub( 1.0, mul( 0.7, split ).mul( p_soChecks ) ) ) );
		adze.assign( 0.0 );
		crack.assign( split );

	} );

	// soot: browning the wood toward a tarry black, deepest in the scallops' hollows

	const soot = clamp( vS0.x.mul( p_soSoot ), 0.0, 1.0 );

	// (the hollows only where the adze cut them: a timber with no adze has no rows of soot)

	const hollow = select( p_soAdze.greaterThan( 0.0 ), sub( 0.66, scallop ).mul( 0.3 ).mul( kfade( p_soAdzeLen.mul( 0.4 ) ) ), 0.0 );
	const s = smoothstep( 0.0, 1.0, soot.mul( 1.35 ).sub( mul( 0.3, kfbm( uv.mul( 3.0 ).add( seed ).add( 5.0 ) ) ) ).add( hollow ) );
	col.assign( mix( col, vec3( 0.03, 0.022, 0.016 ).mul( add( 0.8, mul( 0.4, cloud ) ) ), s.mul( 0.92 ) ) );

	// wear: hands polish it dark and smooth

	const wear = clamp( vS0.y, 0.0, 1.0 );
	col.assign( mix( col, col.mul( vec3( 0.7, 0.62, 0.55 ) ), wear.mul( 0.6 ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( mix( p_soRough, 0.6, s.mul( soot ) ), 0.45, wear ) );
	k.get( 'height' ).assign( adze.mul( sub( 1.0, wear.mul( 0.8 ) ) ).sub( mul( 0.0015, crack ) ).add( mul( 0.0003, fib.sub( 0.5 ) ) ).sub( mul( 0.0004, ring ) ) );

}, 'void' );

export const look_35 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_soLight.assign( lookSettings.sample( ivec2( 0, 35 ) ).setSampler( false ).rgb );
	p_soDark.assign( lookSettings.sample( ivec2( 1, 35 ) ).setSampler( false ).rgb );
	p_soAge.assign( lookSettings.sample( ivec2( 2, 35 ) ).setSampler( false ).r );
	p_soRings.assign( lookSettings.sample( ivec2( 3, 35 ) ).setSampler( false ).r );
	p_soEndRings.assign( lookSettings.sample( ivec2( 4, 35 ) ).setSampler( false ).r );
	p_soAdzeLen.assign( lookSettings.sample( ivec2( 5, 35 ) ).setSampler( false ).r );
	p_soAdze.assign( lookSettings.sample( ivec2( 6, 35 ) ).setSampler( false ).r );
	p_soChecks.assign( lookSettings.sample( ivec2( 7, 35 ) ).setSampler( false ).r );
	p_soSoot.assign( lookSettings.sample( ivec2( 8, 35 ) ).setSampler( false ).r );
	p_soRough.assign( lookSettings.sample( ivec2( 9, 35 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// grain: rings wandering across, fibres along

	const ring = kring( uv.mul( vec2( 1.0, p_soRings.div( 9.0 ) ) ), seed, 9.0 ).mul( add( 0.45, mul( 0.55, kfbm( uv.mul( vec2( 0.8, 6.0 ) ).add( seed ).add( 1.0 ) ) ) ) );
	const fib = kfibre( uv, seed );
	const cloud = kfbm( vec2( uv.x.mul( 1.3 ), uv.y.mul( 4.0 ) ).add( seed ).add( 3.0 ) );

	// the grain's long streaks: dark and light runs along u, wandering slowly, so it reads as wood and never as stripes

	const streak = kfbm( vec2( uv.x.mul( 0.7 ), uv.y.mul( 22.0 ) ).add( seed ).add( 4.0 ) ).mul( 0.7 ).add( mul( 0.3, kfbm( vec2( uv.x.mul( 2.0 ), uv.y.mul( 90.0 ) ).add( seed ) ) ) );
	const col = mix( p_soLight, p_soDark, ring.mul( 0.16 ).add( mul( 0.4, streak ) ) ).mul( add( 0.9, mul( 0.2, cloud ) ) ).mul( add( 0.94, mul( 0.12, fib ) ) );

	// age: a silver grey laid over the brown, deepest on the open faces, the rings left darker under it

	const grey = vec3( 0.30, 0.285, 0.26 ).mul( add( 0.85, mul( 0.25, cloud ) ) );
	col.assign( mix( col, grey.mul( sub( 1.0, mul( 0.35, ring ) ) ), p_soAge.mul( add( 0.6, mul( 0.4, kfbm( uv.mul( 2.0 ).add( seed ) ) ) ) ) ) );

	// the adze: shallow scallops across the grain, each stroke its own length, its edge wandering, the face between them
	// left flat in places where a stroke took off less

	const su = uv.x.div( p_soAdzeLen ).add( mul( 0.35, kn( vec2( uv.x.mul( 4.0 ), uv.y.mul( 9.0 ) ).add( seed ).add( 2.0 ) ) ) ).add( kh1( seed ).mul( 7.0 ) );
	const f = fract( su );
	const strokeAmt = add( 0.4, mul( 0.6, kh( vec2( floor( su ), seed.add( 3.0 ) ) ) ) );
	const scallop = f.mul( sub( 1.0, f ) ).mul( 4.0 );
	const adze = scallop.sub( 0.66 ).mul( p_soAdze ).mul( strokeAmt ).mul( kfade( p_soAdzeLen.mul( 0.4 ) ) );

	// the stroke's lip: a faint ridge where two scallops meet

	const lip = sub( 1.0, smoothstep( 0.0, 0.05, min( f, sub( 1.0, f ) ) ) ).mul( strokeAmt ).mul( kfade( 0.01 ) ).mul( step( 1e-6, p_soAdze ) );
	col.mulAssign( add( 1.0, mul( 0.015, lip ) ) );

	// checks: a few long dark splits along the grain

	const cy = uv.y.mul( 7.0 ).add( kfbm( vec2( uv.x.mul( 0.6 ), uv.y ).add( seed ).add( 9.0 ) ).mul( 1.4 ) );
	const crack = pow( sub( 1.0, abs( mul( 2.0, fract( cy ) ).sub( 1.0 ) ) ), 60.0 ).mul( step( 0.55, kh( vec2( floor( cy ), seed ) ) ) ).mul( smoothstep( 0.35, 0.6, kfbm( vec2( uv.x.mul( 2.2 ), floor( cy ) ).add( seed ) ) ) ).mul( p_soChecks ).mul( kfade( 0.004 ) );
	col.mulAssign( sub( 1.0, mul( 0.75, crack ) ) );

	// a sawn end: the rings round the pith, wandering a little, the splits opening out from the pith, the saw's kerf

	const endg = step( 0.5, vS0.z );

	If( endg.greaterThan( 0.5 ), () => {

		const r = length( vS1.xy );
		const ang = atan( vS1.y, vS1.x );
		const wob = mul( 0.004, kn( vec2( ang.mul( 3.0 ), r.mul( 20.0 ) ).add( seed ) ) );
		const er = fract( r.add( wob ).mul( p_soEndRings ) );
		const late = smoothstep( 0.55, 0.95, er ).mul( kfade( div( 0.6, p_soEndRings ) ) );
		const sap = mix( p_soLight.mul( 1.15 ), p_soDark, late.mul( 0.6 ) );

		// the splits: a few dark lines out from the pith, each its own angle, widening outward

		const split = float( 0.0 );

		Loop( 4, ( { i } ) => {

			const a = kh1( seed.add( float( i ).mul( 3.7 ) ) ).mul( 6.28318 );
			const d = abs( sin( ang.sub( a ) ) ).mul( r );
			split.assign( max( split, sub( 1.0, smoothstep( 0.0, add( 0.0015, r.mul( 0.012 ) ), d ) ).mul( step( 0.0, cos( ang.sub( a ) ) ) ).mul( smoothstep( 0.02, 0.06, r ) ) ) );

		} );

		const saw = kn( vec2( dot( vS1.xy, vec2( 0.8, 0.6 ) ).mul( 400.0 ), 0.0 ).add( seed ) ).mul( kfade( 0.003 ) );
		col.assign( mix( sap.mul( add( 0.9, mul( 0.15, saw ) ) ), grey.mul( 0.9 ), p_soAge.mul( 0.5 ) ).mul( sub( 1.0, mul( 0.7, split ).mul( p_soChecks ) ) ) );
		adze.assign( 0.0 );
		crack.assign( split );

	} );

	// soot: browning the wood toward a tarry black, deepest in the scallops' hollows

	const soot = clamp( vS0.x.mul( p_soSoot ), 0.0, 1.0 );

	// (the hollows only where the adze cut them: a timber with no adze has no rows of soot)

	const hollow = select( p_soAdze.greaterThan( 0.0 ), sub( 0.66, scallop ).mul( 0.3 ).mul( kfade( p_soAdzeLen.mul( 0.4 ) ) ), 0.0 );
	const s = smoothstep( 0.0, 1.0, soot.mul( 1.35 ).sub( mul( 0.3, kfbm( uv.mul( 3.0 ).add( seed ).add( 5.0 ) ) ) ).add( hollow ) );
	col.assign( mix( col, vec3( 0.03, 0.022, 0.016 ).mul( add( 0.8, mul( 0.4, cloud ) ) ), s.mul( 0.92 ) ) );

	// wear: hands polish it dark and smooth

	const wear = clamp( vS0.y, 0.0, 1.0 );
	col.assign( mix( col, col.mul( vec3( 0.7, 0.62, 0.55 ) ), wear.mul( 0.6 ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( mix( p_soRough, 0.6, s.mul( soot ) ), 0.45, wear ) );
	k.get( 'height' ).assign( adze.mul( sub( 1.0, wear.mul( 0.8 ) ) ).sub( mul( 0.0015, crack ) ).add( mul( 0.0003, fib.sub( 0.5 ) ) ).sub( mul( 0.0004, ring ) ) );

}, 'void' );

export const look_36 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_siScale.assign( lookSettings.sample( ivec2( 0, 36 ) ).setSampler( false ).rgb );
	p_siIron.assign( lookSettings.sample( ivec2( 1, 36 ) ).setSampler( false ).rgb );
	p_siSteel.assign( lookSettings.sample( ivec2( 2, 36 ) ).setSampler( false ).rgb );
	p_siPeen.assign( lookSettings.sample( ivec2( 3, 36 ) ).setSampler( false ).r );
	p_siPeenDepth.assign( lookSettings.sample( ivec2( 4, 36 ) ).setSampler( false ).r );
	p_siFlake.assign( lookSettings.sample( ivec2( 5, 36 ) ).setSampler( false ).r );
	p_siRust.assign( lookSettings.sample( ivec2( 6, 36 ) ).setSampler( false ).r );
	p_siRough.assign( lookSettings.sample( ivec2( 7, 36 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// the hammer: overlapping shallow dimples, each blow its own

	const dimple = kcell( uv.mul( p_siPeen ).add( seed ) );
	const peen = dimple.mul( dimple ).sub( 0.35 ).mul( p_siPeenDepth ).mul( kfade( div( 1.5, p_siPeen ) ) ).mul( add( 0.4, mul( 0.6, kfbm( uv.mul( 3.0 ).add( seed ) ) ) ) );

	// the scale: a skin that flakes in patches, the edge of each flake a hair proud

	const flakeN = kfbm( uv.mul( 14.0 ).add( seed ).add( 2.0 ) );
	const flaked = smoothstep( sub( 1.0, p_siFlake ), sub( 1.0, p_siFlake ).add( 0.06 ), flakeN );
	const lip = sub( 1.0, smoothstep( 0.0, 0.05, abs( flakeN.sub( sub( 1.0, p_siFlake ) ).sub( 0.03 ) ) ) ).mul( kfade( 0.004 ) );
	const mott = kfbm( uv.mul( 5.0 ).add( seed ).add( 7.0 ) );
	const col = mix( p_siScale.mul( add( 0.8, mul( 0.5, mott ) ) ), p_siIron.mul( add( 0.75, mul( 0.4, mott ) ) ), flaked );

	// rust blooms where the hammer left hollows and the scale is off

	const rust = smoothstep( 0.62, 0.8, kfbm( uv.mul( 4.0 ).add( seed ).add( 13.0 ) ) ).mul( smoothstep( 0.3, 0.7, kfbm( uv.mul( 30.0 ).add( seed ).add( 5.0 ) ) ) ).mul( p_siRust );
	col.assign( mix( col, vec3( 0.16, 0.06, 0.025 ).mul( add( 0.7, mul( 0.6, kn( uv.mul( 120.0 ).add( seed ) ) ) ) ), rust.mul( 0.85 ) ) );

	// polish: rubbed through to steel, fine scratches along u, the dimples' bottoms still dark

	const pol = clamp( vS0.x, 0.0, 1.0 );
	const scratch = kn( vec2( uv.x.mul( 6.0 ), uv.y.mul( 900.0 ) ).add( seed ) ).mul( kfade( 0.002 ) );
	const steel = p_siSteel.mul( add( 0.85, mul( 0.25, scratch ) ) );
	const bright = pol.mul( smoothstep( 0.05, 0.4, dimple.mul( sub( 1.0, pol.mul( 0.6 ) ) ).add( pol.mul( 0.6 ) ) ) );
	col.assign( mix( col, steel, bright ) );

	// heat: the temper colours over the steel or the scale

	const heat = clamp( vS0.y, 0.0, 1.0 );
	col.mulAssign( siTemper( heat.mul( add( 0.85, mul( 0.3, kfbm( uv.mul( 6.0 ).add( seed ).add( 4.0 ) ) ) ) ) ) );
	k.get( 'colour' ).assign( col );

	// the scale is an oxide, not a metal: it shows its own dark grey; the iron under it and the steel rubbed bright are

	k.get( 'metal' ).assign( mix( mix( 0.3, 0.8, flaked ), 1.0, bright ).mul( sub( 1.0, rust.mul( 0.9 ) ) ) );
	k.get( 'rough' ).assign( mix( mix( p_siRough, 0.95, rust ), add( 0.36, mul( 0.14, scratch ) ), bright ) );
	k.get( 'height' ).assign( peen.mul( sub( 1.0, mul( 0.7, pol ) ) ).add( mul( 0.00015, lip ) ).add( mul( 0.0002, rust ).mul( kn( uv.mul( 300.0 ).add( seed ) ) ) ) );

}, 'void' );

export const look_37 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_slHide.assign( lookSettings.sample( ivec2( 0, 37 ) ).setSampler( false ).rgb );
	p_slRub.assign( lookSettings.sample( ivec2( 1, 37 ) ).setSampler( false ).rgb );
	p_slCreases.assign( lookSettings.sample( ivec2( 2, 37 ) ).setSampler( false ).r );
	p_slCreaseDepth.assign( lookSettings.sample( ivec2( 3, 37 ) ).setSampler( false ).r );
	p_slPebble.assign( lookSettings.sample( ivec2( 4, 37 ) ).setSampler( false ).r );
	p_slOil.assign( lookSettings.sample( ivec2( 5, 37 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );

	// the creases: long wandering folds across v, deepest on the kind's fold lines

	const w = kfbm( vec2( uv.x.mul( 1.2 ), uv.y.mul( 0.8 ) ).add( seed ) ).mul( 3.0 );
	const cy = uv.y.mul( p_slCreases ).mul( add( 0.8, mul( 0.4, kfbm( uv.mul( 1.5 ).add( seed ).add( 9.0 ) ) ) ) ).add( w );

	// each fold its own strength, some barely there

	const cr = pow( sub( 1.0, abs( mul( 2.0, fract( cy ) ).sub( 1.0 ) ) ), 2.5 ).mul( add( 0.3, mul( 0.7, kh( vec2( floor( cy ), seed ) ) ) ) );
	const fold = clamp( vS0.x, 0.0, 1.0 );
	const crease = cr.mul( add( 0.35, mul( 0.65, fold ) ) ).mul( kfade( div( 1.0, p_slCreases ) ) );

	// the grain pebbled, a hair's relief

	const peb = kcell( uv.mul( p_slPebble ).add( seed ) ).mul( kfade( div( 2.0, p_slPebble ) ) );
	const mott = kfbm( uv.mul( 4.0 ).add( seed ).add( 2.0 ) );
	const col = p_slHide.mul( add( 0.75, mul( 0.5, mott ) ) );

	// rubbed pale on the creases' ridges, cracked fine in them

	const rub = smoothstep( 0.6, 1.0, cr ).mul( add( 0.3, mul( 0.7, fold ) ) ).mul( kfade( 0.01 ) ).mul( smoothstep( 0.35, 0.65, kfbm( uv.mul( 6.0 ).add( seed ).add( 3.0 ) ) ) );
	col.assign( mix( col, p_slRub.mul( add( 0.8, mul( 0.3, mott ) ) ), rub.mul( 0.45 ) ) );

	// the folds' hollows a shade darker, so the hide reads as bent, not lined

	col.mulAssign( sub( 1.0, mul( 0.25, sub( 1.0, cr ) ).mul( add( 0.4, mul( 0.6, fold ) ) ) ) );
	const crack = smoothstep( 0.82, 0.95, kn( vec2( uv.x.mul( 260.0 ), uv.y.mul( 40.0 ) ).add( seed ) ) ).mul( rub ).mul( kfade( 0.003 ) );
	col.mulAssign( sub( 1.0, mul( 0.5, crack ) ) );

	// soot settled on it

	col.assign( mix( col, vec3( 0.02, 0.017, 0.015 ), clamp( vS0.y, 0.0, 1.0 ).mul( add( 0.5, mul( 0.5, kfbm( uv.mul( 3.0 ).add( seed ).add( 8.0 ) ) ) ) ).mul( 0.85 ) ) );
	k.get( 'colour' ).assign( col );
	k.get( 'rough' ).assign( mix( 0.75, 0.38, p_slOil.mul( add( 0.6, mul( 0.4, mott ) ) ) ).add( mul( 0.2, rub ) ) );
	k.get( 'clearcoat' ).assign( p_slOil.mul( 0.35 ).mul( sub( 1.0, rub ) ) );
	k.get( 'clearcoatRough' ).assign( 0.45 );
	k.get( 'height' ).assign( crease.negate().mul( p_slCreaseDepth ).add( mul( 0.00012, peb.sub( 0.5 ) ) ).sub( mul( 0.0002, crack ) ) );

}, 'void' );

export const look_38 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_qwDeep.assign( lookSettings.sample( ivec2( 0, 38 ) ).setSampler( false ).rgb );
	p_qwScum.assign( lookSettings.sample( ivec2( 1, 38 ) ).setSampler( false ).rgb );
	p_qwScumCover.assign( lookSettings.sample( ivec2( 2, 38 ) ).setSampler( false ).r );
	p_qwRipple.assign( lookSettings.sample( ivec2( 3, 38 ) ).setSampler( false ).r );
	p_qwStir.assign( lookSettings.sample( ivec2( 4, 38 ) ).setSampler( false ).r );
	p_qwDrift.assign( lookSettings.sample( ivec2( 5, 38 ) ).setSampler( false ).r );
	p_qwCycle.assign( lookSettings.sample( ivec2( 6, 38 ) ).setSampler( false ).r );
	p_qwSheen.assign( lookSettings.sample( ivec2( 7, 38 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const ph = kloop( p_qwCycle );
	const scum = mix( qwScumAt( uv, ph.y, seed ), qwScumAt( uv, ph.x, seed ), ph.z );

	// the wavelets: two sizes churning in place, stilled under the scum

	const ripple = kfbm3( vec3( uv.mul( 18.0 ).add( seed ), kcycle( p_qwStir ).mul( 4.0 ) ), 4.0 ).mul( 0.7 ).add( kn3( vec3( uv.mul( 55.0 ).add( seed ).add( 9.0 ), kcycle( p_qwStir.mul( 0.6 ) ).mul( 3.0 ) ), 3.0 ).mul( 0.3 ) );
	k.get( 'height' ).assign( p_qwRipple.mul( ripple ).mul( sub( 1.0, mul( 0.8, scum ) ) ) );
	k.get( 'colour' ).assign( mix( p_qwDeep, p_qwScum.mul( add( 0.75, mul( 0.5, kfbm( uv.mul( 30.0 ).add( seed ).add( 4.0 ) ) ) ) ), scum ) );
	k.get( 'rough' ).assign( mix( 0.03, 0.8, scum ) );

	// a clear coat for the water's mirror, gone where the scum lies on it

	k.get( 'clearcoat' ).assign( sub( 1.0, scum ) );
	k.get( 'clearcoatRough' ).assign( 0.02 );

	// the oil's thin film between the rafts

	k.get( 'iridescence' ).assign( p_qwSheen.mul( sub( 1.0, scum ) ).mul( smoothstep( 0.4, 0.8, kfbm( uv.mul( 4.0 ).add( seed ).add( 11.0 ) ) ) ) );
	k.get( 'iridIor' ).assign( 1.45 );
	k.get( 'iridThick' ).assign( add( 380.0, mul( 240.0, kfbm( uv.mul( 9.0 ).add( seed ).add( 2.0 ) ) ) ) );

}, 'void' );

export const look_39 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const seasoned = kfbm( uv.mul( 4.0 ).add( seed ) );
	const grain = kn( uv.mul( 300.0 ).add( seed ) ).mul( kfade( 0.003 ) );
	k.get( 'colour' ).assign( vec3( 0.025, 0.024, 0.023 ).mul( add( 1.0, seasoned ).add( mul( 0.5, grain ) ) ) );
	k.get( 'metal' ).assign( 0.3 );
	k.get( 'rough' ).assign( add( 0.45, mul( 0.2, seasoned ) ) );
	k.get( 'height' ).assign( mul( 0.0002, grain ) );

}, 'void' );

export const look_40 = /*@__PURE__*/ Fn( ( [ k ] ) => {

	p_opColour.assign( lookSettings.sample( ivec2( 0, 40 ) ).setSampler( false ).rgb );
	p_opRim.assign( lookSettings.sample( ivec2( 1, 40 ) ).setSampler( false ).rgb );
	p_opThrough.assign( lookSettings.sample( ivec2( 2, 40 ) ).setSampler( false ).r );
	p_opRough.assign( lookSettings.sample( ivec2( 3, 40 ) ).setSampler( false ).r );
	p_opGrain.assign( lookSettings.sample( ivec2( 4, 40 ) ).setSampler( false ).r );
	p_opGlow.assign( lookSettings.sample( ivec2( 5, 40 ) ).setSampler( false ).r );
	const uv = vLookUv.toVar();
	const seed = vLookInfo.y.mul( 7.13 ).add( vLookInfo.z.mul( 1.71 ) );
	const wp = vLookWorld.toVar();
	const wn = normalize( vLookWN );
	const opV = normalize( cameraPosition.sub( wp ) );
	const opFace = clamp( abs( dot( opV, normalize( wn ) ) ), 0.0, 1.0 );
	const opG = mix( 0.5, kn( uv.mul( 1500.0 ).add( seed ) ), kfade( 0.0015 ) );
	const opC = mix( p_opRim, p_opColour, smoothstep( 0.0, 0.8, opFace ) ).mul( add( 1.0, p_opGrain.mul( opG.sub( 0.5 ) ).mul( 2.0 ) ) );
	k.get( 'colour' ).assign( opC );
	k.get( 'rough' ).assign( p_opRough );
	k.get( 'metal' ).assign( 0.0 );
	k.get( 'glow' ).assign( p_opThrough.add( p_opGlow ).mul( opC ).mul( add( 0.6, mul( 0.4, opFace ) ) ) );

}, 'void' );

export const lookRun = /*@__PURE__*/ Fn( ( [ id ] ) => {

	const k = lookStart().toVar();

	If( id.equal( 0 ), () => {

			look_0( k );

		}  );
	If( id.equal( 1 ), () => {

			look_1( k );

		}  );
	If( id.equal( 2 ), () => {

			look_2( k );

		}  );
	If( id.equal( 3 ), () => {

			look_3( k );

		}  );
	If( id.equal( 4 ), () => {

			look_4( k );

		}  );
	If( id.equal( 5 ), () => {

			look_5( k );

		}  );
	If( id.equal( 6 ), () => {

			look_6( k );

		}  );
	If( id.equal( 7 ), () => {

			look_7( k );

		}  );
	If( id.equal( 8 ), () => {

			look_8( k );

		}  );
	If( id.equal( 9 ), () => {

			look_9( k );

		}  );
	If( id.equal( 10 ), () => {

			look_10( k );

		}  );
	If( id.equal( 11 ), () => {

			look_11( k );

		}  );
	If( id.equal( 12 ), () => {

			look_12( k );

		}  );
	If( id.equal( 13 ), () => {

			look_13( k );

		}  );
	If( id.equal( 14 ), () => {

			look_14( k );

		}  );
	If( id.equal( 15 ), () => {

			look_15( k );

		}  );
	If( id.equal( 16 ), () => {

			look_16( k );

		}  );
	If( id.equal( 17 ), () => {

			look_17( k );

		}  );
	If( id.equal( 18 ), () => {

			look_18( k );

		}  );
	If( id.equal( 19 ), () => {

			look_19( k );

		}  );
	If( id.equal( 20 ), () => {

			look_20( k );

		}  );
	If( id.equal( 21 ), () => {

			look_21( k );

		}  );
	If( id.equal( 22 ), () => {

			look_22( k );

		}  );
	If( id.equal( 23 ), () => {

			look_23( k );

		}  );
	If( id.equal( 24 ), () => {

			look_24( k );

		}  );
	If( id.equal( 25 ), () => {

			look_25( k );

		}  );
	If( id.equal( 26 ), () => {

			look_26( k );

		}  );
	If( id.equal( 27 ), () => {

			look_27( k );

		}  );
	If( id.equal( 28 ), () => {

			look_28( k );

		}  );
	If( id.equal( 29 ), () => {

			look_29( k );

		}  );
	If( id.equal( 30 ), () => {

			look_30( k );

		}  );
	If( id.equal( 31 ), () => {

			look_31( k );

		}  );
	If( id.equal( 32 ), () => {

			look_32( k );

		}  );
	If( id.equal( 33 ), () => {

			look_33( k );

		}  );
	If( id.equal( 34 ), () => {

			look_34( k );

		}  );
	If( id.equal( 35 ), () => {

			look_35( k );

		}  );
	If( id.equal( 36 ), () => {

			look_36( k );

		}  );
	If( id.equal( 37 ), () => {

			look_37( k );

		}  );
	If( id.equal( 38 ), () => {

			look_38( k );

		}  );
	If( id.equal( 39 ), () => {

			look_39( k );

		}  );
	If( id.equal( 40 ), () => {

			look_40( k );

		} );

	If( lookDebug.greaterThan( 0.5 ), () => {

		If( id.equal( 0 ), () => {

				k.get( 'colour' ).assign( vec3( 0.26225065752969623, 0.26225065752969623, 0.26225065752969623 ) );

			}  );
	If( id.equal( 1 ), () => {

				k.get( 'colour' ).assign( vec3( 0.019382360956935723, 0.7912979403326302, 0.04091519690685319 ) );

			}  );
	If( id.equal( 2 ), () => {

				k.get( 'colour' ).assign( vec3( 0.7912979403326302, 0.019382360956935723, 0.6239603916750761 ) );

			}  );
	If( id.equal( 3 ), () => {

				k.get( 'colour' ).assign( vec3( 0.14995978981060856, 0.7912979403326302, 0.019382360956935723 ) );

			}  );
	If( id.equal( 4 ), () => {

				k.get( 'colour' ).assign( vec3( 0.5840784178911641, 0.019382360956935723, 0.7912979403326302 ) );

			}  );
	If( id.equal( 5 ), () => {

				k.get( 'colour' ).assign( vec3( 0.042311410620809675, 0.05780543019106723, 0.08437621154414882 ) );

			}  );
	If( id.equal( 6 ), () => {

				k.get( 'colour' ).assign( vec3( 0.5840784178911641, 0.32314320911295075, 0.1119324278369056 ) );

			}  );
	If( id.equal( 7 ), () => {

				k.get( 'colour' ).assign( vec3( 0.25415209433082675, 0.10224173308810132, 0.024157632448504756 ) );

			}  );
	If( id.equal( 8 ), () => {

				k.get( 'colour' ).assign( vec3( 0.26225065752969623, 0.26225065752969623, 0.26225065752969623 ) );

			}  );
	If( id.equal( 9 ), () => {

				k.get( 'colour' ).assign( vec3( 0.25415209433082675, 0.10224173308810132, 0.024157632448504756 ) );

			}  );
	If( id.equal( 10 ), () => {

				k.get( 'colour' ).assign( vec3( 0.013702083047289686, 0.11443537382697373, 1.0 ) );

			}  );
	If( id.equal( 11 ), () => {

				k.get( 'colour' ).assign( vec3( 1.0, 0.25415209433082675, 0.0 ) );

			}  );
	If( id.equal( 12 ), () => {

				k.get( 'colour' ).assign( vec3( 0.7454042095403874, 0.010960094006488246, 0.010960094006488246 ) );

			}  );
	If( id.equal( 13 ), () => {

				k.get( 'colour' ).assign( vec3( 0.8631572134541023, 0.7912979403326302, 0.6239603916750761 ) );

			}  );
	If( id.equal( 14 ), () => {

				k.get( 'colour' ).assign( vec3( 0.8879231178819663, 0.6514056374198242, 0.04518620438567554 ) );

			}  );
	If( id.equal( 15 ), () => {

				k.get( 'colour' ).assign( vec3( 0.12213877222960187, 0.7454042095403874, 1.0 ) );

			}  );
	If( id.equal( 16 ), () => {

				k.get( 'colour' ).assign( vec3( 0.042311410620809675, 0.05780543019106723, 0.08437621154414882 ) );

			}  );
	If( id.equal( 17 ), () => {

				k.get( 'colour' ).assign( vec3( 0.5840784178911641, 0.32314320911295075, 0.1119324278369056 ) );

			}  );
	If( id.equal( 18 ), () => {

				k.get( 'colour' ).assign( vec3( 0.39157247774972326, 0.14126329114027164, 0.028426039504420793 ) );

			}  );
	If( id.equal( 19 ), () => {

				k.get( 'colour' ).assign( vec3( 0.32314320911295075, 0.27467731206038465, 0.20155625379439707 ) );

			}  );
	If( id.equal( 20 ), () => {

				k.get( 'colour' ).assign( vec3( 0.3049873140698863, 0.7912979403326302, 0.019382360956935723 ) );

			}  );
	If( id.equal( 21 ), () => {

				k.get( 'colour' ).assign( vec3( 0.10702310297826761, 0.04518620438567554, 0.011612245179743885 ) );

			}  );
	If( id.equal( 22 ), () => {

				k.get( 'colour' ).assign( vec3( 0.10224173308810132, 0.08437621154414882, 0.06480326669290577 ) );

			}  );
	If( id.equal( 23 ), () => {

				k.get( 'colour' ).assign( vec3( 0.042311410620809675, 0.02315336617811041, 0.014443843596092545 ) );

			}  );
	If( id.equal( 24 ), () => {

				k.get( 'colour' ).assign( vec3( 0.6866853124353135, 0.5840784178911641, 0.35153259950043936 ) );

			}  );
	If( id.equal( 25 ), () => {

				k.get( 'colour' ).assign( vec3( 0.7912979403326302, 0.019382360956935723, 0.25015828472995344 ) );

			}  );
	If( id.equal( 26 ), () => {

				k.get( 'colour' ).assign( vec3( 0.7912979403326302, 0.019382360956935723, 0.6239603916750761 ) );

			}  );
	If( id.equal( 27 ), () => {

				k.get( 'colour' ).assign( vec3( 1.0, 0.14412847085805777, 0.010329823029626936 ) );

			}  );
	If( id.equal( 28 ), () => {

				k.get( 'colour' ).assign( vec3( 0.25415209433082675, 0.21586050011389926, 0.18782077230067787 ) );

			}  );
	If( id.equal( 29 ), () => {

				k.get( 'colour' ).assign( vec3( 0.1946178304415758, 0.14412847085805777, 0.09758734714186246 ) );

			}  );
	If( id.equal( 30 ), () => {

				k.get( 'colour' ).assign( vec3( 0.25415209433082675, 0.1946178304415758, 0.13286832155381798 ) );

			}  );
	If( id.equal( 31 ), () => {

				k.get( 'colour' ).assign( vec3( 0.1559264637078274, 0.12213877222960187, 0.08437621154414882 ) );

			}  );
	If( id.equal( 32 ), () => {

				k.get( 'colour' ).assign( vec3( 0.45078578283822346, 0.32314320911295075, 0.14412847085805777 ) );

			}  );
	If( id.equal( 33 ), () => {

				k.get( 'colour' ).assign( vec3( 0.14702726649759498, 0.08437621154414882, 0.03954623527673284 ) );

			}  );
	If( id.equal( 34 ), () => {

				k.get( 'colour' ).assign( vec3( 0.1946178304415758, 0.13286832155381798, 0.08021982031446832 ) );

			}  );
	If( id.equal( 35 ), () => {

				k.get( 'colour' ).assign( vec3( 0.32314320911295075, 0.20155625379439707, 0.09084171118340768 ) );

			}  );
	If( id.equal( 36 ), () => {

				k.get( 'colour' ).assign( vec3( 0.024157632448504756, 0.028426039504420793, 0.03954623527673284 ) );

			}  );
	If( id.equal( 37 ), () => {

				k.get( 'colour' ).assign( vec3( 0.10224173308810132, 0.027320891639074894, 0.006995410187265387 ) );

			}  );
	If( id.equal( 38 ), () => {

				k.get( 'colour' ).assign( vec3( 0.010329823029626936, 0.014443843596092545, 0.011612245179743885 ) );

			}  );
	If( id.equal( 39 ), () => {

				k.get( 'colour' ).assign( vec3( 0.019382360956935723, 0.26225065752969623, 0.7912979403326302 ) );

			}  );
	If( id.equal( 40 ), () => {

				k.get( 'colour' ).assign( vec3( 1.0, 0.9130986517934192, 0.7156935005064807 ) );

			} );

	} );

	return k;

}, 'Look' );

export const lookShadow_0 = /*@__PURE__*/ Fn( ( [ Lview ] ) => {

	If( p_shadowOn.lessThan( 0.5 ).or( csFade.lessThanEqual( 0.0 ) ), () => {

		return 1.0;

	} );

	const L = vec3( dot( Lview, csT ), dot( Lview, csB ), dot( Lview, csNg ) );

	If( L.z.lessThanEqual( 0.0 ), () => {

		return 1.0;

	} );

	const span = csZ.negate().add( 0.002 );
	const duv = L.xy.div( max( L.z, 0.06 ) ).mul( span ).div( 6.0 );
	const dz = span.div( 6.0 );
	const u = csUvP;
	const z = csZ.add( 0.0015 );
	const s = float( 1.0 );

	Loop( 6, () => {

		u.addAssign( duv );
		z.addAssign( dz );
		s.assign( min( s, clamp( sub( 1.0, csSample( u ).get( 'h' ).sub( z ).mul( 250.0 ) ), 0.0, 1.0 ) ) );

	} );

	return mix( 1.0, s, csFade );

}, 'float' );

export const lookShadow_5 = /*@__PURE__*/ Fn( ( [ Lview ] ) => {

	If( p_shadowOn.lessThan( 0.5 ).or( csFade.lessThanEqual( 0.0 ) ), () => {

		return 1.0;

	} );

	const L = vec3( dot( Lview, csT ), dot( Lview, csB ), dot( Lview, csNg ) );

	If( L.z.lessThanEqual( 0.0 ), () => {

		return 1.0;

	} );

	const span = csZ.negate().add( 0.002 );
	const duv = L.xy.div( max( L.z, 0.06 ) ).mul( span ).div( 6.0 );
	const dz = span.div( 6.0 );
	const u = csUvP;
	const z = csZ.add( 0.0015 );
	const s = float( 1.0 );

	Loop( 6, () => {

		u.addAssign( duv );
		z.addAssign( dz );
		s.assign( min( s, clamp( sub( 1.0, csSample( u ).get( 'h' ).sub( z ).mul( 250.0 ) ), 0.0, 1.0 ) ) );

	} );

	return mix( 1.0, s, csFade );

}, 'float' );

export const lookShadow_6 = /*@__PURE__*/ Fn( ( [ Lview ] ) => {

	If( p_shadowOn.lessThan( 0.5 ).or( csFade.lessThanEqual( 0.0 ) ), () => {

		return 1.0;

	} );

	const L = vec3( dot( Lview, csT ), dot( Lview, csB ), dot( Lview, csNg ) );

	If( L.z.lessThanEqual( 0.0 ), () => {

		return 1.0;

	} );

	const span = csZ.negate().add( 0.002 );
	const duv = L.xy.div( max( L.z, 0.06 ) ).mul( span ).div( 6.0 );
	const dz = span.div( 6.0 );
	const u = csUvP;
	const z = csZ.add( 0.0015 );
	const s = float( 1.0 );

	Loop( 6, () => {

		u.addAssign( duv );
		z.addAssign( dz );
		s.assign( min( s, clamp( sub( 1.0, cwSample( u ).get( 'h' ).sub( z ).mul( 250.0 ) ), 0.0, 1.0 ) ) );

	} );

	return mix( 1.0, s, csFade );

}, 'float' );

export const lookShadow = /*@__PURE__*/ Fn( ( [ id, Lview ] ) => {

	If( id.equal( 0 ), () => {

			return lookShadow_0( Lview );

		}  );
	If( id.equal( 5 ), () => {

			return lookShadow_5( Lview );

		}  );
	If( id.equal( 6 ), () => {

			return lookShadow_6( Lview );

		} );

	return 1.0;

}, 'float' );

export { lookGx, lookGy };
