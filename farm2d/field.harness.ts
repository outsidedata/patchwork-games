// The field booted for a test as the server boots it: the manager, every scene loaded, and seats that
// come in as a page's do, each a connection entering the title and sent to the field by the title's own
// `go`, the role it chose as its args, so its `player` row takes the role through `arrive`. Not a test
// itself; the tests beside it use it.
//
//   farm()               the truth, the field's truth `room`, `steps(k)`, `all(kind)` and `one(kind)`,
//                        and `join`.
//   join(role)           a seat: `me()`, its `player` row in the field; `held()`, the row it plays, or
//                        undefined; `send(action, ...args)`, a message at its own `player` row, numbered
//                        from 1 each visit as a client numbers them; `at(id, action, ...args)`, one at
//                        any row; `last()`, the last thing it was sent; `leave()`, its connection
//                        closed. The seat is on the field and has played the step it arrived on.
//   page(role)           a page as `index.html` makes one, with no canvas, its seat in through the
//                        title's button for `role` and on the field, and the field stilled: every brain
//                        stood for good, the swarm sending no more bugs, nothing lying in it, no crop in
//                        the plot, every patch of grass bare and growing no more, and nothing on the
//                        pile. `room`, the field's truth; `kind(k)`, its rows of a kind; `thing`, the
//                        row the seat plays; `frames(n)`, the truth stepped and the page framed n times;
//                        `plugins()`, the page's; and `emitted`, every effect a look emitted on this page
//                        (particle2d's `emit`, not the ledger's), in order: its `effect`, its `at` as
//                        emitted, its `spawn`, and `fx`, what `emit` handed back, whose `at` a look moves
//                        and whose `life` it ends at its `age`. Node decodes the pictures the wad holds
//                        and no other, so the caller stands in for PixiJS's `Assets.load`.
import * as PIXI from 'pixi.js'
import { boot, type Arg, type Row, type Scene } from '#engine/engine.ts'
import { accept, connection, link, load, manager, view, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './farm2d.sim.ts'
import file from './farm2d.scene.json' with { type: 'json' }
import defs from './assets/farm2d.json' with { type: 'json' }

export const DT = file.prefabs.engine.dt

export type Emitted = { effect: string; at: number[]; spawn: Record<string, unknown>; fx: { at: number[]; life: number; age: number } }

const moment = () => new Promise(done => setTimeout(done, 5))

export async function page(role: 'farmer' | 'cow' | 'chicken') {
  PIXI.DOMAdapter.set({ ...PIXI.DOMAdapter.get(), createCanvas: () => ({ getContext: () => null }) as any })
  const emitted: Emitted[] = []
  const top = boot(structuredClone(file) as Scene, sim)
  const truths = await load(top, new URL('./', import.meta.url).href)
  const tab = view(link(loopback(accept(manager(top)))), structuredClone(file) as Scene, new URL('./', import.meta.url).href, me => {
    me.plugins.ui.canvas = { style: {}, addEventListener() {}, removeEventListener() {}, remove() {} }
    // The title's page draws no particles; the field's does.
    const p = me.plugins.particle2d
    if (!p) return
    const real = p.emit
    p.emit = (effect: string, at: number[], spawn: Record<string, unknown> = {}) => {
      const fx = real(effect, at, spawn)
      emitted.push({ effect, at: [...at], spawn, fx })
      return fx
    }
  })
  const frames = async (n = 1) => { for (let i = 0; i < n; i++) { top.step(DT); await tab.frame(); await moment() } }
  const plugins = () => tab.client!.plugins
  const button = () => tab.client && plugins().ui.panel('title').getChildByLabel(`role-${role}`)
  for (let i = 0; i < 400 && !button(); i++) await frames(1)
  button()!.emit('pointertap', {} as any)
  for (let i = 0; i < 400 && !(tab.name === 'field' && plugins().particle2d.has(defs.player.air.effect) && possessed(plugins().wire.rows)?.data.held); i++) await frames(1)
  const room = truths.get('field')!
  const kind = (k: string) => room.rows.filter(r => r.kind === k)
  const seat = possessed(plugins().wire.rows)!
  const thing = room.rows.find(r => r.id === seat.data.held.id && r.kind === seat.data.held.kind)!
  for (const k of ['manure', 'produce', 'crop', 'bug']) for (const r of kind(k)) room.end(r)
  kind('swarm')[0].data.next = 1e9
  kind('pile')[0].data.items = []
  for (const r of [...kind('farmer'), ...kind('cow'), ...kind('chicken')]) {
    r.data.move = [0, 0]
    r.data.wait = 1e9
    r.data.to = null
    r.data.goal = 0
    if (r.kind === 'cow') r.data.chew = 0
    if (r.kind === 'chicken') r.data.peck = 0
  }
  for (const g of kind('grass')) { g.data.frame = 0; g.data.grow = -1e9; g.data.grown = false }
  await frames(2)
  return { tab, room, kind, thing, frames, plugins, emitted }
}

export async function farm() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const rooms = await load(truth, new URL('./', import.meta.url).href)
  const room = rooms.get('field')!
  const title = rooms.get('title')!
  const steps = (k = 1) => { for (let i = 0; i < k; i++) truth.step(DT) }
  const all = (kind: string) => room.rows.filter(r => r.kind === kind)
  const one = (kind: string) => all(kind)[0]

  async function join(role: unknown) {
    const heard: Down[] = []
    const seat = connection(manager(truth), d => heard.push(d))
    steps(1)
    const last = () => heard[heard.length - 1]
    let seq = 0, visit = ''
    const at = (id: number, action: string, ...args: Arg[]) => {
      const now = last()
      if (`${now.scene}/${now.seat}` !== visit) [seq, visit] = [0, `${now.scene}/${now.seat}`]
      seat.take({ scene: now.scene, seat: now.seat, msg: { seq: ++seq, n: now.packet.n, id, action, args } })
    }
    at(title.rows.find(r => r.kind === 'scenemanager')!.id, 'go', defs.titlecard.to, role as Arg)
    steps(2)
    const mine = last().scene === 'field' ? possessed(last().packet.rows) : undefined
    const me = () => room.rows.find(r => r.id === mine?.id)
    const held = (): Row | undefined => {
      const h = me()?.data.held
      return h ? room.rows.find(r => r.id === h.id && r.kind === h.kind) : undefined
    }
    const send = (action: string, ...args: Arg[]) => at(mine!.id, action, ...args)
    return { me, held, send, at, last, leave: () => seat.close() }
  }

  return { truth, room, rooms, steps, all, one, join }
}
