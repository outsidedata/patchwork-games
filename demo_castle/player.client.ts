// One seat's `player` row (`player.sim.ts`). anim draws the body, every seat's. For the
// seat's own row, the one that is `mine`, its keys and mouse, and the camera, which chasecamera3d holds on
// the row. Every key is the player's definition's `keys`, each naming the act of its name: the stick
// (left, right, forward and back), `slow` held and `jump`. The mouse dragged with `drag` held sends `look`
// with its pixels times `sens`, right turning the view right and down tilting it down; the wheel sends
// `zoom` with the pixels it turned.
//   The props anim hangs on every body (`world.anim.kinds.player.props`, the stick) cast shadows as the
// definition's `propsCast` says; anim makes each casting, so it is set on them every frame.
//   What every body carries in its hand, every seat's, in a scene that lists particle3d: the definition's
// `carry`, `{ effect, bone, at }`, an effect of the scene's effects file thrown once the body is built and
// moved each frame onto the bone, `at` metres off it in the bone's own frame with its scale taken off
// (as anim hangs a prop), the first of anim's posed body whose name ends with `bone`
// (anim's `socket`), which anim's `tick` has posed before this one runs, and particle3d draws it in its
// `afterTick`, after it. It is not thrown `from` the row, since particle3d would put it back on the
// row's `pos`, at the feet, in that `afterTick`; it runs without end and is stopped, its life set to
// its age, the first tick or remove of a player that finds its row gone from the page's rows.
//   Beside it, `carry.light`, `{ color, intensity, distance, decay, shadow }`, one three.js point light on
// render3d's scene at the same point, taken off the scene when the effect stops. It casts a shadow,
// `shadow` `{ map, near, bias, normalBias }`, from `near` metres out to the light's `distance` (50 m
// when it has none). In a scene that lists lights3d, lights3d draws it and its shadow from its
// atlases, `map` unused: what never moves drawn once, so as the light moves with the hand that shadow
// stays as it was first drawn, and what moves drawn each frame. In one that does not, three's own
// loop draws it, its shadow a cube of `map` texels a side, six more draws of the casters a frame.
import * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds, Input } from '#plugins/player/player.plugin.ts'
import type { Effect } from '#plugins/particle3d/particle3d.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let ours = false
// what each row carries, by its id: its effect, and its light on the render3d scene it was put on
type Carried = { fx: Effect; light: THREE.PointLight; scene: THREE.Scene }
const carried = new Map<number, Carried>()
const hand = new THREE.Vector3(), offset = new THREE.Vector3(), scale = new THREE.Vector3()
const turn = new THREE.Quaternion()

// A row's effect stopped, its life over at its age now, and its light taken off its scene.
const stop = (id: number) => {
  const c = carried.get(id)
  if (!c) return
  c.fx.life = c.fx.age
  c.scene.remove(c.light)
  c.light.dispose()
  carried.delete(id)
}

export function setup(row: Row, plugins: Plugins) {
  // a row drawn again, on a new client, carries a new effect and light of its own
  stop(row.id)
  ours = row.data.mine === true
  if (!ours) return
  const k = def(plugins.wire, row.kind)
  // chasecamera3d looks along (sin yaw, cos yaw), so a larger yaw turns the view left: right on the
  // mouse is less yaw. A larger pitch lifts the camera over the row and looks down.
  const look = (dx: number, dy: number): Input => ['look', -dx * k.sens, dy * k.sens]
  plugins.player.bind({
    stick: [{ keys: k.keys.stick, send: (x, y) => ['stick', x, y] }],
    hold: [{ keys: [k.keys.slow], send: v => ['slow', v > 0 ? 1 : 0] }],
    press: { [k.keys.jump]: ['jump'] },
    drag: { key: k.keys.drag, send: look },
    wheel: dy => ['zoom', dy],
  } satisfies Binds)
  plugins.chasecamera3d.follow(row.id)
}

// Everything carried by a row the page no longer holds, stopped.
const drop = (plugins: Plugins) => {
  for (const id of [...carried.keys()]) if (!plugins.wire.rows.some(r => r.id === id)) stop(id)
}

export function tick(row: Row, plugins: Plugins) {
  // whether the props anim hangs on the body cast shadows: every mesh of each, every frame, since anim
  // makes a prop again, casting, when its numbers change
  const cast: boolean = def(plugins.wire, row.kind).propsCast
  for (const prop of plugins.anim.props(row.id) as THREE.Object3D[]) prop.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = cast })
  if (!plugins.particle3d) return
  drop(plugins)
  const { effect, bone, at, light } = def(plugins.wire, row.kind).carry
  const socket: THREE.Object3D | undefined = plugins.anim.model(row.id) && plugins.anim.socket(row.id, bone)
  if (!socket) return
  // `at` metres off the bone, turned with it, its scale taken off
  socket.matrixWorld.decompose(hand, turn, scale)
  hand.add(offset.fromArray(at).applyQuaternion(turn))
  let c = carried.get(row.id)
  if (!c) {
    const scene: THREE.Scene = plugins.render3d.scene
    c = { fx: plugins.particle3d.emit(effect, hand.toArray(), { life: Infinity }) as Effect, light: new THREE.PointLight(), scene }
    scene.add(c.light)
    carried.set(row.id, c)
  }
  c.fx.at = hand.toArray()
  // the light's numbers read every frame, so a change to the definition shows at once
  c.light.position.copy(hand)
  c.light.color.set(light.color)
  c.light.intensity = light.intensity
  c.light.distance = light.distance
  c.light.decay = light.decay
  // its shadow, a cube of `map` texels a side reaching from `near` to the light's `distance`
  const sh = light.shadow
  c.light.castShadow = true
  c.light.shadow.bias = sh.bias
  c.light.shadow.normalBias = sh.normalBias
  const cam = c.light.shadow.camera
  const far = light.distance > 0 ? light.distance : 50
  if (cam.near !== sh.near || cam.far !== far) {
    cam.near = sh.near
    cam.far = far
    cam.updateProjectionMatrix()
  }
  if (c.light.shadow.mapSize.x !== sh.map) {
    c.light.shadow.mapSize.set(sh.map, sh.map)
    c.light.shadow.map?.dispose()
    c.light.shadow.map = null
  }
}

export function remove(plugins: Plugins) {
  if (plugins.particle3d) drop(plugins)
  if (ours) plugins.player.unbind()
}
