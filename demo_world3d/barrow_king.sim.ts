// The Barrow King: mmo3d's `mob` (`plugins/mmo3d/mmo3d.sim.ts`), an npc3d NPC that hunts on gas3d, with his
// definition's SmartAI script stepped after it each step (`plugins/smartai/smartai.sim.ts`): his phases, his timed
// casts, his summons and his lines. mmo3d's place file places him once the barrow is entered.
import type { Kind } from '#engine/engine.ts'
import { mob } from './plugins/mmo3d/mmo3d.sim.ts'
import { step } from './plugins/smartai/smartai.sim.ts'

export const barrow_king: Kind = {
  tick(me, dt, w) {
    mob.tick!(me, dt, w)
    step(w, me, dt)
  },
  acts: mob.acts,
}
