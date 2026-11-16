// demo_motion3d: the manager booted as its page boots it and main loaded; a seat joins and its X Bot
// stands on its start, and walks to each space and presses the use key. On open ground the key does
// nothing. In the party and the sad zones it plays each zone's own clip, the body held where it stood
// until the clip has played out, then walking again. Under the wall's lip it hangs from the lip, its
// wrists on it; shimmies along it until its hands would leave it; climbs up onto the wall's top, or
// drops back to the ground. In front of the chair it sits, its hips on the seat, and stands again.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene, type Truth, type W } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import * as THREE from 'three'
import { motion3d } from '#plugins/motion3d/motion3d.plugin.ts'
import { posed, secondsIn } from '#plugins/motion3d/motion3d.play.ts'
import { carrying, reachesOf, type File } from '#plugins/motion3d/motion3d.sim.ts'
import { sim } from './demo_motion3d.sim.ts'
import { blowAt } from './dummy.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import file from './demo_motion3d.scene.json' with { type: 'json' }
import main from './main.scene.json' with { type: 'json' }
import motions from './assets/xbot.motion3d.json' with { type: 'json' }
import measured from './assets/xbot.rig.baked.json' with { type: 'json' }
import written from './assets/xbot.rig.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
// A space's point in the world: a point's place, a line's two ends, a plane's middle and its size.
type Point = { at?: number[]; from?: number[]; to?: number[]; size?: number[] }
// The clips the X Bot's motion3d file plays for a motion of an activity.
// The X Bot's motion3d file, its JSON read as motion3d reads it.
const MOTION = motions as unknown as File
const clipsOf = (word: string, motion: string) => MOTION.activities[word].motions[motion].clips

async function joined() {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  let seq = 0
  const send = (action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: possessed(last.packet.rows)!.id, action, args } })
  }
  const me = () => room.rows.find(r => r.id === possessed(heard[heard.length - 1].packet.rows)!.id)!
  const until = (done: () => boolean, most: number) => {
    for (let i = 0; i < most && !done(); i++) truth.step(DT)
    expect(done()).toBe(true)
  }
  const kinds = room.world.shapes3d.kinds
  const row = (kind: string) => room.rows.find(r => r.kind === kind)!
  // Walks to a place across the ground, looking toward it with the stick held forward, looking again
  // every few steps as a player steers, and stops there.
  const walkTo = (x: number, z: number, within: number) => {
    const near = () => Math.hypot(me().data.pos[0] - x, me().data.pos[2] - z) < within
    send('stick', 0, -1)
    for (let i = 0; i < 60 * 12 && !near(); i++) {
      if (i % 6 === 0) {
        const [bx, , bz] = me().data.pos
        send('look', Math.atan2(x - bx, z - bz) - me().data.look.yaw, 0)
      }
      truth.step(DT)
    }
    expect(near()).toBe(true)
    send('stick', 0, 0)
    until(() => me().data.speed === 0, 60 * 2)
  }
  // Runs through each place across the ground in turn, by the lanes between the yard's stations, and
  // walks the last stretch, stopping within `within` of the last.
  const route = (places: number[][], within: number) => {
    send('fast', 1)
    for (const [x, z] of places.slice(0, -1)) {
      const near = () => Math.hypot(me().data.pos[0] - x, me().data.pos[2] - z) < 0.6
      send('stick', 0, -1)
      for (let i = 0; i < 60 * 30 && !near(); i++) {
        if (i % 6 === 0) {
          const [bx, , bz] = me().data.pos
          send('look', Math.atan2(x - bx, z - bz) - me().data.look.yaw, 0)
        }
        truth.step(DT)
      }
      expect(near()).toBe(true)
    }
    send('fast', 0)
    const [x, z] = places[places.length - 1]
    walkTo(x, z, within)
  }
  // A point of a space, its row's place added (every space stands facing 0).
  const pointOf = (kind: string, name: string): Point => {
    const p = kinds[kind].points[name], at = row(kind).data.pos
    const add = (q: number[]) => q.map((v, i) => v + at[i])
    if (p.point) return { at: add(p.point.at) }
    if (p.line) return { from: add(p.line.from), to: add(p.line.to) }
    return { at: add(p.plane.at), size: p.plane.size }
  }
  // The middle of some of the body's bones as drawn.
  const middle = (bones: string[]) => bones.map(b => boneAt(room, me(), b)).reduce((s, p) => s.map((v, i) => v + p[i] / bones.length), [0, 0, 0])
  // Steps until `done`, the drawn middle of `bones` moving no more than STEP in any one step.
  const steady = (bones: string[], done: () => boolean, most: number) => {
    let was = middle(bones)
    for (let i = 0; i < most && !done(); i++) {
      truth.step(DT)
      const now = middle(bones)
      expect(far(now, was)).toBeLessThanOrEqual(STEP)
      was = now
    }
    expect(done()).toBe(true)
  }
  return { truth, room, send, me, until, kinds, row, walkTo, route, pointOf, middle, steady }
}

// Where a bone of the body stands in the world as the page draws it this step: motion3d's pose of the row's
// fields (`posed`, every clip fading in and out at its weight), in the body's frame, set on the row's
// place and turned by its yaw.
function boneAt(t: Truth, me: Row, bone: string): number[] {
  const p = new THREE.Vector3().setFromMatrixPosition(posed(reader(t), me).get(bone)!)
  return toWorld(me, [p.x, p.y, p.z])
}
// The scene's rows as a rule's `w` reads them, for motion3d to read the rig, the glb and the
// spaces off.
const reader = (t: Truth): W => ({
  world: t.world,
  all: (kind: string) => t.rows.filter(r => r.kind === kind),
  find: (kind: string) => t.rows.find(r => r.kind === kind)!,
  get: (id: number) => t.rows.find(r => r.id === id)!,
}) as never
// A place in the body's frame (x left, y up, z ahead) in the world, by the row's place and yaw.
function toWorld(me: Row, [x, y, z]: number[]): number[] {
  const yaw = me.data.yaw, [px, py, pz] = me.data.pos
  return [px + z * Math.sin(yaw) + x * Math.cos(yaw), py + y, pz + z * Math.cos(yaw) - x * Math.sin(yaw)]
}
const far = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
// The props the X Bot's kind hangs, by their loader models.
const PROPS = main.world.motion3d.kinds.xbot.props.map(p => p.model)
// A page on the room that motion3d draws the X Bot on by a stand-in of its model: a root, and every clip
// of its rig as long as the bake measured it, keying a bone-less object under it, so the body is drawn
// where its row stands, turned by its yaw; beside it, `more` of the page's plugins.
function standIn(room: Truth, more: Record<string, unknown> = {}) {
  const root = new THREE.Group()
  const keyed = new THREE.Object3D()
  keyed.name = 'Keyed'
  root.add(keyed)
  // The spine the aim turns, each bone over the one before.
  let spine: THREE.Object3D = root
  for (const name of ['Spine', 'Spine1', 'Spine2']) {
    const bone = new THREE.Bone()
    bone.name = name
    bone.position.set(0, spine === root ? 1 : 0.1, 0)
    spine.add(bone)
    spine = bone
  }
  // Each arm a chain of bones motion3d bends: the arm, its forearm and its hand.
  for (const side of ['Left', 'Right']) {
    let parent: THREE.Object3D = root
    for (const [name, at] of [['Arm', [side === 'Left' ? 0.2 : -0.2, 1.4, 0]], ['ForeArm', [0, -0.25, 0]], ['Hand', [0, -0.25, 0]]] as const) {
      const bone = new THREE.Bone()
      bone.name = side + name
      bone.position.fromArray(at)
      parent.add(bone)
      parent = bone
    }
  }
  const animations = Object.entries(written.clips).filter(([, e]) => typeof e === 'string' || !('mirror' in e))
    .map(([name]) => new THREE.AnimationClip(name, -1, [new THREE.VectorKeyframeTrack('Keyed.position', [0, measured.table[name as keyof typeof measured.table].dur], [0, 0, 0, 0, 0, 0])]))
  const page = {
    wire: { n: 1, rows: room.rows, scene: { ...room.scene, plugins: ['solids', 'shipped', 'motion3d', 'render3d'] } },
    render3d: { THREE, scene: new THREE.Scene(), dress: () => {} },
    loader: { ready: () => true, load: async () => {}, model: (name: string) => (PROPS.includes(name) ? { scene: new THREE.Group(), animations: [] } : { scene: root, animations }) },
    ...more,
  } as never
  return { page, root }
}
// The lowest of the body's toes' tips as drawn, over the yard's floor at 0.
const toe = (t: Truth, me: Row) => Math.min(boneAt(t, me, 'LeftToe_End')[1], boneAt(t, me, 'RightToe_End')[1])
// Steps a drop until it walks again: its toes as drawn never more than 5 cm through the floor (the dev
// page's limit), and on it, within 2 cm, as it is handed back to walking.
function landsOnFloor({ truth, room, me }: { truth: Truth; room: Truth; me: () => Row }, most: number) {
  for (let i = 0; i < most && me().data.activity !== 'walk'; i++) {
    truth.step(DT)
    expect(toe(room, me())).toBeGreaterThanOrEqual(-0.05)
  }
  expect(me().data.activity).toBe('walk')
  expect(Math.abs(toe(room, me()))).toBeLessThanOrEqual(0.02)
}
// The most a drawn bone moves in one step through a change of motion: the hands and the hips move at the
// clips' own speed, never jumping to where the clip coming in would have them.
const STEP = 0.06

test('the use key plays each zone\'s own clip in it, holding the body still, and outside them steps back', async () => {
  const { truth, send, me, until, kinds, row, walkTo } = await joined()
  const idle = me().data.clip
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('roll')
  expect(me().data).toMatchObject({ motion: 'backstep', clip: clipsOf('roll', 'backstep')[0] })
  until(() => me().data.clip === idle, 60 * 3)

  for (const zone of [row('partyzone'), row('sadzone')]) {
    walkTo(zone.data.pos[0], zone.data.pos[2], kinds[zone.kind].shape.box.size[0] / 4)
    const [word] = kinds[zone.kind].activities
    expect(me().data.offered).toEqual([word])
    send('press', 'use')
    truth.step(DT)
    expect(me().data.activity).toBe(word)
    expect(me().data.clip).toBe(clipsOf(word, 'use')[0])
    // Eased onto the floor where it stood over the fade, then held there, placed by the clip's offsets.
    const dur = measured.table[me().data.clip as keyof typeof measured.table].dur
    let left = Math.floor(dur / DT) - 1
    for (; left > 0 && me().data.eased !== null; left--) truth.step(DT)
    const at = [...me().data.pos]
    for (; left > 0; left--) {
      truth.step(DT)
      expect(me().data.activity).toBe(word)
      // Held where it stood: within a millimetre.
      expect(Math.hypot(me().data.pos[0] - at[0], me().data.pos[1] - at[1], me().data.pos[2] - at[2])).toBeLessThan(0.001)
    }
    until(() => me().data.activity === 'walk', 3)
  }
})

test('a light pressed three times during the first swing plays the whole chain, each swing starting as the one before strikes', async () => {
  const { truth, room, send, me, until } = await joined()
  until(() => me().data.clip === clipsOf('walk', 'stand')[0], 30)
  send('press', 'light')
  truth.step(DT)
  expect(me().data.motion).toBe('light1')
  // Two more within the first tenth of a second, held in the buffer in turn.
  send('press', 'light')
  truth.step(DT)
  send('press', 'light')
  truth.step(DT)
  expect(me().data.queued.map((q: { key: string }) => q.key)).toEqual(['light', 'light'])
  const chain: { motion: string; from: string; at: number }[] = []
  let was = { motion: me().data.motion as string, clip: me().data.clip as string, t: me().data.clipT as number }
  for (let i = 0; i < 60 * 8 && chain.length < 2; i++) {
    truth.step(DT)
    const d = me().data
    if (d.motion !== was.motion) chain.push({ motion: d.motion, from: was.clip, at: was.t })
    was = { motion: d.motion, clip: d.clip, t: d.clipT }
  }
  expect(chain.map(c => c.motion)).toEqual(['light2', 'light3'])
  // Each played at the swing before's strike: on the step after the first whose playhead reached it.
  for (const c of chain) {
    const strike = secondsIn(reader(room), me(), c.from, 'strike', 'strike')
    expect(c.at, `${c.motion} from ${c.from}`).toBeGreaterThanOrEqual(strike - 1e-9)
    expect(c.at - DT * 1.01, `${c.motion} from ${c.from}`).toBeLessThan(strike)
  }
  expect(me().data.queued).toEqual([])
})

test('three lights pressed one after another as each swing plays chain all three, each from the one before\'s strike', async () => {
  const { truth, room, send, me, until } = await joined()
  until(() => me().data.clip === clipsOf('walk', 'stand')[0], 30)
  const order: string[] = []
  send('press', 'light')
  for (let i = 0; i < 60 * 12 && order.length < 3; i++) {
    truth.step(DT)
    const d = me().data
    if (order[order.length - 1] !== d.motion && /^light\d$/.test(d.motion)) {
      order.push(d.motion)
      // The next pressed at once, held in the buffer until this one strikes.
      send('press', 'light')
    }
  }
  expect(order).toEqual(['light1', 'light2', 'light3'])
  // The fourth has nothing to chain into: held while the third plays, dropped once it may play and nothing
  // does, its hold run out.
  truth.step(DT)
  expect(me().data.queued).toEqual([{ key: 'light', age: 0 }])
  until(() => me().data.queued.length === 0, 60 * 6)
  expect(me().data.motion).toBe('light3')
  void room
})

// Draws the axe: the switch key with nothing drawn picks each next weapon until it is the axe, then the
// draw key, and steps until its stance is up.
function drawAxe({ truth, send, me, until }: Awaited<ReturnType<typeof joined>>) {
  until(() => me().data.clip === clipsOf('walk', 'stand')[0], 30)
  for (let i = 0; i < 9 && me().data.weapon !== 'axe'; i++) {
    expect(me().data.upperMotion).toBe(null)
    send('press', 'switch')
    truth.step(DT)
  }
  expect(me().data.upperMotion).toBe(null)
  send('press', 'draw')
  until(() => me().data.upperMotion === 'axe', 60 * 4)
  until(() => me().data.motion === 'axestand', 60)
}

// Jumps from standing, the key held for `held` seconds, and steps until it stands again: where it left
// the ground, its highest, and where it came down, each [x, y, z], and the playhead the feet left on.
function jumped(j: Awaited<ReturnType<typeof joined>>, held: number) {
  const { truth, send, me, until } = j
  const ground = me().data.pos[1]
  send('jumping', 1)
  send('press', 'jump')
  let off: number[] | undefined, top = -Infinity, down: number[] | undefined, offAt = 0, steps = 0
  for (let i = 0; i < 60 * 6 && !down; i++) {
    if (steps * DT >= held) send('jumping', 0)
    const was = me().data.grounded
    const t = me().data.clipT
    truth.step(DT)
    steps++
    const d = me().data
    if (!off && was !== false && d.grounded === false) { off = [...d.pos]; offAt = t }
    if (off) top = Math.max(top, d.pos[1] - ground)
    if (off && d.grounded !== false) down = [...d.pos]
  }
  expect(off && down).toBeTruthy()
  until(() => me().data.speed < 0.05 && me().data.grounded !== false, 60 * 4)
  return { off: off!, top, down: down!, offAt }
}

test('a jump leaves the ground on its clip\'s takeoff, the clip played so it lands as the body does', async () => {
  const j = await joined()
  const { truth, room, send, me } = j
  drawAxe(j)
  send('jumping', 1)
  send('press', 'jump')
  truth.step(DT)
  expect(me().data.motion).toBe('axejump')
  const clip = me().data.clip
  const takeoff = secondsIn(reader(room), me(), clip, 'takeoff', 'takeoff')
  const landing = secondsIn(reader(room), me(), clip, 'landing', 'landing')
  expect(takeoff).toBeGreaterThan(0.3)
  // On the ground, held there, until the clip's feet leave it.
  let leftAt = -1, landedAt = -1
  for (let i = 0; i < 60 * 4 && landedAt < 0; i++) {
    const t = me().data.clipT
    const up = me().data.grounded === false
    truth.step(DT)
    const d = me().data
    if (leftAt < 0 && !up && d.grounded === false) leftAt = t
    if (leftAt < 0) expect(d.clip).toBe(clip)
    if (leftAt >= 0 && d.grounded !== false) landedAt = d.clip === clip ? d.clipT : Infinity
  }
  // Left on the step whose playhead reached the takeoff (`leftAt` is where that step began).
  expect(leftAt).toBeLessThan(takeoff)
  expect(leftAt + 1.01 * DT).toBeGreaterThanOrEqual(takeoff)
  // Came down as the clip came to its landing: within two steps of it.
  expect(Math.abs(landedAt - landing)).toBeLessThan(3 * DT)
})

test('a jump held longer goes higher; a running jump goes further than a standing one', async () => {
  const j = await joined()
  const short = jumped(j, 0.05)
  const long = jumped(j, 2)
  expect(long.top).toBeGreaterThan(short.top * 1.5)
  // kinematics3d's jumpH: held all the way, the body rises as high as it, short of it by the step.
  expect(long.top).toBeGreaterThan(1.85)
  expect(long.top).toBeLessThanOrEqual(2)
  const standing = Math.hypot(long.down[0] - long.off[0], long.down[2] - long.off[2])
  // Running, then jumping with the key held as long.
  j.send('fast', 1)
  j.send('stick', 0, -1)
  for (let i = 0; i < 60; i++) j.truth.step(DT)
  const run = jumped(j, 2)
  j.send('stick', 0, 0)
  j.send('fast', 0)
  const running = Math.hypot(run.down[0] - run.off[0], run.down[2] - run.off[2])
  expect(running).toBeGreaterThan(standing + 2)
})

test('a hit while running flinches the upper body over the run, the legs running on; a hard turn leans the body into it', async () => {
  const { truth, send, me, until } = await joined()
  send('fast', 1)
  send('stick', 0, -1)
  until(() => me().data.motion === 'run' && me().data.speed > 3, 60 * 3)
  expect(Math.abs(me().data.lean)).toBeLessThan(0.01)
  send('press', 'hit')
  truth.step(DT)
  expect(me().data.adds.map((l: { name: string }) => l.name)).toEqual(['hurt.flinch'])
  expect(me().data.adds[0]).toMatchObject({ clip: 'uahit', bone: 'Spine', most: 0.8 })
  until(() => {
    expect(me().data.motion).toBe('run')
    return me().data.adds.length === 0
  }, 60 * 3)
  // Turning hard to the left as it runs: leaning into the turn, no further than the kind's most.
  let most = 0
  for (let i = 0; i < 40; i++) {
    send('look', 0.05, 0)
    truth.step(DT)
    most = Math.max(most, me().data.lean)
  }
  expect(most).toBeGreaterThan(0.05)
  expect(most).toBeLessThanOrEqual(0.25)
  send('stick', 0, 0)
  send('fast', 0)
})

// Stands the body `far` metres from the dummy, at the bearing `around` from it, turned `off` radians away
// from facing it, and still.
function standBy(j: Awaited<ReturnType<typeof joined>>, far: number, around: number, off: number) {
  const { truth, me, row, until } = j
  const at = row('dummy').data.pos
  const d = me().data
  expect(Array.isArray(d.along) && d.along.length === 3).toBe(true)
  d.pos = [at[0] + far * Math.sin(around), at[1], at[2] + far * Math.cos(around)]
  // Its place on the triangles it stands on is where it stands.
  d.along = [...d.pos]
  d.yaw = around + Math.PI + off
  d.facing = d.yaw
  d.look = { ...d.look, yaw: d.yaw }
  d.vel = [0, 0, 0]
  truth.step(DT)
  until(() => me().data.motion === 'stand' && me().data.speed === 0, 60)
}

test('a light attack started a metre and a half from the dummy, from any side and turned away from it, lands its blow on the dummy', async () => {
  const j = await joined()
  const { truth, room, send, me, row } = j
  const dummy = () => row('dummy')
  for (const around of [0, Math.PI / 2, Math.PI, -2.3]) {
    standBy(j, 1.5, around, 0.7)
    expect(me().data.target).toEqual(dummy().data.pos)
    const hits = dummy().data.hits
    send('press', 'light')
    let landed: number[] | undefined
    for (let i = 0; i < 60 * 3 && dummy().data.hits === hits; i++) {
      truth.step(DT)
      if (me().data.windows.includes('blow')) landed = blowAt(reader(room), me())
    }
    expect(dummy().data.hits, `from ${around}`).toBe(hits + 1)
    // The blow, as the body is drawn, within the dummy's reach of its middle.
    const at = dummy().data.pos
    expect(Math.hypot(landed![0] - at[0], landed![2] - at[2]), `from ${around}`).toBeLessThanOrEqual(0.7)
    // Queued as the blow lands, played by its next step.
    truth.step(DT)
    expect(dummy().data.motion).toBe('hit')
    for (let i = 0; i < 60 * 3; i++) truth.step(DT)
  }
  // Out of `lock`, nothing to bend onto: the jab lands on the air.
  standBy(j, 5, 0, 0)
  expect(me().data.target).toBe(null)
  const hits = dummy().data.hits
  send('press', 'light')
  for (let i = 0; i < 60 * 2; i++) truth.step(DT)
  expect(dummy().data.hits).toBe(hits)
  // And from a metre and a half, turned away, with no target to bend onto (the player's `lock` 0 for
  // the while): the same jab misses, so the bend is what lands it.
  const k = def(reader(room), 'player')
  const lock = k.lock
  k.lock = 0
  try {
    standBy(j, 1.5, 0, 0.7)
    expect(me().data.target).toBe(null)
    send('press', 'light')
    for (let i = 0; i < 60 * 2; i++) truth.step(DT)
    expect(dummy().data.hits).toBe(hits)
  } finally {
    k.lock = lock
  }
})

// Stands the body at (x, z) facing +z, still.
function standAt(j: Awaited<ReturnType<typeof joined>>, x: number, z: number) {
  const { truth, me, until } = j
  const d = me().data
  d.pos = [x, 0, z]
  d.along = [...d.pos]
  d.yaw = 0
  d.facing = 0
  d.look = { ...d.look, yaw: 0 }
  d.vel = [0, 0, 0]
  truth.step(DT)
  until(() => me().data.motion === 'stand' && me().data.speed === 0, 60)
}

test('run at a plain waist-high box with no station placed, the body vaults it; at a head-high one, it climbs onto it', async () => {
  const j = await joined()
  const { truth, send, me, row, kinds } = j
  // The waist-high box: run at it from six metres, the stick held forward.
  const vault = row('vaultbox')
  standAt(j, vault.data.pos[0], vault.data.pos[2] - 6)
  send('fast', 1)
  send('stick', 0, -1)
  const seen = new Set<string>()
  for (let i = 0; i < 60 * 6 && !(seen.has('vaultover') && me().data.activity === 'walk'); i++) {
    truth.step(DT)
    seen.add(me().data.activity)
  }
  expect([...seen]).toContain('vaultover')
  expect(me().data.activity).toBe('walk')
  // Over it: beyond its far side, on the ground.
  const far = vault.data.pos[2] + kinds.vaultbox.shape.box.size[2] / 2
  expect(me().data.pos[2]).toBeGreaterThan(far)
  expect(me().data.pos[1]).toBeLessThan(0.05)
  send('stick', 0, 0)
  send('fast', 0)

  // The head-high box: run into it, the stick held forward: it jumps up, hangs and climbs onto its top.
  const climb = row('climbbox')
  standAt(j, climb.data.pos[0], climb.data.pos[2] - 4)
  send('fast', 1)
  send('stick', 0, -1)
  const motions: string[] = []
  for (let i = 0; i < 60 * 10 && !(motions.includes('climbup.over') && me().data.activity === 'walk'); i++) {
    truth.step(DT)
    const m = `${me().data.activity}.${me().data.motion}`
    if (motions[motions.length - 1] !== m) motions.push(m)
  }
  expect(motions).toContain('climbup.up')
  expect(motions).toContain('climbup.over')
  send('stick', 0, 0)
  send('fast', 0)
  for (let i = 0; i < 30; i++) truth.step(DT)
  // On its top.
  const top = kinds.climbbox.shape.box.size[1]
  expect(me().data.pos[1]).toBeCloseTo(top, 1)
  const near = climb.data.pos[2] - kinds.climbbox.shape.box.size[2] / 2
  expect(me().data.pos[2]).toBeGreaterThan(near)
})

test('standing at rest, the idle plays on at its own rate', async () => {
  const { truth, me } = await joined()
  for (let i = 0; i < 10; i++) truth.step(DT)
  expect(me().data.clip).toBe(clipsOf('walk', 'stand')[0])
  const t = me().data.clipT
  for (let i = 0; i < 60; i++) truth.step(DT)
  expect(me().data.rate).toBe(1)
  expect(me().data.clipT).toBeCloseTo(t + 1, 6)
})

const HANDS = ['LeftHand', 'RightHand']

// Walks up under the wall's lip and hangs from it, the drawn hands going steadily from the jump into the
// hang and onto the lip.
async function hung() {
  const j = await joined()
  const { truth, send, me, until, kinds, row, walkTo, middle, steady } = j
  const zone = row('ledgezone'), wall = row('wall')
  const lip = kinds.ledgezone.points.Lip.line
  const lipZ = zone.data.pos[2] + lip.from[2], lipY = zone.data.pos[1] + lip.from[1]
  walkTo(zone.data.pos[0], zone.data.pos[2], 0.3)
  // The wall's side offers mantling onto it as well, to a body run into it.
  expect(me().data.offered).toContain('ledge')
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('ledge')
  expect(me().data.clip).toBe(clipsOf('ledge', 'use')[0])
  until(() => me().data.motion === 'hang', 60 * 3)
  steady(HANDS, () => me().data.eased === null, 60)
  const wrists = middle(HANDS)
  expect(wrists[1]).toBeCloseTo(lipY, 2)
  expect(wrists[2]).toBeCloseTo(lipZ, 2)
  // Both hands grip the lip all through the hang, so both are bent onto it, wholly: the page's motion3d bends
  // the arms, each reaching the lip, for the body drawn where its row stands.
  const reach = reachesOf(reader(j.room), me())
  expect(reach.map(r => r.bone).sort()).toEqual(HANDS)
  for (const r of reach) {
    expect(r.weight).toBe(1)
    const at = toWorld(me(), r.at)
    expect(at[1]).toBeCloseTo(lipY, 6)
    expect(at[2]).toBeCloseTo(lipZ, 6)
  }
  const { page } = standIn(j.room)
  const drawing = motion3d()
  drawing.tick(page)
  const limbs = drawing.limbs(page, me())!
  expect(limbs.map(l => l.bones[2]).sort()).toEqual(HANDS)
  for (const l of limbs) {
    const at = l.target.getWorldPosition(new THREE.Vector3())
    expect(at.y).toBeCloseTo(lipY, 6)
    expect(at.z).toBeCloseTo(lipZ, 6)
  }
  return { ...j, zone, wall, lip, lipY, lipZ }
}

test('under the wall it hangs from the lip, shimmies along it until the hands would leave it, and climbs up onto the top', async () => {
  const { truth, room, send, me, until, kinds, zone, wall, lip, lipY, lipZ, steady } = await hung()
  // The stick right: along the lip to the body's right, −x, the hands steady into the shimmy, until it
  // stops short of the lip's end. The hands take turns gripping the lip: each is bent onto it while it
  // grips, and the other is let go to reach along.
  send('stick', 1, 0)
  steady(HANDS, () => me().data.clip === 'bracedright' && me().data.eased === null, 30)
  const ends0 = zone.data.pos[0] + Math.min(lip.from[0], lip.to[0])
  let alone = 0, nearest = Infinity
  for (let i = 0; i < 60 * 12 && me().data.motion !== 'hang'; i++) {
    truth.step(DT)
    // No hand past the lip's end, as drawn; the one leading along it comes to the end.
    const hands = HANDS.map(b => boneAt(room, me(), b)[0])
    for (const x of hands) expect(x).toBeGreaterThanOrEqual(ends0 - 0.02)
    nearest = Math.min(nearest, ...hands)
    const reach = reachesOf(reader(room), me())
    if (reach.filter(r => r.weight === 1).length === 1) alone++
    for (const r of reach.filter(r => r.weight === 1)) {
      const at = toWorld(me(), r.at)
      expect(at[1]).toBeCloseTo(lipY, 6)
      expect(at[2]).toBeCloseTo(lipZ, 6)
    }
  }
  expect(me().data.motion).toBe('hang')
  expect(alone).toBeGreaterThan(0)
  expect(nearest).toBeLessThan(ends0 + 0.05)
  steady(HANDS, () => me().data.eased === null, 30)
  for (const b of HANDS) expect(boneAt(room, me(), b)[0]).toBeGreaterThanOrEqual(ends0 - 0.02)
  for (let i = 0; i < 30; i++) {
    truth.step(DT)
    expect(me().data.motion).toBe('hang')
  }

  // Forward and use: up onto the wall's top, its hips going steadily from the climb onto its feet there,
  // and walking.
  send('stick', 0, -1)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe(clipsOf('ledge', 'climb')[0])
  send('stick', 0, 0)
  until(() => me().data.activity === 'walk', 60 * 3)
  steady(['Hips'], () => me().data.eased === null, 30)
  const top = wall.data.pos[1] + kinds.wall.shape.box.size[1]
  // To the rig's measures, kept to 4 places.
  expect(me().data.pos[1]).toBeCloseTo(top, 3)
  for (let i = 0; i < 30; i++) truth.step(DT)
  expect(me().data.grounded).toBe(true)
  expect(me().data.pos[1]).toBeCloseTo(top, 6)
})

test('hanging, back and use drops it to the ground, its feet landing on the floor, walking', async () => {
  const { truth, room, send, me, until, steady } = await hung()
  send('stick', 0, 1)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe(clipsOf('ledge', 'drop')[0])
  steady(HANDS, () => me().data.eased === null, 30)
  send('stick', 0, 0)
  landsOnFloor({ truth, room, me }, 60 * 3)
  until(() => me().data.grounded && me().data.pos[1] === 0, 60)
})

test('in front of the chair it sits down, its hips on the seat, and stands up again', async () => {
  const { truth, room, send, me, until, kinds, row, walkTo, steady } = await joined()
  const zone = row('chairzone')
  const seat = kinds.chairzone.points.Seat.point.at
  walkTo(zone.data.pos[0], zone.data.pos[2] - 0.3, 0.3)
  expect(me().data.offered).toEqual(['chair'])
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('chair')
  expect(me().data.clip).toBe(clipsOf('chair', 'use')[0])
  until(() => me().data.motion === 'seated', 60 * 4)
  steady(['Hips'], () => me().data.eased === null, 30)
  const hips = boneAt(room, me(), 'Hips')
  // To the millimetre: the clip's own sway as it sits.
  expect(hips[0]).toBeCloseTo(zone.data.pos[0] + seat[0], 3)
  expect(hips[1]).toBeCloseTo(zone.data.pos[1] + seat[1], 3)
  expect(hips[2]).toBeCloseTo(zone.data.pos[2] + seat[2], 3)

  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe(clipsOf('chair', 'stand')[0])
  until(() => me().data.activity === 'walk', 60 * 4)
  const at = [...me().data.pos]
  send('stick', 0, -1)
  for (let i = 0; i < 30; i++) truth.step(DT)
  expect(Math.hypot(me().data.pos[0] - at[0], me().data.pos[2] - at[2])).toBeGreaterThan(0.1)
})

// The lanes between the yard's stations, and the ways along the rows' fronts.
const LANE = 3.5
const ROW1 = 15, ROW2 = 25.5, ROW3 = 40

test('standing still in the cold room plays its idle, walking in it walks as anywhere, and walking out of it stands as anywhere', async () => {
  const { truth, send, me, until, row, route, walkTo } = await joined()
  const room = row('coldroom').data.pos
  route([[-LANE, ROW1], [room[0], ROW1], [room[0], room[2]]], 0.4)
  // Taken up with no key once the stand comes round: the cold room's own activity, its space the room.
  until(() => me().data.activity === 'cold', 60 * 4)
  expect(clipsOf('cold', 'idle')).toContain(me().data.clip)
  expect(me().data.space).toBe(row('coldroom').id)
  // It walks: the cold room lists no walking, so the anywhere shape's walk.
  send('stick', 0, -1)
  until(() => me().data.activity === 'walk' && me().data.clip === clipsOf('walk', 'walk')[0], 30)
  walkTo(room[0], ROW1, 0.4)
  for (let i = 0; i < 30; i++) truth.step(DT)
  expect(me().data.activity).toBe('walk')
  expect(me().data.clip).toBe(clipsOf('walk', 'stand')[0])
})

// Up into a hang from a bar or a ceiling, along it to its end, and down again.
async function freehang(kind: string, point: string, across: (p: Point) => number[]) {
  const j = await joined()
  const { truth, send, me, until, row, route, steady, middle, pointOf } = j
  const zone = row(kind).data.pos
  const lane = zone[0] < 0 ? -LANE : LANE
  const front = zone[2] < 30 ? ROW1 : ROW3
  route([[lane, front], [zone[0], front], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('freejump')
  until(() => me().data.motion === 'hang', 60 * 3)
  steady(HANDS, () => me().data.eased === null, 30)
  const p = pointOf(kind, point)
  expect(middle(HANDS)[1]).toBeCloseTo((p.at ?? p.from)![1], 2)
  // The stick right: along to the body's right until the hands would leave it, then hanging there.
  send('stick', 1, 0)
  until(() => me().data.motion === 'move', 10)
  until(() => me().data.motion === 'hang', 60 * 12)
  const [lo, hi] = across(p)
  for (const b of HANDS) expect(boneAt(j.room, me(), b)[0]).toBeGreaterThanOrEqual(lo - 0.05)
  // Held there half a second, the stick still pushing into the end, as a player does.
  for (let i = 0; i < 30; i++) truth.step(DT)
  // The stick left: back along it to the body's left, to its other end.
  send('stick', -1, 0)
  until(() => me().data.motion === 'move', 10)
  until(() => me().data.motion === 'hang', 60 * 20)
  for (const b of HANDS) expect(boneAt(j.room, me(), b)[0]).toBeLessThanOrEqual(hi + 0.05)
  send('stick', 0, 0)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('freedrop')
  landsOnFloor(j, 60 * 3)
  until(() => me().data.grounded && Math.abs(me().data.pos[1]) < 1e-6, 60 * 2)
}

test('under the bar it jumps up and hangs from it, its wrists on it, moves along it to its end, and drops', async () => {
  await freehang('barzone', 'Bar', p => [Math.min(p.from![0], p.to![0]), Math.max(p.from![0], p.to![0])])
})

test('under the ceiling it jumps up and hangs from it, its wrists on it, moves across it to its side, and drops', async () => {
  await freehang('hallzone', 'Ceiling', p => [p.at![0] - p.size![0] / 2, p.at![0] + p.size![0] / 2])
})

test('at the rope it takes hold, climbs while the stick is forward and holds on while not, up to the top, and lets go', async () => {
  const { truth, send, me, until, row, route, middle, pointOf } = await joined()
  const zone = row('ropezone').data.pos
  route([[LANE, ROW1], [zone[0], ROW1], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('rope')
  const rope = pointOf('ropezone', 'Rope')
  // Held still with the stick let go.
  for (let i = 0; i < 20; i++) truth.step(DT)
  const low = me().data.pos[1]
  for (let i = 0; i < 20; i++) truth.step(DT)
  expect(me().data.pos[1]).toBeCloseTo(low, 6)
  // Up, the wrists on the rope's line across the ground, to its top.
  send('stick', 0, -1)
  for (let i = 0; i < 60 * 3; i++) truth.step(DT)
  expect(me().data.pos[1]).toBeGreaterThan(low + 0.5)
  const w = middle(HANDS)
  expect(Math.hypot(w[0] - rope.from![0], w[2] - rope.from![2])).toBeLessThan(0.1)
  until(() => me().data.rate === 0, 60 * 20)
  expect(middle(HANDS)[1]).toBeGreaterThan(rope.to![1] - 0.5)
  // Let go: down to the ground, walking.
  send('stick', 0, 0)
  send('press', 'use')
  until(() => me().data.activity === 'walk' && me().data.grounded && Math.abs(me().data.pos[1]) < 1e-6, 60 * 4)
})

test('at the rope swing it swings from the beam onto the platform and stands there', async () => {
  const { truth, send, me, until, row, route, kinds } = await joined()
  const zone = row('swingzone').data.pos
  route([[LANE, ROW1 - 2], [zone[0], ROW1 - 2], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('ropeswing')
  until(() => me().data.activity === 'walk' && me().data.eased === null, 60 * 4)
  for (let i = 0; i < 30; i++) truth.step(DT)
  expect(me().data.grounded).toBe(true)
  expect(me().data.pos[1]).toBeCloseTo(kinds.swingplatform.shape.box.size[1], 3)
})

test('at the climbing wall it takes hold, climbs up while the stick is forward to the top, down while it is back, and lets go', async () => {
  const { truth, send, me, until, row, route, pointOf } = await joined()
  const zone = row('climbzone').data.pos
  route([[LANE, ROW1], [zone[0], ROW1], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('climb')
  const face = pointOf('climbzone', 'Face')
  const low = me().data.pos[1]
  send('stick', 0, -1)
  for (let i = 0; i < 60 * 3; i++) truth.step(DT)
  expect(me().data.pos[1]).toBeGreaterThan(low + 0.5)
  // Up to where the hands would leave the top, held there.
  until(() => me().data.rate === 0, 60 * 12)
  const top = me().data.along[1]
  expect(top).toBeLessThan(face.size![1] / 2)
  expect(top).toBeGreaterThan(0)
  // Down while the stick is back.
  send('stick', 0, 1)
  until(() => me().data.motion === 'down', 10)
  for (let i = 0; i < 60; i++) truth.step(DT)
  expect(me().data.along[1]).toBeLessThan(top)
  send('stick', 0, 0)
  send('press', 'use')
  until(() => me().data.activity === 'walk' && me().data.grounded && Math.abs(me().data.pos[1]) < 1e-6, 60 * 4)
})

test('at the wall leaning back it climbs at its clip\'s own rate, the stick forward, up along the slab', async () => {
  const { truth, send, me, until, row, route } = await joined()
  const zone = row('tiltzone').data.pos
  route([[LANE, ROW3 - 2], [zone[0], ROW3 - 2], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('climb')
  send('stick', 0, -1)
  for (let i = 0; i < 60; i++) truth.step(DT)
  const low = me().data.along[1]
  for (let i = 0; i < 60; i++) truth.step(DT)
  // A slab is no ground: the stick climbs it at the clip's own rate, not the share of it a walk across the
  // ground would lay along the slab.
  expect(me().data.rate).toBeCloseTo(1, 2)
  expect(me().data.along[1] - low).toBeGreaterThan(0.5)
  until(() => me().data.rate === 0, 60 * 12)
})

// A one-shot from a point of the station's space: played from the point, then walking on its feet.
async function oneShot(kind: string, clip: string, lane: number, front: number) {
  const j = await joined()
  const { truth, send, me, until, row, route } = j
  const zone = row(kind).data.pos
  route([[lane, front], [zone[0], front], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe(clip)
  until(() => me().data.activity === 'walk', 60 * 4)
  until(() => me().data.eased === null && me().data.grounded, 60 * 4)
  return j
}

test('at the run wall it runs along the wall, comes down onto the ground, and walks on there further along it', async () => {
  const { truth, send, me, until, row, route } = await joined()
  const zone = row('runzone').data.pos
  route([[-LANE, ROW2], [zone[0], ROW2], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('wallside')
  // The run ends in the air off the wall, and falls to the ground.
  until(() => me().data.activity === 'walk', 60 * 3)
  until(() => me().data.grounded && me().data.eased === null, 60)
  // Walking again with its feet on the ground.
  for (let i = 0; i < 30; i++) {
    expect(me().data.pos[1]).toBeLessThan(0.03)
    truth.step(DT)
  }
  expect(me().data.grounded).toBe(true)
  expect(me().data.pos[1]).toBeCloseTo(0, 6)
  expect(me().data.pos[0]).toBeLessThan(zone[0] - 2)
})

test('on the block\'s top at its front it teeters with its ankles at the edge, and steps down off it, its feet landing on the floor', async () => {
  const { truth, room, send, me, until, row, route, middle, pointOf } = await joined()
  const zone = row('edgezone').data.pos
  const step = row('edgestep').data.pos
  // Round to the step behind the block, up it onto the top, and along it to its front.
  route([[LANE, ROW2], [LANE, step[2] + 1], [zone[0], step[2] + 1], [zone[0], step[2] - 0.5], [zone[0], zone[2]]], 0.3)
  expect(me().data.offered).toEqual(['edge'])
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('teeter')
  until(() => me().data.eased === null, 30)
  // The ankles at the edge, within the centimetre the clip's own sway moves them as it teeters.
  const edge = pointOf('edgezone', 'Edge')
  const ankles = middle(['LeftFoot', 'RightFoot'])
  expect(Math.abs(ankles[1] - edge.from![1])).toBeLessThan(0.01)
  expect(Math.abs(ankles[2] - edge.from![2])).toBeLessThan(0.01)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('jumpdown')
  landsOnFloor({ truth, room, me }, 60 * 5)
  until(() => me().data.eased === null, 60)
  until(() => me().data.grounded && Math.abs(me().data.pos[1]) < 1e-6, 60 * 2)
  expect(me().data.pos[2]).toBeLessThan(edge.from![2])
})

test('at the stairs\' foot it climbs them to the landing, falls into the pool, floats, swims to the far wall and climbs out onto it', async () => {
  const { truth, send, me, until, row, route, kinds, pointOf, middle } = await joined()
  const stairs = row('stairzone').data.pos
  route([[LANE, ROW1 + 3], [LANE, ROW2 - 1], [stairs[0], ROW2 - 1], [stairs[0], stairs[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('stairsup')
  send('stick', 0, -1)
  const landing = kinds.stairlanding.shape.box.size[1]
  // At the top step, the feet on it: on along the landing to the deck's edge.
  until(() => me().data.activity === 'walk', 60 * 12)
  until(() => me().data.eased === null, 30)
  expect(me().data.pos[1]).toBeGreaterThan(landing - 2 * kinds.stair1.shape.box.size[1])
  const pool = row('pool').data.pos
  route([[pool[0], pool[2]]], 0.3)
  expect(me().data.pos[1]).toBeCloseTo(landing, 3)
  expect(me().data.offered).toEqual(['pool'])
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('poolin')
  until(() => me().data.motion === 'float', 60 * 4)
  until(() => me().data.eased === null, 30)
  // The hips on the water, within the centimetre the clip's own bob moves them.
  const float = pointOf('pool', 'Float')
  expect(Math.abs(middle(['Hips'])[1] - float.at![1])).toBeLessThan(0.01)
  // Ahead across the water to the far wall, and out onto it.
  send('stick', 0, -1)
  until(() => me().data.motion === 'swim', 10)
  until(() => me().data.motion === 'float', 60 * 12)
  send('stick', 0, 0)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('bracedclimb')
  until(() => me().data.activity === 'walk' && me().data.eased === null, 60 * 4)
  for (let i = 0; i < 20; i++) truth.step(DT)
  expect(me().data.grounded).toBe(true)
  expect(me().data.pos[1]).toBeCloseTo(kinds.poolfar.shape.box.size[1], 2)
})

test('by the desk it sits at it typing, its hips on the seat, and stands up where it sat', async () => {
  const { truth, send, me, until, row, route, middle, pointOf } = await joined()
  const zone = row('deskzone').data.pos
  route([[LANE, ROW2], [zone[0], ROW2], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('typing')
  until(() => me().data.eased === null, 30)
  const seat = pointOf('deskzone', 'Seat').at!
  const hips = middle(['Hips'])
  for (let i = 0; i < 3; i++) expect(hips[i]).toBeCloseTo(seat[i], 2)
  // Handed back to walking where it sits, its feet on the ground beneath.
  const sat = [...me().data.pos]
  send('press', 'use')
  until(() => me().data.activity === 'walk' && me().data.eased === null, 30)
  expect(Math.hypot(me().data.pos[0] - sat[0], me().data.pos[2] - sat[2])).toBeLessThan(0.5)
  until(() => me().data.grounded, 60)
})

test('at the bed\'s foot it lies down on it, its hips where it lies, and gets up where it lies', async () => {
  const { truth, send, me, until, row, route, middle, pointOf } = await joined()
  // Round the bed to its foot.
  const zone = row('bedzone').data.pos
  route([[-LANE, ROW3], [-LANE, zone[2] + 1], [zone[0], zone[2] + 1], [zone[0], zone[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('liedown')
  until(() => me().data.motion === 'lie', 60 * 7)
  until(() => me().data.eased === null, 30)
  const bed = pointOf('bedzone', 'Bed').at!
  const hips = middle(['Hips'])
  for (let i = 0; i < 3; i++) expect(hips[i]).toBeCloseTo(bed[i], 2)
  // Handed back to walking where it lies, its feet on the ground beneath.
  const lay = [...me().data.pos]
  send('press', 'use')
  until(() => me().data.activity === 'walk' && me().data.eased === null, 30)
  expect(Math.hypot(me().data.pos[0] - lay[0], me().data.pos[2] - lay[2])).toBeLessThan(0.5)
  until(() => me().data.grounded, 60)
})

test('at the car\'s door it gets in, its hips on the seat; drives it, held on the seat; honks; and gets out', async () => {
  const { truth, send, me, until, row, route, middle, room } = await joined()
  const car = row('car')
  const zone = row('carzone')
  const seatOf = () => {
    const p = room.world.shapes3d.kinds.carzone.points.Seat.point.at, z = zone.data
    const s = Math.sin(z.yaw), c = Math.cos(z.yaw)
    return [z.pos[0] + p[0] * c + p[2] * s, z.pos[1] + p[1], z.pos[2] - p[0] * s + p[2] * c]
  }
  route([[LANE, ROW3], [zone.data.pos[0], zone.data.pos[2]]], 0.3)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('carin')
  until(() => me().data.motion === 'pilot', 60 * 7)
  until(() => me().data.eased === null, 30)
  const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 2))
  near(middle(['Hips']), seatOf())
  // Driving: the car goes ahead and turns, the hips on its seat all the while.
  const from = [...car.data.pos]
  send('stick', 0.5, -1)
  for (let i = 0; i < 90; i++) {
    truth.step(DT)
    near(middle(['Hips']), seatOf())
  }
  expect(Math.hypot(car.data.pos[0] - from[0], car.data.pos[2] - from[2])).toBeGreaterThan(2)
  expect(car.data.yaw).toBeLessThan(0)
  // The page draws the body on the seat as it draws the car: where its row stands with the car drawn
  // where the car's rows stand, and a bob of the car's drawn 0.1 m up with it.
  const part = room.rows.find(r => r.id === car.data.parts[0])!
  const group = new THREE.Object3D()
  const { page, root } = standIn(room, { solids: { group: () => group } })
  for (const bob of [0, 0.1]) {
    group.position.set(part.data.pos[0], part.data.pos[1] + bob, part.data.pos[2])
    group.rotation.set(0, part.data.yaw, 0)
    group.updateMatrixWorld(true)
    motion3d().tick(page)
    const at = root.getWorldPosition(new THREE.Vector3())
    near(at.toArray(), [me().data.pos[0], me().data.pos[1] + bob, me().data.pos[2]])
    expect(new THREE.Euler().setFromQuaternion(root.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y).toBeCloseTo(me().data.yaw, 6)
  }
  send('stick', 0, 0)
  until(() => car.data.speed === 0, 60 * 3)
  send('press', 'jump')
  truth.step(DT)
  // The honk on the upper half alone, from Spine1 up, the body driving on beneath it, its hips on the seat.
  expect(me().data.upper).toBe('honk')
  expect(me().data.upperBone).toBe('Spine1')
  expect(me().data.motion).toBe('pilot')
  expect(me().data.clip).toBe('drive')
  until(() => {
    near(middle(['Hips']), seatOf())
    return me().data.upper === null && me().data.was === null
  }, 60 * 4)
  expect(me().data.upperMotion).toBe(null)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe('carout')
  until(() => me().data.activity === 'walk' && me().data.eased === null, 60 * 7)
  until(() => me().data.grounded && Math.abs(me().data.pos[1]) < 1e-6, 60 * 2)
})

test('at the low wall it vaults over it, and walks on beyond it', async () => {
  const { me, row, kinds } = await oneShot('vaultzone', 'vaultone', -LANE, ROW2)
  const wall = row('vaultwall').data.pos
  expect(me().data.pos[2]).toBeGreaterThan(wall[2] + kinds.vaultwall.shape.box.size[2] / 2)
})

// Row five, past the car's lot: the crawl cube and the cave, each taken up with no key.
const ROW5 = 60

test('walked into the crawl cube it crawls, lies still with the stick let go, and walks out walking', async () => {
  const { truth, send, me, until, row, route, kinds } = await joined()
  const cube = row('crawlcube')
  const near = cube.data.pos[2] - kinds.crawlcube.shape.box.size[2] / 2
  route([[LANE, ROW1], [LANE, ROW5], [cube.data.pos[0], ROW5], [cube.data.pos[0], near - 1]], 0.3)
  expect(me().data.activity).toBe('walk')
  // In, the stick held: once the walk comes round, the cube's crawl, prone and going forward.
  send('stick', 0, -1)
  until(() => me().data.activity === 'crawl', 60 * 4)
  expect(me().data).toMatchObject({ space: cube.id, motion: 'crawl', clip: 'proneforward' })
  const at = me().data.pos[2]
  for (let i = 0; i < 60; i++) truth.step(DT)
  expect(me().data.pos[2]).toBeGreaterThan(at + 0.1)
  // Let go: lying still.
  send('stick', 0, 0)
  until(() => me().data.motion === 'still', 10)
  expect(me().data).toMatchObject({ activity: 'crawl', clip: 'proneidle' })
  // Out the far side: the cube no longer holds it, so the anywhere shape's walk.
  send('stick', 0, -1)
  until(() => me().data.activity === 'walk', 60 * 30)
  expect(me().data).toMatchObject({ space: null, motion: 'walk', clip: 'walk' })
})

test('jumped into the crawl cube it falls in, lands, and crawls', async () => {
  const { truth, send, me, until, row, route, kinds } = await joined()
  const cube = row('crawlcube')
  const near = cube.data.pos[2] - kinds.crawlcube.shape.box.size[2] / 2
  route([[LANE, ROW1], [LANE, ROW5], [cube.data.pos[0], ROW5], [cube.data.pos[0], near - 2.5]], 0.3)
  send('fast', 1)
  send('stick', 0, -1)
  until(() => me().data.motion === 'run', 60)
  until(() => me().data.pos[2] > near - 1.2, 60 * 2)
  send('press', 'jump')
  truth.step(DT)
  expect(me().data.motion).toBe('jump')
  until(() => me().data.motion === 'fall', 60 * 3)
  // Landed in the cube, the stick still held: it crawls.
  until(() => me().data.activity === 'crawl', 60 * 4)
  expect(me().data.grounded).toBe(true)
  expect(me().data.pos[2]).toBeGreaterThan(near)
})

test('walked into the cave the arms draw the torch and hold it over the walk; walked out, they put it away', async () => {
  const { send, me, until, row, route, kinds, room } = await joined()
  const cave = row('cave')
  const near = cave.data.pos[2] - kinds.cave.shape.box.size[2] / 2
  route([[LANE, ROW1], [LANE, ROW5], [cave.data.pos[0], ROW5], [cave.data.pos[0], near - 1]], 0.3)
  send('stick', 0, -1)
  until(() => me().data.upperMotion === 'draw', 60 * 3)
  expect(me().data).toMatchObject({ upperActivity: 'light_torch', upperSpace: cave.id, upper: 'tcdraw', upperBone: 'Spine', activity: 'walk', motion: 'walk' })
  until(() => me().data.upperMotion === 'hold', 60 * 4)
  // Held: the torch carried wholly, nothing played over the body, the legs walking on.
  expect(carrying(reader(room), me())).toMatchObject({ carry: { prop: 'torch' }, weight: 1 })
  expect(me().data).toMatchObject({ motion: 'walk', clip: 'walk' })
  // Turned round and out: the hold is over, its then puts the torch away, and then the arms are let go.
  send('look', Math.PI, 0)
  until(() => me().data.upperMotion === 'putaway', 60 * 8)
  expect(me().data).toMatchObject({ upper: 'bwsheath', activity: 'walk' })
  until(() => me().data.upperMotion === null, 60 * 4)
  expect(me().data).toMatchObject({ upperActivity: null, upperSpace: null })
  expect(carrying(reader(room), me())).toBe(undefined)
})

test('jumped into the cave the arms draw the torch while it falls, and hold it as it lands', async () => {
  const { truth, send, me, until, row, route, kinds } = await joined()
  const cave = row('cave')
  const near = cave.data.pos[2] - kinds.cave.shape.box.size[2] / 2
  route([[LANE, ROW1], [LANE, ROW5], [cave.data.pos[0], ROW5], [cave.data.pos[0], near - 2.5]], 0.3)
  send('fast', 1)
  send('stick', 0, -1)
  until(() => me().data.pos[2] > near - 1.2, 60 * 3)
  send('press', 'jump')
  truth.step(DT)
  expect(me().data.motion).toBe('jump')
  // Over the cave's mat in the air: the arms draw the torch before the feet are down.
  until(() => me().data.upperMotion === 'draw', 60 * 2)
  expect(me().data.grounded).toBe(false)
  until(() => me().data.grounded, 60 * 3)
  until(() => me().data.upperMotion === 'hold', 60 * 4)
  expect(me().data.upperSpace).toBe(cave.id)
})
