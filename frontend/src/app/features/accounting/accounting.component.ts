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
  selector: 'app-accounting',
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
      <app-page-header moduleSlug="accounting" icon="savings">
        @if (canWrite()) { <button mat-flat-button color="primary" (click)="onAdd()"><mat-icon>add</mat-icon> {{ 'common.new' | translate }}</button> }
      </app-page-header>
      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab [label]="'accounting.accounts' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'accounting.code' | translate }}</th><th>{{ 'customers.name' | translate }}</th><th>{{ 'accounting.kind' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (a of accounts(); track a.id) {
              <tr>
                <td>{{ a.code }}</td><td>{{ a.name }}</td><td>{{ ('accounting.' + a.kind) | translate }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openAccount(a)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeAccount(a)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'accounting.expenses' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'accounting.code' | translate }}</th><th>{{ 'accounting.description' | translate }}</th><th>{{ 'billing.amount' | translate }}</th><th>{{ 'accounting.incurredOn' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (e of expenses(); track e.id) {
              <tr>
                <td>{{ e.account_code }}</td><td>{{ e.description }}</td><td>{{ e.amount }}</td><td>{{ e.incurred_on }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openExpense(e)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeExpense(e)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'accounting.transactions' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'accounting.kind' | translate }}</th><th>{{ 'billing.amount' | translate }}</th><th>{{ 'accounting.description' | translate }}</th><th>{{ 'accounting.occurredAt' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (t of transactions(); track t.id) {
              <tr>
                <td>{{ ('accounting.' + t.kind) | translate }}</td><td>{{ t.amount }}</td><td>{{ t.description }}</td><td>{{ t.occurred_at }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openTransaction(t)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeTransaction(t)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
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
            <mat-form-field appearance="outline"><mat-label>{{ 'accounting.code' | translate }}</mat-label><input matInput formControlName="code" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'customers.name' | translate }}</mat-label><input matInput formControlName="name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'accounting.kind' | translate }}</mat-label>
              <mat-select formControlName="kind">
                <mat-option value="asset">{{ 'accounting.asset' | translate }}</mat-option><mat-option value="liability">{{ 'accounting.liability' | translate }}</mat-option>
                <mat-option value="equity">{{ 'accounting.equity' | translate }}</mat-option><mat-option value="revenue">{{ 'accounting.revenue' | translate }}</mat-option>
                <mat-option value="expense">{{ 'accounting.expense' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
          } @else if (tab() === 1) {
            <mat-form-field appearance="outline"><mat-label>{{ 'accounting.accounts' | translate }}</mat-label>
              <mat-select formControlName="account">@for (a of accounts(); track a.id) {<mat-option [value]="a.id">{{ a.code }}</mat-option>}</mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'accounting.description' | translate }}</mat-label><input matInput formControlName="description" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.amount' | translate }}</mat-label><input matInput type="number" step="0.01" formControlName="amount" /></mat-form-field>
            <app-date-field formControlName="incurred_on" labelKey="accounting.incurredOn" [required]="true" />
          } @else {
            <mat-form-field appearance="outline"><mat-label>{{ 'accounting.kind' | translate }}</mat-label>
              <mat-select formControlName="kind">
                <mat-option value="income">{{ 'accounting.income' | translate }}</mat-option><mat-option value="expense">{{ 'accounting.expense' | translate }}</mat-option>
                <mat-option value="adjustment">{{ 'accounting.adjustment' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'billing.amount' | translate }}</mat-label><input matInput type="number" step="0.01" formControlName="amount" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'accounting.description' | translate }}</mat-label><input matInput formControlName="description" /></mat-form-field>
            <app-date-time-field formControlName="occurred_at" labelKey="accounting.occurredAt" [required]="true" />
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
export class AccountingComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);
  tab = signal(0);
  editing = signal(false);
  accounts = signal<any[]>([]);
  expenses = signal<any[]>([]);
  transactions = signal<any[]>([]);
  private accCrud = new CrudService<any>(this.http, 'accounting/accounts', this.auth, 'accounting');
  private expCrud = new CrudService<any>(this.http, 'accounting/expenses', this.auth, 'accounting');
  private txCrud = new CrudService<any>(this.http, 'accounting/transactions', this.auth, 'accounting');

  accountForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    code: ['', Validators.required],
    name: ['', Validators.required],
    kind: ['asset', Validators.required],
  });
  expenseForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    account: this.fb.control<number | null>(null),
    description: ['', Validators.required],
    amount: ['0', Validators.required],
    incurred_on: ['', Validators.required],
  });
  transactionForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    kind: ['income', Validators.required],
    amount: ['0', Validators.required],
    description: [''],
    occurred_at: ['', Validators.required],
  });

  get activeForm() {
    if (this.tab() === 0) return this.accountForm;
    if (this.tab() === 1) return this.expenseForm;
    return this.transactionForm;
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.accCrud.list({ limit: 200 }).subscribe((p) => this.accounts.set(p.results));
    this.expCrud.list({ limit: 200 }).subscribe((p) => this.expenses.set(p.results));
    this.txCrud.list({ limit: 200 }).subscribe((p) => this.transactions.set(p.results));
  }

  canWrite = () => this.auth.hasPermission('accounting.write');
  onAdd = () => {
    if (this.tab() === 0) this.openAccount();
    else if (this.tab() === 1) this.openExpense();
    else this.openTransaction();
  };

  openAccount(a?: any): void {
    this.tab.set(0);
    this.accountForm.reset(a ? { id: a.id, code: a.code, name: a.name, kind: a.kind } : { id: null, code: '', name: '', kind: 'asset' });
    this.editing.set(true);
  }
  openExpense(e?: any): void {
    this.tab.set(1);
    this.expenseForm.reset(
      e
        ? {
            id: e.id,
            account: e.account,
            description: e.description,
            amount: e.amount,
            incurred_on: normalizeDateInput(e.incurred_on),
          }
        : { id: null, account: null, description: '', amount: '0', incurred_on: '' }
    );
    this.editing.set(true);
  }
  openTransaction(t?: any): void {
    this.tab.set(2);
    this.transactionForm.reset(
      t
        ? {
            id: t.id,
            kind: t.kind,
            amount: t.amount,
            description: t.description,
            occurred_at: normalizeDateTimeInput(t.occurred_at),
          }
        : { id: null, kind: 'income', amount: '0', description: '', occurred_at: '' }
    );
    this.editing.set(true);
  }

  save(): void {
    const t = this.tab();
    if (t === 0) {
      if (this.accountForm.invalid) return;
      const v = this.accountForm.getRawValue();
      const payload = { code: v.code, name: v.name, kind: v.kind };
      const op = v.id ? this.accCrud.update(v.id!, payload) : this.accCrud.create(payload);
      op.subscribe({
        next: () => {
          this.editing.set(false);
          this.reload();
          this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    } else if (t === 1) {
      if (this.expenseForm.invalid) return;
      const v = this.expenseForm.getRawValue();
      const payload: any = { description: v.description, amount: v.amount, incurred_on: v.incurred_on };
      if (v.account) payload.account = v.account;
      const op = v.id ? this.expCrud.update(v.id!, payload) : this.expCrud.create(payload);
      op.subscribe({
        next: () => {
          this.editing.set(false);
          this.reload();
          this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    } else {
      if (this.transactionForm.invalid) return;
      const v = this.transactionForm.getRawValue();
      const payload = { kind: v.kind, amount: v.amount, description: v.description, occurred_at: new Date(v.occurred_at!).toISOString() };
      const op = v.id ? this.txCrud.update(v.id!, payload) : this.txCrud.create(payload);
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

  removeAccount(a: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${a.code})`)) return;
    this.accCrud.remove(a.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
  removeExpense(e: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.expCrud.remove(e.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
  removeTransaction(t: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.txCrud.remove(t.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
}
