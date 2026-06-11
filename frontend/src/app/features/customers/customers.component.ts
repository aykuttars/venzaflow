import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService } from '../../shared/crud.service';
import { PhoneInputDirective } from '../../shared/phone-input.directive';
import { emailOptionalValidator, phoneValidator } from '../../shared/form-validators';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSnackBarModule,
    TranslateModule,
    PhoneInputDirective,
  ],
  template: `
    <div class="customers-list">
      <div class="customers-list__actions">
        @if (canWriteCustomers()) {
        <button mat-flat-button color="primary" (click)="openCustomerForm()">
          <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
        </button>
        }
      </div>
      <table class="bms-table" style="margin-top:16px">
        <thead>
          <tr>
            <th>{{ 'customers.name' | translate }}</th>
            <th>{{ 'customers.phone' | translate }}</th>
            <th>{{ 'customers.email' | translate }}</th>
            @if (canWriteCustomers()) { <th></th> }
          </tr>
        </thead>
        <tbody>
          @for (c of customers(); track c.id) {
          <tr>
            <td>{{ c.full_name || (c.first_name + ' ' + c.last_name) }}</td>
            <td>{{ c.phone }}</td>
            <td>{{ c.email }}</td>
            @if (canWriteCustomers()) {
            <td style="text-align:right">
              <button mat-icon-button (click)="openCustomerForm(c)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button (click)="removeCustomer(c)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
            </td>
            }
          </tr>
          }
        </tbody>
      </table>

      @if (editingCustomer()) {
      <div class="overlay" (click)="editingCustomer.set(false)"></div>
      <div class="dialog">
        <h2>{{ (customerForm.value.id ? 'common.edit' : 'customers.newCustomer') | translate }}</h2>
        <form [formGroup]="customerForm" (ngSubmit)="saveCustomer()" style="display:flex;flex-direction:column;gap:8px">
          <mat-form-field appearance="outline"><mat-label>{{ 'employees.firstName' | translate }}</mat-label><input matInput formControlName="first_name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'employees.lastName' | translate }}</mat-label><input matInput formControlName="last_name" required /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'customers.phone' | translate }}</mat-label>
            <input matInput appPhoneInput formControlName="phone" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'customers.email' | translate }}</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" />
          </mat-form-field>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="editingCustomer.set(false)">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .customers-list__actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class CustomersComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  protected auth = inject(AuthService);
  private customerCrud = new CrudService<any>(this.http, 'customers', this.auth, 'customers');

  customers = signal<any[]>([]);
  editingCustomer = signal(false);

  customerForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    phone: ['', phoneValidator()],
    email: ['', emailOptionalValidator()],
  });

  ngOnInit(): void {
    this.reloadCustomers();
  }

  canWriteCustomers = () => this.auth.hasPermission('customers.write');

  reloadCustomers(): void {
    this.customerCrud.list({ limit: 200 }).subscribe((p) => this.customers.set(p.results));
  }

  openCustomerForm(c?: any): void {
    this.customerForm.reset(
      c
        ? { id: c.id, first_name: c.first_name, last_name: c.last_name, phone: c.phone, email: c.email }
        : { id: null, first_name: '', last_name: '', phone: '', email: '' }
    );
    this.editingCustomer.set(true);
  }

  saveCustomer(): void {
    if (this.customerForm.invalid) return;
    const v = this.customerForm.getRawValue();
    const payload = { first_name: v.first_name, last_name: v.last_name, phone: v.phone, email: v.email };
    const op = v.id ? this.customerCrud.update(v.id!, payload) : this.customerCrud.create(payload);
    op.subscribe({
      next: () => {
        this.editingCustomer.set(false);
        this.reloadCustomers();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  removeCustomer(c: any): void {
    const name = c.full_name || `${c.first_name} ${c.last_name}`;
    this.confirmDialog.confirmDelete(name).then((ok) => {
      if (!ok) return;
      this.customerCrud.remove(c.id).subscribe({
        next: () => {
          this.reloadCustomers();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    });
  }
}
