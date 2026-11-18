# A pair of feathered wings on bones of their own, the `wings` layout, for a body to wear hung on a bone
# of its back (the pegasus). Run by the game's bake (`assets/demo_puppet3d.bake.ts`):
#
#   Blender -b --factory-startup --python games/demo_puppet3d/assets/wings/wings.py -- <wings.json> <out.glb> <out.skeleton.json>
#
# Every number is `<wings.json>`'s: `line`, the wing's root, two joints and tip from the back out, metres,
# the left side; `chord`, how far the trailing edge stands behind each point of the line; `lead`, how far
# the leading edge stands ahead of it; `droop`, how far the trailing edge hangs below the leading; `columns`
# a bone and `rows` across the chord; `thick`, metres of thickness; `colour` (linear RGBA) and `rough`.
#
# The wings are drawn in the layout's own frame, glTF's axes: +x across to the left, +y up, +z ahead, the
# point they hang from at the origin. Each side is three bones from the back out, `<side> wing 1` to
# `<side> wing 3`, each a parent of the next, each with its `across` along the wing's chord so a positive
# bend lifts its tip on either side. Each side's skin is a sheet across the bones, given its thickness.
# Each vertex is weighed to the bones nearest where it lies along the wing, so a joint bends smoothly.
#
# It writes `<out.glb>`, the skinned mesh on its armature with no clips (the bake packs it), and
# `<out.skeleton.json>`, `{ layout: "wings", bones: [{ name, parent, head, tail, across }] }`, the rest
# skeleton puppet3d reads, every parent before its children.
import bpy
import bmesh
import json
import sys

# glTF's (x, y, z) in Blender's axes: (x, −z, y).
blend = lambda p: (p[0], -p[2], p[1])


def bones_of(cfg, side):
    """A side's three bones as the skeleton file has them, glTF's axes; the right the left mirrored."""
    s = 1 if side == 'left' else -1
    line = [(p[0] * s, p[1], p[2]) for p in cfg['line']]
    # Across is along the chord, back on the left and ahead on the right, so a positive bend (about it)
    # lifts each tip.
    across = [0.0, 0.0, -1.0 * s]
    return [{
        'name': f'{side} wing {i + 1}', 'parent': None if i == 0 else f'{side} wing {i}',
        'head': [round(v, 6) for v in line[i]], 'tail': [round(v, 6) for v in line[i + 1]], 'across': across,
    } for i in range(3)]


def skin(cfg, bm, side, groups):
    """A side's sheet in `bm`: columns along the line, rows across the chord, each vertex weighed to the
    bones nearest where it lies along the line (`groups`, filled in vertex order with its weights)."""
    s = 1 if side == 'left' else -1
    line, chords, columns, rows = cfg['line'], cfg['chord'], cfg['columns'], cfg['rows']
    grid = []
    for k in range(3 * columns + 1):
        u = k / columns
        i = min(int(u), 2)
        t = u - i
        a, b = line[i], line[i + 1]
        p = [a[j] + (b[j] - a[j]) * t for j in range(3)]
        chord = chords[i] + (chords[i + 1] - chords[i]) * t
        # Weighed by the distance along the line to each bone's middle; the root half of the first bone
        # and the tip half of the last wholly theirs.
        w = [max(0.0, 1.0 - abs(u - (n + 0.5))) for n in range(3)]
        if u <= 0.5:
            w = [1.0, 0.0, 0.0]
        if u >= 2.5:
            w = [0.0, 0.0, 1.0]
        total = sum(w)
        column = []
        for r in range(rows + 1):
            f = r / rows
            q = (p[0] * s, p[1] - cfg['droop'] * f, p[2] + cfg['lead'] - (cfg['lead'] + chord) * f)
            column.append(bm.verts.new(blend(q)))
            groups.append((side, [x / total for x in w]))
        grid.append(column)
    for k in range(len(grid) - 1):
        for r in range(rows):
            quad = [grid[k][r], grid[k + 1][r], grid[k + 1][r + 1], grid[k][r + 1]]
            bm.faces.new(quad if side == 'left' else list(reversed(quad)))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 3:
        raise SystemExit('wings: <wings.json> <out.glb> <out.skeleton.json>')
    cfg = json.load(open(args[0]))
    out_glb, out_skeleton = args[1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)

    bones = bones_of(cfg, 'left') + bones_of(cfg, 'right')
    arm_data = bpy.data.armatures.new('wings')
    arm = bpy.data.objects.new('wings', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for b in bones:
        e = arm_data.edit_bones.new(b['name'])
        e.head, e.tail = blend(b['head']), blend(b['tail'])
        if b['parent']:
            e.parent = arm_data.edit_bones[b['parent']]
            e.use_connect = True
    bpy.ops.object.mode_set(mode='OBJECT')

    mesh = bpy.data.meshes.new('wings')
    bm = bmesh.new()
    groups = []
    skin(cfg, bm, 'left', groups)
    skin(cfg, bm, 'right', groups)
    bm.to_mesh(mesh)
    bm.free()
    body = bpy.data.objects.new('wings skin', mesh)
    bpy.context.scene.collection.objects.link(body)
    vg = {b['name']: body.vertex_groups.new(name=b['name']) for b in bones}
    for index, (side, w) in enumerate(groups):
        for n, weight in enumerate(w):
            if weight > 0:
                vg[f'{side} wing {n + 1}'].add([index], weight, 'REPLACE')

    thick = body.modifiers.new('thick', 'SOLIDIFY')
    thick.thickness = cfg['thick']
    thick.offset = 0
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier='thick')
    bpy.ops.object.shade_smooth()

    material = bpy.data.materials.new('feathers')
    shader = material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = cfg['colour']
    shader.inputs['Roughness'].default_value = cfg['rough']
    material.use_backface_culling = False
    mesh.materials.append(material)

    body.parent = arm
    rig = body.modifiers.new('rig', 'ARMATURE')
    rig.object = arm

    bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_skins=True, export_animations=False, export_apply=False)
    json.dump({'layout': 'wings', 'bones': bones}, open(out_skeleton, 'w'), indent=2)
    print(f'WINGS {out_glb} {out_skeleton} bones={len(bones)} vertices={len(mesh.vertices)}')
