# demo_supershader3d

Fly over a valley whose ground and whose yard of blocks, crates, posts and cobbled paths are all drawn by one shader.

The shader is the library's pro-ng looks (`pro-ng/material/looks/`, `pro-ng/ONE-SHADER.md`), composed at bake time
into one program per draw call, which the `supershader3d` plugin builds from `assets/main.looks.json` and the pictures
in `assets/looks/`. The game never loads the library. Six materials: the ground's grass, sand and sandstone, the kit's
rock (Rock013's pictures) and timber (Wood036's), and the cobbles, a relief look with the sun's shadow marched inside
it. Two draw calls: solid, and relief.

## Playing

`yarn dev`, then `localhost:5173/games/demo_supershader3d/index.html`. You start in the air over the yard, looking at it.

| key | what it does |
| --- | --- |
| W A S D | fly forward and back, and across |
| Space / C | climb and sink |
| Shift | fast |
| click, then the mouse | look (the pointer lock; Escape lets it go) |
| right mouse button, dragged | look |
| wheel | pace, how fast everything above is |

`dev.html` is the testbed: its panel picks the shader's view (shaded, each piece its own colour, the relief, the
normal) and draws every material in its flat colour.

## How it is made

- **The ground** (`assets/valley.json`): terrain3d's field, a valley of rolling hills and ridges, whose three ground
  layers are looks, not pictures: `grass` under everything, `sand` on the low ground and `sandstone` on the steep,
  each a material of the one shader worked out per pixel on the ground through supershader3d's `look` word
  (`plugins/supershader3d/supershader3d.terrain3d.ts`, named in `world.terrain3d.mods.behaviors`).
- **The yard** (`main.scene.json`, `world.shapes3d.kinds`): shapes3d's boxes, cylinders and planes, each kind's look
  naming a material of the one shader, drawn by solids through supershader3d's looks
  (`plugins/supershader3d/supershader3d.solids.ts`, named in `world.solids.mods.looks`), every vertex tagged with its
  material's number and its row, so no two crates are alike. They stand on the land through terrain3d's `land`.
- **You** (`player.sim.ts`): the eye, flown by the keys and turned by the mouse, never nearer the ground than its
  definition's `clear`; chasecamera3d sits the camera on it.
- **The light**: environment3d's sun, with its shadow, sky and ambient.

## Baking

`yarn bake demo_supershader3d` (`assets/demo_supershader3d.bake.ts`) composes the six materials' looks from the
library's pro-ng with the bake's `looks` tool, writes `assets/main.looks.json`, and cuts the pictures the looks read to
1024 pixels square as WebP into `assets/looks/`, their cc0-textures sets downloaded into the library first. Change a
material in the bake file, or a look in the library, and bake again.

## Tests

`yarn vitest run games/demo_supershader3d/demo_supershader3d.sim.test.ts`: the eye stands over the ground at its start,
flies at its speed, never comes nearer the ground than `clear`, refuses a bad act, and the yard's shapes stand where
the scene puts them.
