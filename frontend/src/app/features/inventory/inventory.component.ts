import { CommonModule } from '@angular/common';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { CrudService, Page } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    TranslateModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="inventory" icon="warehouse">
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="onAdd()"><mat-icon>add</mat-icon> {{ 'common.new' | translate }}</button>
        }
      </app-page-header>

      <mat-tab-group (selectedIndexChange)="tab.set($event)">
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
        <mat-tab [label]="'inventory.stock' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'products.sku' | translate }}</th><th>{{ 'inventory.warehouse' | translate }}</th><th>{{ 'inventory.quantity' | translate }}</th><th>{{ 'inventory.reorderLevel' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (s of stock(); track s.id) {
              <tr>
                <td>{{ s.product_sku }}</td><td>{{ s.warehouse_code }}</td><td>{{ s.quantity }}</td><td>{{ s.reorder_level }}</td>
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
            <thead><tr><th>{{ 'inventory.stockId' | translate }}</th><th>{{ 'inventory.delta' | translate }}</th><th>{{ 'inventory.reason' | translate }}</th><th>{{ 'inventory.reference' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (m of movements(); track m.id) {
              <tr>
                <td>{{ m.stock }}</td><td>{{ m.delta }}</td><td>{{ m.reason }}</td><td>{{ m.reference }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openMovementForm(m)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeMovement(m)"><mat-icon>delete</mat-icon></button>
                </td>
                }
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
          @if (tab() === 0) {
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.code' | translate }}</mat-label><input matInput formControlName="code" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'products.name' | translate }}</mat-label><input matInput formControlName="name" /></mat-form-field>
          } @else if (tab() === 1) {
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.product' | translate }}</mat-label>
              <mat-select formControlName="product" [disabled]="!hasProductsModule()">
                @for (p of products(); track p.id) {<mat-option [value]="p.id">{{ p.sku }}</mat-option>}
              </mat-select>
              @if (!hasProductsModule()) {
              <mat-hint>{{ 'inventory.productsModuleRequired' | translate }}</mat-hint>
              }
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.warehouse' | translate }}</mat-label>
              <mat-select formControlName="warehouse">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }}</mat-option>}</mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.quantity' | translate }}</mat-label><input matInput type="number" formControlName="quantity" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.reorderLevel' | translate }}</mat-label><input matInput type="number" formControlName="reorder_level" /></mat-form-field>
          } @else {
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.stockId' | translate }}</mat-label><input matInput type="number" formControlName="stock" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.delta' | translate }}</mat-label><input matInput type="number" formControlName="delta" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.reason' | translate }}</mat-label><input matInput formControlName="reason" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'inventory.reference' | translate }}</mat-label><input matInput formControlName="reference" /></mat-form-field>
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
  styles: [CRUD_DIALOG_STYLES],
})
export class InventoryComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);

  tab = signal(0);
  editing = signal(false);
  dialogTitle = signal('Yeni');
  warehouses = signal<any[]>([]);
  stock = signal<any[]>([]);
  movements = signal<any[]>([]);
  products = signal<any[]>([]);

  private whCrud = new CrudService<any>(this.http, 'inventory/warehouses', this.auth, 'inventory');
  private stockCrud = new CrudService<any>(this.http, 'inventory/stock', this.auth, 'inventory');
  private movCrud = new CrudService<any>(this.http, 'inventory/movements', this.auth, 'inventory');
  private prodCrud = new CrudService<any>(this.http, 'products', this.auth, 'products');

  warehouseForm = this.fb.group({ id: this.fb.control<number | null>(null), code: ['', Validators.required], name: ['', Validators.required] });
  stockForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    product: this.fb.control<number | null>(null, Validators.required),
    warehouse: this.fb.control<number | null>(null, Validators.required),
    quantity: [0],
    reorder_level: [0],
  });
  movementForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    stock: this.fb.control<number | null>(null, Validators.required),
    delta: [0, Validators.required],
    reason: [''],
    reference: [''],
  });

  get activeForm() {
    if (this.tab() === 0) return this.warehouseForm;
    if (this.tab() === 1) return this.stockForm;
    return this.movementForm;
  }

  ngOnInit(): void {
    this.reloadAll();
  }

  canWrite = () => this.auth.hasPermission('inventory.write');
  onAdd = () => {
    if (this.tab() === 0) this.openForm();
    else if (this.tab() === 1) this.openStockForm();
    else this.openMovementForm();
  };

  reloadAll(): void {
    this.whCrud.list({ limit: 200 }).subscribe((p) => this.warehouses.set(p.results));
    this.stockCrud.list({ limit: 200 }).subscribe((p) => this.stock.set(p.results));
    this.movCrud.list({ limit: 200 }).subscribe((p) => this.movements.set(p.results));
    if (this.auth.hasModule('products')) {
      this.prodCrud.list({ limit: 200 }).subscribe((p) => this.products.set(p.results));
    } else {
      this.products.set([]);
    }
  }

  hasProductsModule = () => this.auth.hasModule('products');

  openForm(w?: any): void {
    this.tab.set(0);
    this.dialogTitle.set(this.translate.instant(w ? 'inventory.editWarehouse' : 'inventory.newWarehouse'));
    this.warehouseForm.reset(w ? { id: w.id, code: w.code, name: w.name } : { id: null, code: '', name: '' });
    this.editing.set(true);
  }

  openStockForm(s?: any): void {
    this.tab.set(1);
    this.dialogTitle.set(this.translate.instant(s ? 'inventory.editStock' : 'inventory.newStock'));
    this.stockForm.reset(
      s
        ? { id: s.id, product: s.product, warehouse: s.warehouse, quantity: s.quantity, reorder_level: s.reorder_level }
        : { id: null, product: null, warehouse: null, quantity: 0, reorder_level: 0 }
    );
    this.editing.set(true);
  }

  openMovementForm(m?: any): void {
    this.tab.set(2);
    this.dialogTitle.set(this.translate.instant(m ? 'inventory.editMovement' : 'inventory.newMovement'));
    this.movementForm.reset(
      m ? { id: m.id, stock: m.stock, delta: m.delta, reason: m.reason, reference: m.reference } : { id: null, stock: null, delta: 0, reason: '', reference: '' }
    );
    this.editing.set(true);
  }

  save(): void {
    const t = this.tab();
    if (t === 0) {
      const v = this.warehouseForm.getRawValue();
      const payload = { code: v.code, name: v.name };
      const op = v.id ? this.whCrud.update(v.id!, payload) : this.whCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.reloadAll(); });
    } else if (t === 1) {
      const v = this.stockForm.getRawValue();
      const payload = { product: v.product, warehouse: v.warehouse, quantity: v.quantity, reorder_level: v.reorder_level };
      const op = v.id ? this.stockCrud.update(v.id!, payload) : this.stockCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.reloadAll(); });
    } else {
      const v = this.movementForm.getRawValue();
      const payload = { stock: v.stock, delta: v.delta, reason: v.reason, reference: v.reference };
      const op = v.id ? this.movCrud.update(v.id!, payload) : this.movCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.reloadAll(); });
    }
  }

  remove(w: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.whCrud.remove(w.id).subscribe(() => this.reloadAll());
  }
  removeStock(s: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.stockCrud.remove(s.id).subscribe(() => this.reloadAll());
  }
  removeMovement(m: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.movCrud.remove(m.id).subscribe(() => this.reloadAll());
  }
}
