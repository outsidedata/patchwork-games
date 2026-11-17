# demo_puppet3d

AWOL animals and a Mixamo body posed by puppet3d.

Keys: 1 to 5 pace, `t` four legs or upright, `[` `]` station, `q` `e` camera.

## Adding an animal

Put its glb and its sheet in `assets/awol/`, then measure its skeleton from the glb:

```
node games/demo_horse3d/assets/awol/awol.measure.mjs assets/awol/<animal>.glb <a scratch sheet>.json assets/awol/<animal>.skeleton.json
```

In the sheet, `assets/awol/<animal>.json`:

```json
"skeleton": "<animal>Skeleton",
"skin": "<animal>Skin",
```

In `main.scene.json`, three catalogue entries in `world.loader.assets`:

```json
"<animal>": { "type": "json", "url": "/games/demo_puppet3d/assets/awol/<animal>.json", "preload": true },
"<animal>Skeleton": { "type": "json", "url": "/games/demo_puppet3d/assets/awol/<animal>.skeleton.json", "preload": true },
"<animal>Skin": { "type": "model", "url": "/games/demo_puppet3d/assets/awol/<animal>.glb", "preload": true },
```

the kind and its sheet in `world.puppet3d.kinds`:

```json
"<kind>": "<animal>"
```

a prefab in `prefabs`, a copy of another animal's, and an actor at the next station:

```json
{ "is": "<kind>", "at": <station>, "pos": [<x>, 0, <z>] }
```

In `assets/demo_puppet3d.json`, one more in `player.stations`, and the kind's block:

```json
"<kind>": {
  "puppets": ["four", "upright"],
  "speeds": { "four": [0, 1.1, 2.6, 5, 12], "upright": [0, 0.6, 0.9, 1.2, 1.5] },
  "show": { "radius": 14.4, "accel": 4, "dist": 6, "lift": 0.7 }
}
```

In `main.sim.ts`, the kind on `sim`:

```ts
<kind>: strider
```
