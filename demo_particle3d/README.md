# demo_particle3d

The demo of the `particle3d` plugin. You run an X Bot round a room with a checkerboard floor, across a
grid of see-through blue tiles, each two squares of the checkerboard a side. Each tile lights up while you stand on it and plays one of particle3d's effects,
and every effect plays at the same point just past the grid, the scene's `stage`, whichever tile sets
it off. A stream runs for as long as you stand there and stops when you step off; a burst goes off as
you step on, and again every few seconds while you stay. You start on the blast's tile, so the blast
goes off as you land.

Looking from the start towards the stage, the grid is, back row first:

| | left | middle | right |
|---|---|---|---|
| back | explosion | blast (the start) | grenade |
| | plasma | implosion | mushroom |
| | torch | sparks | smoke |
| front | flares | portal | firework |

| tile | effect | file | plays |
|---|---|---|---|
| torch | `torch` | `effects.json` | stream |
| sparks | `sparks` | `effects.json` | stream, its sparks bouncing off the floor |
| smoke | `smoke` | `effects.json` | stream |
| flares | `flares` | `effects.json` | burst every 5 s, each flare carrying a trail of its own |
| blast | `blast` | `effects/blast.json` | burst every 4 s |
| grenade | `grenade` | `effects/grenade.json` | burst every 3 s |
| plasma | `plasma` | `effects/plasma.json` | burst every 3 s |
| explosion | `explosion` | `effects/smokebomb.json` | burst every 4 s |
| portal | `portal2` | `effects/portal2.json` | stream |
| mushroom | `mushroom` | `effects/mushroom.json` | burst every 7 s |
| implosion | `implosion` | `effects/implosion.json` | burst every 4 s |
| firework | `firework` | `effects/firework.json` | burst every 3 s |

The tiles are `pad` actors in `main.scene.json`, each naming the entry of the pad's definition
(`assets/demo_particle3d.json`, `pad.plays`) that it plays: the effect, how far over the stage it is
thrown from, and whether it is a stream or a burst thrown again every so many seconds. The stage is
the scene's one `stage` actor. The tiles' size, their colour, how far the floor shows through
them and the colour they light up in are the definition's `size` and `tile`.

The effects are in `assets/effects.json`, which holds the torch, the sparks, the smoke and the flares
and lists the files under `assets/effects/` for the rest. Every one is drawn with particle3d's own
shapes. Rocks and chunks are instances3d's meshes, and particles bounce off the floor and the walls,
which are shapes3d's boxes. The effects under `assets/effects/` were made in the particle workshop (`yarn workshop particles demo_particle3d`), which throws an effect from 1.2 m
over its floor, so each of their tiles throws from 1.2 m over the stage (its entry's `lift`); any of
them can be tuned there and saved back.

## Controls

- W A S D run, Space jumps
- the right mouse button dragged looks; the wheel zooms from 2 m to 40 m out
- a gamepad: the left stick runs, the right stick looks

## The dev page

`dev.html` is the demo's main page. Three's stats panel is at the top left. The panel holds
`world.particle3d`'s `hold`, the effects file's `cap` and `alphaTest`, and a render3d folder (pixel
ratio, exposure, tone mapping, AO and bloom). Changes apply to the running page only; "copy
world.particle3d JSON" and "copy effects file numbers JSON" copy the values for the files, and "reset to
the file" puts the files' values back.

## Playing it

```
yarn dev
```

then open `/games/demo_particle3d/dev.html`, or `/games/demo_particle3d/index.html` for the plain
game. Against its server:

```
yarn serve demo_particle3d
```

then open `/games/demo_particle3d/client.html`.

## Remaking the art

`yarn bake demo_particle3d` runs `assets/demo_particle3d.bake.ts`. It draws the floor's checkerboard
from nothing (`assets/checker-1024.webp`), and bakes the library's X Bot with the six clips of
`assets/xbot.rig.json` (idle, walk, run, jump, fall, land) into `assets/xbot.glb` with anim's export,
writing the rig's measures back into `xbot.rig.json`. The effects are data written by hand, so they
need no bake.
