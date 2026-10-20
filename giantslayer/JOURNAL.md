# giantslayer journal

The climbing work, step by step, as it happens. The plan is issue #41 (outsidedata/core): climbing on a
net made from a mesh's vertices, built one small step at a time, each proven before the next. Every step
is proven both ways, by numbers read off the running game: that he is ON the surface, and that nothing
of him is inside it.

## 2026-10-20

**The colossus is mechworker.** The rig `assets/colossus/colossus.rig.json` names
`characters/mechworker/mechworker.fbx`; baked at size 12, the same 9 clips. It stands 21.5 m. Every
material came out with metallic 0. Seen walking to the hero and stomping in the arena.
Commit: games `faea3bf`.

**A first try at the whole climb, thrown away.** Built the net, hold modes, swinging, stepping hands
and feet, IK limits and a bot in one go and tested it on a giant walking, roaring and stomping. The hero
was nowhere near the body. Everything reverted except the mechworker bake. Lesson: the steps in #41,
one at a time, the giant last.

**1a. A box in the yard.** A new scene, `yard` (`dev.html?scene=yard`): the gym's flat plain, one
`wall`, and the hero's start 6 m in front of it. The wall is a box of its definition's `size`
`[6, 8, 1]` metres, each face a grid of `cell` 0.25 m squares (climb's `box`), standing on the ground
under it (walker's height).
Proof (`yard.test.ts`, the game booted and its page run in node): the yard's rows are only scenemanager,
loader, skydome3d, start, wall and the hero; the wall's base is at the height the hero's feet stand at;
the page draws one `wall` mesh whose box is exactly 6 × 8 × 1 m from the ground up, centred on its row.
