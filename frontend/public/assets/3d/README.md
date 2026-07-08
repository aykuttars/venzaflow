# 3D Jaw Assets

## Canonical model (runtime)

The oral 3D viewer builds an anatomical jaw procedurally via `oral-3d-jaw.builder.ts`:

- 32 FDI-named groups (`tooth_11` … `tooth_48`)
- Lathe-profile crowns (incisor / canine / premolar / molar)
- Roots, gum arch, condition overlays (kanal, kron, implant)
- Clickable surface markers (M, D, B, L, O)

This runs automatically when the 3D tab is opened.

## Optional GLTF (`jaw-arch.gltf`)

To export a static GLTF for faster load or external editing:

```bash
cd frontend
npm install
npm run gen:jaw-gltf
```

Output: `public/assets/3d/jaw-arch.gltf`

If present, the viewer loads GLTF first and maps nodes by `tooth_{FDI}` / `surface_{FDI}_{M|D|B|L|O}` names.
If missing or invalid, the procedural builder is used (same layout).

## Replacing with a licensed artist model

1. Export GLTF/GLB with one group per FDI tooth named `tooth_11`, etc.
2. Add surface meshes named `surface_11_M`, … or rely on procedural surfaces.
3. Place file at `public/assets/3d/jaw-arch.gltf`.
