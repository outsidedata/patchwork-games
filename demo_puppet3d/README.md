# demo_puppet3d

AWOL animals and a Mixamo body posed by puppet3d.

Keys: 1 to 5 pace, `w` `s` pace up and down, `t` upright or on four legs, `j` leap, `[` `]` station,
`q` `e` camera.

## The rider

Station 5 is the horse ridden: the `rider` kind is the horse's definition with a second layout, the
X Bot, hung `on` the horse's `body:spine 2` with `along`, `offset` and `turn`. The horse's solver
stands its bones first, then the X Bot is hung on that bone and seated by a cues driver on the
horse's own senses (`stride`, `speed`, `clock`), so it rides each stride the way the head and tail do.
`rider.cues.mjs` writes the `rider` definition, its seat and every bone's cues; tune the pose there
and run `node games/demo_puppet3d/rider.cues.mjs`.

`pose.html` (`?kind=<kind>`, `rider` by default) poses a kind's hung layouts with puppet3d's own
`played`, `hung` and `skinned` on the world layout's rest skeleton: drag and wheel to orbit, side,
front, back and top views, a slider for each sense, and `R` to read the definition again.

## Sheets from the library

Over its walk, each animal plays cue sheets from the library's `cues/`, each naming only its own bones:
the horse wags its tail and flicks its ears, the tiger looks round and wags, the lion wags and roars
every ten seconds, the cheetah grazes when it stands and flicks its ears. The X Bot nods, and waves when
it stands. `yarn bake demo_puppet3d` (`assets/demo_puppet3d.bake.ts`) copies the sheets into
`assets/cues/`; the walk and upright cues each animal's solvers play are its own sheets there too.

## The pegasus

Station 6 is the pegasus: the horse's definition with a second layout, `wings`, hung `on` the horse's
`body:spine 5`. The wings are their own glb on their own six bones (`assets/wings/`, built by
`wings/wings.py` in the bake), beating by the library's `flap` sheet on the clock while the horse walks
under its solver. The same wings hang on any body by one more layout in its definition.

## The herd

`dev.html?scene=herd` is the AWOL animals as a crowd3d crowd, some walking up and down their lines and
some standing, drawn from `assets/awol/<animal>.clips.glb`: each animal posed by puppet3d and written
with a `walk` and an `idle` by `plugins/puppet3d/puppet3d.clips.ts`, which the bake runs. Every body is
on the horse's skeleton, so crowd3d plays the horse's clips on all four.

## An animal's files

Each animal is three files in `assets/awol/`:

- `<animal>.glb`: its body, on the AWOL bones.
- `<animal>.skeleton.json`: its bones as its glb has them, from its own glb.
- `<animal>.json`: its sheet, the numbers of how it walks: `walk` on four legs, `upright` on two.

Its definition in `assets/demo_puppet3d.json` says how it is posed: its senses, and its layout's
drivers, the four-legged walk and the upright, each with the cues of the bones it does not stand.

The lion's and the cheetah's sheets and definitions are copies of the tiger's.

## Adding an animal

Put its three files in `assets/awol/`.

In `main.scene.json`, three catalogue entries in `world.loader.assets`:

```json
"<animal>": { "type": "json", "url": "/games/demo_puppet3d/assets/awol/<animal>.json", "preload": true },
"<animal>Skeleton": { "type": "json", "url": "/games/demo_puppet3d/assets/awol/<animal>.skeleton.json", "preload": true },
"<animal>Skin": { "type": "model", "url": "/games/demo_puppet3d/assets/awol/<animal>.glb", "preload": true },
```

the kind in `world.puppet3d.kinds`, a prefab in `prefabs` (a copy of another animal's), and an actor
at the next station:

```json
{ "is": "<kind>", "at": <station>, "pos": [<x>, 0, <z>] }
```

In `assets/demo_puppet3d.json`, one more in `player.stations`, and the kind's definition: a copy of
another animal's, its `sheet`, both drivers' `gait`, its `skeleton` and its `skin` named for it.

In `main.sim.ts`, the kind on `sim`:

```ts
<kind>: strider
```
