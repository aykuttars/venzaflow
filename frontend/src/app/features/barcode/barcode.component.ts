import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import {
  BarcodeLookupResult,
  BarcodeService,
  LabelTemplate,
  PrintBatchItem,
  PrintJob,
} from './barcode.service';
import { BarcodeManagementComponent } from './barcode-management.component';
import { BarcodeScanPanelComponent } from './barcode-scan-panel.component';
import { EbarcodeDownloadDialogComponent } from './ebarcode-download-dialog.component';
import { LabelDesignerComponent } from './label-designer.component';
import { LabelTemplateThumbComponent } from './label-template-thumb.component';

@Component({
  selector: 'app-barcode',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule,
    TranslateModule,
    PageHeaderComponent,
    BarcodeScanPanelComponent,
    BarcodeManagementComponent,
    LabelDesignerComponent,
    LabelTemplateThumbComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="barcode" icon="qr_code_scanner">
        <button mat-stroked-button type="button" (click)="openDownloadDialog()">
          <mat-icon>download</mat-icon>
          {{ 'ebarcodeDownload.button' | translate }}
        </button>
      </app-page-header>

      <mat-tab-group (selectedIndexChange)="onTab($event)">
        <mat-tab [label]="'barcode.tabScan' | translate">
          <div class="tab-body">
            <app-barcode-scan-panel (scanned)="onScanned($event)" />
          </div>
        </mat-tab>

        @if (canLabels()) {
        <mat-tab [label]="'barcode.tabManagement' | translate">
          <div class="tab-body">
            <app-barcode-management />
          </div>
        </mat-tab>

        <mat-tab [label]="'barcode.tabTemplates' | translate">
          <div class="tab-body templates-tab">
            <div class="templates-header">
              <div>
                <h3 class="templates-title">{{ 'barcode.tabTemplates' | translate }}</h3>
                <p class="templates-subtitle">{{ 'barcode.templatesSubtitle' | translate }}</p>
              </div>
              <div class="templates-actions">
                <button mat-stroked-button type="button" (click)="seedDefaults()">
                  <mat-icon>restore</mat-icon> {{ 'barcode.seedDefaults' | translate }}
                </button>
                <button mat-flat-button color="primary" type="button" (click)="newTemplate()">
                  <mat-icon>add</mat-icon> {{ 'barcode.newTemplate' | translate }}
                </button>
              </div>
            </div>

            @if (templates().length === 0) {
            <mat-card class="templates-empty">
              <mat-icon>label_off</mat-icon>
              <p>{{ 'barcode.templatesEmpty' | translate }}</p>
              <button mat-stroked-button type="button" (click)="seedDefaults()">{{ 'barcode.seedDefaults' | translate }}</button>
            </mat-card>
            } @else {
            <div class="template-grid">
              @for (t of templates(); track t.id) {
              <mat-card
                class="template-card"
                [class.template-card--active]="editingTemplate()?.id === t.id"
                (click)="editTemplate(t)"
              >
                <div class="template-card__preview" [style.aspect-ratio]="templateAspect(t)">
                  <app-label-template-thumb [template]="t" />
                </div>
                <div class="template-card__body">
                  <h4>{{ t.name }}</h4>
                  <span class="template-card__meta">{{ t.width_mm }} × {{ t.height_mm }} mm · {{ t.layout_json.length || 0 }} {{ 'barcode.templateElements' | translate }}</span>
                </div>
                <div class="template-card__actions" (click)="$event.stopPropagation()">
                  <button mat-icon-button type="button" [matTooltip]="'common.edit' | translate" (click)="editTemplate(t)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button type="button" [matTooltip]="'common.duplicate' | translate" (click)="duplicateTemplate(t)">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                  <button mat-icon-button type="button" color="warn" [matTooltip]="'common.delete' | translate" (click)="deleteTemplate(t)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </mat-card>
              }
            </div>
            }

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
            <p class="hint">{{ 'barcode.printScanHint' | translate }}</p>
            <app-barcode-scan-panel (scanned)="addBatchItem($event)" />

            <table class="bms-table" style="margin-top:12px">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>{{ 'barcode.copies' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (item of batchItems(); track item.product_id) {
                <tr>
                  <td>{{ item.sku }}</td>
                  <td>
                    <input type="number" min="1" [value]="item.copies" (change)="updateBatchCopies(item.product_id, +$any($event.target).value)" />
                  </td>
                  <td>
                    <button mat-icon-button type="button" (click)="removeBatchItem(item.product_id)"><mat-icon>close</mat-icon></button>
                  </td>
                </tr>
                }
              </tbody>
            </table>

            <form [formGroup]="printForm" class="print-form">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'barcode.templateName' | translate }}</mat-label>
                <mat-select formControlName="template_id">
                  @for (t of templates(); track t.id) {
                  <mat-option [value]="t.id">{{ t.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-stroked-button type="button" (click)="queueBatch(false)" [disabled]="!batchItems().length || printForm.invalid">
                {{ 'barcode.queueBatch' | translate }}
              </button>
              <button mat-flat-button color="primary" type="button" (click)="queueBatch(true)" [disabled]="!batchItems().length || printForm.invalid">
                {{ 'barcode.printImmediate' | translate }}
              </button>
            </form>

            <h4>{{ 'barcode.recentJobs' | translate }}</h4>
            <table class="bms-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ 'barcode.templateName' | translate }}</th>
                  <th>{{ 'common.status' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (job of printJobs(); track job.id) {
                <tr>
                  <td>{{ job.id }}</td>
                  <td>{{ job.template_name }}</td>
                  <td>{{ job.status }}</td>
                  <td>
                    <button mat-button type="button" (click)="downloadTspl(job.id)">TSPL</button>
                    @if (job.status === 'queued' || job.status === 'sent') {
                    <button mat-button type="button" (click)="cancelJob(job.id)">{{ 'common.cancel' | translate }}</button>
                    }
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </mat-tab>
        }

        @if (canTransfer()) {
        <mat-tab [label]="'barcode.tabTransfer' | translate">
          <div class="tab-body">
            <p class="hint">{{ 'barcode.transferHint' | translate }}</p>
            <app-barcode-scan-panel (scanned)="addTransferItem($event)" />
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
        margin: 16px 0;
      }
      .hint {
        color: #666;
        font-size: 14px;
      }
      .templates-tab { display: flex; flex-direction: column; gap: 20px; }
      .templates-header { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; justify-content: space-between; }
      .templates-title { margin: 0; font-size: 18px; font-weight: 600; }
      .templates-subtitle { margin: 4px 0 0; font-size: 13px; color: rgba(0,0,0,.55); }
      .templates-actions { display: flex; gap: 8px; flex-shrink: 0; }
      .templates-actions button mat-icon { margin-right: 4px; font-size: 18px; width: 18px; height: 18px; }
      .template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
      .template-card {
        cursor: pointer;
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 12px;
        padding: 0;
        overflow: hidden;
        transition: box-shadow .2s, border-color .2s, transform .15s;
      }
      .template-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); transform: translateY(-1px); }
      .template-card--active { border-color: #1976d2; box-shadow: 0 0 0 2px rgba(25,118,210,.18); }
      .template-card__preview {
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(145deg, #f0f3f6, #e8ecf0);
        min-height: 88px; padding: 10px;
      }
      .template-card__body { padding: 12px 14px 4px; }
      .template-card__body h4 { margin: 0 0 4px; font-size: 14px; font-weight: 600; line-height: 1.3; }
      .template-card__meta { font-size: 12px; color: rgba(0,0,0,.5); }
      .template-card__actions { display: flex; justify-content: flex-end; padding: 0 4px 4px; gap: 0; }
      .templates-empty {
        display: flex; flex-direction: column; align-items: center; gap: 12px;
        padding: 40px 24px; text-align: center; color: rgba(0,0,0,.5); border-radius: 12px;
      }
      .templates-empty mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: .35; }
      .templates-empty p { margin: 0; }
    `,
  ],
})
export class BarcodeComponent implements OnInit {
  private barcode = inject(BarcodeService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  templates = signal<LabelTemplate[]>([]);
  editingTemplate = signal<LabelTemplate | null>(null);
  batchItems = signal<PrintBatchItem[]>([]);
  printJobs = signal<PrintJob[]>([]);
  transferItems = signal<Array<{ product_id: number; sku: string; quantity: number }>>([]);
  defaultCopies = signal(1);

  printForm = this.fb.nonNullable.group({
    template_id: [0, Validators.required],
  });

  canLabels = () => this.auth.hasPermission('barcode.labels');
  canPrint = () => this.auth.hasPermission('barcode.print');
  canTransfer = () => this.auth.hasPermission('inventory.write');

  ngOnInit(): void {
    this.reloadTemplates();
    this.reloadJobs();
    this.barcode.getSettings().subscribe({
      next: (s) => this.defaultCopies.set(s.default_copies || 1),
      error: () => {},
    });
  }

  openDownloadDialog(): void {
    this.dialog.open(EbarcodeDownloadDialogComponent, { width: '720px' });
  }

  onTab(idx: number): void {
    if (idx === 3 || idx === 2) this.reloadJobs();
  }

  reloadTemplates(): void {
    this.barcode.getTemplates().subscribe((list) => {
      this.templates.set(list);
      if (list.length && !this.printForm.value.template_id) {
        this.printForm.patchValue({ template_id: list[0].id });
      }
    });
  }

  reloadJobs(): void {
    this.barcode.listPrintJobs().subscribe((jobs) => this.printJobs.set(jobs.slice(0, 20)));
  }

  onScanned(_r: BarcodeLookupResult): void {}

  seedDefaults(): void {
    this.barcode.seedDefaults().subscribe({
      next: (r) => {
        this.snack.open(`${r.created} şablon`, undefined, { duration: 2000 });
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

  templateAspect(t: LabelTemplate): string {
    const w = Math.max(1, +t.width_mm);
    const h = Math.max(1, +t.height_mm);
    return `${w} / ${h}`;
  }

  duplicateTemplate(t: LabelTemplate): void {
    this.barcode.duplicateTemplate(t.id).subscribe({ next: () => this.reloadTemplates() });
  }

  deleteTemplate(t: LabelTemplate): void {
    this.barcode.deleteTemplate(t.id).subscribe({
      next: (res) => {
        this.snack.open(res.detail, undefined, { duration: 3000 });
        this.reloadTemplates();
      },
    });
  }

  onTemplateSaved(t: LabelTemplate): void {
    this.editingTemplate.set(t);
    this.reloadTemplates();
  }

  addBatchItem(r: BarcodeLookupResult): void {
    if (this.batchItems().some((i) => i.product_id === r.product.id)) return;
    this.batchItems.set([
      ...this.batchItems(),
      {
        product_id: r.product.id,
        sku: r.product.sku,
        name: r.product.name,
        barcode: r.product.barcode,
        copies: this.defaultCopies(),
      },
    ]);
  }

  updateBatchCopies(productId: number, copies: number): void {
    this.batchItems.update((list) =>
      list.map((i) => (i.product_id === productId ? { ...i, copies } : i))
    );
  }

  removeBatchItem(productId: number): void {
    this.batchItems.update((list) => list.filter((i) => i.product_id !== productId));
  }

  queueBatch(immediate = false): void {
    const templateId = this.printForm.value.template_id!;
    const items = this.batchItems().map((i) => ({ product_id: i.product_id, copies: i.copies }));
    this.barcode.createPrintBatch(templateId, items, immediate).subscribe({
      next: (jobs) => {
        const msg = immediate
          ? `${jobs.length} iş hemen yazdırma için gönderildi`
          : `${jobs.length} iş kuyruğa alındı`;
        this.snack.open(msg, undefined, { duration: 3000 });
        this.batchItems.set([]);
        this.reloadJobs();
      },
    });
  }

  downloadTspl(jobId: number): void {
    this.barcode.downloadTspl(jobId).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `print-job-${jobId}.tspl`;
        a.click();
      },
    });
  }

  cancelJob(jobId: number): void {
    this.barcode.cancelPrintJob(jobId).subscribe({ next: () => this.reloadJobs() });
  }

  addTransferItem(r: BarcodeLookupResult): void {
    if (r.stock.depo_quantity <= 0) {
      this.snack.open('DEPO stok yok', undefined, { duration: 2000 });
      return;
    }
    if (this.transferItems().some((i) => i.product_id === r.product.id)) return;
    this.transferItems.set([
      ...this.transferItems(),
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
      next: (res) => {
        this.snack.open(`${res.transfers?.length ?? 0} transfer`, undefined, { duration: 3000 });
        this.transferItems.set([]);
      },
      error: () => this.snack.open('Transfer hatası', undefined, { duration: 3000 }),
    });
  }
}
