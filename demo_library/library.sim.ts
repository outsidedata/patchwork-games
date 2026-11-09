// The `library` row: the builds of the truth it is in, as every seat sees them. On its first step it asks the game's
// addon (`addons/library/library.addon.ts`) to write pro-ng's list, every kit kind and landmark there is, into
// `builds/library.json`, starts it watching the library's pro-ng (`watch`), and marks itself `listed`. Its `build` act, open to every seat, asks the addon for a build:
// `build('kit', kind, values)` for one kit kind with `values`, a JSON object of keys, over its studio defaults,
// `build('scene', scene)` for a scene of pro-ng's, `build('effects', kind, file)` for a kit kind's effects saved
// into pro-ng's `kit/<kind>.effects.json` (`file` its JSON), `build('materials', '', names)` for every material on
// its swatch (`names` a JSON list: only those, when it names any), or `build('list')` for the list again. Each step it copies what the
// truth's builds have come to onto its fields: `asked`, `done`, `running` and `error`, `changed` and `file`, how
// many times the library's pro-ng has changed and its last file to, `materials`, every material of pro-ng's
// `materials.json` the catalogue builds, and `rebuilt`, by place, the newest catalogue build the addon started itself
// (the addon's `State`). A page reloads onto a build once `done` reaches the number it asked for, or the number
// `rebuilt` holds for the place it shows. Its `time(hours)` and `rate(x)` acts, open to every seat, are the sky's
// clock, forwarded to the scene's `skydome3d` row's own closed acts of those names, and `sky(key, value)` sets its
// `doy`, `lat` or `phase`, which skydome3d has no act for, so a dev page on the server sets the whole clock.
import type { Kind } from '#engine/engine.ts'
import { start, state, watch, type Ask } from './addons/library/library.addon.ts'

const ask = (what: string, name: string, values: string): Ask =>
  what === 'kit' ? { kit: name, values: JSON.parse(values) } : what === 'scene' ? { scene: name }
    : what === 'effects' ? { effects: name, file: JSON.parse(values) }
      : what === 'materials' ? { materials: JSON.parse(values) as string[] } : { list: true }

// the skydome3d row's fields the `sky` act sets
const SKY = ['doy', 'lat', 'phase']

export const library: Kind = {
  tick(me, _dt, w) {
    if (!me.data.listed) {
      me.data.listed = true
      start(w.world, { list: true })
      watch(w.world)
    }
    Object.assign(me.data, state(w.world))
  },
  acts: {
    build(me, w, _seat, what: string, name = '', values = '{}') {
      start(w.world, ask(what, name, values))
      Object.assign(me.data, state(w.world))
    },
    // the sky's clock, from a dev page's panel: skydome3d's own acts are closed, so they are forwarded here
    time(_me, w, seat, hours: number) { w.call(w.find('skydome3d'), 'time', seat, hours) },
    rate(_me, w, seat, x: number) { w.call(w.find('skydome3d'), 'rate', seat, x) },
    // the rest of the sky's clock, which skydome3d has no act for: the day of the year, the latitude, the moon's phase
    sky(_me, w, _seat, key: string, value: number) {
      if (!SKY.includes(key)) throw new Error(`library's sky act sets ${SKY.join(', ')}, not ${key}`)
      w.find('skydome3d').data[key] = value
    },
  },
  open: ['build', 'time', 'rate', 'sky'],
}
