import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { ALL_MODULE_SLUGS } from '../../shared/module-slugs';

interface BillingSettings {
  default_monthly_discount_percent: string;
  yearly_discount_percent: string;
  invoice_prefix: string;
  default_payment_terms_days: number;
  company_name: string;
}

interface TaxType {
  id: number;
  code: string;
  name: string;
}

interface TaxRate {
  id: number;
  tax_type: number;
  rate_percent: string;
  valid_from: string;
  is_active: boolean;
}

interface ModulePrice {
  id: number;
  module_slug: string;
  price_per_user_monthly: string;
  is_active: boolean;
}

interface ExchangeRate {
  currency_code: string;
  rate_to_try: string;
  source: string;
  fetched_at: string;
}

interface Page<T> {
  results: T[];
}

@Component({
  selector: 'app-platform-billing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <h1>{{ 'platform.billing.title' | translate }}</h1>
      </header>

      <mat-tab-group>
        <mat-tab [label]="'platform.billing.settings' | translate">
          <form [formGroup]="settingsForm" (ngSubmit)="saveSettings()" class="tab-form">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'platform.billing.monthlyDiscount' | translate }}</mat-label>
              <input matInput type="number" min="0" max="100" formControlName="default_monthly_discount_percent" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'platform.billing.yearlyDiscount' | translate }}</mat-label>
              <input matInput type="number" min="0" max="100" formControlName="yearly_discount_percent" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'platform.billing.invoicePrefix' | translate }}</mat-label>
              <input matInput formControlName="invoice_prefix" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'platform.billing.companyName' | translate }}</mat-label>
              <input matInput formControlName="company_name" />
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
          </form>
        </mat-tab>

        <mat-tab [label]="'platform.billing.modulePrices' | translate">
          <table class="bms-table">
            <thead>
              <tr>
                <th>{{ 'platform.billing.module' | translate }}</th>
                <th>{{ 'platform.billing.pricePerUserMonth' | translate }} (TRY)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of modulePrices(); track p.id) {
              <tr>
                <td>{{ p.module_slug }}</td>
                <td>
                  <input
                    type="number"
                    class="inline-input"
                    [value]="p.price_per_user_monthly"
                    (change)="updateModulePrice(p, $event)"
                  />
                </td>
                <td></td>
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>

        <mat-tab [label]="'platform.billing.exchangeRates' | translate">
          <form [formGroup]="manualRateForm" (ngSubmit)="saveManualRate()" class="tab-form row-inline">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'platform.billing.currency' | translate }}</mat-label>
              <input matInput formControlName="currency_code" placeholder="USD" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'platform.billing.rateToTry' | translate }}</mat-label>
              <input matInput type="number" step="0.000001" formControlName="rate_to_try" />
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">
              {{ 'platform.billing.setManualRate' | translate }}
            </button>
          </form>
          <table class="bms-table">
            <thead>
              <tr>
                <th>{{ 'platform.billing.currency' | translate }}</th>
                <th>{{ 'platform.billing.rateToTry' | translate }}</th>
                <th>{{ 'platform.billing.source' | translate }}</th>
                <th>{{ 'platform.billing.fetchedAt' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of exchangeRates(); track r.currency_code) {
              <tr>
                <td>{{ r.currency_code }}</td>
                <td>{{ r.rate_to_try }}</td>
                <td>{{ r.source }}</td>
                <td>{{ r.fetched_at | date: 'short' }}</td>
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>

        <mat-tab [label]="'platform.billing.taxes' | translate">
          <p class="hint">{{ 'platform.billing.taxesHint' | translate }}</p>
          <table class="bms-table">
            <thead>
              <tr>
                <th>{{ 'platform.billing.taxCode' | translate }}</th>
                <th>{{ 'platform.billing.taxRate' | translate }} %</th>
                <th>{{ 'platform.billing.validFrom' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of taxRates(); track r.id) {
              <tr>
                <td>{{ taxTypeName(r.tax_type) }}</td>
                <td>{{ r.rate_percent }}</td>
                <td>{{ r.valid_from }}</td>
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .page-header h1 {
        margin: 0 0 16px;
        font-size: 22px;
      }
      .tab-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 400px;
        padding: 16px 0;
      }
      .row-inline {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        max-width: 100%;
      }
      .inline-input {
        width: 120px;
        padding: 4px 8px;
      }
      .hint {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class PlatformBillingComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  modulePrices = signal<ModulePrice[]>([]);
  exchangeRates = signal<ExchangeRate[]>([]);
  taxRates = signal<TaxRate[]>([]);
  taxTypes = signal<TaxType[]>([]);

  settingsForm = this.fb.group({
    default_monthly_discount_percent: ['0', Validators.required],
    yearly_discount_percent: ['15', Validators.required],
    invoice_prefix: ['TEN', Validators.required],
    company_name: ['Tenancysoft', Validators.required],
  });

  manualRateForm = this.fb.group({
    currency_code: ['USD', Validators.required],
    rate_to_try: ['', Validators.required],
  });

  ngOnInit(): void {
    this.http.get<BillingSettings>(`${API_BASE}/platform/billing/settings/`).subscribe((s) => {
      this.settingsForm.patchValue(s);
    });
    this.http
      .get<Page<ModulePrice>>(`${API_BASE}/platform/billing/module-prices/?limit=100`)
      .subscribe((p) => {
        const existing = new Set(p.results.map((x) => x.module_slug));
        this.modulePrices.set(p.results);
        for (const slug of ALL_MODULE_SLUGS) {
          if (!existing.has(slug)) {
            this.http
              .post<ModulePrice>(`${API_BASE}/platform/billing/module-prices/`, {
                module_slug: slug,
                price_per_user_monthly: '0',
                is_active: true,
              })
              .subscribe(() => this.reloadModulePrices());
          }
        }
      });
    this.reloadExchangeRates();
    this.http
      .get<Page<TaxType>>(`${API_BASE}/platform/billing/tax-types/?limit=50`)
      .subscribe((p) => this.taxTypes.set(p.results));
    this.http
      .get<Page<TaxRate>>(`${API_BASE}/platform/billing/tax-rates/?limit=50`)
      .subscribe((p) => this.taxRates.set(p.results));
  }

  taxTypeName(id: number): string {
    return this.taxTypes().find((t) => t.id === id)?.code ?? String(id);
  }

  reloadModulePrices(): void {
    this.http
      .get<Page<ModulePrice>>(`${API_BASE}/platform/billing/module-prices/?limit=100`)
      .subscribe((p) => this.modulePrices.set(p.results));
  }

  reloadExchangeRates(): void {
    this.http
      .get<ExchangeRate[]>(`${API_BASE}/platform/billing/exchange-rates/latest/`)
      .subscribe((r) => this.exchangeRates.set(r));
  }

  saveSettings(): void {
    this.http
      .patch(`${API_BASE}/platform/billing/settings/`, this.settingsForm.getRawValue())
      .subscribe({
        next: () => this.toast('common.saved'),
        error: (e) => this.toast(e?.error?.detail || 'common.error'),
      });
  }

  updateModulePrice(p: ModulePrice, ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this.http
      .patch(`${API_BASE}/platform/billing/module-prices/${p.id}/`, {
        price_per_user_monthly: value,
      })
      .subscribe({
        next: () => this.reloadModulePrices(),
        error: (e) => this.toast(e?.error?.detail || 'common.error'),
      });
  }

  saveManualRate(): void {
    const v = this.manualRateForm.getRawValue();
    this.http
      .post(`${API_BASE}/platform/billing/exchange-rates/manual/`, v)
      .subscribe({
        next: () => {
          this.reloadExchangeRates();
          this.toast('common.saved');
        },
        error: (e) => this.toast(e?.error?.detail || 'common.error'),
      });
  }

  private toast(key: string): void {
    this.snack.open(this.translate.instant(key), 'OK', { duration: 2000 });
  }
}
