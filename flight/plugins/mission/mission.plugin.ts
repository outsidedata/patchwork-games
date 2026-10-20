// The browser half of flight's missions (`mission.sim.ts`), a plugin of the game's own (`world.shipped`,
// after `hud`, whose `cue` it calls): what the seat's own mission shows, read off its own `player` row
// (`possessed`) and the plane it holds (`holding`), which a page running the sky ahead draws from its
// copy. It reads rows and writes none. Every place is the `player` definition's `hud.mission`, the middle
// of the mission's line on the ui's `hud` panel.
//
// The ring course (the row's `course`): `RING n / of` the ring it is flying to, the clock, and how many
// it has missed; `COURSE DONE` with the time and the misses once it is over, and `LAND ON THE RUNWAY`
// once every ring is flown. Until then the HUD cues the next ring (`plugins/hud`'s `cue`), labelled with
// the metres to it.
//
// The formation (the row's `formation`), flown off the lead of the seat's plane's type (`leadOf`), a
// plane flight3d draws as it draws every plane: the line, `CLIMB TO JOIN` while it waits, then the state,
// TIGHT, LOOSE or LOST, the metres to the slot, the score and how far round the loop the lead has flown
// since; `FORMATION DONE` with the score and the share of it flown tight. While it flies, the HUD cues the
// seat's slot off the lead (`slotOf`, by the seat's slot in the `formation` definition's `slots`),
// labelled SLOT.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { holding, possessed } from '#plugins/player/player.plugin.ts'
import { leadOf, slotOf, trackOf, type Course, type Formation } from './mission.sim.ts'

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

export function mission() {
  function course(plugins: Plugins, plane: Row, c: Course) {
    const { ui, wire, hud } = plugins
    if (!ui) return
    const rings = (wire.rows as Row[]).filter(r => r.kind === 'ring').sort((a, b) => a.data.order - b.data.order)
    const of = rings.length
    const t = ui.show('hud', 'course', () => new ui.PIXI.Text({ style: ui.style('hud.text'), anchor: 0.5 }))
    t.position.set(...(def(wire, 'player').hud.mission as [number, number]))
    t.text = c.done ? `COURSE DONE   ${clock(c.clock)}   missed ${c.missed}`
      : c.next >= of ? `LAND ON THE RUNWAY   ${clock(c.clock)}   missed ${c.missed}`
      : `RING ${c.next + 1} / ${of}   ${clock(c.clock)}   missed ${c.missed}`
    const ring = rings[c.next]
    if (c.done || !ring) return
    const at = ring.data.pos as number[], pos = plane.data.pos as number[]
    hud.cue('ring', at, `${Math.round(Math.hypot(at[0] - pos[0], at[1] - pos[1], at[2] - pos[2]))} m`)
  }

  function formation(plugins: Plugins, me: Row, plane: Row, f: Formation) {
    const { ui, wire } = plugins
    if (!ui) return
    const k = def(wire, 'formation')
    const t = ui.show('hud', 'formation', () => new ui.PIXI.Text({ style: ui.style('hud.text'), anchor: 0.5 }))
    t.position.set(...(def(wire, 'player').hud.mission as [number, number]))
    const round = Math.min(100, Math.round((f.s / trackOf(k.path).length) * 100))
    const flown = f.s / (k.speeds[plane.data.type] || 1)
    t.text = f.done ? `FORMATION DONE   score ${Math.round(f.score)}   tight ${Math.round((f.tight / Math.max(flown, 1e-9)) * 100)}%`
      : f.state === 'waiting' ? `CLIMB TO ${k.join} M TO JOIN THE LEAD`
      : `${f.state.toUpperCase()}   ${f.gap.toFixed(0)} m   score ${Math.round(f.score)}   ${round}% round`
    const lead = leadOf(wire.rows as Row[], plane.data.type)
    if (!f.done && f.state !== 'waiting' && lead) plugins.hud.cue('slot', slotOf(lead.data.pos, lead.data.rot, k.slots[me.data.seat]), 'SLOT')
  }

  return {
    tick(plugins: Plugins) {
      const rows = plugins.wire.rows as Row[]
      const me = possessed(rows), plane = holding(rows)
      if (!me || !plane) return
      if (me.data.course) course(plugins, plane, me.data.course)
      if (me.data.formation) formation(plugins, me, plane, me.data.formation)
    },
  }
}
