import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { DynamicProductDetailComponent } from '../../shared/dynamic-fields/dynamic-detail.component';
import { DetailFieldConfig, ProductRow } from '../../shared/dynamic-fields/models';
import { ProductConfigService, unwrapList } from '../../shared/dynamic-fields/product-config.service';
import { ProductBarcodeCellComponent } from './product-barcode-cell.component';

@Component({
  selector: 'app-product-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslateModule, DynamicProductDetailComponent, ProductBarcodeCellComponent],
  template: `
    @if (open && product()) {
    <div class="overlay" (click)="close.emit()"></div>
    <div class="dialog dialog--wide">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <h2 style="margin:0">{{ product()!.sku }} — {{ product()!.name }}</h2>
        <button mat-icon-button type="button" (click)="close.emit()" [attr.aria-label]="'common.cancel' | translate">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      @if (loading()) {
      <p>{{ 'common.loading' | translate }}</p>
      } @else {
      <app-dynamic-product-detail [config]="detailConfig()" [product]="product()!" />
      <div style="margin-top:12px">
        <app-product-barcode-cell [productId]="product()!.id" [barcode]="product()!.barcode || ''" />
      </div>
      }
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px">
        @if (canWrite) {
        <button mat-flat-button color="primary" type="button" (click)="edit.emit(product()!)">
          <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
        </button>
        }
        <button mat-button type="button" (click)="close.emit()">{{ 'common.close' | translate }}</button>
      </div>
    </div>
    }
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .dialog--wide {
        max-width: 720px;
        width: min(96vw, 720px);
      }
    `,
  ],
})
export class ProductDetailDialogComponent implements OnChanges {
  private http = inject(HttpClient);
  private configService = inject(ProductConfigService);

  @Input() open = false;
  @Input() productId: number | null = null;
  @Input() canWrite = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<ProductRow>();

  product = signal<ProductRow | null>(null);
  detailConfig = signal<DetailFieldConfig[]>([]);
  loading = signal(false);

  ngOnChanges(): void {
    if (this.open && this.productId) {
      this.load(this.productId);
    }
  }

  private load(id: number): void {
    this.loading.set(true);
    this.configService.detailConfig().subscribe({
      next: (cfg) => this.detailConfig.set(unwrapList(cfg)),
    });
    this.http
      .get<ProductRow>(`${API_BASE}/products/${id}/`, { params: { include: 'fields' } })
      .subscribe({
        next: (p) => {
          this.product.set(p);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
