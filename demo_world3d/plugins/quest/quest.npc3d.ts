// quest's mod for npc3d (`addons/scenemanager`'s mods). A scene with `world.npc3d.mods: { behaviors: [..., 'quest'] }`
// has npc3d take its behaviour for a person the seat talks to (`quest.sim.ts`):
//   attend  never chosen: it is what the seat's `use` orders (npc3d's `order`, which writes `told`, where the seat's
//           feet stood). The person stops where it is on the first of `clips` it has among its row's own `clips`
//           (the clip it was on where it has none of them), and, where `face` is true, turns to face `told`. It
//           listens while some seat's `talk` is with it, and once none is, its task is over and it thinks again.
//           Give it `commit`, so npc3d does not score another key against it while it listens.
import { toward, type Behavior } from '#plugins/npc3d/npc3d.sim.ts'

export function behaviors(): Record<string, Behavior> {
  const attend: Behavior = {
    score: () => -Infinity,
    start(me, w, set, time, body) {
      const own = me.data.clips as string[]
      body.stand(me, w, time, (set.clips as string[]).find(c => own.includes(c)) ?? me.data.clip)
      const told = me.data.told as number[] | null
      if (set.face && told) {
        const at = body.where(me, time)
        body.face(me, time, toward(at[0], at[2], told[0], told[2]))
      }
      me.data.until = 0
    },
    tick(me, w, _set, time) {
      if (!w.all('player').some(p => p.data.talk?.id === me.id)) me.data.until = time
    },
  }
  return { attend }
}
