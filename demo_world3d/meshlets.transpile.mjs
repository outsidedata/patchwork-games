// Experiment: a place's looks GLSL (its looks file's `all` call, every material behind one switch) made into a
// TSL module three's node materials draw with, by three's own transpiler (GLSL decoder, TSL encoder).
//   node games/demo_world3d/meshlets.transpile.mjs [place]   (town, village, tavern or hills; town when left out)
// writes meshlets-transpiled/<place>.looks.tsl.js beside this file. Before the transpiler: braces round a `for`
// whose body is another `for`, and no precision qualifier or `flat`, which its decoder does not read. After it:
//  - every function with an `out` or `inout` parameter is inlined (its Fn has no layout) and writes that parameter
//    straight into what it is handed, as GLSL does, where the encoder would copy it and lose the write;
//  - every uniform, varying and texture is read off `globalThis.lookBindings`, which the page fills first;
//  - `csHave`, a global the encoder makes a JS constant, is gone: the courses cell is worked out every time;
//  - lookRun's Look is a variable, so the looks write into it;
//  - lookGx and lookGy, the uv's change across the pixel, are exported, for the page to set before lookRun.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import Transpiler from 'three/addons/transpiler/Transpiler.js'
import GLSLDecoder from 'three/addons/transpiler/GLSLDecoder.js'
import TSLEncoder from 'three/addons/transpiler/TSLEncoder.js'

const here = new URL('.', import.meta.url).pathname
const place = process.argv[2] ?? 'town'
const files = {
  town: 'assets/smallville.town.looks.json',
  village: 'assets/village/village.art.looks.json',
  tavern: 'assets/tavern/tavern.art.looks.json',
  hills: 'assets/hills/village-terrain3d.art.looks.json',
}
const looks = JSON.parse(readFileSync(here + files[place], 'utf8'))
const out = here + 'meshlets-transpiled/'
mkdirSync(out, { recursive: true })

// a function inlined: its layout (`}, { a: 'vec2', return: 'float' } );`, from `close`, the `}` ending its body)
// made its return type alone (`}, 'float' );`), so it is expanded where it is called and a void one still goes on
// the stack as a statement (TSL's FnNode.call puts a call on the stack only when its type is void)
function inlined(tsl, close) {
  const tail = tsl.indexOf(');', close)
  const type = /return: '(\w+)'/.exec(tsl.slice(close, tail))?.[1] ?? 'void'
  return tsl.slice(0, close + 1) + `, '${type}' );` + tsl.slice(tail + 2)
}

// the body of the block opening at `open` (a `{`), to its matching `}`
function closing(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return i
  }
  throw new Error(`no } for the { at ${open}`)
}

// braces round a `for` whose body is another `for`
function braced(glsl) {
  for (;;) {
    const m = /for\s*\([^()]*\)\s*(for\s*\()/.exec(glsl)
    if (!m) return glsl
    const inner = m.index + m[0].length - m[1].length
    const close = closing(glsl, glsl.indexOf('{', glsl.indexOf(')', inner)))
    glsl = glsl.slice(0, inner) + '{ ' + glsl.slice(inner, close + 1) + ' }' + glsl.slice(close + 1)
  }
}

const glsl = braced(looks.calls.all.fragmentPars)
  .replace(/\b(highp|mediump|lowp)\s+/g, '')
  .replace(/\bflat\s+varying\b/g, 'varying')
writeFileSync(`${out}${place}.looks.glsl`, glsl)

// each function with an `out` or `inout` parameter, by name: those parameters' names
const writes = new Map()
for (const m of glsl.matchAll(/^[ \t]*\w+[ \t]+(\w+)[ \t]*\(([^)]*)\)[ \t]*\{/gm)) {
  const named = m[2].split(',').map(p => p.trim()).filter(p => /^(out|inout)\s/.test(p)).map(p => p.split(/\s+/).pop())
  if (named.length) writes.set(m[1], named)
}

let tsl = new Transpiler(new GLSLDecoder(), new TSLEncoder()).parse(glsl)

// the out and inout functions inlined, their parameters written straight into what they are handed
for (const [name, params] of writes) {
  const start = tsl.indexOf(`export const ${name} = /*@__PURE__*/ Fn(`)
  if (start < 0) throw new Error(`the TSL has no function ${name}`)
  const open = tsl.indexOf('{', tsl.indexOf('=>', start))
  const close = closing(tsl, open)
  let body = tsl.slice(open, close + 1)
  for (const p of params) body = body.replace(new RegExp(`const ${p} = ${p}_immutable\\.toVar\\(\\);`), `const ${p} = ${p}_immutable;`)
  tsl = tsl.slice(0, open) + body + tsl.slice(close + 1)
  tsl = inlined(tsl, open + body.length - 1)
}

// with `inline` after the place, every function inlined: the meshlet pipeline's draw material leaves out the uniforms
// and varyings a layout function (one compiled to a WGSL function of its own) reads
if (process.argv[3] === 'inline') {
  let at = 0
  for (;;) {
    const start = tsl.indexOf('/*@__PURE__*/ Fn(', at)
    if (start < 0) break
    const open = tsl.indexOf('{', tsl.indexOf('=>', start))
    const close = closing(tsl, open)
    tsl = inlined(tsl, close)
    at = close
  }
}

// a local the GLSL copies an input into (`vec2 uv = vLookUv;`), which the encoder writes as the input itself and
// a write to the local then writes the input: made a variable of its own
const inputs = 'vLookId|vLookInfo|vLookUv|vLookWorld|vLookWN|vS0|vS1|vS2|vS3|vNormal|vViewPosition'
tsl = tsl.replace(new RegExp(`((?:const|,) \\w+ = )(${inputs})(?=[,;])`, 'g'), '$1$2.toVar()')

// a Switch (no Default in these looks) made one If a case, side by side: TSL builds a Switch as an if / else-if
// chain, each case one level deeper, and 41 looks' cases pass WGSL's nesting limit of 127
for (;;) {
  const m = /Switch\( (\w+) \)\s*\.Case\( /.exec(tsl)
  if (!m) break
  const id = m[1]
  // each case's text starts with its value and a comma: the value closed into `id.equal( value )`
  const cased = text => text.replace(/^(\s*-?\d+)\s*,/, '$1 ),')
  let out = `If( ${id}.equal( `
  let i = m.index + m[0].length, depth = 1
  // walk the chain: at depth 0 a `.Case( ` starts the next case
  let j = i
  for (; j < tsl.length; j++) {
    const ch = tsl[j]
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') depth--
    if (depth === 0 && tsl.startsWith(').Case( ', j)) {
      out += cased(tsl.slice(i, j)) + ` );\n\tIf( ${id}.equal( `
      i = j + ').Case( '.length
      depth = 1
      j = i - 1
    } else if (depth === 0 && tsl.startsWith(').Default(', j)) throw new Error('a Switch with a Default')
    else if (depth === 0) break
  }
  tsl = tsl.slice(0, m.index) + out + cased(tsl.slice(i))
}

// a bool local the encoder declared as a bare JS true or false, made a variable
tsl = tsl.replace(/((?:const|,) \w+ = )(true|false)(?=[,;])/g, '$1bool( $2 ).toVar()')

// GLSL's `%`, which the encoder writes as `.remainder(`, is TSL's mod
tsl = tsl.replace(/\.remainder\(/g, '.mod(')

// a GLSL number the encoder wrote as a JS number with a method on it (`0.002.mul( x )`, `- 0.002.mul( x )`) made a node
tsl = tsl.replace(/([(,=]\s*)- (\d+\.\d*(?:e-?\d+)?)\.(\w+)\(/g, '$1float( -$2 ).$3(')
tsl = tsl.replace(/([(,=\s])(\d+\.\d*(?:e-?\d+)?)\.(\w+)\(/g, '$1float( $2 ).$3(')

// every uniform, varying and texture off the page's bindings
const bound = []
tsl = tsl.replace(/^const (\w+) = (uniform|varying|texture)\(.*\);$/gm, (_, name) => { bound.push(name); return `const ${name} = B.${name};` })
// and three's own GLSL inputs the looks read without declaring them
tsl = tsl.replace(/(import \{[^}]*\} from 'three\/tsl';)/, `$1\n\nconst B = globalThis.lookBindings;\nconst vViewPosition = B.vViewPosition;\nconst vNormal = B.vNormal;`)
bound.push('vViewPosition', 'vNormal')

// every struct's fields read through .get( 'field' ), the one way r187's TSL reads a struct member (a field read
// as a property of the node is undefined); a name followed by `(` is a method, not a field
const fields = new Set()
for (const m of tsl.matchAll(/= struct\( \{([^}]*)\}/g)) for (const f of m[1].matchAll(/(\w+):/g)) fields.add(f[1])
const SWIZZLE = /^[xyzwrgbastpq]{1,4}$/
const named = [...fields].filter(f => !SWIZZLE.test(f))
if (named.length) tsl = tsl.replace(new RegExp(`\\.(${named.join('|')})\\b(?!\\s*\\()`, 'g'), ".get( '$1' )")
// a struct's own definition is `name: 'type'`, which the replace never touches (no dot before it)
console.log(`struct fields read through get: ${named.join(' ')}`)

// a field whose name is also a swizzle (`p`, `t`, `r`, `h`, `d`), read through get only where the GLSL says the
// value is that struct: a variable or parameter declared of it, or a call of a function that returns it
const structs = new Map()
for (const m of glsl.matchAll(/struct (\w+) \{([^}]*)\}/g)) structs.set(m[1], [...m[2].matchAll(/\w+\s+(\w+)\s*(?=[;,])/g)].map(f => f[1]))
const typeNames = [...structs.keys()].join('|')
const swizzled = new Map() // variable or function name → its struct's swizzle-named fields
const add = (name, type) => {
  const f = structs.get(type).filter(n => SWIZZLE.test(n))
  if (f.length) swizzled.set(name, [...new Set([...(swizzled.get(name) ?? []), ...f])])
}
for (const m of glsl.matchAll(new RegExp(`\\b(${typeNames})\\s+(\\w+)\\s*(?=[;=,)])`, 'g'))) add(m[2], m[1])
const returning = new Map()
for (const m of glsl.matchAll(new RegExp(`^(${typeNames})\\s+(\\w+)\\s*\\(`, 'gm'))) returning.set(m[2], m[1])
for (const [name, fieldsOf] of swizzled) {
  tsl = tsl.replace(new RegExp(`\\b${name}\\.(${fieldsOf.join('|')})\\b(?!\\s*\\()`, 'g'), `${name}.get( '$1' )`)
}
for (const [fn, type] of returning) {
  const f = structs.get(type).filter(n => SWIZZLE.test(n))
  if (!f.length) continue
  let at = 0
  for (;;) {
    const call = tsl.indexOf(`${fn}(`, at)
    if (call < 0) break
    at = call + fn.length
    if (/\w/.test(tsl[call - 1] ?? '')) continue
    let depth = 0, end = call + fn.length
    for (; end < tsl.length; end++) {
      if (tsl[end] === '(') depth++
      else if (tsl[end] === ')' && --depth === 0) break
    }
    const m = new RegExp(`^\\.(${f.join('|')})\\b(?!\\s*\\()`).exec(tsl.slice(end + 1))
    if (m) tsl = tsl.slice(0, end + 1) + `.get( '${m[1]}' )` + tsl.slice(end + 1 + m[0].length)
  }
}
console.log(`swizzle-named fields read through get on: ${[...swizzled.keys(), ...returning.keys()].join(' ')}`)

// the courses cell worked out every time
tsl = tsl.replace(/^const csHave = false;$/m, '').replace(/csHave\.not\(\)/g, 'bool( true )').replace(/^\s*csHave\.assign\( true \);$/gm, '')
tsl = tsl.replace(/import \{ /, 'import { bool, ')
// lookRun's Look a variable
tsl = tsl.replace(/(export const lookRun = [\s\S]*?const k = lookStart\(\))/, '$1.toVar()')
tsl += '\nexport { lookGx, lookGy };\n'

writeFileSync(`${out}${place}.looks.tsl.js`, tsl)
console.log(`${place}: ${glsl.split('\n').length} lines of GLSL, ${tsl.split('\n').length} of TSL; ${writes.size} functions inlined for their out/inout parameters (${[...writes.keys()].join(' ')}); bound ${bound.join(' ')}`)
