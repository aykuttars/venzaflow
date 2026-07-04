import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { BarcodeService } from './barcode.service';

@Component({
  selector: 'app-product-barcode-cell',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatChipsModule, MatProgressSpinnerModule, TranslateModule],
  template: `
    @if (canGenerate()) {
      @if (barcode) {
        @if (previewUrl()) {
        <img class="thumb" [src]="previewUrl()" [alt]="barcode" />
        } @else if (loading()) {
        <mat-spinner diameter="20" />
        } @else {
        <button mat-stroked-button type="button" (click)="loadPreview()">{{ 'barcode.preview' | translate }}</button>
        }
      } @else {
        <button mat-stroked-button type="button" color="accent" (click)="generate()" [disabled]="generating()">
          {{ 'barcode.generateChip' | translate }}
        </button>
      }
    } @else if (barcode) {
      <span class="code">{{ barcode }}</span>
    }
  `,
  styles: [
    `
      .thumb {
        max-height: 36px;
        max-width: 120px;
        border: 1px solid #ddd;
      }
      .code {
        font-family: monospace;
        font-size: 12px;
      }
    `,
  ],
})
export class ProductBarcodeCellComponent implements OnInit {
  @Input({ required: true }) productId!: number;
  @Input() barcode = '';
  @Input() autoLoadPreview = false;
  @Output() barcodeChanged = new EventEmitter<string>();

  private barcodeSvc = inject(BarcodeService);
  private auth = inject(AuthService);

  previewUrl = signal<string | null>(null);
  loading = signal(false);
  generating = signal(false);
  private templateId: number | null = null;

  canGenerate = () => this.auth.hasPermission('barcode.generate');

  ngOnInit(): void {
    if (this.autoLoadPreview && this.barcode) {
      this.loadPreview();
    }
  }

  loadPreview(): void {
    if (this.templateId && this.previewUrl()) return;
    this.loading.set(true);
    this.barcodeSvc.resolveTemplate({ product_id: this.productId }).subscribe({
      next: (resolved) => {
        const id = resolved.template?.id ?? null;
        if (!id) {
          this.barcodeSvc.getTemplates().subscribe({
            next: (list) => {
              const tpl = list[0];
              if (!tpl) {
                this.loading.set(false);
                return;
              }
              this.renderPreview(tpl.id);
            },
            error: () => this.loading.set(false),
          });
          return;
        }
        this.renderPreview(id);
      },
      error: () => this.loading.set(false),
    });
  }

  private renderPreview(templateId: number): void {
    this.templateId = templateId;
    this.barcodeSvc.previewTemplate(templateId, this.productId).subscribe({
      next: (blob) => {
        this.previewUrl.set(URL.createObjectURL(blob));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  generate(): void {
    this.generating.set(true);
    this.barcodeSvc.generateMissing(1, this.productId).subscribe({
      next: () => {
        this.generating.set(false);
        this.barcodeChanged.emit('generated');
        window.location.reload();
      },
      error: () => this.generating.set(false),
    });
  }
}
