// The kit studio, the library plugin's second tool (`library.plugin.ts`): one kit kind of pro-ng's, built from its
// studio defaults with any keys changed, drawn alone with its effects. `kit()` hands back `holds(plugins)`, whether the
// place is a kit kind's build (the `library.kit` entry, `<place>.kit.json`, `assets/build.ts`'s `kitOf`), `values(kit)`,
// the keys that differ from the kind's defaults, and `panel(plugins, show, go)`, called each frame the tool is up
// (`show` renderdom's, for the tool's panel; `go(kind, keys)` builds a kind with those keys and goes to it):
//
//   kit        every kit kind pro-ng has (the `library` entry, `builds/library.json`), the one drawn picked; picking
//              another builds it from its defaults and goes to it.
//   the kind   what its header says it is, then each key of its studio defaults with a box holding the value it was
//              built with, its type and what it does under it, marked when it is not the default; `build` builds it
//              again with every key that is not its default, `reset` puts every box back to its default. Its header's
//              notes under them.
//   effects    for a kind with its own effects file, the effects editor (`library.effects.ts`): each change played at
//              once, Save writing the kind's `kit/<kind>.effects.json`.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { json, written } from '#plugins/loader/loader.sim.ts'
import { effectsEditor } from './library.effects.ts'

export type Kit = {
  kind: string
  defaults: Record<string, unknown>
  values: Record<string, unknown>
  about: string
  keys: { keys: string[]; type: string; does: string }[]
  notes: string[]
  effects?: Record<string, Record<string, unknown>[]>
}
type Show = (key: string, make: () => HTMLElement) => HTMLElement
type List = { kinds: { kind: string; about: string }[] }

export function kit() {
  // the value in each key's box, from the build's own keys over its defaults
  let values: Record<string, unknown> | undefined
  // each key's box, by its key
  const boxes = new Map<string, HTMLInputElement>()
  const worldOf = (plugins: Plugins): Record<string, any> => plugins.wire.scene.world!
  const has = (plugins: Plugins, name: string) => name in worldOf(plugins).loader.assets

  const differing = (k: Kit) => {
    values ??= { ...k.defaults, ...k.values }
    return Object.fromEntries(Object.entries(values).filter(([key, v]) => JSON.stringify(v) !== JSON.stringify(k.defaults[key])))
  }

  return {
    holds: (plugins: Plugins) => has(plugins, 'library.kit'),
    values: differing,
    panel(plugins: Plugins, show: Show, go: (kind: string, keys: Record<string, unknown>) => void) {
      const world = worldOf(plugins)
      const k: Kit | undefined = has(plugins, 'library.kit') ? json(plugins.wire, 'library.kit') : undefined
      const list: List | undefined = has(plugins, 'library') ? json(plugins.wire, 'library') : undefined

      show('pick label', () => Object.assign(document.createElement('label'), { textContent: list ? `kit item (${list.kinds.length})` : 'kit item' }))
      if (list) show('pick', () => {
        const select = document.createElement('select')
        if (!k) select.add(new Option('pick one…', ''))
        for (const { kind } of list.kinds) select.add(new Option(kind, kind))
        if (k) select.value = k.kind
        select.addEventListener('change', () => { if (select.value) go(select.value, {}) })
        return select
      })
      else show('no list', () => Object.assign(document.createElement('p'), { textContent: 'pro-ng\'s list is not written yet: the server writes it as it starts (yarn serve demo_library).' }))
      if (!k) return

      values ??= { ...k.defaults, ...k.values }
      show('about', () => Object.assign(document.createElement('p'), { textContent: k.about }))
      show('keys', () => Object.assign(document.createElement('h3'), { textContent: 'Keys' }))
      for (const key of Object.keys(k.defaults)) {
        const row = k.keys.find(r => r.keys.includes(key))
        show(`key ${key} label`, () => Object.assign(document.createElement('label'), { textContent: key }))
        const box = show(`key ${key}`, () => {
          const input = document.createElement('input')
          const v = values![key]
          if (typeof v === 'boolean') { input.type = 'checkbox'; input.checked = v }
          else if (typeof v === 'number') { input.type = 'number'; input.step = 'any'; input.value = String(v) }
          else input.value = typeof v === 'string' ? v : JSON.stringify(v)
          input.addEventListener('change', () => {
            const was = k.defaults[key]
            values![key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : typeof was === 'string' ? input.value : JSON.parse(input.value)
          })
          return input
        }) as HTMLInputElement
        boxes.set(key, box)
        box.classList.toggle('changed', JSON.stringify(values[key]) !== JSON.stringify(k.defaults[key]))
        if (row) show(`key ${key} type`, () => Object.assign(document.createElement('p'), { textContent: `${row.type}: ${row.does}` }))
      }
      show('build', () => {
        const b = Object.assign(document.createElement('button'), { textContent: 'build' })
        b.addEventListener('click', () => go(k.kind, differing(k)))
        return b
      })
      show('reset', () => {
        const b = Object.assign(document.createElement('button'), { textContent: `reset to ${k.kind}.studio.defaults.json` })
        b.addEventListener('click', () => {
          values = { ...k.defaults }
          for (const [key, input] of boxes) {
            const v = k.defaults[key]
            if (input.type === 'checkbox') input.checked = !!v
            else input.value = typeof v === 'string' ? v : JSON.stringify(v)
          }
        })
        return b
      })
      k.notes.forEach((n, i) => show(`note ${i}`, () => Object.assign(document.createElement('p'), { textContent: n })))
      if (k.effects) {
        show('effects title', () => Object.assign(document.createElement('h3'), { textContent: `Effects: ${k.kind}.effects.json` }))
        show('effects', () => {
          const host = document.createElement('div')
          const name = world.particle3d.effects
          const url = world.loader.assets[name].url
          // the kind's effects by their full names written into the game's effects file as this page's loader holds
          // it, which particle3d takes as a written file
          const write = (effects: Record<string, unknown[]>) => {
            const base = json(plugins.wire, name)
            written(url, JSON.stringify({ ...base, effects: { ...base.effects, ...effects } }))
            void plugins.loader.written(url)
          }
          const save = (file: Record<string, unknown>) => {
            const lib = plugins.wire.rows.find((r: Row) => r.kind === 'library')
            if (lib) plugins.wire.send(lib.id, 'build', 'effects', k.kind, JSON.stringify(file))
          }
          effectsEditor(host, k.kind, k.effects!, write, save)
          return host
        })
      }
    },
  }
}
