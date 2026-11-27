"""MakeHuman HM08 base mesh loader (CC0 data bundled with MPFB2).

Reads base.obj, macro targets, the game-engine rig and its weights without the
MPFB add-on, so the build does not depend on a Blender UI session.
OBJ space: decimetres, Y up, +Z front. Blender space: metres, Z up, -Y front.
"""
import gzip
import json

import numpy as np

DATA = '' + __import__('os').environ.get('MPFB_DATA', 'mpfb2/src/mpfb/data') + ''
SCALE = 0.1


def load_obj():
    verts, uvs, faces, face_uvs, groups = [], [], [], [], []
    current = None
    with open(f'{DATA}/3dobjs/base.obj') as handle:
        for line in handle:
            part = line.split()
            if not part:
                continue
            if part[0] == 'v':
                verts.append([float(x) for x in part[1:4]])
            elif part[0] == 'vt':
                uvs.append([float(part[1]), float(part[2])])
            elif part[0] == 'g':
                current = part[1]
            elif part[0] == 'f':
                idx = [q.split('/') for q in part[1:]]
                faces.append([int(q[0]) - 1 for q in idx])
                face_uvs.append([int(q[1]) - 1 for q in idx])
                groups.append(current)
    return np.array(verts), np.array(uvs), faces, face_uvs, groups


def target(rel, count):
    delta = np.zeros((count, 3))
    with gzip.open(f'{DATA}/targets/{rel}.target.gz', 'rt') as handle:
        for line in handle:
            if line.startswith('#') or not line.strip():
                continue
            part = line.split()
            delta[int(part[0])] = [float(part[1]), float(part[2]), float(part[3])]
    return delta


def vertex_groups():
    with open(f'{DATA}/mesh_metadata/basemesh_vertex_groups.json') as handle:
        raw = json.load(handle)
    out = {}
    for name, spans in raw.items():
        idx = []
        for start, end in spans:
            idx.extend(range(start, end + 1))
        out[name] = np.array(idx, dtype=int)
    return out


def rig(name='game_engine'):
    with open(f'{DATA}/rigs/standard/rig.{name}.json') as handle:
        bones = json.load(handle)
    with open(f'{DATA}/rigs/standard/weights.{name}.json') as handle:
        weights = json.load(handle)['weights']
    return bones, weights


def joint(spec, verts, groups):
    strategy = spec.get('strategy')
    if strategy == 'CUBE':
        return verts[groups[spec['cube_name']]].mean(axis=0)
    if strategy == 'MEAN':
        return verts[spec['vertex_indices']].mean(axis=0)
    if strategy == 'VERTEX':
        return verts[spec['vertex_index']]
    raise ValueError(f'unknown joint strategy {strategy}')


def to_blender(points):
    points = np.asarray(points)
    return np.stack([points[..., 0], -points[..., 2], points[..., 1]], axis=-1) * SCALE
