# demo_gpuparticle3d

The demo of the `gpuparticle3d` plugin. You fly a small craft over a yard at dusk, with a chase camera
behind it, and fire gpuparticle3d's effects at the spot it aims at, which a gold ring on the ground
marks. Each number key fires one:

| key | effect | what it shows |
|---|---|---|
| 1 | blast | an explosion: a flash, a shock ring, a fireball that cools from orange to red, smoke, dust, stretched sparks and debris that fall and come to rest on the ground |
| 2 | sparks | three seconds of welding sparks: a stream of stretched sparks under gravity, a flickering glow, wisps of smoke |
| 3 | smoke | eight seconds of a smoke column: puffs that grow, rise, spin and thin out, a fire at the base, embers |
| 4 | gun | a muzzle flash at the craft's gun, and a tracer that flies to the aim and throws an impact where it lands |
| 5 | laser | a beam from the gun to the aim, burning the ground where it hits; the craft keeps it on the gun and the aim, so it sweeps as you turn |
| 6 | flares | coloured flares |
| 7 | comet | a comet row that spirals out and circles the aim; its trail is an effect that rides the row, and when the row ends the trail throws a burst where it was |
| 8 | rocket | a rocket that flies from the gun to the aim and throws a blast and smoke where it lands |
| 9 | torch | twenty seconds of a torch: flames, embers and smoke over a `lamp` layer, one flickering light at the effect that casts shadows of the blocks round it (lights3d) |
| 0 | searchlight | twelve seconds of a spot `lamp` hung twelve metres over the aim, shining straight down, the blocks under it casting shadows (lights3d) |

All the effects are in `assets/effects.json`, drawn from one sheet, `assets/particles/`.

## The bounce scene

`dev.html?scene=bounce` is the same craft over rolling hills (terrain3d) with crates, a wall, two posts,
a ramp and a tilted slab standing on them (shapes3d). gpgpu3d holds the land and the shapes on the GPU,
and every particle with a `bounce` bounces off them. Hail falls over the middle the whole time, and two
keys fire at the spot the craft aims at on the land:

| key | effect | what it shows |
|---|---|---|
| 1 | shrapnel | a flash and a burst of debris that bounces down the slopes and off the shapes |
| 2 | spray | four seconds of sparks thrown up, bouncing where they come down |

Its numbers are `assets/bounce.json`, and its land is `assets/hills.json`.

## Controls

- W and S fly forward and back; A and D turn; Q and E tilt up and down
- Space climbs, C sinks, Shift boosts
- the right mouse button dragged looks; the wheel changes the flying pace
- 1 to 9 and 0 fire the effects

## The dev page

`dev.html` is the demo's main page. Three's stats panel is at the top left. The panel holds
`world.gpuparticle3d`'s `hold`, the effects file's `cap`, `alphaTest` and `ppm`, and a render3d folder
(pixel ratio, exposure, tone mapping, AO and bloom). Changes apply to the running page only; "copy
world.gpuparticle3d JSON" and "copy effects file numbers JSON" copy the values for the files, and
"reset to the file" puts the files' values back.

## Playing it

```
yarn vite
```

then open `/games/demo_gpuparticle3d/dev.html`, or `/games/demo_gpuparticle3d/index.html` for the plain
game. Against its server:

```
node --experimental-strip-types games/demo_gpuparticle3d/demo_gpuparticle3d.server.ts
```

then open `/games/demo_gpuparticle3d/client.html`.

## Remaking the art

`yarn bake demo_gpuparticle3d` runs `assets/demo_gpuparticle3d.bake.ts`, which runs
`assets/particles/particles.draw.ts`. That script draws the particle sheet from nothing (a glow, a
ring, four puffs of smoke, a muzzle star, a spark, a beam and a chunk of debris, each white and
shaped by its alpha) and writes `assets/particles/particles.png` and `particles.json`. The bake also
draws `assets/checker-1024.webp`, the checkerboard on bounce's land. It reads nothing from the
library. Everything else in the scenes is drawn from three.js shapes.
