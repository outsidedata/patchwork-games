# demo_wormhole

A first-person portal game. The player walks a test chamber and puts down two linked portals, a
red one and a white one, on its walls and floors. Whatever goes in at the front of one comes out of
the front of the other, keeping its speed: the walker, physics bodies (crates, balls, prisms), laser
beams, and the view through the opening. Around that core are the pieces of a test chamber: lasers
and the catchers they light, floor buttons, doors those open, a redirection prism, a barrier field,
dark surfaces that refuse portals, a bounce pad, a faith plate, a dropper and a lift.

It is a core game: every rule is a kind's `<kind>.sim.ts`, every drawing a `<kind>.client.ts`, every
number a definition in `assets/demo_wormhole.json`, and the two systems that belong to this game
alone, the level and the portals, are plugins in its own `plugins/` folder.

## Running it

```
yarn editor demo_wormhole                     # prints its url; the pages below are served under it
```

- `index.html`: the game, the manager and its scenes in the tab, one seat over a loopback.
- `dev.html?scene=<scene>`: the testbed. It is `index.html` entering the named scene (`main` when
  none is named), with the scenes' truths on `window.__scenes` (`__scenes.get('gym').rows`), the page
  on `window.page`, each drawn frame's camera in `window.drawn`, and an error in a step or a frame
  printed over the page and kept on `window.__error`.
- `client.html`: one seat over a socket to the server, running its scene ahead of it
  (`addons/predict`). The server is
  `node --experimental-strip-types games/demo_wormhole/demo_wormhole.server.ts`, on the manager's
  `port` (9124).

The tests, from the repo's root:

```
yarn vitest run games/demo_wormhole/demo_wormhole.sim.test.ts
yarn vitest run games/demo_wormhole/main.sim.test.ts
yarn vitest run games/demo_wormhole/plugins/chamber/chamber.plugin.test.ts
yarn vitest run games/demo_wormhole/portal.client.test.ts
```

The baked surfaces, from the repo's root (`yarn health` first checks Blender, the library, gltfpack
and ImageMagick):

```
yarn bake demo_wormhole
```

## Controls

| Input | Act | What it does |
| --- | --- | --- |
| WASD, arrows | `move` | Walk, relative to the view. |
| Mouse (under pointer lock) | `look` | Turn the view; pitch is held within `player.pitch` of level. |
| Space | `jump` | Jump `walker.kinds.player.jumpH` metres. |
| Left click | `place 0` | Put the red portal where the reticle points. |
| Right click | `place 1` | Put the white portal where the reticle points. |
| E down, E up | `charge`, `throw` | Throw a new body of the start's `throws` kind, or the carried one. Held longer, it leaves faster. |
| F | `grab` | Pick up the body under the reticle, or let go of the one carried. |

A click takes the pointer lock. The HUD, top left, shows which portals are placed and whether a body
is carried; a dot marks the middle of the screen.

## Scenes

`demo_wormhole.scene.json` is the manager. It lists the scenes and enters `main`. Every scene
extends `demo_wormhole.partial_scene.json`, which holds what they share: the plugins' tables
(`world.walker`, `world.box3d`, `world.ui`, the loader catalogue), the camera and lights, and a
prefab for every kind. A scene's own file holds only its actors and the level its `chamber` names.

| Scene | Level | What is in it |
| --- | --- | --- |
| `main` | `main` | The room, a ramp up to a ledge, the seat and its portals. No physics bodies. |
| `boxes` | `main` | `main` with box3d and one crate dropped ahead of the start. The seat throws crates. |
| `pour` | `pour` | A bin of balls standing over a floor portal, its partner high on the back wall. The balls pour out of the wall. |
| `gym` | `gym` | Every mechanic in one room, in no order: the sandbox. |

What stands in the gym: the ramp and ledge, a back wall and a right wall for portals, a bin a
`hopper` fills with balls, a stack of crates and a prism, a laser across the back of the room, a
catcher far from its beam that opens one door, a button that opens another, a dark pillar, a field,
a bounce pad, a faith plate that throws the seat at the back wall, a dropper and a lift.

Each scene has a `<scene>.sim.ts` beside its file, naming the kinds it runs.

## Coordinates

Metres, y up. A view is `[yaw, pitch]`; yaw θ faces `(sin θ, cos θ)` on x and z (walker's law), so
yaw 0 looks down +z. A turn is a quaternion `[x, y, z, w]`.

A portal's frame is its `normal` (its front), its `up`, and its right, `up × normal`. Taking anything
through from portal A to portal B means expressing it in A's frame and reading it back in B's, turned
half a turn about up, so right and front reverse and up stays. `vector`, `point` and `turned` in
`plugins/portal/portal.sim.ts` do this for a direction, a point and a turn. Every system that passes
something through a portal uses those three functions and no other.

## The systems

### The chamber: `plugins/chamber/`

The level. The `chamber` row names a level in its definition's `levels`. A level is `boxes`
(axis-aligned solids, each drawn in a `surface`, optionally `dark` to refuse portals, or `bounce` to
throw what lands on it back up), `ramps` (wedges rising toward `toward`, each in a `surface`),
`strips` (the light strips, drawn and nothing else) and a `probe` (where its reflection is seen
from). The one level description feeds every consumer:

- `chamber.sim.ts`: `heightAt(w, x, z)` is the ground the walker stands on: the highest piece over a
  point, with each portal's opening cut in (a pit `pit` metres deep under a floor portal; a wall
  lowered to the opening's bottom edge across the opening's width, so the walker can step into a
  wall portal), and every door and lift standing on it as a box. `ray` is the first face a line
  meets, with its normal and box index, which portal placement uses. `bounds` is the floor plan the
  walker is kept inside.
- `chamber.walker.ts`: the walker's `height` mod, `heightAt`.
- `chamber.box3d.ts`: box3d's `ground` mod, the whole level as one fixed body (boxes as boxes,
  ramps as hulls, a `bounce` as restitution), and its `kinds` mod, the bodies of crates, prisms and
  balls (dynamic) and of doors and lifts (kinematic), each made from its definition.
- `chamber.plugin.ts`: draws the level, once, on the first frame its row is there, and the light it
  is seen by (The look, below). Its `surfaced`, `panelled` and `glowing` are how every kind's look
  draws in the chamber's surfaces.

The game's plugins are loaded by the `shipped` plugin (`world.shipped.plugins`: `chamber`, then
`portal`), since the engine loads only top-level plugins by name.

### The look

Shiny black metal in a void, lit by strips, with red as the one accent. Every number is the
chamber's definition and the kinds' own in `assets/demo_wormhole.json`, and render3d's and
environment3d's prefabs in `demo_wormhole.partial_scene.json`.

- **Surfaces** (`chamber.surfaces`). A baked surface is 0.5 m panels with a bevelled seam round
  each, baked in Blender by `assets/surfaces/panels.py` from a cc0-textures set (the surface's `set`,
  `Metal029_4K-JPG` or `Metal027_4K-JPG`), whose maps the bake's `texture` takes from the library
  (`PATCHWORK_LIBRARY`), downloading the set first when it is not there, and cut to WebP by
  `assets/demo_wormhole.bake.ts`, which writes each map
  where the catalogue's entry reads it. Only the WebP maps are in the game. `gloss`, glossy black, is
  what a portal takes; `matte`, rough charcoal, is a `dark` box and the ramps; `crate` is one panel to
  a face with a line of light inset round it. Each panel varies a little in brightness and roughness
  and reads its own place in the set, so neighbours never repeat. The plain surfaces are a colour and
  a roughness: `gunmetal` (doors, lifts, the laser's housing, catchers, buttons, the dropper, prisms),
  `ceramic` (balls), `lamp` and `pad` (what glows white). A baked surface's panels are laid on the
  world (`panelled`), so a seam runs on from one box to the next.
- **Strips** (`chamber.strip`, each level's `strips`): thin bars shining white past 1, the room's
  light, at the walls' feet and tops and the ledge's edges.
- **Reflection** (`chamber.env`): the level seen from its `probe`, its walls dim and its strips
  shining, made once render3d has a renderer and laid on the scene's environment, so the black
  panels reflect the strips round them.
- **Haze** (`chamber.haze`): the scene's fog. **Key light**: environment3d's cool overhead sun with a
  soft shadow, and a dim sky. **Bloom**: render3d's, low, on what shines past 1 alone. Tone mapping
  is `neutral`.
- **Portals**: a thin rim shining its `rims` glow, a halo inward from the opening's edge, a film of
  its glow while it has no partner, and its own light in front of it.
- **Red** is what is live or dangerous: the red portal, the laser's beam, a lit catcher, a pressed
  button, the field.

### The seat: `player.sim.ts`, `player.client.ts`

The `player` row is a walker (`plugins/walker`, `world.walker.kinds.player`) on the chamber's
ground. Its start is the `start` actor of its slot, which also gives the kind it `throws`; a scene
whose start throws nothing has no throwing or carrying.

- Placing a portal casts from the eye along the view with the chamber's `ray`. It puts the portal
  centred on the hit, its front the face's normal, its up straight up on a wall or the view's way on a
  floor. It puts nothing down on a ramp, on a `dark` box, past a field, or on nothing. The first
  placement spawns the portal; later ones move it.
- Going through: each step, if the line the body's centre travelled crosses a portal's front inside
  its opening while the other portal stands, the body is put where it would be on the other side.
  Its centre, its velocity (all three axes) and its view are carried through, so a fall into a floor
  portal comes out of a wall portal as horizontal speed. Out of a wall portal it is pushed clear of
  the wall's face. `jumps` counts the crossings.
- Carrying holds a body `grab.hold` metres along the view by setting its velocity toward that point,
  capped at `grab.most`, so a carried body still collides. A body a portal takes is let go.
- Throwing spawns a body ahead of the eye, or releases the carried one, at `throw.speed` plus the
  walker's own velocity, rising to `throw.most` over `throw.full` seconds of charge.
- Landing on a `bounce` box throws the walker back up; falling below `fall` stands it back on its
  start. `zap` is the act rules use to throw it (the laser, the faith plate).

`player.client.ts` binds the keys, puts render3d's camera at the eye, and draws the reticle and HUD.

### Portals: `plugins/portal/`

A `portal` row is an opening `width` by `height` on a chamber box (`on`), with `pos`, `normal`, `up`,
its `name` and the name it leads `to`. A portal is live only while the portal it leads to stands;
`other(w, a)` finds it.

**Bodies through portals** (`portal.sim.ts`, the `portal` kind's tick). Box3D's one world cannot
hold a body halfway through a hole into another place, so each live portal holds a Box3D world of its
own, one per truth and never sent to a page. When a body of a kind in `portal.takes` comes within the
opening (plus `edge`) and within `room` metres in front of it, it is taken out of box3d's world (its
row's `enabled` false, `inside` the portal's name, its speed kept in `drift`) and stepped in the
portal's world, which holds:

- the level's boxes near this portal, on its side of its plane;
- a rim of boxes around the opening behind its plane, so a body over the opening falls in and a body
  beside it rests on the surface;
- the level near the other portal, carried through to stand behind this one, so the part of a body
  that is through meets what is on the far side.

Once a body is wholly behind the plane, it is carried through to the other portal (place, turn,
speed, spin) and handed back to box3d's world there, its `jumps` one up. A body that leaves the space
in front of the portal without going through is handed back where it is. The portal's world is
rebuilt whenever either portal moves.

**Beams through portals.** `trace(w, from, dir, far, passes, marks)` is a line through the portals:
it ends on the first box3d body or fixed shape it meets (`castRayClosest`) or on a sphere of a
`marks` kind, and where it enters an opening it continues from the matching point of the other
opening.

**The portals' lights** (`portal.plugin.ts`, `portal`). One point light for each portal the
definition's `rims` names, made dark on the plugin's first tick and lit while its portal stands, so
the scene's light count never changes and placing a portal never rebuilds every lit material's
program on the frame it lands.

**The view through a portal** (`portal.client.ts`). Each opening is a pane drawing a texture. Each
frame, just before the pane is drawn, a second camera stands where the main camera would be had it
gone through this portal, its near plane laid on the other portal's plane (an oblique projection), and
draws the scene into a texture the size of the drawing buffer; the pane samples it at its own screen
pixel. All panes are hidden during that draw, so the view is one level deep. The programs that draw
into that texture are built in the background as soon as a portal stands, so the frame a pair first
opens does not stall on them.

**Bodies drawn on both sides** (`portal.plugin.ts`, `seen`). A crate or ball `inside` a portal is
drawn twice: where it is, cut away behind this portal's plane, and carried through to the other
portal, cut away behind that one's plane. The cut is a discard in the material's fragment shader,
spliced in through render3d's `dress`.

**Drawing without smears.** render3d blends each object between steps. On the frame something is put
somewhere new (a crossing, which changes `jumps`; a portal placed; a beam re-traced) its
`userData.teleport` is raised, and render3d draws it where it is set instead of sliding it there.

### Lasers, catchers, prisms: `laser.sim.ts`, `catcher.sim.ts`, `prism.sim.ts`

Each step a laser traces its beam from `pos` along `dir` through the portals, up to `reach` metres in
all. A beam that ends on a prism goes on from the prism's front (its local +z), at most `bends.most`
times. The row keeps `beam` (each stretch's points, in and out of each portal) and `hit` (the row it
ends on). A catcher is `on` while a beam ends on it. A walker standing in a beam is thrown along it
(`hurt`). A scene with a laser runs box3d: the beam stops on what box3d's world holds, the level's
fixed body included.

### Switches and doors: `button.sim.ts`, `door.sim.ts`

A button is `on` while a row of a `pressedBy` kind stands on it. A door lists, in `by`, the names of
the catchers and buttons that open it; while any of them is on it sinks its own height into the floor
at `speed`, driven as a kinematic box3d body through `target`, and stands on the walker's ground the
whole time.

### The rest of the room

- **Field** (`field.sim.ts`): a box that ends any portal-takeable body whose centre enters it, closes
  both portals when the walker's feet or head enter it, and blocks portal placement through it.
  Beams pass it.
- **Faith plate** (`plate.sim.ts`): throws a walker on the ground, or a resting body, standing on it
  at its `launch` velocity.
- **Dropper** (`dropper.sim.ts`): keeps one body of its `kind` in the world, spawning a new one at
  its `pos` whenever the last is gone.
- **Lift** (`lift.sim.ts`): a kinematic platform riding between `a` and `b` at `speed`, resting `wait`
  seconds at each end.
- **Hopper** (`hopper.sim.ts`): on its first step spawns a grid of balls, `count` by `spacing`,
  jittered by the scene's die so they do not stand in perfect columns. Not drawn.
- **Crate, ball, prism**: box3d bodies with no rules of their own; box3d moves them, and a portal's
  world moves them near a portal.

## Where things live

| Path | What it is |
| --- | --- |
| `assets/demo_wormhole.json` | Every kind's definition, the chamber's levels, surfaces, strips, reflection and haze. |
| `assets/demo_wormhole.bake.ts` | `yarn bake demo_wormhole`: every baked surface, from the library to WebP where the catalogue reads it. |
| `assets/surfaces/panels.py` | The Blender bake of a surface's panels from its cc0-textures set's maps. |
| `assets/surfaces/<surface>/` | The baked maps the game reads. |
| `demo_wormhole.scene.json`, `demo_wormhole.sim.ts` | The manager. |
| `demo_wormhole.partial_scene.json` | What every scene shares. |
| `<scene>.scene.json`, `<scene>.sim.ts` | A scene: its actors and the kinds it runs. |
| `<kind>.sim.ts` | A kind's rule. |
| `<kind>.client.ts` | A kind's drawing (and, for `player`, the keys and camera). |
| `plugins/chamber/` | The level: ground, rays, box3d bodies, drawing, surfaces, strips, reflection, haze. |
| `plugins/portal/` | Portals: going through, portal worlds, beams, two-sided drawing, their lights. |
| `demo_wormhole.server.ts` | The socket server `client.html` dials. |
| `index.html`, `client.html`, `dev.html` | The pages. |
| `demo_wormhole.sim.test.ts` | A body dropped into a floor portal flies out of a wall portal at the speed it fell. |
| `main.sim.test.ts` | A bot on a predicting page climbs the ramp, places both portals, runs off the ledge, and comes out of the wall at the speed it fell; the camera is never drawn between the portals. |
| `plugins/chamber/chamber.plugin.test.ts` | Every box and ramp is drawn in its surface, its maps the loader's and laid on the world; strips shine and cast no shadow; the fog is the haze; every ramp face faces out. |
| `portal.client.test.ts` | One dark light per portal from the start; a placed portal lights its own in front of it, its rim shines its glow, both openings open; a portal taken out darkens its light. |

Each file's header says what it does in full. Read it before changing the file.
