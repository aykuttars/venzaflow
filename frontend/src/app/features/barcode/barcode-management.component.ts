import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { HttpClient } from '@angular/common/http';
import { BarcodeService, BarcodeSettings, LabelTemplate } from './barcode.service';

const OPERATION_FLAGS = [
  'sales_stock_deduction',
  'warehouse_vitrin',
  'retail_labeling',
  'inventory_count',
  'shop_accounting',
] as const;

const DEPARTMENTS = ['admin', 'sales', 'warehouse'] as const;

@Component({
  selector: 'app-barcode-management',
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
    MatSlideToggleModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="mgmt">
      <form [formGroup]="form" class="sections">
        <section>
          <h3>{{ 'barcode.management.operations' | translate }}</h3>
          @for (flag of operationFlags; track flag) {
          <mat-slide-toggle [formControlName]="'flag_' + flag">
            {{ ('barcode.management.flags.' + flag) | translate }}
          </mat-slide-toggle>
          }
        </section>

        <section>
          <h3>{{ 'barcode.management.scan' | translate }}</h3>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'barcode.management.scanMissAction' | translate }}</mat-label>
            <mat-select formControlName="scan_miss_action">
              <mat-option value="ignore">{{ 'barcode.management.missIgnore' | translate }}</mat-option>
              <mat-option value="assign_existing">{{ 'barcode.management.missAssign' | translate }}</mat-option>
              <mat-option value="create_wizard">{{ 'barcode.management.missWizard' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-slide-toggle formControlName="normalize_tr_scan">
            {{ 'barcode.management.normalizeTr' | translate }}
          </mat-slide-toggle>
        </section>

        <section>
          <h3>{{ 'barcode.management.qrGenerate' | translate }}</h3>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>QR</mat-label>
            <mat-select formControlName="qr_content_mode">
              <mat-option value="barcode">Barcode</mat-option>
              <mat-option value="sku">SKU</mat-option>
              <mat-option value="compact_detail">{{ 'barcode.management.compactDetail' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>EAN prefix</mat-label>
            <input matInput formControlName="ean_prefix" maxlength="3" />
          </mat-form-field>
          <mat-slide-toggle formControlName="auto_generate_on_create">
            {{ 'barcode.management.autoGenerate' | translate }}
          </mat-slide-toggle>
        </section>

        <section>
          <h3>{{ 'barcode.management.printStock' | translate }}</h3>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'barcode.management.defaultLabelTemplate' | translate }}</mat-label>
            <mat-select formControlName="default_label_template">
              <mat-option [value]="null">{{ 'barcode.labelTemplateDefault' | translate }}</mat-option>
              @for (t of templates(); track t.id) {
              <mat-option [value]="t.id">{{ t.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'barcode.management.printMode' | translate }}</mat-label>
            <mat-select formControlName="print_mode">
              <mat-option value="queue_only">{{ 'barcode.management.queueOnly' | translate }}</mat-option>
              <mat-option value="immediate">{{ 'barcode.management.immediate' | translate }}</mat-option>
              <mat-option value="both">{{ 'barcode.management.both' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'barcode.management.stockDeduction' | translate }}</mat-label>
            <mat-select formControlName="stock_deduction_mode">
              <mat-option value="off">{{ 'barcode.management.stockOff' | translate }}</mat-option>
              <mat-option value="on_invoice">{{ 'barcode.management.stockInvoice' | translate }}</mat-option>
              <mat-option value="on_manual_confirm">{{ 'barcode.management.stockManual' | translate }}</mat-option>
              <mat-option value="both">{{ 'barcode.management.both' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'barcode.copies' | translate }}</mat-label>
              <input matInput type="number" formControlName="default_copies" min="1" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'barcode.management.defaultTransferQty' | translate }}</mat-label>
              <input matInput type="number" formControlName="default_transfer_qty" min="1" />
            </mat-form-field>
          </div>
        </section>

        <section>
          <h3>{{ 'barcode.management.logo' | translate }}</h3>
          @if (settings()?.label_logo_url) {
          <img [src]="settings()!.label_logo_url!" alt="logo" class="logo-preview" />
          }
          <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogoSelected($event)" />
          <p class="hint">{{ 'barcode.management.logoHint' | translate }}</p>
        </section>

        <section>
          <h3>{{ 'barcode.management.roleTemplates' | translate }}</h3>
          <table class="bms-table">
            <thead>
              <tr>
                <th>{{ 'barcode.templateName' | translate }}</th>
                @for (dept of departments; track dept) {
                <th>{{ dept }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (t of templates(); track t.id) {
              <tr>
                <td>{{ t.name }}</td>
                @for (dept of departments; track dept) {
                <td>
                  <mat-checkbox
                    [checked]="isDeptAssigned(t, dept)"
                    (change)="toggleDept(t, dept, $event.checked)"
                  />
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </section>

        <section>
          <h3>{{ 'barcode.management.bulkGenerate' | translate }}</h3>
          <button mat-stroked-button type="button" (click)="bulkGenerate()">
            <mat-icon>qr_code_2</mat-icon>
            {{ 'barcode.management.generateMissing' | translate }}
          </button>
        </section>

        <div class="actions">
          <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid">
            {{ 'common.save' | translate }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .mgmt {
        max-width: 960px;
      }
      section {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #eee;
      }
      section h3 {
        margin: 0 0 12px;
      }
      mat-slide-toggle {
        display: block;
        margin-bottom: 8px;
      }
      .row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .actions {
        margin-top: 16px;
      }
      .logo-preview {
        max-height: 64px;
        display: block;
        margin-bottom: 8px;
      }
      .hint {
        font-size: 13px;
        color: #666;
      }
    `,
  ],
})
export class BarcodeManagementComponent implements OnInit {
  private barcode = inject(BarcodeService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  operationFlags = OPERATION_FLAGS;
  departments = DEPARTMENTS;
  templates = signal<LabelTemplate[]>([]);
  settings = signal<BarcodeSettings | null>(null);

  form = this.fb.group({
    scan_miss_action: ['create_wizard'],
    normalize_tr_scan: [true],
    qr_content_mode: ['barcode'],
    ean_prefix: ['869'],
    auto_generate_on_create: [false],
    print_mode: ['both'],
    stock_deduction_mode: ['both'],
    default_copies: [1],
    default_transfer_qty: [1],
    default_label_template: this.fb.control<number | null>(null),
    flag_sales_stock_deduction: [true],
    flag_warehouse_vitrin: [true],
    flag_retail_labeling: [true],
    flag_inventory_count: [true],
    flag_shop_accounting: [true],
  });

  ngOnInit(): void {
    this.barcode.getSettings().subscribe((s) => {
      this.settings.set(s);
      const flags = s.operation_flags || {};
      this.form.patchValue({
        scan_miss_action: s.scan_miss_action,
        normalize_tr_scan: s.normalize_tr_scan,
        qr_content_mode: s.qr_content_mode,
        ean_prefix: s.ean_prefix,
        auto_generate_on_create: s.auto_generate_on_create,
        print_mode: s.print_mode,
        stock_deduction_mode: s.stock_deduction_mode,
        default_copies: s.default_copies,
        default_transfer_qty: s.default_transfer_qty,
        default_label_template: s.default_label_template ?? null,
        flag_sales_stock_deduction: !!flags['sales_stock_deduction'],
        flag_warehouse_vitrin: !!flags['warehouse_vitrin'],
        flag_retail_labeling: !!flags['retail_labeling'],
        flag_inventory_count: !!flags['inventory_count'],
        flag_shop_accounting: !!flags['shop_accounting'],
      });
    });
    this.barcode.getTemplates().subscribe((t) => this.templates.set(t));
  }

  isDeptAssigned(t: LabelTemplate, dept: string): boolean {
    const keys = t.allowed_department_keys || [];
    return !keys.length || keys.includes(dept);
  }

  toggleDept(t: LabelTemplate, dept: string, checked: boolean): void {
    let keys = [...(t.allowed_department_keys || [])];
    if (!keys.length) {
      keys = [...this.departments];
    }
    if (checked && !keys.includes(dept)) keys.push(dept);
    if (!checked) keys = keys.filter((k) => k !== dept);
    this.barcode.saveTemplate({ id: t.id, allowed_department_keys: keys }).subscribe({
      next: () => this.barcode.getTemplates().subscribe((list) => this.templates.set(list)),
    });
  }

  save(): void {
    const v = this.form.getRawValue();
    const payload: Partial<BarcodeSettings> = {
      scan_miss_action: v.scan_miss_action!,
      normalize_tr_scan: !!v.normalize_tr_scan,
      qr_content_mode: v.qr_content_mode!,
      ean_prefix: v.ean_prefix!,
      auto_generate_on_create: !!v.auto_generate_on_create,
      print_mode: v.print_mode!,
      stock_deduction_mode: v.stock_deduction_mode!,
      default_copies: v.default_copies!,
      default_transfer_qty: v.default_transfer_qty!,
      default_label_template: v.default_label_template ?? null,
      operation_flags: {
        sales_stock_deduction: !!v.flag_sales_stock_deduction,
        warehouse_vitrin: !!v.flag_warehouse_vitrin,
        retail_labeling: !!v.flag_retail_labeling,
        inventory_count: !!v.flag_inventory_count,
        shop_accounting: !!v.flag_shop_accounting,
      },
    };
    this.http.patch<BarcodeSettings>(`${API_BASE}/barcode/settings/`, payload).subscribe({
      next: (s) => {
        this.settings.set(s);
        this.snack.open('Kaydedildi', undefined, { duration: 2000 });
      },
      error: () => this.snack.open('Hata', undefined, { duration: 3000 }),
    });
  }

  bulkGenerate(): void {
    this.barcode.generateMissing(500).subscribe({
      next: (r) => this.snack.open(`${r.generated} barkod üretildi`, undefined, { duration: 3000 }),
    });
  }

  onLogoSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.barcode.uploadLogo(file).subscribe({
      next: (s) => {
        this.settings.set(s);
        this.snack.open('Logo yüklendi', undefined, { duration: 2000 });
      },
      error: () => this.snack.open('Logo yüklenemedi', undefined, { duration: 3000 }),
    });
  }
}
