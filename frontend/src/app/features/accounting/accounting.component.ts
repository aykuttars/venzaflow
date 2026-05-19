import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { CrudService } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

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
    MatTabsModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Muhasebe" icon="savings">
        @if (canWrite()) { <button mat-flat-button color="primary" (click)="onAdd()"><mat-icon>add</mat-icon> Yeni</button> }
      </app-page-header>
      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab label="Hesaplar">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>Kod</th><th>Ad</th><th>Tür</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (a of accounts(); track a.id) {
              <tr>
                <td>{{ a.code }}</td><td>{{ a.name }}</td><td>{{ a.kind }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openAccount(a)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeAccount(a)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab label="Giderler">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>Hesap</th><th>Açıklama</th><th>Tutar</th><th>Tarih</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (e of expenses(); track e.id) {
              <tr>
                <td>{{ e.account_code }}</td><td>{{ e.description }}</td><td>{{ e.amount }}</td><td>{{ e.incurred_on }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openExpense(e)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeExpense(e)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab label="İşlemler">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>Tür</th><th>Tutar</th><th>Açıklama</th><th>Tarih</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (t of transactions(); track t.id) {
              <tr>
                <td>{{ t.kind }}</td><td>{{ t.amount }}</td><td>{{ t.description }}</td><td>{{ t.occurred_at }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openTransaction(t)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeTransaction(t)"><mat-icon>delete</mat-icon></button>
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
            <mat-form-field appearance="outline"><mat-label>Kod</mat-label><input matInput formControlName="code" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Ad</mat-label><input matInput formControlName="name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Tür</mat-label>
              <mat-select formControlName="kind">
                <mat-option value="asset">Varlık</mat-option><mat-option value="liability">Borç</mat-option>
                <mat-option value="equity">Özkaynak</mat-option><mat-option value="revenue">Gelir</mat-option>
                <mat-option value="expense">Gider</mat-option>
              </mat-select>
            </mat-form-field>
          } @else if (tab() === 1) {
            <mat-form-field appearance="outline"><mat-label>Hesap</mat-label>
              <mat-select formControlName="account">@for (a of accounts(); track a.id) {<mat-option [value]="a.id">{{ a.code }}</mat-option>}</mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Açıklama</mat-label><input matInput formControlName="description" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Tutar</mat-label><input matInput type="number" step="0.01" formControlName="amount" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Tarih</mat-label><input matInput type="date" formControlName="incurred_on" /></mat-form-field>
          } @else {
            <mat-form-field appearance="outline"><mat-label>Tür</mat-label>
              <mat-select formControlName="kind">
                <mat-option value="income">Gelir</mat-option><mat-option value="expense">Gider</mat-option>
                <mat-option value="adjustment">Düzeltme</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Tutar</mat-label><input matInput type="number" step="0.01" formControlName="amount" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Açıklama</mat-label><input matInput formControlName="description" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Tarih</mat-label><input matInput type="datetime-local" formControlName="occurred_at" /></mat-form-field>
          }
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="editing.set(false)">İptal</button>
            <button mat-flat-button color="primary" type="submit">Kaydet</button>
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
  protected auth = inject(AuthService);
  tab = signal(0);
  editing = signal(false);
  accounts = signal<any[]>([]);
  expenses = signal<any[]>([]);
  transactions = signal<any[]>([]);
  private accCrud = new CrudService<any>(this.http, 'accounting/accounts');
  private expCrud = new CrudService<any>(this.http, 'accounting/expenses');
  private txCrud = new CrudService<any>(this.http, 'accounting/transactions');

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
      e ? { id: e.id, account: e.account, description: e.description, amount: e.amount, incurred_on: e.incurred_on } : { id: null, account: null, description: '', amount: '0', incurred_on: '' }
    );
    this.editing.set(true);
  }
  openTransaction(t?: any): void {
    this.tab.set(2);
    const fmt = (v: string) => (v ? v.slice(0, 16) : '');
    this.transactionForm.reset(
      t ? { id: t.id, kind: t.kind, amount: t.amount, description: t.description, occurred_at: fmt(t.occurred_at) } : { id: null, kind: 'income', amount: '0', description: '', occurred_at: '' }
    );
    this.editing.set(true);
  }

  save(): void {
    const t = this.tab();
    if (t === 0) {
      const v = this.accountForm.getRawValue();
      const payload = { code: v.code, name: v.name, kind: v.kind };
      const op = v.id ? this.accCrud.update(v.id!, payload) : this.accCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.reload(); });
    } else if (t === 1) {
      const v = this.expenseForm.getRawValue();
      const payload: any = { description: v.description, amount: v.amount, incurred_on: v.incurred_on };
      if (v.account) payload.account = v.account;
      const op = v.id ? this.expCrud.update(v.id!, payload) : this.expCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.reload(); });
    } else {
      const v = this.transactionForm.getRawValue();
      const payload = { kind: v.kind, amount: v.amount, description: v.description, occurred_at: new Date(v.occurred_at!).toISOString() };
      const op = v.id ? this.txCrud.update(v.id!, payload) : this.txCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.reload(); });
    }
  }

  removeAccount(a: any): void {
    if (confirm('Silinsin mi?')) this.accCrud.remove(a.id).subscribe(() => this.reload());
  }
  removeExpense(e: any): void {
    if (confirm('Silinsin mi?')) this.expCrud.remove(e.id).subscribe(() => this.reload());
  }
  removeTransaction(t: any): void {
    if (confirm('Silinsin mi?')) this.txCrud.remove(t.id).subscribe(() => this.reload());
  }
}
