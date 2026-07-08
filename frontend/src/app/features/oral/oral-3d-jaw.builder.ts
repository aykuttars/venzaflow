/**
 * Builds an anatomical jaw arch with FDI-named tooth groups for 3D odontogram.
 * Each tooth: crown (lathe), roots, 5 clickable surface markers, condition overlays.
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
}

export interface JawBuildResult {
  rootGroup: any;
  teeth: Map<number, Tooth3DObjects>;
  pickables: any[];
}

type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar';

function toothKind(fdi: number): ToothKind {
  const unit = fdi % 10;
  if (unit <= 2) return 'incisor';
  if (unit === 3) return 'canine';
  if (unit <= 5) return 'premolar';
  return 'molar';
}

function crownProfile(kind: ToothKind): [number, number][] {
  switch (kind) {
    case 'incisor':
      return [
        [0, 0],
        [0.22, 0.15],
        [0.28, 0.45],
        [0.26, 0.75],
        [0.18, 0.95],
        [0.08, 1.0],
        [0, 0.92],
      ];
    case 'canine':
      return [
        [0, 0],
        [0.2, 0.12],
        [0.32, 0.35],
        [0.35, 0.65],
        [0.28, 0.88],
        [0.15, 1.0],
        [0, 0.9],
      ];
    case 'premolar':
      return [
        [0, 0],
        [0.25, 0.2],
        [0.38, 0.5],
        [0.36, 0.78],
        [0.22, 0.98],
        [0.08, 1.0],
        [0, 0.88],
      ];
    case 'molar':
    default:
      return [
        [0, 0],
        [0.3, 0.18],
        [0.42, 0.48],
        [0.4, 0.72],
        [0.28, 0.95],
        [0.12, 1.0],
        [0, 0.9],
      ];
  }
}

function layoutPositions(
  PERMANENT_UPPER_RIGHT: number[],
  PERMANENT_UPPER_LEFT: number[],
  PERMANENT_LOWER_RIGHT: number[],
  PERMANENT_LOWER_LEFT: number[]
): Map<number, { x: number; y: number; z: number; rotY: number; upper: boolean }> {
  const map = new Map<number, { x: number; y: number; z: number; rotY: number; upper: boolean }>();
  const place = (teeth: number[], upper: boolean, sign: number) => {
    teeth.forEach((t, i) => {
      const center = (teeth.length - 1) / 2;
      const dist = (i - center) / center;
      const x = sign * (Math.abs(dist) * 3.8 + (dist === 0 ? 0 : 0.4));
      const z = -Math.abs(dist) * 1.6;
      const rotY = sign < 0 ? dist * 0.35 : -dist * 0.35;
      map.set(t, { x, y: upper ? 2.1 : -2.1, z, rotY, upper });
    });
  };
  place(PERMANENT_UPPER_RIGHT, true, -1);
  place(PERMANENT_UPPER_LEFT, true, 1);
  place(PERMANENT_LOWER_RIGHT, false, -1);
  place(PERMANENT_LOWER_LEFT, false, 1);
  return map;
}

function createCrownMesh(THREE: any, kind: ToothKind, color: number): any {
  const points = crownProfile(kind).map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(points, 16);
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.08,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

function createRootMeshes(THREE: any, kind: ToothKind): any[] {
  const rootMat = new THREE.MeshStandardMaterial({ color: 0xddb896, roughness: 0.65 });
  const meshes: any[] = [];
  const makeRoot = (x: number, scale: number) => {
    const geo = new THREE.ConeGeometry(0.12 * scale, 0.9, 8);
    const m = new THREE.Mesh(geo, rootMat);
    m.position.set(x, 1.35, 0);
    m.rotation.x = Math.PI;
    return m;
  };
  if (kind === 'incisor' || kind === 'canine') {
    meshes.push(makeRoot(0, 1));
  } else if (kind === 'premolar') {
    meshes.push(makeRoot(-0.12, 0.85));
    meshes.push(makeRoot(0.12, 0.85));
  } else {
    meshes.push(makeRoot(-0.18, 1));
    meshes.push(makeRoot(0, 1.1));
    meshes.push(makeRoot(0.18, 1));
  }
  return meshes;
}

function createSurfaceMarkers(THREE: any): Map<string, any> {
  const map = new Map<string, any>();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1976d2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const activeMat = new THREE.MeshStandardMaterial({
    color: 0x1976d2,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const defs: [string, number, number, number][] = [
    ['M', -0.32, 0.55, 0],
    ['D', 0.32, 0.55, 0],
    ['B', 0, 0.55, 0.28],
    ['L', 0, 0.55, -0.28],
    ['O', 0, 0.82, 0],
  ];
  for (const [code, x, y, z] of defs) {
    const geo = new THREE.BoxGeometry(0.22, 0.28, 0.12);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(x, y, z);
    mesh.userData = { surface: code, isSurface: true };
    mesh.userData.activeMaterial = activeMat.clone();
    map.set(code, mesh);
  }
  return map;
}

function createOverlay(THREE: any, condition: string): any | undefined {
  if (condition === 'root_canal') {
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffb74d, transparent: true, opacity: 0.5 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, 0.95, 0);
    m.rotation.x = Math.PI;
    return m;
  }
  if (condition === 'crown' || condition === 'bridge') {
    const geo = new THREE.TorusGeometry(0.3, 0.06, 8, 20);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9575cd, transparent: true, opacity: 0.45 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, 0.88, 0);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  if (condition === 'implant') {
    const geo = new THREE.CylinderGeometry(0.08, 0.08, 1.3, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0x78909c });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, 1.0, 0);
    m.rotation.x = Math.PI;
    return m;
  }
  return undefined;
}

function createGumArch(THREE: any): any {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf4a8a8, roughness: 0.85, metalness: 0 });
  for (const y of [1.75, -1.75]) {
    const curve = new THREE.EllipseCurve(0, 0, 4.2, 1.2, 0, Math.PI, false, 0);
    const points = curve.getPoints(48);
    const shape = new THREE.Shape(points.map((p: { x: number; y: number }) => new THREE.Vector2(p.x, p.y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = y > 0 ? -Math.PI / 2 : Math.PI / 2;
    mesh.position.y = y;
    mesh.position.z = -0.5;
    group.add(mesh);
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
  rootGroup.add(createGumArch(THREE));

  const positions = layoutPositions(
    quadrants.PERMANENT_UPPER_RIGHT,
    quadrants.PERMANENT_UPPER_LEFT,
    quadrants.PERMANENT_LOWER_RIGHT,
    quadrants.PERMANENT_LOWER_LEFT
  );

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
    const kind = toothKind(fdi);
    const condition = teethState[String(fdi)]?.condition || 'healthy';
    const isMissing = condition === 'missing';

    const group = new THREE.Group();
    group.name = `tooth_${fdi}`;
    group.position.set(pos.x, pos.y, pos.z);
    group.rotation.y = pos.rotY;
    group.rotation.x = pos.upper ? -0.2 : 0.2;

    let crown: any;
    let rootMeshes: any[] = [];
    let surfaces = new Map<string, any>();
    let overlay: any;

    if (!isMissing) {
      const color = CONDITION_COLORS[condition] ?? CONDITION_COLORS['healthy'];
      crown = createCrownMesh(THREE, kind, color);
      crown.userData = { tooth: fdi, isCrown: true };
      group.add(crown);
      rootMeshes = createRootMeshes(THREE, kind);
      rootMeshes.forEach((r) => group.add(r));
      surfaces = createSurfaceMarkers(THREE);
      surfaces.forEach((m) => group.add(m));
      overlay = createOverlay(THREE, condition);
      if (overlay) group.add(overlay);
      pickables.push(crown, ...surfaces.values());
    } else {
      const ghost = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.25 })
      );
      ghost.position.y = 0.5;
      ghost.userData = { tooth: fdi, isMissing: true };
      group.add(ghost);
      pickables.push(ghost);
      crown = ghost;
    }

    rootGroup.add(group);
    teeth.set(fdi, { tooth: fdi, group, crown, surfaces, overlay, rootMeshes });
  }

  return { rootGroup, teeth, pickables };
}

export function applyToothVisuals(
  THREE: any,
  entry: Tooth3DObjects,
  opts: {
    condition: string;
    selected: boolean;
    highlightedSurfaces: string[];
    treatedSurfaces: string[];
    surfaceSelectEnabled: boolean;
  }
): void {
  const { condition, selected, highlightedSurfaces, treatedSurfaces, surfaceSelectEnabled } = opts;
  const isMissing = condition === 'missing';

  entry.group.visible = true;
  if (!isMissing && entry.crown?.material?.color) {
    const color = CONDITION_COLORS[condition] ?? CONDITION_COLORS['healthy'];
    entry.crown.material.color.setHex(color);
    entry.crown.material.emissive = entry.crown.material.emissive || new THREE.Color(0x000000);
    entry.crown.material.emissive.setHex(selected ? 0x2244aa : 0x000000);
    entry.crown.material.emissiveIntensity = selected ? 0.35 : 0;
  }

  entry.group.scale.setScalar(selected ? 1.12 : 1);

  const allSurf = new Set([...highlightedSurfaces, ...treatedSurfaces]);
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
      mesh.material.opacity = 0.1;
    } else {
      mesh.material.opacity = 0;
    }
    mesh.visible = !isMissing;
  }
}
