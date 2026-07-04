import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { API_BASE } from '../../core/api';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService, Page } from '../../shared/crud.service';
import { downloadBlob, postImportFile } from '../../shared/import-export.utils';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { SearchSelectComponent } from '../../shared/search-select.component';

interface InventoryDashboard {
  total_products: number;
  total_stock: number;
  critical_stock_count: number;
  critical_stock: Array<{
    product_sku: string;
    warehouse_code: string;
    quantity: number;
    reorder_level: number;
  }>;
  total_cost: number;
  total_sale_value: number;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    TranslateModule,
    RouterLink,
    PageHeaderComponent,
    SearchSelectComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="inventory" icon="warehouse">
        @if (hasBarcode()) {
        <a mat-stroked-button routerLink="/barcode"><mat-icon>qr_code_scanner</mat-icon> Barkod</a>
        }
        @if (canWrite() && tab() > 0) {
        <button mat-flat-button color="primary" (click)="onAdd()"><mat-icon>add</mat-icon> {{ 'common.new' | translate }}</button>
        }
      </app-page-header>

      <mat-tab-group (selectedIndexChange)="onTabChange($event)">
        <mat-tab [label]="'inventory.overview' | translate">
          @if (dashboard(); as d) {
          <div class="card-grid" style="margin-top:16px">
            <div class="metric-card">
              <span class="label">{{ 'inventory.totalProducts' | translate }}</span>
              <span class="value">{{ d.total_products }}</span>
            </div>
            <div class="metric-card">
              <span class="label">{{ 'inventory.totalStock' | translate }}</span>
              <span class="value">{{ d.total_stock }}</span>
            </div>
            <div class="metric-card">
              <span class="label">{{ 'inventory.criticalCount' | translate }}</span>
              <span class="value">{{ d.critical_stock_count }}</span>
            </div>
            <div class="metric-card">
              <span class="label">{{ 'inventory.totalCost' | translate }}</span>
              <span class="value">{{ d.total_cost | number: '1.2-2' }}</span>
            </div>
            <div class="metric-card">
              <span class="label">{{ 'inventory.saleValue' | translate }}</span>
              <span class="value">{{ d.total_sale_value | number: '1.2-2' }}</span>
            </div>
          </div>
          @if (d.critical_stock.length) {
          <table class="bms-table" style="margin-top:16px">
            <thead>
              <tr>
                <th>{{ 'products.sku' | translate }}</th>
                <th>{{ 'inventory.warehouse' | translate }}</th>
                <th>{{ 'inventory.quantity' | translate }}</th>
                <th>{{ 'inventory.reorderLevel' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of d.critical_stock; track c.product_sku + c.warehouse_code) {
              <tr>
                <td>{{ c.product_sku }}</td>
                <td>{{ c.warehouse_code }}</td>
                <td>{{ c.quantity }}</td>
                <td>{{ c.reorder_level }}</td>
              </tr>
              }
            </tbody>
          </table>
          }
          }
        </mat-tab>
        <mat-tab [label]="'inventory.warehouses' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'inventory.code' | translate }}</th><th>{{ 'products.name' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (w of warehouses(); track w.id) {
              <tr>
                <td>{{ w.code }}</td><td>{{ w.name }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openForm(w)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="remove(w)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'inventory.locations' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'inventory.code' | translate }}</th><th>{{ 'inventory.warehouse' | translate }}</th><th>{{ 'products.name' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (l of locations(); track l.id) {
              <tr>
                <td>{{ l.code }}</td><td>{{ l.warehouse_code }}</td><td>{{ l.name }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openLocationForm(l)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeLocation(l)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'inventory.stock' | translate">
          <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap">
            <button mat-stroked-button type="button" (click)="exportStock('csv')">
              <mat-icon>download</mat-icon> CSV
            </button>
            <button mat-stroked-button type="button" (click)="exportStock('xlsx')">
              <mat-icon>download</mat-icon> Excel
            </button>
            @if (canWrite()) {
            <button mat-stroked-button type="button" (click)="stockFileInput.click()">
              <mat-icon>upload</mat-icon> {{ 'common.import' | translate }}
            </button>
            <input #stockFileInput type="file" accept=".csv,.xlsx" hidden (change)="importStock($event)" />
            }
          </div>
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'products.sku' | translate }}</th><th>{{ 'inventory.warehouse' | translate }}</th><th>{{ 'inventory.location' | translate }}</th><th>{{ 'inventory.quantity' | translate }}</th><th>{{ 'inventory.available' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (s of stock(); track s.id) {
              <tr>
                <td>{{ s.product_sku }}</td><td>{{ s.warehouse_code }}</td><td>{{ s.location_code || '—' }}</td><td>{{ s.quantity }}</td><td>{{ s.available_quantity }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openStockForm(s)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeStock(s)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'inventory.movements' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'inventory.type' | translate }}</th><th>{{ 'products.sku' | translate }}</th><th>{{ 'inventory.delta' | translate }}</th><th>{{ 'inventory.note' | translate }}</th><th>{{ 'inventory.created' | translate }}</th></tr></thead>
            <tbody>
              @for (m of movements(); track m.id) {
              <tr>
                <td>{{ m.movement_type }}</td><td>{{ m.product_sku }}</td><td>{{ m.delta }}</td><td>{{ m.note || m.reason }}</td><td>{{ m.created_at }}</td>
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
      </mat-tab-group>

      @if (editing()) {
      <div class="overlay" (click)="editing.set(false)"></div>
      <div class="dialog">
        <h2>{{ dialogTitle() }}</h2>
        <form [formGroup]="activeForm" (ngSubmit)="save()" style="display:flex;flex-direction:column;gap:8px">
          @if (tab() === 1) {
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.code' | translate }}</mat-label><input matInput formControlName="code" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'products.name' | translate }}</mat-label><input matInput formControlName="name" /></mat-form-field>
          } @else if (tab() === 2) {
            <app-search-select
              formControlName="warehouse"
              apiPath="inventory/warehouses"
              moduleSlug="inventory"
              [label]="'inventory.warehouse' | translate"
              [labelKeys]="['code', 'name']"
              [required]="true"
            />
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.code' | translate }}</mat-label><input matInput formControlName="code" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'products.name' | translate }}</mat-label><input matInput formControlName="name" /></mat-form-field>
          } @else if (tab() === 3) {
            <app-search-select
              formControlName="product"
              apiPath="products"
              moduleSlug="products"
              [label]="'inventory.product' | translate"
              [labelKeys]="['sku', 'name']"
              [required]="true"
            />
            <app-search-select
              formControlName="warehouse"
              apiPath="inventory/warehouses"
              moduleSlug="inventory"
              [label]="'inventory.warehouse' | translate"
              [labelKeys]="['code', 'name']"
              [required]="true"
            />
            <app-search-select
              formControlName="location"
              apiPath="inventory/locations"
              moduleSlug="inventory"
              [label]="'inventory.location' | translate"
              [labelKeys]="['code', 'name']"
              [extraParams]="stockLocationFilter()"
              [allowNull]="true"
            />
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.quantity' | translate }}</mat-label><input matInput type="number" formControlName="quantity" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.reorderLevel' | translate }}</mat-label><input matInput type="number" formControlName="reorder_level" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.reserved' | translate }}</mat-label><input matInput type="number" formControlName="reserved_quantity" /></mat-form-field>
          } @else if (tab() === 4) {
            <app-search-select
              formControlName="stock"
              apiPath="inventory/stock"
              moduleSlug="inventory"
              [label]="'inventory.stock' | translate"
              [labelKeys]="['product_sku', 'warehouse_code', 'location_code']"
              [required]="true"
            />
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.type' | translate }}</mat-label>
              <mat-select formControlName="movement_type">
                @for (t of movementTypes; track t) {<mat-option [value]="t">{{ t }}</mat-option>}
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.quantity' | translate }}</mat-label><input matInput type="number" formControlName="quantity" min="1" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.note' | translate }}</mat-label><input matInput formControlName="note" /></mat-form-field>
          }
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="editing.set(false)">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
      }
      .metric-card {
        padding: 16px;
        border-radius: 8px;
        background: var(--mat-sys-surface-container, #f5f5f5);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .metric-card .label {
        font-size: 12px;
        opacity: 0.7;
      }
      .metric-card .value {
        font-size: 22px;
        font-weight: 600;
      }
    `,
  ],
})
export class InventoryComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  protected auth = inject(AuthService);

  tab = signal(0);
  dashboard = signal<InventoryDashboard | null>(null);
  editing = signal(false);
  dialogTitle = signal('Yeni');
  warehouses = signal<any[]>([]);
  locations = signal<any[]>([]);
  stock = signal<any[]>([]);
  movements = signal<any[]>([]);
  stockLocationFilter = signal<Record<string, number>>({});
  movementTypes = [
    'PURCHASE',
    'SALE',
    'RETURN',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT',
    'DAMAGE',
    'INITIAL_COUNT',
  ];

  private whCrud = new CrudService<any>(this.http, 'inventory/warehouses', this.auth, 'inventory');
  private locCrud = new CrudService<any>(this.http, 'inventory/locations', this.auth, 'inventory');
  private stockCrud = new CrudService<any>(this.http, 'inventory/stock', this.auth, 'inventory');
  private movCrud = new CrudService<any>(this.http, 'inventory/movements', this.auth, 'inventory');

  warehouseForm = this.fb.group({ id: this.fb.control<number | null>(null), code: ['', Validators.required], name: ['', Validators.required] });
  locationForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    warehouse: this.fb.control<number | null>(null, Validators.required),
    code: ['', Validators.required],
    name: ['', Validators.required],
  });
  stockForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    product: this.fb.control<number | null>(null, Validators.required),
    warehouse: this.fb.control<number | null>(null, Validators.required),
    location: this.fb.control<number | null>(null),
    quantity: [0],
    reserved_quantity: [0],
    reorder_level: [0],
  });
  movementForm = this.fb.group({
    stock: this.fb.control<number | null>(null, Validators.required),
    movement_type: ['ADJUSTMENT', Validators.required],
    quantity: [1, Validators.required],
    note: [''],
  });

  get activeForm() {
    if (this.tab() === 1) return this.warehouseForm;
    if (this.tab() === 2) return this.locationForm;
    if (this.tab() === 3) return this.stockForm;
    return this.movementForm;
  }

  onTabChange(index: number): void {
    this.tab.set(index);
    if (index === 0) this.loadDashboard();
  }

  loadDashboard(): void {
    this.http.get<InventoryDashboard>(`${API_BASE}/inventory/dashboard/`).subscribe({
      next: (d) => this.dashboard.set(d),
    });
  }

  exportStock(fmt: 'csv' | 'xlsx'): void {
    this.http
      .get(`${API_BASE}/inventory/stock/export/`, {
        params: fmt === 'xlsx' ? { format: 'xlsx' } : {},
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => downloadBlob(blob, fmt === 'xlsx' ? 'stock.xlsx' : 'stock.csv'),
      });
  }

  importStock(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    postImportFile(this.http, `${API_BASE}/inventory/stock/import/`, file).subscribe({
      next: (res: any) => {
        this.reloadAll();
        this.loadDashboard();
        this.snack.open(
          `${this.translate.instant('common.import')}: +${res.created} / ~${res.updated}`,
          'OK',
          { duration: 3000 }
        );
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 2500,
        }),
    });
    input.value = '';
  }

  ngOnInit(): void {
    this.stockForm.get('warehouse')?.valueChanges.subscribe((wh) => {
      this.stockLocationFilter.set(wh != null ? { warehouse: wh } : {});
    });
    this.reloadAll();
    this.loadDashboard();
  }

  canWrite = () => this.auth.hasPermission('inventory.write');
  hasBarcode = () => this.auth.hasModule('barcode');
  onAdd = () => {
    const t = this.tab();
    if (t === 1) this.openForm();
    else if (t === 2) this.openLocationForm();
    else if (t === 3) this.openStockForm();
    else if (t === 4) this.openMovementForm();
  };

  reloadAll(): void {
    this.whCrud.list({ limit: 200 }).subscribe((p) => this.warehouses.set(p.results));
    this.locCrud.list({ limit: 500 }).subscribe((p) => this.locations.set(p.results));
    this.stockCrud.list({ limit: 200 }).subscribe((p) => this.stock.set(p.results));
    this.movCrud.list({ limit: 200 }).subscribe((p) => this.movements.set(p.results));
  }

  openForm(w?: any): void {
    this.tab.set(1);
    this.dialogTitle.set(this.translate.instant(w ? 'inventory.editWarehouse' : 'inventory.newWarehouse'));
    this.warehouseForm.reset(w ? { id: w.id, code: w.code, name: w.name } : { id: null, code: '', name: '' });
    this.editing.set(true);
  }

  openStockForm(s?: any): void {
    this.tab.set(3);
    this.dialogTitle.set(this.translate.instant(s ? 'inventory.editStock' : 'inventory.newStock'));
    this.stockForm.reset(
      s
        ? {
            id: s.id,
            product: s.product,
            warehouse: s.warehouse,
            location: s.location,
            quantity: s.quantity,
            reserved_quantity: s.reserved_quantity ?? 0,
            reorder_level: s.reorder_level,
          }
        : { id: null, product: null, warehouse: null, location: null, quantity: 0, reserved_quantity: 0, reorder_level: 0 }
    );
    this.stockLocationFilter.set(s?.warehouse != null ? { warehouse: s.warehouse } : {});
    const productCtrl = this.stockForm.get('product');
    if (this.auth.hasModule('products')) productCtrl?.enable();
    else productCtrl?.disable();
    this.editing.set(true);
  }

  openLocationForm(l?: any): void {
    this.tab.set(2);
    this.dialogTitle.set(this.translate.instant(l ? 'common.edit' : 'common.new'));
    this.locationForm.reset(
      l ? { id: l.id, warehouse: l.warehouse, code: l.code, name: l.name } : { id: null, warehouse: null, code: '', name: '' }
    );
    this.editing.set(true);
  }

  openMovementForm(): void {
    this.tab.set(4);
    this.dialogTitle.set(this.translate.instant('inventory.newMovement'));
    this.movementForm.reset({ stock: null, movement_type: 'ADJUSTMENT', quantity: 1, note: '' });
    this.editing.set(true);
  }

  save(): void {
    const t = this.tab();
    if (t === 1) {
      const v = this.warehouseForm.getRawValue();
      const payload = { code: v.code, name: v.name };
      const op = v.id ? this.whCrud.update(v.id!, payload) : this.whCrud.create(payload);
      op.subscribe(() => {
        this.editing.set(false);
        this.reloadAll();
      });
    } else if (t === 2) {
      const v = this.locationForm.getRawValue();
      const payload = { warehouse: v.warehouse, code: v.code, name: v.name };
      const op = v.id ? this.locCrud.update(v.id!, payload) : this.locCrud.create(payload);
      op.subscribe(() => {
        this.editing.set(false);
        this.reloadAll();
      });
    } else if (t === 3) {
      const v = this.stockForm.getRawValue();
      const payload = {
        product: v.product,
        warehouse: v.warehouse,
        location: v.location,
        quantity: v.quantity,
        reserved_quantity: v.reserved_quantity,
        reorder_level: v.reorder_level,
      };
      const op = v.id ? this.stockCrud.update(v.id!, payload) : this.stockCrud.create(payload);
      op.subscribe(() => {
        this.editing.set(false);
        this.reloadAll();
      });
    } else {
      const v = this.movementForm.getRawValue();
      const payload = {
        stock: v.stock,
        movement_type: v.movement_type,
        quantity: v.quantity,
        note: v.note,
      };
      this.movCrud.create(payload).subscribe(() => {
        this.editing.set(false);
        this.reloadAll();
      });
    }
  }

  removeLocation(l: any): void {
    this.confirmDialog.confirmDelete(l.code).then((ok) => {
      if (!ok) return;
      this.locCrud.remove(l.id).subscribe(() => this.reloadAll());
    });
  }

  remove(w: any): void {
    this.confirmDialog.confirmDelete().then((ok) => {
      if (!ok) return;
      this.whCrud.remove(w.id).subscribe(() => this.reloadAll());
    });
  }
  removeStock(s: any): void {
    this.confirmDialog.confirmDelete().then((ok) => {
      if (!ok) return;
      this.stockCrud.remove(s.id).subscribe(() => this.reloadAll());
    });
  }
}
