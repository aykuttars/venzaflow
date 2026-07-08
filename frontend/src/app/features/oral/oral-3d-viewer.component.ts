import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  output,
} from '@angular/core';

import {
  PERMANENT_LOWER_LEFT,
  PERMANENT_LOWER_RIGHT,
  PERMANENT_UPPER_LEFT,
  PERMANENT_UPPER_RIGHT,
} from './odontogram.component';

const CONDITION_COLORS: Record<string, number> = {
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

const ALL_TEETH = [
  ...PERMANENT_UPPER_RIGHT,
  ...PERMANENT_UPPER_LEFT,
  ...PERMANENT_LOWER_RIGHT,
  ...PERMANENT_LOWER_LEFT,
];

@Component({
  selector: 'app-oral-3d-viewer',
  standalone: true,
  template: `
    <div class="oral-3d">
      <canvas #canvas class="oral-3d__canvas"></canvas>
      <p class="oral-3d__hint">{{ hint }}</p>
    </div>
  `,
  styles: [
    `
      .oral-3d { position: relative; width: 100%; min-height: 360px; border-radius: 12px; overflow: hidden; background: #1a1a2e; }
      .oral-3d__canvas { width: 100%; height: 360px; display: block; }
      .oral-3d__hint { position: absolute; left: 12px; bottom: 8px; margin: 0; font-size: 11px; color: rgba(255,255,255,0.65); }
    `,
  ],
})
export class Oral3dViewerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() teethState: Record<string, { condition?: string }> = {};
  @Input() selected: number[] = [];
  @Input() hint = 'Sürükleyerek döndürün · Dişe tıklayarak seçin';

  toothSelect = output<number[]>();

  private renderer: any;
  private scene: any;
  private camera: any;
  private controls: any;
  private toothMeshes = new Map<number, any>();
  private animationId = 0;
  private raycaster: any;
  private pointer = { x: 0, y: 0 };
  private THREE: any;

  async ngAfterViewInit(): Promise<void> {
    this.THREE = await import('three');
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    this.initScene(OrbitControls);
    this.buildTeeth();
    this.animate();
    this.canvasRef.nativeElement.addEventListener('pointerdown', (e) => this.onPointer(e));
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.renderer?.dispose?.();
  }

  private initScene(OrbitControls: any): void {
    const canvas = this.canvasRef.nativeElement;
    const THREE = this.THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / 360, 0.1, 100);
    this.camera.position.set(0, 8, 22);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, 360);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(5, 12, 8);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.raycaster = new THREE.Raycaster();
  }

  private buildTeeth(): void {
    const THREE = this.THREE;
    const positions = this.layoutPositions();
    for (const tooth of ALL_TEETH) {
      const pos = positions.get(tooth)!;
      const unit = tooth % 10;
      const isMolar = unit >= 6;
      const geo = new THREE.CylinderGeometry(isMolar ? 0.55 : 0.4, isMolar ? 0.45 : 0.32, 1.2, 12);
      const condition = this.teethState[String(tooth)]?.condition || 'healthy';
      const color = CONDITION_COLORS[condition] ?? CONDITION_COLORS['healthy'];
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.55 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.rotation.x = pos.upper ? -0.25 : 0.25;
      mesh.userData = { tooth };
      this.scene.add(mesh);
      this.toothMeshes.set(tooth, mesh);
    }
    this.refreshSelection();
  }

  private layoutPositions(): Map<number, { x: number; y: number; z: number; upper: boolean }> {
    const map = new Map<number, { x: number; y: number; z: number; upper: boolean }>();
    const place = (teeth: number[], upper: boolean, sign: number) => {
      teeth.forEach((t, i) => {
        const arch = (i - (teeth.length - 1) / 2) * 0.95;
        map.set(t, { x: sign * Math.abs(arch), y: upper ? 1.8 : -1.8, z: -Math.abs(arch) * 0.35, upper });
      });
    };
    place(PERMANENT_UPPER_RIGHT, true, -1);
    place(PERMANENT_UPPER_LEFT, true, 1);
    place(PERMANENT_LOWER_RIGHT, false, -1);
    place(PERMANENT_LOWER_LEFT, false, 1);
    return map;
  }

  private refreshSelection(): void {
    for (const [tooth, mesh] of this.toothMeshes) {
      const selected = this.selected.includes(tooth);
      mesh.scale.setScalar(selected ? 1.15 : 1);
      (mesh.material as any).emissive?.setHex?.(selected ? 0x2244aa : 0x000000);
    }
  }

  ngOnChanges(): void {
    if (!this.toothMeshes.size || !this.THREE) return;
    for (const [tooth, mesh] of this.toothMeshes) {
      const condition = this.teethState[String(tooth)]?.condition || 'healthy';
      const color = CONDITION_COLORS[condition] ?? CONDITION_COLORS['healthy'];
      (mesh.material as any).color.setHex(color);
    }
    this.refreshSelection();
  }

  private onPointer = (event: PointerEvent): void => {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.toothMeshes.values()]);
    if (!hits.length) return;
    const tooth = hits[0].object.userData.tooth as number;
    const next = this.selected.includes(tooth) && this.selected.length === 1 ? [] : [tooth];
    this.toothSelect.emit(next);
  };

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls?.update?.();
    this.renderer?.render?.(this.scene, this.camera);
  };

  private onResize = (): void => {
    const canvas = this.canvasRef.nativeElement;
    this.camera.aspect = canvas.clientWidth / 360;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, 360);
  };
}
