// hero: the hills' X Bot hero, demo_world3d's own plugin. Its server half, `hero.sim.ts`, is the hills' `player`
// rule; its mod for kinematics3d, `hero.kinematics3d.ts`, the state words the X Bot's motion3d file names. This,
// its page half, binds the seat's own `player` row's keys, mouse and gamepad, copied from demo_motion3d's
// `player.client.ts` (`bind`), which `player.client.ts` hands the row to in a scene that lists motion3d. It has no row and no
// numbers of its own: every key is the player's definition's `keys`, each a list of the keys of the keyboard, the
// mouse and the gamepad that do it (the player plugin's names):
//   stick     the way to walk, left, right, forward and back: read analog, so a stick pushed part way walks part
//             speed
//   look      the right stick, read analog, sent as `turn` with how far it is pushed across and down: the rule
//             turns the view at the definition's `camera.turn` and `tilt` while it is held
//   fast      held to run
//   guard     held to block, facing the way the camera looks
//   motions   each a motion's name to its keys, pressed as `press` with that name: motion3d plays it in the
//             activity the body is in
//   target    sent as `target`: the next mob targeted
//   talk      sent as `talk`: talking to the nearest one with something to say, or the talk ended
//   leave     sent as `leave`: the shop, trainer or enchanter open closed; `world.ui`'s `back`, which the ui
//             leaves to the game on a screen the game puts up
//   choose    a list of key lists, the i-th sent as `choose` with i: the i-th choice of what was said
//   nearer, further   the camera in and out by `camera.step` of the wheel's pixels a press
// The mouse dragged with `drag` held sends `look` with its pixels times `sens`, right turning the view right and
// down tilting it down; the wheel sends `zoom` with the pixels it turned. chasecamera3d follows the row.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds, Input } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

// The seat's own row's keys bound, and the camera on it; `player.client.ts` calls it from its `setup`.
export function bind(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind)
  const keys = k.keys
  // Each of a button's keys presses it.
  const press: Record<string, Input> = {}
  const button = (list: string[], input: Input) => { for (const key of list) press[key] = input }
  for (const [motion, list] of Object.entries(keys.motions as Record<string, string[]>)) button(list, ['press', motion])
  button(keys.target, ['target'])
  button(keys.talk, ['talk'])
  button(keys.leave, ['leave'])
  ;(keys.choose as string[][]).forEach((list, i) => button(list, ['choose', i]))
  button(keys.nearer, ['zoom', -k.camera.step])
  button(keys.further, ['zoom', k.camera.step])
  // chasecamera3d looks along (sin yaw, cos yaw), so a larger yaw turns the view left: right on the mouse is less
  // yaw. A larger pitch lifts the camera over the row and looks down.
  plugins.player.bind({
    stick: [
      { keys: keys.stick, send: (x, y) => ['stick', x, y], analog: true },
      { keys: keys.look, send: (x, y) => ['turn', x, y], analog: true },
    ],
    hold: [{ keys: keys.fast, send: v => ['fast', v] }, { keys: keys.guard, send: v => ['guard', v] }],
    press,
    drag: { key: keys.drag, send: (dx, dy) => ['look', -dx * k.sens, dy * k.sens] },
    wheel: dy => ['zoom', dy],
  } satisfies Binds)
  plugins.chasecamera3d.follow(row.id)
}

// The plugin shipped loads, so its mod for kinematics3d is found by its name. Its `afterTick` draws the target: a
// ring of the definition's `ring` `{ inner, outer, colour }` metres and colour at the feet of the mob the seat's own
// `player` row targets (`target`), drawn over everything, and none while it targets none.
export function hero() {
  let ring: THREE.Mesh | undefined
  return {
    afterTick(plugins: Plugins) {
      const T: typeof THREE = plugins.render3d.THREE
      const me = plugins.wire.rows.find(r => r.kind === 'player' && r.data.mine === true)
      const target = me && me.data.target !== null ? plugins.wire.rows.find(r => r.id === me.data.target) : undefined
      if (!ring && me) {
        const r = def(plugins.wire, me.kind).ring
        ring = new T.Mesh(new T.RingGeometry(r.inner, r.outer, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: r.colour, side: T.DoubleSide, depthTest: false, transparent: true }))
        ring.renderOrder = 999
        ring.frustumCulled = false
        plugins.render3d.scene.add(ring)
      }
      if (!ring) return
      ring.visible = !!target
      if (target) ring.position.set(target.data.pos[0], target.data.pos[1] + 0.05, target.data.pos[2])
    },
    close() {
      if (!ring) return
      ring.removeFromParent()
      ring.geometry.dispose()
      ;(ring.material as THREE.Material).dispose()
      ring = undefined
    },
  }
}
