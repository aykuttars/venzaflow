import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { BarcodeLookupResult, BarcodeService, LabelTemplate } from './barcode.service';
import { BarcodeScanPanelComponent } from './barcode-scan-panel.component';
import { LabelDesignerComponent } from './label-designer.component';

@Component({
  selector: 'app-barcode',
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
    MatTabsModule,
    TranslateModule,
    PageHeaderComponent,
    BarcodeScanPanelComponent,
    LabelDesignerComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="barcode" icon="qr_code_scanner" />

      <mat-tab-group (selectedIndexChange)="onTab($event)">
        <mat-tab [label]="'barcode.tabScan' | translate">
          <div class="tab-body">
            <app-barcode-scan-panel (scanned)="onScanned($event)" />
          </div>
        </mat-tab>

        @if (canLabels()) {
        <mat-tab [label]="'barcode.tabTemplates' | translate">
          <div class="tab-body">
            <div class="toolbar">
              <button mat-stroked-button type="button" (click)="seedDefaults()">
                <mat-icon>restore</mat-icon> {{ 'barcode.seedDefaults' | translate }}
              </button>
              <button mat-flat-button color="primary" type="button" (click)="newTemplate()">
                <mat-icon>add</mat-icon> {{ 'barcode.newTemplate' | translate }}
              </button>
            </div>
            <table class="bms-table">
              <thead>
                <tr>
                  <th>{{ 'barcode.templateName' | translate }}</th>
                  <th>{{ 'barcode.size' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (t of templates(); track t.id) {
                <tr>
                  <td>{{ t.name }}</td>
                  <td>{{ t.width_mm }}×{{ t.height_mm }} mm</td>
                  <td>
                    <button mat-button type="button" (click)="editTemplate(t)">{{ 'common.edit' | translate }}</button>
                    <button mat-button type="button" (click)="duplicateTemplate(t)">Kopyala</button>
                  </td>
                </tr>
                }
              </tbody>
            </table>
            @if (editingTemplate()) {
            <app-label-designer
              [template]="editingTemplate()"
              (saved)="onTemplateSaved($event)"
            />
            }
          </div>
        </mat-tab>
        }

        @if (canPrint()) {
        <mat-tab [label]="'barcode.tabPrint' | translate">
          <div class="tab-body">
            <form [formGroup]="printForm" class="print-form">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'barcode.templateName' | translate }}</mat-label>
                <mat-select formControlName="template_id">
                  @for (t of templates(); track t.id) {
                  <mat-option [value]="t.id">{{ t.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'barcode.productId' | translate }}</mat-label>
                <input matInput formControlName="product_id" type="number" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'barcode.copies' | translate }}</mat-label>
                <input matInput formControlName="copies" type="number" min="1" />
              </mat-form-field>
              <button mat-flat-button color="primary" type="button" (click)="createPrintJob()" [disabled]="printForm.invalid">
                {{ 'barcode.createPrintJob' | translate }}
              </button>
            </form>
            @if (lastJobId()) {
            <p class="hint">{{ 'barcode.printJobCreated' | translate }} #{{ lastJobId() }}</p>
            }
          </div>
        </mat-tab>

        <mat-tab [label]="'barcode.tabTransfer' | translate">
          <div class="tab-body">
            <p class="hint">{{ 'barcode.transferHint' | translate }}</p>
            <app-barcode-scan-panel #transferScan (scanned)="addTransferItem($event)" />
            <table class="bms-table" style="margin-top:12px">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>{{ 'inventory.quantity' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (item of transferItems(); track item.product_id) {
                <tr>
                  <td>{{ item.sku }}</td>
                  <td>
                    <input type="number" min="1" [value]="item.quantity" (change)="updateQty(item.product_id, +$any($event.target).value)" />
                  </td>
                  <td><button mat-icon-button type="button" (click)="removeTransfer(item.product_id)"><mat-icon>close</mat-icon></button></td>
                </tr>
                }
              </tbody>
            </table>
            <button mat-flat-button color="primary" type="button" [disabled]="!transferItems().length" (click)="submitTransfer()">
              DEPO → MAGAZA
            </button>
          </div>
        </mat-tab>
        }
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .tab-body {
        padding: 16px 0;
      }
      .toolbar {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .print-form {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        max-width: 640px;
      }
      .hint {
        color: #666;
        font-size: 14px;
      }
    `,
  ],
})
export class BarcodeComponent implements OnInit {
  private barcode = inject(BarcodeService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  templates = signal<LabelTemplate[]>([]);
  editingTemplate = signal<LabelTemplate | null>(null);
  lastJobId = signal<number | null>(null);
  transferItems = signal<Array<{ product_id: number; sku: string; quantity: number }>>([]);
  lastScan = signal<BarcodeLookupResult | null>(null);

  printForm = this.fb.nonNullable.group({
    template_id: [0, Validators.required],
    product_id: [0, Validators.required],
    copies: [1, Validators.min(1)],
  });

  canLabels = () => this.auth.hasPermission('barcode.labels');
  canPrint = () => this.auth.hasPermission('barcode.print');

  ngOnInit(): void {
    this.reloadTemplates();
  }

  onTab(_idx: number): void {}

  reloadTemplates(): void {
    this.barcode.getTemplates().subscribe((list) => this.templates.set(list));
  }

  onScanned(r: BarcodeLookupResult): void {
    this.lastScan.set(r);
    this.printForm.patchValue({ product_id: r.product.id });
  }

  seedDefaults(): void {
    this.barcode.seedDefaults().subscribe({
      next: (r) => {
        this.snack.open(`${r.created} şablon eklendi`, undefined, { duration: 2000 });
        this.reloadTemplates();
      },
    });
  }

  newTemplate(): void {
    this.editingTemplate.set({
      id: 0,
      name: 'Yeni şablon',
      description: '',
      width_mm: '40',
      height_mm: '30',
      gap_mm: '2',
      dpi: 203,
      layout_json: [],
      source: 'custom',
      default_key: '',
      is_active: true,
    });
  }

  editTemplate(t: LabelTemplate): void {
    this.editingTemplate.set({ ...t, layout_json: structuredClone(t.layout_json) });
  }

  duplicateTemplate(t: LabelTemplate): void {
    this.barcode.duplicateTemplate(t.id).subscribe({
      next: () => this.reloadTemplates(),
    });
  }

  onTemplateSaved(t: LabelTemplate): void {
    this.editingTemplate.set(t);
    this.reloadTemplates();
  }

  createPrintJob(): void {
    const v = this.printForm.getRawValue();
    this.barcode.createPrintJob(v.template_id, [v.product_id], v.copies).subscribe({
      next: (job) => {
        this.lastJobId.set(job.id);
        this.snack.open(`Yazdırma kuyruğu #${job.id}`, undefined, { duration: 3000 });
      },
    });
  }

  addTransferItem(r: BarcodeLookupResult): void {
    const depo = r.stock.depo_quantity;
    if (depo <= 0) {
      this.snack.open('DEPO stok yok', undefined, { duration: 2000 });
      return;
    }
    const items = this.transferItems();
    if (items.some((i) => i.product_id === r.product.id)) return;
    this.transferItems.set([
      ...items,
      { product_id: r.product.id, sku: r.product.sku, quantity: 1 },
    ]);
  }

  updateQty(productId: number, qty: number): void {
    this.transferItems.update((list) =>
      list.map((i) => (i.product_id === productId ? { ...i, quantity: qty } : i))
    );
  }

  removeTransfer(productId: number): void {
    this.transferItems.update((list) => list.filter((i) => i.product_id !== productId));
  }

  submitTransfer(): void {
    const items = this.transferItems().map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
    }));
    this.barcode.transfer(items).subscribe({
      next: (res: { transfers?: unknown[]; errors?: unknown[] }) => {
        const ok = res.transfers?.length ?? 0;
        this.snack.open(`${ok} transfer tamamlandı`, undefined, { duration: 3000 });
        this.transferItems.set([]);
      },
      error: () => this.snack.open('Transfer hatası', undefined, { duration: 3000 }),
    });
  }
}
