# demo_lights3d

The demo of the `lights3d` plugin: many point and spot lights, every shadow from one atlas, lit fog
and reflection probes, in four scenes. Nothing is played: the camera stands still and the scene moves.

| scene | what it shows |
|---|---|
| main | a room of 12 coloured wall lamps, 6 sweeping overhead spots, a lamp weaving between boxes and spheres and an orbiting ball, every light shadowed, lit fog, a polished floor and metal balls reflected by a probe |
| swarm | 400 lamps drifting over a field of pillars, no shadows |
| hall | a long hall of pillars, warm sconces on the walls and coloured spot beams sweeping through fog, the beams shadowed |
| mist | a moor at night of standing stones and lamps on posts, ground fog clumping and drifting through their light, thick on the ground and thinning with height, a lantern wandering between the stones |
| gallery | a mirror-polished floor, metal balls from smooth to rough, a gold ball, a moving lamp and ball, reflected by a probe drawn again a face at a time |

## Controls

None: the scene plays itself.

## The dev page

`dev.html` is the demo's main page. `?scene=<scene>` enters a scene, as the panel's picker does.
`?three=1`, the panel's "lit by lights3d" box unticked, takes lights3d out, so three's own loop lights
the same lamps: with 18 shadowed lights the room fails to compile in three alone. The fog folder, in
a scene with fog, tunes its numbers live and copies them as JSON. The readout shows the lights, those
with shadows and their tiles, the tiles drawn again this frame, and the cells.

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

## Remaking the art

There is none: everything in the scenes is drawn from three.js shapes by `stage.client.ts`, from the
sets in `assets/demo_lights3d.json`.
