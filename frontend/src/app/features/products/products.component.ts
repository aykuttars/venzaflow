import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTabsModule,
    TranslateModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="products" icon="inventory_2">
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="onAdd()">
          <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
        </button>
        }
      </app-page-header>

      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab [label]="'products.title' | translate">
          <div style="display:flex; gap:12px; margin-top:16px">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
              <mat-label>{{ 'common.search' | translate }}</mat-label>
              <input matInput (input)="onSearch($any($event.target).value)" />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>

          <table class="bms-table" style="margin-top:8px">
            <thead>
              <tr>
                <th>{{ 'products.sku' | translate }}</th>
                <th>{{ 'products.name' | translate }}</th>
                <th>{{ 'products.category' | translate }}</th>
                <th>{{ 'products.unitPrice' | translate }}</th>
                <th>{{ 'common.active' | translate }}</th>
                @if (canWrite()) { <th></th> }
              </tr>
            </thead>
            <tbody>
              @for (p of items(); track p.id) {
              <tr>
                <td>{{ p.sku }}</td>
                <td>{{ p.name }}</td>
                <td>{{ p.category_name }}</td>
                <td>{{ p.unit_price }}</td>
                <td>{{ (p.is_active ? 'common.yes' : 'common.no') | translate }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openProductForm(p)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeProduct(p)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
              @if (items().length === 0) {
              <tr><td [attr.colspan]="canWrite() ? 6 : 5" style="text-align:center; padding:24px">{{ 'common.noRecords' | translate }}</td></tr>
              }
            </tbody>
          </table>
        </mat-tab>

        <mat-tab [label]="'products.categories' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead>
              <tr>
                <th>{{ 'products.name' | translate }}</th>
                <th>{{ 'products.slug' | translate }}</th>
                @if (canWrite()) { <th></th> }
              </tr>
            </thead>
            <tbody>
              @for (c of categories(); track c.id) {
              <tr>
                <td>{{ c.name }}</td>
                <td>{{ c.slug }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openCategoryForm(c)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeCategory(c)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
              @if (categories().length === 0) {
              <tr><td [attr.colspan]="canWrite() ? 3 : 2" style="text-align:center; padding:24px">{{ 'common.noRecords' | translate }}</td></tr>
              }
            </tbody>
          </table>
        </mat-tab>
      </mat-tab-group>

      @if (editing()) {
      <div class="overlay" (click)="cancel()"></div>
      <div class="dialog">
        <h2>{{ dialogTitle() }}</h2>
        <form [formGroup]="activeForm" (ngSubmit)="save()" style="display:flex; flex-direction:column; gap:8px">
          @if (tab() === 0) {
            <mat-form-field appearance="outline"><mat-label>{{ 'products.sku' | translate }}</mat-label>
              <input matInput formControlName="sku" required />
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'products.name' | translate }}</mat-label>
              <input matInput formControlName="name" required />
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'products.category' | translate }}</mat-label>
              <mat-select formControlName="category" required>
                @for (c of categories(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
                }
              </mat-select>
              @if (categories().length === 0) {
              <mat-hint>{{ 'products.noCategoriesHint' | translate }}</mat-hint>
              }
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'products.unitPrice' | translate }}</mat-label>
              <input matInput type="number" step="0.01" formControlName="unit_price" required />
            </mat-form-field>
            <mat-slide-toggle formControlName="is_active">{{ 'common.active' | translate }}</mat-slide-toggle>
          } @else {
            <mat-form-field appearance="outline"><mat-label>{{ 'products.name' | translate }}</mat-label>
              <input matInput formControlName="name" required />
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'products.slug' | translate }}</mat-label>
              <input matInput formControlName="slug" />
              <mat-hint>{{ 'products.slugHint' | translate }}</mat-hint>
            </mat-form-field>
          }
          <div style="display:flex; gap:8px; justify-content:flex-end">
            <button mat-button type="button" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="activeForm.invalid">{{ 'common.save' | translate }}</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [CRUD_DIALOG_STYLES],
})
export class ProductsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);

  private crud = new CrudService<Product>(this.http, 'products');
  private catCrud = new CrudService<Category>(this.http, 'products/categories');

  tab = signal(0);
  items = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  editing = signal(false);
  private search = '';

  productForm = this.fb.nonNullable.group({
    id: this.fb.control<number | null>(null),
    sku: ['', Validators.required],
    name: ['', Validators.required],
    category: this.fb.control<number | null>(null, Validators.required),
    unit_price: ['0.00', Validators.required],
    is_active: [true],
  });

  categoryForm = this.fb.nonNullable.group({
    id: this.fb.control<number | null>(null),
    name: ['', Validators.required],
    slug: [''],
  });

  activeForm: FormGroup = this.productForm;

  ngOnInit(): void {
    this.reloadProducts();
    this.reloadCategories();
  }

  canWrite = () => this.auth.hasPermission('products.write');

  dialogTitle(): string {
    if (this.tab() === 0) {
      return this.translate.instant(this.productForm.value.id ? 'products.edit' : 'products.new');
    }
    return this.translate.instant(this.categoryForm.value.id ? 'products.editCategory' : 'products.newCategory');
  }

  onAdd(): void {
    if (this.tab() === 0) this.openProductForm();
    else this.openCategoryForm();
  }

  protected onSearch(v: string) {
    this.search = v;
    this.reloadProducts();
  }

  protected reloadProducts() {
    this.crud
      .list({ limit: 100, search: this.search })
      .subscribe((p) => this.items.set(p.results));
  }

  protected reloadCategories() {
    this.catCrud
      .list({ limit: 200 })
      .subscribe((p: Page<Category>) => this.categories.set(p.results));
  }

  protected openProductForm(p?: Product) {
    this.tab.set(0);
    this.activeForm = this.productForm;
    if (p) {
      this.productForm.reset({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        unit_price: p.unit_price,
        is_active: p.is_active,
      });
    } else {
      this.productForm.reset({
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

  protected openCategoryForm(c?: Category) {
    this.tab.set(1);
    this.activeForm = this.categoryForm;
    if (c) {
      this.categoryForm.reset({ id: c.id, name: c.name, slug: c.slug });
    } else {
      this.categoryForm.reset({ id: null, name: '', slug: '' });
    }
    this.editing.set(true);
  }

  protected cancel() {
    this.editing.set(false);
  }

  protected save() {
    if (this.tab() === 0) this.saveProduct();
    else this.saveCategory();
  }

  private saveProduct() {
    if (this.productForm.invalid) return;
    const v = this.productForm.getRawValue();
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
        this.reloadProducts();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  private saveCategory() {
    if (this.categoryForm.invalid) return;
    const v = this.categoryForm.getRawValue();
    const slug = v.slug || slugify(v.name);
    const payload = { name: v.name, slug };
    const op = v.id
      ? this.catCrud.update(v.id, payload)
      : this.catCrud.create(payload);
    op.subscribe({
      next: () => {
        this.editing.set(false);
        this.reloadCategories();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  protected removeProduct(p: Product) {
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${p.sku})`)) return;
    this.crud.remove(p.id).subscribe({
      next: () => {
        this.reloadProducts();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  protected removeCategory(c: Category) {
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${c.name})`)) return;
    this.catCrud.remove(c.id).subscribe({
      next: () => {
        this.reloadCategories();
        this.reloadProducts();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(
          e?.error?.detail || e?.error?.category?.[0] || this.translate.instant('common.error'),
          'OK',
          { duration: 2500 },
        ),
    });
  }
}
