// The hills' `player` rule (`hills.sim.ts` gives it as the `player` kind's), copied from demo_motion3d's
// `player.sim.ts`: the body an X Bot (`as: "xbot"`) moved by kinematics3d (`world.kinematics3d.kinds.xbot`) and
// played and drawn by motion3d (`world.motion3d.kinds.xbot`), every move it makes the X Bot's motion3d file's
// (`assets/xbot.motion3d.json`). Every seat is sent every `player` row. Its own fields, beside kinematics3d's and
// motion3d's: `stick` [x, z], the keys' way, right and forward; `fast`, the run key held; `guard`, the guard key
// held; `look` `{ yaw, pitch, dist }`, chasecamera3d's orbit about it, `lift` metres over its feet; `turning`
// [x, y], how far a gamepad's right stick is pushed right and down; `aim`, the way the camera looks, which
// motion3d points a carried prop along while an aim is up; `weapon`, the stance the draw key draws, one of the
// definition's `weapons`; `queued`, the key pressed and not yet played, `{ key, age }`, or null; and `stood`,
// once it stands on its slot's start.
//
// Facing. With an aim up (the upper half playing one of the definition's `aimOf`, each weapon's aim by its name)
// the legs keep the way they face and strafe, turned only when the look is more than its rig's `aim.across`
// (radians) to either side of them; the aim's pitch is held within the rig's `aim.up` and `aim.down`. With the
// guard key held the body faces the way the camera looks and strafes, its stance's guard moves (`guard`, the
// hero's state). Else it turns the way it goes.
//
// The input buffer. A key pressed is held (`queued`) and handed to motion3d's `press` each step until a move
// plays it, for at most the definition's `buffer.hold` seconds of steps it was free to play in, a newer key
// taking its place. While the body plays a one-shot pressed with a key (an attack, a roll), a key is held back,
// its seconds not counted, until the one-shot has played the share of itself `buffer.cancel` gives for that key
// after the one playing; and while the upper half plays a one-shot (a draw, a putting away, a shot), a key no
// move will play yet is held, its seconds not counted, until it has played out:
// `cancel[<key playing>][<key pressed>]`, else `cancel[<key playing>]["*"]`, else `cancel["*"]["*"]`.
// The guard key is held, not pressed: each step it is held `guard` is pressed and each step it is not,
// `unguard`, so a block or an aim comes up whenever it may and goes down when it is let go.
//
// The draw key draws `weapon` (`draw.<weapon>` to motion3d), and puts it away while it is drawn. The switch
// key, with no weapon in the hands nor one being drawn or put away, makes the next of `weapons` the one the
// draw key draws; else it is pressed to motion3d and `weapon` follows. Whichever weapon's stance is up is
// `weapon`.
//
// Abilities. What the body can do is gas3d's (`plugins/gas3d/gas3d.sim.ts`): its row's `gas` holds its attributes
// and the effects on it, started on its first step from the definition's `attributes` with its `effects` on (its
// mana regeneration), and stepped each step. The definition's `abilities` names the abilities of gas3d's file it
// has, each played by its `press` key: a key pressed that is one of them starts it only when gas3d says it may (no
// cooldown on, enough of what it costs), and once its move plays, its cost is paid, its cooldown put on, and it is
// the one the row is `casting`; one gas3d refuses is dropped.
//
// Blows. A move of the X Bot's `fight` activity lands its blow on the step its clip's playhead passes the moment its
// blow lands: the frame on which the fastest of its hands and feet moves furthest, read off the rig's measured
// `ends` (the punch's fist, the kick's foot). Then the ability it is `casting` is delivered: by `reach`, the
// nearest living mob within that many metres in front of the body is struck (hitscan3d's `strike`, its `hit` act,
// `mob.sim.ts`, handed a `Struck` naming the ability); by `bolt`, a volley3d round of that pattern is fired from
// `cast.ahead` metres in front of the body and `cast.up` over its feet, at the row's target, or else the nearest
// living mob in front, within the ability's `range`, `cast.aimUp` over its feet, its hurt naming the ability, so
// the mob it meets is struck the same way. `casts` on the row counts the rounds it has fired, which names each.
//
// Targeting. What the hero can hit is what hitscan3d can hit (`world.hitscan3d.kinds`, a dead one off), but itself:
// every mob, whatever its kind. `target` is the id of the one the seat has picked, or null. The target key cycles it
// through those within the definition's `target.range` metres, nearest first. A bolt flies at it while it lives and
// is within the ability's range.
//
// Being struck. Its `hit` act takes a hitscan3d `Struck` naming the ability that struck it (a mob's bite): gas3d puts
// that ability's effects on it, and while it lives it plays motion3d's `hit`. The step its health reaches 0, by a
// strike or an effect, it is `dead`: it plays motion3d's `die`, its keys and stick do nothing, and nothing targets
// it. Only rules strike it; a seat's `hit` changes nothing.
//
// `before` stands it once on the ground at its slot's start: on the place whose data says `start` in the nav3d
// graph the start's `graph` names (`player.sim.ts`'s `root`), else at the start's `pos`; facing the start's
// `yaw`, its look along it. Each step its look turns while `turning` is held, at the definition's `camera.turn`
// across and `tilt` up and down a second at full push, within `minPitch` and `maxPitch`. The stick is its want:
// kinematics3d's `want`, the way the stick points from the camera's yaw, as hard as it is pushed (the clip it
// plays says how fast); and motion3d's `drive`, which moves and plays the body by it.
//
// Talking is talk's (`plugins/talk/talk.sim.ts`), its row's `talking`. `talk()` starts talking to the nearest one
// within the definition's `talk.reach` metres who has something to say, or ends the talk it is in; `choose(i)` picks
// the choice `i` of what was said. The talk ends once it walks out of reach, or dies. Its quests are quests'
// (`plugins/quests/quests.sim.ts`), stepped each step so each is done once its objectives are met.
//
// Trading. A talk that opens a service (talk's `vendor`, `trainer` and `enchanter` actions) leaves its row's
// `serving`; while it is within reach of that speaker, `buy(i, count)` buys `count` of the vendor's i-th item,
// `sell(id)` sells a carried instance that is neither equipped nor on the quick bar, and `buyBack(i)` buys the i-th
// of its buyback back (`plugins/vendor`); `learn(recipe)` learns one of the trainer's recipes (`plugins/crafting`);
// `enchant(enchant, id)` has the enchanter put an enchant on a carried instance (`plugins/enchanting`). `craft(recipe)`
// makes a known recipe within reach of its focus, served by no one; `leave()` closes the service.
//
// Death. Dead, `release()` raises it at its slot's start, as World of Warcraft's spirit healer raises a player at
// the graveyard: it is stood there again, and the definition's `release.effect`, a gas3d effect, put on it (its
// health back to a share of its most).
//
// Carrying, after Lyra's inventory, equipment and quick bar (`plugins/inventory`, `plugins/equipment`,
// `plugins/quickbar`): its row's `inventory`, `equipment` and `quickbar`, the quick bar as many slots
// long as the `player` prefab gives. `slot(slot, id)` puts a carried instance in an empty slot of the bar and `unslot(slot)`
// empties one; `hold(slot)` makes a slot the one in the hands, its item equipped (-1 holds nothing). What is worn,
// not held, is equipped straight: `wear(id)` equips a carried instance with an `equippable` fragment that is neither
// on the bar nor equipped, and `takeOff(id)` takes it off. `drop(id)` throws an instance away, taken off the bar and
// unequipped first. Only rules add to its inventory. The abilities it has are its definition's `abilities` and those
// its equipment's ability sets grant (gas3d's `granted`).
//
// The acts are the page's keys:`stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right stick, the
// same), `fast(v)` and `guard(v)` (1 held, 0 let go), `press(key)`, a key pressed, buffered as above; `target()`,
// the next target; `look(dyaw, dpitch)` and `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the program,
// so each refuses arguments of the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { activityOf, drive, motionOf, press } from '#plugins/motion3d/motion3d.sim.ts'
import { clipOf, playKind, rigOf } from '#plugins/motion3d/motion3d.play.ts'
import { nearest, relative } from '#plugins/kinematics3d/kinematics3d.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { fire } from '#plugins/volley3d/volley3d.sim.ts'
import { hittable, strike, type Struck } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { fragment, instanceOf, removeInstance, type Instance } from '../inventory/inventory.sim.ts'
import { equip, equippedFrom, unequip } from '../equipment/equipment.sim.ts'
import { addToSlot, removeFromSlot, setActive } from '../quickbar/quickbar.sim.ts'
import { choose, end, serving, start, step as talking, type Serving } from '../talk/talk.sim.ts'
import { buy, buyBack, sell } from '../vendor/vendor.sim.ts'
import { craft, learn } from '../crafting/crafting.sim.ts'
import { enchant } from '../enchanting/enchanting.sim.ts'
import { step as quests } from '../quests/quests.sim.ts'
import { abilityOf, apply, blowAt, granted, blocked, commit, receive, start as gas, step, value } from '../gas3d/gas3d.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1

// The instance a seat named, when the row carries it.
const carried = (me: Row, id: unknown): Instance | undefined => (Number.isInteger(id) ? instanceOf(me, id as number) : undefined)
const isSlot = (me: Row, slot: unknown) => Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < me.data.quickbar.slots.length
const onBar = (me: Row, id: number) => me.data.quickbar.slots.includes(id)
// The speaker serving that service, while the hero lives and is within talk's reach of it.
const served = (me: Row, w: W, what: Serving['what']): Row | undefined =>
  me.data.dead ? undefined : serving(w, me, what, def(w, me.kind).talk.reach)

type Buffer ={ hold: number; cancel: Record<string, Record<string, number>> }

// The view turns while the right stick is held, whatever the body does.
function view(me: Row, dt: number, k: any) {
  const d = me.data
  if (d.turning[0] === 0 && d.turning[1] === 0) return
  const c = k.camera
  d.look = { ...d.look, yaw: wrap(d.look.yaw - d.turning[0] * c.turn * dt), pitch: clamp(d.look.pitch + d.turning[1] * c.tilt * dt, c.minPitch, c.maxPitch) }
}

// The body stood once on the ground at its slot's start, facing the start's yaw, its look along it: at the place
// whose data says `start` in the graph the start names, else at the start's `pos`.
function stood(me: Row, w: W) {
  const d = me.data
  const start = w.find('start', s => s.data.slot === d.seat).data
  const at: number[] = start.graph ? graph(w, start.graph).places.find(p => p.data?.start === true)!.point.at : start.pos
  // The triangles beneath feet set at the start's height, then stood on them.
  d.pos = nearest(w, { triangles: {} }, [at[0], at[1], at[2]], me)
  d.yaw = start.yaw
  d.look = { ...d.look, yaw: start.yaw }
  d.stood = true
}

// The share of itself the one-shot the body plays must have played before `key` may follow it: none while the
// body plays no one-shot that a key pressed (Buffer, the header).
function lockedUntil(me: Row, w: W, buffer: Buffer, key: string): number {
  const d = me.data
  const m = motionOf(activityOf(w, me, d.activity), d.motion)
  if (!m?.press || d.state !== 'act' || clipOf(rigOf(w, playKind(me)), d.clip).loop) return 0
  const c = buffer.cancel
  return c[m.press]?.[key] ?? c[m.press]?.['*'] ?? c['*']['*']
}

// The key held in the buffer handed to motion3d, once it may follow what plays; dropped once played or held
// past `hold` seconds.
function buffered(me: Row, w: W, dt: number, k: any) {
  const d = me.data
  const q = d.queued
  if (!q) return
  const until = lockedUntil(me, w, k.buffer, q.key)
  const share = until > 0 ? d.clipT / clipOf(rigOf(w, playKind(me)), d.clip).dur : 1
  if (share < until) return
  if (act(me, w, q.key, k)) {
    d.queued = null
    return
  }
  if (upperBusy(me, w)) return
  d.queued = q.age + dt > k.buffer.hold ? null : { key: q.key, age: q.age + dt }
}

// Whether the upper half plays a one-shot of its own (a draw, a putting away, a shot), which holds the buffer
// as a body's one-shot does.
function upperBusy(me: Row, w: W): boolean {
  const d = me.data
  const m = d.upperActivity === null ? undefined : motionOf(activityOf(w, me, d.upperActivity), d.upperMotion)
  return !!m?.clips.length && typeof d.upper === 'string' && !clipOf(rigOf(w, playKind(me)), d.upper).loop
}

// A key played: the draw key draws or puts away `weapon`; the switch key with nothing drawn picks the next
// weapon; any other key is motion3d's. Whether it played.
function act(me: Row, w: W, key: string, k: any): boolean {
  const d = me.data
  const dealt = ability(me, w, key, k)
  if (dealt !== undefined) return dealt
  const weapons: string[] = k.weapons
  const next = weapons[(weapons.indexOf(d.weapon) + 1) % weapons.length]
  if (key === 'draw') return press(me, w, `draw.${d.weapon}`, d.stick)
  if (key !== 'switch') return press(me, w, key, d.stick)
  // No weapon in the hands, nor one being drawn or put away (the upper half's move carries none).
  const up = d.upperActivity === null ? undefined : motionOf(activityOf(w, me, d.upperActivity), d.upperMotion)
  if (!weapons.includes(up?.carry ?? '')) {
    d.weapon = next
    return true
  }
  // A weapon being drawn or put away: held until its stance is up, and switched from there.
  if (!press(me, w, 'switch', d.stick)) return false
  d.weapon = next
  return true
}

// The weapon whose stance is up, its own or its aim's: `weapons[i]` is aimed by `aims` where one names it
// (`aimOf`); none while no stance is up.
function stanceOf(me: Row, k: any): string | undefined {
  const u = me.data.upperMotion
  if (k.weapons.includes(u)) return u
  return Object.entries(k.aimOf as Record<string, string>).find(([, aim]) => aim === u)?.[0]
}

// Every body the hero can hit now: hitscan3d's (`world.hitscan3d.kinds`, the dead ones off), but itself.
const targets = (me: Row, w: W): Row[] => hittable(w).filter(b => b.id !== me.id).map(b => w.get(b.id))

// The living body nearest the hero within `far` metres and in front of it, or undefined.
function nearestAhead(me: Row, w: W, far: number): Row | undefined {
  const d = me.data
  const ahead = [math.sin(d.yaw), math.cos(d.yaw)]
  let near: Row | undefined, best = far
  for (const z of targets(me, w)) {
    const dx = z.data.pos[0] - d.pos[0], dz = z.data.pos[2] - d.pos[2]
    const gap = math.hypot(dx, dz)
    if (gap > best || dx * ahead[0] + dz * ahead[1] <= 0) continue
    near = z
    best = gap
  }
  return near
}

// The row's target while it is a living body within `range` metres, or undefined.
function targetOf(me: Row, w: W, range: number): Row | undefined {
  const d = me.data
  if (d.target === null) return undefined
  const t = targets(me, w).find(z => z.id === d.target)
  if (!t) return undefined
  return math.hypot(t.data.pos[0] - d.pos[0], t.data.pos[2] - d.pos[2]) <= range ? t : undefined
}

// The blow (Blows, the header): on the step a move of the `fight` activity carries its clip's playhead past the
// moment its blow lands, the ability the body is `casting` is delivered.
function blow(me: Row, w: W, k: any, was: { clip: unknown; t: number }) {
  const d = me.data
  if (d.activity !== 'fight' || d.state !== 'act' || typeof d.clip !== 'string') {
    d.casting = null
    return
  }
  if (d.casting === null) return
  const peak = blowAt(rigOf(w, playKind(me)), playKind(me), clipOf(rigOf(w, playKind(me)), d.clip).source)
  const from = was.clip === d.clip ? was.t : 0
  if (!(from < peak && d.clipT >= peak)) return
  const name: string = d.casting
  d.casting = null
  const ability = abilityOf(w, name)
  const ahead = [math.sin(d.yaw), math.cos(d.yaw)]
  const delivery = ability.delivery
  if ('reach' in delivery) {
    const near = nearestAhead(me, w, delivery.reach)
    if (near) strike(w, near, { damage: 0, by: me.id, ability: name, part: null, point: [...near.data.pos], dir: [ahead[0], 0, ahead[1]], what: 'body' })
    return
  }
  // A bolt flies from in front of the chest at the target's middle, or the nearest mob's in front.
  const target = targetOf(me, w, delivery.range) ?? nearestAhead(me, w, delivery.range)
  if (!target) return
  const c = k.cast
  const at = [d.pos[0] + ahead[0] * c.ahead, d.pos[1] + c.up, d.pos[2] + ahead[1] * c.ahead]
  const to = [target.data.pos[0], target.data.pos[1] + c.aimUp, target.data.pos[2]]
  fire(w, delivery.bolt, at, [to[0] - at[0], to[1] - at[1], to[2] - at[2]], { from: me.id, n: d.casts++, skip: [me.id], hurt: { damage: 0, by: me.id, ability: name } })
}

// The step its health reaches 0, by a strike or an effect on it: `dead`, and its death played (motion3d's `die`).
function dies(me: Row, w: W) {
  const d = me.data
  if (d.dead || value(w, me, 'health') > 0) return
  d.dead = true
  d.casting = null
  d.queued = null
  press(me, w, 'die', [0, 0])
}

// A key that is the press of one of the definition's `abilities`: whether it was dealt with. One gas3d says may not
// start is dropped; one that may is pressed to motion3d, and once its move plays, its cost and cooldown are paid
// and it is the one the body is `casting`.
function ability(me: Row, w: W, key: string, k: any): boolean | undefined {
  const name = [...(k.abilities as string[]), ...granted(me)].find(a => abilityOf(w, a).press === key)
  if (name === undefined) return undefined
  if (blocked(w, me, name) !== undefined) return true
  if (!press(me, w, key, me.data.stick)) return false
  commit(w, me, name)
  me.data.casting = name
  return true
}

export const hero: Kind = {
  before(me, _dt, w) {
    if (me.data.stood) return
    stood(me, w)
    const k = def(w, me.kind)
    gas(w, me, k.attributes, k.effects)
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    step(w, me, dt)
    view(me, dt, k)
    dies(me, w)
    quests(w, me)
    if (d.dead) end(me)
    else talking(w, me, k.talk.reach)
    // Dead, it plays out its death and is driven by nothing.
    if (d.dead) {
      d.want = [0, 0]
      drive(me, w, dt, [0, 0])
      return
    }
    const [wx, wz] = relative(d.stick, d.look.yaw)
    // With an aim up the legs keep the way they face, and strafe, turned only as far as keeps the aim within the
    // rig's `aim.across` of them; with the guard held they face the look; else they turn the way they go.
    const limits = rigOf(w, playKind(me)).aim
    if (!limits) throw new Error(`hero: the rig of ${playKind(me)} gives no aim limits`)
    const across = wrap(d.look.yaw - d.yaw)
    const aiming = Object.values(k.aimOf).includes(d.upperMotion)
    d.weapon = stanceOf(me, k) ?? d.weapon
    d.face = aiming ? (Math.abs(across) > limits.across ? wrap(d.look.yaw - Math.sign(across) * limits.across) : d.yaw) : d.guard ? d.look.yaw : null
    d.want = [wx, wz]
    // Aimed the way the camera looks: along its yaw, and down by its pitch within the rig's `aim.up` and `aim.down`.
    const up = clamp(-d.look.pitch, -limits.down, limits.up)
    d.aim = [math.sin(d.look.yaw) * math.cos(up), math.sin(up), math.cos(d.look.yaw) * math.cos(up)]
    // The guard held raises a block or an aim whenever one may come up, and let go lowers it.
    press(me, w, d.guard ? 'guard' : 'unguard', d.stick)
    buffered(me, w, dt, k)
    const was = { clip: d.clip, t: d.clipT }
    drive(me, w, dt, d.stick)
    blow(me, w, k, was)
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    turn(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.turning = [x, y]
    },
    fast(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.fast = v === 1
    },
    guard(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.guard = v === 1
    },
    press(me, _w, _seat, key: unknown) {
      const d = me.data
      if (typeof key !== 'string' || !d.stood) return
      d.queued = { key, age: 0 }
    },
    // Struck (hitscan3d's `Struck`, naming the ability that struck it and the row it was by): the ability's effects
    // put on it, and, while it lives, its `hit` played; at 0 health it dies. Only rules strike: a seat's message
    // changes nothing.
    hit(me, w, seat, struck: unknown) {
      const d = me.data
      const s = struck as Struck
      if (seat >= 0 || d.dead || !d.gas || typeof s.ability !== 'string') return
      receive(w, me, s.ability, s.by)
      if (value(w, me, 'health') > 0) press(me, w, 'hit', d.stick)
      else dies(me, w)
    },
    target(me, w) {
      const d = me.data
      if (!d.stood) return
      const range = def(w, me.kind).target.range
      // The living mobs within range, nearest first; the one after the target, or the nearest.
      const near = targets(me, w)
        .map(z => ({ z, gap: math.hypot(z.data.pos[0] - d.pos[0], z.data.pos[2] - d.pos[2]) }))
        .filter(o => o.gap <= range)
        .sort((a, b) => a.gap - b.gap || a.z.id - b.z.id)
        .map(o => o.z.id)
      if (!near.length) {
        d.target = null
        return
      }
      const i = near.indexOf(d.target)
      d.target = near[(i + 1) % near.length]
    },
    // Talking (Talking, the header).
    talk(me, w) {
      const d = me.data
      if (!d.stood || d.dead) return
      if (d.talking !== null) return end(me)
      start(w, me, def(w, me.kind).talk.reach)
    },
    choose(me, w, _seat, i: unknown) {
      if (!Number.isInteger(i) || me.data.talking === null) return
      choose(w, me, i as number)
    },
    // Trading (Trading, the header): each with the speaker serving it that service.
    buy(me, w, _seat, i: unknown, count: unknown) {
      const v = served(me, w, 'vendor')
      if (v && Number.isInteger(i) && Number.isInteger(count)) buy(w, me, v, i as number, count as number)
    },
    sell(me, w, _seat, id: unknown) {
      const v = served(me, w, 'vendor')
      const i = carried(me, id)
      if (v && i && !equippedFrom(me, i.id) && !onBar(me, i.id)) sell(w, me, v, i.id)
    },
    buyBack(me, w, _seat, i: unknown) {
      if (served(me, w, 'vendor') && Number.isInteger(i)) buyBack(me, i as number)
    },
    learn(me, w, _seat, recipe: unknown) {
      const t = served(me, w, 'trainer')
      if (t && typeof recipe === 'string') learn(w, me, t, recipe)
    },
    craft(me, w, _seat, recipe: unknown) {
      if (typeof recipe === 'string' && !me.data.dead) craft(w, me, recipe)
    },
    enchant(me, w, _seat, name: unknown, id: unknown) {
      const e = served(me, w, 'enchanter')
      if (e && typeof name === 'string' && Number.isInteger(id)) enchant(w, me, e, name, id as number)
    },
    leave(me) {
      me.data.serving = null
    },
    // Dead, it gets up again at its slot's start, as World of Warcraft's spirit healer raises a player at the
    // graveyard (Death, the header).
    release(me, w) {
      const d = me.data
      if (!d.dead) return
      const k = def(w, me.kind)
      d.dead = false
      d.stood = false
      d.target = null
      d.talking = null
      d.serving = null
      apply(w, me, k.release.effect, me.id)
    },
    // What it carries (Carrying, the header). Each names an inventory instance by its id, or a quick bar slot.
    wear(me, w, _seat, id: unknown) {
      const i = carried(me, id)
      if (!i || me.data.dead || equippedFrom(me, i.id) || onBar(me, i.id)) return
      const e = fragment(w, i.definition, 'equippable')
      if (e) equip(w, me, e.equipment, i.id)
    },
    takeOff(me, w, _seat, id: unknown) {
      const i = carried(me, id)
      if (!i || me.data.dead || onBar(me, i.id) || !equippedFrom(me, i.id)) return
      unequip(w, me, i.id)
    },
    slot(me, w, _seat, slot: unknown, id: unknown) {
      const i = carried(me, id)
      if (!i || !isSlot(me, slot) || equippedFrom(me, i.id) || onBar(me, i.id)) return
      addToSlot(w, me, slot as number, i.id)
    },
    unslot(me, w, _seat, slot: unknown) {
      if (!isSlot(me, slot) || me.data.dead) return
      removeFromSlot(w, me, slot as number)
    },
    hold(me, w, _seat, slot: unknown) {
      if (me.data.dead || !(slot === -1 || isSlot(me, slot))) return
      setActive(w, me, slot as number)
    },
    drop(me, w, _seat, id: unknown) {
      const i = carried(me, id)
      if (!i || me.data.dead) return
      const at = me.data.quickbar.slots.indexOf(i.id)
      if (at >= 0) removeFromSlot(w, me, at)
      if (equippedFrom(me, i.id)) unequip(w, me, i.id)
      removeInstance(me, i.id)
    },
    look(me, w, _seat, dyaw: unknown, dpitch: unknown) {
      if (!finite(dyaw, dpitch)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw + (dyaw as number)), pitch: clamp(l.pitch + (dpitch as number), c.minPitch, c.maxPitch) }
    },
    zoom(me, w, _seat, by: unknown) {
      if (!finite(by)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, dist: clamp(l.dist * math.exp((by as number) * c.zoom), c.minDist, c.maxDist) }
    },
  },
}
