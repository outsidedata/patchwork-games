# The airfield: runway 18/36 with its markings, the parallel taxiway and its links, the apron, a hangar
# for each plane, the tower and the windsock, built in Blender and exported as one glb. This script is
# the model's source, and the game's bake runs it (`yarn bake flight`, `flight.bake.ts`), which packs
# the glb it writes into airport.glb:
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python games/flight/assets/airport.py -- <out.glb> <set>=<folder>... [<preview dir>]
#
# Each `<set>=<folder>` is a cc0-textures set the surfaces are made from, by its zip's name, and the
# library's folder its maps were downloaded into (the bake's `texture`).
#
# Every place is the `airport` definition of `flight.json`, the numbers the game reads too, so the model
# and the rules cannot disagree. They are in the game's frame: metres, x east, z south, y up, the origin
# the middle of the runway on the field's ground. Blender's frame is +X east, +Y north, +Z up, so a
# game z is Blender −Y, and the glTF exporter's Y-up conversion hands three the game's frame back.
#
#   pavement   one mesh: every paved rectangle and every marking on it laid on one lattice of the
#              coordinates they use, each cell taken by the highest of them over it, so paint and
#              asphalt are faces of one surface and never lie on each other. Its top is TOP over the
#              ground and its edge runs down SKIRT under it. Runway: threshold bars, the numbers,
#              centreline dashes, edge lines, touchdown-zone bars and aiming points (FAA AC 150/5340-1
#              proportions for a 30 m runway). Taxiway and links: yellow centrelines running on to the
#              runway's, a hold-short line on each link. Apron: concrete slabs `joint` metres square,
#              sealant between, a yellow lead-in line and stop bar for each hangar. Hangar floors and
#              the tower's pad are concrete.
#   hangars    walls of ribbed steel on a line of corner posts, an arched roof of the same across the
#              width, the walls and posts running up into it, the gable ends one solid
#              with the walls, the door opening `door` wide and tall between steel jambs under a header,
#              sliding door leaves parked open beside it under an outrigger track, the plane's name
#              over the door.
#   tower      a concrete base building with a parapet, a shaft, the cab floor and its railed catwalk,
#              the cab's sill, eight mullions, outward-sloping glass, a roof slab, a console, a mast.
#   windsock   a pole, an arm and the sock in five bands, hanging off a wind from the north.
#   lights     runway edge lights every 60 m, white, none where a link joins, and threshold lights
#              across each end, green.
#
# Joints between solids overlap, never butt: a part ends inside the one it meets, and a part whose face
# would share a plane with its neighbour's stands proud of it, so no two faces lie on each other.
# Every surface is a real PBR set from the library's cc0-textures at its measured size a repeat,
# its images cut to 1024 px, UVs laid in metres in world axes. The build prints its asserts and throws
# when one fails. It is deterministic: two builds are the same file byte for byte.
import bpy
import bmesh
import json
import math
import numpy as np
import os
import sys
from bisect import bisect_left
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = argv[0] if argv else os.path.join(HERE, 'airport.glb')
SETS = dict(a.split('=', 1) for a in argv[1:] if '=' in a)
PREVIEW = next((a for a in argv[1:] if '=' not in a), None)
A = json.load(open(os.path.join(HERE, 'flight.json')))['airport']

TOP = 0.05          # the pavement's top over the ground
SKIRT = 0.35        # how far its edge runs down
BASE = -SKIRT       # where every building's walls start, under the ground
TRIS = 120000


def reset():
    """An empty file: a fresh factory one headless, every datablock removed in a running Blender, whose
    add-ons a factory reset would switch off."""
    if bpy.app.background:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        return
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves,
                 bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for d in list(coll):
            coll.remove(d)


reset()

# ------------------------------------------------------------------ materials

loaded = {}


def image(path, colour):
    if path in loaded:
        return loaded[path]
    img = bpy.data.images.load(path)
    loaded[path] = img
    w, h = img.size
    if max(w, h) > 1024:
        k = 1024 / max(w, h)
        img.scale(round(w * k), round(h * k))
        img.pack()
    img.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    return img


def find(folder, *keys):
    """The first image of the set `folder` whose name holds every key, case aside, in the folder the
    command line gives that set."""
    assert folder in SETS, (folder, 'no folder given for the set')
    image_file = lambda f: all(k.lower() in f.lower() for k in keys) and f.lower().endswith(('.jpg', '.jpeg', '.png'))
    hits = [os.path.join(SETS[folder], f) for f in os.listdir(SETS[folder]) if image_file(f)]
    assert hits, (folder, keys)
    return sorted(hits)[0]


def pbr(name, folder, metal=0.0, tint=None):
    m = bpy.data.materials.new(name)
    m.use_backface_culling = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = image(find(folder, 'color'), True)
    if tint:
        # The set's grain kept, its colour multiplied by `tint` in the pixels, so the export carries it.
        t.image = t.image.copy()
        t.image.name = name + '_color'
        px = np.empty(len(t.image.pixels), dtype=np.float32)
        t.image.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        px[:, :3] *= np.array(tint, dtype=np.float32)
        t.image.pixels.foreach_set(px.ravel())
        t.image.pack()
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = image(find(folder, 'normalgl'), False)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(n.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    r = nt.nodes.new('ShaderNodeTexImage')
    r.image = image(find(folder, 'roughness'), False)
    nt.links.new(r.outputs['Color'], b.inputs['Roughness'])
    b.inputs['Metallic'].default_value = metal
    return m


def flat(name, col, rough, metal=0.0, alpha=1.0, glow=0.0, double=False):
    m = bpy.data.materials.new(name)
    m.use_backface_culling = alpha == 1.0 and not double
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if glow:
        b.inputs['Emission Color'].default_value = (*col, 1.0)
        b.inputs['Emission Strength'].default_value = glow
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


# (material, metres a repeat): Asphalt010's aggregate at about 8 mm a stone; CorrugatedSteel008A at
# 3.05 m a repeat, the cladding of walls and roof alike; Concrete036 as a poured slab's float marks.
MAT = {}


def put(key, m, size):
    MAT[key] = (m, size)


put('asphalt', pbr('asphalt', 'Asphalt010_4K-JPG'), 2.5)
put('concrete', pbr('concrete', 'Concrete036_4K-JPG'), 2.5)
put('siding', pbr('siding', 'CorrugatedSteel008A_4K-JPG', metal=0.4), 3.05)
put('roof', pbr('roof', 'CorrugatedSteel008A_4K-JPG', metal=0.6), 3.05)
put('doors', pbr('doors', 'CorrugatedSteel008A_4K-JPG', metal=0.4, tint=(0.45, 0.58, 0.78)), 3.05)
put('white', flat('paint white', (0.82, 0.82, 0.8), 0.65), 1.0)
put('yellow', flat('paint yellow', (0.86, 0.62, 0.08), 0.65), 1.0)
put('joint', flat('joint sealant', (0.07, 0.07, 0.07), 0.9), 1.0)
put('steel', flat('steel', (0.32, 0.34, 0.37), 0.45, metal=0.7), 1.0)
put('letters', flat('letters', (0.06, 0.12, 0.3), 0.5), 1.0)
put('glass', flat('glass', (0.12, 0.17, 0.2), 0.05, metal=0.2, alpha=0.45), 1.0)
put('console', flat('console', (0.15, 0.15, 0.17), 0.6), 1.0)
put('red', flat('mast red', (0.7, 0.06, 0.04), 0.5), 1.0)
put('lens.white', flat('lens white', (1.0, 0.95, 0.8), 0.2, glow=3.0), 1.0)
put('lens.green', flat('lens green', (0.1, 1.0, 0.2), 0.2, glow=3.0), 1.0)
put('sock.orange', flat('sock orange', (0.95, 0.3, 0.02), 0.85, double=True), 1.0)
put('sock.white', flat('sock white', (0.9, 0.9, 0.88), 0.85, double=True), 1.0)
ORDERED = list(MAT)


# ------------------------------------------------------------------ meshes

def B(x, y, z):
    """A game point (x east, y up, z south) in Blender's frame."""
    return Vector((x, -z, y))


class Mesh:
    """One object's bmesh and its materials by key. Every solid is built wound outward: an outline runs
    counter-clockwise seen from outside the face it makes."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.keys = []

    def mat(self, key):
        if key not in self.keys:
            self.keys.append(key)
        return self.keys.index(key)

    def face(self, vs, key):
        f = self.bm.faces.new(vs)
        f.material_index = self.mat(key)
        return f

    def loft(self, lo, hi, key, top=None, bottom=None):
        """A solid between two loops of Blender points, each counter-clockwise seen from above, `hi` over
        `lo`, point for point."""
        n = len(lo)
        lo = [self.bm.verts.new(p) for p in lo]
        hi = [self.bm.verts.new(p) for p in hi]
        self.face(hi, top or key)
        self.face(lo[::-1], bottom or key)
        for i in range(n):
            j = (i + 1) % n
            self.face([lo[i], lo[j], hi[j], hi[i]], key)

    def prism(self, outline, z0, z1, key, top=None):
        """`outline` (Blender XY, counter-clockwise from above) from height z0 to z1."""
        self.loft([Vector((x, y, z0)) for x, y in outline], [Vector((x, y, z1)) for x, y in outline], key, top=top)

    def box(self, x0, x1, y0, y1, z0, z1, key, top=None):
        """A box over game x x0..x1, z z0..z1, height y0..y1."""
        X0, X1 = sorted((x0, x1))
        Y0, Y1 = sorted((-z0, -z1))
        self.prism([(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)], min(y0, y1), max(y0, y1), key, top=top)

    def column(self, x0, x1, z0, z1, y0, top, key):
        """A box over game x x0..x1, z z0..z1 from height y0 up to `top(z)` at each corner, so it can end
        inside a sloping roof."""
        X0, X1 = sorted((x0, x1))
        Z0, Z1 = sorted((z0, z1))
        corners = [(X0, Z1), (X1, Z1), (X1, Z0), (X0, Z0)]      # counter-clockwise from above in Blender
        self.loft([B(x, y0, z) for x, z in corners], [B(x, top(z), z) for x, z in corners], key)

    def ring(self, outer, inner, z0, z1, key):
        """A wall round a hole: `outer` and `inner` (Blender XY, counter-clockwise from above, point for
        point) from height z0 to z1, one closed solid with no faces inside it."""
        n = len(outer)
        ob = [self.bm.verts.new((x, y, z0)) for x, y in outer]
        ot = [self.bm.verts.new((x, y, z1)) for x, y in outer]
        ib = [self.bm.verts.new((x, y, z0)) for x, y in inner]
        it = [self.bm.verts.new((x, y, z1)) for x, y in inner]
        for i in range(n):
            j = (i + 1) % n
            self.face([ob[i], ob[j], ot[j], ot[i]], key)        # outside, facing out
            self.face([ib[j], ib[i], it[i], it[j]], key)        # inside, facing the hole
            self.face([ot[i], ot[j], it[j], it[i]], key)        # top
            self.face([ob[j], ob[i], ib[i], ib[j]], key)        # bottom

    def sweep(self, profile, x0, x1, key, cap=None):
        """`profile`, (game z, y) points counter-clockwise seen from −x (z to the right, y up), swept
        along game x from x0 to x1."""
        n = len(profile)
        s0 = [self.bm.verts.new(B(x0, y, z)) for z, y in profile]
        s1 = [self.bm.verts.new(B(x1, y, z)) for z, y in profile]
        self.face(s0, cap or key)
        self.face(s1[::-1], cap or key)
        for i in range(n):
            j = (i + 1) % n
            self.face([s0[i], s1[i], s1[j], s0[j]], key)

    def finish(self, uv=None):
        bm = self.bm
        bm.normal_update()
        layer = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            key = self.keys[f.material_index]
            size = MAT[key][1]
            n = f.normal
            for loop in f.loops:
                p = loop.vert.co
                special = uv(key, f, p) if uv else None
                if special is not None:
                    loop[layer].uv = special
                elif abs(n.z) >= max(abs(n.x), abs(n.y)):
                    loop[layer].uv = (p.x / size, p.y / size)
                elif abs(n.x) >= abs(n.y):
                    loop[layer].uv = (p.y / size, p.z / size)
                else:
                    loop[layer].uv = (p.x / size, p.z / size)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for key in self.keys:
            me.materials.append(MAT[key][0])
        o = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(o)
        return o


SOLIDS = []         # (name, game AABB (x0, x1, y0, y1, z0, z1)) of everything that stands


def solid(name, x0, x1, y0, y1, z0, z1):
    SOLIDS.append((name, (min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))))


def rect_xz(x0, x1, z0, z1):
    """A game rectangle as a Blender outline, counter-clockwise from above."""
    X0, X1 = sorted((x0, x1))
    Y0, Y1 = sorted((-z0, -z1))
    return [(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)]


# ------------------------------------------------------------------ the pavement

RW = A['runway']
L, W = RW['length'], RW['width']
TW = A['taxiway']
AP = A['apron']
HG = A['hangar']
TWR = A['tower']
RECTS = []          # (x0, x1, z0, z1, key, rank): a higher rank paints over a lower


def rect(x0, x1, z0, z1, key, rank):
    RECTS.append((min(x0, x1), max(x0, x1), min(z0, z1), max(z0, z1), key, rank))


# The runway and its edge lines.
rect(-W / 2, W / 2, -L / 2, L / 2, 'asphalt', 0)
EDGE = 0.9
for s in (-1, 1):
    rect(s * (W / 2 - EDGE), s * W / 2, -L / 2, L / 2, 'white', 2)

# Digits as strokes in a box DIG_W wide and DIG_H tall, its foot at (0, 0), up the way it reads.
DIG_W, DIG_H, STROKE = 6.1, 18.3, 1.5
SEG = {
    'top': (0, DIG_W, DIG_H - STROKE, DIG_H), 'mid': (0, DIG_W, DIG_H / 2 - STROKE / 2, DIG_H / 2 + STROKE / 2),
    'bot': (0, DIG_W, 0, STROKE), 'ul': (0, STROKE, DIG_H / 2, DIG_H), 'ur': (DIG_W - STROKE, DIG_W, DIG_H / 2, DIG_H),
    'll': (0, STROKE, 0, DIG_H / 2), 'lr': (DIG_W - STROKE, DIG_W, 0, DIG_H / 2),
    'one': (DIG_W / 2 - STROKE / 2, DIG_W / 2 + STROKE / 2, 0, DIG_H),
}
DIGITS = {
    '0': ['top', 'bot', 'ul', 'ur', 'll', 'lr'], '1': ['one'], '2': ['top', 'ur', 'mid', 'll', 'bot'],
    '3': ['top', 'mid', 'bot', 'ur', 'lr'], '4': ['ul', 'ur', 'mid', 'lr'], '5': ['top', 'ul', 'mid', 'lr', 'bot'],
    '6': ['top', 'mid', 'bot', 'ul', 'll', 'lr'], '7': ['top', 'ur', 'lr'], '8': ['top', 'mid', 'bot', 'ul', 'ur', 'll', 'lr'],
    '9': ['top', 'mid', 'bot', 'ul', 'ur', 'lr'],
}
GAP = 3.0


def end(sign, number):
    """The markings at the end of the runway at z = sign·L/2, read by a pilot landing toward −sign; hands
    back how far in from the threshold the centreline may start."""
    def mark(a0, a1, d0, d1):
        # d metres in from the threshold, a across to the pilot's right: landing toward −z (sign +1) the
        # right is +x, toward +z it is −x.
        rect(sign * a0, sign * a1, sign * (L / 2 - d0), sign * (L / 2 - d1), 'white', 3)
    # Threshold: four bars each side of the centre, 6 m in, 45 m long.
    for i in range(4):
        a = 1.6 + i * 3.4
        mark(a, a + 1.7, 6, 51)
        mark(-a - 1.7, -a, 6, 51)
    # The number, 12 m past the bars, its digits side by side about the centre.
    w = len(number) * DIG_W + (len(number) - 1) * GAP
    for k, ch in enumerate(number):
        left = -w / 2 + k * (DIG_W + GAP)
        for s in DIGITS[ch]:
            u0, u1, v0, v1 = SEG[s]
            mark(left + u0, left + u1, 63 + v0, 63 + v1)
    # Aiming points at 306 m, touchdown-zone bars at 150, 450 and 600 m.
    mark(3, 9, 306, 351)
    mark(-9, -3, 306, 351)
    for d, bars in ((150, 3), (450, 2), (600, 2)):
        for i in range(bars):
            a = 3 + i * 3.3
            mark(a, a + 1.8, d, d + 22.5)
            mark(-a - 1.8, -a, d, d + 22.5)
    return 63 + DIG_H + 12


start = max(end(1, RW['south']), end(-1, RW['north']))
run = L - 2 * start
dashes = int((run + 24) // 60)
first = -L / 2 + start + (run - (dashes * 60 - 24)) / 2
for i in range(dashes):
    z = first + i * 60
    rect(-0.45, 0.45, z, z + 36, 'white', 3)

# The taxiway, its links to the runway, their centrelines and hold-short lines.
TX, TWW = TW['x'], TW['width']
ZL = max(abs(z) for z in TW['links']) + TWW / 2
rect(TX - TWW / 2, TX + TWW / 2, -ZL, ZL, 'asphalt', 0)
rect(TX - 0.075, TX + 0.075, -ZL + TWW / 2, ZL - TWW / 2, 'yellow', 2)
HOLD = 38           # the hold-short line's runway edge, from the runway's centreline
for zl in TW['links']:
    rect(W / 2, TX - TWW / 2, zl - TWW / 2, zl + TWW / 2, 'asphalt', 0)
    rect(0.45, TX + 0.075, zl - 0.075, zl + 0.075, 'yellow', 2)
    # Four lines 0.15 m wide and apart: dashed (0.9 m on, 0.9 m off) on the runway's side, solid on the
    # taxiway's.
    for k in range(4):
        x0 = HOLD + k * 0.3
        if k >= 2:
            rect(x0, x0 + 0.15, zl - TWW / 2, zl + TWW / 2, 'yellow', 2.5)
            continue
        z = zl - TWW / 2
        while z < zl + TWW / 2 - 0.01:
            rect(x0, x0 + 0.15, z, min(z + 0.9, zl + TWW / 2), 'yellow', 2.5)
            z += 1.8

# The apron's slabs and their joints, a lead-in line and stop bar for each hangar, the hangars' floors.
(AX0, AX1), (AZ0, AZ1) = AP['x'], AP['z']
J = AP['joint']
# The apron runs 0.2 m on under the hangars' front walls, so its edge is inside them.
rect(AX0, AX1 + 0.2, AZ0, AZ1, 'concrete', 0)
x = AX0 + J
while x < AX1 - 0.01:
    rect(x - 0.025, x + 0.025, AZ0, AZ1, 'joint', 1)
    x += J
z = AZ0 + J
while z < AZ1 - 0.01:
    rect(AX0, AX1, z - 0.025, z + 0.025, 'joint', 1)
    z += J
for h in A['hangars']:
    rect(TX + 0.075, HG['x'], h['z'] - 0.075, h['z'] + 0.075, 'yellow', 2)
    rect(HG['x'] - 25.2, HG['x'] - 24.8, h['z'] - 3, h['z'] + 3, 'yellow', 2)
    # The floor reaches 0.2 m in from the side and back walls' outer faces, so its edge is inside them
    # and off the gables' ends on the wall line.
    rect(HG['x'], HG['x'] + HG['depth'] - 0.2, h['z'] - HG['width'] / 2 + 0.2, h['z'] + HG['width'] / 2 - 0.2, 'concrete', 0)

# The tower's pad, reaching back to the apron.
rect(TWR['x'] - 15, TWR['x'] + 15, TWR['z'] - 15, AZ0, 'concrete', 0)


def pavement():
    r4 = lambda v: round(v, 4)
    xs = sorted({r4(v) for r in RECTS for v in r[0:2]})
    zs = sorted({r4(v) for r in RECTS for v in r[2:4]})
    keys = ['asphalt', 'concrete', 'white', 'yellow', 'joint']
    rank = np.full((len(xs) - 1, len(zs) - 1), -1.0)
    cell = np.full((len(xs) - 1, len(zs) - 1), -1, dtype=np.int32)
    for x0, x1, z0, z1, key, rk in sorted(RECTS, key=lambda r: r[5]):
        i0, i1 = bisect_left(xs, r4(x0)), bisect_left(xs, r4(x1))
        j0, j1 = bisect_left(zs, r4(z0)), bisect_left(zs, r4(z1))
        sub = rank[i0:i1, j0:j1]
        take = sub <= rk
        sub[take] = rk
        cell[i0:i1, j0:j1][take] = keys.index(key)
    m = Mesh('pavement')
    bm = m.bm
    grid = {}

    def v(i, j):
        if (i, j) not in grid:
            grid[(i, j)] = bm.verts.new(B(xs[i], TOP, zs[j]))
        return grid[(i, j)]
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            k = cell[i, j]
            if k >= 0:
                # Counter-clockwise from above: game z grows toward Blender −Y.
                m.face([v(i, j + 1), v(i + 1, j + 1), v(i + 1, j), v(i, j)], keys[k])
    bmesh.ops.dissolve_limit(bm, angle_limit=0.001, verts=bm.verts[:], edges=bm.edges[:], delimit={'MATERIAL'})
    # The skirt: every outside edge run down under the ground, walked the way its face runs, so the
    # side faces outward.
    for e in [e for e in bm.edges if e.is_boundary]:
        f = e.link_faces[0]
        loop = next(l for l in f.loops if l.edge == e)
        a, b = loop.vert, loop.link_loop_next.vert
        lo_a = bm.verts.new((a.co.x, a.co.y, TOP - SKIRT))
        lo_b = bm.verts.new((b.co.x, b.co.y, TOP - SKIRT))
        key = m.keys[f.material_index]
        m.face([b, a, lo_a, lo_b], 'concrete' if key in ('concrete', 'joint') else 'asphalt')
    return m.finish()


# ------------------------------------------------------------------ hangars

def hangar(h):
    x0, d, w = HG['x'], HG['depth'], HG['width']
    zc = h['z']
    eave, rise = HG['eave'], HG['rise']
    dw, dh = HG['door']
    m = Mesh('hangar.' + h['name'].lower())
    T = 0.25            # wall thickness, on its line
    P = 0.4             # post section
    over = 0.3          # roof overhang
    RT = 0.15           # roof thickness
    half = w / 2 + over
    r = (half * half + rise * rise) / (2 * rise)

    def under(z):
        """The roof's underside over a game z."""
        u = z - zc
        return eave + math.sqrt(max(r * r - u * u, 0)) - (r - rise)

    into = lambda z: under(z) + RT / 2          # halfway up the roof: where a wall or post ends
    zl = w / 2 - T / 2                          # the side wall lines, off zc
    xf, xb = x0 + T / 2, x0 + d - T / 2         # the front and back wall lines
    # Side walls between the corner posts, running up into the roof.
    # Each buried foot is at its own depth, and the posts end 3 cm higher in the roof than the walls, so
    # no two of their faces lie on each other.
    for s in (-1, 1):
        m.column(xf + P / 2 - 0.1, xb - P / 2 + 0.1, zc + s * (zl - T / 2), zc + s * (zl + T / 2), BASE - 0.1, into, 'siding')
    # Corner posts, proud of the walls on every side, and up into the roof.
    for xp in (xf, xb):
        for s in (-1, 1):
            m.column(xp - P / 2, xp + P / 2, zc + s * zl - P / 2, zc + s * zl + P / 2, BASE - 0.05, lambda z: into(z) + 0.03, 'steel')
    # The back wall with its gable, one solid; the front the same round the door.
    N = 24
    arch = [(zc + zl - 2 * zl * i / N, None) for i in range(N + 1)]
    top = [(z, into(z)) for z, _ in arch]
    m.sweep([(zc - zl, BASE), (zc + zl, BASE)] + top, xb - T / 2, xb + T / 2, 'siding')
    door = [(zc - zl, BASE), (zc - dw / 2, BASE), (zc - dw / 2, dh), (zc + dw / 2, dh), (zc + dw / 2, BASE), (zc + zl, BASE)]
    m.sweep(door + top, xf - T / 2, xf + T / 2, 'siding')
    # Door jambs, and the header across them standing 3 cm proud of their faces.
    for s in (-1, 1):
        m.box(xf - P / 2, xf + P / 2, BASE - 0.05, dh + 0.1, zc + s * dw / 2 - P / 2, zc + s * dw / 2 + P / 2, 'steel')
    m.box(xf - P / 2 - 0.03, xf + P / 2 + 0.03, dh - 0.1, dh + 0.4, zc - dw / 2 - P / 2 + 0.01, zc + dw / 2 + P / 2 - 0.01, 'steel')
    # The roof: an arch across the width, swept front to back past the walls.
    zs = [zc - half + 2 * half * i / N for i in range(N + 1)]
    prof = [(z, under(z)) for z in zs] + [(z, under(z) + RT) for z in zs[::-1]]
    rx0, rx1 = x0 - over - 0.1, x0 + d + over
    m.sweep(prof, rx0, rx1, 'roof', cap='steel')
    # Sliding doors parked open, two leaves a side on two tracks in front of the wall, the outrigger
    # track over them on a post at each end.
    leaf = dw / 4 + 0.2
    for s in (-1, 1):
        for k in range(2):
            xl = xf - T / 2 - 0.25 - k * 0.3
            z0 = zc + s * (dw / 2 - 0.4 + k * 0.5)
            m.box(xl - 0.1, xl, 0.15, dh + 0.25, z0, z0 + s * leaf, 'doors')
    reach = dw / 2 + leaf + 0.6
    xt = xf - T / 2 - 0.55
    m.box(xt - 0.5, xt + 0.25, dh + 0.3, dh + 0.6, zc - reach, zc + reach, 'steel')
    for s in (-1, 1):
        m.box(xt - 0.35, xt + 0.05, BASE, dh + 0.35, zc + s * reach - 0.2, zc + s * reach + 0.2, 'steel')
    solid(m.name, rx0, rx1, BASE, eave + rise + RT, zc - reach - 0.2, zc + reach + 0.2)
    # The name over the door, standing off the gable.
    letters(m, h['name'], xf - T / 2 - 0.01, (dh + 0.4 + under(zc)) / 2, zc, 1.8)

    yc, zc_b = -zc, eave - (r - rise)           # the arch's centre, Blender Y and Z

    def uv(key, f, p):
        if key != 'roof' or abs(f.normal.x) > 0.5:
            return None
        # The ribs run over the arch, eave to eave: across them is game x, along them the arch's length,
        # its angle about the centre times its radius.
        return (p.x / MAT['roof'][1], math.atan2(p.y - yc, p.z - zc_b) * r / MAT['roof'][1])
    return m.finish(uv=uv)


def letters(m, text, x, y, zc, height):
    """`text` in block capitals `height` tall, its middle at game (x, y, zc), reading from the west, its
    face at x and 2 cm deep behind it."""
    cu = bpy.data.curves.new('text', 'FONT')
    cu.body = text
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.size = height / 0.72          # Bfont's capitals stand 0.72 of its size
    cu.extrude = 0.01
    o = bpy.data.objects.new('text', cu)
    bpy.context.scene.collection.objects.link(o)
    dg = bpy.context.evaluated_depsgraph_get()
    tmp = bmesh.new()
    tmp.from_mesh(o.evaluated_get(dg).to_mesh())
    o.evaluated_get(dg).to_mesh_clear()
    bpy.data.objects.remove(o)
    bpy.data.curves.remove(cu)
    # Text +X reads left to right for one facing east: Blender −Y. Text +Y is up, Blender +Z. Text +Z
    # faces the reader, west, Blender −X.
    turn = Matrix(((0, 0, -1), (-1, 0, 0), (0, 1, 0)))
    at = B(x, y, zc)
    vmap = {v.index: m.bm.verts.new(turn @ (v.co - Vector((0, 0, 0.01))) + at) for v in tmp.verts}
    for f in tmp.faces:
        m.face([vmap[v.index] for v in f.verts], 'letters')
    tmp.free()


# ------------------------------------------------------------------ tower

def octagon(cx, cz, rad):
    """A game octagon as a Blender outline, counter-clockwise from above."""
    pts = [(cx + rad * math.cos(math.pi / 8 + i * math.pi / 4), cz + rad * math.sin(math.pi / 8 + i * math.pi / 4)) for i in range(8)]
    return [(x, -z) for x, z in pts][::-1]


def tower():
    tx, tz = TWR['x'], TWR['z']
    m = Mesh('tower')
    # The base building, 14 by 10 by 4 m, its parapet a coping 5 cm proud all round.
    bx0, bx1, bz0, bz1 = tx - 7, tx + 7, tz - 5, tz + 5
    c = 0.05
    m.box(bx0, bx1, BASE, 4.0, bz0, bz1, 'concrete')
    m.ring(rect_xz(bx0 - c, bx1 + c, bz0 - c, bz1 + c), rect_xz(bx0 + 0.3, bx1 - 0.3, bz0 + 0.3, bz1 - 0.3), 3.9, 4.45, 'concrete')
    # Its windows and door on the south face, set 2 cm into the wall and standing 3 cm out of it.
    for k in range(3):
        wx = bx0 + 1.5 + k * 3.0
        m.box(wx, wx + 2.0, 1.2, 2.8, bz1 - 0.02, bz1 + 0.03, 'glass')
    m.box(bx1 - 2.6, bx1 - 1.2, 0.0, 2.3, bz1 - 0.02, bz1 + 0.03, 'steel')
    # The shaft, from inside the base to inside the cab floor, a slit of windows up its south face.
    s = 2.25
    m.box(tx - s, tx + s, 3.8, 20.2, tz - s, tz + s, 'concrete')
    for k in range(5):
        y = 6 + k * 3
        m.box(tx - 0.6, tx + 0.6, y, y + 1.2, tz + s - 0.02, tz + s + 0.03, 'glass')
    # The cab floor and catwalk, 9 m square, its railing: posts, and a top and a mid rail as rings.
    f = 4.5
    m.box(tx - f, tx + f, 20.0, 20.4, tz - f, tz + f, 'concrete')
    e = f - 0.1
    posts = set()
    for i in range(7):
        u = round(-e + 2 * e * i / 6, 4)
        posts |= {(u, -e), (u, e), (-e, u), (e, u)}
    for px, pz in sorted(posts):
        m.box(tx + px - 0.03, tx + px + 0.03, 20.35, 21.45, tz + pz - 0.03, tz + pz + 0.03, 'steel')
    for y0, y1 in ((21.4, 21.5), (20.85, 20.9)):
        m.ring(rect_xz(tx - e - 0.04, tx + e + 0.04, tz - e - 0.04, tz + e + 0.04), rect_xz(tx - e + 0.04, tx + e - 0.04, tz - e + 0.04, tz + e - 0.04), y0, y1, 'steel')
    # The cab: an octagonal sill, glass sloping out to the roof, a mullion at each corner.
    m.prism(octagon(tx, tz, 3.6), 20.3, 21.3, 'concrete')
    lo, hi = octagon(tx, tz, 3.55), octagon(tx, tz, 3.95)
    for i in range(8):
        j = (i + 1) % 8
        m.face([m.bm.verts.new((lo[i][0], lo[i][1], 21.25)), m.bm.verts.new((lo[j][0], lo[j][1], 21.25)),
                m.bm.verts.new((hi[j][0], hi[j][1], 23.65)), m.bm.verts.new((hi[i][0], hi[i][1], 23.65))], 'glass')
    k = 0.08
    for i in range(8):
        a, b = lo[i], hi[i]
        sq = lambda p, z: [Vector((p[0] - k, p[1] - k, z)), Vector((p[0] + k, p[1] - k, z)), Vector((p[0] + k, p[1] + k, z)), Vector((p[0] - k, p[1] + k, z))]
        m.loft(sq(a, 21.2), sq(b, 23.7), 'steel')
    m.prism(octagon(tx, tz, 4.6), 23.6, 23.95, 'concrete')
    # A console inside under the glass, and the mast with its beacon.
    m.box(tx - 2.2, tx + 2.2, 21.25, 22.2, tz + 1.6, tz + 2.4, 'console')
    m.box(tx - 0.08, tx + 0.08, 23.9, 30.1, tz - 0.08, tz + 0.08, 'red')
    m.box(tx - 0.2, tx + 0.2, 30.0, 30.4, tz - 0.2, tz + 0.2, 'lens.white')
    solid('tower', bx0 - c, bx1 + c, BASE, 30.4, bz0 - c, bz1 + c)
    return m.finish()


# ------------------------------------------------------------------ windsock and lights

def cylinder(m, x, z, r, y0, y1, key, n=12):
    pts = [(x + r * math.cos(2 * math.pi * i / n), -(z + r * math.sin(2 * math.pi * i / n))) for i in range(n)][::-1]
    m.prism(pts, y0, y1, key)


def windsock():
    ws = A['windsock']
    x, z = ws['x'], ws['z']
    m = Mesh('windsock')
    cylinder(m, x, z, 0.06, BASE, 6.6, 'steel')
    # The sock blows south off a wind from the north, 3.6 m long from 0.45 m to 0.15 m across, drooping
    # 12°, in five bands, its mouth 0.55 m off the pole on an arm to the top of its ring.
    droop = math.radians(12)
    axis = Vector((0, -math.cos(droop), -math.sin(droop)))
    up = Vector((0, -math.sin(droop), math.cos(droop)))
    side = Vector((1, 0, 0))
    mouth = B(x, 6.0, z + 0.55)
    n = 16
    rings = []
    for k in range(6):
        t = k / 5
        rad = 0.45 + (0.15 - 0.45) * t
        c = mouth + axis * (3.6 * t)
        rings.append([m.bm.verts.new(c + side * (rad * math.cos(2 * math.pi * i / n)) + up * (rad * math.sin(2 * math.pi * i / n))) for i in range(n)])
    for k in range(5):
        for i in range(n):
            j = (i + 1) % n
            m.face([rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j]], 'sock.orange' if k % 2 == 0 else 'sock.white')
    m.box(x - 0.03, x + 0.03, 6.42, 6.48, z - 0.05, z + 0.7, 'steel')
    solid('windsock', x - 0.5, x + 0.5, BASE, 6.6, z - 0.1, z + 4.3)
    return m.finish()


def lights():
    m = Mesh('lights')
    k = 0

    def light(x, z, lens):
        nonlocal k
        cylinder(m, x, z, 0.08, -0.2, 0.3, 'steel', n=8)
        cylinder(m, x, z, 0.1, 0.29, 0.42, lens, n=8)
        solid(f'light.{k}', x - 0.1, x + 0.1, -0.2, 0.42, z - 0.1, z + 0.1)
        k += 1
    z = -L / 2 + 30
    while z <= L / 2 - 29.99:
        light(-(W / 2 + 1.5), z, 'lens.white')
        # East of the runway a link may join; no light stands in it.
        if all(abs(z - zl) > TWW / 2 + 1 for zl in TW['links']):
            light(W / 2 + 1.5, z, 'lens.white')
        z += 60
    for sign in (-1, 1):
        for i in range(8):
            light(-W / 2 + 1.875 + i * 3.75, sign * (L / 2 + 1.5), 'lens.green')
    return m.finish()


# ------------------------------------------------------------------ build

objects = [pavement()] + [hangar(h) for h in A['hangars']] + [tower(), windsock(), lights()]


# ------------------------------------------------------------------ asserts

def coplanar():
    """Pairs of triangles of any orientation lying in one plane (within 4 mm) that overlap by more than
    5 mm, read off the built meshes: triangles bucketed by plane, candidates by their bounds in it, each
    candidate pair's overlap the least depth over the separating axes of their six edges."""
    tris = []
    for o in objects:
        me = o.data
        me.calc_loop_triangles()
        co = np.array([v.co[:] for v in me.vertices])
        for t in me.loop_triangles:
            p = co[list(t.vertices)]
            n = np.cross(p[1] - p[0], p[2] - p[0])
            ln = np.linalg.norm(n)
            if ln < 1e-9:
                continue
            n = n / ln
            if (n[0], n[1], n[2]) < (0, 0, 0):
                n = -n
            tris.append((o.name, n, p))
    # A small triangle far from the origin has a normal good to a part in a thousand, so its offset from
    # the origin is good to no better than a metre: planes are bucketed by offset in 2 m bins and each
    # candidate pair's distance measured in the triangle's own neighbourhood.
    buckets = {}
    for k, (_, n, p) in enumerate(tris):
        d = float(n @ p[0])
        buckets.setdefault((round(n[0], 2), round(n[1], 2), round(n[2], 2), math.floor(d / 2.0)), []).append(k)
    pairs = 0
    for key, ks in sorted(buckets.items()):
        group = list(ks) + buckets.get((key[0], key[1], key[2], key[3] + 1), [])
        if len(group) < 2:
            continue
        n = tris[ks[0]][1]
        u = np.cross(n, [0, 0, 1] if abs(n[2]) < 0.9 else [1, 0, 0])
        u /= np.linalg.norm(u)
        v = np.cross(n, u)
        flat2 = np.array([np.stack([tris[i][2] @ u, tris[i][2] @ v], axis=1) for i in group])   # (g, 3, 2)
        lo, hi = flat2.min(axis=1), flat2.max(axis=1)
        own = len(ks)
        for a in range(own):
            cand = np.nonzero((lo[a + 1:, 0] < hi[a, 0] - 0.005) & (hi[a + 1:, 0] > lo[a, 0] + 0.005) &
                              (lo[a + 1:, 1] < hi[a, 1] - 0.005) & (hi[a + 1:, 1] > lo[a, 1] + 0.005))[0] + a + 1
            for b in cand:
                ta, tb = tris[group[a]], tris[group[b]]
                if max(abs(ta[1] @ (tb[2] - ta[2][0]).T).max(), abs(tb[1] @ (ta[2] - tb[2][0]).T).max()) > 0.004:
                    continue
                if depth(flat2[a], flat2[b]) > 0.005:
                    pairs += 1
                    where = (tris[group[a]][0], tris[group[b]][0], tuple(np.round(n, 2)), round(float(n @ tris[group[a]][2][0]), 3))
                    planes[where] = planes.get(where, 0) + 1
    for where, k in sorted(planes.items()):
        print('  coplanar', where, k)
    return pairs


planes = {}


def depth(ta, tb):
    best = math.inf
    for t in (ta, tb):
        for i in range(3):
            e = t[(i + 1) % 3] - t[i]
            ax = np.array([-e[1], e[0]])
            ln = np.linalg.norm(ax)
            if ln < 1e-12:
                continue
            ax /= ln
            pa, pb = ta @ ax, tb @ ax
            best = min(best, min(pa.max(), pb.max()) - max(pa.min(), pb.min()))
            if best <= 0.005:
                return best
    return best


def clear():
    n = 0
    for i in range(len(SOLIDS)):
        for j in range(i + 1, len(SOLIDS)):
            a, b = SOLIDS[i][1], SOLIDS[j][1]
            if all(min(a[k + 1], b[k + 1]) - max(a[k], b[k]) > 0 for k in (0, 2, 4)):
                print('  overlap', SOLIDS[i][0], SOLIDS[j][0])
                n += 1
    return n


overlaps = clear()
print(f'CLEAR n={len(SOLIDS)} overlaps={overlaps}')
assert overlaps == 0

stand = max(min(v.co.z for v in o.data.vertices) for o in objects if o.name != 'pavement')
print(f'STAND objects={len(objects) - 1} max_base={stand:.3f}')
assert stand <= 0.0

pairs = coplanar()
print(f'COPLANAR faces={sum(len(o.data.polygons) for o in objects)} pairs={pairs}')
assert pairs == 0

for key in ORDERED:
    m, size = MAT[key]
    imgs = [n.image for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']
    if imgs:
        assert all(max(i.size) <= 1024 for i in imgs), key
        print(f'TEX {key} set={os.path.basename(imgs[0].filepath)} size={size}')

count = sum(len(o.data.loop_triangles) for o in objects)
print(f'TRIS {count}')
assert count <= TRIS


# ------------------------------------------------------------------ export

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False, use_selection=False)
print('WROTE', OUT, os.path.getsize(OUT))


# ------------------------------------------------------------------ previews

def preview(folder):
    os.makedirs(folder, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    sc.world = world
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.61, 0.77, 0.91, 1)
    bg.inputs['Strength'].default_value = 0.9
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.5
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (math.radians(50), 0, math.radians(35))
    sc.collection.objects.link(so)
    # The ground round the field, and a 1.8 m figure at each spot looked at.
    g = bpy.data.meshes.new('ground')
    gb = bmesh.new()
    s = 1200
    gb.faces.new([gb.verts.new(p) for p in ((-s + 100, -s, 0), (s + 100, -s, 0), (s + 100, s, 0), (-s + 100, s, 0))])
    gb.to_mesh(g)
    gb.free()
    g.materials.append(flat('grass', (0.2, 0.3, 0.1), 0.9))
    go = bpy.data.objects.new('ground', g)
    sc.collection.objects.link(go)
    cam = bpy.data.cameras.new('cam')
    cam.lens = 28
    cam.clip_end = 5000
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co

    def figure(x, z):
        fm = bpy.data.meshes.new('figure')
        fb = bmesh.new()
        bmesh.ops.create_cube(fb, size=1)
        for v in fb.verts:
            v.co = Vector((v.co.x * 0.5, v.co.y * 0.3, (v.co.z + 0.5) * 1.8))
        fb.to_mesh(fm)
        fb.free()
        fm.materials.append(flat('figure', (0.8, 0.1, 0.6), 0.5))
        fo = bpy.data.objects.new('figure', fm)
        fo.location = B(x, TOP, z)
        sc.collection.objects.link(fo)

    def shot(name, eye, at):
        co.location = B(*eye)
        co.rotation_euler = (B(*at) - B(*eye)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(folder, name + '.png')
        bpy.ops.render.render(write_still=True)

    hz = A['hangars'][1]['z']
    figure(HG['x'] - 6, hz)
    figure(0, L / 2 - 20)
    figure(TWR['x'] + 8, TWR['z'] + 8)
    shot('overhead', (-250, 260, 420), (120, 0, 0))
    shot('hangars', (150, 1.6, hz + 40), (HG['x'], 5, hz))
    shot('hangar_door', (HG['x'] - 30, 1.6, hz), (HG['x'] + 10, 4, hz))
    shot('tower', (TWR['x'] - 30, 6, TWR['z'] + 35), (TWR['x'], 15, TWR['z']))
    shot('threshold_36', (0, 1.6, L / 2 + 15), (0, 0, L / 2 - 120))
    shot('numbers_36', (0, 40, L / 2 + 60), (0, 0, L / 2 - 80))
    cam.lens = 50
    shot('approach_36', (0, 25, L / 2 + 450), (0, 0, L / 2 - 200))
    cam.lens = 28
    shot('windsock', (A['windsock']['x'] - 12, 3, A['windsock']['z'] + 8), (A['windsock']['x'], 5, A['windsock']['z'] + 1.5))


if PREVIEW:
    preview(PREVIEW)
