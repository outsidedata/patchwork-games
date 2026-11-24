# demo_guns3d

The G95A1 (the library's pro-ng kit gun, `modern/firearms/rifles/g95/g95`) in an X Bot's hands on a range of steel
plates, through the guns3d plugin (`plugins/guns3d/`). It fires on semi and on auto at the gun's own rate, kicks the
view, flashes and lights the ground, throws its spent case from the port onto the land, knocks a plate over, and
reloads with the left hand on the magazine as the gun's own reload clip drops the empty one and seats the fresh one.

- **The gun** is an item of item3d's. Its sidecar carries the kit kind's gun file (`g95.guns.json` beside the kind in
  pro-ng): its words for each stage (the `select` trigger and its modes, the `cycle` at 850 rounds a minute, the
  30-round `magazine`, the `hitscan` flight), its points (`muzzle`, `stock`, `grip`, `support`, the magazine, the bolt
  catch, the charging handle) and where a hand takes each part in each clip.
- **The body** is the player's `player` row, an X Bot walked by walker and drawn by anim with the Rifle 8-Way
  Locomotion Pack's clips (`assets/xbot.rig.json`). It holds the gun as anim's prop of the item; ik3d sets the gun's
  `stock` on the right shoulder and bends both arms to the gun's `right hand` and `left hand` empties, which guns3d
  moves along the gun file's `hands` every frame.
- **The plates** are the range plugin's (`plugins/range/`): a plate knocked down by a round lies over for a few
  seconds and stands again.
- **The scene's `world.guns3d`** is every line a game needs to hold this gun: the gun's item, its damage and the words
  the scene gives it (`eye` aim, `cone` spread, `kick`, and the look: `clips`, `flash`, `tracer`, `impact`, `case`).

## Keys

Click the game to take the mouse. W A S D walk, Shift runs, the mouse looks, the left button fires, R reloads, B
turns the selector between semi and auto, I inspects, Space jumps.

## Files

- `main.scene.json`: the range, `world.guns3d`, and each plugin's `mods` naming the plugins that deliver guns3d's
  words.
- `assets/demo_guns3d.items.json`: the items sheet: the G95 and the spent 5.56 case its port throws.
- `assets/demo_guns3d.bake.ts`: the bake (`yarn bake demo_guns3d`): the X Bot and its clips, the items, and the
  scene's one looks file.
- `assets/effects.json`: the flash, the tracer, the impacts and the case.
- `plugins/range/`: the plates.

## Pages

`yarn dev`, then `localhost:5173/games/demo_guns3d/index.html`, or `dev.html` for the testbed: its `fit` folder
holds the gun against the body, and `window.__advance(n)` steps the truth `n` steps and draws one frame, so a moment of
a clip is looked at exactly.
