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
- **demo_castle**: a lineup of structures to walk around.
- **demo_gamepads**: what the player plugin reads of every gamepad, drawn live.
- **demo_gameui**: the conventions of the `ui` plugin, each shown by a kind of its own.
- **demo_rocks**: a lineup of rocks to walk around.
- **demo_skydome3d**: the sky, the weather and the clouds over flat sand.
- **demo_terrain3d**: a valley drawn by terrain3d at three tiers, uhd, hd and lofi.
- **demo_trees**: a lineup of trees to walk around.

MIT, Outside Data, but for art a demo credits to someone else under its own licence.
