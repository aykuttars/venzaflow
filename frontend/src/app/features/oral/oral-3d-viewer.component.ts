import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  output,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import {
  PERMANENT_LOWER_LEFT,
  PERMANENT_LOWER_RIGHT,
  PERMANENT_UPPER_LEFT,
  PERMANENT_UPPER_RIGHT,
} from './odontogram.component';
import {
  JawBuildResult,
  Tooth3DObjects,
  applyToothVisuals,
  buildJawScene,
} from './oral-3d-jaw.builder';

const QUADRANTS = {
  PERMANENT_UPPER_RIGHT,
  PERMANENT_UPPER_LEFT,
  PERMANENT_LOWER_RIGHT,
  PERMANENT_LOWER_LEFT,
};

const GLTF_PATH = '/assets/3d/jaw-arch.glb';
const VIEW_HEIGHT = 480;

@Component({
  selector: 'app-oral-3d-viewer',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="oral-3d" [class.oral-3d--loading]="loading()">
      <canvas #canvas class="oral-3d__canvas"></canvas>
      @if (loading()) {
      <p class="oral-3d__status">{{ 'common.loading' | translate }}</p>
      }
      <p class="oral-3d__hint">{{ hint }}</p>
    </div>
  `,
  styles: [
    `
      .oral-3d {
        position: relative;
        width: 100%;
        min-height: 480px;
        border-radius: 12px;
        overflow: hidden;
        background: linear-gradient(180deg, #f5f0eb 0%, #ebe4dc 50%, #e8dfd6 100%);
        border: 1px solid rgba(196, 160, 120, 0.2);
      }
      .oral-3d__canvas { width: 100%; height: 480px; display: block; }
      .oral-3d__hint {
        position: absolute;
        left: 12px;
        bottom: 8px;
        margin: 0;
        font-size: 11px;
        color: rgba(60, 50, 40, 0.65);
        pointer-events: none;
      }
      .oral-3d__status {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        color: rgba(60, 50, 40, 0.8);
        font-size: 14px;
      }
    `,
  ],
})
export class Oral3dViewerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() teethState: Record<string, { condition?: string }> = {};
  @Input() selected: number[] = [];
  @Input() selectedSurfaces: string[] = [];
  @Input() treatedSurfacesByTooth: Record<string, string[]> = {};
  @Input() surfaceSelectEnabled = false;
  @Input() hint = 'Sürükleyerek döndürün · Dişe veya yüzeye tıklayın';

  toothSelect = output<number[]>();
  surfaceSelect = output<{ tooth: number; surface: string }>();

  private _loading = true;
  private renderer: any;
  private scene: any;
  private camera: any;
  private controls: any;
  private jaw!: JawBuildResult;
  private pickables: any[] = [];
  private animationId = 0;
  private raycaster: any;
  private pointer = { x: 0, y: 0 };
  private THREE: any;
  private initialized = false;
  private hoveredTooth: number | null = null;
  private resizeHandler = () => this.onResize();
  private pointerMoveHandler = (e: PointerEvent) => this.onPointerMove(e);
  private pointerDownHandler = (e: PointerEvent) => this.onPointerDown(e);

  loading(): boolean {
    return this._loading;
  }

  async ngAfterViewInit(): Promise<void> {
    this._loading = true;
    this.THREE = await import('three');
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    this.initScene(OrbitControls);
    await this.loadJaw();
    this._loading = false;
    this.initialized = true;
    this.refreshAllVisuals();
    this.animate();
    const canvas = this.canvasRef.nativeElement;
    canvas.addEventListener('pointerdown', this.pointerDownHandler);
    canvas.addEventListener('pointermove', this.pointerMoveHandler);
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resizeHandler);
    const canvas = this.canvasRef?.nativeElement;
    canvas?.removeEventListener('pointerdown', this.pointerDownHandler);
    canvas?.removeEventListener('pointermove', this.pointerMoveHandler);
    this.renderer?.dispose?.();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.initialized || !this.jaw) return;
    this.refreshAllVisuals();
  }

  private initScene(OrbitControls: any): void {
    const canvas = this.canvasRef.nativeElement;
    const THREE = this.THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0ebe4);
    this.scene.fog = new THREE.Fog(0xf0ebe4, 26, 60);

    this.camera = new THREE.PerspectiveCamera(38, canvas.clientWidth / VIEW_HEIGHT, 0.1, 120);
    this.camera.position.set(0, 3.2, 17);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(canvas.clientWidth, VIEW_HEIGHT);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    const hemi = new THREE.HemisphereLight(0xfff8f0, 0xe8d0c8, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdde8ff, 0.4);
    fill.position.set(-6, 6, -4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xfff0e0, 0.25);
    rim.position.set(0, 4, -10);
    this.scene.add(rim);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 0.8, -0.3);
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 26;
    this.raycaster = new THREE.Raycaster();
  }

  private async loadJaw(): Promise<void> {
    const gltfLoaded = await this.tryLoadGltf();
    if (!gltfLoaded) {
      this.jaw = buildJawScene(this.THREE, QUADRANTS, this.teethState);
      this.scene.add(this.jaw.rootGroup);
      this.pickables = this.jaw.pickables;
    }
  }

  private async tryLoadGltf(): Promise<boolean> {
    try {
      const THREE = this.THREE;
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(GLTF_PATH);
      const root = gltf.scene;
      root.name = 'jaw_arch_gltf';
      this.scene.add(root);

      const teeth = new Map<number, Tooth3DObjects>();
      const pickables: any[] = [];

      // Pass 1: collect + prep tooth meshes and gum meshes.
      const collected: { fdi: number; obj: any; center: any; size: any }[] = [];
      root.traverse((obj: any) => {
        if (!obj.isMesh || !obj.name) return;

        if (/^gum_/.test(obj.name)) {
          // Source GLB ships without NORMAL attributes; lighting needs them.
          if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
          obj.material = new THREE.MeshStandardMaterial({
            color: 0xd98a8a,
            roughness: 0.85,
            metalness: 0,
            vertexColors: false,
            side: THREE.DoubleSide,
          });
          obj.castShadow = false;
          obj.receiveShadow = true;
          return;
        }

        const toothMatch = /^tooth_(\d+)$/.exec(obj.name);
        if (!toothMatch) return;
        const fdi = Number(toothMatch[1]);

        if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();

        // Recenter geometry about its own centroid so hover/selection scaling
        // pivots correctly around the tooth.
        obj.geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        obj.geometry.boundingBox.getCenter(center);
        const size = new THREE.Vector3();
        obj.geometry.boundingBox.getSize(size);
        obj.geometry.translate(-center.x, -center.y, -center.z);
        obj.position.add(center);

        obj.material = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.32,
          metalness: 0.02,
          clearcoat: 0.4,
          clearcoatRoughness: 0.18,
          emissive: new THREE.Color(0x000000),
          side: THREE.DoubleSide,
        });
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.userData = { tooth: fdi, isCrown: true };
        pickables.push(obj);
        collected.push({ fdi, obj, center: obj.position.clone(), size });
      });

      if (collected.length === 0) {
        this.scene.remove(root);
        return false;
      }

      // Arch reference frame for surface classification.
      const archCx = collected.reduce((s, c) => s + c.center.x, 0) / collected.length;
      const archCz = collected.reduce((s, c) => s + c.center.z, 0) / collected.length;
      const midY = collected.reduce((s, c) => s + c.center.y, 0) / collected.length;
      const frontZ = Math.max(...collected.map((c) => c.center.z));

      const buildMarkers = (
        host: any,
        fdi: number,
        radial: any,
        mesial: any,
        occlusal: any,
        maxSize: number
      ): Map<string, any> => {
        const off = maxSize * 0.42;
        const dirs: [string, any][] = [
          ['M', mesial.clone().multiplyScalar(off)],
          ['D', mesial.clone().multiplyScalar(-off)],
          ['B', radial.clone().multiplyScalar(off)],
          ['L', radial.clone().multiplyScalar(-off)],
          ['O', occlusal.clone().multiplyScalar(off)],
        ];
        const surfaces = new Map<string, any>();
        for (const [code, pos] of dirs) {
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(maxSize * 0.22, 12, 10),
            new THREE.MeshStandardMaterial({
              color: 0x1976d2,
              transparent: true,
              opacity: 0,
              depthWrite: false,
            })
          );
          marker.position.copy(pos);
          marker.userData = { surface: code, isSurface: true, tooth: fdi };
          host.add(marker);
          surfaces.set(code, marker);
          pickables.push(marker);
        }
        return surfaces;
      };

      for (const { fdi, obj, center, size } of collected) {
        const upper = center.y > midY;
        const occlusal = new THREE.Vector3(0, upper ? -1 : 1, 0);
        const radial = new THREE.Vector3(center.x - archCx, 0, center.z - archCz);
        if (radial.lengthSq() < 1e-4) radial.set(0, 0, 1);
        radial.normalize();
        const mesial = new THREE.Vector3(radial.z, 0, -radial.x).normalize();
        const ref = new THREE.Vector3(-center.x, 0, frontZ - center.z);
        if (mesial.dot(ref) < 0) mesial.multiplyScalar(-1);

        const maxSize = Math.max(size.x, size.y, size.z);
        obj.userData.axes = { radial, mesial, occlusal, maxSize };
        const surfaces = buildMarkers(obj, fdi, radial, mesial, occlusal, maxSize);

        teeth.set(fdi, {
          tooth: fdi,
          group: obj,
          crown: obj,
          surfaces,
          rootMeshes: [],
          baseY: obj.position.y,
          isGltf: true,
        });
      }

      // Third molars (18/28/38/48) are absent in the source scan; synthesize
      // them by cloning each second molar distally along the arch.
      for (const [srcFdi, tgtFdi] of [
        [17, 18],
        [27, 28],
        [37, 38],
        [47, 48],
      ]) {
        if (teeth.has(tgtFdi)) continue;
        const src = teeth.get(srcFdi);
        if (!src) continue;
        const axes = src.group.userData.axes;
        const distal = axes.mesial.clone().multiplyScalar(-1);
        const step = axes.maxSize * 0.92;

        const mesh = new THREE.Mesh(src.group.geometry, src.group.material.clone());
        mesh.name = `tooth_${tgtFdi}`;
        mesh.position.copy(src.group.position).add(distal.multiplyScalar(step));
        mesh.position.y -= axes.maxSize * 0.05;
        mesh.scale.copy(src.group.scale).multiplyScalar(0.92);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { tooth: tgtFdi, isCrown: true, axes };
        root.add(mesh);
        pickables.push(mesh);

        const surfaces = buildMarkers(
          mesh,
          tgtFdi,
          axes.radial,
          axes.mesial,
          axes.occlusal,
          axes.maxSize * 0.92
        );
        teeth.set(tgtFdi, {
          tooth: tgtFdi,
          group: mesh,
          crown: mesh,
          surfaces,
          rootMeshes: [],
          baseY: mesh.position.y,
          baseScale: 0.92,
          isGltf: true,
        });
      }

      // Primary (deciduous) dentition, FDI 51-85: not present in the scan, so
      // synthesize a smaller secondary arch above the upper jaw and below the
      // lower jaw by cloning the matching permanent teeth.
      const bbox = new THREE.Box3().setFromObject(root);
      const upperBandY = bbox.max.y + 1.3;
      const lowerBandY = bbox.min.y - 1.3;
      const primaryPairs: [number, number][] = [];
      for (const [permTens, primTens] of [
        [10, 50],
        [20, 60],
        [30, 70],
        [40, 80],
      ]) {
        for (let p = 1; p <= 5; p++) primaryPairs.push([permTens + p, primTens + p]);
      }

      for (const [srcFdi, tgtFdi] of primaryPairs) {
        if (teeth.has(tgtFdi)) continue;
        const src = teeth.get(srcFdi);
        if (!src) continue;
        const axes = src.group.userData.axes;
        const upper = tgtFdi < 70;
        const scale = 0.72;

        const mesh = new THREE.Mesh(src.group.geometry, src.group.material.clone());
        mesh.name = `tooth_${tgtFdi}`;
        mesh.position.set(
          archCx + (src.group.position.x - archCx) * 0.82,
          (upper ? upperBandY : lowerBandY) + (src.group.position.y - midY) * 0.25,
          archCz + (src.group.position.z - archCz) * 0.82
        );
        mesh.scale.setScalar(scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { tooth: tgtFdi, isCrown: true, axes };
        root.add(mesh);
        pickables.push(mesh);

        const surfaces = buildMarkers(
          mesh,
          tgtFdi,
          axes.radial,
          axes.mesial,
          axes.occlusal,
          axes.maxSize
        );
        teeth.set(tgtFdi, {
          tooth: tgtFdi,
          group: mesh,
          crown: mesh,
          surfaces,
          rootMeshes: [],
          baseY: mesh.position.y,
          baseScale: scale,
          isGltf: true,
        });
      }

      this.jaw = { rootGroup: root, teeth, pickables };
      this.pickables = pickables;
      return true;
    } catch {
      return false;
    }
  }

  private refreshAllVisuals(): void {
    if (!this.jaw?.teeth) return;
    for (const [fdi, entry] of this.jaw.teeth) {
      const condition = this.teethState[String(fdi)]?.condition || 'healthy';
      const treated = this.treatedSurfacesByTooth[String(fdi)] || [];
      const highlighted = this.selected.includes(fdi) ? this.selectedSurfaces : [];
      applyToothVisuals(this.THREE, entry, {
        condition,
        selected: this.selected.includes(fdi),
        hovered: this.hoveredTooth === fdi,
        highlightedSurfaces: highlighted,
        treatedSurfaces: treated,
        surfaceSelectEnabled: this.surfaceSelectEnabled,
      });
    }
  }

  private resolveToothFromHit(hit: any): number | undefined {
    let tooth = hit.userData?.tooth as number | undefined;
    if (!tooth) {
      let p = hit.parent;
      while (p && !tooth) {
        const m = /^tooth_(\d+)$/.exec(p.name || '');
        if (m) tooth = Number(m[1]);
        p = p.parent;
      }
    }
    return tooth;
  }

  private onPointerMove(event: PointerEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster
      .intersectObjects(this.pickables, true)
      .filter((h: any) => h.object.visible !== false);
    const prev = this.hoveredTooth;
    this.hoveredTooth = hits.length ? this.resolveToothFromHit(hits[0].object) ?? null : null;
    if (prev !== this.hoveredTooth) {
      this.refreshAllVisuals();
      canvas.style.cursor = this.hoveredTooth ? 'pointer' : 'grab';
    }
  }

  private onPointerDown(event: PointerEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster
      .intersectObjects(this.pickables, true)
      .filter((h: any) => h.object.visible !== false);
    if (!hits.length) return;

    const hit = hits[0].object;
    const tooth = this.resolveToothFromHit(hit);
    if (!tooth) return;

    if (hit.userData?.isSurface && hit.userData?.surface) {
      if (this.surfaceSelectEnabled || this.selected.includes(tooth)) {
        this.surfaceSelect.emit({ tooth, surface: hit.userData.surface });
      }
      if (!this.selected.includes(tooth)) {
        this.toothSelect.emit([tooth]);
      }
      return;
    }

    const next =
      event.shiftKey || event.ctrlKey || event.metaKey
        ? this.selected.includes(tooth)
          ? this.selected.filter((t) => t !== tooth)
          : [...this.selected, tooth]
        : this.selected.includes(tooth) && this.selected.length === 1
          ? []
          : [tooth];
    this.toothSelect.emit(next);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls?.update?.();
    this.renderer?.render?.(this.scene, this.camera);
  };

  private onResize = (): void => {
    const canvas = this.canvasRef.nativeElement;
    if (!canvas.clientWidth) return;
    this.camera.aspect = canvas.clientWidth / VIEW_HEIGHT;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, VIEW_HEIGHT);
  };
}
