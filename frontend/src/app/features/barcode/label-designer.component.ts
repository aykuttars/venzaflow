import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';

import { BarcodeService, LabelBindingField, LabelElement, LabelTemplate } from './barcode.service';

const ELEMENT_PALETTE: Array<{ type: LabelElement['type']; label: string; defaults: Partial<LabelElement> }> = [
  {
    type: 'barcode_1d',
    label: 'EAN13',
    defaults: { symbology: 'EAN13', data_binding: 'product.barcode', show_text: false, width: 45, height: 12 },
  },
  {
    type: 'barcode_1d',
    label: 'EAN13 + numara',
    defaults: { symbology: 'EAN13', data_binding: 'product.barcode', show_text: true, width: 45, height: 16 },
  },
  {
    type: 'barcode_1d',
    label: 'Code128',
    defaults: { symbology: 'CODE128', data_binding: 'product.sku', show_text: true, width: 40, height: 14 },
  },
  { type: 'qr', label: 'QR', defaults: { data_binding: 'product.barcode', qr_mode: 'barcode', width: 14, height: 14 } },
  { type: 'image', label: 'Logo', defaults: { static_text: 'tenant_logo', width: 12, height: 12 } },
  { type: 'text', label: 'Serbest metin', defaults: { static_text: 'Metin', font_size: 10, width: 20, height: 6 } },
];

let elemCounter = 0;

@Component({
  selector: 'app-label-designer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
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
        <h4>{{ 'barcode.paletteElements' | translate }}</h4>
        @for (p of elementPalette; track p.label) {
        <button mat-stroked-button type="button" class="palette-btn" (click)="addElement(p)">
          {{ p.label }}
        </button>
        }

        @if (coreFields().length) {
        <h4>{{ 'barcode.paletteCore' | translate }}</h4>
        @for (f of coreFields(); track f.binding) {
        <button mat-stroked-button type="button" class="palette-btn palette-btn--field" (click)="addFromBinding(f)">
          {{ f.label }}
        </button>
        }
        }

        @if (dynamicFields().length) {
        <h4>{{ 'barcode.paletteDynamic' | translate }}</h4>
        @for (f of dynamicFields(); track f.binding) {
        <button mat-stroked-button type="button" class="palette-btn palette-btn--field" (click)="addFromBinding(f)">
          {{ f.label }}
        </button>
        }
        }

        @if (labelFields().length) {
        <h4>{{ 'barcode.paletteLabel' | translate }}</h4>
        @for (f of labelFields(); track f.binding) {
        <button mat-stroked-button type="button" class="palette-btn palette-btn--field" (click)="addFromBinding(f)">
          {{ f.label }}
        </button>
        }
        }

        @if (selected(); as sel) {
        <hr />
        <h4>{{ 'barcode.elementProps' | translate }}</h4>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>W (mm)</mat-label>
          <input matInput type="number" [value]="sel.width" (change)="patchSelected('width', +$any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>H (mm)</mat-label>
          <input matInput type="number" [value]="sel.height" (change)="patchSelected('height', +$any($event.target).value)" />
        </mat-form-field>
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
          <mat-label>{{ 'barcode.staticText' | translate }}</mat-label>
          <input matInput [value]="sel.static_text || ''" (change)="patchSelected('static_text', $any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'barcode.fontSize' | translate }}</mat-label>
          <input matInput type="number" [value]="sel.font_size || 10" (change)="patchSelected('font_size', +$any($event.target).value)" />
        </mat-form-field>
        <mat-checkbox [checked]="!!sel.font_bold" (change)="patchSelected('font_bold', $event.checked)">
          {{ 'barcode.fontBold' | translate }}
        </mat-checkbox>
        }

        @if (sel.type === 'barcode_1d') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'barcode.symbology' | translate }}</mat-label>
          <mat-select [value]="sel.symbology || 'EAN13'" (selectionChange)="patchSelected('symbology', $event.value)">
            <mat-option value="EAN13">EAN13</mat-option>
            <mat-option value="CODE128">Code128</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-checkbox [checked]="!!sel.show_text" (change)="patchSelected('show_text', $event.checked)">
          {{ 'barcode.showBarcodeText' | translate }}
        </mat-checkbox>
        }

        @if (sel.type === 'text' || sel.type === 'barcode_1d' || sel.type === 'qr') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'barcode.binding' | translate }}</mat-label>
          <mat-select [value]="sel.data_binding || ''" (selectionChange)="patchSelected('data_binding', $event.value)">
            <mat-option value="">{{ 'barcode.bindingNone' | translate }}</mat-option>
            @for (f of bindingFields(); track f.binding) {
            <mat-option [value]="f.binding">{{ bindingGroupLabel(f.group) }} — {{ f.label }}</mat-option>
            }
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
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="preview-product">
          <mat-label>{{ 'barcode.previewProductId' | translate }}</mat-label>
          <input matInput type="number" [value]="previewProductId()" (change)="previewProductId.set(+$any($event.target).value)" />
        </mat-form-field>
        @if (layoutWarnings().length) {
        <div class="warn-box">
          @for (w of layoutWarnings(); track w) {
          <p>{{ w }}</p>
          }
        </div>
        }

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
            <span [class.bold]="el.font_bold">{{ elementCaption(el) }}</span>
            } @else if (el.type === 'barcode_1d') {
            <span class="barcode-preview">||| {{ el.symbology }}{{ el.show_text ? ' +#' : '' }}</span>
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
        grid-template-columns: minmax(240px, 280px) 1fr;
        gap: 16px;
      }
      .palette {
        max-height: calc(100vh - 180px);
        overflow-y: auto;
        padding-right: 4px;
      }
      .palette h4 {
        margin: 12px 0 6px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.65;
      }
      .palette h4:first-child {
        margin-top: 0;
      }
      .palette-btn {
        width: 100%;
        margin-bottom: 6px;
        justify-content: flex-start;
        text-align: left;
      }
      .palette-btn--field {
        font-size: 13px;
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
        padding: 2px;
        text-align: center;
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
      .preview-product {
        margin-top: 8px;
        width: 200px;
      }
      .warn-box {
        margin-top: 8px;
        padding: 8px;
        background: #fff3e0;
        border-radius: 4px;
        font-size: 13px;
      }
    `,
  ],
})
export class LabelDesignerComponent implements OnChanges, OnInit {
  private fb = inject(FormBuilder);
  private barcode = inject(BarcodeService);
  private snack = inject(MatSnackBar);

  @Input() template: LabelTemplate | null = null;
  @Output() saved = new EventEmitter<LabelTemplate>();

  elementPalette = ELEMENT_PALETTE;
  bindingFields = signal<LabelBindingField[]>([]);
  coreFields = computed(() => this.bindingFields().filter((f) => f.group === 'core'));
  dynamicFields = computed(() => this.bindingFields().filter((f) => f.group === 'dynamic'));
  labelFields = computed(() => this.bindingFields().filter((f) => f.group === 'label'));

  scale = 4;
  elements = signal<LabelElement[]>([]);
  selectedId = signal<string | null>(null);
  previewUrl = signal<string | null>(null);
  previewProductId = signal<number | null>(null);
  layoutWarnings = signal<string[]>([]);

  metaForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    width_mm: [40, [Validators.required, Validators.min(20), Validators.max(80)]],
    height_mm: [30, [Validators.required, Validators.min(10)]],
    gap_mm: [2],
    dpi: [203],
  });

  ngOnInit(): void {
    this.barcode.getBindingFields().subscribe({
      next: (fields) => this.bindingFields.set(fields),
      error: () => this.bindingFields.set([]),
    });
  }

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

  bindingGroupLabel(group: LabelBindingField['group']): string {
    if (group === 'core') return 'Ürün';
    if (group === 'dynamic') return 'Özel';
    return 'Etiket';
  }

  elementCaption(el: LabelElement): string {
    if (el.static_text && !el.data_binding) return el.static_text;
    const field = this.bindingFields().find((f) => f.binding === el.data_binding);
    return field ? field.label : el.data_binding || el.static_text || 'Metin';
  }

  addElement(p: (typeof ELEMENT_PALETTE)[0]): void {
    const id = `el-${++elemCounter}`;
    const el: LabelElement = {
      id,
      type: p.type,
      x: 2,
      y: 2,
      width: p.defaults.width ?? (p.type === 'qr' ? 12 : p.type === 'barcode_1d' ? 30 : 20),
      height: p.defaults.height ?? (p.type === 'qr' ? 12 : p.type === 'barcode_1d' ? 10 : 6),
      rotation: 0,
      ...p.defaults,
    } as LabelElement;
    this.elements.update((list) => [...list, el]);
    this.selectedId.set(id);
  }

  addFromBinding(field: LabelBindingField): void {
    if (field.element_type === 'barcode_1d') {
      this.addElement({
        type: 'barcode_1d',
        label: field.label,
        defaults: {
          data_binding: field.binding,
          symbology: 'EAN13',
          show_text: field.binding === 'product.barcode',
          width: 45,
          height: field.binding === 'product.barcode' ? 16 : 12,
        },
      });
      return;
    }
    const id = `el-${++elemCounter}`;
    const el: LabelElement = {
      id,
      type: 'text',
      x: 2,
      y: 2,
      width: field.binding === 'product.price' ? 28 : 35,
      height: field.binding === 'product.price' ? 8 : 6,
      rotation: 0,
      data_binding: field.binding,
      font_size: field.binding === 'product.price' ? 14 : 10,
      font_bold: field.binding === 'product.price',
    };
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
        const warnings = (t as LabelTemplate & { layout_warnings?: string[] }).layout_warnings;
        if (warnings?.length) {
          this.layoutWarnings.set(warnings);
          this.snack.open('Kaydedildi (uyarılar var)', undefined, { duration: 3000 });
        } else {
          this.layoutWarnings.set([]);
          this.snack.open('Kaydedildi', undefined, { duration: 2000 });
        }
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
    const pid = this.previewProductId() || undefined;
    this.barcode.previewTemplate(tplId, pid).subscribe({
      next: (blob) => {
        const old = this.previewUrl();
        if (old) URL.revokeObjectURL(old);
        this.previewUrl.set(URL.createObjectURL(blob));
      },
    });
  }
}
