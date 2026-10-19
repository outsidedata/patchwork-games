# Makes clumps.glb: the nine clumps of the "LOD Grass" pack (author and licence unknown: an Unreal-style
# pack, SM_/T_ names, with no Sketchfab match; the library's `props/lod-grass`), three tussocks, two dry
# grasses, three wildflowers and a reed stand, each at its two levels of detail, named for scatter3d's
# clumps pack (`<row>-<lod>`):
#   grass01-0, grass01-1 … grass03-1   SM_Grass01–03
#   dry01-0 … dry02-1                  SM_Grass_Dry01–02
#   flowers01-0 … flowers03-1          SM_Grass_Flowers01–03
#   reeds-0, reeds-1                   SM_Grass_Reeds01
# Each FBX is imported as it was downloaded, in true metres (0.43 m to 2.09 m tall). Each clump is moved
# to stand on the floor with its middle on the axis, each LOD measured on its own footprint, which is the
# same clump measured twice, so the two land on one axis. The nine files each bring their own copy of
# the pack's two materials; every clump is put on the first copy, so the glb holds two materials and
# four pictures, not eighteen and thirty-six. Both materials are alpha-blended cards, as scatter3d's
# `cutout` expects. Textures are cut by what each one feeds (below). The library is `PATCHWORK_LIBRARY`,
# else ~/patchwork-library. It writes the plain glb Blender exports to `out.glb`; `yarn bake
# demo_terrain3d` packs it into the game (`demo_terrain3d.bake.ts`).
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python games/demo_terrain3d/assets/clumps.py -- out.glb
import os
import re
import sys
import bpy

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
assert len(ARGS) == 1, 'usage: clumps.py -- out.glb'
LIBRARY = os.path.expanduser(os.environ.get('PATCHWORK_LIBRARY') or '~/patchwork-library')
SOURCE = os.path.join(LIBRARY, 'props/lod-grass')
OUT = ARGS[0]
FILES = ['SM_Grass01', 'SM_Grass02', 'SM_Grass03', 'SM_Grass_Dry01', 'SM_Grass_Dry02',
         'SM_Grass_Flowers01', 'SM_Grass_Flowers02', 'SM_Grass_Flowers03', 'SM_Grass_Reeds01']
# Grass01_LOD0 -> grass01-0, Grass_Dry01_LOD1 -> dry01-1, Grass_Reeds_LOD0 -> reeds-0
NODE = re.compile(r'^(?:Grass_)?(\w+?)_LOD(\d)$')
# pixels a sheet keeps, by what it feeds: a clump is a metre of grass seen at arm's length at best, so
# 2K of colour is texels nobody stands close enough to resolve, and its normal map is a wrinkle on a blade
CAP = {'base': 1024, 'normal': 512}

bpy.ops.wm.read_factory_settings(use_empty=True)
for name in FILES:
    bpy.ops.import_scene.fbx(filepath=os.path.join(SOURCE, f'{name}.fbx'))

# every mesh detached keeping its world matrix, so the importer's own turn stays on it
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
assert len(meshes) == 2 * len(FILES), f'the pack has {len(meshes)} meshes, not {2 * len(FILES)}'
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)

# one copy of each material and each picture: `GrassBase.003` is `GrassBase`, `T_Grass_Base_D.png.002`
# is `T_Grass_Base_D.png`
bare = lambda name: re.sub(r'\.\d{3}$', '', name)
for kind in (bpy.data.images, bpy.data.materials):
    first = {}
    for block in sorted(kind, key=lambda b: b.name):
        keep = first.setdefault(bare(block.name), block)
        if keep is not block:
            block.user_remap(keep)
            kind.remove(block)
assert sorted(m.name for m in bpy.data.materials) == ['GrassBase', 'Grass_Reeds'], \
    f'the pack wears {[m.name for m in bpy.data.materials]}, not GrassBase and Grass_Reeds'

for o in sorted(meshes, key=lambda o: o.name):
    m = NODE.match(o.name)
    assert m, f'unexpected mesh {o.name!r}: the pack changed shape'
    corners = [o.matrix_world @ v.co for v in o.data.vertices]
    cx = (min(c.x for c in corners) + max(c.x for c in corners)) / 2
    cy = (min(c.y for c in corners) + max(c.y for c in corners)) / 2
    lo = min(c.z for c in corners)
    o.location.x -= cx
    o.location.y -= cy
    o.location.z -= lo
    o.name = f'{m.group(1).lower()}-{m.group(2)}'
    o.data.name = o.name
    print(f'{o.name}: {max(c.z for c in corners) - lo:.2f} m tall, {len(o.data.polygons)} faces')


def feeds(material, node):
    # What a picture is wired to, which is the only thing that says what it is for: the importer puts
    # the normal map through a Normal Map node, the colour (and its alpha) straight into the shader.
    # Links are matched by node name: Blender hands out a fresh Python wrapper on every access, so
    # `link.from_node is node` is false for the very link that starts at it.
    for link in material.node_tree.links:
        if link.from_node.name == node.name and link.to_node.type == 'NORMAL_MAP':
            return 'normal'
    return 'base'


for material in bpy.data.materials:
    material.surface_render_method = 'BLENDED'
    for node in material.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image:
            continue
        what = feeds(material, node)
        was = tuple(node.image.size)
        if was[0] > CAP[what] or was[1] > CAP[what]:
            node.image.scale(min(CAP[what], was[0]), min(CAP[what], was[1]))
        print(f'{material.name} {what}: {was[0]}x{was[1]} -> {node.image.size[0]}x{node.image.size[1]}')

os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_image_format='AUTO')
print('wrote', OUT)
