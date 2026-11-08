# demo_lights3d

The demo of the `lights3d` plugin: many point and spot lights, every shadow from a still atlas drawn
once and a moving atlas drawn each frame, lit fog and reflection probes, in four scenes. Nothing is
played: the camera stands still and the scene moves. The orbiting ball is marked moving
(`userData.moving`), so its shadow follows it. A light that moves (the weaving lamp, the sweeping
spots, the drifting lamps, the wandering lantern) keeps the still shadow it was first drawn with.

| scene | what it shows |
|---|---|
| main | a room of 12 coloured wall lamps, 6 sweeping overhead spots, a lamp weaving between boxes and spheres and an orbiting ball, every light shadowed, lit fog, a polished floor and metal balls reflected by a probe |
| swarm | 400 lamps drifting over a field of pillars, no shadows |
| hall | a long hall of pillars, warm sconces on the walls and coloured spot beams sweeping through fog, the beams shadowed |
| mist | a moor at night of standing stones and lamps on posts, ground fog clumping and drifting through their light, thick on the ground and thinning with height, a lantern wandering between the stones |
| gallery | a mirror-polished floor, metal balls from smooth to rough, a gold ball, a moving lamp and ball, reflected by a probe drawn again a face at a time |
| panel | lights3d's area lights: four panels (three's `RectAreaLight`) each shining a picture (`assets/panel.png`, drawn by `assets/panel.png.mjs`), two playing it as it scrolls, the back one casting the pillar's shadow, an orbiting ball in the moving atlas |
| glow | a pro-ng rune pillar (`kit_demos/kit-glow` in the library, baked by `assets/demo_lights3d.bake.ts`, drawn by the game's `prong` plugin through supershader3d) whose glowing runes light the room by being drawn: supershader3d's glowmap, the glow the camera sees summed into screen cells that lights3d lights from; a woman in the `spirit_glow` look dancing salsa beside it, and a chrome man dancing hip hop |

## Controls

None: the scene plays itself.

## The dev page

`dev.html` is the demo's main page. `?scene=<scene>` enters a scene, as the panel's picker does.
`?three=1`, the panel's "lit by lights3d" box unticked, takes lights3d out, so three's own loop lights
the same lamps: with 18 shadowed lights the room fails to compile in three alone. The fog folder, in
a scene with fog, tunes its numbers live and copies them as JSON. The readout shows the lights, those
with shadows and their tiles, the still and the moving tiles drawn this frame, and the cells.

## Playing it

```
yarn dev
```

then open `/games/demo_lights3d/dev.html`, or `/games/demo_lights3d/index.html` for the plain page.
Against its server:

```
yarn serve demo_lights3d
```

then open `/games/demo_lights3d/client.html`.

The panel scene's panels folder moves, turns, sizes and brightens each panel, plays its picture, sets the floor's
roughness, and the areas' `blur` and `cutoff`. The glow scene's controls set the glow's gain and the glow pass's
resolution, and show or hide the pillar, the woman and the man. The live folder sets the screen's reflections and the
probes' refresh; the reloads folder turns shadows, probes, fog, reflections and the glowmap on or off, and sets the
shadow atlas, its tiles, the probes' size and the pixel ratio, each loading the page again with it in the address.

## Remaking the art

Everything but the panel's picture and the glow scene's pillar is drawn from three.js shapes by `stage.client.ts`,
from the sets in `assets/demo_lights3d.json`. `node games/demo_lights3d/assets/panel.png.mjs` draws the picture
again. `yarn bake demo_lights3d` builds the pillar again from the library's pro-ng (`assets/demo_lights3d.bake.ts`):
its glb and its looks.
