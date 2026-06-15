import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { API_BASE } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ProcedureCatalog } from '../../core/oral.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService } from '../../shared/crud.service';

const CATEGORIES = ['diagnosis', 'planning', 'treatment'] as const;

@Component({
  selector: 'app-oral-procedures',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div style="margin-top:16px">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
          <mat-label>{{ 'common.search' | translate }}</mat-label>
          <input matInput [formControl]="searchControl" />
        </mat-form-field>
        @if (canWrite()) {
        <button mat-stroked-button type="button" (click)="reseed()">
          <mat-icon>cloud_download</mat-icon> {{ 'oral.reseedDefaults' | translate }}
        </button>
        <button mat-flat-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
        </button>
        }
      </div>

      <table class="bms-table" style="margin-top:12px">
        <thead>
          <tr>
            <th>{{ 'oral.procCode' | translate }}</th>
            <th>{{ 'products.name' | translate }}</th>
            <th>{{ 'oral.procCategory' | translate }}</th>
            <th>{{ 'oral.defaultPrice' | translate }}</th>
            <th>{{ 'oral.frequent' | translate }}</th>
            <th>{{ 'common.active' | translate }}</th>
            @if (canWrite()) { <th></th> }
          </tr>
        </thead>
        <tbody>
          @for (p of items(); track p.id) {
          <tr>
            <td>{{ p.code }}</td>
            <td>{{ p.name }}</td>
            <td>{{ categoryLabel(p.category) | translate }}</td>
            <td>{{ formatPrice(p.default_price) }} ₺</td>
            <td>{{ p.is_frequent ? '✓' : '—' }}</td>
            <td>{{ p.is_active ? ('common.active' | translate) : ('common.inactive' | translate) }}</td>
            @if (canWrite()) {
            <td style="text-align:right">
              <button mat-icon-button (click)="openForm(p)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button (click)="remove(p)"><mat-icon>delete</mat-icon></button>
            </td>
            }
          </tr>
          } @empty {
          <tr><td [attr.colspan]="canWrite() ? 7 : 6">{{ 'common.noRecords' | translate }}</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (editing()) {
    <div class="overlay" (click)="editing.set(false)"></div>
    <div class="dialog">
      <h2>{{ form.value.id ? ('common.edit' | translate) : ('common.new' | translate) }}</h2>
      <form [formGroup]="form" (ngSubmit)="save()" style="display:flex;flex-direction:column;gap:8px">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'oral.procCode' | translate }}</mat-label>
          <input matInput formControlName="code" [readonly]="!!form.value.id" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'products.name' | translate }}</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'oral.procCategory' | translate }}</mat-label>
          <mat-select formControlName="category">
            @for (c of categories; track c) {
            <mat-option [value]="c">{{ categoryLabel(c) | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'oral.defaultPrice' | translate }}</mat-label>
          <input matInput type="number" step="0.01" formControlName="default_price" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'oral.toothCondition' | translate }}</mat-label>
          <input matInput formControlName="default_tooth_condition" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'oral.sortOrder' | translate }}</mat-label>
          <input matInput type="number" formControlName="sort_order" />
        </mat-form-field>
        <mat-checkbox formControlName="is_frequent">{{ 'oral.frequent' | translate }}</mat-checkbox>
        <mat-checkbox formControlName="is_active">{{ 'common.active' | translate }}</mat-checkbox>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button mat-button type="button" (click)="editing.set(false)">{{ 'common.cancel' | translate }}</button>
          <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
        </div>
      </form>
    </div>
    }
  `,
  styles: [CRUD_DIALOG_STYLES],
})
export class OralProceduresComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  protected auth = inject(AuthService);

  private crud = new CrudService<ProcedureCatalog & { is_active?: boolean; sort_order?: number }>(
    this.http,
    'oral/procedures',
    this.auth,
    'oral'
  );

  items = signal<(ProcedureCatalog & { is_active?: boolean; sort_order?: number })[]>([]);
  editing = signal(false);
  categories = CATEGORIES;
  searchControl = this.fb.control('', { nonNullable: true });

  form = this.fb.group({
    id: this.fb.control<number | null>(null),
    code: ['', Validators.required],
    name: ['', Validators.required],
    category: ['treatment' as (typeof CATEGORIES)[number], Validators.required],
    default_price: ['0', Validators.required],
    default_tooth_condition: [''],
    sort_order: [0],
    is_frequent: [false],
    is_active: [true],
  });

  ngOnInit(): void {
    this.reload();
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((q) => {
      this.reload(q.trim());
    });
  }

  canWrite = () => this.auth.hasPermission('oral.write');

  reload(search = ''): void {
    const params: { limit: number; search?: string; extra?: Record<string, string> } = {
      limit: 500,
      extra: { include_inactive: '1' },
    };
    if (search.length >= 3) params.search = search;
    this.crud.list(params).subscribe((p) => this.items.set(p.results));
  }

  openForm(p?: ProcedureCatalog & { is_active?: boolean; sort_order?: number }): void {
    this.form.reset(
      p
        ? {
            id: p.id,
            code: p.code,
            name: p.name,
            category: p.category,
            default_price: p.default_price,
            default_tooth_condition: p.default_tooth_condition || '',
            sort_order: p.sort_order ?? 0,
            is_frequent: p.is_frequent,
            is_active: p.is_active ?? true,
          }
        : {
            id: null,
            code: '',
            name: '',
            category: 'treatment',
            default_price: '0',
            default_tooth_condition: '',
            sort_order: 0,
            is_frequent: false,
            is_active: true,
          }
    );
    this.editing.set(true);
  }

  save(): void {
    const v = this.form.getRawValue();
    const payload: Partial<ProcedureCatalog & { is_active?: boolean; sort_order?: number }> = {
      code: v.code!,
      name: v.name!,
      category: v.category!,
      default_price: v.default_price!,
      default_tooth_condition: v.default_tooth_condition || '',
      sort_order: v.sort_order ?? 0,
      is_frequent: v.is_frequent ?? false,
      is_active: v.is_active ?? true,
    };
    const op = v.id ? this.crud.update(v.id, payload) : this.crud.create(payload);
    op.subscribe({
      next: () => {
        this.editing.set(false);
        this.reload(this.searchControl.value.trim());
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 2000 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 3000,
        }),
    });
  }

  remove(p: ProcedureCatalog): void {
    this.confirmDialog.confirmDelete(p.name).then((ok) => {
      if (!ok) return;
      this.crud.remove(p.id).subscribe({
        next: () => {
          this.reload(this.searchControl.value.trim());
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 2000 });
        },
      });
    });
  }

  reseed(): void {
    this.http.post<{ created: number; updated: number }>(`${API_BASE}/oral/procedures/reseed/`, {}).subscribe({
      next: (res) => {
        this.reload();
        this.snack.open(
          `${this.translate.instant('oral.reseedDone')}: +${res.created}`,
          'OK',
          { duration: 3000 }
        );
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 3000,
        }),
    });
  }

  formatPrice(v: string | number): string {
    return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  categoryLabel(cat: string): string {
    if (cat === 'diagnosis') return 'oral.categoryDiagnosis';
    if (cat === 'planning') return 'oral.categoryPlanning';
    return 'oral.categoryTreatment';
  }
}
