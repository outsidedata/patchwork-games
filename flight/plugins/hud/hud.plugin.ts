// flight's head-up display, a plugin of the game's own (`world.shipped`), drawn on the ui's `hud` panel
// for the seat's own plane, the `plane` its `player` row holds (`holding`), once launched. It reads rows
// and writes none.
// Every place, size and colour is the `player` definition's `hud` in `assets/flight.json`, the kind
// whose row it reads, as a game's own plugin reads its numbers, in pixels of the panel,
// which lies over the whole canvas; every line is stroked twice, `shadowWidth` wide in `shadow` at
// `shadowAlpha` under `width` wide in `colour`, so it reads over sky and ground alike.
//
// The picture is the pilot's, drawn in the plane's own frame: up the glass is the plane's roof, so the
// world tilts round the nose as the plane banks, as a fighter's HUD draws it, angles `ladder.pxPerDeg`
// pixels a degree about `centre`, the nose. Pitch, bank and heading are read off the plane's rot: pitch
// the nose's angle over the horizon; bank atan2 of the right wing's drop over the roof's rise, so it
// runs on through knife-edge and inverted without a jump; heading the nose clockwise from −z, north,
// seen from above, as the runway's numbers count it.
//   horizon    a line `ladder.horizon` across, `ladder.gap` cut from its middle, where the horizon is,
//              and a rung every `step` degrees of pitch, two halves `rung` long either side of the gap,
//              their tips `tip` long turned toward the horizon, labelled with their degrees `label`
//              past each end, dashed `dash` below the horizon; only the rungs within `reach` of the nose.
//   boresight  the nose: a W fixed at `centre`, `wing` either side, its two dips `drop` down.
//   fpm        where the plane is going: a ring `radius` with wings `wing` and a fin `fin`, off the nose
//              by the angle of attack, down, and the sideslip, right (flight3d's `windAngles`), held
//              within the ladder's `reach`; not drawn below the air's `calm` speed.
//   bank       an arc `radius` over the nose from −`ticks`' last to +`ticks`' last degrees, a tick at 0
//              and each of `ticks` either side, `long` at 0 and each multiple of 30, else `tick`; and a
//              triangle `pointer` long inside it, turned with the horizon, pointing at the sky.
//   heading    a tape along the top, its spine at `at`, `width` across holding `span` degrees: a tick
//              every `tick` degrees, hanging `big` on each `label` degrees, which is written under it,
//              else `small`; the heading in a box `box` over the middle.
//   speed      a tape up the left, its spine at `at`, `height` tall holding `span` m/s, the ticks
//              reaching left and the labels left of them, the speed in a box at its middle, and a band
//              `band` wide in `warn` beside the spine from the bottom up to the 1 g stall speed at the
//              plane's height (flight3d's `stallSpeed` at the air's density there).
//   altitude   a tape up the right likewise, metres over the sea, the ticks reaching right, and a band
//              `band` wide in `caution` beside the spine from the bottom up to the ground under the
//              plane, once terrain3d's ground has landed.
//   readouts   under the speed tape from `readouts.left`, a line every `line`: THR the lever, and AB after
//              it while the lever is past the plane's `burner` (the `plane` definition's `planes`), G the
//              load factor (the air's push and the gear's along the roof, over the weight) and AOA in
//              degrees; under the altitude tape from `readouts.right`: VS the climb in m/s, and R the
//              height over the ground while it is under `altitude.radar` metres.
//   warnings   down from `warnings.at`, a line every `line`, middles on it: STALL while the wing is
//              more than half stalled (flight3d's `aero`), and PULL UP while the plane is off its wheels
//              sinking faster than `pull.sink` m/s with the ground under `pull.seconds` away at that
//              sink, in `hud.warn`, each flashing `blink` times a second; BRAKES while they are held,
//              and the plane's `brakes` name (a Cessna's flaps, a jet's airbrake) while that is out, in
//              `hud.caution`. A crashed plane shows `crashed` and nothing else.
// `mission` is where a mission's own line goes (`plugins/mission`).
//
// `cue(key, at, label)`, on the plugin, shows a mission's target for the frame it is called in: a
// diamond `cue.size` round the canvas point of the world point `at`, `label` under it; off the glass,
// behind the camera or outside `cue.inset` of the panel's edge, a triangle `cue.size` on the ellipse
// `cue.edge` round `centre`, pointing toward it, `label` inside it. The ring course cues its next ring
// and the formation its slot.
//
// It is shown each frame the seat has a plane and render3d's camera is its own, and goes while something
// else holds it (`claimed()`: a cutscene, the editor's orbit). Its texts are made once each, by name,
// which is their `label` (`rung <deg> <side>`, `heading <deg>`, `speed`, `stall`…), and hidden in a
// frame that does not write them. It ticks at `shipped`'s place in the scene's
// `plugins`, after `ui` and before the actors, so what it shows is drawn in the same frame.
import type * as PIXI from 'pixi.js'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { aero, airframeOf, contact, densityAt, modelOf, rotate, stallSpeed, type Flight, type Plane } from '#plugins/flight3d/flight3d.sim.ts'
import { holding, possessed } from '#plugins/player/player.plugin.ts'

const DEG = 180 / Math.PI
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const three = (n: number) => String(((Math.round(n) % 360) + 360) % 360).padStart(3, '0')
const signed = (n: number, digits: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`

type Tape = { at: number[]; span: number; tick: number; label: number; small: number; big: number; band: number }
type Hud = {
  colour: number; shadow: number; shadowAlpha: number; warn: number; caution: number; width: number; shadowWidth: number
  centre: number[]; box: number[]
  ladder: { pxPerDeg: number; step: number; reach: number; rung: number; gap: number; tip: number; horizon: number; dash: number; label: number }
  boresight: { wing: number; drop: number }
  fpm: { radius: number; wing: number; fin: number }
  bank: { radius: number; ticks: number[]; tick: number; long: number; pointer: number }
  heading: Tape & { width: number }
  speed: Tape & { height: number }
  altitude: Tape & { height: number; radar: number }
  readouts: { left: number[]; right: number[]; line: number }
  warnings: { at: number[]; line: number; blink: number }
  pull: { sink: number; seconds: number }
  brakes: Record<string, string>
  crashed: string
  mission: number[]
  cue: { size: number; inset: number; edge: number[] }
}

export function hud() {
  let plugins: Plugins | undefined

  // The panel's one HUD: the shadows, the lines over them, and the texts over both, each made once by
  // its name.
  type Drawn = PIXI.Container & { shadow: PIXI.Graphics; lines: PIXI.Graphics; words: Map<string, PIXI.Text> }

  function make(ui: any): Drawn {
    const { PIXI } = ui
    const c = new PIXI.Container() as Drawn
    c.shadow = new PIXI.Graphics()
    c.lines = new PIXI.Graphics()
    c.words = new Map()
    c.addChild(c.shadow, c.lines)
    return c
  }

  function draw(ui: any, d: Drawn, k: Hud, p: Plane, f: Flight) {
    const { PIXI } = ui
    const said = new Set<string>()
    d.shadow.clear()
    d.lines.clear()
    // A path stroked as the HUD strokes: its shadow, then itself in `colour`, `width` wider for a band.
    const stroke = (path: (g: PIXI.Graphics) => void, colour = k.colour, width = k.width) => {
      path(d.shadow)
      d.shadow.stroke({ width: width + k.shadowWidth - k.width, color: k.shadow, alpha: k.shadowAlpha, cap: 'round', join: 'round' })
      path(d.lines)
      d.lines.stroke({ width, color: colour, cap: 'round', join: 'round' })
    }
    const segment = (a: number[], b: number[], colour?: number, width?: number) => stroke(g => g.moveTo(a[0], a[1]).lineTo(b[0], b[1]), colour, width)
    const say = (key: string, style: string, text: string, x: number, y: number, ax = 0.5, ay = 0.5, rotation = 0) => {
      let t = d.words.get(key)
      if (!t) {
        t = new PIXI.Text({ style: ui.style(style), label: key }) as PIXI.Text
        d.words.set(key, t)
        d.addChild(t)
      }
      t.text = text
      t.anchor.set(ax, ay)
      t.position.set(x, y)
      t.rotation = rotation
      t.visible = true
      said.add(key)
    }
    const done = () => { for (const [key, t] of d.words) if (!said.has(key)) t.visible = false }

    if (p.crashed) {
      say('crashed', 'hud.warn', k.crashed, k.warnings.at[0], k.warnings.at[1])
      return done()
    }

    const model = modelOf(f, p.type), t = airframeOf(f, p.type)
    const a = aero(p, p, f, t, 0)
    const land = plugins!.terrain3d?.ground as { height(x: number, z: number): number } | undefined
    const ground = land && ((x: number, z: number) => land.height(x, z))
    const nose = rotate(p.rot, [0, 0, -1]), right = rotate(p.rot, [1, 0, 0]), up = rotate(p.rot, [0, 1, 0])
    const pitch = Math.asin(clamp(nose[1], -1, 1)) * DEG
    const bank = Math.atan2(-right[1], up[1])
    const heading = Math.atan2(nose[0], -nose[2]) * DEG
    const [cx, cy] = k.centre

    // The ladder and the horizon, turned by the bank about the nose: a point `x` along the horizon and
    // `y` below it, in the world's upright frame, on the glass.
    const L = k.ladder
    const cb = Math.cos(bank), sb = Math.sin(bank)
    const turn = (x: number, y: number) => [cx + x * cb + y * sb, cy - x * sb + y * cb]
    for (let deg = -90; deg <= 90; deg += L.step) {
      const y = (pitch - deg) * L.pxPerDeg
      if (Math.abs(y) > L.reach) continue
      if (deg === 0) {
        for (const s of [-1, 1]) segment(turn(s * L.gap / 2, y), turn(s * L.horizon / 2, y))
        continue
      }
      const tip = deg > 0 ? L.tip : -L.tip
      for (const s of [-1, 1]) {
        const inner = s * L.gap / 2, outer = s * (L.gap / 2 + L.rung)
        if (deg > 0) segment(turn(inner, y), turn(outer, y))
        else for (let x = 0; x < L.rung; x += 2 * L.dash) segment(turn(inner + s * x, y), turn(inner + s * Math.min(x + L.dash, L.rung), y))
        segment(turn(inner, y), turn(inner, y + tip))
        const at = turn(s * (L.gap / 2 + L.rung + L.label), y)
        say(`rung ${deg} ${s}`, 'hud.small', String(Math.abs(deg)), at[0], at[1], 0.5, 0.5, -bank)
      }
    }

    // The nose.
    const B = k.boresight
    stroke(g => g.moveTo(cx - B.wing, cy).lineTo(cx - B.wing / 2, cy).lineTo(cx - B.wing / 4, cy + B.drop).lineTo(cx, cy)
      .lineTo(cx + B.wing / 4, cy + B.drop).lineTo(cx + B.wing / 2, cy).lineTo(cx + B.wing, cy))

    // Where the plane is going.
    if (a.speed >= f.air.calm) {
      const F = k.fpm
      let fx = a.slip * DEG * L.pxPerDeg, fy = a.aoa * DEG * L.pxPerDeg
      const off = Math.hypot(fx, fy)
      if (off > L.reach) { fx *= L.reach / off; fy *= L.reach / off }
      const x = cx + fx, y = cy + fy
      stroke(g => g.circle(x, y, F.radius))
      segment([x - F.radius - F.wing, y], [x - F.radius, y])
      segment([x + F.radius, y], [x + F.radius + F.wing, y])
      segment([x, y - F.radius], [x, y - F.radius - F.fin])
    }

    // The bank scale and its sky pointer.
    const K = k.bank
    const most = K.ticks[K.ticks.length - 1] / DEG
    // From its own end: an arc goes on from wherever the path last stood, which drew a line in from the nose.
    stroke(g => g.moveTo(cx - K.radius * Math.sin(most), cy - K.radius * Math.cos(most)).arc(cx, cy, K.radius, -Math.PI / 2 - most, -Math.PI / 2 + most))
    for (const deg of [0, ...K.ticks.flatMap(v => [-v, v])]) {
      const th = deg / DEG, len = deg % 30 === 0 ? K.long : K.tick
      segment([cx + K.radius * Math.sin(th), cy - K.radius * Math.cos(th)], [cx + (K.radius + len) * Math.sin(th), cy - (K.radius + len) * Math.cos(th)])
    }
    {
      const th = -bank, r0 = K.radius - 2, r1 = r0 - K.pointer, half = K.pointer * 0.6
      const at = (r: number, side: number) => [cx + r * Math.sin(th) + side * half * Math.cos(th), cy - r * Math.cos(th) + side * half * Math.sin(th)]
      const [tipAt, left, rightAt] = [at(r0, 0), at(r1, -1), at(r1, 1)]
      stroke(g => g.moveTo(tipAt[0], tipAt[1]).lineTo(left[0], left[1]).lineTo(rightAt[0], rightAt[1]).closePath())
    }

    const [bw, bh] = k.box
    // A value's box, `x` its middle and `y` its middle.
    const box = (key: string, text: string, x: number, y: number) => {
      stroke(g => g.rect(x - bw / 2, y - bh / 2, bw, bh))
      say(key, 'hud.text', text, x, y)
    }

    // The heading tape.
    {
      const H = k.heading, [x, y] = H.at, per = H.width / H.span
      segment([x - H.width / 2, y], [x + H.width / 2, y])
      for (let deg = Math.ceil((heading - H.span / 2) / H.tick) * H.tick; deg <= heading + H.span / 2; deg += H.tick) {
        const px = x + (deg - heading) * per
        const big = deg % H.label === 0
        segment([px, y], [px, y + (big ? H.big : H.small)])
        if (big) say(`heading ${(deg % 360 + 360) % 360}`, 'hud.small', three(deg), px, y + H.big + 2, 0.5, 0)
      }
      box('heading', three(heading), x, y - bh / 2 - 4)
    }

    // A vertical tape: the spine at `at`, `side` −1 for ticks reaching left, +1 right; `value` at its
    // middle; the band up from its bottom to `floor`.
    const tape = (name: string, T: Tape & { height: number }, side: number, value: number, floor: number | undefined, band: number) => {
      const [x, y] = T.at, per = T.height / T.span, top = y - T.height / 2, bottom = y + T.height / 2
      segment([x, top], [x, bottom])
      for (let v = Math.ceil((value - T.span / 2) / T.tick) * T.tick; v <= value + T.span / 2; v += T.tick) {
        if (name === 'speed' && v < 0) continue
        const py = y - (v - value) * per
        const big = v % T.label === 0
        segment([x, py], [x + side * (big ? T.big : T.small), py])
        if (big && Math.abs(py - y) > bh / 2 + 8) say(`${name} ${v}`, 'hud.small', String(v), x + side * (T.big + 4), py, side < 0 ? 1 : 0, 0.5)
      }
      box(name, String(Math.round(value)), x + side * (T.big + 4 + bw / 2), y)
      if (floor === undefined) return
      const py = clamp(y - (floor - value) * per, top, bottom)
      if (py < bottom) segment([x - side * (T.band / 2 + 2), bottom], [x - side * (T.band / 2 + 2), py], band, T.band)
    }
    const height = ground && ground(p.pos[0], p.pos[2])
    tape('speed', k.speed, -1, a.speed, stallSpeed(t, f.gravity, densityAt(f.air, p.pos[1])), k.warn)
    tape('altitude', k.altitude, 1, p.pos[1], height, k.caution)
    say('speed unit', 'hud.small', 'M/S', k.speed.at[0], k.speed.at[1] - k.speed.height / 2 - 6, 0.5, 1)
    say('altitude unit', 'hud.small', 'M', k.altitude.at[0], k.altitude.at[1] - k.altitude.height / 2 - 6, 0.5, 1)

    // The readouts.
    const touch = ground ? contact(p, model.gear, ground) : undefined
    const push = [a.force[0] + (touch?.force[0] ?? 0), a.force[1] + a.weight + (touch?.force[1] ?? 0), a.force[2] + (touch?.force[2] ?? 0)]
    const R = k.readouts
    const burner: number | undefined = def(plugins!.wire, 'plane').planes[p.type]?.burner
    const burning = burner !== undefined && p.throttle >= burner
    say('throttle', 'hud.text', `THR ${Math.round(p.throttle * 100)}%${burning ? ' AB' : ''}`, R.left[0], R.left[1], 0, 0)
    say('g', 'hud.text', `G ${(dot(push, up) / a.weight).toFixed(1)}`, R.left[0], R.left[1] + R.line, 0, 0)
    say('aoa', 'hud.text', `AOA ${(a.aoa * DEG).toFixed(1)}`, R.left[0], R.left[1] + 2 * R.line, 0, 0)
    say('vs', 'hud.text', `VS ${signed(p.vel[1], 1)}`, R.right[0], R.right[1], 0, 0)
    const agl = height === undefined ? undefined : p.pos[1] - height
    if (agl !== undefined && agl < k.altitude.radar) say('radar', 'hud.text', `R ${Math.max(0, Math.round(agl))}`, R.right[0], R.right[1] + R.line, 0, 0)

    // The warnings.
    const airborne = !p.press.some(c => c > 0)
    const lit = Math.floor((performance.now() / 1000) * k.warnings.blink * 2) % 2 === 0
    const warnings: [string, string, string, boolean][] = []
    if (a.stall > 0.5) warnings.push(['stall', 'hud.warn', 'STALL', true])
    if (airborne && agl !== undefined && -p.vel[1] > k.pull.sink && agl / -p.vel[1] < k.pull.seconds) warnings.push(['pull', 'hud.warn', 'PULL UP', true])
    if (p.brake > 0) warnings.push(['brakes', 'hud.caution', 'BRAKES', false])
    if (p.airbrake > 0 && k.brakes[p.type]) warnings.push(['airbrake', 'hud.caution', k.brakes[p.type], false])
    warnings.forEach(([key, style, text, flashes], i) => {
      if (!flashes || lit) say(key, style, text, k.warnings.at[0], k.warnings.at[1] + i * k.warnings.line)
    })
    done()
  }

  return {
    tick(p: Plugins) {
      plugins = p
      const { ui, wire, render3d } = p
      const me = possessed(wire.rows)
      const plane = holding(wire.rows)
      if (!ui || !me?.data.launched || !plane || render3d?.claimed() !== undefined) return
      const k = def(wire, 'player').hud as Hud
      draw(ui, ui.show('hud', 'hud', () => make(ui)), k, plane.data as Plane, wire.scene.world!.flight3d as Flight)
    },

    /** A mission's target `at`, a world point, shown for this frame with `label` (the header's `cue`). */
    cue(key: string, at: number[], label: string) {
      const { ui, wire, render3d } = plugins!
      if (render3d.claimed() !== undefined) return
      const { PIXI } = ui
      const k = def(wire, 'player').hud as Hud
      const C = k.cue
      const c = ui.show('hud', `cue ${key}`, () => {
        const box = new PIXI.Container()
        box.addChild(new PIXI.Graphics(), new PIXI.Graphics(), new PIXI.Text({ style: ui.style('hud.small') }))
        return box
      }) as PIXI.Container
      const [shadow, lines, text] = c.children as [PIXI.Graphics, PIXI.Graphics, PIXI.Text]
      const [width, height] = wire.scene.world!.ui.panels.hud.size as number[]
      const s = ui.project(at)
      const local = ui.panel('hud').toLocal({ x: s.x, y: s.y })
      const [cx, cy] = k.centre
      const seen = !s.behind && local.x >= C.inset && local.x <= width - C.inset && local.y >= C.inset && local.y <= height - C.inset
      // Off the glass, the way to it from the middle: a point behind the camera projects mirrored
      // through the middle, so its way is turned round.
      const flip = s.behind ? -1 : 1
      const way = Math.atan2(flip * (local.y - cy), flip * (local.x - cx))
      const ux = Math.cos(way), uy = Math.sin(way)
      const ex = cx + C.edge[0] * ux, ey = cy + C.edge[1] * uy, S = C.size
      const shape = seen
        ? [local.x, local.y - S, local.x + S, local.y, local.x, local.y + S, local.x - S, local.y]
        : [ex + ux * S, ey + uy * S, ex - ux * S - uy * S * 0.7, ey - uy * S + ux * S * 0.7, ex - ux * S + uy * S * 0.7, ey - uy * S - ux * S * 0.7]
      shadow.clear().poly(shape).stroke({ width: k.shadowWidth, color: k.shadow, alpha: k.shadowAlpha, join: 'round' })
      lines.clear().poly(shape).stroke({ width: k.width, color: k.colour, join: 'round' })
      text.text = label
      if (seen) {
        text.anchor.set(0.5, 0)
        text.position.set(local.x, local.y + S + 4)
      } else {
        text.anchor.set(0.5)
        text.position.set(cx + (C.edge[0] - 3 * S) * ux, cy + (C.edge[1] - 3 * S) * uy)
      }
    },
  }
}
