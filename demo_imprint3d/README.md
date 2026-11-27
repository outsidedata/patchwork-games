# demo_imprint3d

A hatch driven over land that has snow on its high ground, mud where it is wet and sand on its low ground, all
imprint3d's soft ground, which terrain3d draws as the land itself, and X Bots walking between them. The hatch's wheels leave ruts and the bodies' feet
leave prints, each filling back in at its ground's own pace: snow in two minutes, sand in forty seconds, mud
in ten.

The land is `assets/land.json`, written by `assets/land.mjs`: demo_grass3d's rolling hills, the cc0 Grass004
ground, and a ground layer each of snow, sand and mud by the same rules over the land record that their soft
ground lies by (`assets/grounds.json`).

## Controls

w and s or the triggers are the pedal (s from a stop reverses), a and d or the stick steer, space brakes.

## Playing it

- `yarn dev`, then `localhost:5173/games/demo_imprint3d/index.html`.
- `yarn serve demo_imprint3d`, then `localhost:5173/games/demo_imprint3d/client.html`, drives it against the
  game's server.
- `dev.html` has imprint3d's panel, every number of the grounds file; views that hold the camera (`over`,
  straight down on the ground round the car; `snow`, `sand`, `mud`); and a readout of the blocks held and the
  ground under the car. `?view=<name>` starts in one.

## Remaking the art

`yarn bake demo_imprint3d`:

- cuts the ground's maps (grass, snow, sand, mud) from `assets/cc0-textures.json` into `assets/ground/`, from
  the library's cc0-textures sets;
- runs `assets/demo_imprint3d.bake.ts`, which bakes `assets/xbot.glb`, the library's Mixamo X Bot
  (`characters/xbot/xbot.fbx`) with the clips `assets/xbot.rig.json` names, and writes the rig's measures back
  into it.

`node games/demo_imprint3d/assets/land.mjs` writes the land.

## Credit

- The X Bot and its clips: Mixamo (Adobe).
- The ground maps: Grass004 (ambientCG), snow_02, coast_sand_03 and brown_mud (Poly Haven), all CC0, through
  cc0-textures.com.
