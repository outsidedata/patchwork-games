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

MIT, Outside Data.
