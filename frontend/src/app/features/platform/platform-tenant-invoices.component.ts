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
  module_slug: string;
  description: string;
  user_count: number;
  unit_price: string;
  amount_excl_tax: string;
}

interface Invoice {
  id: number;
  number: string;
  period_start: string;
  period_end: string;
  billing_period: string;
  currency_code: string;
  subtotal_excl_tax: string;
  total_incl_tax: string;
  status: string;
  is_paid: boolean;
  lines: InvoiceLine[];
  tax_lines: { tax_type_name: string; rate_percent: string; tax_amount: string }[];
}

interface Page<T> {
  results: T[];
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
        <button mat-flat-button color="primary" (click)="generate()">
          <mat-icon>add</mat-icon>
          {{ 'platform.invoice.generate' | translate }}
        </button>
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
          <tr>
            <td>{{ inv.number }}</td>
            <td>{{ inv.period_start }} — {{ inv.period_end }}</td>
            <td>{{ inv.total_incl_tax }} {{ inv.currency_code }}</td>
            <td>{{ inv.status }}</td>
            <td style="text-align:right">
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
      <section class="detail">
        <h2>{{ inv.number }}</h2>
        <ul>
          @for (line of inv.lines; track line.module_slug) {
          <li>{{ line.description }} — {{ line.amount_excl_tax }} {{ inv.currency_code }}</li>
          }
        </ul>
        @for (tax of inv.tax_lines; track tax.tax_type_name) {
        <p>{{ tax.tax_type_name }} {{ tax.rate_percent }}%: {{ tax.tax_amount }}</p>
        }
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
      }
      .page-header h1 {
        flex: 1;
        margin: 0;
        font-size: 22px;
      }
      .detail {
        margin-top: 24px;
        padding: 16px;
        background: #fafafa;
        border-radius: 8px;
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
  }

  generate(): void {
    this.http.post<Invoice>(`${this.base()}/`, {}).subscribe({
      next: () => {
        this.reload();
        this.toast('platform.invoice.generated');
      },
      error: (e) => this.toast(e?.error?.detail || 'common.error'),
    });
  }

  markPaid(inv: Invoice): void {
    this.http.post(`${this.base()}/${inv.id}/mark-paid/`, {}).subscribe({
      next: () => {
        this.reload();
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
    this.http.get<Invoice>(`${this.base()}/${inv.id}/`).subscribe((d) => this.selected.set(d));
  }

  private toast(key: string): void {
    this.snack.open(this.translate.instant(key), 'OK', { duration: 2000 });
  }
}
