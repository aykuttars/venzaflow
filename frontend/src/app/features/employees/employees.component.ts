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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { CrudService } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { PasswordFieldsComponent } from '../../shared/password-fields.component';
import {
  passwordMatchValidator,
  passwordPolicyValidator,
} from '../../shared/password-validators';
import { PermissionPickerComponent } from '../../shared/permission-picker.component';

interface Department {
  id: number;
  key: string;
  name: string;
}

interface StaffUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  department: number | null;
  department_name?: string;
  extra_permission_codenames?: string[];
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    TranslateModule,
    PageHeaderComponent,
    PasswordFieldsComponent,
    PermissionPickerComponent,
  ],
  templateUrl: './employees.component.html',
  styles: [CRUD_DIALOG_STYLES],
})
export class EmployeesComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);
  private staffCrud = new CrudService<StaffUser>(this.http, 'employees');
  private deptCrud = new CrudService<Department>(this.http, 'departments');

  items = signal<StaffUser[]>([]);
  departments = signal<Department[]>([]);
  editing = signal(false);
  extraPermControl = new FormControl<string[]>([], { nonNullable: true });
  private search = '';

  passwordGroup = this.fb.group(
    { password: [''], password_confirm: [''] },
    { validators: passwordMatchValidator('password', 'password_confirm') }
  );

  protected form = this.fb.nonNullable.group({
    id: this.fb.control<number | null>(null),
    email: ['', [Validators.required, Validators.email]],
    first_name: [''],
    last_name: [''],
    department: this.fb.control<number | null>(null, Validators.required),
    is_active: [true],
  });

  ngOnInit(): void {
    this.deptCrud.list({ limit: 100 }).subscribe((p) => this.departments.set(p.results));
    this.reload();
  }

  canWrite(): boolean {
    return this.auth.hasPermission('employees.write');
  }

  onSearch(v: string): void {
    this.search = v;
    this.reload();
  }

  reload(): void {
    this.staffCrud.list({ limit: 100, search: this.search }).subscribe({
      next: (p) => this.items.set(p.results),
    });
  }

  openForm(u?: StaffUser): void {
    const pw = this.passwordGroup;
    if (u) {
      this.form.reset({
        id: u.id,
        email: u.email,
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        department: u.department,
        is_active: u.is_active,
      });
      this.extraPermControl.setValue(u.extra_permission_codenames || []);
      pw.reset({ password: '', password_confirm: '' });
      pw.get('password')!.clearValidators();
      pw.get('password_confirm')!.clearValidators();
    } else {
      this.form.reset({
        id: null,
        email: '',
        first_name: '',
        last_name: '',
        department: null,
        is_active: true,
      });
      this.extraPermControl.setValue([]);
      pw.reset({ password: '', password_confirm: '' });
      pw.get('password')!.setValidators([Validators.required, passwordPolicyValidator()]);
      pw.get('password_confirm')!.setValidators([Validators.required]);
    }
    pw.updateValueAndValidity();
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
  }

  save(): void {
    if (this.form.invalid || this.passwordGroup.invalid) return;
    const v = this.form.getRawValue();
    const pw = this.passwordGroup.getRawValue();
    const payload: Record<string, unknown> = {
      email: v.email,
      first_name: v.first_name,
      last_name: v.last_name,
      department: v.department,
      is_active: v.is_active,
      extra_permission_codenames: this.extraPermControl.value,
    };
    if (pw.password) {
      payload['password'] = pw.password;
      payload['password_confirm'] = pw.password_confirm;
    } else if (!v.id) {
      this.snack.open(this.translate.instant('employees.passwordRequired'), 'OK', { duration: 2500 });
      return;
    }

    const op = v.id
      ? this.staffCrud.update(v.id, payload as Partial<StaffUser>)
      : this.staffCrud.create(payload as Partial<StaffUser>);
    op.subscribe({
      next: () => {
        this.editing.set(false);
        this.reload();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(
          e?.error?.detail || e?.error?.password?.[0] || e?.error?.password_confirm?.[0] || this.translate.instant('common.error'),
          'OK',
          { duration: 4000 }
        ),
    });
  }

  remove(u: StaffUser): void {
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${u.email})`)) return;
    this.staffCrud.remove(u.id).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 3000 }),
    });
  }
}
