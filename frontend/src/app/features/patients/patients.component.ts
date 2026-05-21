import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { PhoneInputDirective } from '../../shared/phone-input.directive';
import { emailOptionalValidator, phoneValidator } from '../../shared/form-validators';

@Component({
  selector: 'app-patients',
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
    PhoneInputDirective,
  ],
  template: `
    <div class="page" [class.page--embedded]="embedded">
      @if (!embedded) {
      <app-page-header moduleSlug="patients" icon="medical_services">
        @if (canWritePatients() && tab() === 0) {
        <button mat-flat-button color="primary" (click)="openPatientForm()">
          <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
        </button>
        }
        @if (canWriteRecords() && tab() === 1) {
        <button mat-flat-button color="primary" (click)="openRecordForm()">
          <mat-icon>add</mat-icon> {{ 'customers.newRecord' | translate }}
        </button>
        }
      </app-page-header>
      } @else {
      <div class="embedded-actions">
        @if (canWritePatients() && tab() === 0) {
        <button mat-flat-button color="primary" (click)="openPatientForm()">
          <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
        </button>
        }
        @if (canWriteRecords() && tab() === 1) {
        <button mat-flat-button color="primary" (click)="openRecordForm()">
          <mat-icon>add</mat-icon> {{ 'customers.newRecord' | translate }}
        </button>
        }
      </div>
      }

      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab [label]="'nav.patients' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead>
              <tr>
                <th>{{ 'customers.name' | translate }}</th>
                <th>{{ 'customers.phone' | translate }}</th>
                <th>{{ 'customers.email' | translate }}</th>
                @if (canWritePatients()) { <th></th> }
              </tr>
            </thead>
            <tbody>
              @for (p of patients(); track p.id) {
              <tr>
                <td>{{ p.full_name || (p.first_name + ' ' + p.last_name) }}</td>
                <td>{{ p.phone }}</td>
                <td>{{ p.email }}</td>
                @if (canWritePatients()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openPatientForm(p)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removePatient(p)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        @if (canAccessRecords()) {
        <mat-tab [label]="'customers.medicalRecords' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead>
              <tr>
                <th>{{ 'customers.patient' | translate }}</th>
                <th>{{ 'customers.summary' | translate }}</th>
                <th>{{ 'customers.updated' | translate }}</th>
                @if (canWriteRecords()) { <th></th> }
              </tr>
            </thead>
            <tbody>
              @for (r of records(); track r.id) {
              <tr>
                <td>{{ r.patient_name }}</td>
                <td>{{ r.summary }}</td>
                <td>{{ r.updated_at }}</td>
                @if (canWriteRecords()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openRecordForm(r)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeRecord(r)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        }
      </mat-tab-group>

      @if (editingPatient()) {
      <div class="overlay" (click)="editingPatient.set(false)"></div>
      <div class="dialog">
        <h2>{{ (patientForm.value.id ? 'common.edit' : 'patients.newPatient') | translate }}</h2>
        <form [formGroup]="patientForm" (ngSubmit)="savePatient()" style="display:flex;flex-direction:column;gap:8px">
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
            <button mat-button type="button" (click)="editingPatient.set(false)">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
          </div>
        </form>
      </div>
      }

      @if (editingRecord()) {
      <div class="overlay" (click)="editingRecord.set(false)"></div>
      <div class="dialog">
        <h2>{{ (recordForm.value.id ? 'common.edit' : 'customers.newMedicalRecord') | translate }}</h2>
        <form [formGroup]="recordForm" (ngSubmit)="saveRecord()" style="display:flex;flex-direction:column;gap:8px">
          <mat-form-field appearance="outline"><mat-label>{{ 'customers.patient' | translate }}</mat-label>
            <mat-select formControlName="patient" required>
              @for (p of patients(); track p.id) {
              <mat-option [value]="p.id">{{ p.full_name || p.first_name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'customers.summary' | translate }}</mat-label><textarea matInput rows="4" formControlName="summary"></textarea></mat-form-field>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="editingRecord.set(false)">{{ 'common.cancel' | translate }}</button>
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
      .page--embedded { padding-top: 0; }
      .embedded-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 8px;
      }
    `,
  ],
})
export class PatientsComponent implements OnInit {
  @Input() embedded = false;

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);
  private patientCrud = new CrudService<any>(this.http, 'patients', this.auth, 'patients');
  private recordCrud = new CrudService<any>(this.http, 'medical-records', this.auth, 'patients');

  tab = signal(0);
  patients = signal<any[]>([]);
  records = signal<any[]>([]);
  editingPatient = signal(false);
  editingRecord = signal(false);

  patientForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    phone: ['', phoneValidator()],
    email: ['', emailOptionalValidator()],
  });

  recordForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    patient: this.fb.control<number | null>(null, Validators.required),
    summary: [''],
  });

  ngOnInit(): void {
    if (this.route.snapshot.data['embedded']) {
      this.embedded = true;
    }
    this.reloadPatients();
    if (this.canAccessRecords()) {
      this.reloadRecords();
    }
  }

  canWritePatients = () => this.auth.hasPermission('patients.write');
  canWriteRecords = () => this.auth.hasPermission('patients.write');
  canAccessRecords = () =>
    this.auth.hasModule('patients') && this.auth.hasPermission('patients.read');

  reloadPatients(): void {
    this.patientCrud.list({ limit: 200 }).subscribe((p) => this.patients.set(p.results));
  }

  reloadRecords(): void {
    this.recordCrud.list({ limit: 200 }).subscribe((p) => this.records.set(p.results));
  }

  openPatientForm(p?: any): void {
    this.patientForm.reset(
      p
        ? { id: p.id, first_name: p.first_name, last_name: p.last_name, phone: p.phone, email: p.email }
        : { id: null, first_name: '', last_name: '', phone: '', email: '' }
    );
    this.editingPatient.set(true);
  }

  savePatient(): void {
    if (this.patientForm.invalid) return;
    const v = this.patientForm.getRawValue();
    const payload = { first_name: v.first_name, last_name: v.last_name, phone: v.phone, email: v.email };
    const op = v.id ? this.patientCrud.update(v.id!, payload) : this.patientCrud.create(payload);
    op.subscribe({
      next: () => {
        this.editingPatient.set(false);
        this.reloadPatients();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  removePatient(p: any): void {
    const name = p.full_name || `${p.first_name} ${p.last_name}`;
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${name})`)) return;
    this.patientCrud.remove(p.id).subscribe({
      next: () => {
        this.reloadPatients();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
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
    op.subscribe({
      next: () => {
        this.editingRecord.set(false);
        this.reloadRecords();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  removeRecord(r: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.recordCrud.remove(r.id).subscribe({
      next: () => {
        this.reloadRecords();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
}
