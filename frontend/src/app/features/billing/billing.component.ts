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
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService } from '../../shared/crud.service';
import { PartyListService } from '../../shared/party-list.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { DateFieldComponent } from '../../shared/date-field.component';
import { DateTimeFieldComponent } from '../../shared/date-time-field.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { RouterLink } from '@angular/router';
import { TenantInvoice } from '../../core/oral.service';
import { normalizeDateInput, normalizeDateTimeInput } from '../../shared/date-utils';
import { openDocumentPreview } from '../../shared/document-preview-dialog.component';

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
    MatCheckboxModule,
    RouterLink,
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
                  <button mat-icon-button (click)="openInvoicePreview(i)" [attr.aria-label]="'documentPreview.button' | translate"><mat-icon>visibility</mat-icon></button>
                  <button mat-icon-button (click)="viewInvoice(i)" [attr.aria-label]="'billing.viewDetail' | translate"><mat-icon>receipt_long</mat-icon></button>
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
              <mat-select formControlName="customer" [disabled]="!hasPartyModule()">
                @for (c of parties(); track c.id) {<mat-option [value]="c.id">{{ c.first_name }}</mat-option>}
              </mat-select>
              @if (!hasPartyModule()) {
              <mat-hint>{{ 'billing.partyModuleRequired' | translate }}</mat-hint>
              }
            </mat-form-field>
            <app-date-field formControlName="issued_at" labelKey="billing.issuedAt" [required]="true" />
            <app-date-field formControlName="due_date" labelKey="billing.dueDate" />
            <mat-form-field appearance="outline"><mat-label>{{ 'appointments.status' | translate }}</mat-label>
              <mat-select formControlName="status">
                <mat-option value="draft">{{ 'billing.draft' | translate }}</mat-option><mat-option value="sent">{{ 'billing.sent' | translate }}</mat-option>
                <mat-option value="paid">{{ 'billing.paid' | translate }}</mat-option><mat-option value="overdue">{{ 'billing.overdue' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.discountPercent' | translate }}</mat-label>
              <input matInput type="number" min="0" max="100" step="0.01" formControlName="discount_percent" />
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.eDocumentType' | translate }}</mat-label>
              <mat-select formControlName="e_document_type">
                <mat-option value="auto">{{ 'oral.eDocAuto' | translate }}</mat-option>
                <mat-option value="earsiv">{{ 'signing.docType.earsiv' | translate }}</mat-option>
                <mat-option value="efatura">{{ 'signing.docType.efatura' | translate }}</mat-option>
                <mat-option value="none">{{ 'oral.eDocNone' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'customers.summary' | translate }}</mat-label>
              <textarea matInput rows="2" formControlName="notes"></textarea>
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

      @if (viewingInvoice()) {
      <div class="overlay" (click)="viewingInvoice.set(null)"></div>
      <div class="dialog" style="max-width:640px">
        <h2>{{ viewingInvoice()!.number }}</h2>
        <p>{{ viewingInvoice()!.customer_name }} · {{ viewingInvoice()!.issued_at }}</p>
        <table class="bms-table">
          <thead><tr><th>{{ 'billing.invoiceLines' | translate }}</th><th>{{ 'billing.amount' | translate }}</th></tr></thead>
          <tbody>
            @for (ln of viewingInvoice()!.lines || []; track ln.id) {
            <tr>
              <td>{{ ln.description || ln.product_name }}</td>
              <td>{{ ln.line_total }} ₺</td>
            </tr>
            }
          </tbody>
        </table>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px">
          <span>{{ 'billing.subtotalBeforeDiscount' | translate }}: {{ viewingInvoice()!.subtotal_before_discount }} ₺</span>
          <span>{{ 'billing.discountApplied' | translate }} ({{ viewingInvoice()!.discount_percent }}%): -{{ viewingInvoice()!.discount_amount }} ₺</span>
          <strong>{{ 'billing.total' | translate }}: {{ viewingInvoice()!.total }} ₺</strong>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button mat-button type="button" (click)="viewingInvoice.set(null)">{{ 'common.close' | translate }}</button>
          @if (canWrite() && showSigningLink(viewingInvoice()!)) {
          <a mat-stroked-button routerLink="/signing" [queryParams]="signingQuery(viewingInvoice()!)">
            {{ 'billing.queueSigning' | translate }}
          </a>
          }
        </div>
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
  private confirmDialog = inject(ConfirmDialogService);
  private dialog = inject(MatDialog);
  protected auth = inject(AuthService);
  private partiesApi = inject(PartyListService);
  tab = signal(0);
  editing = signal(false);
  viewingInvoice = signal<TenantInvoice | null>(null);
  invoices = signal<any[]>([]);
  payments = signal<any[]>([]);
  parties = signal<any[]>([]);
  private invCrud = new CrudService<any>(this.http, 'billing/invoices', this.auth, 'billing');
  private payCrud = new CrudService<any>(this.http, 'billing/payments', this.auth, 'billing');

  invoiceForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    number: ['', Validators.required],
    customer: this.fb.control<number | null>(null, Validators.required),
    issued_at: ['', Validators.required],
    due_date: [''],
    status: ['draft'],
    discount_percent: ['0'],
    e_document_type: ['auto'],
    notes: [''],
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
    if (this.partiesApi.hasAnyPartyModule()) {
      this.partiesApi.listParties(200).subscribe((rows) => this.parties.set(rows));
    } else {
      this.parties.set([]);
    }
  }

  hasPartyModule = () => this.partiesApi.hasAnyPartyModule();
  canWrite = () => this.auth.hasPermission('billing.write');
  onAdd = () => (this.tab() === 0 ? this.openInvoice() : this.openPayment());

  openInvoice(i?: any): void {
    this.tab.set(0);
    if (i?.id) {
      this.invCrud.get(i.id).subscribe({
        next: (full) => this.patchInvoiceForm(full),
        error: () => this.patchInvoiceForm(i),
      });
    } else {
      this.patchInvoiceForm(null);
    }
    this.editing.set(true);
  }

  private patchInvoiceForm(i: any | null): void {
    this.invoiceForm.reset(
      i
        ? {
            id: i.id,
            number: i.number,
            customer: i.customer,
            issued_at: normalizeDateInput(i.issued_at),
            due_date: normalizeDateInput(i.due_date),
            status: i.status,
            discount_percent: i.discount_percent ?? '0',
            e_document_type: i.e_document_type ?? 'auto',
            notes: i.notes ?? '',
          }
        : {
            id: null,
            number: '',
            customer: null,
            issued_at: '',
            due_date: '',
            status: 'draft',
            discount_percent: '0',
            e_document_type: 'auto',
            notes: '',
          }
    );
  }

  viewInvoice(i: any): void {
    this.invCrud.get(i.id).subscribe({
      next: (full) => this.viewingInvoice.set(full as TenantInvoice),
      error: () => this.snack.open(this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  signingQuery(inv: TenantInvoice): Record<string, string> {
    const doc = inv.resolved_e_document_type === 'efatura' ? 'efatura' : 'earsiv';
    return { document_type: doc };
  }

  showSigningLink(inv: TenantInvoice): boolean {
    return inv.resolved_e_document_type !== 'none';
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
      const payload: any = {
        number: v.number,
        customer: v.customer,
        issued_at: v.issued_at,
        status: v.status,
        discount_percent: v.discount_percent || '0',
        e_document_type: v.e_document_type || 'auto',
        notes: v.notes || '',
      };
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

  openInvoicePreview(invoice: { id: number; number: string; e_document_type?: string }): void {
    const docType =
      invoice.e_document_type === 'earsiv' || invoice.e_document_type === 'efatura'
        ? invoice.e_document_type
        : 'efatura';
    openDocumentPreview(this.dialog, {
      title: invoice.number,
      path: `billing/invoices/${invoice.id}/preview/`,
      queryParams: { document_type: docType },
    });
  }

  removeInvoice(i: any): void {
    this.confirmDialog.confirmDelete(i.number).then((ok) => {
      if (!ok) return;
      this.invCrud.remove(i.id).subscribe({
        next: () => {
          this.reload();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    });
  }

  removePayment(p: any): void {
    this.confirmDialog.confirmDelete().then((ok) => {
      if (!ok) return;
      this.payCrud.remove(p.id).subscribe({
        next: () => {
          this.reload();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    });
  }
}
