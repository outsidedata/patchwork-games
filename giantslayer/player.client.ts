// The hero's keys, camera, rumble and HUD, for the seat's own row alone; anim draws the body of every
// seat's. The left stick, the d-pad or w a s d move, sent as `move`, the stick read analog so a push
// part way walks or climbs part speed; the right stick turns the camera (`turn`), read analog, and so
// does the mouse moved under the pointer lock (`look`), which a click takes; chasecamera3d sits on the
// camera. Shift, B or the left stick pressed in, held, runs; space or A jumps; e, the right button, the
// right trigger or the right shoulder held grips (`grip`); f, the left button or X held charges a stab
// and let go strikes (`attack`). The keys are the standard mapping's (`plugins/player`): A `Pad0`, B
// `Pad1`, X `Pad2`, the right shoulder `Pad5`, the right trigger `Pad7`, the left stick pressed in
// `Pad10`, the d-pad `Pad12` to `Pad15`.
//
// The gamepad last used rumbles (`plugins.player.rumble`) at what this page sees change on the rows it
// holds from one frame to the next, at the strengths and lengths of the player definition's `rumble`:
// each marker of the colossus's attack clip (`attack.clip`, its foot coming down) its playhead passes
// that `rumble.stomp` names, its strength falling from the marker's at the colossus's feet to none at
// `rumble.stomp.reach` metres off; `grab`, the hero taking hold; `shaken`, held again each time it ends
// while the colossus it holds roars; `slip`, letting go while grip is still held (its grip spent or
// shaken off); `broke`, a weak point broken; `hurt`, the hero struck; `fallen`, the colossus dead. Of
// several in one frame the last of that list is felt.
//
// The HUD, on the `hud` panel, read off the seat's own row and the weak points' rows as this page has
// them, at the places and in the words of the player definition's `hud`: the grip as a bar (its
// `low` colour under `hud.grip.low`), the stab's charge as a bar while it is held, the health, and how
// many weak points are left of all of them; and once the colossus is dead, `hud.fallen` on the
// `banner` panel.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds, Rumble } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animKind, clipOf, rigOf } from '#plugins/anim/anim.sim.ts'

let ours = false
// What a frame saw of the rows: the hero's health and whether it holds on, the weak points broken, and
// the colossus's death, clip, whether it plays it as an act, and its playhead.
type Seen = { hp: number; hold: boolean; broken: number; dead: boolean; clip: string | null; act: boolean; clipT: number }
// The last frame's, to rumble at what changed.
let seen: Seen | undefined
let shakenUntil = 0

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  seen = undefined
  shakenUntil = 0
  plugins.chasecamera3d.follow(row.id)
  plugins.player.bind({
    stick: [
      {
        keys: [['a', 'Pad14', 'PadStickLeft'], ['d', 'Pad15', 'PadStickRight'], ['w', 'Pad12', 'PadStickUp'], ['s', 'Pad13', 'PadStickDown']],
        send: (x, y) => ['move', x, y],
        analog: true,
      },
      {
        keys: ['PadRightStickLeft', 'PadRightStickRight', 'PadRightStickUp', 'PadRightStickDown'],
        send: (x, y) => ['turn', x, y],
        analog: true,
      },
    ],
    hold: [
      { keys: ['Shift', 'Pad1', 'Pad10'], send: v => ['run', v] },
      { keys: ['e', 'Mouse2', 'Pad7', 'Pad5'], send: v => ['grip', v] },
      { keys: ['f', 'Mouse0', 'Pad2'], send: v => ['attack', v] },
    ],
    press: { ' ': ['jump'], Pad0: ['jump'] },
    pointer: (dx, dy) => ['look', dx, dy],
  } satisfies Binds)
}

// The rumble of what changed on the rows since the last frame, the last of the header's list felt.
function feel(row: Row, plugins: Plugins, k: any) {
  const d = row.data
  const r = k.rumble
  const rows = plugins.wire.rows
  const giant = rows.find(x => x.kind === 'colossus')
  const g = giant?.data
  const now: Seen = {
    hp: d.hp,
    hold: !!d.hold,
    broken: rows.filter(x => x.kind === 'weakpoint' && x.data.broken).length,
    dead: !!g?.dead,
    clip: g?.clip ?? null,
    act: g?.state === 'act',
    clipT: g?.clipT ?? 0,
  }
  const was = seen
  seen = now
  if (!was) return
  let felt: Rumble | undefined
  if (giant) {
    const attack = def(plugins.wire, giant.kind).attack.clip
    if (now.act && now.clip === attack) {
      // Where the playhead was last frame on this play of the clip, or its start on a new play.
      const from = was.act && was.clip === attack && was.clipT <= now.clipT ? was.clipT : 0
      const far = Math.hypot(d.pos[0] - g!.pos[0], d.pos[2] - g!.pos[2])
      const near = Math.max(0, 1 - far / r.stomp.reach)
      for (const m of clipOf(rigOf(plugins.wire, animKind(giant)), attack).markers) {
        const at = r.stomp[m.name]
        if (!at || !(from < m.t && m.t <= now.clipT) || near <= 0) continue
        felt = { strong: at.strong * near, weak: at.weak * near, seconds: at.seconds }
      }
    }
  }
  if (!was.hold && now.hold) felt = r.grab
  const shaking = !!giant && d.hold?.on === giant.id && g!.clip === 'roar' && g!.state === 'act'
  const clock = performance.now() / 1000
  if (shaking && clock >= shakenUntil) {
    felt = r.shaken
    shakenUntil = clock + r.shaken.seconds
  }
  if (!shaking) shakenUntil = 0
  if (was.hold && !now.hold && d.gripping && now.hp === was.hp && !now.dead) felt = r.slip
  if (now.broken > was.broken) felt = r.broke
  if (now.hp < was.hp) felt = r.hurt
  if (now.dead && !was.dead) felt = r.fallen
  if (felt) plugins.player.rumble(felt)
}

// A line's words with each `{field}` filled in.
const fill = (text: string, values: Record<string, number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(values[k]))

export function tick(row: Row, plugins: Plugins) {
  if (!ours) return
  const { ui } = plugins
  const { Text } = ui.PIXI as typeof PIXI
  const k = def(plugins.wire, row.kind)
  feel(row, plugins, k)
  const h = k.hud
  const d = row.data
  const at = <T extends PIXI.Container>(c: T, [x, y]: number[]): T => { c.position.set(x, y); return c }
  const label = (panel: string, key: string, style: string) => ui.show(panel, key, () => new Text({ text: '', style: ui.style(style) }))

  at(label('hud', 'grip.label', 'label'), h.grip.label.at).text = h.grip.label.text
  const grip = ui.style('grip')
  at(ui.show('hud', 'grip', () => ui.bar(grip)), h.grip.bar.at).set(d.grip, d.grip < h.grip.low ? grip.low : grip.fill)
  if (d.charging) {
    at(label('hud', 'charge.label', 'label'), h.charge.label.at).text = h.charge.label.text
    const charge = ui.style('charge')
    at(ui.show('hud', 'charge', () => ui.bar(charge)), h.charge.bar.at).set(d.charge, charge.fill)
  }
  at(label('hud', 'health', 'label'), h.health.at).text = fill(h.health.text, { hp: d.hp, most: k.hp })
  const points = plugins.wire.rows.filter(r => r.kind === 'weakpoint')
  at(label('hud', 'left', 'label'), h.left.at).text = fill(h.left.text, { left: points.filter(p => !p.data.broken).length, all: points.length })
  if (plugins.wire.rows.some(r => r.kind === 'colossus' && r.data.dead)) {
    const fallen = at(label('banner', 'fallen', 'banner'), h.fallen.at)
    fallen.anchor.set(h.fallen.anchor[0], h.fallen.anchor[1])
    fallen.text = h.fallen.text
  }
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
