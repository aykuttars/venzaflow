import { CommonModule } from '@angular/common';
import { Component, Input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { ToothGraphicComponent } from './tooth-graphic.component';

export const PERMANENT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const PERMANENT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const PERMANENT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
export const PERMANENT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

export const PRIMARY_UPPER_RIGHT = [55, 54, 53, 52, 51];
export const PRIMARY_UPPER_LEFT = [61, 62, 63, 64, 65];
export const PRIMARY_LOWER_RIGHT = [85, 84, 83, 82, 81];
export const PRIMARY_LOWER_LEFT = [71, 72, 73, 74, 75];

/** @deprecated use quadrant constants */
export const PERMANENT_ROWS = [
  [...PERMANENT_UPPER_RIGHT, ...PERMANENT_UPPER_LEFT],
  [...PERMANENT_LOWER_RIGHT, ...PERMANENT_LOWER_LEFT],
];
export const PRIMARY_ROWS = [
  [...PRIMARY_UPPER_RIGHT, ...PRIMARY_UPPER_LEFT],
  [...PRIMARY_LOWER_RIGHT, ...PRIMARY_LOWER_LEFT],
];

@Component({
  selector: 'app-odontogram',
  standalone: true,
  imports: [CommonModule, TranslateModule, MatTooltipModule, ToothGraphicComponent],
  template: `
    <div class="odontogram" [class]="toolCursorClass">
      @if (showPrimary) {
      <div class="odontogram__arch odontogram__arch--primary-upper">
        <div class="odontogram__quadrant odontogram__quadrant--right">
          @for (tooth of primaryUpperRight; track tooth) {
          <button
            type="button"
            class="tooth-btn tooth-btn--primary"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="true"
              [primary]="true"
            />
          </button>
          }
        </div>
        <div class="odontogram__midline" aria-hidden="true"></div>
        <div class="odontogram__quadrant odontogram__quadrant--left">
          @for (tooth of primaryUpperLeft; track tooth) {
          <button
            type="button"
            class="tooth-btn tooth-btn--primary"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="true"
              [primary]="true"
            />
          </button>
          }
        </div>
      </div>
      }

      <div class="odontogram__arch odontogram__arch--upper">
        <div class="odontogram__quadrant odontogram__quadrant--right">
          @for (tooth of permanentUpperRight; track tooth; let i = $index) {
          <button
            type="button"
            class="tooth-btn"
            [style.--arch-tilt]="archTilt(i, permanentUpperRight.length, 'ur')"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="true"
            />
          </button>
          }
        </div>
        <div class="odontogram__midline" aria-hidden="true"></div>
        <div class="odontogram__quadrant odontogram__quadrant--left">
          @for (tooth of permanentUpperLeft; track tooth; let i = $index) {
          <button
            type="button"
            class="tooth-btn"
            [style.--arch-tilt]="archTilt(i, permanentUpperLeft.length, 'ul')"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="true"
            />
          </button>
          }
        </div>
      </div>

      <div class="odontogram__occlusal">
        <span class="odontogram__label">{{ 'oral.permanentTeeth' | translate }}</span>
      </div>

      <div class="odontogram__arch odontogram__arch--lower">
        <div class="odontogram__quadrant odontogram__quadrant--right">
          @for (tooth of permanentLowerRight; track tooth; let i = $index) {
          <button
            type="button"
            class="tooth-btn"
            [style.--arch-tilt]="archTilt(i, permanentLowerRight.length, 'lr')"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="false"
            />
          </button>
          }
        </div>
        <div class="odontogram__midline" aria-hidden="true"></div>
        <div class="odontogram__quadrant odontogram__quadrant--left">
          @for (tooth of permanentLowerLeft; track tooth; let i = $index) {
          <button
            type="button"
            class="tooth-btn"
            [style.--arch-tilt]="archTilt(i, permanentLowerLeft.length, 'll')"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="false"
            />
          </button>
          }
        </div>
      </div>

      @if (showPrimary) {
      <div class="odontogram__arch odontogram__arch--primary-lower">
        <div class="odontogram__quadrant odontogram__quadrant--right">
          @for (tooth of primaryLowerRight; track tooth) {
          <button
            type="button"
            class="tooth-btn tooth-btn--primary"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="false"
              [primary]="true"
            />
          </button>
          }
        </div>
        <div class="odontogram__midline" aria-hidden="true"></div>
        <div class="odontogram__quadrant odontogram__quadrant--left">
          @for (tooth of primaryLowerLeft; track tooth) {
          <button
            type="button"
            class="tooth-btn tooth-btn--primary"
            [class.tooth-btn--selected]="selected.includes(tooth)"
            [class.tooth-btn--highlight]="highlight === tooth"
            [attr.aria-label]="'Diş ' + tooth"
            (click)="onClick(tooth, $event)"
          >
            <app-tooth-graphic
              [tooth]="tooth"
              [condition]="conditionFor(tooth)"
              [highlightedSurfaces]="surfacesFor(tooth)"
              [treatedSurfaces]="treatedSurfacesFor(tooth)"
              [surfaceSelectEnabled]="surfaceSelectEnabled"
              (surfaceSelect)="surfaceSelect.emit($event)"
              [upper]="false"
              [primary]="true"
            />
          </button>
          }
        </div>
      </div>
      <p class="odontogram__primary-note">{{ 'oral.primaryTeeth' | translate }}</p>
      }
    </div>
  `,
  styles: [
    `
      .odontogram {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 12px;
        background: linear-gradient(180deg, #fdf8f5 0%, #f5ebe3 50%, #fdf8f5 100%);
        border-radius: 12px;
        border: 1px solid rgba(196, 160, 120, 0.25);
      }
      .odontogram__arch {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 0;
      }
      .odontogram__arch--upper { align-items: flex-end; padding-bottom: 4px; }
      .odontogram__arch--lower { align-items: flex-start; padding-top: 4px; }
      .odontogram__arch--primary-upper { align-items: flex-end; opacity: 0.92; margin-bottom: 2px; }
      .odontogram__arch--primary-lower { align-items: flex-start; opacity: 0.92; margin-top: 2px; }
      .odontogram__quadrant {
        display: flex;
        gap: 2px;
      }
      .odontogram__quadrant--right { flex-direction: row; justify-content: flex-end; }
      .odontogram__quadrant--left { flex-direction: row; justify-content: flex-start; }
      .odontogram__midline {
        width: 2px;
        min-height: 52px;
        align-self: stretch;
        background: linear-gradient(180deg, transparent, #c4a078 20%, #c4a078 80%, transparent);
        margin: 0 4px;
        flex-shrink: 0;
      }
      .odontogram__occlusal {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px 0;
        border-top: 1px dashed rgba(196, 160, 120, 0.5);
        border-bottom: 1px dashed rgba(196, 160, 120, 0.5);
        background: rgba(255, 255, 255, 0.35);
      }
      .odontogram__label {
        font-size: 10px;
        font-weight: 600;
        opacity: 0.55;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .odontogram__primary-note {
        text-align: center;
        font-size: 10px;
        font-weight: 600;
        opacity: 0.55;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 4px 0 0;
      }
      .tooth-btn {
        border: none;
        background: transparent;
        padding: 2px;
        cursor: pointer;
        border-radius: 8px;
        transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
        width: 46px;
        height: 78px;
        flex-shrink: 0;
        transform: rotate(var(--arch-tilt, 0deg));
      }
      .tooth-btn--primary { width: 38px; height: 64px; }
      .tooth-btn:hover {
        filter: brightness(1.03);
        transform: rotate(var(--arch-tilt, 0deg)) translateY(var(--hover-lift, -2px));
      }
      .odontogram__arch--upper .tooth-btn { --hover-lift: -2px; }
      .odontogram__arch--lower .tooth-btn { --hover-lift: 2px; }
      .tooth-btn--selected {
        box-shadow: 0 0 0 2px #3f51b5, 0 2px 8px rgba(63, 81, 181, 0.25);
        background: rgba(63, 81, 181, 0.06);
      }
      .tooth-btn--highlight {
        box-shadow: 0 0 0 3px #ff9800, 0 2px 8px rgba(255, 152, 0, 0.3);
      }
      @media (max-width: 720px) {
        .tooth-btn { width: 36px; height: 62px; }
        .tooth-btn--primary { width: 30px; height: 52px; }
        .odontogram { padding: 10px 4px; overflow-x: auto; }
        .odontogram__arch { min-width: 640px; }
      }
      .odontogram.cursor-fill .tooth-btn { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%231976d2' d='M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z'/%3E%3C/svg%3E") 12 22, crosshair; }
      .odontogram.cursor-extract .tooth-btn { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23d32f2f' d='M7 2v2H5v2h2v2H5v2h2v2H5v2h14v-2h-2v-2h2v-2h-2v-2h2V6h-2V4h-2V2H7z'/%3E%3C/svg%3E") 4 4, not-allowed; }
      .odontogram.cursor-root-canal .tooth-btn { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23ff9800' d='M12 2a10 10 0 100 20 10 10 0 000-20zm0 4v8l4 2'/%3E%3C/svg%3E") 12 12, pointer; }
      .odontogram.cursor-crown .tooth-btn { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%237e57c2' d='M5 16l3-8 4 4 4-6 3 10H5z'/%3E%3C/svg%3E") 12 12, pointer; }
      .odontogram.cursor-exam .tooth-btn { cursor: help; }
      .odontogram.cursor-plan .tooth-btn { cursor: cell; }
    `,
  ],
})
export class OdontogramComponent {
  @Input() teethState: Record<string, { condition?: string }> = {};
  @Input() selected: number[] = [];
  @Input() highlight: number | null = null;
  @Input() showPrimary = true;
  @Input() toolCursorClass = '';
  @Input() selectedSurfaces: string[] = [];
  @Input() surfaceSelectEnabled = false;
  @Input() treatmentHints: Record<string, string> = {};

  @Input() treatedSurfacesByTooth: Record<string, string[]> = {};

  toothSelect = output<number[]>();
  surfaceSelect = output<{ tooth: number; surface: string }>();

  permanentUpperRight = PERMANENT_UPPER_RIGHT;
  permanentUpperLeft = PERMANENT_UPPER_LEFT;
  permanentLowerRight = PERMANENT_LOWER_RIGHT;
  permanentLowerLeft = PERMANENT_LOWER_LEFT;
  primaryUpperRight = PRIMARY_UPPER_RIGHT;
  primaryUpperLeft = PRIMARY_UPPER_LEFT;
  primaryLowerRight = PRIMARY_LOWER_RIGHT;
  primaryLowerLeft = PRIMARY_LOWER_LEFT;

  conditionFor(tooth: number): string {
    return this.teethState[String(tooth)]?.condition || 'healthy';
  }

  surfacesFor(tooth: number): string[] {
    if (!this.selected.includes(tooth)) return [];
    return this.selectedSurfaces;
  }

  treatedSurfacesFor(tooth: number): string[] {
    return this.treatedSurfacesByTooth[String(tooth)] || [];
  }

  /** Subtle arch curve like classic dental charts */
  archTilt(index: number, count: number, quadrant: 'ur' | 'ul' | 'lr' | 'll'): string {
    const center = (count - 1) / 2;
    const dist = (index - center) / center;
    const max = 14;
    switch (quadrant) {
      case 'ur':
        return `${dist * max}deg`;
      case 'ul':
        return `${-dist * max}deg`;
      case 'lr':
        return `${-dist * max}deg`;
      case 'll':
        return `${dist * max}deg`;
      default:
        return '0deg';
    }
  }

  onClick(tooth: number, event: MouseEvent): void {
    let next: number[];
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      next = this.selected.includes(tooth)
        ? this.selected.filter((t) => t !== tooth)
        : [...this.selected, tooth];
    } else {
      next = this.selected.includes(tooth) && this.selected.length === 1 ? [] : [tooth];
    }
    this.toothSelect.emit(next);
  }
}
