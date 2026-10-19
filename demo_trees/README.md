# demo_trees

A workbench for the trees grown by the library's `trees/trees.py` (Blender's Sapling Tree Gen). It shows
every species of `~/patchwork-library/trees/species/` side by side, one tree each, at four levels of
detail.

## The loop

1. Change a species in `~/patchwork-library/trees/species/<name>.json`, or this game's pack in
   `assets/trees.trees.json` (which trees, their heights, the LODs).
2. Run `yarn bake demo_trees`. It grows the pack and packs it into `assets/trees.glb`.
3. The open page reloads with the new trees.

The spec, the species and what was learned running Sapling are in
`~/patchwork-library/trees/README.md`.

## The page

`yarn editor demo_trees`, then `localhost:<port>/games/demo_trees/index.html`.

| Key | What it does |
| --- | --- |
| WASD, Space / C, Shift | fly, rise and sink, faster |
| right-drag, wheel | look, fly pace |
| M | the lineup of every tree, or one tree at LOD 0 to 3 |
| L, 0–3, 9 | the lineup's next LOD, one LOD, or each tree by its distance (scatter3d's shells) |
| [ ] | the tree the LOD view shows |

Each tree is labelled with its name, its LOD and its triangles. The caption gives the triangles of
everything drawn. Every number (keys, shells, light, gap) is in `assets/demo_trees.json`.
