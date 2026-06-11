import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService } from '../../shared/crud.service';
import { DateFieldComponent } from '../../shared/date-field.component';
import { DateTimeFieldComponent } from '../../shared/date-time-field.component';
import { normalizeDateInput, normalizeDateTimeInput } from '../../shared/date-utils';

type EditMode = 'invoice' | 'payment' | 'medical' | null;

@Component({
  selector: 'app-patient-records-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslateModule,
    DateFieldComponent,
    DateTimeFieldComponent,
  ],
  template: `
    <div class="records-tab patient-readonly-form records-tab--cards">
      @if (showBilling()) {
      <section class="dialog__section">
        <div class="records-tab__toolbar">
          <h3 class="dialog__section-title">{{ 'patients.sectionInvoices' | translate }}</h3>
          @if (canWriteBilling()) {
          <button mat-stroked-button type="button" (click)="openInvoiceForm()">
            <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
          </button>
          }
        </div>
        @if (loadedInvoices()) {
        @if (invoices().length) {
        <div class="record-card-list">
          @for (inv of invoices(); track inv.id) {
          <mat-card class="record-card">
            <mat-card-header>
              <mat-icon mat-card-avatar class="record-card__avatar record-card__avatar--invoice">receipt_long</mat-icon>
              <mat-card-title>{{ inv.number }}</mat-card-title>
              <mat-card-subtitle>{{ inv.issued_at }}</mat-card-subtitle>
              <mat-chip-set class="record-card__chips">
                <mat-chip>{{ ('billing.' + inv.status) | translate }}</mat-chip>
              </mat-chip-set>
            </mat-card-header>
            <mat-card-content>
              <div class="dialog__row">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'billing.dueDate' | translate }}</mat-label>
                  <input matInput readonly [value]="inv.due_date || '—'" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'billing.total' | translate }}</mat-label>
                  <input matInput readonly [value]="inv.total" />
                </mat-form-field>
              </div>
              @if (inv.lines?.length) {
              <h4 class="record-card__lines-title">{{ 'billing.invoiceLines' | translate }}</h4>
              <table class="bms-table">
                <thead>
                  <tr>
                    <th>{{ 'billing.amount' | translate }}</th>
                    <th>{{ 'inventory.quantity' | translate }}</th>
                    <th>{{ 'billing.total' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of inv.lines; track line.id) {
                  <tr>
                    <td>{{ line.unit_price }}</td>
                    <td>{{ line.quantity }}</td>
                    <td>{{ line.line_total }}</td>
                  </tr>
                  }
                </tbody>
              </table>
              }
            </mat-card-content>
            @if (canWriteBilling()) {
            <mat-card-actions align="end">
              <button mat-button type="button" (click)="openInvoiceForm(inv)">
                <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
              </button>
              <button mat-button type="button" color="warn" (click)="removeInvoice(inv)">
                <mat-icon>delete</mat-icon> {{ 'common.delete' | translate }}
              </button>
            </mat-card-actions>
            }
          </mat-card>
          }
        </div>
        } @else {
        <p class="muted">{{ 'common.noRecords' | translate }}</p>
        }
        } @else {
        <p class="muted">{{ 'common.loading' | translate }}</p>
        }
      </section>

      <section class="dialog__section">
        <div class="records-tab__toolbar">
          <h3 class="dialog__section-title">{{ 'patients.sectionPayments' | translate }}</h3>
          @if (canWriteBilling()) {
          <button mat-stroked-button type="button" (click)="openPaymentForm()" [disabled]="!invoices().length">
            <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
          </button>
          }
        </div>
        @if (loadedPayments()) {
        @if (payments().length) {
        <div class="record-card-list">
          @for (pay of payments(); track pay.id) {
          <mat-card class="record-card">
            <mat-card-header>
              <mat-icon mat-card-avatar class="record-card__avatar record-card__avatar--payment">payments</mat-icon>
              <mat-card-title>{{ pay.invoice_number || pay.invoice }}</mat-card-title>
              <mat-card-subtitle>{{ pay.paid_at | date: 'medium' }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="dialog__row">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'billing.amount' | translate }}</mat-label>
                  <input matInput readonly [value]="pay.amount" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'billing.method' | translate }}</mat-label>
                  <input matInput readonly [value]="pay.method" />
                </mat-form-field>
              </div>
            </mat-card-content>
            @if (canWriteBilling()) {
            <mat-card-actions align="end">
              <button mat-button type="button" (click)="openPaymentForm(pay)">
                <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
              </button>
              <button mat-button type="button" color="warn" (click)="removePayment(pay)">
                <mat-icon>delete</mat-icon> {{ 'common.delete' | translate }}
              </button>
            </mat-card-actions>
            }
          </mat-card>
          }
        </div>
        } @else {
        <p class="muted">{{ 'common.noRecords' | translate }}</p>
        }
        } @else if (loadedInvoices()) {
        <p class="muted">{{ 'common.loading' | translate }}</p>
        }
      </section>
      }

      @if (showMedicalRecords()) {
      <section class="dialog__section">
        <div class="records-tab__toolbar">
          <h3 class="dialog__section-title">{{ 'patients.sectionMedicalRecords' | translate }}</h3>
          @if (canWriteMedical()) {
          <button mat-stroked-button type="button" (click)="openMedicalForm()">
            <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
          </button>
          }
        </div>
        @if (loadedMedical()) {
        @if (medicalRecords().length) {
        <div class="record-card-list">
          @for (r of medicalRecords(); track r.id) {
          <mat-card class="record-card">
            <mat-card-header>
              <mat-icon mat-card-avatar class="record-card__avatar record-card__avatar--medical">description</mat-icon>
              <mat-card-title>{{ 'customers.medicalRecords' | translate }}</mat-card-title>
              <mat-card-subtitle>{{ r.updated_at | date: 'medium' }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'customers.summary' | translate }}</mat-label>
                <textarea matInput rows="4" readonly>{{ r.summary || '—' }}</textarea>
              </mat-form-field>
            </mat-card-content>
            @if (canWriteMedical()) {
            <mat-card-actions align="end">
              <button mat-button type="button" (click)="openMedicalForm(r)">
                <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
              </button>
              <button mat-button type="button" color="warn" (click)="removeMedical(r)">
                <mat-icon>delete</mat-icon> {{ 'common.delete' | translate }}
              </button>
            </mat-card-actions>
            }
          </mat-card>
          }
        </div>
        } @else {
        <p class="muted">{{ 'common.noRecords' | translate }}</p>
        }
        } @else {
        <p class="muted">{{ 'common.loading' | translate }}</p>
        }
      </section>
      }

      @if (showAccounting()) {
      <mat-card style="margin-bottom:16px">
        <mat-card-header>
          <mat-card-title>{{ 'patients.sectionAccounting' | translate }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="muted">{{ 'patients.accountingComingSoon' | translate }}</p>
        </mat-card-content>
      </mat-card>
      }

      @if (!showBilling() && !showMedicalRecords() && !showAccounting()) {
      <p class="muted">{{ 'patients.noRecordsModules' | translate }}</p>
      }
    </div>

    @if (editMode()) {
    <div class="overlay" (click)="closeForm()"></div>
    <div class="dialog" (click)="$event.stopPropagation()">
      @if (editMode() === 'invoice') {
      <h2>{{ (invoiceForm.value.id ? 'common.edit' : 'common.new') | translate }} — {{ 'billing.invoices' | translate }}</h2>
      <form [formGroup]="invoiceForm" (ngSubmit)="saveInvoice()" style="display:flex;flex-direction:column;gap:8px">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'billing.number' | translate }}</mat-label>
          <input matInput formControlName="number" />
        </mat-form-field>
        <app-date-field formControlName="issued_at" labelKey="billing.issuedAt" [required]="true" />
        <app-date-field formControlName="due_date" labelKey="billing.dueDate" />
        <mat-form-field appearance="outline">
          <mat-label>{{ 'appointments.status' | translate }}</mat-label>
          <mat-select formControlName="status">
            <mat-option value="draft">{{ 'billing.draft' | translate }}</mat-option>
            <mat-option value="sent">{{ 'billing.sent' | translate }}</mat-option>
            <mat-option value="paid">{{ 'billing.paid' | translate }}</mat-option>
            <mat-option value="overdue">{{ 'billing.overdue' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button mat-button type="button" (click)="closeForm()">{{ 'common.cancel' | translate }}</button>
          <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
        </div>
      </form>
      } @else if (editMode() === 'payment') {
      <h2>{{ (paymentForm.value.id ? 'common.edit' : 'common.new') | translate }} — {{ 'billing.payments' | translate }}</h2>
      <form [formGroup]="paymentForm" (ngSubmit)="savePayment()" style="display:flex;flex-direction:column;gap:8px">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'billing.invoice' | translate }}</mat-label>
          <mat-select formControlName="invoice">
            @for (i of invoices(); track i.id) {
            <mat-option [value]="i.id">{{ i.number }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'billing.amount' | translate }}</mat-label>
          <input matInput type="number" step="0.01" formControlName="amount" />
        </mat-form-field>
        <app-date-time-field formControlName="paid_at" labelKey="billing.paidAt" [required]="true" />
        <mat-form-field appearance="outline">
          <mat-label>{{ 'billing.method' | translate }}</mat-label>
          <input matInput formControlName="method" />
        </mat-form-field>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button mat-button type="button" (click)="closeForm()">{{ 'common.cancel' | translate }}</button>
          <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
        </div>
      </form>
      } @else if (editMode() === 'medical') {
      <h2>{{ (medicalForm.value.id ? 'common.edit' : 'customers.newMedicalRecord') | translate }}</h2>
      <form [formGroup]="medicalForm" (ngSubmit)="saveMedical()" style="display:flex;flex-direction:column;gap:8px">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'customers.summary' | translate }}</mat-label>
          <textarea matInput rows="5" formControlName="summary"></textarea>
        </mat-form-field>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button mat-button type="button" (click)="closeForm()">{{ 'common.cancel' | translate }}</button>
          <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
        </div>
      </form>
      }
    </div>
    }
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .records-tab--cards {
        background: #fff;
        border-radius: 12px;
        padding: 8px 20px 16px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.06);
      }
      .records-tab--cards {
        background: #fff;
        border-radius: 12px;
        padding: 8px 20px 16px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.06);
      }
      .records-tab__section { margin-bottom: 24px; }
      .muted { opacity: 0.7; font-size: 14px; }
      .full-width { width: 100%; }
      .record-card-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .record-card {
        border-radius: 12px !important;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) !important;
      }
      .record-card mat-card-content mat-form-field { width: 100%; }
      .record-card input[readonly],
      .record-card textarea[readonly] { cursor: default; }
      .record-card__avatar {
        display: flex !important;
        align-items: center;
        justify-content: center;
        border-radius: 50% !important;
        color: #fff;
        width: 40px !important;
        height: 40px !important;
        font-size: 22px;
      }
      .record-card__avatar--invoice { background: #5c6bc0; }
      .record-card__avatar--payment { background: #00897b; }
      .record-card__avatar--medical { background: #8d6e63; }
      .record-card__chips { margin-left: auto; }
      .record-card__lines-title {
        margin: 12px 0 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.65;
      }
    `,
  ],
})
export class PatientRecordsTabComponent implements OnInit {
  @Input({ required: true }) patientId!: number;

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  private auth = inject(AuthService);
  private invoiceCrud = new CrudService<any>(this.http, 'billing/invoices', this.auth, 'billing');
  private paymentCrud = new CrudService<any>(this.http, 'billing/payments', this.auth, 'billing');
  private recordCrud = new CrudService<any>(this.http, 'medical-records', this.auth, 'patients');

  invoices = signal<any[]>([]);
  payments = signal<any[]>([]);
  medicalRecords = signal<any[]>([]);
  loadedInvoices = signal(false);
  loadedPayments = signal(false);
  loadedMedical = signal(false);
  editMode = signal<EditMode>(null);

  invoiceForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    number: ['', Validators.required],
    issued_at: ['', Validators.required],
    due_date: [''],
    status: ['draft'],
  });

  paymentForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    invoice: this.fb.control<number | null>(null, Validators.required),
    amount: ['0', Validators.required],
    paid_at: ['', Validators.required],
    method: ['cash'],
  });

  medicalForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    summary: [''],
  });

  ngOnInit(): void {
    if (this.showBilling()) this.reloadInvoices();
    if (this.showMedicalRecords()) this.reloadMedical();
  }

  showBilling = () => this.auth.hasModule('billing') && this.auth.hasPermission('billing.read');
  showMedicalRecords = () =>
    this.auth.hasModule('patients') && this.auth.hasPermission('patients.read');
  showAccounting = () =>
    this.auth.hasModule('accounting') && this.auth.hasPermission('accounting.read');
  canWriteBilling = () => this.auth.hasPermission('billing.write');
  canWriteMedical = () => this.auth.hasPermission('patients.write');

  reloadInvoices(): void {
    this.invoiceCrud
      .list({ limit: 100, extra: { customer: this.patientId } })
      .subscribe((page) => {
        this.invoices.set(page.results);
        this.loadedInvoices.set(true);
        this.loadPayments(page.results);
      });
  }

  reloadMedical(): void {
    this.recordCrud
      .list({ limit: 100, extra: { patient: this.patientId } })
      .subscribe((page) => {
        this.medicalRecords.set(page.results);
        this.loadedMedical.set(true);
      });
  }

  openInvoiceForm(inv?: any): void {
    this.invoiceForm.reset(
      inv
        ? {
            id: inv.id,
            number: inv.number,
            issued_at: normalizeDateInput(inv.issued_at),
            due_date: normalizeDateInput(inv.due_date),
            status: inv.status,
          }
        : { id: null, number: '', issued_at: '', due_date: '', status: 'draft' }
    );
    this.editMode.set('invoice');
  }

  openPaymentForm(pay?: any): void {
    this.paymentForm.reset(
      pay
        ? {
            id: pay.id,
            invoice: pay.invoice,
            amount: pay.amount,
            paid_at: normalizeDateTimeInput(pay.paid_at),
            method: pay.method,
          }
        : {
            id: null,
            invoice: this.invoices()[0]?.id ?? null,
            amount: '0',
            paid_at: '',
            method: 'cash',
          }
    );
    this.editMode.set('payment');
  }

  openMedicalForm(r?: any): void {
    this.medicalForm.reset(
      r ? { id: r.id, summary: r.summary } : { id: null, summary: '' }
    );
    this.editMode.set('medical');
  }

  closeForm(): void {
    this.editMode.set(null);
  }

  saveInvoice(): void {
    if (this.invoiceForm.invalid) return;
    const v = this.invoiceForm.getRawValue();
    const payload: Record<string, unknown> = {
      number: v.number,
      customer: this.patientId,
      issued_at: v.issued_at,
      status: v.status,
    };
    if (v.due_date) payload['due_date'] = v.due_date;
    const op = v.id
      ? this.invoiceCrud.update(v.id!, payload)
      : this.invoiceCrud.create(payload);
    op.subscribe({
      next: () => {
        this.closeForm();
        this.reloadInvoices();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 2500,
        }),
    });
  }

  savePayment(): void {
    if (this.paymentForm.invalid) return;
    const v = this.paymentForm.getRawValue();
    const payload = {
      invoice: v.invoice,
      amount: v.amount,
      paid_at: new Date(v.paid_at!).toISOString(),
      method: v.method,
    };
    const op = v.id
      ? this.paymentCrud.update(v.id!, payload)
      : this.paymentCrud.create(payload);
    op.subscribe({
      next: () => {
        this.closeForm();
        this.reloadInvoices();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 2500,
        }),
    });
  }

  saveMedical(): void {
    if (this.medicalForm.invalid) return;
    const v = this.medicalForm.getRawValue();
    const payload = { patient: this.patientId, summary: v.summary };
    const op = v.id
      ? this.recordCrud.update(v.id!, payload)
      : this.recordCrud.create(payload);
    op.subscribe({
      next: () => {
        this.closeForm();
        this.reloadMedical();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 2500,
        }),
    });
  }

  removeInvoice(inv: any): void {
    this.confirmDialog.confirmDelete(inv.number).then((ok) => {
      if (!ok) return;
      this.invoiceCrud.remove(inv.id).subscribe({
        next: () => {
          this.reloadInvoices();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 2500,
          }),
      });
    });
  }

  removePayment(pay: any): void {
    this.confirmDialog.confirmDelete().then((ok) => {
      if (!ok) return;
      this.paymentCrud.remove(pay.id).subscribe({
        next: () => {
          this.reloadInvoices();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 2500,
          }),
      });
    });
  }

  removeMedical(r: any): void {
    this.confirmDialog.confirmDelete().then((ok) => {
      if (!ok) return;
      this.recordCrud.remove(r.id).subscribe({
        next: () => {
          this.reloadMedical();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 2500,
          }),
      });
    });
  }

  private loadPayments(invoices: any[]): void {
    if (!invoices.length) {
      this.payments.set([]);
      this.loadedPayments.set(true);
      return;
    }
    const invoiceMap = new Map(invoices.map((i) => [i.id, i.number]));
    let pending = invoices.length;
    const all: any[] = [];
    for (const inv of invoices) {
      this.paymentCrud.list({ limit: 50, extra: { invoice: inv.id } }).subscribe((page) => {
        for (const p of page.results) {
          all.push({ ...p, invoice_number: invoiceMap.get(p.invoice) });
        }
        pending -= 1;
        if (pending === 0) {
          all.sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)));
          this.payments.set(all);
          this.loadedPayments.set(true);
        }
      });
    }
  }
}
