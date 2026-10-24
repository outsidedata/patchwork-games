# Where the X Bot's skin is on every frame of every clip of its rig, for the clip heuristics
# (`xbot.contacts.mjs`), written to <out.json>. Run by the game's bake (`demo_walker.bake.ts`):
#   blender --background --factory-startup --python xbot.contacts.py -- <rig.json> <out.json>
#
# The body (the rig's `bodies`, under the library) and each clip (under ~/troupe-collection) are loaded
# as anim's export loads them (`plugins/anim/anim.export.py`): each clip's bones sampled frame by frame
# and written onto the body as an action, the hips' place with it. The rig gives no `spread`, `size` or
# `rebase`, which the export would also apply; a rig that gives one stops this script.
#
# Each vertex of the body's meshes belongs to the bone that weighs it most, and the bones make the
# patches the skin is read by:
#   sole     a foot's bones (`<Side>Foot`, `<Side>ToeBase`, `<Side>Toe_End`)
#   ball     its toes' (`<Side>ToeBase`, `<Side>Toe_End`): what stands on a rung, the heel hanging
#            under it
#   hand     a hand's bones and its fingers' (`<Side>Hand` and every `<Side>Hand…`)
#   seat     the hips and the thighs (`Hips`, `LeftUpLeg`, `RightUpLeg`)
#   torso    the hips and the spine (`Hips`, `Spine`, `Spine1`, `Spine2`)
# On each frame, in glTF's axes (x left of a body facing +z, y up, z ahead), metres, each place moved
# across the ground as anim's export moves the bone ends it measures (`ends`): less where the clip
# starts the hips, plus the hips' rest, so the hips stand at their rest across the ground on the first
# frame and every point lines up with the rig's `ends`, less the steady progress the export takes off:
#   soleL, soleR     the middle of the sole's skin within LOW of its lowest point
#   ballL, ballR     the middle of the ball's skin within LOW of its lowest point
#   handL, handR     [the middle of the hand's skin, the middle of its skin within LOW of its lowest]
#   seat             the middle of the seat's skin within LOW of its lowest point
#   front, back      the torso's skin furthest ahead and furthest behind along the way the body faces
#                    (square to the line from its right hip joint to its left, across the ground), each
#                    [x, y, z, how far along]
#   left, right      the torso's skin furthest to its left and right, the same
#   rear             in a clip whose rig name or file says it sits (`sit` or `seat`, as `xbot.contacts.mjs`'s
#                    WORDS read it), the whole body's skin furthest behind, along the clip's own z, in
#                    each square of REAR metres across (x) and up (y): [[x, y, z], ...], what a chair's
#                    back must stand behind
# written as `{ fps, clips: { <clip>: { <patch>: [[...], ...] one a frame } } }`.
import bpy
import json
import os
import re
import sys

import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
RIG, OUT = args[0], args[1]
FPS = 30
# Skin within this of a patch's lowest point is its underside, metres.
LOW = 0.01
# The side of the squares, across and up, a sitting clip's rearmost skin is read in, metres.
REAR = 0.02
# A clip whose rig name or file says this sits (`xbot.contacts.mjs`'s WORDS, `sit`).
SITS = re.compile(r'sit|seat', re.I)
REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')


def dotenv(path):
    """The `KEY=value` lines of a .env file, as anim's export reads them."""
    if not os.path.exists(path):
        return {}
    pairs = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        pairs[key.strip()] = value
    return pairs


ENV = {**dotenv(os.path.join(REPO, '.env')), **os.environ}
CLIPS = os.path.expanduser('~/troupe-collection')
LIBRARY = os.path.expanduser(ENV.get('PATCHWORK_LIBRARY') or '~/patchwork-library')
spec = json.load(open(RIG))
for option in ('spread', 'size'):
    if spec.get(option):
        raise SystemExit(f'xbot.contacts.py: the rig gives `{option}`, which this script does not apply')
bare = lambda n: re.sub(r'^mixamorig\d*:?', '', n)
gltf = lambda v: (v[0], v[2], -v[1])


def load(path, root):
    full = os.path.join(root, path)
    if not os.path.exists(full):
        raise SystemExit(f'xbot.contacts.py: no file at {full}')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=full)
    new = [o for o in bpy.data.objects if o not in before]
    return next(o for o in new if o.type == 'ARMATURE'), new


def drop(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if a.users == 0:
            bpy.data.actions.remove(a)


def sample(path):
    """Every frame of a clip: bare bone name to (position, turn) from its rest."""
    arm, new = load(path, CLIPS)
    act = arm.animation_data.action
    sc = bpy.context.scene
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    frames = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        frames.append({bare(pb.name): (pb.matrix_basis.to_translation(), pb.matrix_basis.to_quaternion()) for pb in arm.pose.bones})
    drop(new)
    return frames


def write(body, name, fr):
    """The clip as an action on the body."""
    act = bpy.data.actions.new(name)
    body.animation_data.action = act
    bones = {bare(pb.name): pb for pb in body.pose.bones}
    n = len(fr)
    for b, pb in bones.items():
        if b not in fr[0]:
            continue
        pb.rotation_mode = 'QUATERNION'
        qs, prev = [], None
        for pose in fr:
            q = pose[b][1].copy()
            if prev is not None:
                q.make_compatible(prev)
            qs.append(q)
            prev = q
        channels = [('rotation_quaternion', [[q[i] for q in qs] for i in range(4)])]
        if b == 'Hips':
            channels.append(('location', [[pose[b][0][i] for pose in fr] for i in range(3)]))
        for prop, rows in channels:
            path = f'pose.bones["{pb.name}"].{prop}'
            for i, vals in enumerate(rows):
                fc = act.fcurve_ensure_for_datablock(body, path, index=i, group_name=pb.name)
                fc.keyframe_points.add(n)
                fc.keyframe_points.foreach_set('co', [c for f in range(n) for c in (f, vals[f])])
                for k in fc.keyframe_points:
                    k.interpolation = 'LINEAR'
                fc.update()
    body.animation_data.action = None
    return act


bpy.ops.wm.read_factory_settings(use_empty=True)
files = {name: (e if isinstance(e, str) else e.get('file')) for name, e in spec['clips'].items()}
for name, e in spec['clips'].items():
    if not isinstance(e, str) and e.get('rebase'):
        raise SystemExit(f'xbot.contacts.py: the clip {name} gives `rebase`, which this script does not apply')
seen = {}
for name, f in files.items():
    if f and f not in seen:
        seen[f] = sample(f)
        print(f'SAMPLE {f} frames={len(seen[f])}')

body_file = next(iter(spec['bodies'].values()))
bpy.ops.wm.read_factory_settings(use_empty=True)
body, keep = load(body_file, LIBRARY)
sc = bpy.context.scene
sc.render.fps = FPS
sc.render.fps_base = 1
body.animation_data_create()
body.animation_data.action = None
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
acts = {name: write(body, name, seen[f]) for name, f in files.items() if f}

# Each mesh's vertices sorted into patches by the bone that weighs them most.
PATCHES = {
    'soleL': lambda b: b in ('LeftFoot', 'LeftToeBase', 'LeftToe_End'),
    'soleR': lambda b: b in ('RightFoot', 'RightToeBase', 'RightToe_End'),
    'ballL': lambda b: b in ('LeftToeBase', 'LeftToe_End'),
    'ballR': lambda b: b in ('RightToeBase', 'RightToe_End'),
    'handL': lambda b: b.startswith('LeftHand'),
    'handR': lambda b: b.startswith('RightHand'),
    'seat': lambda b: b in ('Hips', 'LeftUpLeg', 'RightUpLeg'),
    'torso': lambda b: b in ('Hips', 'Spine', 'Spine1', 'Spine2'),
}
meshes = [o for o in keep if o.type == 'MESH']
members = []
for o in meshes:
    groups = {g.index: bare(g.name) for g in o.vertex_groups}
    owner = []
    for v in o.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        owner.append(groups.get(best.group, '') if best else '')
    members.append({p: np.array([i for i, b in enumerate(owner) if test(b)], dtype=np.int64) for p, test in PATCHES.items()})
for p in PATCHES:
    count = sum(len(m[p]) for m in members)
    if not count:
        raise SystemExit(f'xbot.contacts.py: no skin of the body is weighted to the {p} patch')
    print(f'PATCH {p} vertices={count}')

bone = lambda name: next(b for b in body.pose.bones if bare(b.name) == name)
hips = next(b for b in body.pose.bones if b.parent is None)
at = lambda b: np.array(gltf(body.matrix_world @ b.head))

# The hips' rest across the ground: the armature with no action, at rest.
body.animation_data.action = None
for b in body.pose.bones:
    b.location, b.rotation_quaternion, b.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
bpy.context.view_layer.update()
rest = at(hips)


def skin(o):
    """The mesh's vertices as the frame deforms them, in the world, glTF's axes."""
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    m = ev.to_mesh()
    co = np.empty(len(m.vertices) * 3)
    m.vertices.foreach_get('co', co)
    ev.to_mesh_clear()
    co = co.reshape(-1, 3)
    mw = np.array(o.matrix_world)
    w = co @ mw[:3, :3].T + mw[:3, 3]
    return np.stack([w[:, 0], w[:, 2], -w[:, 1]], axis=1)


def low(pts):
    return pts[pts[:, 1] <= pts[:, 1].min() + LOW].mean(axis=0)


def rearmost(w):
    """The skin furthest behind, least z, in each square of REAR across and up."""
    cell = np.floor(w[:, 0] / REAR).astype(np.int64) * 1000003 + np.floor(w[:, 1] / REAR).astype(np.int64)
    order = np.lexsort((w[:, 2], cell))
    first = order[np.concatenate(([True], cell[order][1:] != cell[order][:-1]))]
    return [r(p) for p in w[first]]


r = lambda v: [round(float(c), 4) for c in v]
out = {'fps': FPS, 'clips': {}}
for name, act in acts.items():
    body.animation_data.action = act
    first, last = (int(round(f)) for f in act.frame_range)
    sc.frame_set(first)
    start = at(hips)
    shift = np.array([start[0] - rest[0], 0, start[2] - rest[2]])
    sits = bool(SITS.search(name) or SITS.search(files[name] or ''))
    rows = {p: [] for p in ('soleL', 'soleR', 'ballL', 'ballR', 'handL', 'handR', 'seat', 'front', 'back', 'left', 'right') + (('rear',) if sits else ())}
    for f in range(first, last + 1):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        pts = {p: [] for p in PATCHES}
        whole = []
        for o, mem in zip(meshes, members):
            w = skin(o) - shift
            whole.append(w)
            for p, idx in mem.items():
                if len(idx):
                    pts[p].append(w[idx])
        pts = {p: np.concatenate(v) for p, v in pts.items()}
        if sits:
            rows['rear'].append(rearmost(np.concatenate(whole)))
        l = at(bone('LeftUpLeg')) - shift
        rr = at(bone('RightUpLeg')) - shift
        side = l - rr
        ahead = np.array([-side[2], 0, side[0]])
        ahead /= np.linalg.norm(ahead)
        leftward = np.array([ahead[2], 0, -ahead[0]])
        rows['soleL'].append(r(low(pts['soleL'])))
        rows['soleR'].append(r(low(pts['soleR'])))
        rows['ballL'].append(r(low(pts['ballL'])))
        rows['ballR'].append(r(low(pts['ballR'])))
        rows['handL'].append(r(pts['handL'].mean(axis=0)) + r(low(pts['handL'])))
        rows['handR'].append(r(pts['handR'].mean(axis=0)) + r(low(pts['handR'])))
        rows['seat'].append(r(low(pts['seat'])))
        torso = pts['torso']
        for key, axis, pick in (('front', ahead, np.argmax), ('back', ahead, np.argmin), ('left', leftward, np.argmax), ('right', leftward, np.argmin)):
            d = torso @ axis
            i = pick(d)
            rows[key].append(r(torso[i]) + [round(float(d[i]), 4)])
    out['clips'][name] = rows
    print(f'SKIN {name} frames={last - first + 1}')
body.animation_data.action = None
json.dump(out, open(OUT, 'w'))
print(f'WROTE {OUT} clips={len(out["clips"])}')
