# patchwork-games

The flagship games of Patchwork: the reference for how things are built in core. Each one ships
baked: its art built and compressed (meshopt geometry, WebP textures), so it plays from a clone with
no Blender and no library.

Clone it as `games/` inside a core clone, then open a game in the editor:

```
git clone git@github.com:outsidedata/patchwork-games.git games
yarn editor <game>
```

A game's art is made again with `yarn bake <game>`, which reads the raw parts from
`PATCHWORK_LIBRARY` and runs the scripts beside the game's art (`yarn health` checks the machine has
what it needs).

## The flagships

- **arcaderacer**: an arcade racer of three courses, Cascade Forest, Tokyo Bayside and Paris Dusk,
  against seven rivals, with a lobby for several players.
- **demo_audiodaw**: a music studio on the audiodaw plugin: a rack, a mixer, a piano roll and an
  arrangement, and the jungle song generator arcaderacer's music is made with.
- **farm2d**: Tiny Harvest, a pixel farm that never stops: play the farmer, a cow or a chicken, and
  the computer plays every one nobody does.

MIT, Outside Data, but for art a game credits to someone else under its own licence. farm2d's art
is maevedevs' Farm RPG FREE 16x16 (https://maevedevs.itch.io/farm-rpg), shipped sealed in
`farm2d/assets/farm2d.wad`, which the loader opens in memory; the pack itself is not in this repo.
