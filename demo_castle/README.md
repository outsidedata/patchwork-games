# demo_castle

Run about procedural-castle's fortress, and watch its people go about it.

The fortress is the library's procedural-castle (its scene `procedural-castle/scenes/fortress.json`): a
walled castle of four corner towers and one on the east wall, battlemented curtain walls, a gatehouse
between two drum towers, a keep with a turret, a great hall, a chapel, stables and two houses, a gallery on
supports and a lookout on stilts. Each building is cut into one solid in Blender
(`procedural-castle/procedural.py`), no stone laid, and the stone and the wood are drawn on its faces by a
material (`castle.material.ts`). Beside the solids procedural-castle writes, with no Blender, what a body
walks on and round, as a few plain shapes (`procedural-castle/shapes.ts`), and the ways between its places,
as a nav3d graph (`procedural-castle/nav.ts`). The game reads those files and nothing else of the fortress.

## Playing

`yarn dev`, then `localhost:5173/games/demo_castle/index.html`. You start outside the south gate.

| key | what it does |
| --- | --- |
| W A S D | run, the way the camera looks |
| Shift | walk |
| Space | jump |
| right mouse button, dragged | turn and tilt the camera |
| wheel | the camera nearer or further |

Every door has steps up to its floor, and the lookout's and the gallery's, which stand on supports, come
down to the ground. Each tower has a door on the ward side. The keep's stair and the gatehouse's run round
their inside walls up to their roofs, and the turret's, the drums' and the towers' are spirals. Every place
of the fortress can be reached on foot.

`dev.html` is the testbed: `?graphs=1` draws the scene's graph, the panel puts you on any of its
places, and the readout shows where you stand and where each visitor is going.

`dev.html?scene=bridge` is the bridge: a field, a bridge 3 m up across it on two piers, a ramp down
from each end, and a road under it. Its people walk over the bridge, under it on the ground and up and
down its ramps, along a graph written by hand (`assets/bridge.nav.json`), each link one straight
stretch of ground: up a ramp, across the deck, along the road. It shows npc3d's people on routes that
climb, with people at two heights at one place on the ground. Beside the bridge a man goes up and down a
spiral, three turns rising 3 m, a link of the graph whose course is a shapes3d spline: he walks its
curve, as crowd3d walks a spline a straight piece at a time.

## How it is made

- **The fortress drawn** (`castle.client.ts`): the solids, the roofs' coverings and the timber from
  `assets/fortress.procedural.json` and its three `.bin` files, each vertex its floats as procedural.py
  wrote them; the stone and the wood (`castle.material.ts`, procedural-castle's own materials) cut each
  face into its courses of stones or boards, with relief, on the pictures in `assets/*.webp`.
- **The shapes** (`assets/fortress.partial_scene.json`, which `main.scene.json` extends): every wall a
  box, every room's floor one box (a round tower's a cylinder), every stone roof a plane, each stair's
  straight stretches planes and its low treads boxes, each door's steps boxes, each support's posts and low
  braces boxes. shapes3d holds them. Each of procedural-castle's kinds is the `masonry` rule (`main.sim.ts`).
- **You** (`player.sim.ts`): a walker on shapes3d's ground at your own feet, so you stand on whatever
  floor you are on and walk under the one over you, drawn by anim, which plays your rig's idle, walk,
  run and jump (`assets/player.rig.json`).
- **The ways** (`assets/fortress.nav.json`): nodes in each room, on each roof, inside and outside each
  door, along each stair and at each building's corners on the ground, named after the room, the roof,
  the door, the stair or the corner; and links between them: through a door (`door`), through a passage
  from one building to the next (`passage`), along a stair (`stair`), across a room's floor or roof
  (`room`), and on the ground outside wherever the straight line crosses no building (`ground`). Each
  costs nav3d to cross the metres between its two places. The game's plugin `fortress` delivers npc3d
  the visitors' `tour`.
- **The people** (`visitor.sim.ts`): npc3d NPCs on its crowd3d body, not walkers. Each goes on the
  fortress plugin's `tour` (`plugins/fortress/fortress.npc3d.ts`): it rolls a place from its
  definition's `places`, walks there along nav3d's route at a steady walk, each leg one straight line
  from node to node with the nodes' heights, so it climbs the stairs and steps, and stands a while.
  crowd3d draws them as Mixamo bodies from the library. They walk through each other, and through you.

## Baking

`yarn bake demo_castle` (`assets/demo_castle.bake.ts`) cuts the fortress's solids with the library's
procedural.py, writes its shapes and its ways with shapes.ts and nav.ts, cuts the stone's, the mortar's and
the wood's pictures to 2048 pixels square as WebP, bakes the visitors' four bodies with their idle and walk
clips (`assets/crowd.rig.json`), and bakes your body with its rig's clips, writing the table anim plays by
back into `assets/player.rig.json`. Bodies come from the library, clips from `~/troupe-collection`. Change
the fortress in the library and bake again.

## Tests

`yarn vitest run games/demo_castle/demo_castle.sim.test.ts`: you run in at the south gate, up its steps,
through the gatehouse and out into the ward; a visitor climbs to a roof along its route, its feet rising
leg by leg, its course written once a leg; and on the bridge, visitors walk over the bridge at its
height, under it on the ground, and up its ramps.
