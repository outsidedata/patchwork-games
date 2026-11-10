// The hills' playtester: a seat plays the v1 slice start to finish, once as each class of the classes file, through
// the acts a page sends (core issue #67). The game is booted as its page boots it with the hills its entry, a seat
// joined, and the seat driven by messages as a page's keys drive it, the bot reading what it sees off the hills' rows:
//   1. it picks the class;
//   2. it walks to the old woman, asks about the graves and takes "Restless Graves";
//   3. it fights the graves' packs, each mob its target, until the quest is done, it carries a grave ring, and it has
//      the gold the rest of the slice costs;
//   4. it hands the quest in;
//   5. at the smith it sells its grey junk, buys the iron bars (and a rusty sword, when it has none) the iron sword
//      takes, learns the recipe, and forges it at the anvil;
//   6. it holds the iron sword and has the priest bless it;
//   7. it walks into the barrow, wakes the Barrow King, and kills him.
// It walks as a player does: straight across open ground, and to a person or a place behind walls by the village's
// ways (nav3d's route over world3d's graph), cutting a corner it cannot round. Each step passes when what it makes is
// on the rows: the quest handed in, the sword forged, the enchant on it, the
// King's kill on the place's facts and his blade in the bag. A step that gets nowhere fails naming the step and where
// the seat stood. Dead, the seat gets up at the village and goes on. Every place and number is read off the game's
// files: the place file, the definitions, the classes, the vendor, crafting and enchanting files, the talk rules.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene, type W } from '#engine/engine.ts'
import { route } from '#plugins/nav3d/nav3d.sim.ts'
import { GRAPH } from '#plugins/world3d/world3d.sim.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_world3d.sim.ts'
import file from './demo_world3d.scene.json' with { type: 'json' }
import defs from './assets/hills/hills.json' with { type: 'json' }
import place from './assets/hills/hills.mmo3d.json' with { type: 'json' }
import crowd from './assets/hills/village-terrain3d.art.crowd.json' with { type: 'json' }
import gasFile from './assets/hills/hills.gas3d.json' with { type: 'json' }
import classesFile from './assets/hills/hills.classes.json' with { type: 'json' }
import vendorFile from './assets/hills/hills.vendor.json' with { type: 'json' }
import inventoryFile from './assets/hills/hills.inventory.json' with { type: 'json' }
import craftingFile from './assets/hills/hills.crafting.json' with { type: 'json' }
import enchantingFile from './assets/hills/hills.enchanting.json' with { type: 'json' }
import questsFile from './assets/hills/hills.quests.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
const SECOND = Math.round(1 / DT)
const COMPLETE = 1, INCOMPLETE = 3, REWARDED = 6

type Entry = { instance: { id: number; definition: string; enchant: { name: string } | null }; count: number }

// Where a placement or an `at` of the place file stands: [x, y, z] as it is, a landmark by the crowd file.
const landmarks = crowd.landmarks as Record<string, { at: number[] }>
const at = (a: number[] | string) => (typeof a === 'string' ? landmarks[a].at : a)

async function play(name: keyof typeof classesFile.classes) {
  const top = { ...file, prefabs: { ...file.prefabs, scenemanager: { ...file.prefabs.scenemanager, entry: 'hills' } } }
  const truth = boot(top as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('hills')!
  let last: Down | undefined
  const seat = connection(manager(truth), d => { last = d })
  truth.step(DT)
  let seq = 0
  const send = (action: string, ...args: Arg[]) => {
    const d = last!
    seat.take({ scene: d.scene, seat: d.seat, msg: { seq: ++seq, n: d.packet.n, id: possessed(d.packet.rows)!.id, action, args } })
  }
  const me = (): Row => room.rows.find(r => r.id === possessed(last!.packet.rows)!.id)!
  const step = () => truth.step(DT)
  const pos = () => me().data.pos as number[]
  const gap = (x: number, z: number) => Math.hypot(pos()[0] - x, pos()[2] - z)
  const facts = () => room.rows.find(r => r.kind === 'factsdb')!.data.factsdb as Record<string, number>
  const fact = (n: string) => (me().data.factsdb as Record<string, number>)[n] ?? 0
  const entries = () => me().data.inventory.entries as Entry[]
  const count = (item: string) => entries().filter(e => e.instance.definition === item).reduce((n, e) => n + e.count, 0)
  const health = () => me().data.gas.base.health as number
  const where = () => `at ${pos().map(v => v.toFixed(1)).join(', ')}`

  // Dead: up again at the village.
  const rise = () => {
    if (!me().data.dead) return false
    send('stick', 0, 0)
    for (let i = 0; i < 2 * SECOND; i++) step()
    send('release')
    for (let i = 0; i < SECOND; i++) step()
    return true
  }

  // The look turned toward a point, the stick held forward while it is further than `within`.
  const steer = (x: number, z: number) => {
    const [bx, , bz] = pos()
    send('look', Math.atan2(x - bx, z - bz) - me().data.look.yaw, 0)
  }

  // Walks to a point across the ground, steering every few steps; fails when it stops getting nearer.
  const walk = (what: string, x: number, z: number, within: number) => {
    send('fast', 1)
    let best = gap(x, z), since = 0
    for (let i = 0; gap(x, z) > within; i++) {
      if (rise()) { best = gap(x, z); since = i }
      if (i % 6 === 0) { steer(x, z); send('stick', 0, -1) }
      step()
      if (gap(x, z) < best - 0.5) { best = gap(x, z); since = i }
      if (i - since > 10 * SECOND) throw new Error(`${what}: stuck ${where()}, ${gap(x, z).toFixed(1)} m from ${x.toFixed(1)}, ${z.toFixed(1)}`)
    }
    send('stick', 0, 0)
    send('fast', 0)
    for (let i = 0; i < SECOND / 2; i++) step()
  }

  // Walks to within `within` of a point by the village's ways: nav3d's route over the place's graph (world3d's), each
  // place on it in turn, and the last stretch straight.
  const w = { world: room.world, find: (kind: string) => room.rows.find(r => r.kind === kind)!, all: (kind: string) => room.rows.filter(r => r.kind === kind) } as unknown as W
  const near = (what: string, x: number, z: number, within: number) => {
    if (gap(x, z) <= within) return
    const steps = route(w, GRAPH, pos(), [x, pos()[1], z])
    if (!steps) throw new Error(`${what}: no route from ${where()} to ${x.toFixed(1)}, ${z.toFixed(1)}`)
    for (const [i, s] of steps.entries()) {
      if (Math.hypot(s.at[0] - x, s.at[2] - z) < within) break
      try {
        walk(`${what}, way ${i + 1} of ${steps.length}`, s.at[0], s.at[2], 2.5)
      } catch { /* a corner cut: on to the next */ }
    }
    walk(what, x, z, within)
  }

  const klass = classesFile.classes[name]
  const abilities = klass.abilities.map(a => [a, (gasFile.abilities as Record<string, any>)[a]] as const)
  const melee = abilities.find(([, a]) => a.press === 'light')![1]
  const reach = melee.delivery.reach ?? melee.delivery.range * 0.6

  // Fights the nearest living row of the kinds until `done`, targeting it, closing to its reach and pressing the
  // class's light, heavy and special keys.
  const fight = (what: string, kinds: string[], done: () => boolean, most: number) => {
    let presses = 0
    for (let i = 0; i < most * SECOND && !done(); i++) {
      if (rise()) continue
      const foes = room.rows.filter(r => kinds.includes(r.kind) && !r.data.dead && r.data.gas)
      if (!foes.length) {
        if (i % SECOND === 0) send('stick', 0, 0)
        step()
        continue
      }
      const foe = foes.reduce((a, b) => (gap(b.data.pos[0], b.data.pos[2]) < gap(a.data.pos[0], a.data.pos[2]) ? b : a))
      const far = gap(foe.data.pos[0], foe.data.pos[2])
      if (i % 6 === 0) {
        steer(foe.data.pos[0], foe.data.pos[2])
        if (me().data.target !== foe.id) send('target')
        send('stick', 0, far > reach * 0.8 ? -1 : 0)
      }
      if (far <= reach && i % 12 === 0) {
        const key = ['light', 'light', 'heavy', 'light', 'special'][presses++ % 5]
        send('press', key)
      }
      step()
    }
    send('stick', 0, 0)
    if (!done()) {
      const d = me().data
      const time = room.rows.find(r => r.kind === 'npc3d')!.data.time
      const foes = room.rows.filter(r => kinds.includes(r.kind)).map(r => `${r.kind} ${r.id} ${r.data.dead ? 'dead' : 'alive'} ${r.data.gas?.base.health} ${gap(r.data.pos[0], r.data.pos[2]).toFixed(1)}m ${r.data.doing} until ${r.data.until} at ${time}`)
      const mm = room.rows.find(r => r.kind === 'mmo3d')!.data
      throw new Error(`${what}: not done after ${most} s, ${where()}; kills ${JSON.stringify(d.factsdb)}; gold ${count('gold')}, rings ${count('graveRing')}, needed ${needed()}; ${d.activity}.${d.motion} upper ${d.upperMotion} weapon ${d.weapon} casting ${d.casting}; foes ${foes.join('; ')}; mmo3d time ${mm.time} packs ${JSON.stringify(mm.packs)}`)
    }
  }

  // Talks to the row of the kind, choosing the choice of each concept in turn; a line that offers none of the
  // concept wanted is left and talked to again (the old woman sees to a hurt seat first).
  const talk = (kind: string, concepts: string[]) => {
    const [x, , z] = room.rows.find(r => r.kind === kind)!.data.pos
    near(`to the ${kind}`, x, z, defs.player.talk.reach * 0.6)
    for (let tries = 0; tries < 6; tries++) {
      if (me().data.talking === null) send('talk')
      step()
      let ok = true
      for (const c of concepts) {
        const t = me().data.talking
        const i = t ? t.choices.findIndex((o: { concept: string }) => o.concept === c) : -1
        if (i < 0) { ok = false; break }
        send('choose', i)
        step()
      }
      if (ok) return
      send('talk')
      step()
    }
    throw new Error(`talking to the ${kind}: never offered ${concepts.join(', ')}`)
  }

  // 1. the class
  send('pickClass', name)
  for (let i = 0; i < SECOND; i++) step()
  expect(me().data.class).toBe(name)
  // the class's stance drawn: pressed again while a blow keeps it from coming up
  for (let i = 0; i < 20 * SECOND && me().data.upperMotion !== klass.weapons[0]; i++) {
    const up = me().data.upperMotion
    if (i % SECOND === 0 && me().data.queued === null && !(typeof up === 'string' && up.startsWith('draw'))) send('press', 'draw')
    step()
  }
  expect(me().data.upperMotion).toBe(klass.weapons[0])

  // 2. the quest taken
  talk('old_woman', ['graves', 'takeGraves'])
  expect(fact('quest.graves')).toBe(INCOMPLETE)

  // 3. the graves cleared, with the gold and the ring the rest costs
  const recipe = craftingFile.recipes.ironSword
  const price = (item: string) => (inventoryFile.items as Record<string, any>)[item].fragments.price
  const enchant = enchantingFile.enchants.blessedEdge
  const learn = craftingFile.trainers.smith.find(t => t.recipe === 'ironSword')!.cost
  const needed = () => {
    const bars = Math.max(0, recipe.reagents.find(g => g.item === 'ironBar')!.count - count('ironBar'))
    const sword = count('rustySword') > 0 ? 0 : price('rustySword').buy
    return learn + bars * price('ironBar').buy + sword + enchant.gold
  }
  const graves = place.spawns.map(s => s.kind)
  const quest = questsFile.quests.graves
  walk('to the graves', place.spawns[0].at[0], place.spawns[0].at[2], 6)
  fight('clearing the graves', graves, () => fact('quest.graves') === COMPLETE && count('graveRing') >= 1 && count('gold') >= needed(), 1800)
  expect(fact(`quest.graves.kill.${quest.kills[0].kind}`)).toBeGreaterThanOrEqual(quest.kills[0].count)

  // 4. handed in
  const gold = count('gold')
  talk('old_woman', ['handGraves'])
  expect(fact('quest.graves')).toBe(REWARDED)
  expect(count('gold')).toBe(gold + quest.gold)
  expect(facts()['graves.cleared']).toBe(1)

  // 5. the smith: junk sold, bars (and a sword) bought, the recipe learned, the sword forged at the anvil
  talk('smith', ['smithShop'])
  for (const e of entries().filter(e => (inventoryFile.items as Record<string, any>)[e.instance.definition].fragments.quality?.grade === 'grey' && e.instance.definition !== 'graveRing')) {
    send('sell', e.instance.id)
    step()
  }
  const sold = vendorFile.vendors.smith
  const bars = recipe.reagents.find(g => g.item === 'ironBar')!.count - count('ironBar')
  if (bars > 0) send('buy', sold.findIndex(s => s.item === 'ironBar'), bars)
  step()
  if (count('rustySword') === 0) send('buy', sold.findIndex(s => s.item === 'rustySword'), 1)
  step()
  expect(count('ironBar')).toBeGreaterThanOrEqual(recipe.reagents.find(g => g.item === 'ironBar')!.count)
  expect(count('rustySword')).toBeGreaterThanOrEqual(1)
  send('leave')
  talk('smith', ['smithTrain'])
  send('learn', 'ironSword')
  step()
  expect(fact('recipe.ironSword')).toBe(1)
  send('leave')
  // the rusty sword off the bar, so it may go into the forge
  const bar = me().data.quickbar.slots as (number | null)[]
  const rusty = entries().find(e => e.instance.definition === 'rustySword')!.instance.id
  if (bar.includes(rusty)) send('unslot', bar.indexOf(rusty))
  step()
  const anvil = at(recipe.focus.at)
  near('to the anvil', anvil[0], anvil[2], recipe.focus.reach * 0.9)
  send('craft', 'ironSword')
  step()
  expect(count(recipe.creates.item)).toBe(recipe.creates.count)

  // 6. the iron sword held and blessed
  const sword = entries().find(e => e.instance.definition === 'ironSword')!.instance.id
  const slots = me().data.quickbar.slots as (number | null)[]
  if (slots[0] !== null) send('unslot', 0)
  step()
  send('slot', 0, sword)
  step()
  send('hold', 0)
  step()
  talk('priest', ['priestBless'])
  send('enchant', 'blessedEdge', sword)
  step()
  send('leave')
  expect(entries().find(e => e.instance.id === sword)!.instance.enchant?.name).toBe('blessedEdge')

  // 7. the Barrow King woken and killed
  const zone = place.zones.find(z => z.name === 'barrow')!
  near('into the barrow', zone.at[0] as number, zone.at[2] as number, zone.radius * 0.5)
  for (let i = 0; i < SECOND && !room.rows.some(r => r.kind === 'barrow_king'); i++) step()
  expect(room.rows.some(r => r.kind === 'barrow_king')).toBe(true)
  fight('the Barrow King', ['barrow_king', 'zombie'], () => (facts()['killed.barrow_king'] ?? 0) >= 1, 600)
  expect(count('barrowBlade')).toBe(1)
  expect(facts()['barrow.woken']).toBe(2)
}

test('the playtester plays the hills as a fighter, from the class to the Barrow King', { timeout: 60 * 60 * 1000 }, async () => {
  await play('fighter')
})

test('the playtester plays the hills as a wizard, from the class to the Barrow King', { timeout: 60 * 60 * 1000 }, async () => {
  await play('wizard')
})
