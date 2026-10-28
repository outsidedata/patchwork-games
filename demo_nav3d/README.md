# demo_nav3d

A crowd walking the inside of a glass cube: the floor, the four walls and the ceiling, each person
standing on the face under them and turning over each edge onto the next.

The people are npc3d NPCs on crowd3d bodies. They walk nav3d's graph of the cube, whose nodes give the
up of the ground at each one (`normal`). Each face has a middle node and a ring of eight. Each edge
has three nodes whose up is halfway between its two faces, so a person rolls over the edge in two
halves. Each person walks to a node picked at random, stands there a moment, and picks again.

## Controls

You look in from a flying eye. Click the game to look with the mouse, and Escape to let it go; without
the lock, drag with the left button held to look. W and S fly the way you look, A and D across, E and
Q up and down; hold Shift to fly fast, and the wheel paces. `dev.html` adds a panel that turns on
nav3d's view of the graph, with each node's up, and npc3d's view of every route.

## Playing it

```
yarn dev            # localhost:5173/games/demo_nav3d/index.html, or dev.html
yarn serve demo_nav3d   # then localhost:5173/games/demo_nav3d/client.html
```

## Remaking the art

`yarn bake demo_nav3d` runs `assets/demo_nav3d.bake.ts`:

- `assets/cube.nav.json`, the cube's graph, written by `assets/cube.nav.ts` from the `cube`
  definition's `size` and `at` in `assets/demo_nav3d.json`. It reads nothing from the library.
- `farmer_man.glb`, `farmer_woman.glb`, `farmhand.glb` and `mechworker.glb`: each body of
  `assets/crowd.rig.json`, a Mixamo character in the library's `characters/`, with the rig's idle, walk
  and run clips from the library's `packs/` baked onto it by anim's export (`plugins/anim/anim.export.py`).

## Credit

The characters and their clips are Mixamo's (Adobe), from the library.
