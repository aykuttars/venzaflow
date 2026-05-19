import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CrudService, Page } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface Category { id: number; name: string; slug: string; }
interface Product {
  id: number;
  sku: string;
  name: string;
  category: number;
  category_name?: string;
  unit_price: string;
  is_active: boolean;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Products" icon="inventory_2">
        <button mat-flat-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> New product
        </button>
      </app-page-header>

      <div style="display:flex; gap:12px">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
          <mat-label>Search</mat-label>
          <input matInput (input)="onSearch($any($event.target).value)" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      <table class="bms-table">
        <thead>
          <tr>
            <th>SKU</th><th>Name</th><th>Category</th><th>Price</th><th>Active</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (p of items(); track p.id) {
          <tr>
            <td>{{ p.sku }}</td>
            <td>{{ p.name }}</td>
            <td>{{ p.category_name }}</td>
            <td>{{ p.unit_price }}</td>
            <td>{{ p.is_active ? 'Yes' : 'No' }}</td>
            <td style="text-align:right">
              <button mat-icon-button (click)="openForm(p)" aria-label="Edit"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button (click)="remove(p)" aria-label="Delete"><mat-icon>delete</mat-icon></button>
            </td>
          </tr>
          }
          @if (items().length === 0) {
            <tr><td colspan="6" style="text-align:center; padding:24px">No products yet.</td></tr>
          }
        </tbody>
      </table>

      @if (editing()) {
      <div class="overlay" (click)="cancel()"></div>
      <div class="dialog">
        <h2>{{ form.value.id ? 'Edit' : 'New' }} product</h2>
        <form [formGroup]="form" (ngSubmit)="save()" style="display:flex; flex-direction:column; gap:8px">
          <mat-form-field appearance="outline"><mat-label>SKU</mat-label>
            <input matInput formControlName="sku" required />
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Name</mat-label>
            <input matInput formControlName="name" required />
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Category</mat-label>
            <mat-select formControlName="category" required>
              @for (c of categories(); track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Unit price</mat-label>
            <input matInput type="number" step="0.01" formControlName="unit_price" required />
          </mat-form-field>
          <mat-slide-toggle formControlName="is_active">Active</mat-slide-toggle>
          <div style="display:flex; gap:8px; justify-content:flex-end">
            <button mat-button type="button" (click)="cancel()">Cancel</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">Save</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [
    `
      table.bms-table th, table.bms-table td { padding: 10px 12px; }
      table.bms-table thead { background: rgba(0,0,0,.04); }
      .overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:10; }
      .dialog {
        position:fixed; z-index:11; top:50%; left:50%;
        transform:translate(-50%,-50%); background:white;
        padding:24px; min-width:380px; border-radius:8px;
      }
    `,
  ],
})
export class ProductsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private crud = new CrudService<Product>(this.http, 'products');
  private catCrud = new CrudService<Category>(this.http, 'products/categories');

  items = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  editing = signal(false);
  private search = '';

  protected form = this.fb.nonNullable.group({
    id: this.fb.control<number | null>(null),
    sku: ['', Validators.required],
    name: ['', Validators.required],
    category: this.fb.control<number | null>(null, Validators.required),
    unit_price: ['0.00', Validators.required],
    is_active: [true],
  });

  ngOnInit(): void {
    this.reload();
    this.catCrud
      .list({ limit: 200 })
      .subscribe((p: Page<Category>) => this.categories.set(p.results));
  }

  protected onSearch(v: string) {
    this.search = v;
    this.reload();
  }

  protected reload() {
    this.crud
      .list({ limit: 100, search: this.search })
      .subscribe((p) => this.items.set(p.results));
  }

  protected openForm(p?: Product) {
    if (p) {
      this.form.reset({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        unit_price: p.unit_price,
        is_active: p.is_active,
      });
    } else {
      this.form.reset({
        id: null,
        sku: '',
        name: '',
        category: null,
        unit_price: '0.00',
        is_active: true,
      });
    }
    this.editing.set(true);
  }

  protected cancel() {
    this.editing.set(false);
  }

  protected save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload = {
      sku: v.sku,
      name: v.name,
      category: v.category!,
      unit_price: v.unit_price,
      is_active: v.is_active,
    };
    const op = v.id
      ? this.crud.update(v.id, payload as Partial<Product>)
      : this.crud.create(payload as Partial<Product>);
    op.subscribe({
      next: () => {
        this.editing.set(false);
        this.reload();
        this.snack.open('Saved', 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || 'Save failed', 'OK', { duration: 2500 }),
    });
  }

  protected remove(p: Product) {
    if (!confirm(`Delete ${p.sku}?`)) return;
    this.crud.remove(p.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open('Deleted', 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || 'Delete failed', 'OK', { duration: 2500 }),
    });
  }
}
