"""BELLO mannequin build — CC0 MakeHuman HM08 base → rigged GLB with fitted template garments.

Usage: python3 build.py [--preview] [--export PATH]
"""
import json
import math
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, __import__('os').path.dirname(__file__))
import body as body_lib  # noqa: E402
import garments as garment_lib  # noqa: E402
import head as head_lib  # noqa: E402
import mh  # noqa: E402

OUT = __import__('os').environ.get('BELLO_OUT', 'out')
BODY_N = 13380
ARGS = sys.argv[1:]

verts, uvs, faces, face_uvs, face_groups = mh.load_obj()
count = len(verts)
groups = mh.vertex_groups()
bones, weights = mh.rig()

AVG = body_lib.AVG


def grounded(points):
    out = points.copy()
    out[:, 1] -= out[groups['joint-ground']].mean(axis=0)[1]
    return out


raw = body_lib.macro(verts, count)
for name in ('breast/nipple-point-decr', 'breast/nipple-size-decr'):
    try:
        raw += mh.target(name, count)
    except FileNotFoundError:
        print('MISSING target', name)
base = grounded(raw)

# Real body morphs: each is a full MakeHuman macro target relative to the baseline.
U = 'macrodetails/universal-female-young-averagemuscle'
MORPHS = {
    'slim': mh.target(f'{U}-minweight', count) - mh.target(f'{U}-averageweight', count),
    'full': mh.target(f'{U}-maxweight', count) - mh.target(f'{U}-averageweight', count),
    'bust': mh.target(f'breast/{AVG}-maxcup-averagefirmness', count),
    'hips': mh.target('hip/hip-scale-horiz-incr', count),
    'shoulders': mh.target('torso/torso-scale-horiz-incr', count),
}

head_w = np.zeros(count)
for idx, w in weights['head']:
    head_w[idx] = w
head_mask = body_lib.smoothstep(0.55, 1.0, head_w)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def make_mesh(name, points, polys, orig):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points.tolist(), [], polys)
    mesh.update()
    attr = mesh.attributes.new('orig', 'INT', 'POINT')
    attr.data.foreach_set('value', list(orig))
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def group_faces(names):
    return [f for f, g in zip(faces, face_groups) if g in names]


def from_group(name, names):
    keep = group_faces(names)
    used = sorted({v for f in keep for v in f})
    remap = {v: n for n, v in enumerate(used)}
    return make_mesh(name, mh.to_blender(base[used]), [[remap[v] for v in f] for f in keep], used)


body = from_group('Body', {'body'})
body_used = [d.value for d in body.data.attributes['orig'].data]
eyes = []
for g in ('helper-l-eye', 'helper-r-eye'):
    keep = group_faces({g})
    used = sorted({v for f in keep for v in f})
    remap = {v: n for n, v in enumerate(used)}
    eyes.append((mh.to_blender(base[used]).tolist(), [[remap[v] for v in f] for f in keep]))
head_lib.sculpt(body.data, head_mask[body_used], eyes, relax=160, flatten=14)
for poly in body.data.polygons:
    poly.use_smooth = True

pieces = garment_lib.build(base, faces, face_groups, groups, weights, make_mesh)

# ── Armature ────────────────────────────────────────────────────────────────
arm_data = bpy.data.armatures.new('Rig')
arm = bpy.data.objects.new('Rig', arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
raw_grounded = base
for name, spec in bones.items():
    bone = arm_data.edit_bones.new(name)
    bone.head = Vector(mh.to_blender(mh.joint(spec['head'], raw_grounded, groups)))
    bone.tail = Vector(mh.to_blender(mh.joint(spec['tail'], raw_grounded, groups)))
    bone.roll = spec.get('roll', 0)
for name, spec in bones.items():
    if spec.get('parent'):
        arm_data.edit_bones[name].parent = arm_data.edit_bones[spec['parent']]
bpy.ops.object.mode_set(mode='OBJECT')

weight_of = {}
for bone, pairs in weights.items():
    for idx, w in pairs:
        weight_of.setdefault(idx, []).append((bone, w))


def skin(obj, source=None):
    """Bind obj to the rig. source maps each vertex to [(orig index, share)]."""
    orig = [d.value for d in obj.data.attributes['orig'].data]
    vgroups = {name: obj.vertex_groups.new(name=name) for name in bones}
    for vi, o in enumerate(orig):
        if o < 0:
            vgroups['head'].add([vi], 1.0, 'REPLACE')
            continue
        total = sum(w for _, w in weight_of.get(o, [])) or 1
        for bone, w in weight_of.get(o, [('Root', 1.0)]):
            vgroups[bone].add([vi], w / total, 'REPLACE')
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    obj.parent = arm


def add_morphs(obj, rigid_mask=None):
    orig = np.array([d.value for d in obj.data.attributes['orig'].data])
    obj.shape_key_add(name='Basis')
    safe = np.where(orig >= 0, orig, 0)
    keep = (orig >= 0).astype(float)
    if rigid_mask is not None:
        keep = keep * (1 - rigid_mask)
    for name, delta in MORPHS.items():
        key = obj.shape_key_add(name=name)
        offset = mh.to_blender(delta[safe]) * keep[:, None]
        co = np.array([v.co[:] for v in obj.data.vertices]) + offset
        key.data.foreach_set('co', co.ravel())
        key.value = 0.0


body_mask = np.array([d.value for d in body.data.attributes['head'].data])
skin(body)
add_morphs(body, body_mask)
for piece in pieces:
    skin(piece)
    add_morphs(piece)

# ── Materials (names are the runtime contract) ──────────────────────────────


def material(name, colour, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*colour, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return mat


body.data.materials.append(material('Mannequin', (0.80, 0.83, 0.89), 0.4))
palette = [(0.16, 0.2, 0.27), (0.75, 0.71, 0.89), (0.57, 0.84, 0.87), (0.78, 0.82, 0.89), (0.2, 0.22, 0.3), (0.9, 0.9, 0.93)]
for n, piece in enumerate(pieces):
    piece.data.materials.append(material(f'Fabric_{piece.name}', palette[n % len(palette)], 0.72))

if '--preview' in ARGS:
    show = ARGS[ARGS.index('--preview') + 1].split(',')
    for piece in pieces:
        piece.hide_render = piece.name not in show
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.78, 0.84, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.55
    scene.world = world

    def area(name, loc, rot, energy, size):
        light = bpy.data.lights.new(name, 'AREA')
        light.energy = energy
        light.size = size
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.rotation_euler = rot
        scene.collection.objects.link(obj)

    area('Key', (1.8, -2.6, 2.4), (math.radians(58), 0, math.radians(32)), 520, 2.2)
    area('Rim', (-2.2, 1.8, 2.2), (math.radians(-60), 0, math.radians(-50)), 380, 1.6)
    floor = bpy.data.meshes.new('Floor')
    floor.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
    floor_obj = bpy.data.objects.new('Floor', floor)
    scene.collection.objects.link(floor_obj)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    tag = ARGS[ARGS.index('--preview') + 2]

    def shoot(name, loc, target, lens, size):
        cam = bpy.data.cameras.new(name)
        cam.lens = lens
        obj = bpy.data.objects.new(name, cam)
        obj.location = loc
        obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(obj)
        scene.camera = obj
        scene.render.resolution_x, scene.render.resolution_y = size
        scene.render.filepath = f'{OUT}/{tag}_{name}.png'
        bpy.ops.render.render(write_still=True)

    shoot('front', (0.0, -6.4, 1.0), (0, 0, 0.86), 70, (420, 760))
    shoot('q', (3.6, -5.0, 1.2), (0, 0, 0.86), 70, (420, 760))
    shoot('back', (-1.2, 6.2, 1.2), (0, 0, 0.86), 70, (420, 760))
    bpy.data.objects.remove(floor_obj)
    for obj in [o for o in scene.objects if o.type in ('LIGHT', 'CAMERA')]:
        bpy.data.objects.remove(obj)
    for piece in pieces:
        piece.hide_render = False

if '--export' in ARGS:
    path = ARGS[ARGS.index('--export') + 1]
    for obj in scene.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_morph=True,
        export_morph_normal=False,
        export_animations=False,
        export_materials='EXPORT',
        export_texcoords=False,
        export_attributes=False,
        export_all_influences=False,
    )
    meta = {
        'source': 'MakeHuman HM08 base mesh via MPFB2 2.0.18 (CC0 1.0)',
        'morphs': list(MORPHS),
        'pieces': [p.name for p in pieces],
        'tris': {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in [body, *pieces]},
    }
    print('META', json.dumps(meta))
