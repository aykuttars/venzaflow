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
    MatTabsModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Randevular" icon="event">
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="onAdd()"><mat-icon>add</mat-icon> Yeni</button>
        }
      </app-page-header>
      <mat-tab-group (selectedIndexChange)="tab.set($event)">
        <mat-tab label="Randevular">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>Müşteri</th><th>Başlangıç</th><th>Bitiş</th><th>Durum</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (a of appointments(); track a.id) {
              <tr>
                <td>{{ a.customer_name }}</td><td>{{ a.start_at }}</td><td>{{ a.end_at }}</td><td>{{ a.status }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openAppt(a)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeAppt(a)"><mat-icon>delete</mat-icon></button>
                </td>
                }
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab label="Programlar">
          <table class="bms-table" style="margin-top:16px">
            <thead><tr><th>Ad</th><th>Kaynak</th>@if (canWrite()) {<th></th>}</tr></thead>
            <tbody>
              @for (s of schedules(); track s.id) {
              <tr>
                <td>{{ s.name }}</td><td>{{ s.resource }}</td>
                @if (canWrite()) {
                <td style="text-align:right">
                  <button mat-icon-button (click)="openSchedule(s)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="removeSchedule(s)"><mat-icon>delete</mat-icon></button>
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
            <mat-form-field appearance="outline"><mat-label>Müşteri</mat-label>
              <mat-select formControlName="customer">@for (c of customers(); track c.id) {<mat-option [value]="c.id">{{ c.first_name }} {{ c.last_name }}</mat-option>}</mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Başlangıç</mat-label><input matInput type="datetime-local" formControlName="start_at" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Bitiş</mat-label><input matInput type="datetime-local" formControlName="end_at" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Durum</mat-label>
              <mat-select formControlName="status">
                <mat-option value="scheduled">Planlandı</mat-option>
                <mat-option value="completed">Tamamlandı</mat-option>
                <mat-option value="cancelled">İptal</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Notlar</mat-label><input matInput formControlName="notes" /></mat-form-field>
          } @else {
            <mat-form-field appearance="outline"><mat-label>Ad</mat-label><input matInput formControlName="name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Kaynak</mat-label><input matInput formControlName="resource" /></mat-form-field>
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
export class AppointmentsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
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

  ngOnInit(): void {
    this.apptCrud.list({ limit: 200 }).subscribe((p) => this.appointments.set(p.results));
    this.schedCrud.list({ limit: 200 }).subscribe((p) => this.schedules.set(p.results));
    this.custCrud.list({ limit: 200 }).subscribe((p) => this.customers.set(p.results));
  }

  canWrite = () => this.auth.hasPermission('appointments.write');
  onAdd = () => (this.tab() === 0 ? this.openAppt() : this.openSchedule());

  openAppt(a?: any): void {
    this.tab.set(0);
    const fmt = (v: string) => (v ? v.slice(0, 16) : '');
    this.apptForm.reset(
      a
        ? { id: a.id, customer: a.customer, start_at: fmt(a.start_at), end_at: fmt(a.end_at), status: a.status, notes: a.notes }
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
      const v = this.apptForm.getRawValue();
      const payload = {
        customer: v.customer,
        start_at: new Date(v.start_at!).toISOString(),
        end_at: new Date(v.end_at!).toISOString(),
        status: v.status,
        notes: v.notes,
      };
      const op = v.id ? this.apptCrud.update(v.id!, payload) : this.apptCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.ngOnInit(); });
    } else {
      const v = this.schedForm.getRawValue();
      const payload = { name: v.name, resource: v.resource };
      const op = v.id ? this.schedCrud.update(v.id!, payload) : this.schedCrud.create(payload);
      op.subscribe(() => { this.editing.set(false); this.ngOnInit(); });
    }
  }

  removeAppt(a: any): void {
    if (confirm('Silinsin mi?')) this.apptCrud.remove(a.id).subscribe(() => this.ngOnInit());
  }
  removeSchedule(s: any): void {
    if (confirm('Silinsin mi?')) this.schedCrud.remove(s.id).subscribe(() => this.ngOnInit());
  }
}
