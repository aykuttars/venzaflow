import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { ModuleCatalogService } from '../../core/module-catalog.service';
import { PasswordFieldsComponent } from '../../shared/password-fields.component';
import {
  passwordMatchValidator,
  passwordPolicyValidator,
} from '../../shared/password-validators';

interface ModuleSubscriptionRow {
  module_slug: string;
  is_active: boolean;
  is_extra: boolean;
  is_billable?: boolean;
  price_per_user_monthly?: string | null;
}

interface TenantRow {
  id: number;
  customer_code: string;
  name: string;
  default_language: AppLanguage;
  is_active: boolean;
  max_users: number;
  active_user_count: number;
  enabled_modules: string[];
  subscribed_modules?: string[];
  module_labels: Record<string, string>;
  module_subscriptions?: ModuleSubscriptionRow[];
  non_billable_modules?: string[];
  module_parents?: Record<string, string>;
  default_non_billable_modules?: string[];
  billing_period?: string;
  payment_currency?: string;
  monthly_discount_percent?: string | null;
  yearly_discount_percent?: string | null;
  created_at?: string;
}

interface CurrencyOption {
  code: string;
  name: string;
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
    PasswordFieldsComponent,
    RouterLink,
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
            <th>{{ 'platform.userUsage' | translate }}</th>
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
            <td>{{ t.active_user_count }}/{{ t.max_users }}</td>
            <td>{{ t.default_language | uppercase }}</td>
            <td>{{ (t.is_active ? 'common.yes' : 'common.no') | translate }}</td>
            <td>{{ t.enabled_modules.length }}</td>
            <td style="text-align:right">
              <a mat-icon-button [routerLink]="['/admin/tenants', t.id, 'invoices']" [attr.aria-label]="'platform.invoices' | translate">
                <mat-icon>receipt_long</mat-icon>
              </a>
              @if (t.enabled_modules.includes('signing')) {
              <a mat-icon-button [routerLink]="['/admin/tenants', t.id, 'integration']" [attr.aria-label]="'signingIntegration.title' | translate">
                <mat-icon>hub</mat-icon>
              </a>
              }
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
            <td colspan="7" style="text-align:center; padding:24px">{{ 'common.noRecords' | translate }}</td>
          </tr>
          }
        </tbody>
      </table>

      @if (editing()) {
      <div class="overlay" (click)="cancel()"></div>
      <div class="dialog dialog--tenant">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="dialog__header">
            <div class="dialog__header-main">
              <h2>{{ (form.value.id ? 'platform.editTenant' : 'platform.newTenant') | translate }}</h2>
              @if (editingTenant()) {
              <span class="tenant-code-badge">{{ editingTenant()!.customer_code }}</span>
              }
            </div>
            <mat-slide-toggle formControlName="is_active" class="dialog__active-toggle">
              {{ 'common.active' | translate }}
            </mat-slide-toggle>
          </div>

          <div class="dialog__body">
            <section class="dialog__section">
              <h3 class="dialog__section-title">{{ 'platform.tenantInfo' | translate }}</h3>
              <div class="dialog__row dialog__row--3">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'platform.customerCode' | translate }}</mat-label>
                  <input matInput formControlName="customer_code" [readonly]="!!form.value.id" required />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'products.name' | translate }}</mat-label>
                  <input matInput formControlName="name" required />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'platform.maxUsers' | translate }}</mat-label>
                  <input matInput type="number" min="1" formControlName="max_users" required />
                  @if (editingTenant()) {
                  <mat-hint>{{ 'platform.userUsage' | translate }}: {{ editingTenant()!.active_user_count }}/{{ form.value.max_users }}</mat-hint>
                  }
                </mat-form-field>
              </div>
              <div class="dialog__row">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'common.language' | translate }}</mat-label>
                  <mat-select formControlName="default_language">
                    <mat-option value="tr">{{ 'common.turkish' | translate }}</mat-option>
                    <mat-option value="en">{{ 'common.english' | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </section>

            <section class="dialog__section">
              <h3 class="dialog__section-title">{{ 'platform.billingPeriod' | translate }}</h3>
              <div class="dialog__row dialog__row--4">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'platform.billingPeriod' | translate }}</mat-label>
                  <mat-select formControlName="billing_period">
                    <mat-option value="monthly">{{ 'platform.billingMonthly' | translate }}</mat-option>
                    <mat-option value="yearly">{{ 'platform.billingYearly' | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'platform.paymentCurrency' | translate }}</mat-label>
                  <mat-select formControlName="payment_currency">
                    @for (c of currencies(); track c.code) {
                    <mat-option [value]="c.code">{{ c.code }} — {{ c.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'platform.monthlyDiscount' | translate }}</mat-label>
                  <input matInput type="number" min="0" max="100" formControlName="monthly_discount_percent" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'platform.yearlyDiscount' | translate }}</mat-label>
                  <input matInput type="number" min="0" max="100" formControlName="yearly_discount_percent" />
                </mat-form-field>
              </div>
            </section>

            <section class="dialog__section">
              <h3 class="dialog__section-title">{{ 'platform.modulesAccess' | translate }}</h3>
              <p class="hint">{{ 'platform.nonBillableModulesHint' | translate }}</p>
              <div class="core-modules">
                @for (slug of nonBillableModuleSlugs; track slug) {
                <span class="core-chip">{{ ('modules.' + slug) | translate }}</span>
                }
              </div>
              <div class="module-table">
                <div class="module-table__head">
                  <span>{{ 'platform.moduleName' | translate }}</span>
                  <span>{{ 'platform.moduleEnabled' | translate }}</span>
                  <span>{{ 'platform.moduleBillable' | translate }}</span>
                  <span>{{ 'platform.extraModule' | translate }}</span>
                  <span>{{ 'platform.moduleParent' | translate }}</span>
                  <span>{{ 'platform.modulePriceOverride' | translate }}</span>
                </div>
                @for (slug of moduleSlugs; track slug) {
                <div class="module-table__row" [class.module-table__row--disabled]="!isModuleEnabled(slug)">
                  <span class="module-table__name">{{ ('modules.' + slug) | translate }}</span>
                  <mat-checkbox
                    [checked]="isModuleEnabled(slug)"
                    (change)="toggleModule(slug, $event.checked)"
                  />
                  @if (isModuleEnabled(slug)) {
                  <mat-checkbox
                    [checked]="isModuleBillable(slug)"
                    (change)="toggleBillable(slug, $event.checked)"
                  />
                  <mat-checkbox
                    [checked]="isExtraModule(slug)"
                    (change)="toggleExtra(slug, $event.checked)"
                  />
                  <mat-form-field appearance="outline" class="module-parent-field" subscriptSizing="dynamic">
                    <mat-select
                      [value]="moduleParent(slug)"
                      (selectionChange)="setModuleParent(slug, $event.value)"
                    >
                      <mat-option value="">{{ 'platform.moduleParentNone' | translate }}</mat-option>
                      @for (p of parentModuleOptions(slug); track p) {
                      <mat-option [value]="p">{{ ('modules.' + p) | translate }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  @if (isModuleBillable(slug)) {
                  <mat-form-field appearance="outline" class="module-price-field" subscriptSizing="dynamic">
                    <input
                      matInput
                      type="number"
                      min="0"
                      step="0.01"
                      [formControl]="modulePriceControl(slug)"
                      [placeholder]="globalPricePlaceholder(slug)"
                    />
                  </mat-form-field>
                  } @else {
                  <span class="module-table__na">—</span>
                  }
                  } @else {
                  <span class="module-table__na">—</span>
                  <span class="module-table__na">—</span>
                  <span class="module-table__na">—</span>
                  <span class="module-table__na">—</span>
                  }
                </div>
                }
              </div>
            </section>

            <section class="dialog__section">
              <h3 class="dialog__section-title">{{ 'platform.moduleLabels' | translate }}</h3>
              <p class="hint">{{ 'platform.moduleLabelsHint' | translate }}</p>
              <div class="dialog__row">
                @for (slug of labelModuleSlugs(); track slug) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ ('modules.' + slug) | translate }}</mat-label>
                  <input matInput [formControl]="labelControl(slug)" />
                </mat-form-field>
                }
              </div>
            </section>

            @if (!form.value.id) {
            <section class="dialog__section">
              <h3 class="dialog__section-title">{{ 'platform.initialAdmin' | translate }}</h3>
              <div class="dialog__row">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'auth.email' | translate }}</mat-label>
                  <input matInput type="email" formControlName="initial_admin_email" required />
                </mat-form-field>
              </div>
              <app-password-fields [group]="initialAdminPasswordGroup" />
            </section>
            }
          </div>

          <div class="dialog__footer">
            <button mat-button type="button" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="!canSave()">
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
      .dialog--tenant {
        min-width: min(960px, 96vw);
        max-width: 1040px;
      }
      .tenant-code-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: 16px;
        background: rgba(63, 81, 181, 0.1);
        font-size: 13px;
        font-weight: 500;
        color: rgba(63, 81, 181, 0.95);
      }
      .dialog__row--3 {
        grid-template-columns: repeat(3, 1fr);
      }
      .dialog__row--4 {
        grid-template-columns: repeat(4, 1fr);
      }
      @media (max-width: 900px) {
        .dialog__row--3,
        .dialog__row--4 {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 520px) {
        .dialog__row--3,
        .dialog__row--4 {
          grid-template-columns: 1fr;
        }
      }
      .module-table {
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        overflow: hidden;
      }
      .module-table__head,
      .module-table__row {
        display: grid;
        grid-template-columns: minmax(120px, 1.5fr) 72px 72px 72px minmax(140px, 1fr) minmax(140px, 1fr);
        align-items: center;
        gap: 8px 12px;
        padding: 10px 16px;
      }
      .module-table__head {
        background: rgba(0, 0, 0, 0.04);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: rgba(0, 0, 0, 0.6);
      }
      .module-table__head span:not(:first-child),
      .module-table__row > mat-checkbox,
      .module-table__row > .module-table__na {
        justify-self: center;
        text-align: center;
      }
      .module-table__row {
        border-top: 1px solid rgba(0, 0, 0, 0.06);
      }
      .module-table__row--disabled {
        opacity: 0.55;
      }
      .module-table__name {
        font-size: 14px;
      }
      .module-table__na {
        color: rgba(0, 0, 0, 0.35);
        font-size: 14px;
      }
      .module-price-field {
        width: 100%;
        margin: 0;
      }
      .module-parent-field {
        width: 100%;
        margin: 0;
      }
      .hint {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 12px;
      }
      .core-modules {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }
      .core-chip {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 16px;
        background: rgba(63, 81, 181, 0.08);
        font-size: 13px;
      }
    `,
  ],
})
export class PlatformTenantsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  private moduleCatalog = inject(ModuleCatalogService);

  get nonBillableModuleSlugs(): string[] {
    return this.moduleCatalog.nonBillableDefaultSlugs();
  }
  get moduleSlugs(): string[] {
    return this.moduleCatalog.billableSlugs();
  }
  items = signal<TenantRow[]>([]);
  currencies = signal<CurrencyOption[]>([]);
  editing = signal(false);
  editingTenant = signal<TenantRow | null>(null);
  private enabledModules = signal<string[]>([]);
  private extraModules = signal<string[]>([]);
  private nonBillableModules = signal<string[]>([]);
  private moduleParents = signal<Record<string, string>>({});
  private labelControls = new Map<string, FormControl<string>>();
  private modulePriceControls = new Map<string, FormControl<string>>();

  form = this.fb.group({
    id: this.fb.control<number | null>(null),
    customer_code: ['', Validators.required],
    name: ['', Validators.required],
    max_users: [5, [Validators.required, Validators.min(1)]],
    default_language: this.fb.control<AppLanguage>('tr', Validators.required),
    is_active: [true],
    billing_period: ['monthly' as 'monthly' | 'yearly'],
    payment_currency: ['TRY'],
    monthly_discount_percent: this.fb.control<string | null>(null),
    yearly_discount_percent: this.fb.control<string | null>(null),
    initial_admin_email: [''],
  });

  initialAdminPasswordGroup = this.fb.group(
    { password: [''], password_confirm: [''] },
    { validators: passwordMatchValidator('password', 'password_confirm') }
  );

  ngOnInit(): void {
    this.reload();
    this.moduleCatalog.load().subscribe();
    this.http
      .get<Page<CurrencyOption>>(`${API_BASE}/platform/billing/currencies/?limit=20`)
      .subscribe((p) => this.currencies.set(p.results));
  }

  modulePriceControl(slug: string): FormControl<string> {
    if (!this.modulePriceControls.has(slug)) {
      this.modulePriceControls.set(slug, this.fb.nonNullable.control(''));
    }
    return this.modulePriceControls.get(slug)!;
  }

  globalPricePlaceholder(slug: string): string {
    const g = this.moduleCatalog.defaultPrice(slug);
    return g ? `${g} TRY` : '';
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

  isExtraModule(slug: string): boolean {
    return this.extraModules().includes(slug);
  }

  isModuleBillable(slug: string): boolean {
    return this.isModuleEnabled(slug) && !this.nonBillableModules().includes(slug);
  }

  toggleModule(slug: string, checked: boolean): void {
    if (this.moduleCatalog.isNonBillableDefault(slug)) {
      return;
    }
    if (checked && slug === 'barcode' && !this.isModuleEnabled('inventory')) {
      this.snack.open(
        this.translate.instant('platform.barcodeRequiresInventory'),
        undefined,
        { duration: 4000 }
      );
      return;
    }
    const current = [...this.enabledModules()];
    const extra = [...this.extraModules()];
    const nonBillable = [...this.nonBillableModules()];
    const parents = { ...this.moduleParents() };
    if (checked && !current.includes(slug)) {
      this.enabledModules.set([...current, slug]);
      if (slug === 'barcode' && !parents['barcode']) {
        parents['barcode'] = 'inventory';
        this.moduleParents.set(parents);
      }
    } else if (!checked) {
      this.enabledModules.set(current.filter((s) => s !== slug));
      this.extraModules.set(extra.filter((s) => s !== slug));
      this.nonBillableModules.set(nonBillable.filter((s) => s !== slug));
      delete parents[slug];
      for (const [child, parent] of Object.entries(parents)) {
        if (parent === slug) {
          delete parents[child];
          if (child === 'barcode' || slug === 'inventory') {
            this.enabledModules.update((m) => m.filter((s) => s !== 'barcode'));
          }
        }
      }
      if (slug === 'inventory') {
        this.enabledModules.update((m) => m.filter((s) => s !== 'barcode'));
        delete parents['barcode'];
      }
      this.moduleParents.set(parents);
    }
  }

  canToggleModule(slug: string): boolean {
    if (slug === 'barcode' && !this.isModuleEnabled('inventory')) {
      return false;
    }
    return !this.moduleCatalog.isNonBillableDefault(slug);
  }

  moduleParent(slug: string): string {
    return this.moduleParents()[slug] ?? '';
  }

  setModuleParent(slug: string, parent: string): void {
    if (!this.isModuleEnabled(slug)) return;
    const parents = { ...this.moduleParents() };
    if (!parent) {
      delete parents[slug];
    } else {
      parents[slug] = parent;
    }
    this.moduleParents.set(parents);
  }

  parentModuleOptions(slug: string): string[] {
    return this.enabledModules().filter(
      (m) => m !== slug && !this.moduleCatalog.isNonBillableDefault(m)
    );
  }

  private buildModuleParents(): Record<string, string> {
    const parents: Record<string, string> = {};
    for (const [child, parent] of Object.entries(this.moduleParents())) {
      if (this.isModuleEnabled(child) && this.isModuleEnabled(parent)) {
        parents[child] = parent;
      }
    }
    return parents;
  }

  toggleBillable(slug: string, checked: boolean): void {
    if (!this.isModuleEnabled(slug)) return;
    const nonBillable = [...this.nonBillableModules()];
    if (checked) {
      this.nonBillableModules.set(nonBillable.filter((s) => s !== slug));
    } else if (!nonBillable.includes(slug)) {
      this.nonBillableModules.set([...nonBillable, slug]);
    }
  }

  toggleExtra(slug: string, checked: boolean): void {
    if (!this.isModuleEnabled(slug)) return;
    const extra = [...this.extraModules()];
    if (checked && !extra.includes(slug)) {
      this.extraModules.set([...extra, slug]);
    } else if (!checked) {
      this.extraModules.set(extra.filter((s) => s !== slug));
    }
  }

  labelModuleSlugs(): string[] {
    return this.moduleCatalog.mergeTenantModules(this.enabledModules());
  }

  reload(): void {
    const params = new HttpParams().set('limit', '200');
    this.http
      .get<Page<TenantRow>>(`${API_BASE}/platform/tenants/`, { params })
      .subscribe((p) => this.items.set(p.results));
  }

  canSave(): boolean {
    if (this.form.invalid) return false;
    if (!this.form.value.id && this.initialAdminPasswordGroup.invalid) return false;
    return true;
  }

  private setInitialAdminPasswordValidators(required: boolean): void {
    const pw = this.initialAdminPasswordGroup.get('password')!;
    const confirm = this.initialAdminPasswordGroup.get('password_confirm')!;
    if (required) {
      pw.setValidators([Validators.required, passwordPolicyValidator()]);
      confirm.setValidators([Validators.required]);
    } else {
      pw.clearValidators();
      confirm.clearValidators();
    }
    pw.updateValueAndValidity();
    confirm.updateValueAndValidity();
    this.initialAdminPasswordGroup.updateValueAndValidity();
  }

  openForm(t?: TenantRow): void {
    this.labelControls.clear();
    this.modulePriceControls.clear();
    this.editingTenant.set(t ?? null);
    this.initialAdminPasswordGroup.reset({ password: '', password_confirm: '' });
    if (t) {
      this.form.reset({
        id: t.id,
        customer_code: t.customer_code,
        name: t.name,
        max_users: t.max_users,
        default_language: t.default_language,
        is_active: t.is_active,
        billing_period: (t.billing_period as 'monthly' | 'yearly') || 'monthly',
        payment_currency: t.payment_currency || 'TRY',
        monthly_discount_percent: t.monthly_discount_percent ?? null,
        yearly_discount_percent: t.yearly_discount_percent ?? null,
        initial_admin_email: '',
      });
      this.form.get('initial_admin_email')?.clearValidators();
      this.setInitialAdminPasswordValidators(false);
      const subs = (t.subscribed_modules ?? t.enabled_modules ?? []).filter(
        (s) => !this.moduleCatalog.isNonBillableDefault(s)
      );
      this.enabledModules.set([...subs]);
      const nonBillableFromApi =
        t.non_billable_modules ??
        (t.module_subscriptions ?? [])
          .filter((s) => s.is_active && s.is_billable === false)
          .map((s) => s.module_slug)
          .filter((s) => !this.moduleCatalog.isNonBillableDefault(s));
      this.nonBillableModules.set([...nonBillableFromApi]);
      const extra = (t.module_subscriptions ?? [])
        .filter((s) => s.is_extra)
        .map((s) => s.module_slug);
      this.extraModules.set(extra);
      this.moduleParents.set({ ...(t.module_parents ?? {}) });
      const priceBySlug = new Map(
        (t.module_subscriptions ?? []).map((s) => [s.module_slug, s.price_per_user_monthly])
      );
      for (const slug of this.moduleCatalog.allSlugs()) {
        this.labelControl(slug).setValue(t.module_labels?.[slug] || '');
        const override = priceBySlug.get(slug);
        this.modulePriceControl(slug).setValue(
          override != null && override !== '' ? String(override) : ''
        );
      }
    } else {
      this.form.reset({
        id: null,
        customer_code: '',
        name: '',
        max_users: 5,
        default_language: 'tr',
        is_active: true,
        billing_period: 'monthly',
        payment_currency: 'TRY',
        monthly_discount_percent: null,
        yearly_discount_percent: null,
        initial_admin_email: '',
      });
      this.form.get('initial_admin_email')?.setValidators([Validators.required, Validators.email]);
      this.setInitialAdminPasswordValidators(true);
      this.enabledModules.set([...this.moduleCatalog.billableSlugs()]);
      this.extraModules.set([]);
      this.nonBillableModules.set([]);
      this.moduleParents.set({});
      for (const slug of this.moduleCatalog.allSlugs()) {
        this.labelControl(slug).setValue('');
        this.modulePriceControl(slug).setValue('');
      }
    }
    this.form.updateValueAndValidity();
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
    this.editingTenant.set(null);
  }

  private buildModulePrices(): Record<string, string | null> {
    const prices: Record<string, string | null> = {};
    for (const slug of this.enabledModules()) {
      if (!this.isModuleBillable(slug)) continue;
      const v = String(this.modulePriceControl(slug).value ?? '').trim();
      prices[slug] = v || null;
    }
    return prices;
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
    if (!this.canSave()) return;
    const v = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      customer_code: v.customer_code,
      name: v.name,
      max_users: v.max_users,
      default_language: v.default_language,
      is_active: v.is_active,
      subscribed_modules: this.enabledModules(),
      extra_modules: this.extraModules(),
      non_billable_modules: this.nonBillableModules(),
      module_parents: this.buildModuleParents(),
      module_labels: this.buildModuleLabels(),
      billing_period: v.billing_period,
      payment_currency: v.payment_currency,
      monthly_discount_percent: v.monthly_discount_percent || null,
      yearly_discount_percent: v.yearly_discount_percent || null,
      module_prices: this.buildModulePrices(),
    };
    if (!v.id) {
      const pw = this.initialAdminPasswordGroup.getRawValue();
      payload['initial_admin_email'] = v.initial_admin_email;
      payload['initial_admin_password'] = pw.password;
    }
    const req = v.id
      ? this.http.patch<TenantRow>(`${API_BASE}/platform/tenants/${v.id}/`, payload)
      : this.http.post<TenantRow>(`${API_BASE}/platform/tenants/`, payload);
    req.subscribe({
      next: () => {
        this.editing.set(false);
        this.editingTenant.set(null);
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
    this.confirmDialog.confirmDelete(t.customer_code).then((ok) => {
      if (!ok) return;
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
    });
  }
}
