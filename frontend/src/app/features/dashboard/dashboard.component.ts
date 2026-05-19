import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';

import { API_BASE } from '../../core/api';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface DashboardSummary {
  daily_sales: number;
  customer_count: number;
  patient_count: number;
  open_invoices_count: number;
  critical_stock: Array<{
    id: number;
    sku: string;
    product_name: string;
    warehouse_code: string;
    quantity: number;
    reorder_level: number;
  }>;
  upcoming_appointments: Array<{
    id: number;
    start_at: string;
    end_at: string;
    status: string;
    notes: string;
  }>;
  recent_payments: Array<{
    id: number;
    amount: number;
    paid_at: string;
    method: string;
    invoice_number: string;
  }>;
  recent_transactions: Array<{
    id: number;
    kind: string;
    amount: number;
    description: string;
    occurred_at: string;
  }>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    DatePipe,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    BaseChartDirective,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Dashboard" icon="dashboard"></app-page-header>

      @if (data(); as d) {
      <div class="card-grid">
        <div class="metric-card">
          <span class="label">Daily Sales</span>
          <span class="value">{{ d.daily_sales | number: '1.2-2' }}</span>
        </div>
        <div class="metric-card">
          <span class="label">Customers</span>
          <span class="value">{{ d.customer_count }}</span>
        </div>
        <div class="metric-card">
          <span class="label">Patients</span>
          <span class="value">{{ d.patient_count }}</span>
        </div>
        <div class="metric-card">
          <span class="label">Open Invoices</span>
          <span class="value">{{ d.open_invoices_count }}</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px">
        <mat-card>
          <mat-card-header><mat-card-title>Recent payments</mat-card-title></mat-card-header>
          <mat-card-content>
            <canvas
              baseChart
              [data]="paymentsChart()"
              [type]="'bar'"
              [options]="chartOpts"
            ></canvas>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header><mat-card-title>Critical stock</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (d.critical_stock.length === 0) {
              <p>Nothing below reorder level.</p>
            } @else {
              <ul>
                @for (s of d.critical_stock; track s.id) {
                <li>
                  {{ s.product_name }} ({{ s.sku }}) — {{ s.warehouse_code }}:
                  <strong>{{ s.quantity }}</strong> / {{ s.reorder_level }}
                </li>
                }
              </ul>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px">
        <mat-card>
          <mat-card-header><mat-card-title>Upcoming appointments</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (d.upcoming_appointments.length === 0) {
              <p>No upcoming appointments.</p>
            } @else {
              <ul>
                @for (a of d.upcoming_appointments; track a.id) {
                <li>{{ a.start_at | date: 'short' }} — {{ a.status }}</li>
                }
              </ul>
            }
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-header><mat-card-title>Recent transactions</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (d.recent_transactions.length === 0) {
              <p>No recent transactions.</p>
            } @else {
              <ul>
                @for (t of d.recent_transactions; track t.id) {
                <li>
                  {{ t.occurred_at | date: 'short' }} — {{ t.kind }}: {{ t.amount | number: '1.2-2' }}
                </li>
                }
              </ul>
            }
          </mat-card-content>
        </mat-card>
      </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  protected data = signal<DashboardSummary | null>(null);
  protected chartOpts = { responsive: true, maintainAspectRatio: false };

  protected paymentsChart() {
    const d = this.data();
    if (!d)
      return {
        labels: [],
        datasets: [{ label: 'Payments', data: [] }],
      };
    const items = [...d.recent_payments].reverse();
    return {
      labels: items.map((p) => p.invoice_number),
      datasets: [
        {
          label: 'Recent payments',
          data: items.map((p) => Number(p.amount)),
          backgroundColor: '#3f51b5',
        },
      ],
    };
  }

  ngOnInit(): void {
    this.http
      .get<DashboardSummary>(`${API_BASE}/dashboard/summary/`)
      .subscribe({
        next: (d) => this.data.set(d),
        error: () => this.data.set(null),
      });
  }
}
