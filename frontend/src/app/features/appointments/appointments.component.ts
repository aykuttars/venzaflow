import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { AppointmentDatetimeRangeComponent } from '../../shared/appointment-datetime-range.component';
import { normalizeDateTimeInput } from '../../shared/date-utils';

@Component({
  selector: 'app-appointments',
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
    AppointmentDatetimeRangeComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="appointments" icon="event">
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="onAdd()"><mat-icon>add</mat-icon> {{ 'common.new' | translate }}</button>
        }
      </app-page-header>
      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab [label]="'appointments.title' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'appointments.customer' | translate }}</th><th>{{ 'appointments.start' | translate }}</th><th>{{ 'appointments.end' | translate }}</th><th>{{ 'appointments.status' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (a of appointments(); track a.id) {
              <tr>
                <td>{{ a.customer_name }}</td><td>{{ a.start_at }}</td><td>{{ a.end_at }}</td><td>{{ ('appointments.' + a.status) | translate }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openAppt(a)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeAppt(a)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'appointments.schedules' | translate">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>{{ 'customers.name' | translate }}</th><th>{{ 'appointments.resource' | translate }}</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (s of schedules(); track s.id) {
              <tr>
                <td>{{ s.name }}</td><td>{{ s.resource }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openSchedule(s)" [attr.aria-label]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeSchedule(s)" [attr.aria-label]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
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
            <mat-form-field appearance="outline"><mat-label>{{ 'appointments.customer' | translate }}</mat-label>
              <mat-select formControlName="customer">@for (c of customers(); track c.id) {<mat-option [value]="c.id">{{ c.first_name }} {{ c.last_name }}</mat-option>}</mat-select>
            </mat-form-field>
            <app-appointment-datetime-range
              [startControl]="startAtControl"
              [endControl]="endAtControl"
            />
            <mat-form-field appearance="outline"><mat-label>{{ 'appointments.status' | translate }}</mat-label>
              <mat-select formControlName="status">
                <mat-option value="scheduled">{{ 'appointments.scheduled' | translate }}</mat-option>
                <mat-option value="completed">{{ 'appointments.completed' | translate }}</mat-option>
                <mat-option value="cancelled">{{ 'appointments.cancelled' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'appointments.notes' | translate }}</mat-label><input matInput formControlName="notes" /></mat-form-field>
          } @else {
            <mat-form-field appearance="outline"><mat-label>{{ 'customers.name' | translate }}</mat-label><input matInput formControlName="name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'appointments.resource' | translate }}</mat-label><input matInput formControlName="resource" /></mat-form-field>
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
export class AppointmentsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);
  tab = signal(0);
  editing = signal(false);
  appointments = signal<any[]>([]);
  schedules = signal<any[]>([]);
  customers = signal<any[]>([]);
  private apptCrud = new CrudService<any>(this.http, 'appointments');
  private schedCrud = new CrudService<any>(this.http, 'schedules');
  private custCrud = new CrudService<any>(this.http, 'customers');

  apptForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    customer: this.fb.control<number | null>(null, Validators.required),
    start_at: ['', Validators.required],
    end_at: ['', Validators.required],
    status: ['scheduled'],
    notes: [''],
  });
  schedForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    name: ['', Validators.required],
    resource: [''],
  });

  get activeForm() {
    return this.tab() === 0 ? this.apptForm : this.schedForm;
  }

  get startAtControl(): FormControl<string> {
    return this.apptForm.controls.start_at as FormControl<string>;
  }

  get endAtControl(): FormControl<string> {
    return this.apptForm.controls.end_at as FormControl<string>;
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.apptCrud.list({ limit: 200 }).subscribe((p) => this.appointments.set(p.results));
    this.schedCrud.list({ limit: 200 }).subscribe((p) => this.schedules.set(p.results));
    this.custCrud.list({ limit: 200 }).subscribe((p) => this.customers.set(p.results));
  }

  canWrite = () => this.auth.hasPermission('appointments.write');
  onAdd = () => (this.tab() === 0 ? this.openAppt() : this.openSchedule());

  openAppt(a?: any): void {
    this.tab.set(0);
    this.apptForm.reset(
      a
        ? {
            id: a.id,
            customer: a.customer,
            start_at: normalizeDateTimeInput(a.start_at),
            end_at: normalizeDateTimeInput(a.end_at),
            status: a.status,
            notes: a.notes,
          }
        : { id: null, customer: null, start_at: '', end_at: '', status: 'scheduled', notes: '' }
    );
    this.editing.set(true);
  }

  openSchedule(s?: any): void {
    this.tab.set(1);
    this.schedForm.reset(s ? { id: s.id, name: s.name, resource: s.resource } : { id: null, name: '', resource: '' });
    this.editing.set(true);
  }

  save(): void {
    if (this.tab() === 0) {
      if (this.apptForm.invalid) return;
      const v = this.apptForm.getRawValue();
      const payload = {
        customer: v.customer,
        start_at: new Date(v.start_at!).toISOString(),
        end_at: new Date(v.end_at!).toISOString(),
        status: v.status,
        notes: v.notes,
      };
      const op = v.id ? this.apptCrud.update(v.id!, payload) : this.apptCrud.create(payload);
      op.subscribe({
        next: () => {
          this.editing.set(false);
          this.reload();
          this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
        },
        error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
      });
    } else {
      if (this.schedForm.invalid) return;
      const v = this.schedForm.getRawValue();
      const payload = { name: v.name, resource: v.resource };
      const op = v.id ? this.schedCrud.update(v.id!, payload) : this.schedCrud.create(payload);
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

  removeAppt(a: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.apptCrud.remove(a.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  removeSchedule(s: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${s.name})`)) return;
    this.schedCrud.remove(s.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
}
