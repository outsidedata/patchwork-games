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
Commit: games `871047e`.

**1b. The wall's net.** climb's `netOn(mesh)`: a point for each place a vertex stands (the box's faces
share their edges' vertices, so they are one point), a link for each edge of a triangle, and each
point's way out the faces round it, by area. The wall draws it over itself while its definition's
`shown` is true (`dev.html?net`).
Proof (`yard.test.ts`): on — every point and the middle of every link is 0 m from the box's surface,
and a point for every place a vertex of the mesh stands, no more; each point's way out is one long and
leads out of the box (1 cm along it is outside, 1 cm against it inside); every link is an edge of a
triangle, both ways, no longer than a cell's diagonal; not inside — no point or link middle is in the
box. Drawn: hidden until `shown`, then a line for each link, each end on its point where the wall stands.
Commit: games `52af105`.

**1c. The hero put on one spot.** A hold on a net is `{ on, a, b, t }`: two linked points and how far
from one to the other. climb's `stay` puts the hero there every step: facing into the surface, upright,
his root set back so the middle of his palms (his own `ends`, in his hold clip's first frame) is on the
spot, standing, not falling.
Proof (`yard.test.ts`): put on the point nearest the middle of the face 4 m up, over 120 frames his place
does not move (0 m), his yaw does not change, he is not falling (`grounded`, no velocity), his front is
the way into the wall (cos = 1), his drawn model's up is the world's up, and his feet are 1.7 m up.
Measured for 1d: in the `dangle` clip his left hand is 6 cm into the wall, his right 9 cm, and his right
thigh 20 cm: that clip hangs from a ledge with the hands straight over the hips and the knees forward.
