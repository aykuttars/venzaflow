import { CommonModule } from '@angular/common';
import { Component, Input, output } from '@angular/core';

export type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar';

const CONDITION_CROWN: Record<string, string> = {
  healthy: '#fffef8',
  caries: '#ffcdd2',
  filled: '#bbdefb',
  root_canal: '#ffe0b2',
  crown: '#d1c4e9',
  implant: '#b2dfdb',
  missing: '#e0e0e0',
  bridge: '#c5cae9',
  extraction_planned: '#ffccbc',
};

const CONDITION_STROKE: Record<string, string> = {
  healthy: '#c8b896',
  caries: '#e57373',
  filled: '#64b5f6',
  root_canal: '#ffb74d',
  crown: '#9575cd',
  implant: '#4db6ac',
  missing: '#bdbdbd',
  bridge: '#7986cb',
  extraction_planned: '#ff8a65',
};

const SURFACE_FILL = '#1976d2';
const SURFACE_FILL_OPACITY = 0.55;

@Component({
  selector: 'app-tooth-graphic',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.viewBox]="viewBox"
      class="tooth-graphic"
      [class.tooth-graphic--primary]="primary"
      [class.tooth-graphic--upper]="upper"
      [class.tooth-graphic--lower]="!upper"
      [class.tooth-graphic--missing]="missing"
      aria-hidden="true"
    >
      @if (!missing) {
      <g [attr.transform]="flipTransform">
        @for (root of rootPaths; track $index) {
        <path class="tooth-graphic__root" [attr.d]="root" />
        }
        <path
          class="tooth-graphic__crown"
          [attr.d]="crownPath"
          [attr.fill]="crownFill"
          [attr.stroke]="crownStroke"
        />
        @if (kind === 'molar' || kind === 'premolar') {
        <path class="tooth-graphic__groove" [attr.d]="groovePath" />
        }
        @if (condition === 'root_canal') {
        <ellipse cx="24" cy="14" rx="4" ry="10" fill="#ffb74d" opacity="0.45" />
        }
        @if (condition === 'crown' || condition === 'bridge') {
        <path [attr.d]="crownCapPath" fill="#9575cd" opacity="0.35" stroke="#7e57c2" stroke-width="1" />
        }
        @if (condition === 'implant') {
        <rect x="22" y="2" width="4" height="18" rx="2" fill="#78909c" />
          <circle cx="24" cy="2" r="3" fill="#b2dfdb" stroke="#4db6ac" />
        }
        @for (s of surfaceRegions; track s.code) {
        <path
          class="tooth-graphic__surface"
          [class.tooth-graphic__surface--active]="highlightedSurfaces.includes(s.code)"
          [class.tooth-graphic__surface--treated]="treatedSurfaces.includes(s.code)"
          [attr.d]="s.path"
          (click)="onSurfaceClick(s.code, $event)"
        />
        }
      </g>
      } @else {
      <rect x="8" y="14" width="32" height="28" rx="4" fill="#ececec" stroke="#bdbdbd" stroke-width="1.5" stroke-dasharray="4 3" />
      }
      <text [attr.x]="labelX" [attr.y]="labelY" text-anchor="middle" class="tooth-graphic__num">{{ tooth }}</text>
    </svg>
  `,
  styles: [
    `
      :host { display: block; }
      .tooth-graphic { width: 100%; height: 100%; display: block; overflow: visible; }
      .tooth-graphic--primary { transform: scale(0.82); transform-origin: center; }
      .tooth-graphic__root { fill: #ddb896; stroke: #c4a078; stroke-width: 0.8; stroke-linejoin: round; }
      .tooth-graphic__crown { stroke-width: 1.2; stroke-linejoin: round; }
      .tooth-graphic__groove { fill: none; stroke: rgba(0, 0, 0, 0.1); stroke-width: 1; }
      .tooth-graphic__surface {
        fill: transparent;
        stroke: transparent;
        cursor: pointer;
        transition: fill 0.12s;
      }
      .tooth-graphic__surface:hover { fill: rgba(25, 118, 210, 0.25); }
      .tooth-graphic__surface--active { fill: rgba(25, 118, 210, 0.55); stroke: #1565c0; stroke-width: 0.6; }
      .tooth-graphic__surface--treated { fill: rgba(76, 175, 80, 0.45); stroke: #388e3c; stroke-width: 0.5; }
      .tooth-graphic__num { font-size: 9px; font-weight: 700; fill: rgba(0, 0, 0, 0.72); pointer-events: none; }
      .tooth-graphic--missing .tooth-graphic__num { fill: rgba(0, 0, 0, 0.45); }
    `,
  ],
})
export class ToothGraphicComponent {
  @Input({ required: true }) tooth!: number;
  @Input() condition = 'healthy';
  @Input() upper = true;
  @Input() primary = false;
  @Input() highlightedSurfaces: string[] = [];
  @Input() treatedSurfaces: string[] = [];
  @Input() surfaceSelectEnabled = false;

  surfaceSelect = output<{ tooth: number; surface: string }>();

  viewBox = '0 0 48 72';
  labelX = 24;
  labelY = 68;

  get missing(): boolean {
    return this.condition === 'missing';
  }

  get kind(): ToothKind {
    const unit = this.tooth % 10;
    if (unit <= 2) return 'incisor';
    if (unit === 3) return 'canine';
    if (unit <= 5) return 'premolar';
    return 'molar';
  }

  get crownFill(): string {
    return CONDITION_CROWN[this.condition] || CONDITION_CROWN['healthy'];
  }

  get crownStroke(): string {
    return CONDITION_STROKE[this.condition] || CONDITION_STROKE['healthy'];
  }

  get flipTransform(): string | null {
    return this.upper ? null : 'translate(0, 72) scale(1, -1)';
  }

  get crownPath(): string {
    switch (this.kind) {
      case 'incisor':
        return 'M14 28 C14 22, 18 20, 24 20 C30 20, 34 22, 34 28 L33 38 C32 42, 28 44, 24 44 C20 44, 16 42, 15 38 Z';
      case 'canine':
        return 'M13 28 C13 19, 20 17, 24 17 C28 17, 35 19, 35 28 L33 40 C31 44, 27 45, 24 45 C21 45, 17 44, 15 40 Z';
      case 'premolar':
        return 'M12 28 C12 21, 17 19, 24 19 C31 19, 36 21, 36 28 L35 39 C33 43, 28 44, 24 44 C20 44, 15 43, 13 39 Z';
      case 'molar':
      default:
        return 'M10 28 C10 20, 16 18, 24 18 C32 18, 38 20, 38 28 L37 40 C35 44, 29 45, 24 45 C19 45, 13 44, 11 40 Z';
    }
  }

  get crownCapPath(): string {
    return 'M12 20 C12 17, 18 16, 24 16 C30 16, 36 17, 36 20 L35 28 L13 28 Z';
  }

  get groovePath(): string {
    return 'M24 22 L24 36 M18 26 L30 26';
  }

  get rootPaths(): string[] {
    switch (this.kind) {
      case 'incisor':
      case 'canine':
        return ['M20 4 C18 8, 17 16, 19 26 L29 26 C31 16, 30 8, 28 4 C26 2, 22 2, 20 4 Z'];
      case 'premolar':
        return [
          'M16 6 C14 10, 13 18, 15 26 L21 26 C22 18, 21 10, 19 6 C18 4, 17 4, 16 6 Z',
          'M28 6 C30 10, 31 18, 29 26 L23 26 C22 18, 23 10, 25 6 C26 4, 27 4, 28 6 Z',
        ];
      case 'molar':
      default:
        return [
          'M14 8 C12 12, 11 18, 13 26 L19 26 C20 18, 19 12, 17 8 C16 6, 15 6, 14 8 Z',
          'M24 4 C23 8, 22 16, 22 26 L26 26 C26 16, 25 8, 24 4 C24 3, 24 3, 24 4 Z',
          'M34 8 C36 12, 37 18, 35 26 L29 26 C28 18, 29 12, 31 8 C32 6, 33 6, 34 8 Z',
        ];
    }
  }

  /** Approximate clickable surface regions on crown (mesial/distal/buccal/lingual/occlusal). */
  get surfaceRegions(): { code: string; path: string }[] {
    return [
      { code: 'M', path: 'M14 28 L18 20 L22 28 L18 38 Z' },
      { code: 'D', path: 'M34 28 L30 20 L26 28 L30 38 Z' },
      { code: 'B', path: 'M18 20 L30 20 L30 28 L18 28 Z' },
      { code: 'L', path: 'M18 38 L30 38 L30 28 L18 28 Z' },
      { code: 'O', path: 'M20 22 L28 22 L28 30 L20 30 Z' },
    ];
  }

  onSurfaceClick(code: string, event: MouseEvent): void {
    if (!this.surfaceSelectEnabled) return;
    event.stopPropagation();
    this.surfaceSelect.emit({ tooth: this.tooth, surface: code });
  }
}
