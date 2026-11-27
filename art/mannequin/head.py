"""Faceless head surgery in bmesh: remove hidden cavities, close the openings, relax."""
import math

import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def fibonacci(n):
    out = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        out.append(Vector((math.cos(golden * i) * r, math.sin(golden * i) * r, z)))
    return out


def sculpt(mesh, mask, occluders, relax=60, flatten=0.0):
    """mask: per-vertex head influence (0..1) in mesh vertex order.

    occluders: list of (verts, faces) that plug openings during the visibility
    test (the eyeballs), so sockets count as hidden.
    Returns the per-vertex mask extended for vertices created by the fill.
    """
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    layer = bm.verts.layers.float.new('head')
    orig = bm.verts.layers.int.get('orig')
    for v in bm.verts:
        v[layer] = mask[v.index]

    all_verts = [v.co.copy() for v in bm.verts]
    all_faces = [[v.index for v in f.verts] for f in bm.faces]
    body_faces = len(all_faces)
    for o_verts, o_faces in occluders:
        offset = len(all_verts)
        all_verts.extend(Vector(p) for p in o_verts)
        all_faces.extend([[i + offset for i in f] for f in o_faces])
    tree = BVHTree.FromPolygons(all_verts, all_faces)

    dirs = fibonacci(160)
    hidden = []
    for face in bm.faces:
        if min(v[layer] for v in face.verts) <= 0.35:
            continue
        centre = face.calc_center_median()
        seen = False
        for d in dirs:
            if d.dot(face.normal) < 0.15:
                continue
            hit = tree.ray_cast(centre + d * 1.5, -d, 3.0)
            if hit[2] == face.index and hit[2] < body_faces:
                seen = True
                break
        if not seen:
            hidden.append(face)
    print('HEAD hidden faces removed', len(hidden))
    bmesh.ops.delete(bm, geom=hidden, context='FACES')

    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    rim = [e for e in bm.edges if e.is_boundary and all(v[layer] > 0.3 for v in e.verts)]
    filled = bmesh.ops.holes_fill(bm, edges=rim, sides=0)['faces']
    print('HEAD holes filled', len(filled))
    poked = bmesh.ops.poke(bm, faces=filled)
    for v in poked['verts']:
        v[layer] = 1.0
        v[orig] = -1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    bm.verts.ensure_lookup_table()
    active = [v for v in bm.verts if v[layer] > 0]
    weights = np.array([v[layer] for v in active])
    weights = weights * weights * (3 - 2 * weights)
    index = {v.index: n for n, v in enumerate(active)}
    rows = [[o.index for o in (e.other_vert(v) for e in v.link_edges)] for v in active]
    pos = np.array([v.co[:] for v in bm.verts])
    ids = np.array([v.index for v in active])

    def step(factor):
        avg = np.array([pos[r].mean(axis=0) for r in rows])
        pos[ids] += (avg - pos[ids]) * weights[:, None] * factor

    for _ in range(relax):
        step(0.62)
        step(-0.64)
    if flatten:
        for _ in range(int(flatten)):
            step(0.5)
    for v in active:
        v.co = pos[v.index]

    out_mask = np.array([v[layer] for v in bm.verts])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return out_mask
