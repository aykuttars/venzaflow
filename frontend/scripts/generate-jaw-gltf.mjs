#!/usr/bin/env node
/**
 * Generates frontend/public/assets/3d/jaw-arch.gltf from the procedural jaw builder.
 * Run: node frontend/scripts/generate-jaw-gltf.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// GLTFExporter expects browser FileReader when embedding buffers.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = null;
    onload = null;
    readAsArrayBuffer(input) {
      Promise.resolve().then(() => {
        if (input instanceof ArrayBuffer) {
          this.result = input;
        } else if (input?.buffer instanceof ArrayBuffer) {
          this.result = input.buffer;
        } else if (typeof input === 'object' && input !== null) {
          this.result = input;
        }
        this.onload?.({ target: this });
      });
    }
  };
}
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/assets/3d');
mkdirSync(outDir, { recursive: true });

const PERMANENT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const PERMANENT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const PERMANENT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const PERMANENT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

// Inline minimal build (mirrors oral-3d-jaw.builder.ts layout)
function toothKind(fdi) {
  const unit = fdi % 10;
  if (unit <= 2) return 'incisor';
  if (unit === 3) return 'canine';
  if (unit <= 5) return 'premolar';
  return 'molar';
}

function crownProfile(kind) {
  const profiles = {
    incisor: [[0,0],[0.22,0.15],[0.28,0.45],[0.26,0.75],[0.18,0.95],[0.08,1],[0,0.92]],
    canine: [[0,0],[0.2,0.12],[0.32,0.35],[0.35,0.65],[0.28,0.88],[0.15,1],[0,0.9]],
    premolar: [[0,0],[0.25,0.2],[0.38,0.5],[0.36,0.78],[0.22,0.98],[0.08,1],[0,0.88]],
    molar: [[0,0],[0.3,0.18],[0.42,0.48],[0.4,0.72],[0.28,0.95],[0.12,1],[0,0.9]],
  };
  return profiles[kind];
}

function layoutPositions() {
  const map = new Map();
  const place = (teeth, upper, sign) => {
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

const scene = new THREE.Scene();
scene.name = 'jaw_arch';
const positions = layoutPositions();
const all = [...PERMANENT_UPPER_RIGHT, ...PERMANENT_UPPER_LEFT, ...PERMANENT_LOWER_RIGHT, ...PERMANENT_LOWER_LEFT];

for (const fdi of all) {
  const pos = positions.get(fdi);
  const kind = toothKind(fdi);
  const group = new THREE.Group();
  group.name = `tooth_${fdi}`;
  group.position.set(pos.x, pos.y, pos.z);
  group.rotation.y = pos.rotY;
  group.rotation.x = pos.upper ? -0.2 : 0.2;

  const points = crownProfile(kind).map(([r, y]) => new THREE.Vector2(r, y));
  const crown = new THREE.Mesh(
    new THREE.LatheGeometry(points, 16),
    new THREE.MeshStandardMaterial({ color: 0xfffef8, roughness: 0.42 })
  );
  crown.name = `crown_${fdi}`;
  group.add(crown);

  const rootGeo = new THREE.ConeGeometry(0.12, 0.9, 8);
  const rootMat = new THREE.MeshStandardMaterial({ color: 0xddb896 });
  const root = new THREE.Mesh(rootGeo, rootMat);
  root.position.y = 1.35;
  root.rotation.x = Math.PI;
  root.name = `root_${fdi}`;
  group.add(root);

  for (const [code, x, y, z] of [
    ['M', -0.32, 0.55, 0],
    ['D', 0.32, 0.55, 0],
    ['B', 0, 0.55, 0.28],
    ['L', 0, 0.55, -0.28],
    ['O', 0, 0.82, 0],
  ]) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1976d2, transparent: true, opacity: 0.01 })
    );
    s.position.set(x, y, z);
    s.name = `surface_${fdi}_${code}`;
    group.add(s);
  }

  scene.add(group);
}

const exporter = new GLTFExporter();
const gltf = await exporter.parseAsync(scene, { binary: false, embedImages: false });
const outPath = join(outDir, 'jaw-arch.gltf');
writeFileSync(outPath, JSON.stringify(gltf, null, 2));
console.log('Wrote', outPath, `(${all.length} teeth)`);
