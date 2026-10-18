# A chamber surface baked to its maps: a square `tile` metres across cut into square panels `panel`
# metres across, each a plate of the surface's library `set` with a groove `seam` metres wide round it,
# its edge bevelled over `bevel` and sunk `depth` metres. Every number is the surface's entry in
# `chamber.surfaces` of `assets/demo_wormhole.json`, read here, so the bake and the game read one file.
#
#   colour      the set's colour, `scale` metres to a repeat, its saturation times `saturation` (0 is
#               grey), times `tint` and times `gain`; each panel's own share
#               brighter or darker by up to `vary`/2, and read from its own place in the set, so no two
#               neighbours repeat; the groove `groove.dark` times as bright
#   roughness   the set's roughness laid between `rough[0]` and `rough[1]`, each panel moved by up to
#               `roughVary`/2; the groove `groove.rough`
#   normal      the set's normal at `normal` strength, with the groove's bevel bumped into it; tangent
#               space, OpenGL (+x along u, +y along v), as three reads it
#   glow        with a `glow`, a line `glow.line` metres wide `glow.inset` metres in from each panel's
#               edge, its edges softened over `glow.soft`: white on black, the emissive map
#
# Each map is `size` pixels square and tiles: the tile's edges are panel edges, so the last panel's
# groove meets the first's. The panel of the n-th column and m-th row takes its random numbers from
# Blender's white noise at (n, m), so the bake is the same every time.
#
#   Blender -b --factory-startup --python panels.py -- <defs.json> <surface> <colour> <normal> <roughness> <out dir>
#
# writes <out dir>/colour.png, normal.png, roughness.png and, with a glow, glow.png.
import json
import os
import sys

import bpy

defs_path, name, src_colour, src_normal, src_roughness, out = sys.argv[sys.argv.index('--') + 1:]
s = json.load(open(defs_path))['chamber']['surfaces'][name]
os.makedirs(out, exist_ok=True)


def linear(hex_colour):
    # an sRGB hex colour as linear RGB, the space the shader works in
    def channel(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    h = hex_colour.lstrip('#')
    return [channel(h[i:i + 2]) for i in (0, 2, 4)]


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.render.bake.margin = 0

bpy.ops.mesh.primitive_plane_add(size=s['tile'])
plane = bpy.context.active_object
material = bpy.data.materials.new(name)
plane.data.materials.append(material)
tree = material.node_tree
nodes, links = tree.nodes, tree.links
nodes.clear()


def node(kind, **props):
    n = nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def math(op, a, b=None, clamp=False):
    n = node('ShaderNodeMath', operation=op, use_clamp=clamp)
    for i, x in enumerate([a, b]):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            links.new(x, n.inputs[i])
    return n.outputs[0]


def vector(op, a, b=None, scale=None):
    n = node('ShaderNodeVectorMath', operation=op)
    for i, x in enumerate([a, b]):
        if x is None:
            continue
        if isinstance(x, (list, tuple)):
            n.inputs[i].default_value = x
        else:
            links.new(x, n.inputs[i])
    if scale is not None:
        n.inputs['Scale'].default_value = scale
    return n.outputs[0]


def smooth(value, lo, hi, to_lo=0.0, to_hi=1.0):
    n = node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', clamp=True)
    links.new(value, n.inputs['Value'])
    n.inputs['From Min'].default_value = lo
    n.inputs['From Max'].default_value = hi
    n.inputs['To Min'].default_value = to_lo
    n.inputs['To Max'].default_value = to_hi
    return n.outputs['Result']


def image(path, space):
    n = node('ShaderNodeTexImage', extension='REPEAT', interpolation='Cubic')
    n.image = bpy.data.images.load(path)
    n.image.colorspace_settings.name = space
    return n


panel, tile = s['panel'], s['tile']

# Where on the tile, in metres, and in which panel.
uv = node('ShaderNodeTexCoord').outputs['UV']
metres = vector('SCALE', uv, scale=tile)
cells = vector('SCALE', metres, scale=1 / panel)
cell = vector('FLOOR', cells)
local = vector('SCALE', vector('FRACTION', cells), scale=panel)
xyz = node('ShaderNodeSeparateXYZ')
links.new(local, xyz.inputs[0])
x, y = xyz.outputs['X'], xyz.outputs['Y']
edge = math('MINIMUM', math('MINIMUM', x, math('SUBTRACT', panel, x)), math('MINIMUM', y, math('SUBTRACT', panel, y)))
# 0 in the groove, 1 on the plate, the bevel between.
plate = smooth(edge, s['seam'] / 2, s['seam'] / 2 + s['bevel'])

# Each panel's own random numbers: a share for its colour, one for its roughness, and where in the set it reads.
noise = node('ShaderNodeTexWhiteNoise', noise_dimensions='3D')
links.new(cell, noise.inputs['Vector'])
rand = node('ShaderNodeSeparateColor')
links.new(noise.outputs['Color'], rand.inputs[0])
shift = vector('SCALE', noise.outputs['Color'], scale=7.31)
source = vector('ADD', vector('SCALE', metres, scale=1 / s['scale']), shift)

colour = image(src_colour, 'sRGB')
normal = image(src_normal, 'Non-Color')
rough = image(src_roughness, 'Non-Color')
for t in (colour, normal, rough):
    links.new(source, t.inputs['Vector'])

# colour
tint = node('ShaderNodeRGB')
tint.outputs[0].default_value = [*linear(s['tint']), 1]
greyed = node('ShaderNodeHueSaturation')
greyed.inputs['Saturation'].default_value = s['saturation']
links.new(colour.outputs['Color'], greyed.inputs['Color'])
tinted = node('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
tinted.inputs['Factor'].default_value = 1
links.new(greyed.outputs['Color'], tinted.inputs['A'])
links.new(tint.outputs[0], tinted.inputs['B'])
bright = math('MULTIPLY', s['gain'], math('ADD', 1, math('MULTIPLY', math('SUBTRACT', rand.outputs['Red'], 0.5), s['vary'])))
groove_dark = math('ADD', s['groove']['dark'], math('MULTIPLY', plate, 1 - s['groove']['dark']))
albedo_node = node('ShaderNodeVectorMath', operation='MULTIPLY')
links.new(tinted.outputs['Result'], albedo_node.inputs[0])
lit = node('ShaderNodeCombineXYZ')
gain = math('MULTIPLY', bright, groove_dark)
for axis in ('X', 'Y', 'Z'):
    links.new(gain, lit.inputs[axis])
links.new(lit.outputs[0], albedo_node.inputs[1])
albedo = albedo_node.outputs[0]

# roughness
lo, hi = s['rough']
laid = math('ADD', lo, math('MULTIPLY', rough.outputs['Color'], hi - lo))
moved = math('ADD', laid, math('MULTIPLY', math('SUBTRACT', rand.outputs['Green'], 0.5), s['roughVary']), clamp=True)
groove_rough = node('ShaderNodeMix', data_type='FLOAT')
links.new(plate, groove_rough.inputs['Factor'])
groove_rough.inputs['A'].default_value = s['groove']['rough']
links.new(moved, groove_rough.inputs['B'])
roughness = groove_rough.outputs['Result']

# normal: the set's, and the groove's bevel bumped into it
mapped = node('ShaderNodeNormalMap', space='TANGENT')
mapped.inputs['Strength'].default_value = s['normal']
links.new(normal.outputs['Color'], mapped.inputs['Color'])
bump = node('ShaderNodeBump')
bump.inputs['Strength'].default_value = 1
bump.inputs['Distance'].default_value = s['depth']
links.new(plate, bump.inputs['Height'])
links.new(mapped.outputs['Normal'], bump.inputs['Normal'])

# glow: a line inset from the panel's edge
glow = None
if 'glow' in s:
    g = s['glow']
    off = math('ABSOLUTE', math('SUBTRACT', edge, g['inset']))
    glow = smooth(off, g['line'] / 2, g['line'] / 2 + g['soft'], 1.0, 0.0)

principled = node('ShaderNodeBsdfPrincipled')
links.new(bump.outputs['Normal'], principled.inputs['Normal'])
emission = node('ShaderNodeEmission')
emission.inputs['Strength'].default_value = 1
output = node('ShaderNodeOutputMaterial')
target = node('ShaderNodeTexImage')
nodes.active = target

plane.select_set(True)
bpy.context.view_layer.objects.active = plane


def bake(file, space, kind, shader, colour_in=None):
    img = bpy.data.images.new(file, s['size'], s['size'], alpha=False, float_buffer=False)
    img.colorspace_settings.name = space
    target.image = img
    for l in list(emission.inputs['Color'].links):
        links.remove(l)
    if colour_in is not None:
        links.new(colour_in, emission.inputs['Color'])
    for l in list(output.inputs['Surface'].links):
        links.remove(l)
    links.new(shader.outputs[0], output.inputs['Surface'])
    if kind == 'NORMAL':
        bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z', margin=0)
    else:
        bpy.ops.object.bake(type='EMIT', margin=0)
    img.filepath_raw = os.path.join(out, f'{file}.png')
    img.file_format = 'PNG'
    img.save()
    print('baked', img.filepath_raw)


bake('colour', 'sRGB', 'EMIT', emission, albedo)
bake('roughness', 'Non-Color', 'EMIT', emission, roughness)
bake('normal', 'Non-Color', 'NORMAL', principled)
if glow is not None:
    bake('glow', 'Non-Color', 'EMIT', emission, glow)
