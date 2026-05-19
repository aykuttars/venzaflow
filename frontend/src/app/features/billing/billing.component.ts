import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { CrudService } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { DateFieldComponent } from '../../shared/date-field.component';
import { DateTimeFieldComponent } from '../../shared/date-time-field.component';
import { normalizeDateInput, normalizeDateTimeInput } from '../../shared/date-utils';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    TranslateModule,
    PageHeaderComponent,
    DateFieldComponent,
    DateTimeFieldComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="billing" icon="receipt_long">
        @if (canWrite()) { <button mat-flat-button color="primary" (click)="onAdd()"><mat-icon>add</mat-icon> {{ 'common.new' | translate }}</button> }
      </app-page-header>
      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab [label]="'billing.invoices' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'billing.number' | translate }}</th><th>{{ 'appointments.customer' | translate }}</th><th>{{ 'billing.issuedAt' | translate }}</th><th>{{ 'appointments.status' | translate }}</th><th>{{ 'billing.total' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (i of invoices(); track i.id) {
              <tr>
                <td>{{ i.number }}</td><td>{{ i.customer_name }}</td><td>{{ i.issued_at }}</td><td>{{ ('billing.' + i.status) | translate }}</td><td>{{ i.total }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openInvoice(i)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeInvoice(i)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'billing.payments' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'billing.invoice' | translate }}</th><th>{{ 'billing.amount' | translate }}</th><th>{{ 'billing.paidAt' | translate }}</th><th>{{ 'billing.method' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (p of payments(); track p.id) {
              <tr>
                <td>{{ p.invoice_number }}</td><td>{{ p.amount }}</td><td>{{ p.paid_at }}</td><td>{{ p.method }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openPayment(p)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removePayment(p)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
      </mat-tab-group>

      @if (editing()) {
      <div class="overlay" (click)="editing.set(false)"></div>
      <div class="dialog">
        <form [formGroup]="activeForm" (ngSubmit)="save()" style="display:flex;flex-direction:column;gap:8px">
          @if (tab() === 0) {
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.number' | translate }}</mat-label><input matInput formControlName="number" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'appointments.customer' | translate }}</mat-label>
              <mat-select formControlName="customer">@for (c of customers(); track c.id) {<mat-option [value]="c.id">{{ c.first_name }}</mat-option>}</mat-select>
            </mat-form-field>
            <app-date-field formControlName="issued_at" labelKey="billing.issuedAt" [required]="true" />
            <app-date-field formControlName="due_date" labelKey="billing.dueDate" />
            <mat-form-field appearance="outline"><mat-label>{{ 'appointments.status' | translate }}</mat-label>
              <mat-select formControlName="status">
                <mat-option value="draft">{{ 'billing.draft' | translate }}</mat-option><mat-option value="sent">{{ 'billing.sent' | translate }}</mat-option>
                <mat-option value="paid">{{ 'billing.paid' | translate }}</mat-option><mat-option value="overdue">{{ 'billing.overdue' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.invoice' | translate }}</mat-label>
              <mat-select formControlName="invoice">@for (i of invoices(); track i.id) {<mat-option [value]="i.id">{{ i.number }}</mat-option>}</mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.amount' | translate }}</mat-label><input matInput type="number" step="0.01" formControlName="amount" /></mat-form-field>
            <app-date-time-field formControlName="paid_at" labelKey="billing.paidAt" [required]="true" />
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.method' | translate }}</mat-label><input matInput formControlName="method" /></mat-form-field>
          }
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="editing.set(false)">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [CRUD_DIALOG_STYLES],
})
export class BillingComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);
  tab = signal(0);
  editing = signal(false);
  invoices = signal<any[]>([]);
  payments = signal<any[]>([]);
  customers = signal<any[]>([]);
  private invCrud = new CrudService<any>(this.http, 'billing/invoices');
  private payCrud = new CrudService<any>(this.http, 'billing/payments');
  private custCrud = new CrudService<any>(this.http, 'customers');

  invoiceForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    number: ['', Validators.required],
    customer: this.fb.control<number | null>(null, Validators.required),
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

  get activeForm() {
    return this.tab() === 0 ? this.invoiceForm : this.paymentForm;
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.invCrud.list({ limit: 200 }).subscribe((p) => this.invoices.set(p.results));
    this.payCrud.list({ limit: 200 }).subscribe((p) => this.payments.set(p.results));
    this.custCrud.list({ limit: 200 }).subscribe((p) => this.customers.set(p.results));
  }

  canWrite = () => this.auth.hasPermission('billing.write');
  onAdd = () => (this.tab() === 0 ? this.openInvoice() : this.openPayment());

  openInvoice(i?: any): void {
    this.tab.set(0);
    this.invoiceForm.reset(
      i
        ? {
            id: i.id,
            number: i.number,
            customer: i.customer,
            issued_at: normalizeDateInput(i.issued_at),
            due_date: normalizeDateInput(i.due_date),
            status: i.status,
          }
        : { id: null, number: '', customer: null, issued_at: '', due_date: '', status: 'draft' }
    );
    this.editing.set(true);
  }

  openPayment(p?: any): void {
    this.tab.set(1);
    this.paymentForm.reset(
      p
        ? {
            id: p.id,
            invoice: p.invoice,
            amount: p.amount,
            paid_at: normalizeDateTimeInput(p.paid_at),
            method: p.method,
          }
        : { id: null, invoice: null, amount: '0', paid_at: '', method: 'cash' }
    );
    this.editing.set(true);
  }

  save(): void {
    if (this.tab() === 0) {
      if (this.invoiceForm.invalid) return;
      const v = this.invoiceForm.getRawValue();
      const payload: any = { number: v.number, customer: v.customer, issued_at: v.issued_at, status: v.status };
      if (v.due_date) payload.due_date = v.due_date;
      const op = v.id ? this.invCrud.update(v.id!, payload) : this.invCrud.create(payload);
      op.subscribe({
        next: () => {
          this.editing.set(false);
          this.reload();
          this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    } else {
      if (this.paymentForm.invalid) return;
      const v = this.paymentForm.getRawValue();
      const payload = { invoice: v.invoice, amount: v.amount, paid_at: new Date(v.paid_at!).toISOString(), method: v.method };
      const op = v.id ? this.payCrud.update(v.id!, payload) : this.payCrud.create(payload);
      op.subscribe({
        next: () => {
          this.editing.set(false);
          this.reload();
          this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    }
  }

  removeInvoice(i: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${i.number})`)) return;
    this.invCrud.remove(i.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  removePayment(p: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.payCrud.remove(p.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
}
