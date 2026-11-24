# demo_guns3d

The G95A1 (the library's pro-ng kit gun, `modern/firearms/rifles/g95/g95`) in an X Bot's hands on a range of steel
plates, through the guns3d plugin (`plugins/guns3d/`). It fires on semi and on auto at the gun's own rate, kicks the
view, flashes and lights the ground, throws its spent case from the port onto the land, and knocks a plate over. The
X Bot carries the gun ready, aimed, lowered or run with, and reloads by hand: the left hand takes the magazine out,
drops it, fetches a fresh one from the pouch on its chest, seats it and goes back to the handguard.

- **The sheet**, `assets/demo_guns3d.guns.json` (`world.guns3d.sheet`), is everything about the gun and who holds
  it: the G95's item, damage, words (the `select` trigger and its modes, the `cycle` at 850 rounds a minute, the
  30-round `magazine`, the `eye` aim, the `cone` spread, the `hitscan` flight, the `kick`), its look (flash, smoke,
  tracer, impacts), its points (`muzzle`, `port`, `stock`, `grip`, `support`, the magazine, the bolt catch, the
  charging handle, the forward assist) and its moves; the X Bot's fit (its stock on the right shoulder, its elbows'
  poles, its pouch and chest points); and the grips its hands make.
- **The moves**, `assets/moves/*.move.json`, each one thing done with the gun, as cues for each hand, its fingers,
  the gun, the body, the gun's own clips and its parts: the carries `ready`, `aim`, `low` and `sprint`; the shots
  `shot` and `shot last`; and the acts `reload`, `reload empty`, `select semi`, `select auto`, `inspect`, `charge`
  and `check`. The same moves are kept in the library (`$PATCHWORK_LIBRARY/guns3d/moves/`).
- **The body** is the player's `player` row, an X Bot walked by walker and drawn by anim with the Rifle 8-Way
  Locomotion Pack's clips (`assets/xbot.rig.json`). guns3d puts the gun at its shoulder and its hands where the moves
  say, and ik3d bends its arms there (`world.ik3d.mods.limbs: "guns3d"`).
- **The plates** are the range plugin's (`plugins/range/`): a plate knocked down by a round lies over for a few
  seconds and stands again.

## Keys

Click the game to take the mouse. W A S D walk, Shift runs, the mouse looks, the left button fires, the right button
aims down the gun, R reloads, B turns the selector between semi and auto, L lowers or raises the gun, I inspects, C
charges, V checks the magazine, Space jumps.

## Files

- `main.scene.json`: the range, the catalogue of the sheet and every move, `world.guns3d`, and each plugin's `mods`
  naming the plugins that deliver guns3d's words.
- `assets/demo_guns3d.guns.json`, `assets/moves/`: the sheet and the moves, tuned in the guns3d workshop
  (`yarn workshop guns3d demo_guns3d`).
- `assets/demo_guns3d.json`: the player's definition: its speeds, camera, keys, the carries it holds the gun in and
  the acts its keys play.
- `assets/demo_guns3d.items.json`: the items sheet: the G95, the spent 5.56 case its port throws and the magazine a
  reload drops.
- `assets/demo_guns3d.bake.ts`: the bake (`yarn bake demo_guns3d`): the X Bot and its clips, the items, and the
  scene's one looks file.
- `assets/effects.json`: the flash, the smoke, the tracer, the impacts, the case and the dropped magazine.
- `plugins/range/`: the plates.

## Pages

`yarn dev`, then `localhost:5173/games/demo_guns3d/index.html`, or `dev.html` for the testbed: its readout shows the
gun's mode, rounds, carry and act, and `window.__advance(n)` steps the truth `n` steps and draws one frame, so a moment
of a move is looked at exactly.
