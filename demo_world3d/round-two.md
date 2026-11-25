# Round two: rooms and the outdoors become part of the place

## Where round one left it

Round one made the game's own plugin `rooms` (`plugins/rooms/rooms.plugin.ts`, its header says all of it). It lights
every surface inside a room in the shader from the room's light hints, and while the camera stands in a room it stops
the sun's shadow map, stops drawing the outdoors unless an opening is in view, eases the exposure up and throws
sunbeams. Nothing is baked. It runs in `lightlab.scene.json` and `tavern.scene.json`, every number in `world.rooms`.

The hints are places of the nav graph whose `data` is `{ light: { part, ... } }` (the library's
`stronghold/src/lib/util/light.mjs`): `room` (a box from `low`, `high`, `across`), `opening` (with `inward`, `across`,
`width`, `height`, `sky`, `beam`, and `rooms` for one between two rooms), `lamp` (a fire of a `kind`), `dark` (a box
under a leaf). They ride the nav file because the build already carries every solver place into it, moved and turned
into the scene's space (`pro-ng-compiler.mjs`, the metadata; `pro-ng/town_nav.py`).

What is wrong with round one, and what round two fixes:

1. **The hints are written by hand in each solver.** `solvers/lightlab/*/*.mjs` and `solvers/winterfell/tavern/tavern.mjs`
   call `lighting()` and write every room, window, door, stair hole, fire and dark patch themselves, from numbers the
   solver already handed the build in the same breath (the box's `windows`, `doors`, `stairs`; each leaf's plot). Take a
   window out of a box and its hint stays; add one and it has none. Every other solver (village, spire, colonial,
   office, Rome, Qing...) has no hints, so none of their rooms are lit.
2. **The outdoors is the game's, not the place's.** The hour, the sky's look, the fog, the sun's shadow box and what
   counts as outdoors (`world.rooms.mods.outdoors`) are typed into each game scene by hand. world3d hands a game what it
   stands on, the ways, the looks, the clips, the effects, the hairs, the hollows; it does not hand the world's light.
3. **Some of what the solver says is lost.** A solver's `exit: true` on a walk place (the place outside a door) does
   not reach the nav file (`games/demo_world3d/assets/tavern/tavern.art.nav.json` has none). Round two's outdoors needs
   to know which side of a door is outside.

The north star is config-driven development: the solver's config is the program. A solver says what it places; the
build turns that into everything a game reads, with no solver writing the same fact twice, no guessing from the data,
and everything opt in.

## The library: stronghold and pro-ng

### A bake flag that writes the room hints

One switch in the build's asks (beside `ground` and `overrides` in the asks file `build.mjs` takes with `--config`),
say `light: true`, makes the build write every hint itself. No solver code changes. Where: the compiler, which already
walks every solver's placed things and its nav, each in its solver's own space, and moves the nav into the scene's
(`pro-ng-compiler.mjs`, `solved` and the metadata). Read it end to end first: the place hints are written must be the
same space the nav places are moved by, so they come out right in the map's space for a turned branch, as round one's
do.

From what is placed, per thing:

- **A box** (a `thing:box` entry; `winterfell/tavern/box`, `lightlab/box`, `colonial` boxes...): a `room` hint, its
  inside from the box's `x`, `y`, `width`, `depth` (or `size`), `elevation`, and its leaf's `wallDepth`, `floorDepth`,
  `ceilingDepth` (`leaves.mjs`, `leaf(kind).keys`). A box with `skip` faces is still one room; its skipped face is
  shared with the box beside it.
- **Each window and door of a box**: an `opening` hint. Its middle, its way in and its way along come from the
  opening as pro-ng takes it, a face (0 east, 1 north, 2 west, 3 south) and shares of that face (`opening()` in
  `src/lib/util/openings.mjs`; `pro-ng/model.py`, `Box.window_cube`). `light.mjs`'s `wallOpening` is the forward
  direction (plot point to shares); the build needs the reverse (shares to middle), and it must be the same arithmetic.
  `sky` and `beam` true for an opening on an outside face, both false for a door in a face shared with another box,
  which instead is an opening between the two rooms (`rooms`).
- **Each stair of a box**: an opening between the box's room and the room above, the hole pro-ng cuts through the
  ceiling (`pro-ng/model.py`, `Stair.lay`, HEADROOM and JOINT). The stairwell and tavern solvers each hold a copy of
  that arithmetic and of HEADROOM and JOINT; the build holds it once, and both copies go.
- **Which room is above which**: a box standing on another box's top (the tavern's `upper` on its ground floor, the
  stairwell's upper on its lower) is the room a stair hole opens into. Find it from where each box stands, not from
  names.
- **Each leaf standing on a room's floor**: a `dark` hint, its footprint from its plot and its height from its kit
  (`size(kind).height`).
- **A leaf that burns**: its own leaf file (`stronghold/leafs/.../<kind>.leaf.json`) says so, once, e.g.
  `"light": { "lamp": "hearth", "up": 0.3 }`, the fire's kind and how far over the leaf's top it burns. Every hearth in
  every solver then lights its room. A leaf with no `light` burns nothing.

What only a solver knows stays a short explicit line in it: a box split into several rooms by inner walls (colonial
floors cut cells), and any room that is not a box. Decide the form with Bill; it is config, not code.

Then delete: every `lighting()` call and hint in `solvers/lightlab/*` and `solvers/winterfell/tavern/tavern.mjs`
(round one's), the tavern's `HEADROOM`, `JOINT`, `FIRE_UP` in its `rules.mjs` (the hearth's leaf file holds the fire's
height), the stairwell's and hearth room's copies, and whatever of `light.mjs` nothing uses after.

The hint format itself does not change: the game reads the same nav places.

### The outdoors, said by the solver

The top solver's config gets an outdoors block: what the world outside is. At least what the game's scene now types
by hand for skydome3d: the clock (`t` or an hour, `rate`, `doy`, `lat`, `phase`, `day`), the look, the shadow box; and
what is outdoors for rooms (the land, the sky, what grows). Its shape is Bill's to say before any code; write the
config first and show it. Every solver that sets none hands none (opt in).

The build writes it as one more part of the place beside the others, say `<place>.outdoors.json`, read by world3d as a
new part in `PARTS` (`plugins/world3d/world3d.sim.ts`) and copied by the game's bake (`MADE` in
`assets/demo_world3d.bake.ts`).

### What the solver said that is lost

- `exit: true` on a walk place: find where it drops between the XML (`pro-ng-compiler.mjs` writes `exit` into the
  metadata's joins) and the nav file (`pro-ng/town_nav.py`), and carry it into the place's data, so a game knows the
  outside side of every door.

### Checks

Each solver's own checks stay. The build's hints get a check run on every place built with the flag: every room has
its openings, no hint place stands within a millimetre of another (`light.mjs`, `together`, since town_nav merges such
places), every stair hole opens into a room. `stronghold/tree.mjs <key>` runs one solver; never the whole
`solvers.test.mjs` (it takes far too long).

## Core: world3d hands the whole world

world3d today hands: the glb, looks, clips, shapes3d, nav, hollows, effects, crowd, hairs (`world3d.sim.ts`, the
parts), each to the plugin that uses it through a mod. Round two adds the place's light, inside and out.

- **The outdoors part**: world3d hands it to skydome3d through a mod. skydome3d reads its clock from its row's prefab
  (`world.skydome3d`, the row's `t`, `doy`, `lat`, `phase`, `rate`) and its look and shadow from `world.skydome3d`; a
  mod key that takes these from a place is an expansion of a core plugin, its shape agreed with Bill first, and the
  scene's own values stay the override over the place's. The clock is a row's field and the server half sets it, so
  read skydome3d's `sim.ts` before choosing where the mod reads.
- **The rooms**: `rooms` stays the game's own plugin in round two (`games/demo_world3d/plugins/rooms/`) unless Bill says
  it moves. It reads the hints by the catalogue name in `world.rooms.hints`; with world3d handing the nav, it could take
  them through a world3d mod instead and name nothing. Decide with Bill.
- **What is outdoors**: today the game's scene lists it (`world.rooms.mods.outdoors: ['instances3d', 'grass3d']`, each a
  mod beside `rooms`: `instances3d.rooms.ts`, `grass3d.rooms.ts`, reading `instances3d.drawn()` and `grass3d.drawn()`).
  With the outdoors part, the place says it.

Round one's core changes, already in and tested, which round two builds on:
- `instances3d.drawn()` and `Instances.meshes()` (`plugins/instances3d/instances3d.plugin.ts`)
- `grass3d.drawn()`, and `world.grass3d.hollows` with `mods.hollows` (`plugins/grass3d/grass3d.plugin.ts`,
  `grass3d.glsl.ts`, `grass3d.sim.ts`), with world3d's `world3d.grass3d.ts`
- `world3d.mesh()` (round one's predecessor added it; `rooms` swaps its index to draw only the rooms round the camera)

## The game: demo_world3d

- `assets/demo_world3d.bake.ts`: the light flag on the light lab's and the tavern's places (in their asks), and every
  stronghold place once each solver is checked with it; the new part in `MADE`; its catalogue entry written as the
  others are.
- `lightlab.scene.json`, `tavern.scene.json`: `world.rooms` keeps its numbers (fires, exposure, beams, margins); the
  skydome3d clock, look and shadow come from the place, the scene keeping only what it overrides. Every other
  stronghold scene (village, spire, house) gets `rooms` and `shipped` once its place has hints.
- `plugins/rooms/rooms.plugin.ts`: unchanged in what it does; what it reads moves as the core decisions above say.
- `dev.html`: `__stand(place, look)` and `__hour(h)` drive a check from the console; the readout shows `rooms.state()`.
- `README.md`: the light lab paragraph, again, when it is done.

## How round one was proven, to prove round two the same way

In Chrome on `dev.html?scene=lightlab` and `?scene=tavern`, the torch off through `window.__defs.player.carry.light.
intensity = 0` for the room shots, each state read off `window.__client.plugins.rooms.state()` before its shot:

1. Outside at 11:00 the place looks as any outdoor scene does.
2. Inside, facing a wall: `skydome3d.sky().key.shadow.autoUpdate` false; back outside, true.
3. Inside, facing a wall: draw calls 18 against 193 outside; the vegetation and the meadow hidden.
4. Inside, facing a window: the outdoors drawn through it.
5. `__hour(15)` moves the sun patch from the floor onto the wall; nothing baked.
6. Each lab room: the sun room's patches, the east room lit only through the doorway, the hearth room by its fire,
   the long room darker at the back, the stairwell's lower room lit down the stair. The crowded room was not yet looked
   at.
7. Programs the same across three crossings of a door (52).
8. At 22:30 the hearth room glows through its door from outside.
9. The torch lights the room and casts its shadows.
10. The tavern lit from its solver's hints with config only.

Round two passes when the same ten hold with every hint made by the build, the outdoors handed by the place, and the
village, spire and house lit too.

## Tests in place

- `games/demo_world3d/plugins/rooms/rooms.plugin.test.ts`: the lab's hints read as rooms, the sun at the scene's hour
  through the sun room's window, the east room's only opening, the hearth's fire, a two-storey wall drawn with either
  room. Its fixture is the baked lab's nav file and scene, so it reads whatever the build writes.
- `plugins/grass3d/grass3d.plugin.test.ts`: a building handed as a hollow reaches every blade's shader.
- `plugins/instances3d/instances3d.lod3d.test.ts`: `drawn()` is what is on the scene after a grow.

## Left from round one

- The crowded room has not been looked at in Chrome.
- The torch at `exposure.inside` 8 swamps every room; the exposure and the fire's gain want Bill's eye.
- An open door leaf does not block the sun patch (the hints know nothing of the leaf).
- Nothing of round one is committed: core's `dev`, the games repo's `dev`, and the library's `dev` (the tavern solver's
  hints) each have it uncommitted.
