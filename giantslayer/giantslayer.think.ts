// A think that plays the whole loop for a seat, from the rows it sees (`plugins/playtester`'s `Think`),
// pressing through the player plugin as keys would: `dev.html?bot` hands it to the gym's client.
//
// It takes the first weak point not yet broken that can be reached: holding a limb, one on that limb
// or on a limb above it (each limb's `up` in the colossus's definition); on the ground, any, and the
// leg it walks to is the one whose chain of `up`s leads there. On the ground it walks to the outside
// of that leg, `OUT` metres past its surface, so the limb its hands find first is that leg, the stick
// turned from the way it wants to go by the camera's yaw as `relative` turns the stick back
// (`plugins/walker`), and grips there. Holding on: on another limb than the point's it climbs up,
// round toward the point's side; on the point's limb it climbs along and round to it, and within
// `NEAR` metres along and `TURN` radians round it charges a stab for `CHARGE` seconds, lets it go, and
// waits `AFTER` seconds for it to land. Holding a limb that leads to no point left, it lets go. Let go
// of (its grip spent, shaken off or struck), it lets go of grip, and once it stands with grip to spare
// it walks back. Every press is sent only when what it wants changes, as a held key sends only when it
// changes.
//
// `ends` reads the colossus's limbs off the wire the think is made with (anim's, the same numbers the
// server's rules read).
import type { Row } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import type { Think } from '#plugins/playtester/playtester.plugin.ts'
import { possessed } from '#plugins/player/player.plugin.ts'
import { ends } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'

const LEGS = ['legR', 'legL']
const OUT = 0.6
const NEAR = 0.6
const TURN = 0.25
const CHARGE = 1.4
const AFTER = 1.4

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// A point of a body's own frame (x its left, y up, z ahead) in the world.
function world(row: Row, p: number[]) {
  const y = row.data.yaw, [px, py, pz] = row.data.pos
  return [px + p[0] * Math.cos(y) + p[2] * Math.sin(y), py + p[1], pz - p[0] * Math.sin(y) + p[2] * Math.cos(y)]
}

function line(wire: Wire, giant: Row, segment: string): [number[], number[]] {
  const e = ends(wire, giant, segment)
  return [world(giant, e.slice(0, 3)), world(giant, e.slice(3))]
}

// A limb and every limb above it, by the colossus's `up`s.
function chain(segments: Record<string, { up?: string }>, from: string): string[] {
  const out = [from]
  while (segments[out[out.length - 1]]?.up) out.push(segments[out[out.length - 1]].up!)
  return out
}

export function think(wire: Wire): Think {
  const sent: Record<string, string> = {}
  let stabbing: { until: number; release: number } | undefined
  // The first of these whose value is not what was last sent for it, now sent.
  const press = (wants: [string, ...unknown[]][]): [string, ...unknown[]] | undefined => {
    for (const w of wants) {
      const key = JSON.stringify(w.slice(1))
      if (sent[w[0]] === key) continue
      sent[w[0]] = key
      return w as [string, ...unknown[]]
    }
    return undefined
  }
  return (rows: Row[]) => {
    const me = possessed(rows)
    const giant = rows.find(r => r.kind === 'colossus')
    if (!me || !giant || giant.data.dead) return press([['move', 0, 0], ['grip', 0], ['attack', 0]])
    const d = me.data
    const k = def(wire, me.kind)
    const segments = def(wire, giant.kind).segments as Record<string, { radius: number; up?: string }>
    const points = rows.filter(r => r.kind === 'weakpoint' && !r.data.broken && r.data.on === giant.id)
    const now = performance.now() / 1000
    if (stabbing && now >= stabbing.until) stabbing = undefined
    if (stabbing) return press([['move', 0, 0], ['attack', now >= stabbing.release ? 0 : 1]])
    if (!d.hold) {
      if (d.hp <= 0 || !d.grounded || d.grip < k.grip.least + 0.2 || points.length === 0) return press([['move', 0, 0], ['grip', 0], ['attack', 0]])
      const leg = LEGS.find(l => chain(segments, l).includes(points[0].data.segment)) ?? LEGS[0]
      // The outside of the leg, low down: out from the colossus's middle across the ground.
      const [a, b] = line(wire, giant, leg)
      const low = a[1] < b[1] ? a : b
      const ox = low[0] - giant.data.pos[0], oz = low[2] - giant.data.pos[2], ol = Math.hypot(ox, oz) || 1
      const reach = segments[leg].radius + OUT
      const to = [low[0] + (ox / ol) * reach, low[2] + (oz / ol) * reach]
      const dx = to[0] - d.pos[0], dz = to[1] - d.pos[2], far = Math.hypot(dx, dz) || 1
      const close = far < 0.8
      const yaw = d.look.yaw, s = Math.sin(yaw), c = Math.cos(yaw)
      // The stick that `relative` turns into this way: forward along (sin, cos), right along (−cos, sin).
      const ahead = (dx * s + dz * c) / far, right = (-dx * c + dz * s) / far
      const x = close ? 0 : Math.round(right), y = close ? 0 : -Math.round(ahead)
      return press([['grip', close ? 1 : 0], ['move', x, y], ['attack', 0]])
    }
    const on = d.hold
    const ahead = chain(segments, on.segment)
    const target = points.find(p => ahead.includes(p.data.segment))
    if (!target) return press([['move', 0, 0], ['grip', 0]])
    const turn = wrap(on.around - target.data.around)
    const x = Math.abs(turn) > TURN ? Math.sign(turn) : 0
    if (on.segment !== target.data.segment) return press([['grip', 1], ['move', x, -1]])
    const [a, b] = line(wire, giant, on.segment)
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const rising = b[1] >= a[1] ? 1 : -1
    const need = (target.data.along - on.along) * len
    const y = Math.abs(need) > NEAR ? -Math.sign(need) * rising : 0
    if (!x && !y) stabbing = { release: now + CHARGE, until: now + CHARGE + AFTER }
    return press([['grip', 1], ['move', x, y]])
  }
}
