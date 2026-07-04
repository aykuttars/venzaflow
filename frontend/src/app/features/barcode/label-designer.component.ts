import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';

import { BarcodeService, LabelElement, LabelTemplate } from './barcode.service';

const PALETTE: Array<{ type: LabelElement['type']; label: string; defaults: Partial<LabelElement> }> = [
  { type: 'text', label: 'Metin', defaults: { font_size: 10, data_binding: 'product.name' } },
  { type: 'text', label: 'Fiyat', defaults: { font_size: 14, font_bold: true, data_binding: 'product.price' } },
  { type: 'barcode_1d', label: 'EAN13', defaults: { symbology: 'EAN13', data_binding: 'product.barcode', show_text: true } },
  { type: 'barcode_1d', label: 'Code128', defaults: { symbology: 'CODE128', data_binding: 'product.sku', show_text: true } },
  { type: 'qr', label: 'QR', defaults: { data_binding: 'product.barcode', qr_mode: 'barcode' } },
  { type: 'image', label: 'Logo', defaults: { static_text: 'tenant_logo' } },
];

let elemCounter = 0;

@Component({
  selector: 'app-label-designer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="designer">
      <aside class="palette">
        <h4>{{ 'barcode.palette' | translate }}</h4>
        @for (p of palette; track p.label) {
        <button mat-stroked-button type="button" class="palette-btn" (click)="addElement(p)">
          {{ p.label }}
        </button>
        }
        @if (selected(); as sel) {
        <hr />
        <h4>{{ 'barcode.elementProps' | translate }}</h4>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>X (mm)</mat-label>
          <input matInput type="number" [value]="sel.x" (change)="patchSelected('x', +$any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Y (mm)</mat-label>
          <input matInput type="number" [value]="sel.y" (change)="patchSelected('y', +$any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'barcode.rotation' | translate }}</mat-label>
          <input matInput type="number" min="0" max="359" [value]="sel.rotation" (change)="patchSelected('rotation', +$any($event.target).value)" />
        </mat-form-field>
        @if (sel.type === 'text') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'barcode.binding' | translate }}</mat-label>
          <mat-select [value]="sel.data_binding" (selectionChange)="patchSelected('data_binding', $event.value)">
            <mat-option value="product.name">Ad</mat-option>
            <mat-option value="product.sku">SKU</mat-option>
            <mat-option value="product.price">Fiyat</mat-option>
            <mat-option value="product.barcode">Barkod</mat-option>
            <mat-option value="product.marka">Marka</mat-option>
          </mat-select>
        </mat-form-field>
        }
        <button mat-button color="warn" type="button" (click)="removeSelected()">
          <mat-icon>delete</mat-icon> {{ 'common.delete' | translate }}
        </button>
        }
      </aside>

      <div class="canvas-area">
        <form [formGroup]="metaForm" class="meta-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'barcode.templateName' | translate }}</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>W (mm)</mat-label>
            <input matInput type="number" formControlName="width_mm" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>H (mm)</mat-label>
            <input matInput type="number" formControlName="height_mm" />
          </mat-form-field>
          <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="metaForm.invalid">
            {{ 'common.save' | translate }}
          </button>
          <button mat-stroked-button type="button" (click)="preview()">{{ 'barcode.preview' | translate }}</button>
        </form>

        <div
          class="canvas"
          [style.width.px]="canvasW()"
          [style.height.px]="canvasH()"
          (click)="selectedId.set(null)"
        >
          @for (el of elements(); track el.id) {
          <div
            class="elem"
            [class.selected]="selectedId() === el.id"
            [style.left.px]="el.x * scale"
            [style.top.px]="el.y * scale"
            [style.width.px]="el.width * scale"
            [style.height.px]="el.height * scale"
            [style.transform]="'rotate(' + el.rotation + 'deg)'"
            (click)="selectElement(el.id); $event.stopPropagation()"
            (mousedown)="startDrag($event, el)"
          >
            @if (el.type === 'text') {
            <span [class.bold]="el.font_bold">T: {{ el.data_binding || el.static_text }}</span>
            } @else if (el.type === 'barcode_1d') {
            <span class="barcode-preview">||| {{ el.symbology }}</span>
            } @else if (el.type === 'image') {
            <span class="qr-preview">LOGO</span>
            } @else {
            <span class="qr-preview">QR</span>
            }
          </div>
          }
        </div>
        @if (previewUrl()) {
        <div class="preview-box">
          <img [src]="previewUrl()" alt="preview" />
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .designer {
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 16px;
      }
      .palette-btn {
        width: 100%;
        margin-bottom: 6px;
      }
      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
      }
      .canvas {
        position: relative;
        background: #fff;
        border: 2px dashed #999;
        box-shadow: inset 0 0 0 1px #eee;
      }
      .elem {
        position: absolute;
        border: 1px solid #1976d2;
        background: rgba(25, 118, 210, 0.08);
        cursor: move;
        font-size: 10px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        transform-origin: top left;
      }
      .elem.selected {
        border-color: #e65100;
        background: rgba(230, 81, 0, 0.12);
      }
      .barcode-preview,
      .qr-preview {
        font-family: monospace;
      }
      .bold {
        font-weight: bold;
      }
      .preview-box img {
        max-width: 100%;
        margin-top: 12px;
        border: 1px solid #ddd;
      }
    `,
  ],
})
export class LabelDesignerComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private barcode = inject(BarcodeService);
  private snack = inject(MatSnackBar);

  @Input() template: LabelTemplate | null = null;
  @Output() saved = new EventEmitter<LabelTemplate>();

  palette = PALETTE;
  scale = 4;
  elements = signal<LabelElement[]>([]);
  selectedId = signal<string | null>(null);
  previewUrl = signal<string | null>(null);

  metaForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    width_mm: [40, [Validators.required, Validators.min(20), Validators.max(80)]],
    height_mm: [30, [Validators.required, Validators.min(10)]],
    gap_mm: [2],
    dpi: [203],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['template'] && this.template) {
      this.metaForm.patchValue({
        name: this.template.name,
        width_mm: +this.template.width_mm,
        height_mm: +this.template.height_mm,
        gap_mm: +this.template.gap_mm,
        dpi: this.template.dpi,
      });
      this.elements.set(structuredClone(this.template.layout_json || []));
    }
  }

  canvasW = () => +this.metaForm.value.width_mm! * this.scale;
  canvasH = () => +this.metaForm.value.height_mm! * this.scale;

  selected = () => this.elements().find((e) => e.id === this.selectedId()) ?? null;

  addElement(p: (typeof PALETTE)[0]): void {
    const id = `el-${++elemCounter}`;
    const el: LabelElement = {
      id,
      type: p.type,
      x: 2,
      y: 2,
      width: p.type === 'qr' ? 12 : p.type === 'barcode_1d' ? 30 : 20,
      height: p.type === 'qr' ? 12 : p.type === 'barcode_1d' ? 10 : 6,
      rotation: 0,
      ...p.defaults,
    } as LabelElement;
    this.elements.update((list) => [...list, el]);
    this.selectedId.set(id);
  }

  selectElement(id: string): void {
    this.selectedId.set(id);
  }

  patchSelected(key: keyof LabelElement, value: unknown): void {
    const id = this.selectedId();
    if (!id) return;
    this.elements.update((list) =>
      list.map((e) => (e.id === id ? { ...e, [key]: value } : e))
    );
  }

  removeSelected(): void {
    const id = this.selectedId();
    if (!id) return;
    this.elements.update((list) => list.filter((e) => e.id !== id));
    this.selectedId.set(null);
  }

  private dragState: { id: string; startX: number; startY: number; origX: number; origY: number } | null = null;

  startDrag(ev: MouseEvent, el: LabelElement): void {
    ev.preventDefault();
    this.dragState = {
      id: el.id,
      startX: ev.clientX,
      startY: ev.clientY,
      origX: el.x,
      origY: el.y,
    };
    const move = (e: MouseEvent) => {
      if (!this.dragState) return;
      const dx = (e.clientX - this.dragState.startX) / this.scale;
      const dy = (e.clientY - this.dragState.startY) / this.scale;
      this.elements.update((list) =>
        list.map((item) =>
          item.id === this.dragState!.id
            ? { ...item, x: Math.max(0, this.dragState!.origX + dx), y: Math.max(0, this.dragState!.origY + dy) }
            : item
        )
      );
    };
    const up = () => {
      this.dragState = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  save(): void {
    const v = this.metaForm.getRawValue();
    const payload: Partial<LabelTemplate> & { id?: number } = {
      ...v,
      width_mm: String(v.width_mm),
      height_mm: String(v.height_mm),
      gap_mm: String(v.gap_mm),
      layout_json: this.elements(),
      id: this.template?.id && this.template.id > 0 ? this.template.id : undefined,
    };
    this.barcode.saveTemplate(payload).subscribe({
      next: (t) => {
        this.snack.open('Kaydedildi', undefined, { duration: 2000 });
        this.saved.emit(t);
      },
      error: () => this.snack.open('Hata', undefined, { duration: 3000 }),
    });
  }

  preview(): void {
    const tplId = this.template?.id;
    if (!tplId) {
      this.snack.open('Önce kaydedin', undefined, { duration: 2000 });
      return;
    }
    this.barcode.previewTemplate(tplId).subscribe({
      next: (blob) => {
        const old = this.previewUrl();
        if (old) URL.revokeObjectURL(old);
        this.previewUrl.set(URL.createObjectURL(blob));
      },
    });
  }
}
