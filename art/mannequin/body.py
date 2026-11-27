"""Baseline mannequin body: macro shape, ground offset, faceless head."""
import numpy as np

import mh

M = 'macrodetails'
AVG = 'female-young-averagemuscle-averageweight'


def macro(verts, count, height=0.12):
    out = verts.copy()
    for race in ('asian', 'caucasian', 'african'):
        out += mh.target(f'{M}/{race}-female-young', count) / 3
    out += mh.target(f'{M}/universal-{AVG}', count)
    out += height * mh.target(f'{M}/height/{AVG}-maxheight', count)
    out += mh.target(f'{M}/proportions/{AVG}-idealproportions', count)
    return out


def adjacency(faces, limit):
    nbr = [set() for _ in range(limit)]
    for face in faces:
        if max(face) >= limit:
            continue
        n = len(face)
        for i in range(n):
            a, b = face[i], face[(i + 1) % n]
            nbr[a].add(b)
            nbr[b].add(a)
    return nbr


def smoothstep(lo, hi, x):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def faceless(points, faces, weights, body_count, iterations=140):
    """Melt facial features into a continuous sculpted head.

    Uniform Laplacian relaxation weighted by head influence; the neck boundary
    stays fixed. The head is then rescaled to its original extents so the
    relaxation does not shrink the skull.
    """
    head_w = np.zeros(body_count)
    for idx, w in weights['head']:
        if idx < body_count:
            head_w[idx] = w
    mask = smoothstep(0.55, 1.0, head_w)
    active = np.where(mask > 0)[0]
    nbr = adjacency(faces, body_count)
    rows = [np.array(sorted(nbr[i]), dtype=int) for i in active]
    out = points.copy()
    full = np.where(mask > 0.999)[0]
    before_min, before_max = out[full].min(axis=0), out[full].max(axis=0)
    for _ in range(iterations):
        avg = np.array([out[r].mean(axis=0) for r in rows])
        out[active] += (avg - out[active]) * mask[active, None] * 0.6
    after_min, after_max = out[full].min(axis=0), out[full].max(axis=0)
    centre_b, centre_a = (before_min + before_max) / 2, (after_min + after_max) / 2
    scale = (before_max - before_min) / (after_max - after_min)
    restored = (out - centre_a) * scale + centre_b
    out[active] += (restored[active] - out[active]) * mask[active, None]
    return out, mask
