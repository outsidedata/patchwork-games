# demo_particle3d

The demo of the `particle3d` plugin. You run an X Bot round a room with a checkerboard floor, across a
grid of see-through blue tiles, each two squares of the checkerboard a side. Each tile lights up while you stand on it and plays one of particle3d's effects,
and every effect plays at the same point just past the grid, the scene's `stage`, whichever tile sets
it off. A stream runs for as long as you stand there and stops when you step off; a burst goes off as
you step on, and again every few seconds while you stay. You start on the blast's tile, so the blast
goes off as you land.

Looking from the start towards the stage, the grid is, back row first:

| | far left | left | middle | right | far right |
|---|---|---|---|---|---|
| back | bolt | arc | fireball | shockwave | dust |
| | campfire | explosion | blast (the start) | grenade | billow |
| | flame | plasma | implosion | mushroom | steam |
| | embers | torch | sparks | smoke | swirl |
| front | column | flares | portal | firework | splash |

The two outer columns and the back row are the flipbook effects, below.

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
| mushroom | `mushroom` | `effects/mushroom.json` | burst every 7 s, from the stage itself: a flash, a fireball and a surge of dust along the floor, rocks and spark jets flung out, then a head of fire rising on a stem of smoke and rolling out into a dark cap |
| implosion | `implosion` | `effects/implosion.json` | burst every 3.5 s, 2.6 m over the stage: a black hole that swallows smoke, rocks and an accretion disc, tethered to what it pulls by arcs, closes to a pinhole, then snaps: a flash, a shockwave, lightning cracking out and shards flung across the floor |
| firework | `firework` | `effects/firework.json` | burst every 3 s |
| campfire | `campfire` | `effects/campfire/campfireConfig.json` | stream: licking flame tongues and smouldering coals, smoke, embers, sparks and a flickering lamp |
| flame | `flame` | `effects/flame/flameConfig.json` | stream |
| embers | `embers` | `effects/embers/embersConfig.json` | stream |
| column | `column` | `effects/column/columnConfig.json` | stream, a column of smoke leaning in the wind |
| billow | `billow` | `effects/smoke/smokeConfig.json` | stream, flipbook smoke that erodes as it rises |
| steam | `steam` | `effects/steam/steamConfig.json` | stream |
| swirl | `swirl` | `effects/swirl/swirlConfig.json` | stream |
| splash | `splash` | `effects/splash/splashConfig.json` | burst every 3 s |
| bolt | `bolt` | `effects/bolt/boltConfig.json` | burst every 2 s, a lightning bolt from 4.5 m over the stage down to it |
| arc | `crackle` | `effects/arc/arcConfig.json` | stream, an electric arc crackling between two points 2 m apart |
| fireball | `fireball` | `effects/fireball/fireballConfig.json` | burst every 4 s |
| shockwave | `shockwave` | `effects/shockwave/shockwaveConfig.json` | burst every 3 s |
| dust | `dust` | `effects/dust/dustConfig.json` | burst every 3 s |

The tiles are `pad` actors in `main.scene.json`, each naming the entry of the pad's definition
(`assets/demo_particle3d.json`, `pad.plays`) that it plays: the effect, how far over the stage it is
thrown from, where a beam of it ends (`to`, off the stage), and whether it is a stream or a burst
thrown again every so many seconds. The stage is
the scene's one `stage` actor. The tiles' size, their colour, how far the floor shows through
them and the colour they light up in are the definition's `size` and `tile`.

The effects are in `assets/effects.json`, which holds the torch, the sparks, the smoke and the flares
and lists the files under `assets/effects/` for the rest. The hand-written ones draw their smoke and
dust from the `smoke` flipbook and their fire from the `fireball` flipbook (The flipbooks, below), and
their flashes, glows, rings, sparks, streaks and bolts with particle3d's own shapes. Rocks and chunks are instances3d's meshes, and particles bounce off the floor
and the walls, which are shapes3d's boxes. The effects in the files directly under `assets/effects/`
were made in the particle workshop (`yarn workshop particles demo_particle3d`), which throws an effect
from 1.2 m over its floor, so each of their tiles throws from 1.2 m over the stage (its entry's
`lift`); any of them can be tuned there and saved back.

## The flipbooks

The thirteen effects in the folders under `assets/effects/` (`campfire/`, `smoke/` and the rest) are
drawn from flipbooks: sprite sheets whose frames a particle plays through as it lives, rendered by
Blender from a procedural node tree. Each folder holds one effects file, `<name>Config.json`, whose
`flipbooks` list gives every flipbook it draws: its frames, its size, and the node tree (noise,
voronoi and maths nodes, their inputs keyed over the frames, so the shape moves as the clip plays).
Beside it are what the bake renders from that list: each flipbook's picture (`.png`) and its sheet
(`.json`), which the scene's catalogue names by the flipbook's name (`smoke`, `tongues`, `coals`,
`embers`, ...), so a layer of any file draws it as its `sheet`; the campfire draws the smoke folder's
`smoke` and the embers folder's `embers` too. Their effects sit on the ground, as they were built,
so their tiles throw them from the stage itself.

A flipbook's picture is not colours. Its red, green, blue and alpha are masks the bake worked out of
the node tree (a density, a glow, the light that reaches each pixel through the smoke from one side),
and a layer's `channels` says how they are drawn, each four weights, one for each channel: `value` the
weights its brightness is made of, `alpha` those of its opacity, and `hot` those of how white-hot it
is, its colour lifted toward white that much. The colour is the layer's
`tints`, so the same smoke sheet is dark soot in one layer and pale steam in another. A layer drawing
a flipbook also has `start`, the part of the clip each particle starts on, rolled, so a stream of
them never plays one frame in step; `blend`, each frame faded into the next so the clip plays smoothly
however few frames it has; and `erode`, stops of how much of its cover is cut away over its life,
so smoke thins away from its edges in place of fading all at once. Each of these is in the header of
`plugins/particle3d/particle3d.plugin.ts`. A flipbook's frames are drawn `ppm`, 256, pixels to the
metre, the effects file's own.

The effects of the smoke and arc files are named `billow` and `crackle`, after their clips, since
`smoke` and `arc` are already effects of the demo's: the smoke tile and the portal's lightning.

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
writing the rig's measures back into `xbot.rig.json`. It renders every flipbook in Blender with core's
`tools/workshop/flipbooks.py`, from each `assets/effects/<name>/<name>Config.json`, writing the pictures
and sheets beside it; this reads nothing from the library, only Blender. The baked pictures and sheets
are committed, so the demo plays as downloaded, with no Blender. The other effects are data written by
hand, so they need no bake.
