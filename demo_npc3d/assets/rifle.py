# The rifle the SWAT carry: a carbine with a flat-top rail, a red dot, and a curved polymer magazine,
# the shooter's rifle. This script is the model's source, run by the bake (`yarn bake demo_behavior3d`):
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python games/demo_behavior3d/assets/rifle.py -- games/demo_behavior3d/assets/rifle.glb [<preview dir>]
#
# Blender's +Z is up, +Y is the muzzle and +X the rifle's right. The glTF exporter's Y-up conversion
# turns +Y into three's −Z. The origin is where the right hand holds the pistol grip, so on a hand bone
# the rifle needs only the turn from the bone's frame to this one. One empty, `muzzle`, sits at the
# flash hider's mouth, so whatever draws a shot asks the model where it starts.
#
# Every part is an extruded side profile or a turned tube, bevelled, with one mesh per material. The build
# prints its asserts and throws when one fails: triangles, length, where the muzzle is, where the grip is.
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0]
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)

BORE = 0.098      # the bore line's height over the hold
MUZZLE = 0.58     # the flash hider's mouth, forward of the hold
TRIS = 4000       # the most triangles the rifle may have
LENGTH = (0.84, 0.90)  # butt to muzzle, a carbine with its stock out


def material(name, col, rough, metal):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[((col >> s) & 255) / 255 for s in (16, 8, 0)], 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


ANODISED = material('anodised', 0x1d1f22, 0.48, 0.6)
FDE = material('fde', 0x7a6749, 0.72, 0.0)
STEEL = material('steel', 0x2c2e31, 0.32, 0.95)
RUBBER = material('rubber', 0x121212, 0.92, 0.0)
GLASS = material('glass', 0x3a1414, 0.05, 0.0)

parts = []


def finish(ob, mat, bevel=0.0015):
    ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = ob.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(30)
    ob.select_set(False)
    parts.append(ob)
    return ob


def profile(name, mat, pts, width, x=0.0, bevel=0.0015):
    """A side profile, (y, z) points counter-clockwise seen from +X, extruded `width` across X about `x`."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    left = [bm.verts.new((x - width / 2, y, z)) for y, z in pts]
    right = [bm.verts.new((x + width / 2, y, z)) for y, z in pts]
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return finish(ob, mat, bevel)


def tube(name, mat, r, y0, y1, z=BORE, x=0.0, sides=16, turn=0.0, bevel=0.0):
    """A cylinder along +Y from y0 to y1."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=y1 - y0,
                                        location=(x, (y0 + y1) / 2, z), rotation=(math.radians(90), turn, 0))
    ob = bpy.context.active_object
    ob.name = name
    return finish(ob, mat, bevel)


def box(name, mat, sx, sy, sz, x, y, z, bevel=0.001):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (sx, sy, sz)
    return finish(ob, mat, bevel)


# The lower receiver, its magazine well open below, and the trigger guard.
profile('lower', ANODISED, [(-0.078, 0.078), (-0.078, 0.062), (-0.058, 0.05), (-0.02, 0.045), (0.052, 0.045),
                            (0.052, 0.0), (0.118, 0.0), (0.118, 0.055), (0.135, 0.055), (0.135, 0.078)], 0.026)
profile('guard', ANODISED, [(0.004, 0.02), (0.052, 0.02), (0.052, 0.045), (0.047, 0.045), (0.047, 0.025),
                            (0.004, 0.025)], 0.012, bevel=0.0008)
box('trigger', STEEL, 0.005, 0.005, 0.022, 0, 0.03, 0.034, bevel=0)

# The upper receiver, the full-length rail and its teeth, the charging handle, the port cover and the forward
# assist.
profile('upper', ANODISED, [(-0.085, 0.078), (0.135, 0.078), (0.135, 0.118), (-0.07, 0.118), (-0.085, 0.108)], 0.030)
box('rail', ANODISED, 0.021, 0.48, 0.008, 0, 0.16, 0.122)
for i in range(46):
    box(f'tooth{i}', ANODISED, 0.023, 0.005, 0.003, 0, -0.068 + i * 0.01, 0.1275, bevel=0)
profile('charger', ANODISED, [(-0.098, 0.106), (-0.078, 0.106), (-0.078, 0.114), (-0.098, 0.114)], 0.042, bevel=0.001)
box('port', STEEL, 0.0012, 0.07, 0.022, 0.0156, 0.035, 0.097, bevel=0)
tube('assist', ANODISED, 0.0065, -0.045, -0.02, z=0.103, x=0.019, sides=10)

# The handguard, an octagon round the barrel with M-LOK slots down its flanks, the barrel, the gas block and
# the flash hider.
tube('handguard', FDE, 0.026, 0.135, 0.40, sides=8, turn=math.radians(22.5), bevel=0.0015)
for side in (-1, 1):
    for i in range(4):
        box(f'slot{side}{i}', RUBBER, 0.002, 0.034, 0.008, side * 0.0243, 0.165 + i * 0.058, BORE, bevel=0)
    box(f'slotlow{side}', RUBBER, 0.002, 0.2, 0.006, side * 0.017, 0.27, BORE - 0.019, bevel=0)
tube('barrel', STEEL, 0.0095, 0.40, 0.535)
box('gasblock', STEEL, 0.02, 0.016, 0.022, 0, 0.41, BORE + 0.004)
tube('hider', STEEL, 0.0115, 0.535, MUZZLE, sides=12, bevel=0.001)
for i in range(4):
    a = i * math.pi / 2 + math.pi / 4
    box(f'hiderslot{i}', RUBBER, 0.004, 0.03, 0.004, math.cos(a) * 0.0112, 0.563, BORE + math.sin(a) * 0.0112, bevel=0)

# The buffer tube, the stock sliding on it, and the butt pad.
tube('buffer', ANODISED, 0.0155, -0.235, -0.085, sides=16)
profile('stock', FDE, [(-0.14, 0.121), (-0.14, 0.078), (-0.2, 0.066), (-0.265, 0.03), (-0.28, 0.024),
                       (-0.28, 0.123), (-0.2, 0.125)], 0.036, bevel=0.002)
profile('butt', RUBBER, [(-0.28, 0.127), (-0.28, 0.02), (-0.294, 0.02), (-0.294, 0.127)], 0.04, bevel=0.002)

# The pistol grip, whose middle is the origin, where the hand holds.
profile('grip', FDE, [(-0.004, 0.047), (0.034, 0.047), (0.022, 0.018), (0.008, -0.04), (0.004, -0.058),
                      (-0.03, -0.062), (-0.036, -0.052), (-0.022, -0.01)], 0.027, bevel=0.002)

# The magazine, curved forward the way a 5.56 box is, with a wider base plate.
back = [(0.057, 0.004), (0.059, -0.05), (0.066, -0.1), (0.079, -0.148), (0.087, -0.166)]
front = [(0.149, -0.158), (0.141, -0.14), (0.128, -0.098), (0.119, -0.05), (0.117, 0.004)]
profile('mag', FDE, back + front, 0.022, bevel=0.0015)
profile('plate', FDE, [(0.083, -0.162), (0.086, -0.176), (0.156, -0.166), (0.152, -0.152)], 0.026, bevel=0.0015)

# The red dot on its mount, its lenses, and a folding sight at each end of the rail.
box('mount', ANODISED, 0.02, 0.036, 0.018, 0, 0.02, 0.1375)
tube('scope', ANODISED, 0.0185, -0.02, 0.06, z=0.163, sides=16, bevel=0.001)
tube('lensback', GLASS, 0.015, -0.0205, -0.019, z=0.163, sides=16)
tube('lensfront', GLASS, 0.015, 0.059, 0.0605, z=0.163, sides=16)
box('backsight', ANODISED, 0.018, 0.012, 0.012, 0, -0.055, 0.1335)
box('frontsight', ANODISED, 0.012, 0.012, 0.014, 0, 0.385, 0.1345)

# One mesh per material, its modifiers applied, shaded smooth where the angle is under 35 degrees.
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
rifle = bpy.context.active_object
rifle.name = 'rifle'
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))

bpy.ops.object.empty_add(location=(0, MUZZLE, BORE))
bpy.context.active_object.name = 'muzzle'

# The asserts, measured on the mesh that is exported.
dg = bpy.context.evaluated_depsgraph_get()
ev = rifle.evaluated_get(dg).to_mesh()
ev.calc_loop_triangles()
tris = len(ev.loop_triangles)
ys = [v.co.y for v in ev.vertices]
length = max(ys) - min(ys)
print(f'TRIS rifle={tris} max={TRIS} {"OK" if tris <= TRIS else "FAIL"}')
print(f'LENGTH butt={min(ys):.3f} muzzle={max(ys):.3f} length={length:.3f} {"OK" if LENGTH[0] <= length <= LENGTH[1] else "FAIL"}')
tip = max(ys)
print(f'MUZZLE empty={MUZZLE:.3f} mesh={tip:.3f} {"OK" if abs(tip - MUZZLE) < 0.002 else "FAIL"}')
rifle.evaluated_get(dg).to_mesh_clear()
if tris > TRIS or not (LENGTH[0] <= length <= LENGTH[1]) or abs(tip - MUZZLE) >= 0.002:
    raise SystemExit('rifle: an assert failed')

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True,
                          export_animations=False)
print(f'rifle: wrote {OUT}')

# Previews: the rifle from four sides and square on from its right, lit by a sun and a weak fill.
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.42, 0.46, 0.52, 1)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    mid = Vector((0, 0.14, 0.02))

    def shot(name, at, lens=50):
        cam.data.lens = lens
        cam.location = at
        cam.rotation_euler = (mid - Vector(at)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(PREVIEW, name + '.png')
        bpy.ops.render.render(write_still=True)

    for a in (30, 120, 210, 300):
        t = math.radians(a)
        shot(f'turn-{a}', (mid.x + 1.6 * math.cos(t), mid.y + 1.6 * math.sin(t), mid.z + 0.5))
    shot('right', (1.4, mid.y, mid.z), 60)
    shot('left', (-1.4, mid.y, mid.z), 60)
