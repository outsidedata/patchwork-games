// laser's mod for guns3d (`addons/scenemanager`'s mods), the server's and the page's. Named in
// `world.guns3d.mods.behaviors`, `behaviors()` delivers the words of a gun that throws a beam of light:
//   cell   feed: `{ size, fire, reload, count }`: a power cell of `size` pulses. The holder's gun carries `charge`, the
//          pulses left; it comes to the hand full. A pulse is ready while the charge is above 0; taking one takes 1
//          off it, and it fires with the move `fire`. Reloading plays `reload` while the cell is not full, none while
//          it is; at the act's `done` the cell is full. It shows no clip of the gun's (`shown` is none), and `count`
//          is the charge.
//   beam   look: `{ color, core, width, coreWidth, end, gain, fade, flicker }`: the beam drawn every frame from the
//          gun's `muzzle` point to where its last pulse's line ends (the ledger's `to`), while the trigger is held
//          and that pulse is no older than `fade` seconds, so a held trigger firing pulses closer together than
//          `fade` draws one beam that never goes out, and letting go puts it out that frame. `color` is the glow's
//          colour and `core` the hot middle's, as CSS colours; `width` is the glow's width across and `coreWidth`
//          the core's, metres; `end` is the size of the glow where the beam lands and at the muzzle, metres; `gain`
//          is how far over white it shines, for the bloom; `flicker` is how much its brightness shivers, 0 for none.
//          It draws through the laser plugin's browser half (`laser.plugin.ts`), which this scene lists in
//          `world.shipped.plugins`; with it not there it throws, naming the gun.
// The pulse itself is the gun's flight word's, a line met at once (`hitscan`, its `speed` the speed of light), and
// where it lands the gun's `impact` look word throws what it throws.
import type { Behavior, Ctx, Fired, Read } from '#plugins/guns3d/guns3d.sim.ts'
import type { Drawn, Look } from '#plugins/guns3d/guns3d.plugin.ts'
import type { Laser } from './laser.plugin.ts'

const cell: Behavior = {
  fill(c: Ctx) {
    c.me.data.gun = { ...c.me.data.gun, charge: c.numbers.size }
  },
  ready: (c: Ctx) => c.gun.charge > 0,
  take(c: Ctx) {
    c.me.data.gun = { ...c.me.data.gun, charge: c.me.data.gun.charge - 1 }
    return c.numbers.fire
  },
  reload: (c: Ctx) => (c.gun.charge >= c.numbers.size ? undefined : c.numbers.reload),
  loaded(c: Ctx, role: string) {
    if (role === c.numbers.reload) c.me.data.gun = { ...c.me.data.gun, charge: c.numbers.size }
  },
  shown: () => [],
  count: (r: Read) => r.gun.charge,
}

const beam: Look = {
  frame(l: Drawn) {
    const laser = l.plugins.laser as Laser | undefined
    if (!laser) throw new Error(`laser: the gun ${l.name}'s beam is drawn by the laser plugin, which world.shipped.plugins does not list`)
    const fired = l.gun.fired as Fired[]
    const last = fired[fired.length - 1]
    if (!l.gun.held || !last || last.age > l.numbers.fade) return
    const m = l.point('muzzle')
    m.updateWorldMatrix(true, false)
    const from = new l.THREE.Vector3().setFromMatrixPosition(m.matrixWorld).toArray()
    laser.draw(l.row.id, from, last.to, l.numbers)
  },
}

export const behaviors = () => ({ cell, beam })
