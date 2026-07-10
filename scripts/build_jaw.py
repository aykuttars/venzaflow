"""
Build a web-ready, per-tooth-named jaw GLB from the NIH HRA "Mouth, Female"
CC0 reference model.

- Splits the two "set of teeth" meshes into individual teeth (connected
  components after vertex merge), assigns FDI node names tooth_11..tooth_47.
- Keeps decimated gingiva (upper/lower) for anatomical context.
- Recenters + scales into scene units and exports a compact GLB.

Usage: python scripts/build_jaw.py <input.glb> <output.glb>
"""
import sys
import numpy as np
import trimesh
import fast_simplification as fs

SRC = sys.argv[1]
OUT = sys.argv[2]

# FDI within-quadrant order from midline outward: 1..7
# Convention (verify visually, flip RIGHT_IS_NEGATIVE_X if mirrored):
#   upper negative-x -> quadrant 1 (11..17), upper positive-x -> quadrant 2 (21..27)
#   lower negative-x -> quadrant 4 (41..47), lower positive-x -> quadrant 3 (31..37)
RIGHT_IS_NEGATIVE_X = True

TEETH_COLOR = np.array([245, 244, 235, 255], dtype=np.uint8)
GUM_COLOR = np.array([214, 132, 132, 255], dtype=np.uint8)


def decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    if len(mesh.faces) <= target_faces:
        return mesh
    reduction = 1.0 - (target_faces / len(mesh.faces))
    v, f = fs.simplify(mesh.vertices.astype(np.float32), mesh.faces.astype(np.int32), reduction)
    return trimesh.Trimesh(vertices=v, faces=f, process=False)


def quadrant_tens(upper: bool, negative_x: bool) -> int:
    right = negative_x if RIGHT_IS_NEGATIVE_X else (not negative_x)
    if upper:
        return 10 if right else 20
    return 40 if right else 30


def split_teeth(mesh: trimesh.Trimesh):
    m = mesh.copy()
    m.merge_vertices(digits_vertex=6)
    comps = [c for c in m.split(only_watertight=False) if len(c.faces) >= 20]
    comps.sort(key=lambda c: c.centroid[0])
    return comps


def assign_fdi(comps, upper: bool):
    """Return list of (fdi, mesh)."""
    xs = np.array([c.centroid[0] for c in comps])
    midline = np.median(xs)
    neg = [c for c in comps if c.centroid[0] < midline]
    pos = [c for c in comps if c.centroid[0] >= midline]
    neg.sort(key=lambda c: c.centroid[0])  # most negative first
    pos.sort(key=lambda c: c.centroid[0])  # closest to midline first
    out = []
    # negative side: closest to midline = position 1 -> so reverse order
    tens_neg = quadrant_tens(upper, True)
    for i, c in enumerate(reversed(neg)):  # reversed: index0 closest to midline
        out.append((tens_neg + i + 1, c))
    tens_pos = quadrant_tens(upper, False)
    for i, c in enumerate(pos):  # index0 closest to midline
        out.append((tens_pos + i + 1, c))
    return out


def main():
    scene = trimesh.load(SRC, process=False)
    geoms = scene.geometry

    teeth_entries = []
    for key, upper in [
        ("VH_F_set_of_upper_jaw_teeth", True),
        ("VH_F_set_of_lower_jaw_teeth", False),
    ]:
        comps = split_teeth(geoms[key])
        teeth_entries.extend(assign_fdi(comps, upper))

    # decimate lower teeth (dense); upper are already light
    processed = []
    for fdi, mesh in teeth_entries:
        target = 900 if len(mesh.faces) > 1500 else len(mesh.faces)
        d = decimate(mesh, target)
        d.visual = trimesh.visual.ColorVisuals(d, vertex_colors=np.tile(TEETH_COLOR, (len(d.vertices), 1)))
        processed.append((f"tooth_{fdi}", d))

    gums = []
    for key, name, target in [
        ("VH_F_ginviva_of_upper_jaw", "gum_upper", 9000),
        ("VH_F_gingiva_of_lower_jaw", "gum_lower", 12000),
    ]:
        g = decimate(geoms[key].copy(), target)
        g.visual = trimesh.visual.ColorVisuals(g, vertex_colors=np.tile(GUM_COLOR, (len(g.vertices), 1)))
        gums.append((name, g))

    all_meshes = processed + gums

    # global transform: recenter + scale to scene units
    allv = np.vstack([m.vertices for _, m in all_meshes])
    center = (allv.min(axis=0) + allv.max(axis=0)) / 2.0
    extent = (allv.max(axis=0) - allv.min(axis=0)).max()
    scale = 12.0 / extent

    out_scene = trimesh.Scene()
    for name, m in all_meshes:
        m.apply_translation(-center)
        m.apply_scale(scale)
        out_scene.add_geometry(m, node_name=name, geom_name=name)

    out_scene.export(OUT)
    n_teeth = len(processed)
    total_faces = sum(len(m.faces) for _, m in all_meshes)
    print(f"teeth={n_teeth} gums={len(gums)} total_faces={total_faces}")
    print("FDI:", sorted(int(n.split('_')[1]) for n, _ in processed))


if __name__ == "__main__":
    main()
