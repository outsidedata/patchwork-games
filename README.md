# patchwork-games

The demo games of Patchwork: small, light games, each showing one part of core working, and the
living reference for how things are built in core. Each one ships baked: its art built and
compressed (meshopt geometry, WebP textures), so it plays from a clone with no Blender and no
library.

Clone it as `games/` inside a core clone, then play a demo:

```
git clone git@github.com:outsidedata/patchwork-games.git games
yarn vite
```

and open `/games/<game>/index.html`. A demo's server is
`node --experimental-strip-types games/<game>/<game>.server.ts`, with `/games/<game>/client.html`.

A demo's art is made again with `yarn bake <game>`, which reads the raw parts from
`PATCHWORK_LIBRARY` and runs the scripts beside the demo's art (`yarn health` checks the machine has
what it needs).

## The demos

- **demo_audio**: a row of cars, one for each engine the library's sounds can make, each heard as
  you drive it, and a row of guns on plinths.
- **demo_audiodaw**: a music studio on the audiodaw plugin: a rack, a mixer, a piano roll and an
  arrangement.
- **demo_box2d**: box2d's bodies and joints side-on: a pile, a one-way platform, a seesaw, a car to
  drive, a ragdoll, a rope and a piston, with spawning, explosions and wind.
- **demo_box3d**: box3d's bodies and joints in an arena: piles to knock over, every shape, a hinged
  door, a pendulum, a sprung plank and a welded chain, with a ball to fire and an explosion.
- **demo_castle**: a lineup of structures to walk around.
- **demo_gamepads**: what the player plugin reads of every gamepad, drawn live.
- **demo_gameui**: the conventions of the `ui` plugin, each shown by a kind of its own.
- **demo_motion3d**: an X Bot on motion3d over a checkerboard yard: zones where the use key plays
  each zone's clip, a wall's lip to hang from, shimmy along, climb up or drop from, and a chair to
  sit in.
- **demo_npc3d**: NPCs on npc3d that see, notice, remember, hear and choose what to do: sentries,
  guards hunting intruders through a town, people running from the shots, and walkers taking
  nav3d's baked routes round a wall.
- **demo_ocean3d**: the ocean3d sea alone, buoys and a boat riding it, every number of it on a
  panel in its `dev.html`.
- **demo_particle2d**: particle2d's effects running on their own in a flat hall: a row of exhibits
  on plinths, a kite with a trail and a ball that throws up dust where it lands.
- **demo_particle3d**: particle3d's effects fired from a craft you fly over a yard at dusk: a blast,
  sparks, smoke, a gun's tracer, a laser, lit flares, a comet and a rocket.
- **demo_rocks**: a lineup of rocks to walk around.
- **demo_skydome3d**: the sky, the weather and the clouds over flat sand.
- **demo_terrain3d**: a valley drawn by terrain3d at three tiers, uhd, hd and lofi.
- **demo_trees**: a lineup of trees to walk around.
- **demo_walker**: an X Bot on walker over a checkerboard course of stairs, ramps, a pond, a ladder
  and a parkour yard, and the game's own plugins that extend walker with climbing, sitting, cover,
  vaults, wall runs, rolls, slides and flips.

MIT, Outside Data, but for art a demo credits to someone else under its own licence.
