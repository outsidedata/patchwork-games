# demo_render3d

The demo of the `render3d` plugin's reflections, in two scenes. Nothing is played: the camera stands
still and the scene moves.

| scene | what it shows |
|---|---|
| main | a room of mirrors: a polished mirror floor, a looking glass on the back wall and a rough mirror on the side wall, glowing balls and a chrome box circling between pedestals; each mirror shows the others |
| glossy | a polished yard of pillars, glowing bars and a chrome ball circling, reflected live in the floor by screen-space reflections |

## Controls

None: the scene plays itself.

## The dev page

`dev.html` is the demo's main page. `?scene=<scene>` enters a scene, as the panel's picker does. The
panel tunes, live: the exposure; each mirror's resolution, roughness, metalness and colour; the
floor's roughness, metalness and colour where it is no mirror; and each light's strength, reach and
colour. In glossy, the screen-space reflections folder turns them off to compare (`?ssr=0`, a reload)
and tunes their steps, distance, thickness and roughness live, with "copy ssr JSON".

## Playing it

```
yarn dev
```

then open `/games/demo_render3d/dev.html`, or `/games/demo_render3d/index.html` for the plain page.
Against its server:

```
yarn serve demo_render3d
```

then open `/games/demo_render3d/client.html`.

## Remaking the art

There is none: everything is drawn from three.js shapes by `stage.client.ts`, from the sets in
`assets/demo_render3d.json`.
