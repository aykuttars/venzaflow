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

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { CrudService, Page } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

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
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Müşteriler" icon="people">
        @if (canWriteCustomers() && tab() === 0) {
        <button mat-flat-button color="primary" (click)="openCustomerForm()"><mat-icon>add</mat-icon> Yeni</button>
        }
        @if (canWritePatients() && tab() === 1) {
        <button mat-flat-button color="primary" (click)="openRecordForm()"><mat-icon>add</mat-icon> Yeni kayıt</button>
        }
      </app-page-header>

      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab label="Müşteriler">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>Ad</th><th>Tür</th><th>Telefon</th><th>E-posta</th>@if (canWriteCustomers()) {<th></th>}</tr></thead>
            <tbody>
              @for (c of customers(); track c.id) {
              <tr>
                <td>{{ c.full_name || (c.first_name + ' ' + c.last_name) }}</td>
                <td>{{ c.kind }}</td>
                <td>{{ c.phone }}</td>
                <td>{{ c.email }}</td>
                @if (canWriteCustomers()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openCustomerForm(c)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeCustomer(c)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        @if (auth.hasPermission('patients.read')) {
        <mat-tab label="Tıbbi kayıtlar">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>Hasta</th><th>Özet</th><th>Güncelleme</th>@if (canWritePatients()) {<th></th>}</tr></thead>
            <tbody>
              @for (r of records(); track r.id) {
              <tr>
                <td>{{ r.patient_name }}</td>
                <td>{{ r.summary }}</td>
                <td>{{ r.updated_at }}</td>
                @if (canWritePatients()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openRecordForm(r)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeRecord(r)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        }
      </mat-tab-group>

      @if (editingCustomer()) {
      <div class="overlay" (click)="editingCustomer.set(false)"></div>
      <div class="dialog">
        <h2>{{ customerForm.value.id ? 'Düzenle' : 'Yeni müşteri' }}</h2>
        <form [formGroup]="customerForm" (ngSubmit)="saveCustomer()" style="display:flex;flex-direction:column;gap:8px">
          <mat-form-field appearance="outline"><mat-label>Tür</mat-label>
            <mat-select formControlName="kind"><mat-option value="customer">Müşteri</mat-option><mat-option value="patient">Hasta</mat-option></mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Ad</mat-label><input matInput formControlName="first_name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Soyad</mat-label><input matInput formControlName="last_name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Telefon</mat-label><input matInput formControlName="phone" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>E-posta</mat-label><input matInput formControlName="email" /></mat-form-field>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="editingCustomer.set(false)">İptal</button>
            <button mat-flat-button color="primary" type="submit">Kaydet</button>
          </div>
        </form>
      </div>
      }

      @if (editingRecord()) {
      <div class="overlay" (click)="editingRecord.set(false)"></div>
      <div class="dialog">
        <h2>{{ recordForm.value.id ? 'Düzenle' : 'Yeni tıbbi kayıt' }}</h2>
        <form [formGroup]="recordForm" (ngSubmit)="saveRecord()" style="display:flex;flex-direction:column;gap:8px">
          <mat-form-field appearance="outline"><mat-label>Hasta</mat-label>
            <mat-select formControlName="patient" required>
              @for (p of patients(); track p.id) { <mat-option [value]="p.id">{{ p.full_name || p.first_name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Özet</mat-label><textarea matInput rows="4" formControlName="summary"></textarea></mat-form-field>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="editingRecord.set(false)">İptal</button>
            <button mat-flat-button color="primary" type="submit">Kaydet</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [CRUD_DIALOG_STYLES],
})
export class CustomersComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  protected auth = inject(AuthService);
  private customerCrud = new CrudService<any>(this.http, 'customers');
  private recordCrud = new CrudService<any>(this.http, 'medical-records');

  tab = signal(0);
  customers = signal<any[]>([]);
  records = signal<any[]>([]);
  patients = signal<any[]>([]);
  editingCustomer = signal(false);
  editingRecord = signal(false);

  customerForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    kind: ['customer', Validators.required],
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    phone: [''],
    email: [''],
  });

  recordForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    patient: this.fb.control<number | null>(null, Validators.required),
    summary: [''],
  });

  ngOnInit(): void {
    this.reloadCustomers();
    if (this.auth.hasPermission('patients.read')) {
      this.reloadRecords();
    }
  }

  canWriteCustomers = () => this.auth.hasPermission('customers.write');
  canWritePatients = () => this.auth.hasPermission('patients.write');

  reloadCustomers(): void {
    this.customerCrud.list({ limit: 200 }).subscribe((p) => this.customers.set(p.results));
    this.patients.set(
      this.customers().filter((c) => c.kind === 'patient')
    );
  }

  reloadRecords(): void {
    this.recordCrud.list({ limit: 200 }).subscribe((p) => this.records.set(p.results));
    this.customerCrud.list({ limit: 200 }).subscribe((p) => {
      this.patients.set(p.results.filter((c: any) => c.kind === 'patient'));
    });
  }

  openCustomerForm(c?: any): void {
    this.customerForm.reset(
      c
        ? { id: c.id, kind: c.kind, first_name: c.first_name, last_name: c.last_name, phone: c.phone, email: c.email }
        : { id: null, kind: 'customer', first_name: '', last_name: '', phone: '', email: '' }
    );
    this.editingCustomer.set(true);
  }

  saveCustomer(): void {
    if (this.customerForm.invalid) return;
    const v = this.customerForm.getRawValue();
    const payload = { kind: v.kind, first_name: v.first_name, last_name: v.last_name, phone: v.phone, email: v.email };
    const op = v.id ? this.customerCrud.update(v.id!, payload) : this.customerCrud.create(payload);
    op.subscribe({ next: () => { this.editingCustomer.set(false); this.reloadCustomers(); } });
  }

  removeCustomer(c: any): void {
    if (!confirm('Silinsin mi?')) return;
    this.customerCrud.remove(c.id).subscribe(() => this.reloadCustomers());
  }

  openRecordForm(r?: any): void {
    this.recordForm.reset(r ? { id: r.id, patient: r.patient, summary: r.summary } : { id: null, patient: null, summary: '' });
    this.editingRecord.set(true);
  }

  saveRecord(): void {
    if (this.recordForm.invalid) return;
    const v = this.recordForm.getRawValue();
    const payload = { patient: v.patient, summary: v.summary };
    const op = v.id ? this.recordCrud.update(v.id!, payload) : this.recordCrud.create(payload);
    op.subscribe({ next: () => { this.editingRecord.set(false); this.reloadRecords(); } });
  }

  removeRecord(r: any): void {
    if (!confirm('Silinsin mi?')) return;
    this.recordCrud.remove(r.id).subscribe(() => this.reloadRecords());
  }
}
