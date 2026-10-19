# Makes firs.glb: the three firs of LOLIPOP's "Realistic Fir Trees Pack (LODS, gameready)" (CC
# Attribution, sketchfab f58e8b6d733e4b0586e5b7db847b89e7, the library's `props/fir-trees`), every
# mesh of every level of detail, named for scatter3d's trees pack (`<row>-<lod>-<part>`):
#   tall-<lod>-bark, tall-<lod>-leaf   the pack's first tree, LOD 0, 1 and 2, its trunk and its needles
#   tall-3-card                        its LOD3, the crossed cards with their own cutout sheet
#   mid-…, small-…                     its second and third tree, the same
# Each tree stands in true metres with its foot on the floor and its middle on the axis: the source's
# trees hang down from the origin (y = 0 at the crown, -9.23 at the roots), so a tree instanced at
# ground height would be drawn underground. A tree's trunk and needles are measured and moved together,
# since their offset from each other is the tree. Textures are cut by what each one feeds (below). The
# library is `PATCHWORK_LIBRARY`, else ~/patchwork-library. It writes the plain glb Blender exports to
# `out.glb`; `yarn bake demo_terrain3d` packs it into the game (`demo_terrain3d.bake.ts`).
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python games/demo_terrain3d/assets/firs.py -- out.glb
import os
import re
import sys
import bpy

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
assert len(ARGS) == 1, 'usage: firs.py -- out.glb'
LIBRARY = os.path.expanduser(os.environ.get('PATCHWORK_LIBRARY') or '~/patchwork-library')
SOURCE = os.path.join(LIBRARY, 'props/fir-trees/fir-trees.glb')
OUT = ARGS[0]
# the source's three trees, as scatter3d's rows name them
SPECIES = {'': 'tall', '_2': 'mid', '_3': 'small'}
NODE = re.compile(r'^Christmas tree(_\d)?_LOD(\d)_(.*)_Mat_0$')
# pixels a sheet keeps, by what it feeds: a colour map is read at arm's length; a normal map is a wrinkle
# nobody resolves on a tree four metres away; the metal/rough sheet of a material with no metal in it
# is flat however many texels it has. The cards' sheets are only ever seen past the last mesh LOD, so
# each of theirs is halved again.
CAP = {'base': 1024, 'normal': 512, 'mr': 256}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SOURCE)

# every mesh detached keeping its world matrix (the importer's Y-up turn is on the root empty)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
assert len(meshes) == 21, f'the pack has {len(meshes)} meshes, not 21'
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)

trees = {}
for o in meshes:
    m = NODE.match(o.name)
    assert m, f'unexpected node {o.name!r}: the pack changed shape'
    row, lod, part = SPECIES[m.group(1) or ''], int(m.group(2)), m.group(3)
    o.name = f"{row}-{lod}-{'bark' if part == 'Bark' else 'leaf' if part == 'Brunches' else 'card'}"
    trees.setdefault((row, lod), []).append(o)

for (row, lod), parts in sorted(trees.items()):
    corners = [o.matrix_world @ v.co for o in parts for v in o.data.vertices]
    cx = (min(c.x for c in corners) + max(c.x for c in corners)) / 2
    cy = (min(c.y for c in corners) + max(c.y for c in corners)) / 2
    lo = min(c.z for c in corners)
    for o in parts:
        o.location.x -= cx
        o.location.y -= cy
        o.location.z -= lo
    print(f'{row}-{lod}: {max(c.z for c in corners) - lo:.2f} m tall, '
          f'{sum(len(o.data.polygons) for o in parts)} faces in {len(parts)} meshes')


def feeds(material, node):
    # What a picture is wired to, which is the only thing that says what it is for. The importer builds
    # Color to Base Color, Color through a Normal Map node, or Color through a Separate Color into
    # Roughness and Metallic. Links are matched by node name: Blender hands out a fresh Python wrapper
    # on every access, so `link.from_node is node` is false for the very link that starts at it.
    for link in material.node_tree.links:
        if link.from_node.name != node.name:
            continue
        if link.to_node.type == 'NORMAL_MAP':
            return 'normal'
        if link.to_node.type == 'SEPARATE_COLOR':
            return 'mr'
    return 'base'


for material in bpy.data.materials:
    card = 'Billboard_Mat' in material.name
    for node in material.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image:
            continue
        what = feeds(material, node)
        cap = max(64, CAP[what] // (2 if card else 1))
        was = tuple(node.image.size)
        if was[0] > cap or was[1] > cap:
            node.image.scale(min(cap, was[0]), min(cap, was[1]))
        print(f'{material.name} {what}: {was[0]}x{was[1]} -> {node.image.size[0]}x{node.image.size[1]}')

os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_image_format='AUTO')
print('wrote', OUT)
