import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { phoneRequiredValidator } from '../../shared/form-validators';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import {
  ServiceDashboard,
  ServiceDeskService,
  ServiceTicket,
  ServiceTicketStatus,
} from './service.service';

const STATUS_FILTERS: Array<ServiceTicketStatus | ''> = [
  '',
  'received',
  'diagnosing',
  'awaiting_approval',
  'in_repair',
  'ready',
  'delivered',
];

@Component({
  selector: 'app-service-desk',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslateModule,
    PageHeaderComponent,
    SearchSelectComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="service" icon="build">
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="openIntake()">
          <mat-icon>add</mat-icon> {{ 'service.newIntake' | translate }}
        </button>
        }
      </app-page-header>

      @if (metrics(); as m) {
      <div class="metrics">
        <div class="metric"><span class="label">{{ 'service.metrics.open' | translate }}</span><span class="value">{{ m.open_count }}</span></div>
        <div class="metric"><span class="label">{{ 'service.metrics.awaiting' | translate }}</span><span class="value">{{ m.awaiting_approval }}</span></div>
        <div class="metric"><span class="label">{{ 'service.metrics.ready' | translate }}</span><span class="value">{{ m.ready_count }}</span></div>
        <div class="metric"><span class="label">{{ 'service.metrics.delivered' | translate }}</span><span class="value">{{ m.delivered_today }}</span></div>
      </div>
      }

      <div class="filters">
        @for (s of statusFilters; track s) {
        <button
          mat-stroked-button
          type="button"
          [class.active]="statusFilter() === s"
          (click)="setStatusFilter(s)"
        >
          {{ s ? ('service.status.' + s | translate) : ('common.all' | translate) }}
        </button>
        }
      </div>

      <table class="bms-table">
        <thead>
          <tr>
            <th>{{ 'service.ticketNumber' | translate }}</th>
            <th>{{ 'service.customer' | translate }}</th>
            <th>{{ 'service.device' | translate }}</th>
            <th>{{ 'service.statusLabel' | translate }}</th>
            <th>{{ 'service.receivedAt' | translate }}</th>
            @if (canWrite()) { <th></th> }
          </tr>
        </thead>
        <tbody>
          @for (t of tickets(); track t.id) {
          <tr>
            <td class="mono">{{ t.ticket_number }}</td>
            <td>
              <div>{{ t.customer_display }}</div>
              @if (t.customer_phone) { <small>{{ t.customer_phone }}</small> }
            </td>
            <td>{{ t.device_summary }}</td>
            <td><span class="pill" [attr.data-status]="t.status">{{ 'service.status.' + t.status | translate }}</span></td>
            <td>{{ t.received_at | date: 'dd.MM.yyyy HH:mm' }}</td>
            @if (canWrite()) {
            <td style="text-align:right">
              <button mat-icon-button type="button" (click)="openDetail(t)"><mat-icon>visibility</mat-icon></button>
            </td>
            }
          </tr>
          } @empty {
          <tr><td [attr.colspan]="canWrite() ? 6 : 5" style="text-align:center;padding:24px">{{ 'common.noRecords' | translate }}</td></tr>
          }
        </tbody>
      </table>

      @if (intakeOpen()) {
      <div class="overlay" (click)="intakeOpen.set(false)"></div>
      <div class="dialog">
        <h2>{{ 'service.newIntake' | translate }}</h2>
        <form [formGroup]="intakeForm" (ngSubmit)="saveIntake()" class="form-stack">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'service.intakeMode' | translate }}</mat-label>
            <mat-select formControlName="mode">
              <mat-option value="quick">{{ 'service.quickCustomer' | translate }}</mat-option>
              <mat-option value="existing">{{ 'service.existingCustomer' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          @if (intakeForm.value.mode === 'existing') {
          <app-search-select
            formControlName="customer"
            apiPath="customers"
            moduleSlug="customers"
            [label]="'service.customer' | translate"
            [labelKeys]="['first_name', 'last_name', 'phone']"
            [allowNull]="true"
          />
          } @else {
          <mat-form-field appearance="outline"><mat-label>{{ 'service.customerName' | translate }}</mat-label><input matInput formControlName="customer_name" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'service.phone' | translate }}</mat-label><input matInput formControlName="customer_phone" required /></mat-form-field>
          }
          <div class="row">
            <mat-form-field appearance="outline"><mat-label>{{ 'service.brand' | translate }}</mat-label><input matInput formControlName="device_brand" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'service.model' | translate }}</mat-label><input matInput formControlName="device_model" /></mat-form-field>
          </div>
          <mat-form-field appearance="outline"><mat-label>{{ 'service.serial' | translate }}</mat-label><input matInput formControlName="device_serial" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'service.complaint' | translate }}</mat-label><textarea matInput rows="3" formControlName="complaint"></textarea></mat-form-field>
          <div class="actions">
            <button mat-button type="button" (click)="intakeOpen.set(false)">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
          </div>
        </form>
      </div>
      }

      @if (detail(); as t) {
      <div class="overlay" (click)="closeDetail()"></div>
      <div class="dialog dialog--wide">
        <div class="detail-head">
          <h2>{{ t.ticket_number }} — {{ t.customer_display }}</h2>
          <button mat-icon-button type="button" (click)="closeDetail()"><mat-icon>close</mat-icon></button>
        </div>
        <p><span class="pill" [attr.data-status]="t.status">{{ 'service.status.' + t.status | translate }}</span></p>
        <p><strong>{{ 'service.device' | translate }}:</strong> {{ t.device_summary }} @if (t.device_serial) { · {{ t.device_serial }} }</p>
        <p><strong>{{ 'service.complaint' | translate }}:</strong> {{ t.complaint }}</p>
        @if (t.diagnosis) {
        <p><strong>{{ 'service.diagnosis' | translate }}:</strong> {{ t.diagnosis }} — {{ t.estimated_price | number:'1.2-2' }} ₺</p>
        }

        @if (t.events?.length) {
        <h3>{{ 'service.timeline' | translate }}</h3>
        <ul class="timeline">
          @for (e of t.events; track e.id) {
          <li><small>{{ e.created_at | date:'dd.MM.yyyy HH:mm' }}</small> {{ 'service.status.' + e.to_status | translate }} — {{ e.note }}</li>
          }
        </ul>
        }

        @if (canWrite()) {
        <div class="actions actions--wrap">
          @if (t.status === 'received' || t.status === 'diagnosing') {
          <button mat-stroked-button type="button" (click)="openDiagnosis(t)">{{ 'service.actions.diagnosis' | translate }}</button>
          }
          @if (t.status === 'awaiting_approval') {
          <button mat-flat-button color="primary" type="button" (click)="doApprove(t)">{{ 'service.actions.approve' | translate }}</button>
          <button mat-stroked-button type="button" (click)="doTransition(t, 'cancelled')">{{ 'service.actions.reject' | translate }}</button>
          }
          @if (t.status === 'in_repair') {
          <button mat-stroked-button type="button" (click)="doTransition(t, 'ready')">{{ 'service.actions.markReady' | translate }}</button>
          }
          @if (t.status === 'ready') {
          <button mat-flat-button color="primary" type="button" (click)="openDeliver(t)">{{ 'service.actions.deliver' | translate }}</button>
          }
          @if (t.status === 'received') {
          <button mat-stroked-button type="button" (click)="doTransition(t, 'diagnosing')">{{ 'service.actions.startDiagnosis' | translate }}</button>
          }
          <button mat-stroked-button type="button" (click)="reprint(t)"><mat-icon>print</mat-icon> {{ 'service.reprint' | translate }}</button>
        </div>
        }
      </div>
      }

      @if (diagnosisOpen()) {
      <div class="overlay" (click)="diagnosisOpen.set(false)"></div>
      <div class="dialog">
        <h2>{{ 'service.actions.diagnosis' | translate }}</h2>
        <form [formGroup]="diagnosisForm" (ngSubmit)="saveDiagnosis()" class="form-stack">
          <mat-form-field appearance="outline"><mat-label>{{ 'service.diagnosis' | translate }}</mat-label><textarea matInput rows="3" formControlName="diagnosis"></textarea></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'service.estimatedPrice' | translate }}</mat-label><input matInput type="number" step="0.01" formControlName="estimated_price" /></mat-form-field>
          <div class="actions">
            <button mat-button type="button" (click)="diagnosisOpen.set(false)">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
          </div>
        </form>
      </div>
      }

      @if (deliverOpen()) {
      <div class="overlay" (click)="deliverOpen.set(false)"></div>
      <div class="dialog">
        <h2>{{ 'service.actions.deliver' | translate }}</h2>
        <form [formGroup]="deliverForm" (ngSubmit)="saveDeliver()" class="form-stack">
          <mat-form-field appearance="outline"><mat-label>{{ 'service.finalPrice' | translate }}</mat-label><input matInput type="number" step="0.01" formControlName="final_price" /></mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'service.paymentMethod' | translate }}</mat-label>
            <mat-select formControlName="payment_method">
              <mat-option value="cash">{{ 'service.payment.cash' | translate }}</mat-option>
              <mat-option value="card">{{ 'service.payment.card' | translate }}</mat-option>
              <mat-option value="iban">{{ 'service.payment.iban' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="actions">
            <button mat-button type="button" (click)="deliverOpen.set(false)">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit">{{ 'service.actions.deliver' | translate }}</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
      .metric { padding: 14px; border-radius: 8px; background: var(--mat-sys-surface-container, #f5f5f5); }
      .metric .label { display: block; font-size: 12px; opacity: 0.7; }
      .metric .value { font-size: 24px; font-weight: 600; }
      .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
      .filters button.active { border-color: var(--mat-sys-primary); }
      .mono { font-family: monospace; }
      .pill { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #eee; }
      .pill[data-status='ready'] { background: #e8f5e9; }
      .pill[data-status='awaiting_approval'] { background: #fff3e0; }
      .pill[data-status='delivered'] { background: #e3f2fd; }
      .pill[data-status='cancelled'] { background: #ffebee; }
      .form-stack { display: flex; flex-direction: column; gap: 8px; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
      .actions--wrap { flex-wrap: wrap; justify-content: flex-start; }
      .dialog--wide { max-width: 720px; width: min(96vw, 720px); }
      .detail-head { display: flex; justify-content: space-between; align-items: center; }
      .timeline { margin: 0; padding-left: 18px; font-size: 13px; }
    `,
  ],
})
export class ServiceComponent implements OnInit {
  private svc = inject(ServiceDeskService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);

  statusFilters = STATUS_FILTERS;
  statusFilter = signal<ServiceTicketStatus | ''>('');
  tickets = signal<ServiceTicket[]>([]);
  metrics = signal<ServiceDashboard | null>(null);
  intakeOpen = signal(false);
  detail = signal<ServiceTicket | null>(null);
  diagnosisOpen = signal(false);
  deliverOpen = signal(false);
  private diagnosisTargetId: number | null = null;
  private deliverTargetId: number | null = null;

  intakeForm = this.fb.group({
    mode: ['quick'],
    customer: this.fb.control<number | null>(null),
    customer_name: ['', Validators.required],
    customer_phone: ['', phoneRequiredValidator()],
    device_brand: [''],
    device_model: [''],
    device_serial: [''],
    complaint: ['', Validators.required],
  });

  diagnosisForm = this.fb.group({
    diagnosis: ['', Validators.required],
    estimated_price: [0, Validators.required],
  });

  deliverForm = this.fb.group({
    final_price: [0, Validators.required],
    payment_method: ['cash', Validators.required],
  });

  ngOnInit(): void {
    this.reload();
    this.intakeForm.get('mode')?.valueChanges.subscribe((mode) => {
      const name = this.intakeForm.get('customer_name');
      const phone = this.intakeForm.get('customer_phone');
      if (mode === 'existing') {
        name?.clearValidators();
        phone?.clearValidators();
      } else {
        name?.setValidators([Validators.required]);
        phone?.setValidators([phoneRequiredValidator()]);
      }
      name?.updateValueAndValidity();
      phone?.updateValueAndValidity();
    });
  }

  canWrite = () => this.auth.hasPermission('service.write');

  setStatusFilter(s: ServiceTicketStatus | ''): void {
    this.statusFilter.set(s);
    this.reload();
  }

  reload(): void {
    const params: Record<string, string> = { limit: '200' };
    const st = this.statusFilter();
    if (st) params['status'] = st;
    this.svc.list(params).subscribe((list) => this.tickets.set(list));
    this.svc.dashboard().subscribe((m) => this.metrics.set(m));
  }

  openIntake(): void {
    this.intakeForm.reset({
      mode: 'quick',
      customer: null,
      customer_name: '',
      customer_phone: '',
      device_brand: '',
      device_model: '',
      device_serial: '',
      complaint: '',
    });
    this.intakeOpen.set(true);
  }

  saveIntake(): void {
    if (this.intakeForm.invalid) {
      this.intakeForm.markAllAsTouched();
      return;
    }
    const v = this.intakeForm.getRawValue();
    const payload: Record<string, unknown> = {
      device_brand: v.device_brand,
      device_model: v.device_model,
      device_serial: v.device_serial,
      complaint: v.complaint,
      print_intake: true,
    };
    if (v.mode === 'existing' && v.customer) {
      payload['customer'] = v.customer;
    } else {
      payload['customer_name'] = v.customer_name;
      payload['customer_phone'] = v.customer_phone;
    }
    this.svc.create(payload).subscribe({
      next: () => {
        this.intakeOpen.set(false);
        this.reload();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 2000 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 3000,
        }),
    });
  }

  openDetail(t: ServiceTicket): void {
    this.svc.get(t.id).subscribe((full) => this.detail.set(full));
  }

  closeDetail(): void {
    this.detail.set(null);
  }

  openDiagnosis(t: ServiceTicket): void {
    this.diagnosisTargetId = t.id;
    this.diagnosisForm.reset({
      diagnosis: t.diagnosis || '',
      estimated_price: t.estimated_price ? parseFloat(t.estimated_price) : 0,
    });
    this.diagnosisOpen.set(true);
  }

  saveDiagnosis(): void {
    if (!this.diagnosisTargetId || this.diagnosisForm.invalid) return;
    const v = this.diagnosisForm.getRawValue();
    this.svc
      .submitDiagnosis(this.diagnosisTargetId, v.diagnosis!, Number(v.estimated_price))
      .subscribe({
        next: (t) => {
          this.diagnosisOpen.set(false);
          this.detail.set(t);
          this.reload();
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 3000,
          }),
      });
  }

  doApprove(t: ServiceTicket): void {
    this.svc.approveQuote(t.id).subscribe({
      next: (updated) => {
        this.detail.set(updated);
        this.reload();
      },
    });
  }

  doTransition(t: ServiceTicket, status: ServiceTicketStatus): void {
    this.svc.transition(t.id, status).subscribe({
      next: (updated) => {
        this.detail.set(updated);
        this.reload();
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 3000,
        }),
    });
  }

  openDeliver(t: ServiceTicket): void {
    this.deliverTargetId = t.id;
    this.deliverForm.reset({
      final_price: t.final_price ? parseFloat(t.final_price) : t.estimated_price ? parseFloat(t.estimated_price) : 0,
      payment_method: 'cash',
    });
    this.deliverOpen.set(true);
  }

  saveDeliver(): void {
    if (!this.deliverTargetId || this.deliverForm.invalid) return;
    const v = this.deliverForm.getRawValue();
    this.svc.deliver(this.deliverTargetId, Number(v.final_price), v.payment_method!).subscribe({
      next: (updated) => {
        this.deliverOpen.set(false);
        this.detail.set(updated);
        this.reload();
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 3000,
        }),
    });
  }

  reprint(t: ServiceTicket): void {
    this.svc.printIntake(t.id).subscribe({
      next: () =>
        this.snack.open(this.translate.instant('service.printQueued'), 'OK', { duration: 2000 }),
    });
  }
}
