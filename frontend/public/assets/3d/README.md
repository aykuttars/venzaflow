# 3D Jaw Assets

## Runtime model: `jaw-arch.glb` (real anatomy)

The oral 3D viewer loads `jaw-arch.glb`, a real anatomical mouth model derived
from the **NIH 3D "Mouth, Female" Human Reference Atlas** reference organ
(Visible Human dataset, **CC0 / public domain**).

- 28 individual teeth (FDI `tooth_11` … `tooth_47`, no third molars in the source scan)
- Upper and lower gingiva (`gum_upper`, `gum_lower`) for context
- Each tooth is a separate, named, clickable mesh
- Optimized for web: ~1.5 MB (decimated from the 103 MB source)

The viewer ([../../../src/app/features/oral/oral-3d-viewer.component.ts](../../../src/app/features/oral/oral-3d-viewer.component.ts))
maps nodes by `tooth_{FDI}` name, applies enamel/gum materials, and drives
condition tinting, hover, and selection. If `jaw-arch.glb` is missing or fails
to load, it falls back to the procedural builder in `oral-3d-jaw.builder.ts`.

## Regenerating `jaw-arch.glb` from the NIH source

The model was produced by `scripts/build_jaw.py`, which:

1. Loads the NIH source GLB.
2. Splits the two "set of teeth" meshes into individual teeth (connected
   components after vertex merge) and assigns FDI names by arch position.
3. Decimates teeth + keeps decimated gingiva, drops tongue/palate/glands.
4. Recenters/scales into scene units and exports a compact GLB.

```bash
# 1. download the CC0 source (~103 MB) from NIH 3D entry 3DPX-022826
curl -L -o /tmp/mouth.glb "https://3d.nih.gov/api/files/741566"

# 2. install mesh tooling
python3 -m venv .venv-mesh
.venv-mesh/bin/pip install numpy trimesh fast-simplification scipy networkx

# 3. build the per-tooth GLB
.venv-mesh/bin/python scripts/build_jaw.py /tmp/mouth.glb frontend/public/assets/3d/jaw-arch.glb
```

Source: https://3d.nih.gov/entries/3DPX-022826 (License: CC0 1.0 Public Domain).

## Replacing with a licensed artist model

Export GLTF/GLB with one mesh per FDI tooth named `tooth_11`, etc. (optionally
`gum_upper` / `gum_lower`). Place at `public/assets/3d/jaw-arch.glb`. No code
changes required.
