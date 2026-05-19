import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { CrudService, Page } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { PermissionPickerComponent } from '../../shared/permission-picker.component';

interface Department {
  id: number;
  key: string;
  name: string;
  permission_codenames: string[];
}

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSnackBarModule,
    PageHeaderComponent,
    PermissionPickerComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Departmanlar" icon="admin_panel_settings">
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> Yeni departman
        </button>
        }
      </app-page-header>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
        <mat-label>Ara</mat-label>
        <input matInput (input)="onSearch($any($event.target).value)" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <table class="bms-table">
        <thead>
          <tr><th>Anahtar</th><th>Ad</th><th>Yetkiler</th>@if (canWrite()) {<th></th>}</tr>
        </thead>
        <tbody>
          @for (d of items(); track d.id) {
          <tr>
            <td>{{ d.key }}</td>
            <td>{{ d.name }}</td>
            <td>{{ (d.permission_codenames || []).join(', ') }}</td>
            @if (canWrite()) {
            <td style="text-align:right">
              <button mat-icon-button (click)="openForm(d)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button (click)="remove(d)"><mat-icon>delete</mat-icon></button>
            </td>
            }
          </tr>
          }
          @if (items().length === 0) {
          <tr><td [attr.colspan]="canWrite() ? 4 : 3" style="text-align:center;padding:24px">Kayıt yok.</td></tr>
          }
        </tbody>
      </table>

      @if (editing()) {
      <div class="overlay" (click)="cancel()"></div>
      <div class="dialog">
        <h2>{{ form.value.id ? 'Departman düzenle' : 'Yeni departman' }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()" style="display:flex;flex-direction:column;gap:8px">
          <mat-form-field appearance="outline">
            <mat-label>Anahtar</mat-label>
            <input matInput formControlName="key" [readonly]="!!form.value.id" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Ad</mat-label>
            <input matInput formControlName="name" required />
          </mat-form-field>
          <h3>Yetkiler</h3>
          <app-permission-picker [control]="permControl" />
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="cancel()">İptal</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">Kaydet</button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [CRUD_DIALOG_STYLES],
})
export class DepartmentsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  protected auth = inject(AuthService);
  private crud = new CrudService<Department>(this.http, 'departments');

  items = signal<Department[]>([]);
  editing = signal(false);
  permControl = new FormControl<string[]>([], { nonNullable: true });
  private search = '';

  protected form = this.fb.nonNullable.group({
    id: this.fb.control<number | null>(null),
    key: ['', Validators.required],
    name: ['', Validators.required],
  });

  ngOnInit(): void {
    this.reload();
  }

  canWrite(): boolean {
    return this.auth.hasPermission('settings.write');
  }

  onSearch(v: string): void {
    this.search = v;
    this.reload();
  }

  reload(): void {
    this.crud.list({ limit: 100, search: this.search }).subscribe({
      next: (p: Page<Department>) => this.items.set(p.results),
    });
  }

  openForm(d?: Department): void {
    if (d) {
      this.form.reset({ id: d.id, key: d.key, name: d.name });
      this.permControl.setValue(d.permission_codenames || []);
    } else {
      this.form.reset({ id: null, key: '', name: '' });
      this.permControl.setValue([]);
    }
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload = {
      key: v.key,
      name: v.name,
      permission_codenames: this.permControl.value,
    };
    const op = v.id
      ? this.crud.update(v.id, payload as Partial<Department>)
      : this.crud.create(payload as Partial<Department>);
    op.subscribe({
      next: () => {
        this.editing.set(false);
        this.reload();
        this.snack.open('Kaydedildi', 'Tamam', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || 'Hata', 'Tamam', { duration: 3000 }),
    });
  }

  remove(d: Department): void {
    if (!confirm(`${d.name} silinsin mi?`)) return;
    this.crud.remove(d.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open('Silindi', 'Tamam', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || 'Silinemedi', 'Tamam', { duration: 3000 }),
    });
  }
}
