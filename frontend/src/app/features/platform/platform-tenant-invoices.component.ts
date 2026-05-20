import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';

interface InvoiceLine {
  id?: number;
  module_slug: string;
  description: string;
  user_count: number;
  months: number;
  unit_price_list?: string | null;
  discount_percent?: string | null;
  unit_price: string;
  line_total_before_discount?: string | null;
  amount_excl_tax: string;
}

interface TaxLine {
  tax_type_name: string;
  tax_type_code?: string;
  rate_percent: string;
  base_amount?: string;
  tax_amount: string;
}

interface Invoice {
  id: number;
  number: string;
  period_start: string;
  period_end: string;
  billing_period: string;
  currency_code: string;
  fx_rate_to_try?: string;
  subtotal_before_discount?: string | null;
  discount_percent?: string | null;
  discount_amount?: string | null;
  subtotal_excl_tax: string;
  total_incl_tax: string;
  status: string;
  is_paid: boolean;
  issued_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  tenant_name?: string;
  tenant_code?: string;
  lines: InvoiceLine[];
  tax_lines: TaxLine[];
}

interface Page<T> {
  results: T[];
}

interface CanGenerateResponse {
  can_generate: boolean;
  period_start: string;
  period_end: string;
  existing_invoice_id: number | null;
  existing_invoice_number: string | null;
}

@Component({
  selector: 'app-platform-tenant-invoices',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <a mat-button routerLink="/admin/tenants">
          <mat-icon>arrow_back</mat-icon>
          {{ 'platform.tenants' | translate }}
        </a>
        <h1>{{ 'platform.invoice.title' | translate }} #{{ tenantId() }}</h1>
        @if (canGenerate()) {
        <button mat-flat-button color="primary" (click)="generate()">
          <mat-icon>add</mat-icon>
          {{ 'platform.invoice.generate' | translate }}
        </button>
        } @else if (existingInvoiceNumber()) {
        <span class="period-hint muted">{{ 'platform.invoice.alreadyExists' | translate }}: {{ existingInvoiceNumber() }}</span>
        }
      </header>

      <table class="bms-table">
        <thead>
          <tr>
            <th>{{ 'platform.invoice.number' | translate }}</th>
            <th>{{ 'platform.invoice.period' | translate }}</th>
            <th>{{ 'platform.invoice.total' | translate }}</th>
            <th>{{ 'platform.invoice.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (inv of items(); track inv.id) {
          <tr [class.row-selected]="selected()?.id === inv.id">
            <td>{{ inv.number }}</td>
            <td>
              {{ formatDate(inv.period_start) }} — {{ formatDate(inv.period_end) }}
              @if (inv.discount_percent && +inv.discount_percent > 0) {
              <span class="muted"> · %{{ inv.discount_percent }} {{ 'platform.invoice.discountLabel' | translate | lowercase }}</span>
              }
            </td>
            <td>{{ money(inv.total_incl_tax) }} {{ inv.currency_code }}</td>
            <td>{{ inv.status }}</td>
            <td class="actions-cell">
              <button mat-icon-button (click)="downloadPdf(inv)" [attr.aria-label]="'platform.invoice.pdf' | translate">
                <mat-icon>picture_as_pdf</mat-icon>
              </button>
              @if (!inv.is_paid) {
              <button mat-icon-button (click)="markPaid(inv)" [attr.aria-label]="'platform.invoice.markPaid' | translate">
                <mat-icon>paid</mat-icon>
              </button>
              }
              <button mat-icon-button (click)="select(inv)" [attr.aria-label]="'common.details' | translate">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </tr>
          }
        </tbody>
      </table>

      @if (selected(); as inv) {
      <section class="invoice-preview" id="invoice-detail">
        <header class="invoice-preview__toolbar">
          <h2>{{ 'platform.invoice.detailTitle' | translate }}</h2>
          <div class="invoice-preview__actions">
            <button mat-stroked-button (click)="downloadPdf(inv)">
              <mat-icon>picture_as_pdf</mat-icon>
              {{ 'platform.invoice.pdf' | translate }}
            </button>
            <button mat-icon-button (click)="closeDetail()" [attr.aria-label]="'platform.invoice.close' | translate">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </header>

        <div class="invoice-preview__meta">
          <div class="meta-block">
            <div class="meta-row"><span class="label">{{ 'platform.invoice.number' | translate }}</span><strong>{{ inv.number }}</strong></div>
            @if (documentDate(inv)) {
            <div class="meta-row"><span class="label">{{ 'platform.invoice.date' | translate }}</span>{{ documentDate(inv) }}</div>
            }
            <div class="meta-row"><span class="label">{{ 'platform.invoice.status' | translate }}</span><span class="status-badge">{{ inv.status }}</span></div>
          </div>
          <div class="meta-block meta-block--right">
            @if (inv.tenant_name) {
            <div class="meta-row"><span class="label">{{ 'platform.invoice.customer' | translate }}</span>{{ inv.tenant_name }}</div>
            <div class="meta-row"><span class="label">{{ 'platform.invoice.customerCode' | translate }}</span>{{ inv.tenant_code }}</div>
            }
            <div class="meta-row">
              <span class="label">{{ 'platform.invoice.period' | translate }}</span>
              {{ formatDate(inv.period_start) }} — {{ formatDate(inv.period_end) }}
            </div>
            <div class="meta-row muted">
              {{ (inv.billing_period === 'yearly' ? 'platform.invoice.yearly' : 'platform.invoice.monthly') | translate }}
              / {{ inv.currency_code }}
            </div>
            @if (inv.fx_rate_to_try) {
            <div class="meta-row muted">
              {{ 'platform.invoice.fxRate' | translate }}: 1 {{ inv.currency_code }} = {{ inv.fx_rate_to_try }} TRY
            </div>
            }
            @if (hasDiscount(inv)) {
            <div class="meta-row muted">
              {{ (inv.billing_period === 'yearly' ? 'platform.invoice.yearly' : 'platform.invoice.monthly') | translate }}
              {{ 'platform.invoice.discountLabel' | translate }}: %{{ inv.discount_percent }}
            </div>
            }
          </div>
        </div>

        <table class="bms-table invoice-lines">
          <thead>
            <tr>
              <th>{{ 'platform.invoice.lineDescription' | translate }}</th>
              <th class="num">{{ 'platform.invoice.lineUsers' | translate }}</th>
              <th class="num">{{ 'platform.invoice.lineMonths' | translate }}</th>
              <th class="num">{{ 'platform.invoice.lineListPrice' | translate }}</th>
              <th class="num">{{ 'platform.invoice.lineDiscount' | translate }}</th>
              <th class="num">{{ 'platform.invoice.lineAmount' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of invoiceLines(inv); track line.id ?? line.module_slug) {
            <tr>
              <td>{{ line.description }}</td>
              <td class="num">{{ line.user_count }}</td>
              <td class="num">{{ line.months }}</td>
              <td class="num">{{ listUnitPrice(line, inv.currency_code) }}</td>
              <td class="num">{{ lineDiscount(line) }}</td>
              <td class="num">{{ money(line.amount_excl_tax) }} {{ inv.currency_code }}</td>
            </tr>
            } @empty {
            <tr>
              <td colspan="6" class="empty-lines">{{ 'platform.invoice.noLines' | translate }}</td>
            </tr>
            }
          </tbody>
        </table>

        <table class="totals-table">
          @if (inv.subtotal_before_discount) {
          <tr>
            <td>{{ 'platform.invoice.subtotalBeforeDiscount' | translate }}</td>
            <td class="num">{{ money(inv.subtotal_before_discount) }} {{ inv.currency_code }}</td>
          </tr>
          }
          @if (hasDiscount(inv)) {
          <tr>
            <td>{{ 'platform.invoice.discountApplied' | translate }} (%{{ inv.discount_percent }})</td>
            <td class="num discount">−{{ money(inv.discount_amount) }} {{ inv.currency_code }}</td>
          </tr>
          }
          <tr>
            <td>{{ 'platform.invoice.subtotalAfterDiscount' | translate }}</td>
            <td class="num">{{ money(inv.subtotal_excl_tax) }} {{ inv.currency_code }}</td>
          </tr>
        </table>

        @if (taxLines(inv).length) {
        <table class="bms-table tax-table">
          <thead>
            <tr>
              <th>{{ 'platform.invoice.taxType' | translate }}</th>
              <th class="num">{{ 'platform.invoice.taxRateCol' | translate }}</th>
              <th class="num">{{ 'platform.invoice.taxBase' | translate }}</th>
              <th class="num">{{ 'platform.invoice.taxAmount' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (tax of taxLines(inv); track tax.tax_type_name) {
            <tr>
              <td>{{ tax.tax_type_name }}</td>
              <td class="num">{{ tax.rate_percent }}</td>
              <td class="num">{{ tax.base_amount ? money(tax.base_amount) + ' ' + inv.currency_code : '—' }}</td>
              <td class="num">{{ money(tax.tax_amount) }} {{ inv.currency_code }}</td>
            </tr>
            }
          </tbody>
        </table>
        }

        <table class="totals-table totals-table--grand">
          <tr>
            <td>{{ 'platform.invoice.grandTotal' | translate }}</td>
            <td class="num grand">{{ money(inv.total_incl_tax) }} {{ inv.currency_code }}</td>
          </tr>
        </table>
      </section>
      }
    </div>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .page-header h1 {
        flex: 1;
        margin: 0;
        font-size: 22px;
      }
      .muted {
        color: rgba(0, 0, 0, 0.55);
        font-size: 13px;
      }
      .actions-cell {
        text-align: right;
        white-space: nowrap;
      }
      tr.row-selected {
        background: rgba(25, 118, 210, 0.08);
      }
      .invoice-preview {
        margin-top: 24px;
        padding: 24px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
      .invoice-preview__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
      }
      .invoice-preview__toolbar h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .invoice-preview__actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .invoice-preview__meta {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }
      .meta-block {
        flex: 1;
        min-width: 220px;
      }
      .meta-block--right {
        text-align: right;
      }
      .meta-row {
        margin-bottom: 6px;
        font-size: 13px;
      }
      .meta-row .label {
        color: rgba(0, 0, 0, 0.55);
        margin-right: 8px;
      }
      .status-badge {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 12px;
      }
      .invoice-lines {
        margin-bottom: 16px;
      }
      th.num,
      td.num {
        text-align: right;
        white-space: nowrap;
      }
      .totals-table {
        width: 100%;
        margin-top: 8px;
        border-collapse: collapse;
      }
      .totals-table td {
        padding: 6px 8px;
        font-size: 13px;
      }
      .totals-table td:first-child {
        text-align: right;
        font-weight: 600;
        width: 70%;
        color: rgba(0, 0, 0, 0.75);
      }
      .totals-table td.num {
        text-align: right;
        width: 30%;
      }
      .totals-table td.discount {
        color: #c62828;
      }
      .totals-table--grand td {
        padding-top: 12px;
        font-size: 15px;
        border-top: 2px solid #333;
      }
      .totals-table--grand .grand {
        font-weight: 700;
      }
      .tax-table {
        margin-top: 16px;
      }
      .empty-lines {
        text-align: center;
        color: rgba(0, 0, 0, 0.55);
        font-style: italic;
        padding: 16px !important;
      }
    `,
  ],
})
export class PlatformTenantInvoicesComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  tenantId = signal(0);
  items = signal<Invoice[]>([]);
  selected = signal<Invoice | null>(null);
  canGenerate = signal(true);
  existingInvoiceNumber = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.tenantId.set(id);
    this.reload();
  }

  private base(): string {
    return `${API_BASE}/platform/tenants/${this.tenantId()}/subscription-invoices`;
  }

  reload(): void {
    this.http.get<Page<Invoice>>(`${this.base()}/`).subscribe((p) => this.items.set(p.results));
    this.http.get<CanGenerateResponse>(`${this.base()}/can-generate/`).subscribe((s) => {
      this.canGenerate.set(s.can_generate);
      this.existingInvoiceNumber.set(s.existing_invoice_number);
    });
  }

  generate(): void {
    this.http.post<Invoice>(`${this.base()}/`, {}).subscribe({
      next: (created) => {
        this.reload();
        this.selected.set(this.normalizeInvoice(created));
        this.toast('platform.invoice.generated');
      },
      error: (e) => this.toast(e?.error?.detail || 'common.error'),
    });
  }

  markPaid(inv: Invoice): void {
    this.http.post<Invoice>(`${this.base()}/${inv.id}/mark-paid/`, {}).subscribe({
      next: (updated) => {
        this.reload();
        if (this.selected()?.id === inv.id) {
          this.selected.set(this.normalizeInvoice(updated));
        }
        this.toast('platform.invoice.paid');
      },
      error: (e) => this.toast(e?.error?.detail || 'common.error'),
    });
  }

  downloadPdf(inv: Invoice): void {
    this.http
      .get(`${this.base()}/${inv.id}/pdf/`, { responseType: 'blob' })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${inv.number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  select(inv: Invoice): void {
    this.http.get<Invoice>(`${this.base()}/${inv.id}/`).subscribe({
      next: (d) => {
        this.selected.set(this.normalizeInvoice(d));
        setTimeout(
          () => document.getElementById('invoice-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          50
        );
      },
      error: (e) => this.toast(e?.error?.detail || 'common.error'),
    });
  }

  private normalizeInvoice(raw: Invoice): Invoice {
    return {
      ...raw,
      lines: Array.isArray(raw.lines) ? raw.lines : [],
      tax_lines: Array.isArray(raw.tax_lines) ? raw.tax_lines : [],
    };
  }

  invoiceLines(inv: Invoice): InvoiceLine[] {
    return Array.isArray(inv.lines) ? inv.lines : [];
  }

  taxLines(inv: Invoice): TaxLine[] {
    return Array.isArray(inv.tax_lines) ? inv.tax_lines : [];
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  formatDate(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('tr-TR');
  }

  documentDate(inv: Invoice): string {
    const raw = inv.issued_at || inv.paid_at || inv.created_at;
    if (!raw) return '';
    const d = new Date(raw);
    return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  }

  money(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  hasDiscount(inv: Invoice): boolean {
    return !!(inv.discount_amount && Number(inv.discount_amount) > 0);
  }

  listUnitPrice(line: InvoiceLine, currency: string): string {
    const v = line.unit_price_list ?? line.unit_price;
    const n = Number(v);
    const formatted = Number.isNaN(n)
      ? v
      : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return `${formatted} ${currency}`;
  }

  lineDiscount(line: InvoiceLine): string {
    if (line.discount_percent && Number(line.discount_percent) > 0) {
      return `%${Number(line.discount_percent).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
    }
    return '—';
  }

  private toast(key: string): void {
    this.snack.open(this.translate.instant(key), 'OK', { duration: 2000 });
  }
}
