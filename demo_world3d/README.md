# demo_world3d

Run about pro-ng's town, and watch its people go about it.

The town is the library's pro-ng `smallville.town` (its scene `pro-ng/scenes/castle/smallville/smallville.town.json`, the game export,
`pro-ng/GAME_EXPORT.md`): a castle of curtain walls with battlements, four round towers with spiral stairs up to their
roofs, a gatehouse with a portcullis, stone stairs up to the walls, and inside the bailey the keep (the great hall with
its stair up into the solar), joined by a passage to the kitchen, the store, the stable, the chapel, the armoury and
the lodging, with the bailey's well, cart, smithy and stores. Outside the gate a cobbled lane runs south past the market
and its alehouse to the tavern (a loft up its stair, and a ceiling fan turning over its tables), the workshop and six huts. Every room is furnished from pro-ng's
kit. Each landmark is its own file (`.art.json`) placed in the town; beside each, its metadata (`.art.metadata.json`)
holds where a person stands in it, the ways between those places, its stairs and its exits, and the town's metadata
holds the streets and which landmarks join which.

The town is world3d's (`plugins/world3d`): the scene names its place, `world.world3d.place: "smallville.town"`, and
world3d reads the files pro-ng's build writes for it and nothing else of it: it draws the town's geometry and plays
its moving things' clips, and hands what a body walks on to shapes3d, its ways to nav3d, its looks and course table to
supershader3d, and its hollows, a box round each building standing at elevation 0, to lod3d, which draws no grass,
trees or stones in them. The game adds its player, its visitors and its torches.

## Playing

`yarn dev`, then `localhost:5173/games/demo_world3d/index.html`. You start on the place the town's metadata marks `start` (its `data`), on the lane outside the gate.

| key | what it does |
| --- | --- |
| W A S D | run, the way the camera looks |
| Shift | walk |
| Space | jump |
| right mouse button, dragged | turn and tilt the camera |
| wheel | the camera nearer or further |

You walk on every floor, up every stair (the towers' spirals, the hall's stair to the solar, the tavern's to its loft,
the stone stairs to the walls) and onto every roof that is stood on.

`dev.html` is the testbed: `?graphs=1` draws the town's graph, the panel puts you on any of its places, and the readout
shows where you stand and where each visitor is going, and lights3d's lights and the still and moving shadow tiles it
drew this frame. Its `lights` folder starts main cut down, to be built back a piece at a time: one torch (`?torches=n`,
`all` every one), one visitor (`?people=n`, `all`), no fog (`?fog=1` keeps it); `?atlas=` and `?tile=` set the shadow
atlases' size, `?torchshadow=0` takes the torch's shadow off and `?lights3d=0` takes lights3d out. Live, it sets the
torch lamp's intensity, reach, decay, flicker and shadow, the carried light on and off, the exposure, the fog's
numbers, and the castle drawn in one flat grey material in place of its relief looks; "copy lights JSON" copies the
lamp and the fog for the files.

`dev.html?scene=village` is the village: stronghold's village solver run once, compiled into the library's pro-ng
scene `pro-ng/scenes/village/village.art.json` and its metadata, and baked the way the town is, its files in
`assets/village/`. It is main with the village in place of the town, world3d's place `village.art`: the same kinds and
definitions, the player on the start place its metadata marks, the visitors on its graph.

`dev.html?scene=bridge` is the bridge: a field, a bridge 3 m up across it on two piers, a ramp down from each end, and
a road under it. Its people walk over the bridge, under it on the ground and up and down its ramps, along a graph
written by hand (`assets/bridge.nav.json`), each way one straight line of shapes3d's: up a ramp, across the deck, along
the road. It shows npc3d's people on routes that climb, with people at two heights at one place on the ground. Beside
the bridge a man goes up and down a spiral, three turns rising 3 m, a way of the graph that is a shapes3d spline: he
walks its curve, as crowd3d walks a spline a straight piece at a time.

## Quests

In the village and the tavern you talk to people, carry things from one to another and work the place's switches. E
talks to, or uses, whatever is nearest within reach; a talk opens a box of what is said and the replies, picked with
the arrows and Enter or the mouse; Escape ends it. A "!" stands over someone with a quest for you and a "?" over someone
waiting on one, and the corner lists your quests and what you carry.

All of it is one file per place beside the files pro-ng's build writes, its quests file
(`assets/village/village.art.quests.json`, `assets/tavern/tavern.art.quests.json`), written against the names those
files already give: a resident by the landmark it is planted at, a wanderer by its name (the crowd file), a spot by the
tag of a place of the nav graph, a switch by its kit thing's clip (the clips file). Everything that changes is a named
number on the row of whoever owns it: yours on your row, the place's on the `story` row, a person's on theirs, so a
thing given is one number down on the giver and one up on the taker. What is said is a pool of lines, the one whose
conditions name the most numbers winning. The quest plugin (`plugins/quest/quest.sim.ts`) says every part of the
file. In the village, Agnes wants the chapel bell rung (its rope in the loft plays the bellcote's `ring` clip), Osric
sends you to Maud with her mended pot, and Maud wants a loaf from the bakehouse shelf; in the tavern, Edith sends you to
Wat with his ale.

## How it is made

- **The town drawn** (world3d): `assets/smallville.town.glb` as pro-ng's `procedural.py` cuts it, every
  building one solid, with its roofs' coverings, its timber and its kit, drawn as one geometry by supershader3d, the
  scene's one shader, in at most three draw calls (solid, relief, see-through). Every material is the library's
  (`pro-ng/materials.json`, its look in `pro-ng/material/looks/`), composed into `assets/smallville.town.looks.json`
  with its pictures in `assets/looks/`. Each vertex carries its material's number and what its look reads, and the
  glb's extras say how its attributes make the shader's inputs, so the game names no material: a material or a look
  changed in the library shows in the game once it is baked again. world3d hands supershader3d the looks file and the
  wall looks the buildings' course table.
- **The town's moving things** (world3d, `assets/smallville.town.clips.json`): a kit thing that moves (the
  tavern's ceiling fan) is skinned in the glb, so the town's one mesh is a skinned mesh, its skeleton the glb's skin,
  in the same draw calls. Each clip of `smallville.town.clips.json` is played on it by one animation mixer, advanced by
  the frame's time: a clip of bones from the glb's animation `<thing> <clip>`, a clip of poses as the morph targets'
  weights, blended linearly from pose to pose. Every clip whose `start` is `on` plays when the town is built, looping
  where `loop` is true. The game starts and stops one with world3d's `clip(thing, clip, on)`,
  `plugins.world3d.clip('tavern/tavern fan', 'spin', false)` say. Walk shapes stay where they were baked.
- **What you walk on** (`assets/smallville.town.shapes3d.json`, which world3d hands shapes3d): shapes3d's
  shapes, written by pro-ng's `shapes.py` from the same numbers each solid is cut from: every wall a box, cut at its
  doors and passages; every floor; every roof that is stood on, cut round the stairs that come up through it; each
  stair's straight stretches planes over its treads and its low treads boxes; and each kit part a box from the part
  itself.
- **You** (`player.sim.ts`): a walker on shapes3d's ground at your own feet, so you stand on whatever floor you are on
  and walk under the one over you, drawn by anim as castle_walker, carrying a torch from the start: your rig's torch
  stance (`assets/player.rig.json`), its torch idle, walk, run and jump, and on your left hand anim's prop, the torch
  stick (`assets/torch.glb`). In the town its flame is particle3d's `handfire` (`assets/effects.json`), with a point
  light that casts shadows (lights3d's where the scene lists it, three's own where it does not), both moved onto the hand each frame by your look (`player.client.ts`) as your definition's
  `carry` says; the stick casts no shadow (`propsCast`).
- **The sky** (main): skydome3d, its clock held at the hour the scene's prefab gives, no weather.
- **The town's lights** (main, `torch.sim.ts`, `torch.client.ts`): twenty wall torches, at the gate, along the lane,
  round the square and up on the towers, each a `torch` actor whose look plays particle3d's `walltorch` effect
  (`assets/effects.json`): a flickering, shadowed lamp and the `handfire` flames. lights3d lights them, the light you
  carry and the fog (`world.lights3d`). Every shadow of what never moves (the town) is drawn once into lights3d's
  still atlas; what anim and crowd3d move, your body and the visitors, is drawn each frame into its moving atlas. The
  light you carry moves with you, so its shadow of the town stays as it was first drawn.
- **The ways** (`assets/smallville.town.nav.json`, which world3d hands nav3d as the graph `place`): nav3d's graph, made of shapes3d's shapes, written by pro-ng's
  `town_nav.py` from the landmarks' and the town's metadata: in each landmark the places set by hand (by the hall fire,
  behind the tavern's counter, at the altar) and the ways between them, each stair a way up its curve from its foot to
  its top (pro-ng's `stairs.py`), each landmark's exits joined by hand where landmarks meet (the passage to the hall
  and the kitchen) or to the street it faces, and along each street a way from place to place. Each place is named
  `<landmark>/<place>`, and each way's word (`room`, `door`, `stair`, `passage`, `street`, `ground`) is in its data.
- **The people** (`visitor.sim.ts`): 30 npc3d NPCs on its crowd3d body, not walkers. Each goes on the fortress plugin's
  `tour` (`plugins/fortress/fortress.npc3d.ts`): each starts on one of the graph's places, the 30 spread evenly over every place
  it has, then rolls any other place of the graph, walks there along nav3d's route at a steady walk, each leg at the graph's heights so it climbs every stair,
  and stands a while. crowd3d draws every one of them, in the town and on the bridge, as the one Mixamo body,
  castle_woman. They walk through each other, and through you.

## Baking

`yarn bake demo_world3d` (`assets/demo_world3d.bake.ts`) has the library's pro-ng make the town in one build
(`pro-ng/build.mjs`: it fetches the texture sets, cuts the town in Blender, packs the glb with its shader and pictures,
and writes its ways), copies what it wrote in, writes `main.scene.json`'s `world.world3d.place` and an entry of its
catalogue for each of world3d's parts (`smallville.town.glb`, `smallville.town.looks`, …) and each picture, does the
same for the village in `village.scene.json`, bakes the two
bodies, castle_walker (you) and castle_woman (every visitor), with every clip of your rig (`assets/player.rig.json`),
writing the table anim plays by back into the rig. The bodies come from the paths the rig's `bodies` give, the clips
from `~/troupe-collection`. The particle sheet (`assets/particles/`) and the torch stick (`assets/torch.glb`) are
demo_particle3d's and demo_motion3d's, copied. Change the town, a material or a look in the library and bake again.

## Tests

`yarn vitest run games/demo_world3d/demo_world3d.sim.test.ts`: you start on the town's start place and stand on it; a visitor walks the town to one of its places and stops on it at its height, its course written once
a leg; and on the bridge, visitors walk over the bridge at its height, under it on the ground, and up its ramps.

`yarn vitest run games/demo_world3d/plugins/quest/quest.sim.test.ts`: every person of each quests file is found on
one row; the bell, the pot and the ale go from start to end; a person talked to stops and listens until you leave; and
a seat cannot write the place's state or a person's itself.

How world3d draws a place, plays its clips and hands its files on is proven by world3d's own tests
(`plugins/world3d/*.test.ts`).
