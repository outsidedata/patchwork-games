# demo_puppet3d

AWOL animals and a Mixamo body posed by puppet3d.

Keys: 1 to 5 pace, `w` `s` pace up and down, `t` upright or on four legs, `j` leap, `[` `]` station,
`q` `e` camera.

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
