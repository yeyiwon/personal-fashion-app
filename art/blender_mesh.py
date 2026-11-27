import bpy
import math
from pathlib import Path
TAU=math.tau
OUT=Path(__file__).resolve().parents[1]/"public/media/bello"
bpy.ops.wm.read_factory_settings(use_empty=True)
materials = {}
for key, value in {
    'porcelain': 'F4F7FC', 'alloy': 'C6D2E4', 'silk': 'BEB6E4',
    'lens': '91D5DD', 'graphite': '293244', 'ink': '101520', 'leather': '513831',
}.items():
    m = bpy.data.materials.new(key)
    m.diffuse_color = (*[int(value[i:i+2], 16)/255 for i in (0, 2, 4)], 1)
    materials[key] = m


def xyz(p):
    return (p[0], -p[2], p[1])


def surface(name, rows, mat, wrap=True, cap=False):
    verts = [xyz(point) for row in rows for point in row]
    n = len(rows[0])
    faces = []
    for i in range(len(rows)-1):
        for j in range(n if wrap else n-1):
            a, b = i*n+j, i*n+(j+1)%n
            faces.append((a, a+n, b+n, b))
    if cap and wrap:
        faces += [tuple(reversed(range(n))), tuple(range(len(verts)-n,len(verts)))]
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    data.materials.append(materials[mat])
    for poly in data.polygons:
        poly.use_smooth = True
    return ob


def ring(name, profile, mat, steps=72):
    return surface(name, [[(rx*math.cos(TAU*i/steps), y, rz*math.sin(TAU*i/steps)) for i in range(steps)]
                          for y, rx, rz in profile], mat, cap=True)


def tube(name, points, thickness, mat, cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 6
    curve.bevel_depth = thickness
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for b, point in zip(spline.bezier_points, points):
        b.co = xyz(point)
        b.handle_left_type = b.handle_right_type = 'AUTO'
    spline.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    curve.materials.append(materials[mat])
    return ob


def block(name, pos, dims, bevel, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(pos))
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = (dims[0], dims[2], dims[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = ob.modifiers.new('Rolled edge', 'BEVEL')
    mod.width, mod.segments = bevel, 4
    ob.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    ob.data.materials.append(materials[mat])
    return ob


def export(filename):
    bpy.ops.export_scene.gltf(filepath=str(OUT / filename), export_format='GLB', export_yup=True,
                              export_apply=True, export_texcoords=False, export_animations=False,
                              export_cameras=False, export_lights=False)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def sphere(name,radius,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=radius)
    ob=bpy.context.object;ob.name=name;ob.data.materials.append(materials[mat])
    for f in ob.data.polygons:f.use_smooth=True
