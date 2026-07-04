import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { API_BASE } from '../../core/api';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService, Page } from '../../shared/crud.service';
import { DynamicProductFormComponent } from '../../shared/dynamic-fields/dynamic-form.component';
import { DynamicProductListComponent } from '../../shared/dynamic-fields/dynamic-list.component';
import { ListColumnConfig, ProductFieldDefinition, ProductRow } from '../../shared/dynamic-fields/models';
import { ProductConfigService, unwrapList } from '../../shared/dynamic-fields/product-config.service';
import { downloadBlob, postImportFile } from '../../shared/import-export.utils';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { ProductDetailDialogComponent } from './product-detail-dialog.component';
import { ProductFieldDefinitionsComponent } from './product-field-definitions.component';
import { ProductUiConfigComponent } from './product-ui-config.component';
import { ProductLabelPreviewDialogComponent } from '../barcode/product-label-preview-dialog.component';
import { BarcodeService, LabelTemplate } from '../barcode/barcode.service';
import { forkJoin } from 'rxjs';

interface Category { id: number; name: string; slug: string; }

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
    MatDialogModule,
    MatTabsModule,
    TranslateModule,
    PageHeaderComponent,
    DynamicProductListComponent,
    DynamicProductFormComponent,
    ProductDetailDialogComponent,
    ProductFieldDefinitionsComponent,
    ProductUiConfigComponent,
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
          <div style="display:flex; gap:12px; margin-top:16px; flex-wrap:wrap; align-items:center">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
              <mat-label>{{ 'common.search' | translate }}</mat-label>
              <input matInput (input)="onSearch($any($event.target).value)" />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="exportProducts('csv')">
              <mat-icon>download</mat-icon> CSV
            </button>
            <button mat-stroked-button type="button" (click)="exportProducts('xlsx')">
              <mat-icon>download</mat-icon> Excel
            </button>
            @if (canWrite()) {
            <button mat-stroked-button type="button" (click)="productFileInput.click()">
              <mat-icon>upload</mat-icon> {{ 'common.import' | translate }}
            </button>
            <input #productFileInput type="file" accept=".csv,.xlsx" hidden (change)="importProducts($event)" />
            }
          </div>

          <app-dynamic-product-list
            [columns]="listColumns()"
            [rows]="items()"
            [showActions]="true"
            [onView]="viewHandler"
            [onEdit]="canWrite() ? editHandler : undefined"
            [onDelete]="canWrite() ? deleteHandler : undefined"
            [onBarcodeLabel]="canPreviewLabel() ? barcodeLabelHandler : undefined"
            [emptyMessage]="'common.noRecords' | translate"
          />
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

        @if (canWrite()) {
        <mat-tab [label]="'products.fieldDefinitions' | translate">
          <app-product-field-definitions />
        </mat-tab>
        <mat-tab [label]="'products.uiConfig' | translate">
          <app-product-ui-config />
        </mat-tab>
        }
      </mat-tab-group>

      <app-product-detail-dialog
        [open]="detailOpen()"
        [productId]="detailProductId()"
        [canWrite]="canWrite()"
        (close)="closeDetail()"
        (edit)="editFromDetail($event)"
      />

      @if (editing()) {
      <div class="overlay" (click)="cancel()"></div>
      <div class="dialog">
        <h2>{{ dialogTitle() }}</h2>
        <form (ngSubmit)="save()" style="display:flex; flex-direction:column; gap:8px">
          @if (tab() === 0) {
            <app-dynamic-product-form
              #dynForm
              [formConfig]="formConfig()"
              [fieldDefinitions]="fieldDefinitions()"
              [initial]="editingProduct()"
            />
            @if (canPreviewLabel()) {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'barcode.labelTemplateAssign' | translate }}</mat-label>
              <mat-select [value]="productLabelTemplateId()" (selectionChange)="productLabelTemplateId.set($event.value)">
                <mat-option [value]="null">{{ 'barcode.labelTemplateDefault' | translate }}</mat-option>
                @for (t of labelTemplates(); track t.id) {
                <mat-option [value]="t.id">{{ t.name }}</mat-option>
                }
              </mat-select>
              <mat-hint>{{ 'barcode.labelTemplateHint' | translate }}</mat-hint>
            </mat-form-field>
            }
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
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
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
  private confirmDialog = inject(ConfirmDialogService);
  private dialog = inject(MatDialog);
  private configService = inject(ProductConfigService);
  protected auth = inject(AuthService);
  private barcode = inject(BarcodeService);

  private crud = new CrudService<ProductRow>(this.http, 'products', this.auth, 'products');
  private catCrud = new CrudService<Category>(this.http, 'products/categories', this.auth, 'products');

  tab = signal(0);
  items = signal<ProductRow[]>([]);
  categories = signal<Category[]>([]);
  listColumns = signal<ListColumnConfig[]>([]);
  formConfig = signal<import('../../shared/dynamic-fields/models').FormFieldConfig[]>([]);
  fieldDefinitions = signal<ProductFieldDefinition[]>([]);
  editing = signal(false);
  editingProduct = signal<ProductRow | null>(null);
  detailOpen = signal(false);
  detailProductId = signal<number | null>(null);
  labelTemplates = signal<LabelTemplate[]>([]);
  productLabelTemplateId = signal<number | null>(null);
  private search = '';
  @ViewChild('dynForm') dynForm?: DynamicProductFormComponent;

  viewHandler = (p: ProductRow) => this.openDetail(p);
  editHandler = (p: ProductRow) => this.openProductForm(p);
  deleteHandler = (p: ProductRow) => this.removeProduct(p);
  barcodeLabelHandler = (p: ProductRow) => this.openLabelPreview(p);

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
    this.loadConfig();
    this.reloadProducts();
    this.reloadCategories();
    if (this.canPreviewLabel()) {
      this.barcode.getTemplates().subscribe((list) => this.labelTemplates.set(list));
    }
  }

  loadConfig(): void {
    forkJoin({
      cols: this.configService.listColumnConfig(),
      form: this.configService.formConfig(),
      defs: this.configService.listFieldDefinitions(),
    }).subscribe({
      next: (r) => {
        this.listColumns.set(unwrapList(r.cols));
        this.formConfig.set(unwrapList(r.form));
        this.fieldDefinitions.set(unwrapList(r.defs));
      },
    });
  }

  canWrite = () => this.auth.hasPermission('products.write');
  hasBarcodeModule = () => this.auth.hasModule('barcode');
  canPreviewLabel = () => this.hasBarcodeModule() && this.auth.hasPermission('barcode.labels');

  openLabelPreview(p: ProductRow): void {
    this.dialog.open(ProductLabelPreviewDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: {
        product: {
          id: p.id,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode || '',
        },
      },
    });
  }

  dialogTitle(): string {
    if (this.tab() === 0) {
      return this.translate.instant(
        this.editingProduct()?.id ? 'products.edit' : 'products.new'
      );
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

  openDetail(p: ProductRow): void {
    this.detailProductId.set(p.id);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailProductId.set(null);
  }

  editFromDetail(p: ProductRow): void {
    this.closeDetail();
    this.openProductForm(p);
  }

  exportProducts(fmt: 'csv' | 'xlsx'): void {
    this.http
      .get(`${API_BASE}/products/export/`, {
        params: fmt === 'xlsx' ? { format: 'xlsx' } : {},
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => downloadBlob(blob, fmt === 'xlsx' ? 'products.xlsx' : 'products.csv'),
      });
  }

  importProducts(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    postImportFile(this.http, `${API_BASE}/products/import/`, file).subscribe({
      next: (res: any) => {
        this.reloadProducts();
        this.loadConfig();
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

  protected reloadProducts() {
    const params: Record<string, string> = { limit: '100' };
    if (this.search) params['search'] = this.search;
    params['include'] = 'fields';
    this.http.get<Page<ProductRow>>(`${API_BASE}/products/`, { params }).subscribe({
      next: (p) => this.items.set(p.results),
    });
  }

  protected reloadCategories() {
    this.catCrud
      .list({ limit: 200 })
      .subscribe((p: Page<Category>) => this.categories.set(p.results));
  }

  protected openProductForm(p?: ProductRow) {
    this.tab.set(0);
    this.activeForm = this.productForm;
    this.editingProduct.set(p ?? null);
    const tpl = p?.['label_template'] as number | null | undefined;
    this.productLabelTemplateId.set(tpl ?? null);
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
    if (!this.dynForm?.form.valid) {
      this.dynForm?.form.markAllAsTouched();
      return;
    }
    const data = this.dynForm.getPayload();
    if (this.canPreviewLabel()) {
      data['label_template'] = this.productLabelTemplateId();
    }
    const id = this.editingProduct()?.id;
    const op = id
      ? this.crud.update(id, data as Partial<ProductRow>)
      : this.crud.create(data as Partial<ProductRow>);
    op.subscribe({
      next: () => {
        this.editing.set(false);
        this.editingProduct.set(null);
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

  protected removeProduct(p: ProductRow) {
    this.confirmDialog.confirmDelete(p.sku).then((ok) => {
      if (!ok) return;
      this.crud.remove(p.id).subscribe({
        next: () => {
          this.reloadProducts();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    });
  }

  protected removeCategory(c: Category) {
    this.confirmDialog.confirmDelete(c.name).then((ok) => {
      if (!ok) return;
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
    });
  }
}
