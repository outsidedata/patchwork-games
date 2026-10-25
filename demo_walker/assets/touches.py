# Where the X Bot's skin is on every frame of each clip listed, for the library's touch catalogue
# (`touches.mjs` runs it, a share of the clips to each Blender):
#   blender --background --factory-startup --python touches.py -- <list.txt> <out dir> [--rear]
#
# <list.txt> holds one clip a line, its path under ~/troupe-collection. The body is the library's X Bot
# (`characters/xbot/xbot.fbx` under `PATCHWORK_LIBRARY`), loaded once; each clip is loaded on its own
# skeleton, sampled bone by bone on every frame and written onto the body as an action, the hips' place
# with it, as anim's export writes it (`plugins/anim/anim.export.py`), with no sidecar laid on: the skin
# is measured as the clip's FBX has it.
#
# Each vertex of the body belongs to the bone that weighs it most, and the bones make the patches:
#   sole      a foot's bones (`<Side>Foot`, `<Side>ToeBase`, `<Side>Toe_End`)
#   ball      its toes' (`<Side>ToeBase`, `<Side>Toe_End`)
#   heel      the foot's own (`<Side>Foot`)
#   hand      a hand's bones and its fingers' (`<Side>Hand…`)
#   forearm   `<Side>ForeArm`
#   shin      `<Side>Leg`: the knee kneels on its lowest skin
#   seat      the hips and the thighs (`Hips`, `LeftUpLeg`, `RightUpLeg`)
#   torso     the hips and the spine (`Hips`, `Spine`, `Spine1`, `Spine2`)
#   head      `Neck`, `Head`, `HeadTop_End`
# On each frame, in glTF's axes (x left of a body facing +z, y up, z ahead), metres, less where the clip
# starts the hips across the ground, plus the hips' rest, so the hips stand at their rest across the
# ground on the first frame (as `xbot.contacts.py` measures):
#   <patch>L, <patch>R, <patch>   the middle of the patch's skin within LOW of its lowest point
#   handL, handR                  [the middle of the hand's skin, its lowest within LOW, its highest within LOW]
#   head                          [the middle of its skin, its highest within LOW]
#   front, back, left, right      the torso's skin furthest ahead, behind, to the left and to the right
#                                 along the way the body faces (square to the line from its right hip
#                                 joint to its left), each [x, y, z]
#   joints                        the heads of the hips, the thighs, the upper arms, the shins and the
#                                 feet: [hips, hipL, hipR, shoulderL, shoulderR, kneeL, kneeR, ankleL, ankleR]
#   hipsYaw                       degrees the hips' own facing has turned from the first frame, positive
#                                 left, read off the hips bone's axis that faces the body's forward on the
#                                 first frame, as anim's export measures a clip's turn (`plugins/anim/anim.export.py`)
#   rear                          given `--rear` after the out dir, in a clip whose path says it sits
#                                 (`sit` or `seat`): the whole body's skin furthest behind, least z, in each
#                                 square of REAR metres across (x) and up (y), [[x, y, z], ...]: what a
#                                 chair's back must stand behind. A game asks it of its own few sitting
#                                 clips; over the whole library it would be megabytes a clip.
# Each clip is written to `<out dir>/<its path>.json` as `{ file, fps, frames, <patch>: [[...], one a
# frame] }`, numbers to the millimetre, and a line `TOUCHES <n>/<count> <path>` is printed as it is.
# A clip that cannot be read (no armature, no action) is written `{ file, error }`.
import bpy
import json
import math
import os
import re
import sys

import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
LIST, OUT = args[0], args[1]
WITH_REAR = '--rear' in args[2:]
FPS = 30
# Skin within this of a patch's lowest point is its underside, metres.
LOW = 0.01
# The side of the squares, across and up, a sitting clip's rearmost skin is read in, metres.
REAR = 0.02
# A clip whose path says this sits.
SITS = re.compile(r'sit|seat', re.I)
REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
# A Mixamo body faces -Y in Blender (anim's export's FWD).
FWD = Vector((0, -1, 0))


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
bare = lambda n: re.sub(r'^mixamorig\d*:?', '', n)
gltf = lambda v: (v[0], v[2], -v[1])
r = lambda v: [round(float(c), 3) for c in v]
FILES = [line.rstrip('\n') for line in open(LIST) if line.strip()]


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arms = [o for o in new if o.type == 'ARMATURE']
    return (arms[0] if arms else None), new


def drop(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if a.users == 0:
            bpy.data.actions.remove(a)


def sample(path):
    """Every frame of a clip: bare bone name to (position, turn) from its rest; or an error."""
    arm, new = load(os.path.join(CLIPS, path))
    try:
        if arm is None:
            return 'no armature'
        if not arm.animation_data or not arm.animation_data.action:
            return 'no animation'
        act = arm.animation_data.action
        sc = bpy.context.scene
        f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))
        frames = []
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            frames.append({bare(pb.name): (pb.matrix_basis.to_translation(), pb.matrix_basis.to_quaternion()) for pb in arm.pose.bones})
        return frames
    finally:
        drop(new)


def write(body, fr):
    """The clip as the body's action."""
    act = bpy.data.actions.new('clip')
    body.animation_data.action = act
    n = len(fr)
    for pb in body.pose.bones:
        b = bare(pb.name)
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
    return act


bpy.ops.wm.read_factory_settings(use_empty=True)
body, keep = load(os.path.join(LIBRARY, 'characters', 'xbot', 'xbot.fbx'))
sc = bpy.context.scene
sc.render.fps = FPS
sc.render.fps_base = 1
body.animation_data_create()
body.animation_data.action = None
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

SIDES = (('L', 'Left'), ('R', 'Right'))
PATCHES = {}
for s, side in SIDES:
    PATCHES['sole' + s] = lambda b, side=side: b in (side + 'Foot', side + 'ToeBase', side + 'Toe_End')
    PATCHES['ball' + s] = lambda b, side=side: b in (side + 'ToeBase', side + 'Toe_End')
    PATCHES['heel' + s] = lambda b, side=side: b == side + 'Foot'
    PATCHES['hand' + s] = lambda b, side=side: b.startswith(side + 'Hand')
    PATCHES['forearm' + s] = lambda b, side=side: b == side + 'ForeArm'
    PATCHES['shin' + s] = lambda b, side=side: b == side + 'Leg'
PATCHES['seat'] = lambda b: b in ('Hips', 'LeftUpLeg', 'RightUpLeg')
PATCHES['torso'] = lambda b: b in ('Hips', 'Spine', 'Spine1', 'Spine2')
PATCHES['head'] = lambda b: b in ('Neck', 'Head', 'HeadTop_End')
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
    if not sum(len(m[p]) for m in members):
        raise SystemExit(f'touches.py: no skin of the body is weighted to the {p} patch')

bone = {bare(b.name): b for b in body.pose.bones}
hips = next(b for b in body.pose.bones if b.parent is None)
JOINTS = [hips, bone['LeftUpLeg'], bone['RightUpLeg'], bone['LeftArm'], bone['RightArm'], bone['LeftLeg'], bone['RightLeg'], bone['LeftFoot'], bone['RightFoot']]
at = lambda b: np.array(gltf(body.matrix_world @ b.head))

body.animation_data.action = None
for b in body.pose.bones:
    b.location, b.rotation_quaternion, b.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
bpy.context.view_layer.update()
rest = at(hips)


def skin(o):
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


def high(pts):
    return pts[pts[:, 1] >= pts[:, 1].max() - LOW].mean(axis=0)


def measure(path):
    fr = sample(path)
    if isinstance(fr, str):
        return {'file': path, 'error': fr}
    act = write(body, fr)
    first, last = 0, len(fr) - 1
    sc.frame_set(first)
    bpy.context.view_layer.update()
    start = at(hips)
    shift = np.array([start[0] - rest[0], 0, start[2] - rest[2]])
    sits = WITH_REAR and bool(SITS.search(path))
    keys = [p for p in PATCHES if p not in ('torso',)] + ['front', 'back', 'left', 'right', 'low', 'joints', 'hipsYaw'] + (['rear'] if sits else [])
    # The hips bone's axis that faces the body's forward on the first frame, and that facing flat.
    m0 = body.matrix_world @ hips.matrix
    hips_axis = m0.to_3x3().inverted() @ FWD
    face0 = m0.to_3x3() @ hips_axis
    face0 = Vector((face0.x, face0.y, 0))
    face0 = face0.normalized() if face0.length > 1e-6 else FWD.copy()
    rows = {k: [] for k in keys}
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
        for p in PATCHES:
            if p.startswith('hand'):
                rows[p].append(r(pts[p].mean(axis=0)) + r(low(pts[p])) + r(high(pts[p])))
            elif p == 'head':
                rows[p].append(r(pts[p].mean(axis=0)) + r(high(pts[p])))
            elif p != 'torso':
                rows[p].append(r(low(pts[p])))
        joints = [at(b) - shift for b in JOINTS]
        side = joints[1] - joints[2]
        ahead = np.array([-side[2], 0, side[0]])
        ahead /= max(np.linalg.norm(ahead), 1e-9)
        leftward = np.array([ahead[2], 0, -ahead[0]])
        torso = pts['torso']
        for key, axis, pick in (('front', ahead, np.argmax), ('back', ahead, np.argmin), ('left', leftward, np.argmax), ('right', leftward, np.argmin)):
            rows[key].append(r(torso[pick(torso @ axis)]))
        rows['low'].append(r(low(torso)))
        rows['joints'].append([c for j in joints for c in r(j)])
        fwd = (body.matrix_world @ hips.matrix).to_3x3() @ hips_axis
        fwd.z = 0
        rows['hipsYaw'].append(round(math.degrees(math.atan2(face0.cross(fwd).z, face0.dot(fwd))), 2) if fwd.length > 1e-6 else 0.0)
    body.animation_data.action = None
    bpy.data.actions.remove(act)
    return {'file': path, 'fps': FPS, 'frames': len(fr), **rows}


for i, path in enumerate(FILES):
    try:
        out = measure(path)
    except Exception as e:
        out = {'file': path, 'error': str(e)}
    dest = os.path.join(OUT, path + '.json')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print(f'TOUCHES {i + 1}/{len(FILES)} {path}', flush=True)
