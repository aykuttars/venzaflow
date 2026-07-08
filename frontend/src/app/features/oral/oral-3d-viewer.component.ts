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

const GLTF_PATH = '/assets/3d/jaw-arch.gltf';

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
        min-height: 420px;
        border-radius: 12px;
        overflow: hidden;
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      }
      .oral-3d__canvas { width: 100%; height: 420px; display: block; }
      .oral-3d__hint {
        position: absolute;
        left: 12px;
        bottom: 8px;
        margin: 0;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.65);
        pointer-events: none;
      }
      .oral-3d__status {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        color: rgba(255, 255, 255, 0.8);
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
  private resizeHandler = () => this.onResize();

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
    this.canvasRef.nativeElement.addEventListener('pointerdown', this.onPointer);
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resizeHandler);
    this.canvasRef?.nativeElement?.removeEventListener('pointerdown', this.onPointer);
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
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / 420, 0.1, 120);
    this.camera.position.set(0, 3, 14);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(canvas.clientWidth, 420);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(6, 14, 10);
    key.castShadow = true;
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const fill = new THREE.DirectionalLight(0xaaccff, 0.35);
    fill.position.set(-8, 4, -6);
    this.scene.add(fill);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, -0.5);
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 28;
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
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(GLTF_PATH);
      const root = gltf.scene;
      root.name = 'jaw_arch_gltf';
      this.scene.add(root);

      const teeth = new Map<number, Tooth3DObjects>();
      const pickables: any[] = [];

      root.traverse((obj: any) => {
        if (!obj.name) return;
        const toothMatch = /^tooth_(\d+)$/.exec(obj.name);
        if (toothMatch) {
          const fdi = Number(toothMatch[1]);
          const crown =
            obj.getObjectByName(`crown_${fdi}`) ||
            obj.children.find((c: any) => c.name?.startsWith('crown_') || c.isMesh);
          const surfaces = new Map<string, any>();
          for (const code of ['M', 'D', 'B', 'L', 'O']) {
            const s = obj.getObjectByName(`surface_${fdi}_${code}`);
            if (s) {
              s.userData = { ...s.userData, surface: code, isSurface: true, tooth: fdi };
              surfaces.set(code, s);
              pickables.push(s);
            }
          }
          if (crown) {
            crown.userData = { ...crown.userData, tooth: fdi, isCrown: true };
            pickables.push(crown);
          }
          teeth.set(fdi, {
            tooth: fdi,
            group: obj,
            crown: crown || obj,
            surfaces,
            rootMeshes: [],
          });
        }
      });

      if (teeth.size === 0) {
        this.scene.remove(root);
        return false;
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
      const highlighted =
        this.selected.includes(fdi) ? this.selectedSurfaces : [];
      applyToothVisuals(this.THREE, entry, {
        condition,
        selected: this.selected.includes(fdi),
        highlightedSurfaces: highlighted,
        treatedSurfaces: treated,
        surfaceSelectEnabled: this.surfaceSelectEnabled,
      });
    }
  }

  private onPointer = (event: PointerEvent): void => {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const objects = this.pickables.length ? this.pickables : [];
    const hits = this.raycaster.intersectObjects(objects, false);
    if (!hits.length) return;

    const hit = hits[0].object;
    let tooth = hit.userData?.tooth as number | undefined;
    if (!tooth) {
      let p = hit.parent;
      while (p && !tooth) {
        const m = /^tooth_(\d+)$/.exec(p.name || '');
        if (m) tooth = Number(m[1]);
        p = p.parent;
      }
    }
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
  };

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls?.update?.();
    this.renderer?.render?.(this.scene, this.camera);
  };

  private onResize = (): void => {
    const canvas = this.canvasRef.nativeElement;
    if (!canvas.clientWidth) return;
    this.camera.aspect = canvas.clientWidth / 420;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, 420);
  };
}
