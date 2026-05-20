import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { AppLanguage } from '../../core/language.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ALL_MODULE_SLUGS } from '../../shared/module-slugs';
import { passwordPolicyValidator } from '../../shared/password-validators';

interface TenantRow {
  id: number;
  customer_code: string;
  name: string;
  default_language: AppLanguage;
  is_active: boolean;
  enabled_modules: string[];
  module_labels: Record<string, string>;
  created_at?: string;
}

interface Page<T> {
  results: T[];
}

@Component({
  selector: 'app-platform-tenants',
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
    MatCheckboxModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <h1>{{ 'platform.tenants' | translate }}</h1>
        <button mat-flat-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon>
          {{ 'platform.newTenant' | translate }}
        </button>
      </header>

      <table class="bms-table">
        <thead>
          <tr>
            <th>{{ 'platform.customerCode' | translate }}</th>
            <th>{{ 'products.name' | translate }}</th>
            <th>{{ 'common.language' | translate }}</th>
            <th>{{ 'common.active' | translate }}</th>
            <th>{{ 'platform.modulesCount' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (t of items(); track t.id) {
          <tr>
            <td>{{ t.customer_code }}</td>
            <td>{{ t.name }}</td>
            <td>{{ t.default_language | uppercase }}</td>
            <td>{{ (t.is_active ? 'common.yes' : 'common.no') | translate }}</td>
            <td>{{ t.enabled_modules?.length || 0 }}</td>
            <td style="text-align:right">
              <button mat-icon-button (click)="openForm(t)" [attr.aria-label]="'common.edit' | translate">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button (click)="remove(t)" [attr.aria-label]="'common.delete' | translate">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </tr>
          }
          @if (items().length === 0) {
          <tr>
            <td colspan="6" style="text-align:center; padding:24px">{{ 'common.noRecords' | translate }}</td>
          </tr>
          }
        </tbody>
      </table>

      @if (editing()) {
      <div class="overlay" (click)="cancel()"></div>
      <div class="dialog dialog--wide">
        <h2>{{ (form.value.id ? 'platform.editTenant' : 'platform.newTenant') | translate }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()" class="dialog-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'platform.customerCode' | translate }}</mat-label>
            <input matInput formControlName="customer_code" [readonly]="!!form.value.id" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.name' | translate }}</mat-label>
            <input matInput formControlName="name" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.language' | translate }}</mat-label>
            <mat-select formControlName="default_language">
              <mat-option value="tr">{{ 'common.turkish' | translate }}</mat-option>
              <mat-option value="en">{{ 'common.english' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-slide-toggle formControlName="is_active">{{ 'common.active' | translate }}</mat-slide-toggle>

          <h3 class="dialog__section-title">{{ 'platform.modulesAccess' | translate }}</h3>
          <div class="module-grid">
            @for (slug of moduleSlugs; track slug) {
            <mat-checkbox
              [checked]="isModuleEnabled(slug)"
              (change)="toggleModule(slug, $event.checked)"
            >
              {{ ('modules.' + slug) | translate }}
            </mat-checkbox>
            }
          </div>

          <h3 class="dialog__section-title">{{ 'platform.moduleLabels' | translate }}</h3>
          <p class="hint">{{ 'platform.moduleLabelsHint' | translate }}</p>
          @for (slug of moduleSlugs; track slug) {
          @if (isModuleEnabled(slug)) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ ('modules.' + slug) | translate }}</mat-label>
            <input matInput [formControl]="labelControl(slug)" />
          </mat-form-field>
          }
          }

          @if (!form.value.id) {
          <h3 class="dialog__section-title">{{ 'platform.initialAdmin' | translate }}</h3>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'auth.email' | translate }}</mat-label>
            <input matInput type="email" formControlName="initial_admin_email" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'auth.password' | translate }}</mat-label>
            <input matInput type="password" formControlName="initial_admin_password" required />
          </mat-form-field>
          }

          <div class="dialog__footer-inline">
            <button mat-button type="button" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
              {{ 'common.save' | translate }}
            </button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .page-header h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 500;
      }
      .dialog--wide {
        min-width: min(560px, 96vw);
        max-width: 640px;
      }
      .dialog-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .module-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 16px;
        margin-bottom: 12px;
      }
      .hint {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 8px;
      }
      .dialog__footer-inline {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
      }
    `,
  ],
})
export class PlatformTenantsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  readonly moduleSlugs = ALL_MODULE_SLUGS;
  items = signal<TenantRow[]>([]);
  editing = signal(false);
  private enabledModules = signal<string[]>([]);
  private labelControls = new Map<string, FormControl<string>>();

  form = this.fb.group({
    id: this.fb.control<number | null>(null),
    customer_code: ['', Validators.required],
    name: ['', Validators.required],
    default_language: this.fb.control<AppLanguage>('tr', Validators.required),
    is_active: [true],
    initial_admin_email: [''],
    initial_admin_password: [''],
  });

  ngOnInit(): void {
    this.reload();
  }

  labelControl(slug: string): FormControl<string> {
    if (!this.labelControls.has(slug)) {
      this.labelControls.set(slug, this.fb.nonNullable.control(''));
    }
    return this.labelControls.get(slug)!;
  }

  isModuleEnabled(slug: string): boolean {
    return this.enabledModules().includes(slug);
  }

  toggleModule(slug: string, checked: boolean): void {
    const current = [...this.enabledModules()];
    if (checked && !current.includes(slug)) {
      this.enabledModules.set([...current, slug]);
    } else if (!checked) {
      this.enabledModules.set(current.filter((s) => s !== slug));
    }
  }

  reload(): void {
    const params = new HttpParams().set('limit', '200');
    this.http
      .get<Page<TenantRow>>(`${API_BASE}/platform/tenants/`, { params })
      .subscribe((p) => this.items.set(p.results));
  }

  openForm(t?: TenantRow): void {
    this.labelControls.clear();
    if (t) {
      this.form.reset({
        id: t.id,
        customer_code: t.customer_code,
        name: t.name,
        default_language: t.default_language,
        is_active: t.is_active,
        initial_admin_email: '',
        initial_admin_password: '',
      });
      this.form.get('initial_admin_email')?.clearValidators();
      this.form.get('initial_admin_password')?.clearValidators();
      this.enabledModules.set([...(t.enabled_modules || [])]);
      for (const slug of ALL_MODULE_SLUGS) {
        this.labelControl(slug).setValue(t.module_labels?.[slug] || '');
      }
    } else {
      this.form.reset({
        id: null,
        customer_code: '',
        name: '',
        default_language: 'tr',
        is_active: true,
        initial_admin_email: '',
        initial_admin_password: '',
      });
      this.form.get('initial_admin_email')?.setValidators([Validators.required, Validators.email]);
      this.form
        .get('initial_admin_password')
        ?.setValidators([Validators.required, passwordPolicyValidator()]);
      this.enabledModules.set([...ALL_MODULE_SLUGS]);
      for (const slug of ALL_MODULE_SLUGS) {
        this.labelControl(slug).setValue('');
      }
    }
    this.form.updateValueAndValidity();
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
  }

  private buildModuleLabels(): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const slug of this.enabledModules()) {
      const v = this.labelControl(slug).value?.trim();
      if (v) labels[slug] = v;
    }
    return labels;
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      customer_code: v.customer_code,
      name: v.name,
      default_language: v.default_language,
      is_active: v.is_active,
      enabled_modules: this.enabledModules(),
      module_labels: this.buildModuleLabels(),
    };
    if (!v.id) {
      payload['initial_admin_email'] = v.initial_admin_email;
      payload['initial_admin_password'] = v.initial_admin_password;
    }
    const req = v.id
      ? this.http.patch<TenantRow>(`${API_BASE}/platform/tenants/${v.id}/`, payload)
      : this.http.post<TenantRow>(`${API_BASE}/platform/tenants/`, payload);
    req.subscribe({
      next: () => {
        this.editing.set(false);
        this.reload();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(
          e?.error?.detail || this.translate.instant('common.error'),
          'OK',
          { duration: 2500 }
        ),
    });
  }

  remove(t: TenantRow): void {
    if (!confirm(`${this.translate.instant('common.confirmDelete')} (${t.customer_code})`)) return;
    this.http.delete(`${API_BASE}/platform/tenants/${t.id}/`).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(
          e?.error?.detail || this.translate.instant('common.error'),
          'OK',
          { duration: 2500 }
        ),
    });
  }
}
