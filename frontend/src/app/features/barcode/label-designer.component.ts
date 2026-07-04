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
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="designer">
      <div class="designer-toolbar">
        <form [formGroup]="metaForm" class="designer-toolbar__row">
          <div class="toolbar-start">
            <div class="toolbar-badge"><mat-icon>brush</mat-icon></div>
            <div class="toolbar-fields">
              <div class="toolbar-field toolbar-field--name">
                <span class="toolbar-field__label">{{ 'barcode.templateName' | translate }}</span>
                <input
                  class="toolbar-field__input"
                  formControlName="name"
                  [placeholder]="'barcode.templateName' | translate"
                  [class.toolbar-field__input--invalid]="metaForm.controls.name.invalid && metaForm.controls.name.touched"
                />
              </div>
              <div class="toolbar-field">
                <span class="toolbar-field__label">{{ 'barcode.size' | translate }}</span>
                <div class="size-control">
                  <input type="number" formControlName="width_mm" min="20" max="80" aria-label="width" />
                  <span class="size-control__sep">×</span>
                  <input type="number" formControlName="height_mm" min="10" aria-label="height" />
                  <span class="size-control__unit">mm</span>
                </div>
              </div>
            </div>
          </div>
          <div class="toolbar-actions">
            <button mat-stroked-button type="button" class="btn-preview" (click)="preview()">
              <mat-icon>visibility</mat-icon>{{ 'barcode.preview' | translate }}
            </button>
            <button mat-flat-button color="primary" type="button" class="btn-save" (click)="save()" [disabled]="metaForm.invalid">
              <mat-icon>save</mat-icon>{{ 'common.save' | translate }}
            </button>
          </div>
        </form>
        @if (layoutWarnings().length) {
        <div class="warn-box">@for (w of layoutWarnings(); track w) {<p>{{ w }}</p>}</div>
        }
      </div>

      <div class="designer-body">
        <mat-card class="palette-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>widgets</mat-icon>
            <mat-card-title>{{ 'barcode.palette' | translate }}</mat-card-title>
            <mat-card-subtitle>{{ 'barcode.designerPaletteHint' | translate }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-accordion multi class="palette-accordion">
              <mat-expansion-panel expanded>
                <mat-expansion-panel-header><mat-panel-title>{{ 'barcode.paletteElements' | translate }}</mat-panel-title></mat-expansion-panel-header>
                <div class="palette-grid">
                  @for (p of elementPalette; track p.label) {
                  <button mat-stroked-button type="button" class="palette-chip" [disabled]="isPaletteItemUsed(p)" (click)="addElement(p)">
                    <mat-icon>{{ paletteIcon(p.type, p.label) }}</mat-icon>{{ p.label }}
                  </button>
                  }
                </div>
              </mat-expansion-panel>
              @if (coreFields().length) {
              <mat-expansion-panel expanded>
                <mat-expansion-panel-header><mat-panel-title>{{ 'barcode.paletteCore' | translate }}</mat-panel-title></mat-expansion-panel-header>
                <div class="palette-grid">
                  @for (f of coreFields(); track f.binding) {
                  <button mat-stroked-button type="button" class="palette-chip" [disabled]="isBindingUsed(f)" (click)="addFromBinding(f)"><mat-icon>label</mat-icon>{{ f.label }}</button>
                  }
                </div>
              </mat-expansion-panel>
              }
              @if (dynamicFields().length) {
              <mat-expansion-panel>
                <mat-expansion-panel-header><mat-panel-title>{{ 'barcode.paletteDynamic' | translate }}</mat-panel-title></mat-expansion-panel-header>
                <div class="palette-grid">
                  @for (f of dynamicFields(); track f.binding) {
                  <button mat-stroked-button type="button" class="palette-chip" [disabled]="isBindingUsed(f)" (click)="addFromBinding(f)"><mat-icon>tune</mat-icon>{{ f.label }}</button>
                  }
                </div>
              </mat-expansion-panel>
              }
              @if (labelFields().length) {
              <mat-expansion-panel>
                <mat-expansion-panel-header><mat-panel-title>{{ 'barcode.paletteLabel' | translate }}</mat-panel-title></mat-expansion-panel-header>
                <div class="palette-grid">
                  @for (f of labelFields(); track f.binding) {
                  <button mat-stroked-button type="button" class="palette-chip" [disabled]="isBindingUsed(f)" (click)="addFromBinding(f)"><mat-icon>event</mat-icon>{{ f.label }}</button>
                  }
                </div>
              </mat-expansion-panel>
              }
            </mat-accordion>
          </mat-card-content>
        </mat-card>

        <div class="canvas-column">
          <mat-card class="canvas-card">
            <mat-card-content>
              <div class="canvas-frame">
                <div class="canvas" [style.width.px]="canvasW()" [style.height.px]="canvasH()" (mousedown)="onCanvasBackground($event)">
                  @for (el of elements(); track el.id; let idx = $index) {
                  <div
                    class="elem"
                    [class.selected]="selectedId() === el.id"
                    [class.dragging]="draggingId() === el.id"
                    [style.left.px]="el.x * scale"
                    [style.top.px]="el.y * scale"
                    [style.width.px]="el.width * scale"
                    [style.height.px]="el.height * scale"
                    [style.z-index]="selectedId() === el.id ? 1000 : idx + 1"
                    [style.transform]="'rotate(' + el.rotation + 'deg)'"
                    (click)="onElementClick($event, el)"
                    (mousedown)="startDrag($event, el)"
                  >
                    @if (el.type === 'text') {<span [class.bold]="el.font_bold">{{ elementCaption(el) }}</span>}
                    @else if (el.type === 'barcode_1d') {
                      <span class="barcode-preview">||| {{ barcodeCaption(el) }}</span>
                    }
                    @else if (el.type === 'image') {<span class="qr-preview">LOGO</span>}
                    @else {<span class="qr-preview">{{ elementCaption(el) }}</span>}
                  </div>
                  }
                </div>
              </div>
              <p class="canvas-hint">{{ 'barcode.designerCanvasHint' | translate }}</p>
            </mat-card-content>
          </mat-card>
          @if (previewUrl()) {
          <mat-card class="preview-card">
            <mat-card-header><mat-card-title>{{ 'barcode.preview' | translate }}</mat-card-title></mat-card-header>
            <mat-card-content><img [src]="previewUrl()!" alt="preview" /></mat-card-content>
          </mat-card>
          }
        </div>

        <mat-card class="props-card">
          @if (selected(); as sel) {
          <mat-card-header class="props-header">
            <mat-icon mat-card-avatar>{{ paletteIcon(sel.type) }}</mat-icon>
            <mat-card-title>{{ selectedTitle(sel) }}</mat-card-title>
            <button mat-icon-button type="button" color="warn" [matTooltip]="'common.delete' | translate" (click)="removeSelected()">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </mat-card-header>
          <mat-card-content>
            <p class="section-label">{{ 'barcode.designerPosition' | translate }}</p>
            <div class="props-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>X</mat-label>
                <input matInput type="number" [value]="sel.x" (change)="patchSelected('x', +$any($event.target).value)" /><span matTextSuffix>mm</span></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Y</mat-label>
                <input matInput type="number" [value]="sel.y" (change)="patchSelected('y', +$any($event.target).value)" /><span matTextSuffix>mm</span></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>W</mat-label>
                <input matInput type="number" [value]="sel.width" (change)="patchSelected('width', +$any($event.target).value)" /><span matTextSuffix>mm</span></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>H</mat-label>
                <input matInput type="number" [value]="sel.height" (change)="patchSelected('height', +$any($event.target).value)" /><span matTextSuffix>mm</span></mat-form-field>
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="field-full">
              <mat-label>{{ 'barcode.rotation' | translate }}</mat-label>
              <input matInput type="number" min="0" max="359" [value]="sel.rotation" (change)="patchSelected('rotation', +$any($event.target).value)" />
              <span matTextSuffix>°</span>
            </mat-form-field>
            @if (sel.type === 'text' || sel.type === 'barcode_1d' || sel.type === 'qr') {
            <mat-divider /><p class="section-label">{{ 'barcode.binding' | translate }}</p>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="field-full">
              <mat-select [value]="sel.data_binding || ''" (selectionChange)="patchSelected('data_binding', $event.value)">
                <mat-option value="">{{ 'barcode.bindingNone' | translate }}</mat-option>
                @for (f of bindingFields(); track f.binding) {<mat-option [value]="f.binding">{{ bindingGroupLabel(f.group) }} — {{ f.label }}</mat-option>}
              </mat-select>
            </mat-form-field>
            }
            @if (sel.type === 'text') {
            <mat-divider /><p class="section-label">{{ 'barcode.designerAppearance' | translate }}</p>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="field-full">
              <mat-label>{{ 'barcode.staticText' | translate }}</mat-label>
              <input matInput [value]="sel.static_text || ''" (change)="patchSelected('static_text', $any($event.target).value)" />
            </mat-form-field>
            <div class="props-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="field-grow">
                <mat-label>{{ 'barcode.fontSize' | translate }}</mat-label>
                <input matInput type="number" [value]="sel.font_size || 10" (change)="patchSelected('font_size', +$any($event.target).value)" />
                <span matTextSuffix>pt</span>
              </mat-form-field>
              <mat-checkbox [checked]="!!sel.font_bold" (change)="patchSelected('font_bold', $event.checked)">{{ 'barcode.fontBold' | translate }}</mat-checkbox>
            </div>
            }
            @if (sel.type === 'barcode_1d') {
            <mat-divider /><p class="section-label">{{ 'barcode.symbology' | translate }}</p>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="field-full">
              <mat-select [value]="sel.symbology || 'EAN13'" (selectionChange)="patchSelected('symbology', $event.value)">
                <mat-option value="EAN13">EAN13</mat-option><mat-option value="CODE128">Code128</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-checkbox [checked]="!!sel.show_text" (change)="patchSelected('show_text', $event.checked)">{{ 'barcode.showBarcodeText' | translate }}</mat-checkbox>
            }
          </mat-card-content>
          } @else {
          <mat-card-content class="props-empty">
            <mat-icon>touch_app</mat-icon>
            <p>{{ 'barcode.designerNoSelection' | translate }}</p>
          </mat-card-content>
          }
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .designer { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
      .designer-toolbar {
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,.07);
        background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,.06);
        overflow: hidden;
      }
      .designer-toolbar__row {
        display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; justify-content: space-between;
        padding: 14px 16px;
      }
      .toolbar-start { display: flex; align-items: flex-end; gap: 14px; flex: 1; min-width: 0; }
      .toolbar-badge {
        width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; margin-bottom: 1px;
        background: linear-gradient(135deg, rgba(25,118,210,.14), rgba(21,101,192,.08));
        color: #1565c0; display: flex; align-items: center; justify-content: center;
      }
      .toolbar-badge mat-icon { font-size: 20px; width: 20px; height: 20px; }
      .toolbar-fields { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; flex: 1; min-width: 0; }
      .toolbar-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
      .toolbar-field--name { flex: 0 1 240px; max-width: 320px; }
      .toolbar-field__label {
        font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: rgba(0,0,0,.42);
      }
      .toolbar-field__input {
        width: 100%; height: 38px; padding: 0 12px; border-radius: 9px;
        border: 1px solid rgba(0,0,0,.1); background: #f6f8fa;
        font-size: 14px; font-weight: 500; color: rgba(0,0,0,.87);
        transition: border-color .15s, background .15s, box-shadow .15s;
        box-sizing: border-box;
      }
      .toolbar-field__input:focus {
        outline: none; border-color: #1976d2; background: #fff;
        box-shadow: 0 0 0 3px rgba(25,118,210,.12);
      }
      .toolbar-field__input--invalid { border-color: #d32f2f; }
      .size-control {
        display: inline-flex; align-items: center; height: 38px;
        border: 1px solid rgba(0,0,0,.1); border-radius: 9px; background: #f6f8fa;
        padding: 0 10px 0 6px; transition: border-color .15s, background .15s, box-shadow .15s;
      }
      .size-control:focus-within {
        border-color: #1976d2; background: #fff; box-shadow: 0 0 0 3px rgba(25,118,210,.12);
      }
      .size-control input {
        width: 42px; border: none; background: transparent; text-align: center;
        font-size: 14px; font-weight: 600; color: rgba(0,0,0,.87); padding: 0;
        -moz-appearance: textfield;
      }
      .size-control input::-webkit-outer-spin-button,
      .size-control input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .size-control input:focus { outline: none; }
      .size-control__sep { color: rgba(0,0,0,.28); font-size: 14px; font-weight: 500; padding: 0 2px; user-select: none; }
      .size-control__unit { color: rgba(0,0,0,.45); font-size: 12px; font-weight: 500; margin-left: 4px; user-select: none; }
      .toolbar-actions { display: flex; gap: 8px; flex-shrink: 0; align-items: center; }
      .toolbar-actions button { height: 38px; border-radius: 9px !important; padding: 0 16px !important; }
      .toolbar-actions button mat-icon { margin-right: 6px; font-size: 18px; width: 18px; height: 18px; }
      .btn-preview { border-color: rgba(0,0,0,.14) !important; color: rgba(0,0,0,.72) !important; }
      .field-full { width: 100%; }
      .designer-body { display: grid; grid-template-columns: minmax(220px, 260px) minmax(0, 1fr) minmax(240px, 280px); gap: 16px; align-items: start; }
      @media (max-width: 1100px) { .designer-body { grid-template-columns: 1fr; } }
      .palette-card, .canvas-card, .props-card, .preview-card {
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,.08);
        box-shadow: 0 2px 12px rgba(0,0,0,.04);
      }
      .palette-card mat-card-header, .props-card mat-card-header { padding-bottom: 0; }
      .palette-card mat-card-avatar, .props-card mat-card-avatar { border-radius: 8px; background: rgba(25,118,210,.12); color: #1565c0; display: flex; align-items: center; justify-content: center; }
      .palette-accordion .mat-expansion-panel { box-shadow: none !important; border: 1px solid rgba(0,0,0,.06); border-radius: 10px !important; margin-bottom: 8px; background: #fafbfc; }
      .palette-grid { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0 8px; }
      .palette-chip {
        font-size: 12px; line-height: 1.2; padding: 4px 10px; min-height: 32px;
        border-radius: 8px; transition: background .15s, transform .1s;
      }
      .palette-chip:not([disabled]):hover { transform: translateY(-1px); }
      .palette-chip mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      .canvas-column { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .canvas-frame {
        overflow: auto; padding: 20px;
        background: repeating-conic-gradient(#eceff1 0% 25%, #e3e7ea 0% 50%) 50% / 16px 16px;
        border-radius: 10px; display: flex; justify-content: center;
      }
      .canvas { position: relative; background: #fff; border: 1px solid rgba(0,0,0,.15); box-shadow: 0 4px 20px rgba(0,0,0,.12); flex-shrink: 0; border-radius: 2px; }
      .canvas-hint { margin: 10px 0 0; font-size: 12px; color: rgba(0,0,0,.55); text-align: center; }
      .elem {
        position: absolute; border: 1.5px solid #1976d2; background: rgba(25,118,210,.07); cursor: grab;
        font-size: 9px; overflow: hidden; display: flex; align-items: center; justify-content: center;
        transform-origin: top left; padding: 2px; text-align: center; border-radius: 3px;
        transition: border-color .15s, box-shadow .15s, background .15s; user-select: none; touch-action: none;
      }
      .elem.dragging { cursor: grabbing; opacity: .92; }
      .elem.selected { border-color: #e65100; background: rgba(230,81,0,.12); box-shadow: 0 0 0 2px rgba(230,81,0,.28); }
      .palette-chip[disabled] { opacity: 0.45; }
      .barcode-preview, .qr-preview { font-family: monospace; font-size: 8px; line-height: 1.2; word-break: break-all; }
      .bold { font-weight: bold; }
      .preview-card img { max-width: 100%; border: 1px solid rgba(0,0,0,.12); border-radius: 4px; }
      .props-card { position: sticky; top: 16px; max-height: calc(100vh - 200px); overflow: auto; }
      .props-header { display: flex; align-items: center; }
      .props-header button { margin-left: auto; }
      .props-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 200px; color: rgba(0,0,0,.45); text-align: center; padding: 24px; }
      .props-empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .5; }
      .section-label { margin: 12px 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: rgba(0,0,0,.5); }
      .section-label:first-child { margin-top: 0; }
      .props-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .props-grid mat-form-field { width: 100%; }
      .props-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .field-grow { flex: 1; min-width: 100px; }
      mat-divider { margin: 12px 0; }
      .warn-box { margin: 0 16px 12px; padding: 8px 12px; background: #fff3e0; border-radius: 8px; font-size: 13px; }
      .warn-box p { margin: 0; }
    `,
  ],

})
export class LabelDesignerComponent implements OnChanges, OnInit {
  private fb = inject(FormBuilder);
  private barcode = inject(BarcodeService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

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
  draggingId = signal<string | null>(null);
  previewUrl = signal<string | null>(null);
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
      this.syncElemCounter(this.template.layout_json || []);
      this.selectedId.set(null);
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

  barcodeCaption(el: LabelElement): string {
    const binding = this.elementCaption(el);
    const sym = el.symbology || 'EAN13';
    const suffix = el.show_text ? ' +#' : '';
    return binding !== sym ? `${sym}${suffix} · ${binding}` : `${sym}${suffix}`;
  }

  paletteIcon(type: LabelElement['type'], label?: string): string {
    if (type === 'barcode_1d') return 'barcode_reader';
    if (type === 'qr') return 'qr_code_2';
    if (type === 'image') return 'image';
    if (label?.includes('numara')) return 'pin';
    return 'text_fields';
  }

  selectedTitle(sel: LabelElement): string {
    if (sel.type === 'barcode_1d') return sel.symbology || 'Barkod';
    if (sel.type === 'qr') return 'QR';
    if (sel.type === 'image') return 'Logo';
    return this.elementCaption(sel);
  }

  addElement(p: (typeof ELEMENT_PALETTE)[0]): void {
    const draft = { type: p.type, ...p.defaults } as Partial<LabelElement>;
    if (this.isSlotLimited(draft)) {
      const existingId = this.findExistingSlot(draft);
      if (existingId) {
        this.selectElement(existingId);
        this.snack.open(this.translate.instant('barcode.designerFieldAlreadyAdded'), undefined, { duration: 2500 });
        return;
      }
    }
    const id = `el-${++elemCounter}`;
    const width = p.defaults.width ?? (p.type === 'qr' ? 12 : p.type === 'barcode_1d' ? 30 : 20);
    const height = p.defaults.height ?? (p.type === 'qr' ? 12 : p.type === 'barcode_1d' ? 10 : 6);
    const pos = this.suggestPosition(width, height);
    const el: LabelElement = {
      id,
      type: p.type,
      rotation: 0,
      ...p.defaults,
      width,
      height,
      x: pos.x,
      y: pos.y,
    } as LabelElement;
    this.elements.update((list) => [...list, el]);
    this.selectedId.set(id);
  }

  addFromBinding(field: LabelBindingField): void {
    if (field.element_type !== 'barcode_1d' && this.isBindingUsed(field)) {
      const existingId = this.findExistingSlot({ type: 'text', data_binding: field.binding });
      if (existingId) this.selectElement(existingId);
      this.snack.open(this.translate.instant('barcode.designerFieldAlreadyAdded'), undefined, { duration: 2500 });
      return;
    }
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
    const width = field.binding === 'product.price' ? 28 : 35;
    const height = field.binding === 'product.price' ? 8 : 6;
    const pos = this.suggestPosition(width, height);
    const el: LabelElement = {
      id,
      type: 'text',
      x: pos.x,
      y: pos.y,
      width,
      height,
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
    this.elements.update((list) => {
      const idx = list.findIndex((e) => e.id === id);
      if (idx < 0 || idx === list.length - 1) return list;
      const next = [...list];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
  }

  onElementClick(ev: MouseEvent, el: LabelElement): void {
    ev.stopPropagation();
    this.selectElement(el.id);
  }

  onCanvasBackground(ev: MouseEvent): void {
    if (ev.button !== 0) return;
    if (ev.target === ev.currentTarget) {
      this.selectedId.set(null);
    }
  }

  isPaletteItemUsed(p: (typeof ELEMENT_PALETTE)[0]): boolean {
    const draft = { type: p.type, ...p.defaults } as Partial<LabelElement>;
    if (!this.isSlotLimited(draft)) return false;
    return !!this.findExistingSlot(draft);
  }

  isBindingUsed(field: LabelBindingField): boolean {
    if (field.element_type === 'barcode_1d') return false;
    return !!this.findExistingSlot({ type: 'text', data_binding: field.binding });
  }

  /** Text fields and logo are unique; barcodes/QR/free text can repeat with different bindings. */
  private isSlotLimited(el: Partial<LabelElement>): boolean {
    return this.elementSlotKey(el) !== null;
  }

  private elementSlotKey(el: Partial<LabelElement>): string | null {
    if (el.type === 'image') return 'image:tenant_logo';
    if (el.type === 'text' && el.data_binding) return `text:${el.data_binding}`;
    return null;
  }

  private findExistingSlot(draft: Partial<LabelElement>): string | null {
    const key = this.elementSlotKey(draft);
    if (!key) return null;
    return this.elements().find((e) => this.elementSlotKey(e) === key)?.id ?? null;
  }

  private syncElemCounter(list: LabelElement[]): void {
    let max = elemCounter;
    for (const el of list) {
      const match = /^el-(\d+)$/.exec(el.id);
      if (match) max = Math.max(max, +match[1]);
    }
    elemCounter = max;
  }

  patchSelected(key: keyof LabelElement, value: unknown): void {
    const id = this.selectedId();
    if (!id) return;
    this.elements.update((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, [key]: value } as LabelElement;
        if (key === 'x' || key === 'y' || key === 'width' || key === 'height') {
          const pos = this.clampPosition(next.x, next.y, next.width, next.height);
          next.x = pos.x;
          next.y = pos.y;
        }
        return next;
      })
    );
  }

  removeSelected(): void {
    const id = this.selectedId();
    if (!id) return;
    this.elements.update((list) => list.filter((e) => e.id !== id));
    this.selectedId.set(null);
  }

  private labelBounds(): { w: number; h: number } {
    return {
      w: +this.metaForm.value.width_mm!,
      h: +this.metaForm.value.height_mm!,
    };
  }

  private rectsOverlap(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    gap = 0.5
  ): boolean {
    return ax < bx + bw + gap && ax + aw + gap > bx && ay < by + bh + gap && ay + ah + gap > by;
  }

  private clampPosition(x: number, y: number, width: number, height: number): { x: number; y: number } {
    const { w, h } = this.labelBounds();
    const snap = (v: number) => Math.round(v * 2) / 2;
    return {
      x: snap(Math.max(0, Math.min(w - width, x))),
      y: snap(Math.max(0, Math.min(h - height, y))),
    };
  }

  /** Place new elements below existing ones, or scan for first free slot. */
  private suggestPosition(width: number, height: number): { x: number; y: number } {
    const margin = 1;
    const { w, h } = this.labelBounds();
    const existing = this.elements();

    if (!existing.length) {
      return this.clampPosition(margin, margin, width, height);
    }

    for (let y = margin; y + height <= h - margin; y += 1) {
      for (let x = margin; x + width <= w - margin; x += 1) {
        const hit = existing.some((el) =>
          this.rectsOverlap(x, y, width, height, el.x, el.y, el.width, el.height)
        );
        if (!hit) {
          return { x, y };
        }
      }
    }

    const maxBottom = Math.max(...existing.map((el) => el.y + el.height));
    return this.clampPosition(margin, maxBottom + margin, width, height);
  }

  startDrag(ev: MouseEvent, el: LabelElement): void {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    this.selectElement(el.id);

    const dragId = el.id;
    const origX = el.x;
    const origY = el.y;
    const startX = ev.clientX;
    const startY = ev.clientY;
    let dragging = false;

    const move = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < 4) return;
      if (!dragging) {
        dragging = true;
        this.draggingId.set(dragId);
      }
      e.preventDefault();
      const current = this.elements().find((item) => item.id === dragId);
      if (!current) return;
      const pos = this.clampPosition(origX + dx / this.scale, origY + dy / this.scale, current.width, current.height);
      this.elements.update((list) =>
        list.map((item) => (item.id === dragId ? { ...item, x: pos.x, y: pos.y } : item))
      );
    };
    const up = () => {
      this.draggingId.set(null);
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
    this.barcode.previewTemplate(tplId).subscribe({
      next: (blob) => {
        const old = this.previewUrl();
        if (old) URL.revokeObjectURL(old);
        this.previewUrl.set(URL.createObjectURL(blob));
      },
    });
  }
}
