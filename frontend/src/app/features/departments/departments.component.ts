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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
    TranslateModule,
    PageHeaderComponent,
    PermissionPickerComponent,
  ],
  template: `
    <div class="page">
      <app-page-header titleKey="departments.title" icon="admin_panel_settings">
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> {{ 'departments.new' | translate }}
        </button>
        }
      </app-page-header>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
        <mat-label>{{ 'common.search' | translate }}</mat-label>
        <input matInput (input)="onSearch($any($event.target).value)" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <table class="bms-table">
        <thead>
          <tr>
            <th>{{ 'departments.key' | translate }}</th>
            <th>{{ 'departments.name' | translate }}</th>
            <th>{{ 'permissions.title' | translate }}</th>
            @if (canWrite()) {<th></th>}
          </tr>
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
          <tr><td [attr.colspan]="canWrite() ? 4 : 3" style="text-align:center;padding:24px">{{ 'common.noRecords' | translate }}</td></tr>
          }
        </tbody>
      </table>

      @if (editing()) {
      <div class="overlay" (click)="cancel()"></div>
      <div class="dialog">
        <h2>{{ (form.value.id ? 'departments.edit' : 'departments.new') | translate }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()" style="display:flex;flex-direction:column;gap:8px">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'departments.key' | translate }}</mat-label>
            <input matInput formControlName="key" [readonly]="!!form.value.id" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'departments.name' | translate }}</mat-label>
            <input matInput formControlName="name" required />
          </mat-form-field>
          <h3>{{ 'permissions.title' | translate }}</h3>
          <app-permission-picker [control]="permControl" />
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button mat-button type="button" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">{{ 'common.save' | translate }}</button>
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
  private translate = inject(TranslateService);
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
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 3000 }),
    });
  }

  remove(d: Department): void {
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${d.name})`)) return;
    this.crud.remove(d.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 3000 }),
    });
  }
}
