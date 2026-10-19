# farm2d: Tiny Harvest

A little farm that never stops. Three loops run side by side in one field, each played by a
different role:

- **Cow:** graze the pasture's grass bare, chew, and drop manure. The grass grows back.
- **Farmer:** carry manure to the tilled plot, where it grows a crop; carry the ripe crops to the
  harvest pile in the chickens' yard.
- **Chicken:** peck the bugs that creep in to nibble the harvest pile.

Pick **Farmer**, **Cow** or **Chicken** on the title. You take over one of that role's cast already
living in the field; if people play every one of them, a new one comes in for you. When you leave,
the one you played goes back to the computer and carries on. There are no rounds, no timer and no
score.

Arrows or WASD walk, Space does your role's one verb, Escape opens the sound menu.

## Playing it

```
yarn editor farm2d                                         # then /games/farm2d/index.html
node --experimental-strip-types games/farm2d/farm2d.server.ts   # then /games/farm2d/client.html
```

`dev.html?role=cow` enters the field playing a cow.

## Remaking the art

```
node games/farm2d/assets/make.mjs                          # the sheets, the tilesets, the field and its actors, and farm2d.wad
node --experimental-strip-types games/farm2d/assets/song.ts     # the song and the sounds
```

`make.mjs` reads the pack from the library, `vendor/maevedevs-farm-rpg/` under `PATCHWORK_LIBRARY`
(else `~/patchwork-library`), where it is kept as downloaded and never committed. Every picture it
makes is sealed into `assets/farm2d.wad`, which the scene names in `world.loader.wads`, so the pack's
pixels are never in the repo as themselves.

## Credit

The art is **Farm RPG FREE 16x16** by **maevedevs**: https://maevedevs.itch.io/farm-rpg. The
grass, the manure and the bugs are drawn by `assets/make.mjs`.
