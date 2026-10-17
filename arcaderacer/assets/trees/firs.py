# Makes firs.glb: two firs out of LOLIPOP's "Realistic Fir Trees Pack (LODS, gameready)" (CC
# Attribution, sketchfab f58e8b6d733e4b0586e5b7db847b89e7, the library's `props/fir-trees`), each
# at three levels of detail, one object per tree per level, named for the game's look:
#   firtall_near, firtall_mid, firtall_far   the pack's tall fir, LOD1, LOD2 and the LOD3 crossed cards
#   firmid_near, firmid_mid, firmid_far      its mid fir, the same three
# Each stands with its foot at the origin and is one metre tall, so a tree drawn at scale s is s
# metres tall; its bark and its alpha-masked branches are two materials of the one object. Textures
# are cut to 1024 pixels. The library is `PATCHWORK_LIBRARY`, else ~/patchwork-library. It writes the
# plain glb Blender exports, to `out.glb` when given, else beside itself; `yarn bake arcaderacer` packs
# it into the game (`arcaderacer.bake.ts`).
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python games/arcaderacer/assets/trees/firs.py [-- out.glb]
import os
import sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LIBRARY = os.path.expanduser(os.environ.get('PATCHWORK_LIBRARY') or '~/patchwork-library')
SOURCE = os.path.join(LIBRARY, 'props/fir-trees/fir-trees.glb')
OUT = ARGS[0] if ARGS else os.path.join(HERE, 'firs.glb')
# the pack's meshes sorted by name, as the library's registry numbers them
TREES = {
    'firtall_near': [16, 17], 'firtall_mid': [18, 19], 'firtall_far': [20],
    'firmid_near': [2, 3], 'firmid_mid': [4, 5], 'firmid_far': [6],
}
TEXTURE = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SOURCE)
meshes = sorted((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: o.name)
assert len(meshes) == 21, f'the pack has {len(meshes)} meshes, not 21'

# every mesh detached keeping its world matrix (the importer's Y-up turn is on the root empty)
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)

keep = []
for name, parts in TREES.items():
    group = [meshes[i] for i in parts]
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:
        o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group) > 1:
        bpy.ops.object.join()
    tree = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # foot at the origin, centred, a metre tall
    xs = [v.co.x for v in tree.data.vertices]
    ys = [v.co.y for v in tree.data.vertices]
    zs = [v.co.z for v in tree.data.vertices]
    cx, cy, z0, tall = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs), max(zs) - min(zs)
    for v in tree.data.vertices:
        v.co.x = (v.co.x - cx) / tall
        v.co.y = (v.co.y - cy) / tall
        v.co.z = (v.co.z - z0) / tall
    tree.location = (0, 0, 0)
    tree.name = name
    tree.data.name = name
    print(f'{name}: {len(tree.data.polygons)} faces, was {tall:.2f} m tall')
    keep.append(tree)

for o in [o for o in bpy.data.objects if o not in keep]:
    bpy.data.objects.remove(o, do_unlink=True)
# side by side, so the file opens as a row of trees; the game reads each by its name and places it
for k, o in enumerate(keep):
    o.location.x = k * 1.5

for image in bpy.data.images:
    if image.size[0] > TEXTURE or image.size[1] > TEXTURE:
        image.scale(min(TEXTURE, image.size[0]), min(TEXTURE, image.size[1]))
        image.pack()
for m in bpy.data.materials:
    print(f'material {m.name}: blend {m.blend_method}')

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_image_format='AUTO')
print('wrote', OUT)
