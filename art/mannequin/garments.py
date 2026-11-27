"""Template garments are intentionally not generated.

Product decision (2026-11-28): fitting stays an independent module and the
build must not ship self-made garment meshes. The hook remains so fitted
assets can be added once real garment files exist.
"""


def build(*_args, **_kwargs):
    return []
