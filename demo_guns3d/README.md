# demo_guns3d

The G95A1 (the library's pro-ng kit gun, `modern/firearms/rifles/g95/g95`) in an X Bot's hands on a range of steel
plates, through the guns3d plugin (`plugins/guns3d/`). It fires on semi and on auto at the gun's own rate, kicks the
view, flashes and lights the ground, throws its spent case from the port onto the land, and knocks a plate over. The
X Bot carries the gun ready, aimed, lowered or run with, and reloads by hand: the left hand takes the magazine out,
drops it, fetches a fresh one from the pouch on its chest, seats it and goes back to the handguard.

Q swaps to the RPG-7 (`modern/firearms/launchers/rpg7/rpg7`), carried on top of the right shoulder. Its tube holds one
PG-7V (guns3d's `tube` feed). The trigger plays the kit's own fire clip, which drives the grenade up the tube and
releases it; at that moment the grenade is handed to volley3d (its `volley` flight word), which flies it, drawn as the
PG-7V item with a smoke trail, to what the reticle covers, where it bursts and knocks over every plate near it. The
backblast blows out of the venturi. R reloads: the launcher comes off the shoulder, the left hand takes the fresh
grenade in front of the muzzle and rides it in as the kit's reload clip pushes it home, and the right thumb cocks the
hammer.

Q again swaps to the G95-L, the same G95 item throwing a beam of light. Held, the trigger lets go 1800 pulses a
minute from a 180-pulse cell (the laser plugin's `cell` feed); each pulse is a `hitscan` line at the speed of light,
met at once, so it burns whatever the reticle covers that step. The beam is drawn every frame from the muzzle to where
the newest pulse landed (the laser plugin's `beam` look word), and the pulses come closer together than its `fade`, so
it reads as one beam that stays on while the trigger is held and goes out the frame it is let go. Where it lands it
sparks and scorches (`laser ground`, `laser plate`). R swaps the cell.

Q again swaps to the G95-I, the ion blaster: the same G95 item, firing one bolt of ion a press, 240 a minute at most,
from a 24-bolt cell. Each bolt is a volley3d round (the `volley` flight word, the `ion` pattern) that leaves the muzzle
at once and flies straight at 140 m/s with no fall to what the reticle covers. It is all particles, with no model: a
white-hot core in a blue glow with its own light (`ion bolt`), a streak of blue sparks behind it (`ion trail`), and,
where it meets something, a blue blast that knocks over every plate within 2.5 m (`ion blast`). The
muzzle flashes blue (`ion flash`, `ion haze`). R swaps the cell.

- **The sheet**, `assets/demo_guns3d.guns.json` (`world.guns3d.sheet`), is everything about the gun and who holds
  it: the G95's item, damage, words (the `select` trigger and its modes, the `cycle` at 850 rounds a minute, the
  30-round `magazine`, the `eye` aim, the `cone` spread, the `hitscan` flight, the `kick`), its look (flash, smoke,
  tracer, impacts), its points (`muzzle`, `port`, `stock`, `grip`, `support`, the magazine, the bolt catch, the
  charging handle, the forward assist) and its moves; the X Bot's fit (its stock on the right shoulder, its elbows'
  poles, its pouch and chest points); and the grips its hands make.
- **The moves**, `assets/moves/*.move.json`, each one thing done with the gun, as cues for each hand, its fingers,
  the gun, the body, the gun's own clips and its parts: the carries `ready`, `aim`, `low` and `sprint`; the shots
  `shot` and `shot last`; and the acts `reload`, `reload empty`, `select semi`, `select auto`, `inspect`, `charge`
  and `check`; the RPG-7's, `launcher-*`; and the G95-L's pulse, `laser-pulse`, a shiver of the gun. The same moves are kept in the library
  (`$PATCHWORK_LIBRARY/guns3d/moves/`).
- **The body** is the player's `player` row, an X Bot walked by walker and drawn by anim with the Rifle 8-Way
  Locomotion Pack's clips (`assets/xbot.rig.json`). guns3d puts the gun at its shoulder and its hands where the moves
  say, and ik3d bends its arms there (`world.ik3d.mods.limbs: "guns3d"`).
- **The plates** are the range plugin's (`plugins/range/`): a plate knocked down by a round lies over for a few
  seconds and stands again.

## Keys

Click the game to take the mouse. W A S D walk, Shift runs, the mouse looks, the left button fires, the right button
aims down the gun, R reloads, B turns the selector between semi and auto, L lowers or raises the gun, I inspects, C
charges (the RPG-7 cocks its hammer), V checks the load, Q swaps from the G95 to the RPG-7 to the G95-L to the G95-I and round, Space jumps.

## Files

- `main.scene.json`: the range, the catalogue of the sheet and every move, `world.guns3d`, and each plugin's `mods`
  naming the plugins that deliver guns3d's words.
- `assets/demo_guns3d.guns.json`, `assets/moves/`: the sheet and the moves, tuned in the guns3d workshop
  (`yarn workshop guns3d demo_guns3d`).
- `assets/demo_guns3d.json`: the player's definition: its speeds, camera, keys, the carries it holds the gun in and
  the acts its keys play.
- `assets/demo_guns3d.items.json`: the items sheet: the G95, the spent 5.56 case its port throws, the magazine a
  reload drops, the RPG-7 and the PG-7V a flying grenade is drawn as.
- `assets/volleys.json`: volley3d's patterns: the PG-7V's speed, its sustainer's climb to 295 m/s, its fall, its
  splash and its look; and the ion bolt's, straight at 140 m/s (`world.volley3d`).
- `assets/demo_guns3d.bake.ts`: the bake (`yarn bake demo_guns3d`): the X Bot and its clips, the items, and the
  scene's one looks file.
- `assets/effects.json`: the flash, the smoke, the tracer, the impacts, the case and the dropped magazine; the
  RPG-7's launch flash and smoke, its backblast, the flying grenade, its trail and its burst; where the G95-L's
  beam lands; and the ion blaster's flash, haze, bolt, trail and blast.
- `plugins/range/`: the plates.
- `plugins/laser/`: the G95-L's `cell` and `beam` words (`laser.guns3d.ts`) and the beams drawn (`laser.plugin.ts`).

## Pages

`yarn dev`, then `localhost:5173/games/demo_guns3d/index.html`, or `dev.html` for the testbed: its readout shows the
gun's mode, rounds, carry and act, and `window.__advance(n)` steps the truth `n` steps and draws one frame, so a moment
of a move is looked at exactly.
