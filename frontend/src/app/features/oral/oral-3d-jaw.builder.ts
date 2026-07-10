/**
 * Builds an anatomical jaw arch with FDI-named tooth groups for 3D odontogram.
 * Procedural geometry: parabolic arch, per-tooth crown shapes, scalloped gingiva.
 */

export const CONDITION_COLORS: Record<string, number> = {
  healthy: 0xfffef8,
  caries: 0xffcdd2,
  filled: 0xbbdefb,
  root_canal: 0xffe0b2,
  crown: 0xd1c4e9,
  implant: 0xb2dfdb,
  missing: 0xe0e0e0,
  bridge: 0xc5cae9,
  extraction_planned: 0xffccbc,
};

export const SURFACE_CODES = ['M', 'D', 'B', 'L', 'O'] as const;
export type SurfaceCode = (typeof SURFACE_CODES)[number];

export interface Tooth3DObjects {
  tooth: number;
  group: any;
  crown: any;
  surfaces: Map<string, any>;
  overlay?: any;
  rootMeshes: any[];
  label?: any;
  baseY: number;
  baseScale?: number;
  isGltf?: boolean;
}

export interface JawBuildResult {
  rootGroup: any;
  teeth: Map<number, Tooth3DObjects>;
  pickables: any[];
}

type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar';

interface ToothDims {
  width: number;
  height: number;
  depth: number;
}

interface ArchPosition {
  x: number;
  y: number;
  z: number;
  rotY: number;
  upper: boolean;
  quadrant: 'ur' | 'ul' | 'lr' | 'll';
  dims: ToothDims;
}

/** Approximate mesiodistal crown widths (mm) scaled for scene units. */
const TOOTH_DIMS: Record<number, ToothDims> = {
  11: { width: 0.85, height: 1.05, depth: 0.55 },
  12: { width: 0.65, height: 1.0, depth: 0.5 },
  13: { width: 0.76, height: 1.15, depth: 0.58 },
  14: { width: 0.7, height: 0.95, depth: 0.72 },
  15: { width: 0.65, height: 0.9, depth: 0.7 },
  16: { width: 1.05, height: 0.95, depth: 0.82 },
  17: { width: 0.98, height: 0.9, depth: 0.78 },
  18: { width: 0.92, height: 0.88, depth: 0.75 },
  21: { width: 0.85, height: 1.05, depth: 0.55 },
  22: { width: 0.65, height: 1.0, depth: 0.5 },
  23: { width: 0.76, height: 1.15, depth: 0.58 },
  24: { width: 0.7, height: 0.95, depth: 0.72 },
  25: { width: 0.65, height: 0.9, depth: 0.7 },
  26: { width: 1.05, height: 0.95, depth: 0.82 },
  27: { width: 0.98, height: 0.9, depth: 0.78 },
  28: { width: 0.92, height: 0.88, depth: 0.75 },
  31: { width: 0.55, height: 0.95, depth: 0.48 },
  32: { width: 0.5, height: 0.9, depth: 0.45 },
  33: { width: 0.68, height: 1.05, depth: 0.55 },
  34: { width: 0.68, height: 0.88, depth: 0.68 },
  35: { width: 0.62, height: 0.85, depth: 0.65 },
  36: { width: 1.0, height: 0.88, depth: 0.78 },
  37: { width: 0.95, height: 0.85, depth: 0.75 },
  38: { width: 0.9, height: 0.82, depth: 0.72 },
  41: { width: 0.55, height: 0.95, depth: 0.48 },
  42: { width: 0.5, height: 0.9, depth: 0.45 },
  43: { width: 0.68, height: 1.05, depth: 0.55 },
  44: { width: 0.68, height: 0.88, depth: 0.68 },
  45: { width: 0.62, height: 0.85, depth: 0.65 },
  46: { width: 1.0, height: 0.88, depth: 0.78 },
  47: { width: 0.95, height: 0.85, depth: 0.75 },
  48: { width: 0.9, height: 0.82, depth: 0.72 },
};

function toothKind(fdi: number): ToothKind {
  const unit = fdi % 10;
  if (unit <= 2) return 'incisor';
  if (unit === 3) return 'canine';
  if (unit <= 5) return 'premolar';
  return 'molar';
}

function quadrant(fdi: number): 'ur' | 'ul' | 'lr' | 'll' {
  const q = Math.floor(fdi / 10);
  if (q === 1) return 'ur';
  if (q === 2) return 'ul';
  if (q === 3) return 'll';
  return 'lr';
}

function dimsFor(fdi: number): ToothDims {
  return TOOTH_DIMS[fdi] || { width: 0.7, height: 0.9, depth: 0.65 };
}

/** Parabolic arch: place teeth contact-to-contact along curve. */
function layoutArch(
  teeth: number[],
  upper: boolean,
  side: 'right' | 'left'
): Map<number, ArchPosition> {
  const map = new Map<number, ArchPosition>();
  const archWidth = upper ? 4.6 : 4.2;
  const archDepth = upper ? 1.8 : 1.5;
  const yBase = upper ? 1.35 : -1.35;
  const sign = side === 'right' ? -1 : 1;

  let cumulative = 0;
  const widths = teeth.map((t) => dimsFor(t).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const startOffset = -totalWidth / 2;

  teeth.forEach((fdi, i) => {
    const w = widths[i];
    const centerAlong = startOffset + cumulative + w / 2;
    cumulative += w;

    const t = (centerAlong + totalWidth / 2) / totalWidth;
    const normalized = (t - 0.5) * 2;
    const x = sign * (Math.abs(normalized) * archWidth + (normalized === 0 ? 0 : 0.15));
    const z = -Math.pow(Math.abs(normalized), 1.6) * archDepth;
    const rotY = sign < 0 ? normalized * 0.42 : -normalized * 0.42;

    map.set(fdi, {
      x,
      y: yBase,
      z,
      rotY,
      upper,
      quadrant: quadrant(fdi),
      dims: dimsFor(fdi),
    });
  });

  return map;
}

function layoutPositions(quadrants: {
  PERMANENT_UPPER_RIGHT: number[];
  PERMANENT_UPPER_LEFT: number[];
  PERMANENT_LOWER_RIGHT: number[];
  PERMANENT_LOWER_LEFT: number[];
}): Map<number, ArchPosition> {
  const map = new Map<number, ArchPosition>();
  for (const [teeth, upper, side] of [
    [quadrants.PERMANENT_UPPER_RIGHT, true, 'right'],
    [quadrants.PERMANENT_UPPER_LEFT, true, 'left'],
    [quadrants.PERMANENT_LOWER_RIGHT, false, 'right'],
    [quadrants.PERMANENT_LOWER_LEFT, false, 'left'],
  ] as const) {
    for (const [fdi, pos] of layoutArch(teeth, upper, side)) {
      map.set(fdi, pos);
    }
  }
  return map;
}

function createEnamelMaterial(THREE: any, color: number): any {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.02,
    roughness: 0.28,
    clearcoat: 0.35,
    clearcoatRoughness: 0.15,
    side: THREE.DoubleSide,
  });
}

function createIncisorCrown(THREE: any, dims: ToothDims, color: number): any {
  const shape = new THREE.Shape();
  const hw = dims.width / 2;
  const hd = dims.depth / 2;
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw * 0.85, dims.height * 0.3);
  shape.lineTo(-hw * 0.7, dims.height * 0.7);
  shape.lineTo(-hw * 0.5, dims.height);
  shape.lineTo(hw * 0.5, dims.height);
  shape.lineTo(hw * 0.7, dims.height * 0.7);
  shape.lineTo(hw * 0.85, dims.height * 0.3);
  shape.lineTo(hw, 0);
  shape.lineTo(-hw, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: hd * 2,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -hd);
  const mesh = new THREE.Mesh(geo, createEnamelMaterial(THREE, color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCanineCrown(THREE: any, dims: ToothDims, color: number): any {
  const points = [
    new THREE.Vector2(0, dims.height),
    new THREE.Vector2(dims.width * 0.45, dims.height * 0.55),
    new THREE.Vector2(dims.width * 0.5, dims.height * 0.2),
    new THREE.Vector2(dims.width * 0.35, 0),
    new THREE.Vector2(0, 0),
  ];
  const geo = new THREE.LatheGeometry(points, 12);
  geo.scale(1, 1, dims.depth / dims.width);
  const mesh = new THREE.Mesh(geo, createEnamelMaterial(THREE, color));
  mesh.castShadow = true;
  return mesh;
}

function createPremolarCrown(THREE: any, dims: ToothDims, color: number): any {
  const group = new THREE.Group();
  const mat = createEnamelMaterial(THREE, color);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width, dims.height * 0.55, dims.depth, 2, 1, 2),
    mat
  );
  body.position.y = dims.height * 0.28;
  body.castShadow = true;

  const buccal = new THREE.Mesh(
    new THREE.SphereGeometry(dims.width * 0.28, 10, 8),
    mat.clone()
  );
  buccal.position.set(0, dims.height * 0.62, dims.depth * 0.22);
  buccal.scale.set(1.1, 0.7, 0.9);

  const lingual = new THREE.Mesh(
    new THREE.SphereGeometry(dims.width * 0.22, 10, 8),
    mat.clone()
  );
  lingual.position.set(0, dims.height * 0.58, -dims.depth * 0.18);
  lingual.scale.set(0.9, 0.65, 0.85);

  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width * 0.08, dims.height * 0.15, dims.depth * 0.9),
    new THREE.MeshStandardMaterial({ color: 0xddd5c8, roughness: 0.5 })
  );
  groove.position.y = dims.height * 0.55;

  group.add(body, buccal, lingual, groove);
  return group;
}

function createMolarCrown(THREE: any, dims: ToothDims, color: number): any {
  const group = new THREE.Group();
  const mat = createEnamelMaterial(THREE, color);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width, dims.height * 0.45, dims.depth, 3, 1, 3),
    mat
  );
  body.position.y = dims.height * 0.22;
  body.castShadow = true;

  const cuspPositions: [number, number][] = [
    [-dims.width * 0.28, dims.depth * 0.22],
    [dims.width * 0.28, dims.depth * 0.22],
    [-dims.width * 0.28, -dims.depth * 0.22],
    [dims.width * 0.28, -dims.depth * 0.22],
  ];
  for (const [cx, cz] of cuspPositions) {
    const cusp = new THREE.Mesh(
      new THREE.SphereGeometry(dims.width * 0.22, 10, 8),
      mat.clone()
    );
    cusp.position.set(cx, dims.height * 0.55, cz);
    cusp.scale.set(1, 0.75, 1);
    group.add(cusp);
  }

  const fossa = new THREE.Mesh(
    new THREE.CylinderGeometry(dims.width * 0.12, dims.width * 0.15, dims.height * 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0xddd5c8, roughness: 0.5 })
  );
  fossa.position.y = dims.height * 0.48;

  group.add(body, fossa);
  return group;
}

function createCrownMesh(THREE: any, fdi: number, dims: ToothDims, color: number): any {
  const kind = toothKind(fdi);
  switch (kind) {
    case 'incisor':
      return createIncisorCrown(THREE, dims, color);
    case 'canine':
      return createCanineCrown(THREE, dims, color);
    case 'premolar':
      return createPremolarCrown(THREE, dims, color);
    case 'molar':
    default:
      return createMolarCrown(THREE, dims, color);
  }
}

function createSurfaceMarkers(
  THREE: any,
  dims: ToothDims,
  quad: 'ur' | 'ul' | 'lr' | 'll'
): Map<string, any> {
  const map = new Map<string, any>();
  const hw = dims.width * 0.42;
  const hd = dims.depth * 0.42;
  const h = dims.height * 0.55;

  const mesialSign = quad === 'ur' || quad === 'lr' ? -1 : 1;

  const defs: [string, number, number, number][] = [
    ['M', mesialSign * hw, h, 0],
    ['D', -mesialSign * hw, h, 0],
    ['B', 0, h, hd],
    ['L', 0, h, -hd],
    ['O', 0, dims.height * 0.72, 0],
  ];

  for (const [code, x, y, z] of defs) {
    const geo = new THREE.BoxGeometry(dims.width * 0.35, dims.height * 0.35, dims.depth * 0.25);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1976d2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.userData = { surface: code, isSurface: true };
    map.set(code, mesh);
  }
  return map;
}

function createOverlay(THREE: any, condition: string, dims: ToothDims): any | undefined {
  if (condition === 'root_canal') {
    const geo = new THREE.CylinderGeometry(dims.width * 0.12, dims.width * 0.12, dims.height * 0.9, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffb74d, transparent: true, opacity: 0.5 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, dims.height * 0.45, 0);
    return m;
  }
  if (condition === 'crown' || condition === 'bridge') {
    const geo = new THREE.CylinderGeometry(dims.width * 0.48, dims.width * 0.5, dims.height * 0.35, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9575cd, transparent: true, opacity: 0.5 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = dims.height * 0.82;
    return m;
  }
  if (condition === 'implant') {
    const group = new THREE.Group();
    const screw = new THREE.Mesh(
      new THREE.CylinderGeometry(dims.width * 0.15, dims.width * 0.15, dims.height * 1.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.6, roughness: 0.35 })
    );
    screw.position.y = dims.height * 0.35;
    const abutment = new THREE.Mesh(
      new THREE.CylinderGeometry(dims.width * 0.2, dims.width * 0.22, dims.height * 0.25, 10),
      new THREE.MeshStandardMaterial({ color: 0xb2dfdb })
    );
    abutment.position.y = dims.height * 0.88;
    group.add(screw, abutment);
    return group;
  }
  return undefined;
}

function createToothLabel(THREE: any, fdi: number): any {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = '#333';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(fdi), 32, 16);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.55, 0.28, 1);
  sprite.position.y = -0.15;
  sprite.userData = { isLabel: true };
  return sprite;
}

function createGumArch(THREE: any, positions: Map<number, ArchPosition>): any {
  const group = new THREE.Group();
  const gumMat = new THREE.MeshStandardMaterial({
    color: 0xf4a0a0,
    roughness: 0.88,
    metalness: 0,
  });

  for (const upper of [true, false]) {
    const teeth = [...positions.entries()].filter(([, p]) => p.upper === upper);
    if (!teeth.length) continue;

    const archGroup = new THREE.Group();
    const y = upper ? 1.35 : -1.35;

    for (const [fdi, pos] of teeth) {
      const scallop = new THREE.Mesh(
        new THREE.SphereGeometry(pos.dims.width * 0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        gumMat
      );
      scallop.position.set(pos.x, y, pos.z);
      scallop.rotation.x = upper ? -Math.PI / 2 : Math.PI / 2;
      scallop.scale.set(1.1, 0.35, 1);
      archGroup.add(scallop);
    }

    const curve = new THREE.EllipseCurve(0, 0, upper ? 4.8 : 4.4, upper ? 1.4 : 1.2, 0, Math.PI, false, 0);
    const pts = curve.getPoints(64);
    const shape = new THREE.Shape(pts.map((p: { x: number; y: number }) => new THREE.Vector2(p.x, p.y)));
    const ridge = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 }),
      gumMat
    );
    ridge.rotation.x = upper ? -Math.PI / 2 : Math.PI / 2;
    ridge.position.set(0, y + (upper ? -0.12 : 0.12), -0.6);
    archGroup.add(ridge);

    if (upper) {
      const palate = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xf8d0d0, roughness: 0.9 })
      );
      palate.rotation.x = Math.PI;
      palate.position.set(0, y + 0.8, -1.2);
      palate.scale.set(1.2, 0.4, 0.8);
      archGroup.add(palate);
    } else {
      const floor = new THREE.Mesh(
        new THREE.SphereGeometry(2.8, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xf0b8b8, roughness: 0.92 })
      );
      floor.position.set(0, y - 0.6, -0.8);
      floor.scale.set(1.1, 0.35, 0.7);
      archGroup.add(floor);
    }

    group.add(archGroup);
  }

  return group;
}

export function buildJawScene(
  THREE: any,
  quadrants: {
    PERMANENT_UPPER_RIGHT: number[];
    PERMANENT_UPPER_LEFT: number[];
    PERMANENT_LOWER_RIGHT: number[];
    PERMANENT_LOWER_LEFT: number[];
  },
  teethState: Record<string, { condition?: string }> = {}
): JawBuildResult {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'jaw_arch';

  const positions = layoutPositions(quadrants);
  rootGroup.add(createGumArch(THREE, positions));

  const teeth = new Map<number, Tooth3DObjects>();
  const pickables: any[] = [];
  const allFdi = [
    ...quadrants.PERMANENT_UPPER_RIGHT,
    ...quadrants.PERMANENT_UPPER_LEFT,
    ...quadrants.PERMANENT_LOWER_RIGHT,
    ...quadrants.PERMANENT_LOWER_LEFT,
  ];

  for (const fdi of allFdi) {
    const pos = positions.get(fdi)!;
    const condition = teethState[String(fdi)]?.condition || 'healthy';
    const isMissing = condition === 'missing';

    const group = new THREE.Group();
    group.name = `tooth_${fdi}`;
    group.position.set(pos.x, pos.y, pos.z);
    group.rotation.y = pos.rotY;
    group.rotation.x = pos.upper ? -0.15 : 0.15;

    let crown: any;
    let surfaces = new Map<string, any>();
    let overlay: any;
    const label = createToothLabel(THREE, fdi);
    group.add(label);

    if (!isMissing) {
      const color = CONDITION_COLORS[condition] ?? CONDITION_COLORS['healthy'];
      crown = createCrownMesh(THREE, fdi, pos.dims, color);
      crown.userData = { tooth: fdi, isCrown: true };
      group.add(crown);
      surfaces = createSurfaceMarkers(THREE, pos.dims, pos.quadrant);
      surfaces.forEach((m) => group.add(m));
      overlay = createOverlay(THREE, condition, pos.dims);
      if (overlay) group.add(overlay);
      pickables.push(crown, ...surfaces.values());
    } else {
      const ghost = new THREE.Mesh(
        new THREE.BoxGeometry(pos.dims.width, pos.dims.height * 0.4, pos.dims.depth),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.2, wireframe: true })
      );
      ghost.position.y = pos.dims.height * 0.3;
      ghost.userData = { tooth: fdi, isMissing: true };
      group.add(ghost);
      pickables.push(ghost);
      crown = ghost;
    }

    rootGroup.add(group);
    teeth.set(fdi, { tooth: fdi, group, crown, surfaces, overlay, rootMeshes: [], label, baseY: pos.y });
  }

  return { rootGroup, teeth, pickables };
}

export function applyToothVisuals(
  THREE: any,
  entry: Tooth3DObjects,
  opts: {
    condition: string;
    selected: boolean;
    hovered: boolean;
    highlightedSurfaces: string[];
    treatedSurfaces: string[];
    surfaceSelectEnabled: boolean;
  }
): void {
  const { condition, selected, hovered, highlightedSurfaces, treatedSurfaces, surfaceSelectEnabled } = opts;
  const isMissing = condition === 'missing';

  if (entry.isGltf) {
    entry.group.visible = !isMissing;
    if (isMissing) return;
  } else {
    entry.group.visible = true;
  }

  const applyColorToMesh = (mesh: any) => {
    if (!mesh?.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const color = CONDITION_COLORS[condition] ?? CONDITION_COLORS['healthy'];
    for (const mat of mats) {
      if (mat.color) {
        mat.color.setHex(color);
        if (mat.emissive) {
          mat.emissive.setHex(selected ? 0x2244aa : hovered ? 0x334466 : 0x000000);
          mat.emissiveIntensity = selected ? 0.4 : hovered ? 0.15 : 0;
        }
      }
    }
  };

  if (!isMissing && entry.crown) {
    if (entry.crown.isGroup) {
      entry.crown.traverse((child: any) => {
        if (child.isMesh && child.material?.color && child.material.color.getHex() !== 0xddd5c8) {
          applyColorToMesh(child);
        }
      });
    } else {
      applyColorToMesh(entry.crown);
    }
  }

  const baseScale = entry.baseScale ?? 1;
  entry.group.scale.setScalar(baseScale * (selected ? 1.08 : hovered ? 1.03 : 1));
  entry.group.position.y = entry.baseY + (selected ? 0.05 : 0);

  if (entry.label?.material) {
    entry.label.material.opacity = selected || hovered ? 0.95 : 0;
  }

  for (const [code, mesh] of entry.surfaces) {
    const isHighlighted = highlightedSurfaces.includes(code);
    const isTreated = treatedSurfaces.includes(code);
    const showPicker = surfaceSelectEnabled && selected;
    if (isHighlighted) {
      mesh.material.color.setHex(0x1976d2);
      mesh.material.opacity = 0.65;
    } else if (isTreated) {
      mesh.material.color.setHex(0x43a047);
      mesh.material.opacity = 0.5;
    } else if (showPicker) {
      mesh.material.color.setHex(0x1976d2);
      mesh.material.opacity = 0.15;
    } else {
      mesh.material.opacity = 0;
    }
    // Visible (and pickable) only when it should react; keeps invisible
    // markers from hijacking plain tooth clicks/deselection.
    mesh.visible = !isMissing && (isHighlighted || isTreated || showPicker);
  }
}
