import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';

import { ProductRow } from '../../shared/dynamic-fields/models';
import { BarcodeService, LabelTemplate } from './barcode.service';

export interface ProductLabelPreviewDialogData {
  product: Pick<ProductRow, 'id' | 'sku' | 'name' | 'barcode'>;
}

@Component({
  selector: 'app-product-label-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>qr_code_2</mat-icon>
      {{ 'barcode.labelPreviewTitle' | translate }}
    </h2>
    <mat-dialog-content>
      <p class="meta">{{ data.product.sku }} — {{ data.product.name }}</p>
      @if (data.product.barcode) {
      <p class="meta mono">{{ data.product.barcode }}</p>
      }

      <mat-form-field appearance="outline" class="tpl-field">
        <mat-label>{{ 'barcode.templateName' | translate }}</mat-label>
        <mat-select [value]="selectedId()" (selectionChange)="onTemplateChange($event.value)">
          @for (t of templates(); track t.id) {
          <mat-option [value]="t.id">{{ t.name }} ({{ t.width_mm }}×{{ t.height_mm }} mm)</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (resolveSource()) {
      <p class="size-hint">{{ ('barcode.templateResolveSource.' + resolveSource()) | translate }}</p>
      }

      @if (loading()) {
      <div class="center"><mat-spinner diameter="40" /></div>
      } @else if (error()) {
      <p class="error">{{ error() }}</p>
      } @else if (previewUrl() && selectedTemplate()) {
      <p class="size-hint">
        {{ 'barcode.labelSize' | translate: { width: selectedTemplate()!.width_mm, height: selectedTemplate()!.height_mm } }}
      </p>
      <div class="preview-scroll">
        <div
          class="preview-frame"
          [style.width.mm]="frameWidthMm(selectedTemplate()!)"
          [style.height.mm]="frameHeightMm(selectedTemplate()!)"
        >
          <div
            class="label-sheet"
            [style.width.mm]="toNum(selectedTemplate()!.width_mm)"
            [style.height.mm]="toNum(selectedTemplate()!.height_mm)"
          >
            <img [src]="previewUrl()!" [alt]="data.product.barcode || data.product.sku" />
          </div>
        </div>
      </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      h2[mat-dialog-title] {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }
      .meta {
        margin: 0 0 4px;
        opacity: 0.85;
      }
      .mono {
        font-family: monospace;
        font-size: 13px;
      }
      .tpl-field {
        width: 100%;
        margin: 12px 0;
      }
      .size-hint {
        margin: 0 0 8px;
        font-size: 12px;
        opacity: 0.7;
      }
      .preview-scroll {
        overflow: auto;
        max-height: min(75vh, 560px);
        display: flex;
        justify-content: center;
        padding: 4px 0;
      }
      .preview-frame {
        box-sizing: border-box;
        padding: 3mm;
        background: #f5f5f5;
        border-radius: 8px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .label-sheet {
        background: #fff;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
        overflow: hidden;
      }
      .label-sheet img {
        width: 100%;
        height: 100%;
        display: block;
      }
      .center {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .error {
        color: #c62828;
      }
    `,
  ],
})
export class ProductLabelPreviewDialogComponent implements OnDestroy {
  /** Gray frame padding around the label (physical mm). */
  private static readonly FRAME_MARGIN_MM = 3;

  data = inject<ProductLabelPreviewDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProductLabelPreviewDialogComponent>);
  private barcode = inject(BarcodeService);

  templates = signal<LabelTemplate[]>([]);
  selectedId = signal<number | null>(null);
  selectedTemplate = signal<LabelTemplate | null>(null);
  resolveSource = signal('');
  previewUrl = signal<string | null>(null);
  loading = signal(true);
  error = signal('');
  private objectUrl: string | null = null;

  constructor() {
    this.barcode.getTemplates().subscribe({
      next: (list) => {
        this.templates.set(list);
        if (!list.length) {
          this.loading.set(false);
          this.error.set('—');
          return;
        }
        this.barcode.resolveTemplate({ product_id: this.data.product.id }).subscribe({
          next: (resolved) => {
            this.resolveSource.set(resolved.source);
            const id = resolved.template?.id && list.some((t) => t.id === resolved.template!.id)
              ? resolved.template!.id
              : list[0].id;
            this.onTemplateChange(id);
          },
          error: () => this.onTemplateChange(list[0].id),
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set('—');
      },
    });
  }

  ngOnDestroy(): void {
    this.revokeUrl();
  }

  toNum(v: string | number): number {
    return typeof v === 'number' ? v : parseFloat(v);
  }

  frameWidthMm(tpl: LabelTemplate): number {
    return this.toNum(tpl.width_mm) + ProductLabelPreviewDialogComponent.FRAME_MARGIN_MM * 2;
  }

  frameHeightMm(tpl: LabelTemplate): number {
    return this.toNum(tpl.height_mm) + ProductLabelPreviewDialogComponent.FRAME_MARGIN_MM * 2;
  }

  onTemplateChange(id: number): void {
    this.selectedId.set(id);
    const tpl = this.templates().find((t) => t.id === id) ?? null;
    this.selectedTemplate.set(tpl);
    if (!tpl) return;
    this.loadPreview(tpl.id);
  }

  private loadPreview(templateId: number): void {
    this.loading.set(true);
    this.error.set('');
    this.revokeUrl();
    this.previewUrl.set(null);
    this.barcode.previewTemplate(templateId, this.data.product.id).subscribe({
      next: (blob) => {
        this.objectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.objectUrl);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('—');
      },
    });
  }

  private revokeUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
