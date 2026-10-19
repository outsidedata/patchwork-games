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
import { boot, type Arg, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './farm2d.sim.ts'
import file from './farm2d.scene.json' with { type: 'json' }
import defs from './assets/farm2d.json' with { type: 'json' }

export const DT = file.prefabs.engine.dt

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
