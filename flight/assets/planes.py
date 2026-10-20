# The three planes of the sky, each built in Blender and exported as its own glb: camel.glb (Sopwith
# F.1 Camel), cessna.glb (Cessna 172) and trainer.glb (a Hawk-class jet trainer), and a picture of each
# for the pick screen, <plane>.png. This script is their source, and the game's bake runs it (`yarn bake
# flight`, `flight.bake.ts`), which packs each glb it writes and puts it and its picture beside this file:
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python games/flight/assets/planes.py -- <out dir> [pictures|none] [camel cessna trainer]
#
# Naming planes after the pictures argument builds only those. `dev.html` beside the game is a tour of
# the built models in the game's own light: load it again after a build to see the new ones.
#
# What flight3d flies and what is drawn are one set of numbers: each plane's span and its wheels (where
# each axle is, its radius, which steer) are read from its entry in `world.flight3d.planes` of
# `sky.scene.json`, and the build asserts the exported model agrees with them. The rest of each shape is
# the real aircraft's, in metres, written below.
#
# Every model is in flight3d's body frame: the origin on the centre of gravity, +x the right wing, +y up,
# −z the nose (Blender's +X, +Z and +Y; the glTF exporter's Y-up conversion hands three the body frame
# back). A plane is a root node named for it, holding `body`, everything that does not move, and a node
# for each moving part, named as flight3d finds it, its origin on the part's hinge and its local axes
# turned so the hinge is the axis flight3d turns it about:
#   aileron_left, aileron_right    local X along the hinge, pointing right; the Camel's lower-wing pair are
#                                  aileron_left_lower and aileron_right_lower.
#   elevator                       local X along the hinge; the trainer's whole tailplane, on its pivot.
#   rudder                         local Y up the hinge.
#   airbrake…                      local X along the hinge: the Cessna's flaps, airbrake_left and
#                                  airbrake_right; the trainer's ventral airbrake.
#   prop                           on the propeller's axis, local Z along it; the Camel's spinning rotary
#                                  engine is in it.
#   steer_<n>, wheel_<n>           for gear wheel n: steer_<n> (a steered wheel only) on the axle, local Y
#                                  up, holding wheel_<n> on the same point, local X along the axle.
#   gear_<n>                       the trainer's retracting leg n, on its hinge at the leg's top, local Y
#                                  up and local X the hinge, turned so a positive turn folds it away;
#                                  steer_<n> or wheel_<n> rides on it.
# Moving surfaces stand a hinge gap off what they hinge from, so no face lies on another.
#
# The cockpit. Each plane is open where its pilot sits (the Camel's decking under its coaming, the
# trainer's top under its canopy along a cut that follows the canopy's taper; the Cessna's cabin through
# its windows) and furnished inside, after the real aircraft's: the skin lined from within, every window
# and opening left open with a reveal round its edge, the seats, the panel and its instruments, the
# controls. Its nodes:
#   cockpit                        everything of it that never moves, in the body frame.
#   eye                            the pilot's eye, a node with nothing in it, its axes the body's: where a
#                                  camera stands in the cockpit. The trainer's is the front seat's.
#   stick, pedals, throttle        the controls, each on its pivot (the stick's in the floor, the pedals'
#                                  bar's middle, the throttle's quadrant); the trainer's rear seat's end
#                                  `_rear`. The Cessna's are yoke_left and yoke_right, each on its shaft
#                                  where it leaves the panel, local Z out along it.
#   lever_<what>                   a lever on its pivot: the Cessna's lever_flaps, the trainer's lever_gear.
#   needle_<what>                  a needle on its dial's centre, local Z out of the face, so a turn about
#                                  Z sweeps it; at rest it points at the dial's lowest mark, or at 0 on
#                                  a dial that reads both ways, or at 1 on the trainer's g-meter.
#   card_<what>                    a card turning on its dial's centre the same way: a compass card, a
#                                  heading card, an attitude horizon (rolled about Z; pitched by moving it
#                                  along local Y).
# None of these is turned yet: flight3d turns the nodes above, and these stand where the model left them.
# A dial is a disc face behind a bezel, its marks, numbers and bands a layer over the face and its
# needles and cards a layer over those, each layer 4.5 mm off the one under it. Glass is see-through
# from both sides; a display or a lamp glows in its own colour.
#
# Shape and shading. Every fuselage, canopy, hump, intake and the Camel's rudder is faired through the
# sections written for it (`Fair`, a monotone cubic: no kink at a section, no bulge between two) and
# lofted through as many stations as keep it within SAG, 2 mm, of that faired shape (`stations`); every
# round thing outside, a cowling, a spinner, a jet pipe, a tyre, a strut, a roundel, is cut into as many
# sides as keep it within SAG of its circle (`segs_for`); an aerofoil is 20 steps along its chord, closer
# at the nose. At the chase camera's 16 m, in the game's 60° view on a 1080-line screen, a pixel spans
# 1.7 cm, so 2 mm is an eighth of one; 2 m off, as the nose is from the seat, it is about one. Every face
# is shaded smooth and every edge where two faces meet at more than SMOOTH, 50°, is sharp, the normals
# exported as they fall: a fuselage, a wing's skin and its nose, a tyre shade as the curves they are cut
# from, and a cap, a box, a trailing edge, a hinge's face keep their corners. A line a colour changes
# along on a fuselage (an opening's edge, a sill, a stripe, a window's sill and top, the trainer's belly
# and anti-glare panel) is the same point of every ring (`superellipse`'s pins), so it runs straight
# along the skin instead of stepping from face to face.
#
# Surfaces are painted PBR in flat colours, the paint of each aircraft: the Camel's PC10 khaki over
# clear-doped linen with RFC roundels and the rudder's blue, white and red, the Cessna's white with a red
# and a blue stripe, the trainer's red over white. A roundel is a decal 1 cm off the surface it is
# painted on, following its curve and shaded with the normals of the surface under it.
# The build prints its asserts and throws when one fails; two builds are the same files byte for byte.
# Besides the parts, wheels and span: TRIS, the outside under TRIS and the cockpit's nodes under COCKPIT
# (the outsides measure 11862 triangles for the Camel, 10962 for the Cessna and 11348 for the trainer,
# from 4740, 3182 and 3656 when every face was flat and a ring had 20 to 24 points); EYE, the eye where it
# was laid out, a head's room clear of everything round it and nothing but glass for a metre along the
# nose; COPLANAR, no two faces of any node lying on each other.
import bpy
import bmesh
import copy
import json
import math
import numpy as np
import os
import sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = argv[0] if argv else HERE
PICTURES = (argv[1] if len(argv) > 1 else 'pictures') == 'pictures'
ONLY = argv[2:]     # the planes to build, every one when none is named
SCENE = json.load(open(os.path.join(os.path.dirname(HERE), 'sky.scene.json')))
PLANES = SCENE['world']['flight3d']['planes']
TRIS = 12500        # a plane is the one model a camera holds 16 m off all game long
COCKPIT = 16000     # and its cockpit is the one a camera holds a hand's width off
SAG = 0.002         # how far any outline outside may stand off the true curve it is cut from, in metres
SMOOTH = math.radians(50)   # faces meeting at no more than this share their normals: one smooth surface


def inside(node):
    """Whether a node is the cockpit's: the cockpit itself and every part of it that moves."""
    return node == 'eye' or node.startswith(('cockpit', 'stick', 'pedals', 'throttle', 'needle_', 'card_', 'yoke_', 'lever_'))


def reset():
    """An empty file: a fresh factory one headless, every datablock removed in a running Blender, whose
    add-ons a factory reset would switch off."""
    if bpy.app.background:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        return
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves,
                 bpy.data.cameras, bpy.data.lights, bpy.data.worlds, bpy.data.collections):
        for d in list(coll):
            coll.remove(d)


reset()


def P(v):
    """A body-frame point (x right, y up, z back) in Blender's frame."""
    return Vector((v[0], -v[2], v[1]))


def B(v):
    """A Blender vector back in the body frame."""
    return Vector((v[0], v[2], -v[1]))


# ------------------------------------------------------------------ materials

MATS = {}


def paint(plane, key, col, rough, metal=0.0, alpha=1.0, glow=0.0):
    """A material: `alpha` under 1 is glass, seen from both sides; `glow` lights it in its own colour,
    a display or a lamp."""
    m = bpy.data.materials.new(f'{plane} {key}')
    m.use_backface_culling = alpha == 1.0
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if glow:
        b.inputs['Emission Color'].default_value = (*col, 1.0)
        b.inputs['Emission Strength'].default_value = glow
    MATS[(plane, key)] = m


# ------------------------------------------------------------------ parts

def segs_for(r):
    """How many sides a round thing `r` across is cut into: as few as keep each side's middle within SAG
    of the circle, a multiple of four so it stands square on its axes, eight at the least."""
    if r <= SAG / 2:
        return 8
    return max(8, 4 * math.ceil(math.pi / math.acos(1 - SAG / r) / 4))


class Part:
    """One node of a plane: its mesh built in body coordinates, its origin and local axes in the body
    frame. Solid faces are wound outward once the part is finished; each takes its material from its
    rule, a key or a function of its centre and outward normal in the body frame. Decal faces are wound
    the way they are made.

    Every face is shaded smooth, and every edge where two faces meet at more than SMOOTH is sharp, so a
    surface cut from a curve shades as the curve and a box, a cap or a trailing edge keeps its corners.
    `soft` edges are smooth whatever their angle (an aerofoil's nose, turned in too few faces for the
    angle to say so); a vertex with a normal of its own in `normals` (a decal lying on a curved skin) is
    shaded with that one."""

    def __init__(self, plane, name, origin=(0, 0, 0), x=(1, 0, 0), y=(0, 1, 0), keep='x'):
        X, Y = Vector(x).normalized(), Vector(y).normalized()
        if keep == 'x':
            Y = (Y - X * Y.dot(X)).normalized()
        else:
            X = (X - Y * X.dot(Y)).normalized()
        self.axes = (X, Y, X.cross(Y))
        self.plane, self.name, self.origin = plane, name, Vector(origin)
        self.bm = bmesh.new()
        self.rules = []
        self.rule = self.bm.faces.layers.int.new('rule')
        self.solid = []
        self.soft = set()
        self.normals = {}
        self.parent = None

    def v(self, p, normal=None):
        """A vertex at body point p; `normal`, a body direction, shades it as a skin it lies on."""
        vert = self.bm.verts.new(P(p))
        if normal is not None:
            self.normals[vert] = Vector(normal).normalized()
        return vert

    def face(self, verts, rule):
        if rule not in self.rules:
            self.rules.append(rule)
        f = self.bm.faces.new(verts)
        f[self.rule] = self.rules.index(rule)
        self.solid.append(f)
        return f

    def loft(self, rings, rule, caps=(True, True), loop=False, keep=None, soft=()):
        """A solid through rings of body points, every ring the same count, capped at either end, or
        joined last to first with `loop`. With `keep`, a side face is made only where `keep(centre,
        outward normal)` says so: an opening cut in a skin. `soft` names ring points whose edges along
        the loft are smooth whatever their angle."""
        vs = [[self.v(p) for p in ring] for ring in rings]
        n = len(rings[0])
        last = len(vs) if loop else len(vs) - 1
        for i in range(last):
            a, b = vs[i], vs[(i + 1) % len(vs)]
            ra, rb = rings[i], rings[(i + 1) % len(rings)]
            axis = (sum(ra, Vector()) + sum(rb, Vector())) / (2 * n)
            for k in range(n):
                j = (k + 1) % n
                if keep:
                    q = [Vector(ra[k]), Vector(ra[j]), Vector(rb[j]), Vector(rb[k])]
                    c = sum(q, Vector()) / 4
                    nn = (q[1] - q[0]).cross(q[3] - q[0]).normalized()
                    if not keep(c, nn if nn.dot(c - axis) >= 0 else -nn):
                        continue
                self.face([a[k], a[j], b[j], b[k]], rule)
            for k in soft:
                e = self.bm.edges.get((a[k], b[k]))
                if e:
                    self.soft.add(e)
        if not loop:
            if caps[0]:
                self.face(vs[0][::-1], rule)
            if caps[1]:
                self.face(vs[-1], rule)

    def tube(self, a, b, rx, rz=None, rule='steel', n=None):
        """A strut from a to b, `rx` across and `rz` along the flight (an ellipse, faired), cut into `n`
        sides, by default as many as SAG asks of its wider radius."""
        a, b = Vector(a), Vector(b)
        d = (b - a).normalized()
        e1 = Vector((0, 0, 1)) - d * d.z
        if e1.length < 1e-6:
            e1 = Vector((1, 0, 0)) - d * d.x
        e1.normalize()
        e2 = d.cross(e1)
        rz = rz or rx
        n = n or segs_for(max(rx, rz))
        ring = [e1 * (rz * math.cos(2 * math.pi * k / n)) + e2 * (rx * math.sin(2 * math.pi * k / n)) for k in range(n)]
        self.loft([[a + r for r in ring], [b + r for r in ring]], rule)

    def lathe(self, centre, axis, profile, rule, segs=None, caps=(True, True), loop=False):
        """`profile`, (radius, distance along `axis`) points, turned about the axis through `centre` in
        `segs` steps, by default as many as SAG asks of its widest radius."""
        segs = segs or segs_for(max(r for r, _ in profile))
        c, ax = Vector(centre), Vector(axis).normalized()
        e1 = Vector((0, 1, 0)) if abs(ax.y) < 0.9 else Vector((1, 0, 0))
        e1 = (e1 - ax * e1.dot(ax)).normalized()
        e2 = ax.cross(e1)
        rings = [[c + ax * a + (e1 * math.cos(2 * math.pi * k / segs) + e2 * math.sin(2 * math.pi * k / segs)) * max(r, 1e-4)
                  for k in range(segs)] for r, a in profile]
        self.loft(rings, rule, caps=caps, loop=loop)

    def decal(self, points, normal, key):
        """A flat or curved patch, its corners given, turned to face `normal` (body). A corner may be a
        vertex already made, so patches laid edge to edge are one surface and shade as one."""
        vs = [p if isinstance(p, bmesh.types.BMVert) else self.v(p) for p in points]
        if key not in self.rules:
            self.rules.append(key)
        f = self.bm.faces.new(vs)
        f[self.rule] = self.rules.index(key)
        f.normal_update()
        if B(f.normal).dot(Vector(normal)) < 0:
            f.normal_flip()
        return f

    def finish(self, collection):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=self.solid)
        bm.normal_update()
        keys = []
        for f in bm.faces:
            rule = self.rules[f[self.rule]]
            key = rule if isinstance(rule, str) else rule(B(f.calc_center_median()), B(f.normal))
            if key not in keys:
                keys.append(key)
            f.material_index = keys.index(key)
            f.smooth = True
        for e in bm.edges:
            if len(e.link_faces) != 2:
                e.smooth = False
            else:
                e.smooth = e in self.soft or e.link_faces[0].normal.angle(e.link_faces[1].normal, math.pi) <= SMOOTH
        # The node's frame in Blender: its local X, Y, Z carry three's local X, Y, Z through the
        # exporter's Y-up turn, so Blender's columns are P(X), −P(Z), P(Y).
        X, Y, Z = self.axes
        R = Matrix((P(X), -P(Z), P(Y))).transposed()
        M = Matrix.Translation(P(self.origin)) @ R.to_4x4()
        bmesh.ops.transform(bm, matrix=M.inverted(), verts=bm.verts[:])
        bm.verts.index_update()
        own = {v.index: (R.inverted() @ P(n)).normalized() for v, n in self.normals.items()}
        me = bpy.data.meshes.new(f'{self.plane}.{self.name}')
        bm.to_mesh(me)
        bm.free()
        if own:
            # The normals the faces and sharp edges give, but a vertex with its own keeps that one.
            corner = [Vector(c.vector) for c in me.corner_normals]
            for i, loop in enumerate(me.loops):
                if loop.vertex_index in own:
                    corner[i] = own[loop.vertex_index]
            me.normals_split_custom_set(corner)
        for key in keys:
            me.materials.append(MATS[(self.plane, key)])
        o = bpy.data.objects.new(self.name, me)
        collection.objects.link(o)
        self.object, self.matrix = o, M
        return o


# ------------------------------------------------------------------ shapes

def superellipse(cx, cy, hw, hh, p, z, n=20, pins=()):
    """A fuselage section at z: |x/hw|^p + |y/hh|^p = 1 about (cx, cy), counter-clockwise from behind,
    starting at the bottom, the n points at angles t from −π/2 at the bottom through 0 on the right to
    π/2 at the top and round, x = hw·cos t^(2/p) and y = hh·sin t^(2/p). Spaced evenly in t, but for
    `pins`, (k, t) each: the k-th point on the right (0 < k < n/2) stands at t, the left mirroring it, and
    the points between two pins are spaced evenly between them; a pin's t None stands it evenly between
    the pins either side. A pin is the same point of every ring, so a line along the fuselage (an
    opening's edge, a stripe's, a window's sill) runs along it."""
    half = n // 2
    ks = [0] + [k for k, _ in pins] + [half]
    ts = [-math.pi / 2] + [t for _, t in pins] + [math.pi / 2]
    for i, t in enumerate(ts):
        if t is None:
            j = next(j for j in range(i + 1, len(ts)) if ts[j] is not None)
            ts[i] = ts[i - 1] + (ts[j] - ts[i - 1]) * (ks[i] - ks[i - 1]) / (ks[j] - ks[i - 1])
    assert all(a < b for a, b in zip(ks, ks[1:])) and all(a < b for a, b in zip(ts, ts[1:])), (ks, ts)
    right = []
    for k in range(half + 1):
        i = max(i for i in range(len(ks) - 1) if ks[i] <= k)
        right.append(ts[i] + (ts[i + 1] - ts[i]) * (k - ks[i]) / (ks[i + 1] - ks[i]))
    pts = []
    for t in right + [math.pi - right[n - k] for k in range(half + 1, n)]:
        c, s = math.cos(t), math.sin(t)
        x = hw * math.copysign(abs(c) ** (2 / p), c)
        y = hh * math.copysign(abs(s) ** (2 / p), s)
        pts.append(Vector((cx + x, cy + y, z)))
    return pts


def at_x(q, p):
    """The angle of a superellipse's point on its upper right where x is q of its half width."""
    return math.acos(q ** (p / 2))


def at_y(f, p):
    """The angle of a superellipse's point on its right where y is f of its half height off its middle."""
    return math.asin(math.copysign(abs(f) ** (p / 2), f))


class Fair:
    """Values given at knots along z, (z, a, b, …) each, and between the knots a monotone cubic through
    them (Fritsch–Carlson, as PCHIP): its slope runs on through every knot, so what is drawn through it
    has no kink there, and it never passes the values at either end of a span, so it has no bulge
    between. Two knots make a straight line."""

    def __init__(self, knots):
        self.z = [float(k[0]) for k in knots]
        h = [b - a for a, b in zip(self.z, self.z[1:])]
        self.y = [[float(k[d]) for k in knots] for d in range(1, len(knots[0]))]
        self.m = []
        for y in self.y:
            s = [(y[i + 1] - y[i]) / h[i] for i in range(len(h))]
            if len(s) == 1:
                self.m.append([s[0], s[0]])
                continue
            m = [0.0] * len(y)
            for i in range(1, len(y) - 1):
                if s[i - 1] * s[i] > 0:
                    w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
                    m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i])
            m[0] = self.end(h[0], h[1], s[0], s[1])
            m[-1] = self.end(h[-1], h[-2], s[-1], s[-2])
            self.m.append(m)

    @staticmethod
    def end(h0, h1, s0, s1):
        m = ((2 * h0 + h1) * s0 - h0 * s1) / (h0 + h1)
        if m * s0 <= 0:
            return 0.0
        if s0 * s1 < 0 and abs(m) > 3 * abs(s0):
            return 3 * s0
        return m

    def __call__(self, z):
        # A mesh's points are single floats: a face on an end knot may stand a micron past it.
        if not self.z[0] - 1e-4 <= z <= self.z[-1] + 1e-4:
            raise ValueError(z)
        z = min(max(z, self.z[0]), self.z[-1])
        i = 0
        while i < len(self.z) - 2 and z > self.z[i + 1]:
            i += 1
        h = self.z[i + 1] - self.z[i]
        t = (z - self.z[i]) / h
        h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        return [h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1] for y, m in zip(self.y, self.m)]


FAIRS = {}


def section_at(sections, z):
    """A fuselage's (cy, hw, hh, p) at z, faired between its sections."""
    key = tuple(map(tuple, sections))
    if key not in FAIRS:
        FAIRS[key] = Fair(sections)
    return FAIRS[key](z)


def stations(shape, marks):
    """The stations a loft is made through: `marks` (two within a micron are one), and between each two
    more, halving a span until the loft, straight from each station to the next, stands within SAG of
    `shape(z)`, the ring the shape draws at any z (the same count of points at every z), at a quarter, a
    half and three quarters of it; at most six halvings deep, where an outline turns square to the loft
    and no count of stations would bring it within SAG."""
    marks = sorted({round(m, 6) for m in marks})

    def sag(z0, z1):
        r0, r1 = shape(z0), shape(z1)
        return max((q - (q0 + (q1 - q0) * u)).length for u in (0.25, 0.5, 0.75)
                   for q, q0, q1 in zip(shape(z0 + (z1 - z0) * u), r0, r1))

    def split(a, b, depth):
        if depth == 6 or sag(a, b) <= SAG:
            return [b]
        m = (a + b) / 2
        return split(a, m, depth + 1) + split(m, b, depth + 1)
    out = [marks[0]]
    for a, b in zip(marks, marks[1:]):
        out += split(a, b, 0)
    return out


def body_stations(sections, must=()):
    """A fuselage's stations: its sections and `must`, and more between as `stations` asks."""
    return stations(lambda z: superellipse(0, *section_at(sections, z), z, n=16), [s[0] for s in sections] + list(must))


def side_x(sections, y, z):
    """How far out the fuselage's side is at height y and station z."""
    cy, hw, hh, p = section_at(sections, z)
    u = min(abs(y - cy) / hh, 1.0)
    return hw * (1 - u ** p) ** (1 / p)


def foil(t, m, p):
    """NACA 4-digit thickness `t` and camber `m` at `p`: (camber line, half thickness) at a chord point."""
    def at(x):
        yt = 5 * t * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        if m == 0:
            yc = 0.0
        elif x < p:
            yc = m / (p * p) * (2 * p * x - x * x)
        else:
            yc = m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x)
        return yc, yt
    return at


def section(c0, c1, f, n=20):
    """The loop of an aerofoil between chord points c0 and c1: over the top from c1 forward to c0, back
    under the bottom; from the leading edge, n steps along the chord spaced closer at the nose, its point
    the n-th of the loop; behind, n steps to the whole chord."""
    if c0 == 0:
        xs = [c1 * 0.5 * (1 - math.cos(math.pi * i / n)) for i in range(n + 1)]
    else:
        k = max(2, round(n * (c1 - c0)))
        xs = [c0 + (c1 - c0) * i / k for i in range(k + 1)]
    upper = [(x, f(x)[0] + f(x)[1]) for x in xs[::-1]]
    lower = [(x, f(x)[0] - f(x)[1]) for x in xs]
    if c0 == 0:
        lower = lower[1:]
    return upper + lower


class Surface:
    """A lifting surface: its leading edge, chord and thickness direction at any station `s` along it
    (|x| for a wing or tailplane, y for a fin), and how a point on it is placed."""

    def __init__(self, le, chord, cdir, tdir, f):
        self.le, self.chord, self.cdir, self.tdir, self.f = le, chord, cdir, tdir, f

    def point(self, s, xc, yc):
        return self.le(s) + self.cdir(s) * (xc * self.chord(s)) + self.tdir(s) * (yc * self.chord(s))

    def hinge(self, s, xc):
        """The point on the camber line at chord point xc."""
        return self.point(s, xc, self.f(xc)[0])

    def upper(self, s, xc, lift=0.0):
        yc, yt = self.f(xc)
        return self.point(s, xc, yc + yt) + self.tdir(s) * lift


def panel(part, surf, stations, c0, c1, rule, n=20):
    """A piece of a surface between chord points c0 and c1 along `stations`; one from the leading edge
    is smooth round its nose."""
    part.loft([[surf.point(s, xc, yc) for xc, yc in section(c0, c1, surf.f, n)] for s in stations], rule,
              soft=[n] if c0 == 0 else ())


GAP = 0.012         # the hinge gap, as a part of the chord and in metres along the span


def lifting(plane, body, surf, stations, controls, cut, rule, parts, mirror=None, axis='x'):
    """A surface along `stations` (increasing): the main panel ahead of `cut` in one piece, and behind it
    each control, `(s0, s1, name)`, a node of its own hinged at `cut`, the rest a fixed strip; every piece
    behind the cut stands the hinge gap off the main panel and off its neighbours. `mirror` maps a
    station to the body x sign for a hinge's direction. Hands back the control parts made."""
    panel(body, surf, stations, 0, cut, rule)
    lo, hi = stations[0], stations[-1]
    marks = sorted({lo, hi} | {c[0] for c in controls} | {c[1] for c in controls})
    pieces = []
    for a, b in zip(marks, marks[1:]):
        name = next((c[2] for c in controls if c[0] <= a and b <= c[1]), None)
        if pieces and pieces[-1][2] == name:
            pieces[-1] = (pieces[-1][0], b, name)
        else:
            pieces.append((a, b, name))
    made = []
    for i, (a, b, name) in enumerate(pieces):
        if name == 'none':
            continue
        a2 = a + (GAP / 2 if i > 0 else 0)
        b2 = b - (GAP / 2 if i < len(pieces) - 1 else 0)
        st = [a2] + [s for s in stations if a2 < s < b2] + [b2]
        if name is None:
            panel(body, surf, st, cut + GAP, 1, rule)
            continue
        h0, h1 = surf.hinge(a2, cut + GAP), surf.hinge(b2, cut + GAP)
        d = h1 - h0
        if axis == 'x' and d.x < 0:
            d = -d
        if axis == 'x':
            part = Part(plane, name, h0, x=d, y=surf.tdir(a2))
        else:
            part = Part(plane, name, h0, x=Vector((1, 0, 0)), y=d if d.y > 0 else -d, keep='y')
        panel(part, surf, st, cut + GAP, 1, rule)
        parts.append(part)
        made.append(part)
    return made


def roundel(part, centre_of, normal, radii, keys):
    """Concentric rings, outermost first, each a decal laid by `centre_of(u, v)`, the surface point at
    offsets u, v in the decal's own plane (already lifted off the surface), round in as many steps as SAG
    asks of the outermost. Each ring is one surface, every vertex of it shaded with the normal of the
    surface it lies on, so it shades as the skin under it does."""
    segs = segs_for(radii[0])
    toward = Vector(normal)

    def vert(u, v):
        e = 0.002
        n = (centre_of(u + e, v) - centre_of(u - e, v)).cross(centre_of(u, v + e) - centre_of(u, v - e)).normalized()
        return part.v(centre_of(u, v), n if n.dot(toward) > 0 else -n)

    rs = list(radii) + [0.0]
    ts = [2 * math.pi * k / segs for k in range(segs)]
    for (r0, r1), key in zip(zip(rs, rs[1:]), keys):
        outer = [vert(r0 * math.cos(t), r0 * math.sin(t)) for t in ts]
        inner = [vert(r1 * math.cos(t), r1 * math.sin(t)) for t in ts] if r1 > 0 else None
        middle = vert(0, 0) if r1 == 0 else None
        for k in range(segs):
            j = (k + 1) % segs
            part.decal([outer[k], outer[j]] + ([inner[j], inner[k]] if inner else [middle]), normal, key)


def blade(part, centre, radial, spin, axial, r0, r1, chord, thick, pitch, rule, n=8):
    """A propeller blade from r0 to r1 along `radial`, its chord turned `pitch(r)` off the plane of
    rotation (`spin`, the way it turns, and `axial`, back along the shaft): an aerofoil, round at its
    leading edge (+½ chord, along `spin`) and sharp at its trailing edge, its face a little flatter than
    its back."""
    f = foil(1.0, 0, 0.4)
    peak = max(f(x / 100)[1] for x in range(101))
    xs = [0.0, 0.02, 0.07, 0.15, 0.27, 0.42, 0.6, 0.8]
    lens = [(-0.5, 0.0)] + [(0.5 - x, f(x)[1] / peak) for x in xs[:0:-1]] + [(0.5, 0.0)] + [(0.5 - x, -0.6 * f(x)[1] / peak) for x in xs[1:]]
    rings = []
    for i in range(n + 1):
        r = r0 + (r1 - r0) * i / n
        c, t, b = chord(r), thick(r), pitch(r)
        along = spin * math.cos(b) - axial * math.sin(b)
        across = spin * math.sin(b) + axial * math.cos(b)
        mid = Vector(centre) + radial * r
        rings.append([mid + along * (u * c) + across * (w * t / 2) for u, w in lens])
    part.loft(rings, rule, soft=[len(xs)])


def wheel(plane, idx, w, width, hub_key, parts, tyre='rubber'):
    """Gear wheel `idx`: its tyre and hub on the axle at the wheel's `at`, under its steer node when it
    steers."""
    at = Vector(w['at'])
    r = w['radius']
    part = Part(plane, f'wheel_{idx}', at)
    tr = width / 2
    # The tyre: a round section `width` across, its outside at the radius, round in as many steps as SAG
    # asks of it; the hub inside it.
    segs = segs_for(r)
    m = segs_for(tr)
    prof = [(r - tr + tr * math.cos(2 * math.pi * k / m), tr * math.sin(2 * math.pi * k / m)) for k in range(m)]
    part.lathe(at, (1, 0, 0), prof, tyre, segs=segs, loop=True)
    part.lathe(at, (1, 0, 0), [(0, -width * 0.42), (r - tr * 1.6, -width * 0.42), (r - tr * 1.6, width * 0.42), (0, width * 0.42)], hub_key, segs=segs, caps=(False, False))
    parts.append(part)
    if w['steer']:
        part.parent = f'steer_{idx}'
    return part


# ------------------------------------------------------------------ cockpits

def box(part, c, half, rule, axes=((1, 0, 0), (0, 1, 0), (0, 0, 1))):
    """A box about `c`, `half` its half sizes along `axes`, three unit body vectors."""
    u, v, w = (Vector(a).normalized() for a in axes)
    c = Vector(c)
    ring = lambda s: [c + w * (s * half[2]) + u * (a * half[0]) + v * (b * half[1]) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    part.loft([ring(-1), ring(1)], rule)


def along(a, b, half, rule, part, up=(0, 1, 0)):
    """A bar from a to b, `half` [across, up] its half section, its across axis level."""
    a, b = Vector(a), Vector(b)
    w = (b - a).normalized()
    u = Vector(up).cross(w)
    if u.length < 1e-6:
        u = Vector((1, 0, 0))
    u.normalize()
    v = w.cross(u)
    box(part, (a + b) / 2, (half[0], half[1], (b - a).length / 2), rule, (u, v, w))


def rail(part, points, half, rule, up=(0, 1, 0)):
    """A bar along the polyline `points`, `half` [across, up] its half section, its across axis level: one
    solid round every bend, square to the path's mean direction at each point."""
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        w = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = Vector(up).cross(w).normalized()
        v = w.cross(u)
        rings.append([p + u * (a * half[0]) + v * (b * half[1]) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    part.loft(rings, rule)


def face_frame(n, up=(0, 1, 0)):
    """The right, up and out of a face looking along `n`: right × up is n, so it reads the right way
    round from in front."""
    n = Vector(n).normalized()
    up = Vector(up)
    up = (up - n * up.dot(n)).normalized()
    return up.cross(n), up, n


def clip(points, lo, hi):
    """A convex loop (x, y, …) cut to lo ≤ y ≤ hi (Sutherland–Hodgman)."""
    def cut(pts, keep, at):
        out = []
        for i, p in enumerate(pts):
            q = pts[(i + 1) % len(pts)]
            if keep(p):
                out.append(p)
            if keep(p) != keep(q):
                t = (at - p.y) / (q.y - p.y)
                out.append(p + (q - p) * t)
        return out
    return cut(cut(points, lambda p: p.y >= lo, lo), lambda p: p.y <= hi, hi)


def slab(part, ring, z0, z1, rule):
    """A plate through the convex loop `ring` (points at any z, taken for their x and y), from z0 to z1."""
    part.loft([[Vector((p.x, p.y, z)) for p in ring] for z in (z0, z1)], rule)


def lining(part, outer, inner, opening, rule):
    """The inside of a skin seen from within: `outer` and `inner` the same rings, the skin's and an inset
    of it. Every face of the skin that `opening(centre, outward normal)` calls open is left open; every
    other one is lined on `inner`, facing in, and an open face's edge onto a lined one gets a reveal from
    the skin to the lining, facing into the opening, so nothing of the outside shows round its edge.
    `rule` names a lined face's paint from its centre and its inward normal."""
    n = len(outer[0])
    centre = [sum(r, Vector()) / n for r in outer]
    def info(i, k):
        j = (k + 1) % n
        q = [outer[i][k], outer[i][j], outer[i + 1][j], outer[i + 1][k]]
        c = sum(q, Vector()) / 4
        nn = (q[1] - q[0]).cross(q[3] - q[0]).normalized()
        axis = (centre[i] + centre[i + 1]) / 2
        if nn.dot(c - axis) < 0:
            nn = -nn
        return c, nn
    faces = {(i, k): info(i, k) for i in range(len(outer) - 1) for k in range(n)}
    is_open = {key: opening(*v) for key, v in faces.items()}
    # The lined faces share their corners, so the lining is one surface and shades as the skin does.
    verts = {}

    def corner(i, k):
        if (i, k) not in verts:
            verts[(i, k)] = part.v(inner[i][k])
        return verts[(i, k)]

    for (i, k), (c, nn) in faces.items():
        j = (k + 1) % n
        if not is_open[(i, k)]:
            q = [inner[i][k], inner[i][j], inner[i + 1][j], inner[i + 1][k]]
            ci = sum(q, Vector()) / 4
            key = rule if isinstance(rule, str) else rule(ci, -nn)
            part.decal([corner(i, k), corner(i, j), corner(i + 1, j), corner(i + 1, k)], -nn, key)
            continue
        # The edges onto lined faces: along the skin at k and at j, and round it at ring i and i + 1.
        for nb, (a, b) in (((i, (k - 1) % n), ((i, k), (i + 1, k))), ((i, j), ((i, j), (i + 1, j))),
                           ((i - 1, k), ((i, k), (i, j))), ((i + 1, k), ((i + 1, k), (i + 1, j)))):
            if nb not in is_open or is_open[nb]:
                continue
            q = [outer[a[0]][a[1]], outer[b[0]][b[1]], inner[b[0]][b[1]], inner[a[0]][a[1]]]
            mid = sum(q, Vector()) / 4
            key = rule if isinstance(rule, str) else rule(mid, (c - mid).normalized())
            part.decal(q, c - mid, key)


GLYPHS = {}


def glyphs(text, height):
    """`text` as flat polygons, [(x, y)…] each, centred on the origin, its capitals `height` tall: Blender's
    own font, filled and cut to a few segments a curve so a number on a dial costs tens of triangles."""
    if (text, height) in GLYPHS:
        return GLYPHS[(text, height)]
    cu = bpy.data.curves.new('glyphs', 'FONT')
    cu.body = text
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    cu.size = height / 0.72
    cu.resolution_u = 2
    ob = bpy.data.objects.new('glyphs', cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    polys = [[(me.vertices[i].co.x, me.vertices[i].co.y) for i in p.vertices] for p in me.polygons]
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    bpy.data.meshes.remove(me)
    GLYPHS[(text, height)] = polys
    return polys


def words(part, text, at, n, up, height, key):
    """`text` laid flat on a face at `at`, facing `n`, its up along `up`."""
    right, upv, nn = face_frame(n, up)
    for poly in glyphs(text, height):
        part.decal([Vector(at) + right * x + upv * y for x, y in poly], nn, key)


LIFT = 0.0045       # each layer of a dial off the one under it: face, marks, needle
GLASS = 0.0045      # the gap round a dial's glass


class Dial:
    """A round instrument on a panel: its face a disc `r` across on the panel's front at `at`, facing `n`,
    behind a bezel; marks and numbers on the face; each needle a node of its own on the dial's centre, its
    local Z out of the face, so a turn about Z sweeps it round the dial. An angle is clockwise from
    twelve o'clock as the pilot reads it."""

    def __init__(self, plane, part, at, n, r, up=(0, 1, 0), face='dial', mark='mark', bezel='bezel', rim=0.007):
        self.plane, self.part, self.r, self.mark = plane, part, r, mark
        self.right, self.up, self.n = face_frame(n, up)
        self.at = Vector(at)
        # The face, a disc standing off the panel with its edge under the bezel's lip, and the bezel, its
        # back sunk in the panel, so no face of either lies on the panel's.
        self.top = self.at + self.n * 0.006
        self.layer = LIFT
        part.decal([self.top + self.right * ((r + 0.002) * math.cos(t)) + self.up * ((r + 0.002) * math.sin(t))
                    for t in np.linspace(0, 2 * math.pi, 24, endpoint=False)], self.n, face)
        part.lathe(self.at, self.n, [(r, -0.006), (r + rim, -0.006), (r + rim, 0.006 + 3 * LIFT), (r, 0.006 + 3 * LIFT)], bezel, segs=24, loop=True)

    def card(self, parts, name):
        """A card of its own over the face, a node on the dial's centre turning about its local Z, as a
        compass card or a horizon does: the dial drawing on it, a layer up."""
        card = copy.copy(self)
        card.part = Part(self.plane, name, self.top, x=self.right, y=self.up)
        card.layer = self.layer + LIFT
        parts.append(card.part)
        return card

    def point(self, a, rho, lift):
        return self.top + self.right * (rho * math.sin(a)) + self.up * (rho * math.cos(a)) + self.n * lift

    def ticks(self, angles, length, width, key=None, rho=None):
        for a in angles:
            r1 = rho if rho is not None else self.r - 0.003
            r0 = r1 - length
            d = Vector((math.sin(a), math.cos(a)))
            s = Vector((d.y, -d.x)) * (width / 2)
            side = self.right * s.x + self.up * s.y
            pts = [self.point(a, r0, self.layer) + side, self.point(a, r1, self.layer) + side,
                   self.point(a, r1, self.layer) - side, self.point(a, r0, self.layer) - side]
            self.part.decal(pts, self.n, key or self.mark)

    def numbers(self, labels, rho, height, key=None, radial=False):
        """[(angle, text)…], each upright, or with `radial` its top toward the rim as a card's are, its
        middle `rho` out."""
        for a, text in labels:
            up = self.right * math.sin(a) + self.up * math.cos(a) if radial else self.up
            words(self.part, text, self.point(a, rho, self.layer), self.n, up, height, key or self.mark)

    def text(self, text, x, y, height, key=None):
        """A word on the face at x right and y up of the middle."""
        words(self.part, text, self.top + self.right * x + self.up * y + self.n * self.layer, self.n, self.up, height, key or self.mark)

    def arc(self, a0, a1, rho, width, key, segs=12):
        """A band of colour round the face from angle a0 to a1, `width` wide at `rho`."""
        for k in range(segs):
            t0, t1 = a0 + (a1 - a0) * k / segs, a0 + (a1 - a0) * (k + 1) / segs
            self.part.decal([self.point(t0, rho - width / 2, self.layer), self.point(t1, rho - width / 2, self.layer),
                             self.point(t1, rho + width / 2, self.layer), self.point(t0, rho + width / 2, self.layer)], self.n, key)

    def patch(self, points, key, above=0.0):
        """A flat shape on the face, its corners [x right, y up] of the middle; `above` lifts a line drawn
        over another patch clear of it."""
        self.part.decal([self.top + self.right * x + self.up * y + self.n * (self.layer + above) for x, y in points], self.n, key)

    def disc(self, x, y, r, key, above=0.0, segs=12):
        self.patch([(x + r * math.cos(t), y + r * math.sin(t)) for t in np.linspace(0, 2 * math.pi, segs, endpoint=False)], key, above)

    def needle(self, parts, name, angle, length, width=0.004, tail=0.25, key='needle', hub='bezel', above=0.0):
        """A needle node pointing at `angle` at rest, on the dial's centre; `above` stands a second needle
        on the same dial over the first."""
        p = Part(self.plane, name, self.top, x=self.right, y=self.up)
        d = self.right * math.sin(angle) + self.up * math.cos(angle)
        s = self.right * math.cos(angle) - self.up * math.sin(angle)
        base = self.top + self.n * (self.layer + LIFT + above)
        tip, back = base + d * length, base - d * (length * tail)
        # Flat, as a needle is: a thin blade seen face on. The hub's cap stands a layer over it.
        p.decal([back + s * (width / 2), back - s * (width / 2), tip - s * 0.0004, tip + s * 0.0004], self.n, key)
        p.lathe(base, self.n, [(width * 1.2, -0.003), (width * 1.2, LIFT)], hub, segs=10, caps=(False, True))
        parts.append(p)
        return p


def scale(lo, hi, a0, a1):
    """The angle of a value on a dial whose `lo` stands at a0 and `hi` at a1."""
    return lambda v: a0 + (a1 - a0) * (v - lo) / (hi - lo)


def toggle(part, at, n, up, key_base, key_lever, length=0.022, tilt=0.35):
    """A toggle switch on a panel: its nut and a lever tipped up."""
    right, upv, nn = face_frame(n, up)
    at = Vector(at)
    part.lathe(at, nn, [(0.007, -0.006), (0.007, 0.006)], key_base, segs=8, caps=(False, True))
    a = at + nn * 0.004
    along(a, a + (nn * math.cos(tilt) + upv * math.sin(tilt)) * (length + 0.002), (0.0018, 0.0018), key_lever, part, up=upv)


def knob(part, at, n, r, depth, key, segs=10):
    """A round knob standing `depth` out of a panel at `at`, its back sunk in the panel and open."""
    part.lathe(Vector(at), Vector(n).normalized(), [(r, -0.006), (r, depth)], key, segs=segs, caps=(False, True))


# ------------------------------------------------------------------ the Camel

def camel():
    name = 'camel'
    spec = PLANES[name]
    span = spec['airframe']['span']
    for key, col, rough, metal in [
        ('khaki', (0.27, 0.25, 0.13), 0.7, 0), ('linen', (0.80, 0.72, 0.55), 0.75, 0),
        ('alu', (0.75, 0.76, 0.78), 0.35, 0.9), ('wood', (0.43, 0.28, 0.14), 0.55, 0),
        ('prop', (0.33, 0.18, 0.08), 0.4, 0), ('rubber', (0.04, 0.04, 0.04), 0.9, 0),
        ('steel', (0.3, 0.3, 0.32), 0.45, 0.8), ('leather', (0.22, 0.11, 0.05), 0.6, 0),
        ('gun', (0.08, 0.08, 0.09), 0.4, 0.7),
        ('rblue', (0.05, 0.12, 0.40), 0.6, 0), ('rwhite', (0.9, 0.9, 0.88), 0.6, 0), ('rred', (0.65, 0.05, 0.05), 0.6, 0),
        ('wicker', (0.50, 0.36, 0.17), 0.85, 0), ('ply', (0.36, 0.19, 0.07), 0.3, 0), ('dial', (0.02, 0.02, 0.02), 0.6, 0),
        ('mark', (0.86, 0.82, 0.66), 0.5, 0), ('needle', (0.90, 0.86, 0.70), 0.4, 0), ('bezel', (0.55, 0.40, 0.15), 0.3, 0.9),
        ('black', (0.03, 0.03, 0.03), 0.5, 0.3), ('lining', (0.40, 0.33, 0.20), 0.9, 0),
    ]:
        paint(name, key, col, rough, metal)
    paint(name, 'glass', (0.80, 0.84, 0.80), 0.05, 0, 0.18)
    body = Part(name, 'body')
    parts = [body]
    fabric = lambda c, n: 'linen' if n.y < -0.35 else 'khaki'

    # The fuselage: flat-sided behind the round engine, the hump over the guns, faired through its
    # sections. It ends at the rudder post. The decking is cut open under the coaming between the
    # stations at 0.25 and 0.85 m, along the second point either side of the top of every ring there,
    # stood where x is 0.57 of the half width; the lining inside runs from the firewall at −0.05 m to the
    # bulkhead at 1.10 m. Those four are stations of the loft, and change nothing of its shape.
    F = [(-0.85, 0.00, 0.42, 0.46, 2.0), (-0.60, 0.02, 0.42, 0.48, 3.0), (-0.10, 0.05, 0.42, 0.50, 5.0),
         (0.60, 0.00, 0.40, 0.48, 5.0), (2.00, 0.02, 0.28, 0.34, 5.0), (3.40, 0.07, 0.14, 0.20, 5.0), (4.03, 0.10, 0.04, 0.09, 4.0)]
    N = 40

    def hoop(z, inset=0.0):
        cy, hw, hh, p = section_at(F, z)
        return superellipse(0, cy, hw - inset, hh - inset, p, z, n=N, pins=[(N // 2 - 2, at_x(0.57, p) if 0.25 <= z <= 0.85 else None)])
    Z = body_stations(F, (-0.05, 0.25, 0.85, 1.10))
    opening = lambda c, n: abs(c.x) < 0.57 * section_at(F, c.z)[1] and n.y > 0.5 and 0.25 < c.z < 0.85
    body.loft([hoop(z) for z in Z], lambda c, n: 'alu' if c.z < -0.45 else fabric(c, n), keep=lambda c, n: not opening(c, n))
    # The cowling, open at the front on the spinning engine, and the hump over the guns' breeches.
    body.lathe((0, 0, 0), (0, 0, 1), [(0.42, -1.40), (0.50, -1.40), (0.53, -1.10), (0.52, -0.80), (0.47, -0.80), (0.46, -1.10)], 'alu', loop=True)
    hump = Fair([(-0.45, 0.38, 0.05, 0.05, 2), (-0.25, 0.50, 0.24, 0.20, 2.5), (0.10, 0.52, 0.25, 0.22, 2.5), (0.28, 0.45, 0.15, 0.10, 2)])
    shape = lambda z, n=16: superellipse(0, *hump(z), z, n=n)
    body.loft([shape(z, segs_for(0.25)) for z in stations(shape, hump.z)], 'khaki')
    for s in (-1, 1):
        body.lathe((s * 0.12, 0.60, 0), (0, 0, 1), [(0.0, -1.0), (0.025, -1.0), (0.025, -0.80), (0.065, -0.80), (0.065, 0.05), (0.0, 0.05)], 'gun', caps=(False, False))
    camel_cockpit(name, body, F, hoop, [z for z in Z if -0.05 <= z <= 1.10], parts)

    # The wings: the upper in one piece with its cut-out over the cockpit, the lower from the fuselage's
    # sides at 5° dihedral, staggered 0.46 m and 1.52 m apart, ailerons on all four.
    chord, half = 1.37, span / 2
    f = foil(0.08, 0.05, 0.4)
    up = Vector((0, 1, 0))
    uw = Surface(lambda s: Vector((s, 1.05, -0.95)), lambda s: chord, lambda s: Vector((0, 0, 1)), lambda s: up, f)
    ail = (2.2, half - 0.06)
    lifting(name, body, uw, [-half, -ail[1], -ail[0], -0.35, 0.35, ail[0], ail[1], half],
            [(-ail[1], -ail[0], 'aileron_left'), (-0.35, 0.35, 'none'), (ail[0], ail[1], 'aileron_right')], 0.72, fabric, parts)
    # The lower wing's halves meet under the fuselage's bottom longerons, their roots 4 cm apart inside it.
    # A strut or wire ends inside the wing it meets: the upper wing's underside is 1.06 m up.
    dih = math.radians(5)
    root = 0.02
    lower = {}
    for side in (-1, 1):
        lw = Surface(lambda s, side=side: Vector((side * s, -0.47 + (s - root) * math.tan(dih), -0.49)), lambda s: chord,
                     lambda s: Vector((0, 0, 1)), lambda s, side=side: Vector((-side * math.sin(dih), math.cos(dih), 0)), f)
        lower[side] = lw
        lifting(name, body, lw, [root, ail[0], ail[1], half], [(ail[0], ail[1], f'aileron_{"left" if side < 0 else "right"}_lower')], 0.72, fabric, parts)
        lower_y = lambda x: -0.47 + (abs(x) - root) * math.tan(dih)
        # Cabane struts, interplane struts and the bracing wires.
        for z0, z1 in ((-0.75, -0.80), (-0.15, -0.22)):
            body.tube((side * 0.24, 0.40, z0), (side * 0.45, 1.09, z1), 0.018, 0.035, 'steel')
        xs = side * 2.75
        for dz in (0.25, 1.05):
            body.tube((xs, lower_y(xs) + 0.02, -0.49 + dz), (xs, 1.09, -0.95 + dz), 0.022, 0.05, 'wood')
        for dz in (0.25, 1.05):
            body.tube((side * 0.45, lower_y(0.45) + 0.05, -0.49 + dz), (xs, 1.08, -0.95 + dz), 0.006, None, 'steel', n=4)
            body.tube((side * 0.45, 1.08, -0.95 + dz), (xs, lower_y(xs) + 0.04, -0.49 + dz), 0.006, None, 'steel', n=4)

    # The tail: tailplane and split elevator, the small fin, the D-shaped rudder in the roundel's colours.
    tf = foil(0.06, 0, 0.4)
    tp = Surface(lambda s: Vector((s, 0.12, 3.25)), lambda s: 0.95, lambda s: Vector((0, 0, 1)), lambda s: up, tf)
    lifting(name, body, tp, [-1.5, -0.12, 0.12, 1.5], [(-1.5, -0.12, 'elevator_l'), (-0.12, 0.12, 'none'), (0.12, 1.5, 'elevator_r')], 0.58, fabric, parts)
    # The two halves turn as one: one node, both halves in it.
    halves = [p for p in parts if p.name in ('elevator_l', 'elevator_r')]
    merge(halves, 'elevator', parts)
    fin = Surface(lambda s: Vector((0, s, 3.5 + (s - 0.22) * 0.9)), lambda s: 0.55 - (s - 0.22) * 0.95, lambda s: Vector((0, 0, 1)), lambda s: Vector((1, 0, 0)), tf)
    panel(body, fin, [0.22, 0.62], 0, 1, 'khaki')
    # The rudder, a D on its hinge at 4.06 m: its chord at each height, faired between these, and its
    # thickness falling off from 6.6 cm behind its round leading edge. It is lofted back along z through
    # sections across it, round-edged, so the stripes' edges at 4.24 and 4.43 m are stations of it.
    stripes = lambda c, n: 'rblue' if c.z < 4.24 else ('rwhite' if c.z < 4.43 else 'rred')
    rudder = Part(name, 'rudder', (0, 0.3, 4.06), y=(0, 1, 0), keep='y')
    rs = [(-0.30, 0.30), (-0.15, 0.48), (0.10, 0.55), (0.45, 0.55), (0.70, 0.42), (0.85, 0.18)]
    rc = Fair(rs)
    ys = [-0.30 + 1.15 * i / 400 for i in range(401)]
    cs = [rc(y)[0] for y in ys]
    nose = 0.03

    def reach(z):
        """The rudder's bottom and top edges at z: where its chord reaches back past z."""
        d = z - 4.06
        inside = [i for i, c in enumerate(cs) if c >= d - 1e-9]
        lo, hi = inside[0], inside[-1]
        edge = lambda i, j: ys[i] + (ys[j] - ys[i]) * (d - cs[i]) / (cs[j] - cs[i]) if cs[j] != cs[i] else ys[i]
        return (edge(lo - 1, lo) if lo > 0 else ys[0]), (edge(hi + 1, hi) if hi < len(ys) - 1 else ys[-1])

    def slice_at(z, n=16):
        lo, hi = reach(z)
        half = 0.033 * (1 - (z - 4.06) / 0.58)
        if z < 4.06 + nose:
            half *= math.sqrt(max(0.0, 1 - ((4.06 + nose - z) / nose) ** 2))
        return superellipse(0, (lo + hi) / 2, max(half, 1e-4), (hi - lo) / 2, 6, z, n=n)
    zs = stations(slice_at, [4.06 + nose * (1 - math.cos(a * math.pi / 12)) for a in range(7)] + [4.24, 4.43] + [4.06 + c for _, c in rs])
    rudder.loft([slice_at(z) for z in zs], stripes, caps=(False, True))
    parts.append(rudder)
    body.tube((0, -0.30, 3.65), (0, -0.78, 3.92), 0.025, 0.04, 'wood')
    body.loft([superellipse(0, -0.78, 0.04, 0.03, 2, z, n=segs_for(0.04)) for z in (3.84, 4.0)], 'steel')

    # The undercarriage: two V-struts to an axle under the engine, and the wheels, fabric over spokes.
    for i, w in enumerate(spec['gear']['wheels'][:2]):
        x, y, z = w['at']
        s = 1 if x > 0 else -1
        body.tube((s * 0.62, y + 0.03, z), (s * 0.30, -0.44, -0.95), 0.02, 0.045, 'wood')
        body.tube((s * 0.62, y + 0.03, z), (s * 0.30, -0.44, -0.25), 0.02, 0.045, 'wood')
        wheel(name, i, w, 0.085, 'linen', parts)
    body.tube((-0.70, -1.20, -0.55), (0.70, -1.20, -0.55), 0.025, 0.05, 'steel')

    # The propeller and the rotary engine that turns with it.
    prop = Part(name, 'prop', (0, 0, -1.45))
    for s in (-1, 1):
        blade(prop, (0, 0, -1.45), Vector((0, s, 0)), Vector((-s, 0, 0)), Vector((0, 0, 1)), 0.08, 1.30,
              lambda r: 0.20 - 0.07 * r / 1.3, lambda r: 0.05 - 0.03 * r / 1.3, lambda r: 0.75 - 0.45 * r / 1.3, 'prop')
    prop.lathe((0, 0, -1.45), (0, 0, 1), [(0.0, -0.06), (0.10, -0.06), (0.10, 0.08), (0.0, 0.08)], 'steel', caps=(False, False))
    prop.lathe((0, 0, -1.25), (0, 0, 1), [(0.0, -0.08), (0.17, -0.08), (0.17, 0.08), (0.0, 0.08)], 'steel', caps=(False, False))
    for k in range(9):
        t = 2 * math.pi * k / 9
        d = Vector((math.cos(t), math.sin(t), 0))
        prop.tube(Vector((0, 0, -1.25)) + d * 0.14, Vector((0, 0, -1.25)) + d * 0.44, 0.06, None, 'steel')
    parts.append(prop)

    # Roundels on the top of the upper wing, the bottom of the lower, and the fuselage's sides.
    radii, keys = (0.58, 0.39, 0.19), ('rblue', 'rwhite', 'rred')
    mid = 0.5
    for side in (-1, 1):
        x0 = side * 3.25
        roundel(body, lambda u, v, x0=x0: uw.upper(x0 + u, mid + v / chord, 0.01), (0, 1, 0), radii, keys)
        roundel(body, lambda u, v, x0=abs(x0), lw=lower[side]: under(lw, x0 + u, mid + v / chord, 0.01), (0, -1, 0), radii, keys)
        zc, yc = 2.0, 0.02
        roundel(body, lambda u, v, side=side: Vector((side * (side_x(F, yc + v, zc + u) + 0.01), yc + v, zc + u)), (side, 0, 0), (0.24, 0.16, 0.08), keys)
    return name, parts


def oval(hx, hz, p, y, cz, n=24):
    """A ring lying level at height y round (0, cz): |x/hx|^p + |dz/hz|^p = 1."""
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        c, s = math.cos(t), math.sin(t)
        pts.append(Vector((hx * math.copysign(abs(c) ** (2 / p), c), y, cz + hz * math.copysign(abs(s) ** (2 / p), s))))
    return pts


def across(ring, y):
    """How far out to the right a ring crosses the height y."""
    best = 0.0
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if (a.y - y) * (b.y - y) <= 0 and a.y != b.y:
            best = max(best, a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y))
    return best


def camel_cockpit(name, body, F, hoop, zs, parts):
    """The Camel's cockpit, after the F.1s at Hendon and Duxford: a wicker seat in the bare fuselage, its
    fabric over the wooden longerons and their bracing wires; the varnished board under the gun hump, the
    two Vickers breeches over it and the Aldis sight between them; a spade grip on the stick, the rudder
    bar, and the throttle and fine adjustment on the left. The pilot's eye sits at the back of the
    opening, a little over the coaming, the sight just under it."""
    cp = Part(name, 'cockpit')
    parts.append(cp)
    EYES[name] = (0.0, 0.80, 0.76)
    cz = 0.55

    # The coaming: a padded leather roll round the opening, its outside over the cut in the decking.
    outer, inner = oval(0.30, 0.37, 4, 0.49, cz, n=segs_for(0.37)), oval(0.22, 0.28, 2.6, 0.49, cz, n=segs_for(0.37))
    roll = [(1, -0.06), (1, 0.0), (0.88, 0.022), (0.65, 0.034), (0.35, 0.034), (0.12, 0.022), (0, 0.0), (0, -0.06)]
    cp.loft([[i + (o - i) * u + Vector((0, h, 0)) for o, i in zip(outer, inner)] for u, h in roll], 'leather', loop=True)

    # The tub: the fuselage's inside from the firewall to the bulkhead behind the seat, on the skin's own
    # rings at its stations `zs` and 2 cm inside them, open overhead under the decking, fabric on the
    # sides and boards on the floor.
    out, ins = [hoop(z) for z in zs], [hoop(z, 0.02) for z in zs]
    lining(cp, out, ins, lambda c, n: n.y > 0.5, lambda c, n: 'wood' if n.y > 0.5 else 'lining')
    top = 0.44
    cp.decal(clip(ins[0], -1, top), (0, 0, 1), 'ply')
    cp.decal(clip(ins[-1], -1, top), (0, 0, -1), 'ply')
    # The longerons along the corners, a strut up each side at two stations, and wires crossed in the
    # bays between them.
    corner = lambda z, sx, sy: (lambda cy, hw, hh, p: Vector((sx * 0.80 * (hw - 0.02), cy + sy * 0.80 * (hh - 0.02), z)))(*section_at(F, z))
    for sx in (-1, 1):
        for sy in (-1, 1):
            cp.tube(corner(zs[0], sx, sy), corner(zs[-1], sx, sy), 0.016, None, 'wood', n=8)
        for z in (0.40, 0.98):
            cp.tube(corner(z, sx, -1), corner(z, sx, 1), 0.014, None, 'wood', n=8)
        for z0, z1 in ((0.40, 0.98),):
            cp.tube(corner(z0, sx, -1) + Vector((-sx * 0.01, 0, 0)), corner(z1, sx, 1) + Vector((-sx * 0.01, 0, 0)), 0.0025, None, 'steel', n=4)
            cp.tube(corner(z0, sx, 1) + Vector((-sx * 0.02, 0, 0)), corner(z1, sx, -1) + Vector((-sx * 0.02, 0, 0)), 0.0025, None, 'steel', n=4)

    # The board: varnished plywood across the fuselage under the decking, its face aft.
    zb = 0.275
    slab(cp, clip(hoop(zb, 0.045), -0.05, 0.42), zb - 0.018, zb, 'ply')
    n = (0, 0, 1)
    # The rev counter at the top, airspeed on its left and height on its right, all the Clerget's.
    deg = math.radians
    rpm = scale(0, 16, deg(-135), deg(135))
    tach = Dial(name, cp, (0, 0.30, zb), n, 0.046)
    tach.ticks([rpm(v) for v in range(17)], 0.006, 0.0012)
    tach.ticks([rpm(v) for v in range(0, 17, 2)], 0.010, 0.0020)
    tach.numbers([(rpm(v), str(v)) for v in range(0, 17, 4)], 0.026, 0.0065)
    tach.text('RPM', 0, -0.016, 0.0045)
    tach.text('x100', 0, -0.024, 0.0035)
    tach.arc(rpm(12.5), rpm(13.5), 0.0405, 0.003, 'rred')
    tach.needle(parts, 'needle_rpm', rpm(0), 0.036)
    mph = scale(0, 140, deg(-150), deg(150))
    asi = Dial(name, cp, (-0.165, 0.295, zb), n, 0.040)
    asi.ticks([mph(v) for v in range(20, 141, 10)], 0.006, 0.0012)
    asi.ticks([mph(v) for v in range(20, 141, 20)], 0.009, 0.0020)
    asi.numbers([(mph(v), str(v)) for v in range(20, 141, 20)], 0.022, 0.0052)
    asi.text('MPH', 0, -0.012, 0.0045)
    asi.needle(parts, 'needle_speed', mph(0), 0.031)
    feet = scale(0, 20, 0, deg(360))
    alt = Dial(name, cp, (0.165, 0.295, zb), n, 0.040)
    alt.ticks([feet(v) for v in range(20)], 0.006, 0.0012)
    alt.ticks([feet(v) for v in range(0, 20, 5)], 0.009, 0.0020)
    alt.numbers([(feet(v), str(v)) for v in range(0, 20, 5)], 0.023, 0.0060)
    alt.text('FEET', 0, 0.010, 0.0040)
    alt.text('x1000', 0, -0.012, 0.0035)
    alt.needle(parts, 'needle_altitude', feet(0), 0.031)
    # Below them: the air pressure for the tank, the oil pulsator's glass, and the compass.
    lbs = scale(0, 5, deg(-120), deg(120))
    air = Dial(name, cp, (-0.12, 0.165, zb), n, 0.026)
    air.ticks([lbs(v / 2) for v in range(11)], 0.004, 0.0010)
    air.numbers([(lbs(v), str(v)) for v in range(0, 6)], 0.015, 0.0040)
    air.text('AIR', 0, -0.009, 0.0035)
    air.needle(parts, 'needle_air', lbs(0), 0.020, width=0.003)
    cp.lathe(Vector((0, 0.165, zb)), Vector(n), [(0.018, -0.006), (0.026, -0.006), (0.026, 0.008), (0.018, 0.008)], 'bezel', segs=16, loop=True)
    cp.decal([Vector((0.020 * math.cos(t), 0.165 + 0.020 * math.sin(t), zb + LIFT)) for t in np.linspace(0, 2 * math.pi, 16, endpoint=False)], n, 'dial')
    cp.lathe(Vector((0, 0.165, zb + 0.0065)), Vector(n), [(0.019, 0.0), (0.0165, 0.0095), (0.0095, 0.0165), (0.001, 0.019)], 'glass', segs=16, caps=(False, False))
    compass = Dial(name, cp, (0.12, 0.165, zb), n, 0.028)
    compass.patch([(-0.0025, 0.026), (0.0025, 0.026), (0, 0.020)], 'rred')
    card = compass.card(parts, 'card_heading')
    card.ticks([deg(a) for a in range(0, 360, 30)], 0.004, 0.0010, rho=0.0235)
    card.numbers([(deg(a), t) for a, t in ((0, 'N'), (90, 'E'), (180, 'S'), (270, 'W'))], 0.014, 0.0055)
    # The two magneto switches on a brass plate, and the tank's cock below them.
    # The plate is let into the board and stands 5 mm proud of it.
    box(cp, (0.245, 0.19, zb - 0.004), (0.028, 0.045, 0.009), 'bezel')
    for y in (0.215, 0.165):
        toggle(cp, (0.245, y, zb + 0.005), n, (0, 1, 0), 'black', 'steel')
    words(cp, 'MAG', (0.245, 0.243, zb + 0.005 + LIFT), n, (0, 1, 0), 0.006, 'black')
    knob(cp, (-0.245, 0.09, zb), n, 0.012, 0.012, 'bezel')
    along((-0.245, 0.09, zb + 0.012), (-0.215, 0.09, zb + 0.012), (0.005, 0.004), 'black', cp)

    # The Vickers breeches out of the back of the hump, their cocking handles on the right, and the
    # Aldis between them on two pillars, its eyepiece a hand short of the eye.
    for x in (-0.12, 0.12):
        box(cp, (x, 0.60, 0.11), (0.048, 0.062, 0.11), 'gun')
        along((x + 0.040, 0.615, 0.16), (x + 0.090, 0.615, 0.16), (0.005, 0.005), 'steel', cp)
        box(cp, (x + 0.092, 0.615, 0.16), (0.008, 0.012, 0.012), 'black')
    cp.lathe(Vector((0, 0.762, -0.36)), Vector((0, 0, 1)), [(0.022, 0.0), (0.022, 0.58)], 'gun', segs=12)
    cp.lathe(Vector((0, 0.762, 0.20)), Vector((0, 0, 1)), [(0.027, 0.0), (0.027, 0.08)], 'black', segs=12)
    for z, y0 in ((-0.20, 0.70), (0.12, 0.72)):
        along((0, y0, z), (0, 0.742, z), (0.006, 0.010), 'steel', cp, up=(0, 0, 1))

    # The windscreen, a little celluloid in a wooden frame on the coaming's front.
    lo, hi = Vector((0, 0.515, 0.235)), Vector((0, 0.655, 0.27))
    x = Vector((0.10, 0, 0))
    cp.decal([lo - x, lo + x, hi + x, hi - x], (0, 0.25, 1), 'glass')
    for x in (-0.105, 0.105):
        along(lo + Vector((x, 0, 0)), hi + Vector((x, 0, 0)), (0.005, 0.005), 'wood', cp, up=(0, 0, 1))
    along(hi + Vector((-0.11, 0.005, 0)), hi + Vector((0.11, 0.005, 0)), (0.005, 0.005), 'wood', cp)

    # The seat: a wicker bucket on two posts off the floor.
    floor = lambda z: (lambda cy, hw, hh, p: cy - hh + 0.02)(*section_at(F, z))
    box(cp, (0, -0.02, 0.88), (0.19, 0.02, 0.15), 'wicker')
    for x in (-0.12, 0.12):
        along((x, floor(0.88) - 0.01, 0.88), (x, -0.02, 0.88), (0.012, 0.012), 'wood', cp)
    for k in range(9):
        a = deg(-80 + 20 * k)
        c = Vector((0.21 * math.sin(a), 0.21, 0.82 + 0.21 * math.cos(a)))
        box(cp, c, (0.026, 0.20, 0.008), 'wicker', ((math.cos(a), 0, -math.sin(a)), (0, 1, 0), (math.sin(a), 0, math.cos(a))))
    # The leather roll round its top, one piece along the arc.
    rim = []
    for k in range(17):
        a = deg(-80 + 10 * k)
        r, c = Vector((math.sin(a), 0, math.cos(a))), Vector((0.21 * math.sin(a), 0.41, 0.82 + 0.21 * math.cos(a)))
        rim.append([c + r * (0.018 * x) + Vector((0, 0.016 * y, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    cp.loft(rim, 'leather')

    # The stick on its pivot in the floor, a spade grip on top and the blip switch on the grip.
    pivot = Vector((0, floor(0.50) + 0.02, 0.50))
    stick = Part(name, 'stick', pivot)
    head = Vector((0, 0.10, 0.57))
    along(pivot, head + Vector((0, 0.004, 0)), (0.013, 0.013), 'steel', stick, up=(0, 0, 1))
    for x in (-0.055, 0.055):
        along(head + Vector((x, -0.004, 0)), head + Vector((x, 0.114, 0)), (0.011, 0.017), 'leather', stick, up=(0, 0, 1))
    along(head + Vector((-0.073, 0, 0)), head + Vector((0.073, 0, 0)), (0.009, 0.009), 'steel', stick)
    along(head + Vector((-0.073, 0.11, 0)), head + Vector((0.073, 0.11, 0)), (0.011, 0.011), 'leather', stick)
    knob(stick, head + Vector((0, 0.121, 0)), (0, 1, 0), 0.007, 0.006, 'bezel')
    parts.append(stick)

    # The rudder bar across the floor ahead, on its post, a stirrup at each end.
    bar = Vector((0, floor(0.06) + 0.06, 0.06))
    along((0, floor(0.06) - 0.01, 0.06), bar, (0.014, 0.014), 'steel', cp, up=(0, 0, 1))
    pedals = Part(name, 'pedals', bar)
    along(bar + Vector((-0.25, 0, 0)), bar + Vector((0.25, 0, 0)), (0.02, 0.016), 'wood', pedals)
    for x in (-0.20, 0.20):
        box(pedals, bar + Vector((x, 0.035, 0.032)), (0.045, 0.035, 0.004), 'steel')
    parts.append(pedals)

    # The throttle and the fine adjustment in their quadrant on the left wall.
    wall = -(section_at(F, 0.45)[1] - 0.02)
    box(cp, (wall + 0.012, 0.21, 0.45), (0.008, 0.055, 0.075), 'bezel')
    throttle = Part(name, 'throttle', (wall + 0.03, 0.18, 0.45))
    along((wall + 0.03, 0.18, 0.45), (wall + 0.03, 0.28, 0.40), (0.004, 0.006), 'steel', throttle)
    box(throttle, (wall + 0.03, 0.285, 0.398), (0.012, 0.012, 0.012), 'black')
    parts.append(throttle)
    along((wall + 0.045, 0.18, 0.48), (wall + 0.045, 0.26, 0.45), (0.003, 0.005), 'steel', cp)
    box(cp, (wall + 0.045, 0.265, 0.448), (0.009, 0.009, 0.009), 'bezel')


EYES = {}


def under(surf, s, xc, lift):
    yc, yt = surf.f(xc)
    return surf.point(s, xc, yc - yt) - surf.tdir(s) * lift


def merge(halves, name, parts):
    """Several parts on one hinge made one node: the first's frame, the rest's faces moved into it."""
    first = halves[0]
    first.name = name
    for other in halves[1:]:
        vmap = {}
        for v in other.bm.verts:
            vmap[v] = first.bm.verts.new(v.co)
        for f in other.bm.faces:
            rule = other.rules[f[other.rule]]
            first.face([vmap[v] for v in f.verts], rule)
        for e in other.soft:
            first.soft.add(first.bm.edges.get([vmap[v] for v in e.verts]))
        for v, n in other.normals.items():
            first.normals[vmap[v]] = n
        other.bm.free()
        parts.remove(other)


# ------------------------------------------------------------------ the Cessna

def cessna():
    name = 'cessna'
    spec = PLANES[name]
    span = spec['airframe']['span']
    for key, col, rough, metal, alpha in [
        ('white', (0.88, 0.88, 0.86), 0.35, 0, 1), ('blue', (0.06, 0.16, 0.48), 0.35, 0, 1),
        ('red', (0.62, 0.05, 0.05), 0.35, 0, 1), ('glass', (0.16, 0.20, 0.24), 0.05, 0.2, 0.22),
        ('alu', (0.75, 0.76, 0.78), 0.35, 0.9, 1), ('rubber', (0.04, 0.04, 0.04), 0.9, 0, 1),
        ('prop', (0.12, 0.12, 0.13), 0.5, 0.6, 1), ('steel', (0.3, 0.3, 0.32), 0.45, 0.8, 1),
        ('panel', (0.07, 0.07, 0.08), 0.6, 0.2, 1), ('shield', (0.025, 0.025, 0.028), 0.9, 0, 1),
        ('trim', (0.42, 0.33, 0.22), 0.8, 0, 1), ('headliner', (0.72, 0.66, 0.54), 0.9, 0, 1),
        ('carpet', (0.12, 0.08, 0.06), 0.95, 0, 1), ('seat', (0.30, 0.16, 0.08), 0.85, 0, 1),
        ('dial', (0.02, 0.02, 0.025), 0.6, 0, 1), ('mark', (0.92, 0.92, 0.90), 0.5, 0, 1),
        ('needle', (0.95, 0.95, 0.93), 0.4, 0, 1), ('bezel', (0.05, 0.05, 0.055), 0.4, 0.5, 1),
        ('sky', (0.12, 0.38, 0.78), 0.5, 0, 1), ('earth', (0.40, 0.23, 0.10), 0.6, 0, 1),
        ('orange', (0.95, 0.48, 0.05), 0.5, 0, 1), ('arcgreen', (0.10, 0.62, 0.18), 0.5, 0, 1),
        ('arcyellow', (0.92, 0.75, 0.08), 0.5, 0, 1), ('knob', (0.03, 0.03, 0.03), 0.5, 0.2, 1),
        ('radio', (0.04, 0.04, 0.045), 0.5, 0.3, 1),
    ]:
        paint(name, key, col, rough, metal, alpha)
    paint(name, 'lcd', (0.25, 1.0, 0.35), 0.4, 0, 1, glow=2.0)
    paint(name, 'amber', (1.0, 0.55, 0.10), 0.4, 0, 1, glow=2.0)
    body = Part(name, 'body')
    parts = [body]
    # The cabin is near square under the wing, so the wing sits on its roof edge to edge. The cowling's top
    # stands a hand under the pilot's eye, so the nose is seen over.
    F = [(-2.30, -0.10, 0.25, 0.25, 2.0), (-2.05, -0.08, 0.45, 0.42, 2.4), (-1.40, -0.06, 0.52, 0.50, 3.0),
         (-0.90, 0.08, 0.56, 0.68, 3.5), (-0.30, 0.10, 0.56, 0.70, 5.0), (0.60, 0.08, 0.55, 0.68, 5.0),
         (1.40, 0.12, 0.45, 0.55, 3.0), (3.00, 0.15, 0.28, 0.38, 2.6), (4.80, 0.15, 0.15, 0.25, 2.4), (5.90, 0.17, 0.05, 0.12, 2.0)]

    # Every ring has the same points along the lines a colour changes on: the stripes' edges, the red from
    # 0.27 to 0.22 m down and the blue from 0.20 to 0.04 m down, level from the nose to 1.40 m behind the
    # centre of gravity and from there as far down the ring as they stand there, so they sweep up the
    # tail cone with it; and in the cabin, from 1.30 m ahead of the centre of gravity to 1.30 m behind,
    # the windows' sills and tops, 0.28, 0.40 and 0.70 m up, where the ring reaches them. The windows'
    # ends are stations of the loft.
    N = 48
    STRIPES = ((-0.27, -0.22, 'red'), (-0.20, -0.04, 'blue'))
    SILLS = ((13, 0.28), (14, 0.40), (18, 0.70))

    def stripe(y, z):
        """A stripe's edge `y` (as it runs level) at z: a part of the ring's half height off its middle."""
        cy, hw, hh, p = section_at(F, min(z, 1.40))
        return (y - cy) / hh

    def hoop(z, inset=0.0):
        cy, hw, hh, p = section_at(F, z)
        pins = [(9 + i, at_y(stripe(y, z), p)) for i, y in enumerate(y for lo, hi, _ in STRIPES for y in (lo, hi))]
        for k, y in SILLS:
            f = (y - cy) / hh
            pins.append((k, at_y(f, p) if -1.30 <= z <= 1.30 and abs(f) < 0.95 else None))
        return superellipse(0, cy, hw - inset, hh - inset, p, z, n=N, pins=pins)

    def skin(c, n):
        windshield = -1.20 < c.z < -0.55 and n.y > 0.12 and c.y > 0.45
        side = abs(n.x) > 0.55 and ((0.28 < c.y < 0.70 and (-0.95 < c.z < 0.50 or 0.62 < c.z < 1.30)) or (0.40 < c.y < 0.70 and -1.30 < c.z < -0.95))
        rear = 0.62 < c.z < 1.55 and n.y > 0.6
        if windshield or side or rear:
            return 'glass'
        cy, hw, hh, p = section_at(F, c.z)
        f = (c.y - cy) / hh
        for lo, hi, key in STRIPES:
            if abs(n.x) > 0.4 and stripe(lo, c.z) < f < stripe(hi, c.z):
                return key
        return 'white'
    Z = body_stations(F, (-1.30, -1.20, -0.95, -0.55, 0.50, 0.62, 1.30, 1.55))
    body.loft([hoop(z) for z in Z], skin)
    cessna_cockpit(name, F, hoop, [z for z in Z if -1.40 <= z <= 1.40], lambda c, n: skin(c, n) == 'glass', parts)
    # The spinner, a half ellipsoid.
    body.lathe((0, -0.08, -2.30), (0, 0, -1), [(0.24 * math.cos(a), -0.02 + 0.34 * math.sin(a)) for a in np.linspace(0, math.pi / 2, 9)], 'white', caps=(True, False))

    # The wing: high and in one piece over the cabin roof, its inner panels square, its outer panels
    # tapered, 1.73° of dihedral, a strut each side, the flaps (airbrake_*) and ailerons behind.
    f = foil(0.12, 0.02, 0.4)
    dih = math.radians(1.73)
    half = span / 2
    chord = lambda s: 1.63 if abs(s) <= 2.5 else 1.63 + (1.08 - 1.63) * (abs(s) - 2.5) / (half - 2.5)
    sgn = lambda s: 1 if s >= 0 else -1
    w = Surface(lambda s: Vector((s, 0.70 + abs(s) * math.tan(dih), -0.37)), chord,
                lambda s: Vector((0, 0, 1)), lambda s: Vector((-sgn(s) * math.sin(dih), math.cos(dih), 0)), f)
    out = [0.62, 2.5, 3.55, 3.65, half - 0.2, half]
    lifting(name, body, w, [-s for s in out[::-1]] + out,
            [(-(half - 0.2), -3.65, 'aileron_left'), (-3.55, -0.62, 'airbrake_left'), (0.62, 3.55, 'airbrake_right'), (3.65, half - 0.2, 'aileron_right')],
            0.72, 'white', parts)
    for side in (-1, 1):
        body.tube((side * 0.50, -0.38, 0.05), w.point(side * 3.0, 0.3, f(0.3)[0] - f(0.3)[1]) + Vector((0, 0.02, 0)), 0.03, 0.07, 'white')

    # The tail: tailplane and elevator, the swept fin and rudder.
    tf = foil(0.10, 0, 0.4)
    tc = lambda s: 1.25 + (0.85 - 1.25) * abs(s) / 1.725
    tp = Surface(lambda s: Vector((s, 0.18, 4.60 + abs(s) * 0.2)), tc, lambda s: Vector((0, 0, 1)), lambda s: Vector((0, 1, 0)), tf)
    lifting(name, body, tp, [-1.725, -0.12, 0.12, 1.725], [(-1.725, 1.725, 'elevator')], 0.60, 'white', parts)
    fc = lambda s: 1.70 + (0.90 - 1.70) * (s - 0.30) / 1.10
    fin = Surface(lambda s: Vector((0, s, 4.30 + (s - 0.30) * 0.82)), fc, lambda s: Vector((0, 0, 1)), lambda s: Vector((1, 0, 0)), tf)
    lifting(name, body, fin, [0.30, 1.40], [(0.30, 1.40, 'rudder')], 0.62, lambda c, n: 'blue' if c.y > 1.15 else 'white', parts, axis='y')

    # The gear: spring-steel main legs, the nose oleo and its fork on the steer node, the wheels.
    wheels = spec['gear']['wheels']
    for i, w in enumerate(wheels):
        x, y, z = w['at']
        if w['steer']:
            body.tube((0, -0.45, z - 0.05), (0, y + 0.25, z), 0.035, None, 'steel')
            steer = Part(name, f'steer_{i}', (x, y, z), y=(0, 1, 0), keep='y')
            steer.tube((-0.09, y + 0.27, z), (-0.09, y, z), 0.018, None, 'steel')
            steer.tube((0.09, y + 0.27, z), (0.09, y, z), 0.018, None, 'steel')
            steer.tube((-0.11, y + 0.28, z), (0.11, y + 0.28, z), 0.03, None, 'steel')
            parts.append(steer)
            wheel(name, i, w, 0.13, 'white', parts)
        else:
            s = 1 if x > 0 else -1
            body.loft([[Vector((s * 0.40, -0.52, z - 0.06)) + d for d in (Vector((0, 0.02, -0.06)), Vector((0, -0.02, -0.06)), Vector((0, -0.02, 0.06)), Vector((0, 0.02, 0.06)))],
                       [Vector((x - s * 0.10, y + 0.02, z)) + d for d in (Vector((0, 0.015, -0.04)), Vector((0, -0.015, -0.04)), Vector((0, -0.015, 0.04)), Vector((0, 0.015, 0.04)))]], 'white')
            body.tube((x - s * 0.12, y, z), (x - s * 0.07, y, z), 0.03, None, 'steel')
            wheel(name, i, w, 0.15, 'white', parts)

    # The propeller, two metal blades.
    prop = Part(name, 'prop', (0, -0.08, -2.35))
    for s in (-1, 1):
        blade(prop, (0, -0.08, -2.35), Vector((0, s, 0)), Vector((-s, 0, 0)), Vector((0, 0, 1)), 0.12, 0.965,
              lambda r: 0.15 - 0.05 * r, lambda r: 0.035 - 0.02 * r, lambda r: 0.65 - 0.4 * r, 'prop')
    parts.append(prop)
    return name, parts


def cessna_cockpit(name, F, hoop, zs, glass, parts):
    """The 172's cabin, after an N model's: the cabin lined to its skin with every window left open, the
    headliner under the wing's root, two seats ahead and a bench behind; the panel under its glareshield,
    the six flight instruments in front of the left seat over the tachometer, the engine gauges beside
    them and the radio stack in the middle, the switches, the throttle, mixture and carb heat along the
    bottom; a yoke for each seat, the pedals, the trim wheel and the fuel selector between the seats, and
    the wet compass on the windshield's centre strip. The pilot sits in the left seat."""
    cp = Part(name, 'cockpit')
    parts.append(cp)
    EYES[name] = (-0.27, 0.49, -0.12)
    deg = math.radians
    roof = 0.615            # the headliner, under the wing's root where it crosses the cabin

    # The lining: the skin's own rings at its stations `zs` from the firewall to the baggage bulkhead,
    # every window open and the roof above the headliner left bare.
    out = [hoop(z) for z in zs]
    ins = [hoop(z, 0.025) for z in zs]
    lining(cp, out, ins, lambda c, n: glass(c, n) or (c.y > roof and n.y > 0.3),
           lambda c, n: 'carpet' if n.y > 0.5 else 'trim')
    cp.decal(clip(ins[0], -1, 0.42), (0, 0, 1), 'carpet')
    cp.decal(clip(ins[-1], -1, roof), (0, 0, -1), 'trim')
    # The headliner, from the windshield's top to the bulkhead, wall to wall.
    front = -0.40
    i = max(k for k, z in enumerate(zs) if z <= front)
    t = (front - zs[i]) / (zs[i + 1] - zs[i])
    edge = [(front, across(ins[i], roof) * (1 - t) + across(ins[i + 1], roof) * t)] + [(z, across(r, roof)) for z, r in zip(zs, ins) if z > front]
    cp.decal([Vector((x, roof, z)) for z, x in edge] + [Vector((-x, roof, z)) for z, x in edge[::-1]], (0, -1, 0), 'headliner')
    along((-edge[0][1], roof - 0.018, front), (edge[0][1], roof - 0.018, front), (0.02, 0.012), 'trim', cp)
    # Sun visors, the dome light and the fresh-air vents in the headliner.
    for x in (-0.26, 0.26):
        box(cp, (x, roof - 0.023, -0.30), (0.15, 0.006, 0.075), 'headliner')
        knob(cp, (1.6 * x, roof, -0.20), (0, -1, 0), 0.022, 0.018, 'knob')
        knob(cp, (1.6 * x, roof - 0.018, -0.20), (0, -1, 0), 0.012, 0.012, 'steel')
    knob(cp, (0, roof, 0.35), (0, -1, 0), 0.05, 0.012, 'mark')

    # The windshield's centre strip down the glass, and the wet compass hung from it.
    strip = lambda z: (lambda cy, hw, hh, p: Vector((0, cy + hh - 0.035, z)))(*section_at(F, z))
    along(strip(-1.30), strip(-0.90), (0.012, 0.006), 'white', cp)
    along(strip(-0.90), strip(-0.42), (0.012, 0.006), 'white', cp)
    cm = strip(-0.70) - Vector((0, 0.05, 0))
    box(cp, cm, (0.035, 0.028, 0.03), 'knob')
    compass = Dial(name, cp, cm + Vector((0, -0.002, 0.03)), (0, 0, 1), 0.016, rim=0.004)
    compass.patch([(-0.0008, 0.016), (0.0008, 0.016), (0.0008, -0.016), (-0.0008, -0.016)], 'orange')
    card = compass.card(parts, 'card_compass')
    card.ticks([deg(a) for a in range(0, 360, 30)], 0.003, 0.0008, rho=0.0145)
    card.numbers([(deg(a), t) for a, t in ((0, 'N'), (90, 'E'), (180, 'S'), (270, 'W'))], 0.009, 0.004, radial=True)

    # The panel and the glareshield over it.
    zp = -0.85
    slab(cp, clip(hoop(zp - 0.02, 0.03), -0.12, 0.35), zp - 0.02, zp, 'panel')
    slab(cp, clip(hoop(-1.10, 0.03), 0.345, 0.378), -1.10, zp + 0.02, 'shield')
    n = (0, 0, 1)

    # The six: airspeed, attitude and height over turn, heading and climb.
    xs, top, low, r = (-0.405, -0.275, -0.145), 0.268, 0.172, 0.038
    kt = scale(40, 180, deg(-135), deg(135))
    asi = Dial(name, cp, (xs[0], top, zp), n, r)
    asi.arc(kt(40), kt(85), r - 0.011, 0.0025, 'mark')
    asi.arc(kt(44), kt(129), r - 0.0065, 0.003, 'arcgreen')
    asi.arc(kt(129), kt(163), r - 0.0065, 0.003, 'arcyellow')
    asi.ticks([kt(v) for v in range(40, 181, 10)], 0.005, 0.0011)
    asi.ticks([kt(v) for v in range(40, 181, 20)], 0.008, 0.0018)
    asi.ticks([kt(163)], 0.009, 0.0024, 'red')
    asi.numbers([(kt(v), str(v)) for v in range(40, 161, 20)], 0.021, 0.0042)
    asi.text('KNOTS', 0, -0.011, 0.0032)
    asi.needle(parts, 'needle_speed', kt(40), 0.030, width=0.0035)

    ai = Dial(name, cp, (xs[1], top, zp), n, r)
    ai.ticks([deg(a) for a in (-60, -30, 30, 60)], 0.007, 0.0016, rho=r - 0.001)
    ai.ticks([deg(a) for a in (-45, -20, -10, 10, 20, 45)], 0.004, 0.0012, rho=r - 0.001)
    ai.patch([(-0.0025, r - 0.001), (0.0025, r - 0.001), (0, r - 0.006)], 'orange')
    rc = r - 0.009
    card = ai.card(parts, 'card_attitude')
    card.patch([(rc * math.cos(t), rc * math.sin(t)) for t in np.linspace(0, math.pi, 13)], 'sky')
    card.patch([(rc * math.cos(t), rc * math.sin(t)) for t in np.linspace(math.pi, 2 * math.pi, 13)], 'earth')
    card.patch([(-rc, -0.0006), (rc, -0.0006), (rc, 0.0006), (-rc, 0.0006)], 'mark', above=0.001)
    for pitch, half in ((5, 0.004), (10, 0.008), (15, 0.004), (20, 0.007)):
        for s in (-1, 1):
            y = s * pitch * 0.0011
            card.patch([(-half, y - 0.0004), (half, y - 0.0004), (half, y + 0.0004), (-half, y + 0.0004)], 'mark', above=0.001)
    card.patch([(-0.002, rc - 0.0005), (0.002, rc - 0.0005), (0, rc - 0.005)], 'mark', above=0.001)
    plane_on = copy.copy(ai)
    plane_on.layer = card.layer + LIFT
    for s in (-1, 1):
        plane_on.patch([(s * 0.022, -0.0012), (s * 0.007, -0.0012), (s * 0.007, 0.0012), (s * 0.022, 0.0012)][::s], 'orange')
    plane_on.disc(0, 0, 0.0022, 'orange')

    ft = scale(0, 10, 0, deg(360))
    alt = Dial(name, cp, (xs[2], top, zp), n, r)
    alt.ticks([ft(v / 5) for v in range(50)], 0.004, 0.0009)
    alt.ticks([ft(v) for v in range(10)], 0.008, 0.0018)
    alt.numbers([(ft(v), str(v)) for v in range(10)], 0.024, 0.0055)
    alt.text('ALT', 0, 0.010, 0.0034)
    alt.patch([(0.009, -0.004), (0.020, -0.004), (0.020, 0.003), (0.009, 0.003)], 'knob')
    alt.needle(parts, 'needle_altitude', ft(0), 0.031, width=0.003)
    alt.needle(parts, 'needle_altitude_thousands', ft(0), 0.018, width=0.0055, above=0.001)

    tc = Dial(name, cp, (xs[0], low, zp), n, r)
    tc.ticks([deg(a) for a in (-90, 90)], 0.007, 0.0018)
    tc.ticks([deg(a) for a in (-110, 110)], 0.007, 0.0018)
    tc.text('L', -0.026, -0.016, 0.0045)
    tc.text('R', 0.026, -0.016, 0.0045)
    tc.text('2 MIN', 0, -0.012, 0.0028)
    tc.arc(deg(150), deg(210), 0.026, 0.0075, 'mark')
    turn = tc.card(parts, 'needle_turn')
    for s in (-1, 1):
        turn.patch([(s * 0.026, -0.0016), (s * 0.004, -0.0016), (s * 0.004, 0.0016), (s * 0.026, 0.0016)][::s], 'mark')
    turn.disc(0, 0, 0.004, 'mark')
    turn.patch([(-0.0012, 0.003), (0.0012, 0.003), (0.0012, 0.009), (-0.0012, 0.009)], 'mark')
    slip = tc.card(parts, 'needle_slip')
    slip.disc(0, -0.026, 0.0032, 'knob')

    hi = Dial(name, cp, (xs[1], low, zp), n, r)
    card = hi.card(parts, 'card_heading')
    card.ticks([deg(a) for a in range(0, 360, 5)], 0.003, 0.0008)
    card.ticks([deg(a) for a in range(0, 360, 10)], 0.005, 0.0012)
    card.numbers([(deg(a), t) for a, t in zip(range(0, 360, 30), ('N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'))],
                 0.024, 0.0048, radial=True)
    fixed = copy.copy(hi)
    fixed.layer = card.layer + LIFT
    fixed.patch([(-0.0025, r - 0.001), (0.0025, r - 0.001), (0, r - 0.007)], 'orange')
    fixed.patch([(-0.0011, -0.012), (0.0011, -0.012), (0.0011, 0.012), (-0.0011, 0.012)], 'orange')
    fixed.patch([(-0.010, 0.001), (0.010, 0.001), (0.010, 0.0032), (-0.010, 0.0032)], 'orange')
    fixed.patch([(-0.005, -0.010), (0.005, -0.010), (0.005, -0.0082), (-0.005, -0.0082)], 'orange')

    fpm = lambda v: deg(-90) + v / 2000 * deg(170)
    vsi = Dial(name, cp, (xs[2], low, zp), n, r)
    vsi.ticks([fpm(v) for v in range(-2000, 2001, 100)], 0.004, 0.0009)
    vsi.ticks([fpm(v) for v in range(-2000, 2001, 500)], 0.008, 0.0018)
    vsi.numbers([(fpm(v), str(abs(v) // 100)) for v in (-1500, -1000, -500, 0, 500, 1000, 1500)] + [(deg(90), '20')], 0.023, 0.0048)
    vsi.text('UP', -0.010, 0.010, 0.0032)
    vsi.text('DOWN', -0.009, -0.010, 0.0030)
    vsi.needle(parts, 'needle_climb', fpm(0), 0.030, width=0.0035)

    # The tachometer under them, the engine's four small gauges beside the six.
    rpm = scale(0, 35, deg(-135), deg(135))
    tach = Dial(name, cp, (xs[0], 0.072, zp), n, 0.034)
    tach.arc(rpm(21), rpm(27), 0.028, 0.003, 'arcgreen')
    tach.ticks([rpm(v) for v in range(36)], 0.004, 0.0009)
    tach.ticks([rpm(v) for v in range(0, 36, 5)], 0.007, 0.0016)
    tach.ticks([rpm(27)], 0.009, 0.0024, 'red')
    tach.numbers([(rpm(v), str(v)) for v in range(0, 36, 5)], 0.019, 0.0042)
    tach.text('RPM', 0, -0.010, 0.0030)
    tach.needle(parts, 'needle_rpm', rpm(0), 0.027, width=0.0032)
    small = scale(0, 1, deg(-60), deg(60))
    for (x, y), label, needle in (((-0.075, 0.262), 'L', 'needle_fuel_left'), ((-0.030, 0.262), 'R', 'needle_fuel_right'),
                                  ((-0.075, 0.212), 'T', 'needle_oil_temp'), ((-0.030, 0.212), 'P', 'needle_oil_press')):
        g = Dial(name, cp, (x, y, zp), n, 0.016, rim=0.004)
        g.arc(small(0.3), small(0.8), 0.012, 0.0025, 'arcgreen')
        g.ticks([small(v / 4) for v in range(5)], 0.004, 0.0009)
        g.text(label, 0, -0.007, 0.0040)
        g.needle(parts, needle, small(0), 0.013, width=0.0025)

    # The radio stack: the audio panel, two nav-coms, the ADF and the transponder, their windows lit.
    for y, half, windows in ((0.318, 0.014, ()), (0.270, 0.024, ((-0.045, 'lcd'), (0.020, 'lcd'))), (0.212, 0.024, ((-0.045, 'lcd'), (0.020, 'lcd'))),
                             (0.162, 0.018, ((-0.030, 'amber'),)), (0.118, 0.018, ((-0.030, 'amber'),))):
        box(cp, (0.125, y, zp + 0.008), (0.095, half, 0.016), 'radio')
        face = zp + 0.024
        for x, key in windows:
            cp.decal([Vector((0.125 + x + dx, y + dy, face + LIFT)) for dx, dy in ((-0.028, -half * 0.45), (0.028, -half * 0.45), (0.028, half * 0.45), (-0.028, half * 0.45))], n, key)
        if windows:
            knob(cp, (0.200, y, face), n, 0.011, 0.012, 'knob')
            knob(cp, (0.200, y, face + 0.012), n, 0.006, 0.008, 'knob')
        else:
            for k in range(8):
                box(cp, (0.055 + 0.019 * k, y, face), (0.006, 0.006, 0.005), 'mark')
    # The glove box, top right, and the circuit breakers along the bottom right.
    box(cp, (0.39, 0.255, zp), (0.085, 0.045, 0.009), 'radio')
    box(cp, (0.39, 0.225, zp + 0.009), (0.018, 0.004, 0.005), 'steel')
    for k in range(9):
        knob(cp, (0.215 + 0.028 * k, -0.075, zp), n, 0.006, 0.009, 'knob')

    # Along the bottom left: the master switch, the key, the primer and the light switches; then carb
    # heat, the throttle and the mixture, and the flap switch with its indicator.
    for x, key in ((-0.480, 'red'), (-0.459, 'red')):
        box(cp, (x, -0.05, zp), (0.007, 0.016, 0.012), key)
    knob(cp, (-0.40, -0.05, zp), n, 0.020, 0.008, 'steel')
    along((-0.40, -0.05, zp + 0.008), (-0.40, -0.05, zp + 0.030), (0.010, 0.002), 'steel', cp, up=(0, 1, 0))
    knob(cp, (-0.34, -0.05, zp), n, 0.004, 0.030, 'steel')
    knob(cp, (-0.34, -0.05, zp + 0.026), n, 0.012, 0.012, 'knob')
    for k in range(5):
        box(cp, (-0.295 + 0.028 * k, -0.05, zp), (0.007, 0.014, 0.011), 'knob')
    for x, r_, key in ((-0.085, 0.013, 'knob'), (0.045, 0.016, 'red')):
        knob(cp, (x, -0.055, zp), n, 0.004, 0.045, 'steel')
        knob(cp, (x, -0.055, zp + 0.040), n, r_, 0.016, key)
    throttle = Part(name, 'throttle', (-0.02, -0.055, zp))
    knob(throttle, (-0.02, -0.055, zp), n, 0.005, 0.050, 'steel')
    knob(throttle, (-0.02, -0.055, zp + 0.045), n, 0.019, 0.020, 'knob')
    parts.append(throttle)
    box(cp, (0.125, -0.035, zp), (0.008, 0.035, 0.008), 'knob')
    lever = Part(name, 'lever_flaps', (0.125, 0.0, zp + 0.008))
    along((0.125, -0.005, zp + 0.004), (0.125, -0.005, zp + 0.040), (0.004, 0.004), 'steel', lever)
    box(lever, (0.125, -0.005, zp + 0.040), (0.016, 0.010, 0.007), 'mark')
    parts.append(lever)
    for k, label in enumerate(('0', '10', '20', '30')):
        y = -0.004 - 0.022 * k
        cp.decal([Vector((0.145, y - 0.0008, zp + LIFT)), Vector((0.155, y - 0.0008, zp + LIFT)), Vector((0.155, y + 0.0008, zp + LIFT)),
                  Vector((0.145, y + 0.0008, zp + LIFT))], n, 'mark')
        words(cp, label, (0.166, y, zp + LIFT), n, (0, 1, 0), 0.0045, 'mark')

    # The yokes, each on its shaft out of the panel: a hub and two horns.
    for side, x in (('left', -0.27), ('right', 0.27)):
        at = Vector((x, 0.06, zp))
        yoke = Part(name, f'yoke_{side}', at)
        hub = at + Vector((0, 0, 0.21))
        along(at - Vector((0, 0, 0.012)), hub, (0.011, 0.011), 'steel', yoke)
        box(yoke, hub + Vector((0, 0, 0.012)), (0.040, 0.030, 0.022), 'knob')
        for s in (-1, 1):
            elbow = hub + Vector((s * 0.12, 0.025, 0.012))
            along(hub + Vector((s * 0.030, 0.0, 0.012)), elbow, (0.013, 0.013), 'knob', yoke)
            along(elbow + Vector((0, -0.012, 0)), elbow + Vector((s * 0.018, 0.10, 0)), (0.015, 0.017), 'knob', yoke, up=(0, 0, 1))
        words(yoke, 'CESSNA', hub + Vector((0, 0, 0.034 + LIFT)), n, (0, 1, 0), 0.007, 'mark')
        parts.append(yoke)

    # The pedals, a pair for each seat, on one bar across the floor ahead.
    floor = lambda z: (lambda cy, hw, hh, p: cy - hh + 0.025)(*section_at(F, z))
    pz = -1.22
    pedals = Part(name, 'pedals', (0, floor(pz) + 0.03, pz))
    along((-0.42, floor(pz) + 0.03, pz), (0.42, floor(pz) + 0.03, pz), (0.010, 0.010), 'steel', pedals)
    tilt = 0.40
    for x in (-0.36, -0.18, 0.18, 0.36):
        foot = Vector((x, floor(pz) + 0.15, pz + 0.04))
        along((x, floor(pz) + 0.03, pz), foot, (0.008, 0.008), 'steel', pedals, up=(1, 0, 0))
        box(pedals, foot + Vector((0, 0.02, 0.012)), (0.035, 0.065, 0.007), 'knob', ((1, 0, 0), (0, math.cos(tilt), math.sin(tilt)), (0, -math.sin(tilt), math.cos(tilt))))
    parts.append(pedals)

    # Under the panel's middle, the pedestal with the trim wheel; on the floor between the seats, the fuel
    # selector.
    box(cp, (0, floor(-0.88) + 0.175, -0.88), (0.055, 0.17, 0.035), 'panel')
    cp.lathe(Vector((0, floor(-0.88) + 0.16, -0.845)), Vector((1, 0, 0)), [(0.055, -0.007), (0.055, 0.007)], 'knob', segs=16)
    for k in range(6):
        a = deg(30 * k)
        c = Vector((0, floor(-0.88) + 0.16 + 0.055 * math.sin(a), -0.845 + 0.055 * math.cos(a)))
        box(cp, c, (0.010, 0.005, 0.005), 'knob', ((1, 0, 0), (0, math.cos(a), -math.sin(a)), (0, math.sin(a), math.cos(a))))
    knob(cp, (0, floor(-0.45), -0.45), (0, 1, 0), 0.05, 0.010, 'knob')
    along((-0.04, floor(-0.45) + 0.015, -0.45), (0.04, floor(-0.45) + 0.015, -0.45), (0.010, 0.010), 'red', cp)

    # The seats: two ahead on their rails, a bench behind; each back leans aft.
    lean = 0.22
    back_axes = ((1, 0, 0), (0, math.cos(lean), math.sin(lean)), (0, -math.sin(lean), math.cos(lean)))
    def seat(x, half, cz, back_z, rails=True):
        fl = floor(cz)
        box(cp, (x, fl + 0.23, cz), (half, 0.055, 0.22), 'seat')
        box(cp, (x, fl + 0.24 + 0.33, back_z), (half - 0.01, 0.33, 0.05), 'seat', back_axes)
        if rails:
            for s in (-1, 1):
                along((x + s * 0.14, fl - 0.015, cz), (x + s * 0.14, fl + 0.18, cz), (0.012, 0.012), 'steel', cp)
                along((x + s * 0.14, fl + 0.017, cz - 0.20), (x + s * 0.14, fl + 0.017, cz + 0.20), (0.018, 0.012), 'steel', cp)
    for x in (-0.27, 0.27):
        seat(x, 0.20, -0.27, 0.0)
        box(cp, (x, floor(-0.27) + 0.98, 0.10), (0.10, 0.065, 0.04), 'seat', back_axes)
    seat(0, 0.46, 0.62, 0.92, rails=False)
    # The doors' armrests and handles.
    for s in (-1, 1):
        wall = across(hoop(0.10, 0.025), 0.0)
        # The armrest stands into the door 1 cm, so its back is no face on the lining's.
        box(cp, (s * (wall - 0.025), 0.0, 0.08), (0.035, 0.025, 0.18), 'seat')
        along((s * (wall - 0.012), 0.10, -0.22), (s * (wall - 0.012), 0.10, -0.12), (0.010, 0.008), 'steel', cp)


# ------------------------------------------------------------------ the trainer

def trainer_cockpit(name, F, hoop, zs, canopy, cut, parts):
    """The trainer's two cockpits, after a Hawk T1's: the student ahead and the instructor behind, a step
    higher. Each sits on an ejection seat, its yellow handle between the knees, a stick ahead, the throttle
    on the left console and switch panels on both; the front panel holds the attitude and heading
    instruments in the middle, airspeed and height either side, the engine's gauges below, the gear lever
    and its lights on the left and the warning panel on the right, under a coaming that carries the head-up
    display's combiner in the pilot's line of sight. The windscreen's arch and the arch between the two
    cockpits frame the canopy, and a rail runs along each sill."""
    cp = Part(name, 'cockpit')
    parts.append(cp)
    EYES[name] = (0.0, 0.82, -2.36)
    deg = math.radians
    n = (0, 0, 1)
    floor = lambda z: (lambda cy, hw, hh, p: cy - hh + 0.03)(*section_at(F, z))
    skin_y = lambda z, x: (lambda cy, hw, hh, p: cy + hh * max(0.0, 1 - abs(x / hw) ** p) ** (1 / p))(*section_at(F, z))

    # The tub from the front bulkhead to the back of the rear cockpit, on the skin's own rings at its
    # stations `zs` and 3 cm inside them, open overhead.
    out, ins = [hoop(z) for z in zs], [hoop(z, 0.03) for z in zs]
    lining(cp, out, ins, lambda c, n_: n_.y > 0.5, 'tub')
    cp.decal(clip(ins[0], -1, 0.42), n, 'tub')
    cp.decal(clip(ins[-1], -1, 0.50), (0, 0, -1), 'tub')
    # The sill rails along the cut, one bar each through every station, the windscreen's arch and the
    # arch between the cockpits.
    for s in (-1, 1):
        rail(cp, [Vector((s * (cut(z) + 0.012), skin_y(z, cut(z) + 0.012) + 0.008, z)) for z in zs], (0.018, 0.014), 'frame')
    for z in (-3.00, -2.05):
        cy, hw, hh = canopy(z)
        arc = [p for p in superellipse(0, cy, hw - 0.025, hh - 0.025, 2.2, z, n=32) if p.y > cy - 0.02]
        arc.sort(key=lambda p: p.x)
        rings = []
        for p in arc:
            out = (p - Vector((0, cy, z))).normalized()
            rings.append([p + out * (0.016 * a) + Vector((0, 0, 0.022 * b)) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        cp.loft(rings, 'frame')

    def panel(zp, lo, hi, half):
        """A panel facing aft at zp: the tub's section from `lo` up, and over the fuselage's top a band
        `half` either side up to `hi`, under a coaming."""
        ring = hoop(zp - 0.02, 0.035)
        top = max(p.y for p in ring) - 0.01
        low = clip(ring, lo, top)
        right = [p for p in low if p.x > 0.0005]
        left = [p for p in low if p.x < -0.0005]
        bottom = [p for p in low if abs(p.x) <= 0.0005]
        # Round from the bottom: up the right side, across the top band, down the left.
        right.sort(key=lambda p: p.y)
        left.sort(key=lambda p: -p.y)
        poly = bottom[:1] + right + [Vector((half, hi, 0)), Vector((-half, hi, 0))] + left
        slab(cp, poly, zp - 0.02, zp, 'console')
        box(cp, (0, hi + 0.02, zp - 0.07), (half + 0.02, 0.015, 0.09), 'shield')

    # ---- the front cockpit
    zp = -3.12
    panel(zp, -0.02, 0.58, 0.22)
    knots = scale(0, 600, deg(-150), deg(150))
    asi = Dial(name, cp, (-0.125, 0.47, zp), n, 0.034)
    asi.ticks([knots(v) for v in range(0, 601, 25)], 0.004, 0.0009)
    asi.ticks([knots(v) for v in range(0, 601, 100)], 0.007, 0.0018)
    asi.numbers([(knots(v), str(v // 100)) for v in range(100, 601, 100)], 0.022, 0.0050)
    asi.text('KNOTS', 0, -0.011, 0.0030)
    asi.text('x100', 0, 0.010, 0.0028)
    asi.needle(parts, 'needle_speed', knots(0), 0.028, width=0.0032)
    adi = Dial(name, cp, (0, 0.462, zp), n, 0.046)
    adi.ticks([deg(a) for a in (-60, -30, 30, 60)], 0.007, 0.0016, rho=0.045)
    adi.ticks([deg(a) for a in (-45, -20, -10, 10, 20, 45)], 0.004, 0.0012, rho=0.045)
    rc = 0.036
    card = adi.card(parts, 'card_attitude')
    card.patch([(rc * math.cos(t), rc * math.sin(t)) for t in np.linspace(0, math.pi, 13)], 'sky')
    card.patch([(rc * math.cos(t), rc * math.sin(t)) for t in np.linspace(math.pi, 2 * math.pi, 13)], 'earth')
    card.patch([(-rc, -0.0006), (rc, -0.0006), (rc, 0.0006), (-rc, 0.0006)], 'mark', above=0.001)
    for pitch, half in ((10, 0.009), (20, 0.007), (30, 0.005)):
        for s in (-1, 1):
            y = s * pitch * 0.0009
            card.patch([(-half, y - 0.0004), (half, y - 0.0004), (half, y + 0.0004), (-half, y + 0.0004)], 'mark', above=0.001)
    fixed = copy.copy(adi)
    fixed.layer = card.layer + LIFT
    for s in (-1, 1):
        fixed.patch([(s * 0.026, -0.0013), (s * 0.008, -0.0013), (s * 0.008, 0.0013), (s * 0.026, 0.0013)][::s], 'orange')
    fixed.disc(0, 0, 0.0025, 'orange')
    ft = scale(0, 10, 0, deg(360))
    alt = Dial(name, cp, (0.125, 0.47, zp), n, 0.034)
    alt.ticks([ft(v / 5) for v in range(50)], 0.004, 0.0009)
    alt.ticks([ft(v) for v in range(10)], 0.007, 0.0018)
    alt.numbers([(ft(v), str(v)) for v in range(10)], 0.022, 0.0050)
    alt.text('ALT', 0, 0.009, 0.0030)
    alt.needle(parts, 'needle_altitude', ft(0), 0.028, width=0.003)
    alt.needle(parts, 'needle_altitude_thousands', ft(0), 0.016, width=0.005, above=0.001)
    hsi = Dial(name, cp, (0, 0.345, zp), n, 0.046)
    card = hsi.card(parts, 'card_heading')
    card.ticks([deg(a) for a in range(0, 360, 5)], 0.003, 0.0008)
    card.ticks([deg(a) for a in range(0, 360, 10)], 0.005, 0.0012)
    card.numbers([(deg(a), t) for a, t in zip(range(0, 360, 30), ('N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'))],
                 0.031, 0.0055, radial=True)
    course = hsi.card(parts, 'needle_course')
    course.layer = card.layer + LIFT
    course.patch([(-0.0012, -0.024), (0.0012, -0.024), (0.0012, 0.020), (-0.0012, 0.020)], 'yellow')
    course.patch([(-0.004, 0.019), (0.004, 0.019), (0, 0.026)], 'yellow')
    fixed = copy.copy(hsi)
    fixed.layer = course.layer + LIFT
    fixed.patch([(-0.003, 0.045), (0.003, 0.045), (0, 0.038)], 'orange')
    fixed.patch([(-0.010, 0.0), (0.010, 0.0), (0.010, 0.0022), (-0.010, 0.0022)], 'orange')
    fixed.patch([(-0.0012, -0.008), (0.0012, -0.008), (0.0012, 0.008), (-0.0012, 0.008)], 'orange')
    g = scale(-4, 10, deg(-135), deg(135))
    acc = Dial(name, cp, (-0.125, 0.35, zp), n, 0.030)
    acc.arc(g(7.5), g(10), 0.025, 0.003, 'lampred')
    acc.ticks([g(v) for v in range(-4, 11)], 0.005, 0.0012)
    acc.numbers([(g(v), str(v)) for v in (-4, -2, 0, 2, 4, 6, 8, 10)], 0.018, 0.0040)
    acc.text('G', 0, -0.010, 0.0040)
    acc.needle(parts, 'needle_g', g(1), 0.024, width=0.003)
    fpm = lambda v: deg(-90) + v / 6000 * deg(170)
    vsi = Dial(name, cp, (0.125, 0.35, zp), n, 0.030)
    vsi.ticks([fpm(v) for v in range(-6000, 6001, 500)], 0.004, 0.0009)
    vsi.ticks([fpm(v) for v in range(-6000, 6001, 2000)], 0.007, 0.0016)
    vsi.numbers([(fpm(v), str(abs(v) // 1000)) for v in (-4000, -2000, 0, 2000, 4000)] + [(deg(90), '6')], 0.019, 0.0042)
    vsi.text('UP', -0.008, 0.009, 0.0030)
    vsi.text('DN', -0.008, -0.009, 0.0030)
    vsi.needle(parts, 'needle_climb', fpm(0), 0.024, width=0.003)
    pct = scale(0, 110, deg(-135), deg(135))
    rpm = Dial(name, cp, (0.125, 0.245, zp), n, 0.028)
    rpm.arc(pct(55), pct(100), 0.023, 0.003, 'lampgreen')
    rpm.ticks([pct(v) for v in range(0, 111, 10)], 0.005, 0.0012)
    rpm.numbers([(pct(v), str(v // 10)) for v in range(0, 111, 20)], 0.016, 0.0040)
    rpm.text('RPM', 0, -0.009, 0.0030)
    rpm.needle(parts, 'needle_rpm', pct(0), 0.022, width=0.003)
    temp = scale(0, 800, deg(-135), deg(135))
    jpt = Dial(name, cp, (0.205, 0.245, zp), n, 0.024)
    jpt.ticks([temp(v) for v in range(0, 801, 100)], 0.004, 0.0011)
    jpt.ticks([temp(700)], 0.007, 0.0020, 'lampred')
    jpt.text('JPT', 0, -0.008, 0.0030)
    jpt.needle(parts, 'needle_jpt', temp(0), 0.019, width=0.0026)
    kg = scale(0, 1600, deg(-135), deg(135))
    fuel = Dial(name, cp, (-0.125, 0.245, zp), n, 0.028)
    fuel.ticks([kg(v) for v in range(0, 1601, 200)], 0.005, 0.0012)
    fuel.numbers([(kg(v), str(v // 100)) for v in range(0, 1601, 400)], 0.016, 0.0040)
    fuel.text('FUEL', 0, -0.009, 0.0028)
    fuel.needle(parts, 'needle_fuel', kg(0), 0.022, width=0.003)
    # The warning panel on the right, a few of its captions lit, and the gear lever with its three lights
    # on the left.
    for i in range(4):
        for j in range(3):
            key = 'lampamber' if (i, j) == (1, 2) else ('lampred' if (i, j) == (0, 0) else 'lampoff')
            box(cp, (0.27 + 0.034 * j, 0.40 - 0.022 * i, zp), (0.014, 0.008, 0.006), key)
    for k, x in enumerate((-0.33, -0.30, -0.27)):
        box(cp, (x, 0.36 if k != 1 else 0.375, zp), (0.009, 0.009, 0.006), 'lampgreen')
    box(cp, (-0.30, 0.24, zp), (0.012, 0.055, 0.008), 'knob')
    gear = Part(name, 'lever_gear', (-0.30, 0.22, zp + 0.008))
    along((-0.30, 0.22, zp + 0.004), (-0.30, 0.27, zp + 0.06), (0.004, 0.004), 'steel', gear)
    gear.lathe(Vector((-0.30, 0.27, zp + 0.06)), Vector((0, 0, 1)), [(0.016, -0.006), (0.016, 0.006)], 'mark', segs=12)
    parts.append(gear)
    # The coaming's head-up display: its box, and the two panes of its combiner on posts, in the eye's
    # line through the windscreen.
    box(cp, (0, 0.63, -3.10), (0.07, 0.03, 0.06), 'knob')
    for dz in (0.0, 0.016):
        lo, hi = Vector((0, 0.66, -3.09 + dz)), Vector((0, 0.83, -3.05 + dz))
        x = Vector((0.078, 0, 0))
        cp.decal([lo - x, lo + x, hi + x, hi - x], (0, 0.24, 1), 'hud')
    for s in (-1, 1):
        along((s * 0.080, 0.64, -3.09), (s * 0.080, 0.835, -3.04), (0.005, 0.006), 'frame', cp, up=(0, 0, 1))

    def station(sfx, zseat, lift, zstick, zpedal):
        """A seat, its stick, pedals, consoles and throttle, `lift` up the tub."""
        fl = floor(zseat)
        lean = 0.18
        tilt = ((1, 0, 0), (0, math.cos(lean), math.sin(lean)), (0, -math.sin(lean), math.cos(lean)))
        box(cp, (0, fl + 0.585 + lift, zseat), (0.20, 0.045, 0.19), 'seatpad')
        box(cp, (0, fl + 0.97 + lift, zseat + 0.24), (0.195, 0.34, 0.05), 'seatpad', tilt)
        box(cp, (0, fl + 1.415 + lift, zseat + 0.33), (0.17, 0.10, 0.07), 'seatframe')
        legs = (fl - 0.01, fl + 0.56 + lift)
        for s in (-1, 1):
            box(cp, (s * 0.222, fl + 0.65 + lift, zseat + 0.10), (0.015, 0.42, 0.18), 'seatframe')
            box(cp, (s * 0.13, sum(legs) / 2, zseat), (0.012, (legs[1] - legs[0]) / 2, 0.012), 'seatframe')
            along((s * 0.035, fl + 0.615 + lift, zseat - 0.205), (s * 0.035, fl + 0.69 + lift, zseat - 0.205), (0.007, 0.007), 'yellow', cp)
        along((-0.048, fl + 0.69 + lift, zseat - 0.205), (0.048, fl + 0.69 + lift, zseat - 0.205), (0.012, 0.007), 'yellow', cp)
        # The stick on its pivot in the floor.
        pivot = Vector((0, floor(zstick) + 0.02, zstick))
        stick = Part(name, 'stick' + sfx, pivot)
        grip = Vector((0, floor(zstick) + 0.66 + lift, zstick + 0.04))
        along(pivot, grip, (0.013, 0.013), 'knob', stick, up=(0, 0, 1))
        box(stick, grip + Vector((0, 0.05, 0)), (0.022, 0.055, 0.028), 'knob')
        knob(stick, grip + Vector((0, 0.105, 0)), (0, 1, 0), 0.007, 0.008, 'mark')
        box(stick, grip + Vector((0, 0.06, -0.034)), (0.006, 0.012, 0.012), 'lampred')
        parts.append(stick)
        # The pedals ahead, on their bar.
        bar = Vector((0, floor(zpedal) + 0.05, zpedal))
        pedals = Part(name, 'pedals' + sfx, bar)
        along(bar - Vector((0.20, 0, 0)), bar + Vector((0.20, 0, 0)), (0.010, 0.010), 'steel', pedals)
        for s in (-1, 1):
            box(pedals, bar + Vector((s * 0.13, 0.08, 0.016)), (0.04, 0.07, 0.006), 'knob', ((1, 0, 0), (0, 0.94, 0.34), (0, -0.34, 0.94)))
        parts.append(pedals)
        # The consoles either side, the throttle quadrant on the left one and switches on both.
        for s in (-1, 1):
            top = floor(zseat) + 0.47 + lift
            box(cp, (s * 0.37, top - 0.10, zseat - 0.20), (0.065, 0.10, 0.30), 'console')
            for k in range(5):
                toggle(cp, (s * 0.37 + 0.02 * (k % 2), top, zseat - 0.38 + 0.05 * k), (0, 1, 0), (0, 0, -1), 'knob', 'steel', length=0.018)
        top = floor(zseat) + 0.47 + lift
        box(cp, (-0.37, top + 0.012, zseat - 0.10), (0.03, 0.016, 0.12), 'knob')
        throttle = Part(name, 'throttle' + sfx, (-0.37, top + 0.02, zseat - 0.10))
        along((-0.37, top + 0.02, zseat - 0.10), (-0.37, top + 0.12, zseat - 0.16), (0.006, 0.008), 'steel', throttle)
        box(throttle, (-0.37, top + 0.13, zseat - 0.165), (0.016, 0.03, 0.022), 'knob')
        parts.append(throttle)

    station('', -2.48, 0.0, -2.80, -3.22)

    # ---- the rear cockpit: its panel on the back of the front seat's bay, a step up.
    zr = -2.02
    panel(zr, 0.10, 0.66, 0.22)
    asi = Dial(name, cp, (-0.12, 0.56, zr), n, 0.032)
    asi.ticks([knots(v) for v in range(0, 601, 100)], 0.006, 0.0016)
    asi.numbers([(knots(v), str(v // 100)) for v in range(100, 601, 100)], 0.020, 0.0045)
    asi.needle(parts, 'needle_speed_rear', knots(0), 0.026, width=0.003)
    adi = Dial(name, cp, (0, 0.55, zr), n, 0.042)
    card = adi.card(parts, 'card_attitude_rear')
    rc = 0.033
    card.patch([(rc * math.cos(t), rc * math.sin(t)) for t in np.linspace(0, math.pi, 13)], 'sky')
    card.patch([(rc * math.cos(t), rc * math.sin(t)) for t in np.linspace(math.pi, 2 * math.pi, 13)], 'earth')
    card.patch([(-rc, -0.0006), (rc, -0.0006), (rc, 0.0006), (-rc, 0.0006)], 'mark', above=0.001)
    fixed = copy.copy(adi)
    fixed.layer = card.layer + LIFT
    for s in (-1, 1):
        fixed.patch([(s * 0.024, -0.0013), (s * 0.008, -0.0013), (s * 0.008, 0.0013), (s * 0.024, 0.0013)][::s], 'orange')
    alt = Dial(name, cp, (0.12, 0.56, zr), n, 0.032)
    alt.ticks([ft(v) for v in range(10)], 0.006, 0.0016)
    alt.numbers([(ft(v), str(v)) for v in range(10)], 0.021, 0.0045)
    alt.needle(parts, 'needle_altitude_rear', ft(0), 0.026, width=0.003)
    hsi = Dial(name, cp, (0, 0.44, zr), n, 0.042)
    card = hsi.card(parts, 'card_heading_rear')
    card.ticks([deg(a) for a in range(0, 360, 10)], 0.004, 0.0010)
    card.numbers([(deg(a), t) for a, t in ((0, 'N'), (90, 'E'), (180, 'S'), (270, 'W'))], 0.028, 0.0055, radial=True)
    station('_rear', -1.38, 0.13, -1.70, -2.00)


def trainer():
    name = 'trainer'
    spec = PLANES[name]
    span = spec['airframe']['span']
    for key, col, rough, metal, alpha in [
        ('red', (0.72, 0.04, 0.03), 0.3, 0, 1), ('white', (0.88, 0.88, 0.86), 0.35, 0, 1),
        ('black', (0.03, 0.03, 0.03), 0.6, 0, 1), ('glass', (0.25, 0.3, 0.32), 0.05, 0.2, 0.2),
        ('intake', (0.02, 0.02, 0.02), 0.9, 0, 1), ('nozzle', (0.18, 0.17, 0.16), 0.5, 0.8, 1),
        ('rubber', (0.04, 0.04, 0.04), 0.9, 0, 1), ('steel', (0.55, 0.56, 0.58), 0.4, 0.8, 1),
        ('seat', (0.08, 0.08, 0.08), 0.8, 0, 1),
        ('tub', (0.17, 0.18, 0.19), 0.8, 0.1, 1), ('console', (0.08, 0.08, 0.09), 0.7, 0.2, 1),
        ('shield', (0.025, 0.025, 0.028), 0.9, 0, 1), ('frame', (0.12, 0.12, 0.13), 0.5, 0.6, 1),
        ('dial', (0.02, 0.02, 0.025), 0.6, 0, 1), ('mark', (0.92, 0.92, 0.90), 0.5, 0, 1),
        ('needle', (0.95, 0.95, 0.93), 0.4, 0, 1), ('bezel', (0.06, 0.06, 0.065), 0.4, 0.5, 1),
        ('sky', (0.12, 0.38, 0.78), 0.5, 0, 1), ('earth', (0.40, 0.23, 0.10), 0.6, 0, 1),
        ('orange', (0.95, 0.48, 0.05), 0.5, 0, 1), ('yellow', (0.92, 0.72, 0.05), 0.5, 0, 1),
        ('seatframe', (0.20, 0.21, 0.19), 0.6, 0.4, 1), ('seatpad', (0.11, 0.14, 0.10), 0.9, 0, 1),
        ('knob', (0.03, 0.03, 0.03), 0.5, 0.2, 1), ('lampoff', (0.16, 0.13, 0.08), 0.4, 0, 1),
    ]:
        paint(name, key, col, rough, metal, alpha)
    paint(name, 'lampgreen', (0.20, 1.0, 0.30), 0.4, 0, 1, glow=2.5)
    paint(name, 'lampamber', (1.0, 0.55, 0.08), 0.4, 0, 1, glow=2.5)
    paint(name, 'lampred', (1.0, 0.10, 0.06), 0.4, 0, 1, glow=2.5)
    paint(name, 'hud', (0.55, 0.85, 0.65), 0.05, 0.3, 0.25)
    body = Part(name, 'body')
    parts = [body]
    livery = lambda c, n: 'white' if n.y < -0.3 else 'red'
    # The fuselage drops to 0.5 m under the canopy, and is open there: the cut follows the canopy's taper
    # nine tenths of its width out, along the third point either side of the top of every ring, stood
    # there; the sills either side of it are dark, out to the fourth point, stood 10 cm further out, and
    # ahead of them the black anti-glare panel, out to the same point, narrowing from the sills' width at
    # the windscreen to 3 cm across 1.3 m ahead. The white belly runs up to the tenth point up from the
    # bottom of every ring, stood 0.40 of the half height under its middle (where the skin turns 0.3 of
    # the way to facing down). The lining's stations inside it are the loft's.
    SILL, BELLY = 0.10, -0.40
    glare = lambda z: 0.03 + (cut(-3.30) + SILL - 0.03) * math.sin(math.pi / 2 * (z + 4.6) / 1.3) if -4.6 <= z <= -3.30 else None
    dark = lambda z: cut(z) + SILL if cut(z) else glare(z)

    def skin(c, n):
        if -4.6 < c.z < -0.90 and c.y > 0 and abs(c.x) < dark(c.z):
            return 'seat' if c.z > -3.30 else 'black'
        cy, hw, hh, p = section_at(F, c.z)
        return 'white' if (c.y - cy) / hh < BELLY else 'red'
    F = [(-5.40, -0.20, 0.03, 0.03, 2.0), (-4.80, -0.15, 0.25, 0.25, 2.0), (-4.00, -0.08, 0.42, 0.45, 2.2),
         (-3.30, -0.05, 0.50, 0.53, 2.5), (-1.80, -0.04, 0.55, 0.55, 2.6), (-0.60, -0.02, 0.75, 0.62, 2.8),
         (0.80, 0.00, 0.78, 0.66, 3.0), (2.50, 0.05, 0.62, 0.58, 2.6), (4.20, 0.12, 0.45, 0.45, 2.3), (5.50, 0.15, 0.33, 0.33, 2.0)]
    C = [(-3.45, 0.46, 0.30, 0.05), (-3.00, 0.55, 0.40, 0.38), (-2.00, 0.60, 0.44, 0.43), (-1.30, 0.56, 0.42, 0.40), (-0.85, 0.50, 0.30, 0.18)]
    canopy = Fair(C)
    cut = lambda z: 0.9 * canopy(z)[1] if -3.30 <= z <= -0.90 else None
    N = 48

    def hoop(z, inset=0.0):
        cy, hw, hh, p = section_at(F, z)
        pins = [(10, at_y(BELLY, p)), (N // 2 - 4, at_x(dark(z) / hw, p) if dark(z) else None),
                (N // 2 - 3, at_x(cut(z) / hw, p) if cut(z) else None)]
        return superellipse(0, cy, hw - inset, hh - inset, p, z, n=N, pins=pins)
    hole = lambda c, n: -3.30 < c.z < -0.90 and n.y > 0.3 and abs(c.x) < cut(c.z)
    Z = body_stations(F, (-3.00, -2.40, -1.30, -0.90))
    body.loft([hoop(z) for z in Z], skin, keep=lambda c, n: not hole(c, n))
    # The tandem canopy over the two cockpits, faired through its sections: only what stands above the
    # fuselage's skin, so none of it crosses the cockpits under the sills.
    shape = lambda z, n=16: superellipse(0, *canopy(z), 2.2, z, n=n)
    above = lambda c: (lambda cy, hw, hh, p: abs(c.x) >= hw or c.y > cy + hh * (1 - abs(c.x / hw) ** p) ** (1 / p))(*section_at(F, c.z))
    body.loft([shape(z, segs_for(max(c[2] for c in C))) for z in stations(shape, canopy.z)], 'glass', keep=lambda c, n: above(c))
    trainer_cockpit(name, F, hoop, [z for z in Z if -3.30 <= z <= -0.90], canopy, cut, parts)
    # The intakes either side of the cockpit, dark inside, and the jet pipe.
    for s in (-1, 1):
        intake = Fair([(-1.60, s * 0.66, 0.16, 0.28), (-1.30, s * 0.68, 0.19, 0.31), (-0.50, s * 0.62, 0.18, 0.30)])
        shape = lambda z, n=16, intake=intake: (lambda cx, hw, hh: superellipse(cx, -0.05, hw, hh, 2.6, z, n=n))(*intake(z))
        body.loft([shape(z, segs_for(0.31)) for z in stations(shape, intake.z)], lambda c, n: 'intake' if n.z < -0.9 else livery(c, n))
    body.lathe((0, 0.15, 5.50), (0, 0, 1), [(0.0, -0.3), (0.33, -0.3), (0.31, 0.12), (0.26, 0.25), (0.20, 0.22), (0.0, 0.22)], lambda c, n: 'intake' if n.z > 0.9 else 'nozzle', caps=(False, False))

    # The wing: low, swept 26° at the leading edge, 2° of dihedral, ailerons outboard.
    f = foil(0.10, 0.01, 0.4)
    dih = math.radians(2)
    half = span / 2
    sweep = math.tan(math.radians(26))
    for side in (-1, 1):
        w = Surface(lambda s, side=side: Vector((side * s, -0.42 + s * math.tan(dih), -1.20 + s * sweep)),
                    lambda s: 2.67 + (0.88 - 2.67) * s / half, lambda s: Vector((0, 0, 1)),
                    lambda s, side=side: Vector((-side * math.sin(dih), math.cos(dih), 0)), f)
        lr = 'left' if side < 0 else 'right'
        lifting(name, body, w, [0.5, 1.6, 3.1, half - 0.2, half], [(3.1, half - 0.2, f'aileron_{lr}')], 0.75, livery, parts)

    # The tail: the all-moving tailplane on its pivot, the swept fin and its rudder.
    tf = foil(0.08, 0, 0.4)
    an = math.radians(10)
    stab = Part(name, 'elevator', (0, -0.05, 4.55))
    for side in (-1, 1):
        t = Surface(lambda s, side=side: Vector((side * s, -0.05 - (s - 0.30) * math.tan(an), 4.00 + s * math.tan(math.radians(30)))),
                    lambda s: 1.60 + (0.70 - 1.60) * (s - 0.30) / 1.90, lambda s: Vector((0, 0, 1)),
                    lambda s, side=side: Vector((side * math.sin(an), math.cos(an), 0)), tf)
        panel(stab, t, [0.30, 1.2, 2.20], 0, 1, livery)
    stab.tube((-0.35, -0.05, 4.55), (0.35, -0.05, 4.55), 0.04, None, 'steel')
    parts.append(stab)
    fin = Surface(lambda s: Vector((0, s, 3.40 + (s - 0.40) * math.tan(math.radians(40)))), lambda s: 2.40 + (0.90 - 2.40) * (s - 0.40) / 1.72,
                  lambda s: Vector((0, 0, 1)), lambda s: Vector((1, 0, 0)), tf)
    lifting(name, body, fin, [0.40, 0.45, 1.55, 2.12], [(0.45, 1.55, 'rudder')], 0.70, lambda c, n: 'white' if 1.7 < c.y else 'red', parts, axis='y')
    # The ventral airbrake, hinged at its front under the rear fuselage, its top 6 mm under the belly as
    # the belly rises from 0.584 m down at its hinge to 0.483 m at its back.
    ab = Part(name, 'airbrake', (0, -0.58, 1.80))
    ab.loft([[Vector((x, -0.58 + rise + y, 1.80 + z)) for x, y in ((-0.35, -0.01), (0.35, -0.01), (0.35, -0.05), (-0.35, -0.05))]
             for z, rise in ((0.02, 0.0), (1.10, 0.10))], 'white')
    parts.append(ab)

    # The gear, each leg a node gear_<n> on its hinge at its top, folding up about its local X: the nose leg
    # forward, the main legs inward under the wing roots. The nose fork on its steer node and every wheel
    # ride on their leg.
    for i, w in enumerate(spec['gear']['wheels']):
        x, y, z = w['at']
        if w['steer']:
            top = (0, -0.55, z - 0.08)
            leg = Part(name, f'gear_{i}', top, x=(1, 0, 0), y=(0, 1, 0))
            leg.tube(top, (0, y + 0.32, z), 0.05, None, 'steel')
            parts.append(leg)
            steer = Part(name, f'steer_{i}', (x, y, z), y=(0, 1, 0), keep='y')
            steer.parent = f'gear_{i}'
            for s in (-1, 1):
                steer.tube((s * 0.12, y + 0.34, z), (s * 0.12, y, z), 0.025, None, 'steel')
            steer.tube((-0.14, y + 0.35, z), (0.14, y + 0.35, z), 0.04, None, 'steel')
            parts.append(steer)
            wheel(name, i, w, 0.17, 'steel', parts)
        else:
            s = 1 if x > 0 else -1
            top = (s * 1.62, -0.40, z - 0.10)
            # Local X forward on the right leg and back on the left, so a positive turn folds each inward.
            leg = Part(name, f'gear_{i}', top, x=(0, 0, -s), y=(0, 1, 0))
            leg.tube(top, (x - s * 0.16, y + 0.05, z), 0.06, None, 'steel')
            leg.tube((x - s * 0.16, y, z), (x - s * 0.10, y, z), 0.04, None, 'steel')
            parts.append(leg)
            wheel(name, i, w, 0.20, 'steel', parts).parent = f'gear_{i}'
    return name, parts


# ------------------------------------------------------------------ assembly, asserts, export

def assemble(name, parts):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    root = bpy.data.objects.new(name, None)
    coll.objects.link(root)
    objs = {}
    for p in parts:
        objs[p.name] = p.finish(coll)
    for p in parts:
        parent = objs[p.parent] if p.parent else root
        p.object.parent = parent
        p.object.matrix_world = p.matrix
    # The pilot's eye: a node with nothing in it, its axes the body's.
    eye = bpy.data.objects.new('eye', None)
    coll.objects.link(eye)
    eye.parent = root
    eye.matrix_world = Matrix.Translation(P(EYES[name]))
    objs['eye'] = eye
    return coll, root, objs


def check(name, parts, objs):
    spec = PLANES[name]
    look, gear, sheet = spec['look'], spec['gear'], spec['airframe']
    bpy.context.view_layer.update()
    # PARTS: every node flight3d turns is here.
    want = ['body', 'aileron_left', 'aileron_right', 'elevator', 'rudder']
    if sheet['engineSpin'] or look['spin']:
        want.append('prop')
    for i, w in enumerate(gear['wheels']):
        if w['radius'] >= 0.1:
            want.append(f'wheel_{i}')
        if w['steer']:
            want.append(f'steer_{i}')
        if look['gear']:
            want.append(f'gear_{i}')
    if look['airbrake']:
        assert any(n.startswith('airbrake') for n in objs), name
    missing = [n for n in want if n not in objs]
    print(f'PARTS {name} nodes={len(objs)} missing={missing}')
    assert not missing
    # WHEELS: each wheel's node on its axle and its tyre's lowest point a radius under it.
    for i, w in enumerate(gear['wheels']):
        o = objs.get(f'wheel_{i}')
        if not o:
            continue
        at = B(o.matrix_world.translation)
        low = min(B(o.matrix_world @ v.co).y for v in o.data.vertices)
        off = (at - Vector(w['at'])).length
        print(f'WHEEL {name}.{i} off={off:.4f} bottom={low:.3f} want={w["at"][1] - w["radius"]:.3f}')
        assert off < 0.001 and abs(low - (w['at'][1] - w['radius'])) < 0.006
    # SPAN: the wing reaches the sheet's span.
    xs = [abs(B(objs[n].matrix_world @ v.co).x) for n in objs if n.startswith('aileron') or n == 'body' for v in objs[n].data.vertices]
    reach = 2 * max(xs)
    print(f'SPAN {name} model={reach:.3f} sheet={sheet["span"]}')
    assert abs(reach - sheet['span']) / sheet['span'] < 0.02
    tris = {False: 0, True: 0}
    for n, o in objs.items():
        if o.type != 'MESH':
            continue
        o.data.calc_loop_triangles()
        tris[inside(n)] += len(o.data.loop_triangles)
    print(f'TRIS {name} outside={tris[False]} cockpit={tris[True]}')
    assert tris[False] <= TRIS and tris[True] <= COCKPIT
    # EYE: the pilot's eye where the cockpit was laid out round it, with a head's room round it and the
    # way ahead along the nose clear of everything but glass for a metre.
    eye = objs['eye']
    at = B(eye.matrix_world.translation)
    off = (at - Vector(EYES[name])).length
    meshes = [o for o in objs.values() if o.type == 'MESH']
    verts, polys, glass = [], [], []
    for o in meshes:
        base = len(verts)
        verts += [B(o.matrix_world @ v.co) for v in o.data.vertices]
        for p in o.data.polygons:
            polys.append([base + i for i in p.vertices])
            glass.append(o.data.materials[p.material_index].surface_render_method == 'BLENDED')
    tree = BVHTree.FromPolygons(verts, polys)
    room = tree.find_nearest(at)[3]
    ahead, start = None, at
    while True:
        hit = tree.ray_cast(start, Vector((0, 0, -1)), 1.0 - (start - at).length)
        if hit[0] is None or not glass[hit[2]]:
            ahead = None if hit[0] is None else (hit[0] - at).length
            break
        start = hit[0] + Vector((0, 0, -0.001))
    print(f'EYE {name} off={off:.4f} room={room:.3f} ahead={"clear" if ahead is None else f"{ahead:.3f}"}')
    assert off < 0.001 and room >= 0.12 and ahead is None
    pairs = coplanar(meshes)
    print(f'COPLANAR {name} pairs={pairs}')
    assert pairs == 0


def coplanar(objects):
    """Pairs of triangles of any orientation lying in one plane (within 4 mm) that overlap by more than
    5 mm, read off the built meshes in the body frame."""
    tris = []
    for o in objects:
        me = o.data
        me.calc_loop_triangles()
        M = o.matrix_world
        co = np.array([(M @ v.co)[:] for v in me.vertices])
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
    buckets = {}
    for k, (_, n, p) in enumerate(tris):
        buckets.setdefault((round(n[0], 2), round(n[1], 2), round(n[2], 2), math.floor(float(n @ p[0]) / 0.5)), []).append(k)
    pairs = 0
    seen = {}
    for key, ks in sorted(buckets.items()):
        group = list(ks) + buckets.get((key[0], key[1], key[2], key[3] + 1), [])
        if len(group) < 2:
            continue
        n = tris[ks[0]][1]
        u = np.cross(n, [0, 0, 1] if abs(n[2]) < 0.9 else [1, 0, 0])
        u /= np.linalg.norm(u)
        v = np.cross(n, u)
        flat2 = np.array([np.stack([tris[i][2] @ u, tris[i][2] @ v], axis=1) for i in group])
        lo, hi = flat2.min(axis=1), flat2.max(axis=1)
        for a in range(len(ks)):
            cand = np.nonzero((lo[a + 1:, 0] < hi[a, 0] - 0.005) & (hi[a + 1:, 0] > lo[a, 0] + 0.005) &
                              (lo[a + 1:, 1] < hi[a, 1] - 0.005) & (hi[a + 1:, 1] > lo[a, 1] + 0.005))[0] + a + 1
            for b in cand:
                ta, tb = tris[group[a]], tris[group[b]]
                if max(abs(ta[1] @ (tb[2] - ta[2][0]).T).max(), abs(tb[1] @ (ta[2] - tb[2][0]).T).max()) > 0.004:
                    continue
                if depth(flat2[a], flat2[b]) > 0.005:
                    pairs += 1
                    body = lambda p: tuple(round(float(c), 3) for c in B(Vector(p)))
                    where = (ta[0], tb[0], body(ta[1]), [body(p) for p in ta[2]], [body(p) for p in tb[2]])
                    plane = (ta[0], tb[0], where[2], round(float(ta[1] @ ta[2][0]), 2))
                    if plane not in seen:
                        seen[plane] = where
                        if len(seen) <= 12:
                            print('  coplanar', where)
    return pairs


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


def export(name, coll, root):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in coll.objects:
        o.select_set(True)
    path = os.path.join(OUT, name + '.glb')
    # Normals as the faces' smooth and sharp edges and the decals' own give them, every corner its own.
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, use_selection=True,
                              export_apply=True, export_normals=True, export_cameras=False, export_lights=False,
                              export_extras=False)
    # NAMES: the nodes in the file are named exactly as flight3d looks for them, read back off the glb's
    # JSON chunk; three's loader keeps letters, digits and underscores as they are.
    raw = open(path, 'rb').read()
    size = int.from_bytes(raw[12:16], 'little')
    nodes = sorted(n['name'] for n in json.loads(raw[20:20 + size])['nodes'])
    want = sorted([name] + [o.name for o in coll.objects if o is not root])
    bad = [n for n in nodes if not all(ch.isalnum() or ch == '_' for ch in n)]
    print(f'NAMES {name} nodes={nodes} bad={bad}')
    assert nodes == want and not bad
    print('WROTE', path, os.path.getsize(path))


def picture(name, coll, root):
    """The pick screen's picture: the plane from ahead and to its left, a little above, on nothing."""
    sc = bpy.context.scene
    for c in bpy.data.collections:
        c.hide_render = c is not coll
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 640, 400
    sc.render.film_transparent = True
    # No clock in the file's notes, so two builds write the same picture byte for byte.
    sc.render.use_stamp_date = False
    sc.render.use_stamp_render_time = False
    if not sc.world:
        world = bpy.data.worlds.new('sky')
        sc.world = world
        bg = world.node_tree.nodes['Background']
        bg.inputs['Color'].default_value = (0.75, 0.82, 0.9, 1)
        bg.inputs['Strength'].default_value = 1.0
        sun = bpy.data.lights.new('sun', 'SUN')
        sun.energy = 3.0
        so = bpy.data.objects.new('sun', sun)
        so.rotation_euler = (math.radians(40), 0, math.radians(-30))
        sc.collection.objects.link(so)
        cam = bpy.data.cameras.new('cam')
        cam.lens = 50
        co = bpy.data.objects.new('cam', cam)
        sc.collection.objects.link(co)
        sc.camera = co
    co = sc.camera
    # Framed on the model's own size, its longest reach from the centre of gravity, length or span.
    reach = max((o.matrix_world @ v.co).length for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    k = 2.2 * reach
    eye = P((-0.9 * k, 0.45 * k, -1.1 * k))
    co.location = eye
    co.rotation_euler = (P((0, -0.2, 0.3)) - eye).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)


# One plane at a time: built, checked, exported, pictured and taken away before the next, because a
# Blender file holds one object of a name and every plane has an aileron_left.
for make in (camel, cessna, trainer):
    if ONLY and make.__name__ not in ONLY:
        continue
    name, parts = make()
    coll, root, objs = assemble(name, parts)
    check(name, parts, objs)
    export(name, coll, root)
    if PICTURES:
        picture(name, coll, root)
    for o in list(coll.objects):
        data = o.data
        bpy.data.objects.remove(o)
        if data:
            bpy.data.meshes.remove(data)
    bpy.data.collections.remove(coll)
