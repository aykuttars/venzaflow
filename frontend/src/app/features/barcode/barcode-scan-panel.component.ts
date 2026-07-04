import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import { BarcodeLookupResult, BarcodeService } from './barcode.service';

@Component({
  selector: 'app-barcode-scan-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <div class="scan-panel">
      <mat-form-field appearance="outline" class="scan-field" subscriptSizing="dynamic">
        <mat-label>{{ 'barcode.scanPlaceholder' | translate }}</mat-label>
        <input
          #scanInput
          matInput
          [(ngModel)]="buffer"
          (keydown.enter)="onEnter($event)"
          (input)="onInput()"
          autocomplete="off"
          spellcheck="false"
        />
        <mat-icon matPrefix>qr_code_scanner</mat-icon>
      </mat-form-field>
      @if (loading()) {
      <mat-spinner diameter="24" />
      }
      @if (error()) {
      <p class="scan-error">{{ error() }}</p>
      }
      @if (result(); as r) {
      <div class="scan-result card">
        <h4>{{ r.product.name }}</h4>
        <p><strong>SKU:</strong> {{ r.product.sku }} · <strong>EAN:</strong> {{ r.product.barcode }}</p>
        @if (r.product.marka) {
        <p><strong>{{ 'barcode.brand' | translate }}:</strong> {{ r.product.marka }}</p>
        }
        <p><strong>{{ 'barcode.price' | translate }}:</strong> {{ r.product.unit_price }} ₺</p>
        <div class="stock-split">
          <span class="chip depo">DEPO: {{ r.stock.depo_quantity }}</span>
          <span class="chip magaza">MAGAZA: {{ r.stock.magaza_quantity }}</span>
        </div>
        @if (r.suggest_transfer) {
        <p class="hint-transfer">{{ 'barcode.suggestTransfer' | translate }}</p>
        }
        <button mat-stroked-button type="button" (click)="clear()">
          <mat-icon>clear</mat-icon> {{ 'common.close' | translate }}
        </button>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .scan-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .scan-field {
        width: 100%;
        max-width: 480px;
      }
      .scan-result.card {
        padding: 16px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 8px;
        max-width: 520px;
      }
      .stock-split {
        display: flex;
        gap: 8px;
        margin: 8px 0;
      }
      .chip {
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 13px;
      }
      .chip.depo {
        background: #e3f2fd;
      }
      .chip.magaza {
        background: #f3e5f5;
      }
      .hint-transfer {
        color: #e65100;
        font-weight: 500;
      }
      .scan-error {
        color: #c62828;
      }
    `,
  ],
})
export class BarcodeScanPanelComponent {
  private barcode = inject(BarcodeService);

  @ViewChild('scanInput') scanInput?: ElementRef<HTMLInputElement>;
  @Output() scanned = new EventEmitter<BarcodeLookupResult>();

  buffer = '';
  loading = signal(false);
  error = signal('');
  result = signal<BarcodeLookupResult | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  focus(): void {
    setTimeout(() => this.scanInput?.nativeElement.focus(), 0);
  }

  onInput(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const code = this.buffer.trim();
      if (code.length >= 8) {
        this.lookup(code);
      }
    }, 300);
  }

  onEnter(ev: Event): void {
    ev.preventDefault();
    const code = this.buffer.trim();
    if (code) this.lookup(code);
  }

  lookup(code: string): void {
    this.loading.set(true);
    this.error.set('');
    this.barcode.lookup(code).subscribe({
      next: (r) => {
        this.result.set(r);
        this.scanned.emit(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Ürün bulunamadı');
        this.result.set(null);
        this.loading.set(false);
      },
    });
  }

  clear(): void {
    this.buffer = '';
    this.result.set(null);
    this.error.set('');
    this.focus();
  }
}
