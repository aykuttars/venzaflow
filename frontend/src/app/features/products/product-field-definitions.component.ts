import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService } from '../../shared/crud.service';
import { FieldType, ProductFieldDefinition } from '../../shared/dynamic-fields/models';
import { HttpClient } from '@angular/common/http';

const FIELD_TYPES = [
  'TEXT', 'TEXTAREA', 'NUMBER', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME',
  'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'PHONE', 'MONEY', 'PERCENT', 'FILE', 'IMAGE', 'JSON',
];

@Component({
  selector: 'app-product-field-definitions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div style="margin-top:16px">
      @if (canWrite()) {
      <button mat-flat-button color="primary" (click)="openForm()">
        <mat-icon>add</mat-icon> {{ 'common.new' | translate }}
      </button>
      }
      <table class="bms-table" style="margin-top:12px">
        <thead>
          <tr>
            <th>{{ 'products.fieldKey' | translate }}</th>
            <th>{{ 'products.fieldLabel' | translate }}</th>
            <th>{{ 'products.fieldType' | translate }}</th>
            <th>{{ 'products.required' | translate }}</th>
            @if (canWrite()) { <th></th> }
          </tr>
        </thead>
        <tbody>
          @for (d of items(); track d.id) {
          <tr>
            <td>{{ d.key }}</td>
            <td>{{ d.label }}</td>
            <td>{{ d.field_type }}</td>
            <td>{{ d.is_required ? '✓' : '—' }}</td>
            @if (canWrite()) {
            <td style="text-align:right">
              <button mat-icon-button (click)="openForm(d)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button (click)="remove(d)"><mat-icon>delete</mat-icon></button>
            </td>
            }
          </tr>
          }
        </tbody>
      </table>
    </div>

    @if (editing()) {
    <div class="overlay" (click)="editing.set(false)"></div>
    <div class="dialog">
      <h2>{{ form.value.id ? ('products.editField' | translate) : ('products.newField' | translate) }}</h2>
      <form [formGroup]="form" (ngSubmit)="save()" style="display:flex;flex-direction:column;gap:8px">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'products.fieldKey' | translate }}</mat-label>
          <input matInput formControlName="key" [readonly]="!!form.value.id" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'products.fieldLabel' | translate }}</mat-label>
          <input matInput formControlName="label" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'products.fieldType' | translate }}</mat-label>
          <mat-select formControlName="field_type">
            @for (t of fieldTypes; track t) {
            <mat-option [value]="t">{{ t }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-checkbox formControlName="is_required">{{ 'products.required' | translate }}</mat-checkbox>
        <mat-checkbox formControlName="show_in_form">{{ 'products.showInForm' | translate }}</mat-checkbox>
        <mat-checkbox formControlName="show_in_list">{{ 'products.showInList' | translate }}</mat-checkbox>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button mat-button type="button" (click)="editing.set(false)">{{ 'common.cancel' | translate }}</button>
          <button mat-flat-button color="primary" type="submit">{{ 'common.save' | translate }}</button>
        </div>
      </form>
    </div>
    }
  `,
  styles: [CRUD_DIALOG_STYLES],
})
export class ProductFieldDefinitionsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  protected auth = inject(AuthService);

  private crud = new CrudService<ProductFieldDefinition>(
    this.http,
    'products/field-definitions',
    this.auth,
    'products'
  );

  items = signal<ProductFieldDefinition[]>([]);
  editing = signal(false);
  fieldTypes = FIELD_TYPES;

  form = this.fb.group({
    id: this.fb.control<number | null>(null),
    key: ['', Validators.required],
    label: ['', Validators.required],
    field_type: ['TEXT', Validators.required],
    is_required: [false],
    show_in_form: [true],
    show_in_list: [false],
    is_active: [true],
  });

  ngOnInit(): void {
    this.reload();
  }

  canWrite = () => this.auth.hasPermission('products.write');

  reload(): void {
    this.crud.list({ limit: 500 }).subscribe((p) => this.items.set(p.results));
  }

  openForm(d?: ProductFieldDefinition): void {
    if (d) {
      this.form.reset({
        id: d.id,
        key: d.key,
        label: d.label,
        field_type: d.field_type,
        is_required: d.is_required,
        show_in_form: d.show_in_form,
        show_in_list: d.show_in_list,
        is_active: d.is_active,
      });
    } else {
      this.form.reset({
        id: null,
        key: '',
        label: '',
        field_type: 'TEXT',
        is_required: false,
        show_in_form: true,
        show_in_list: false,
        is_active: true,
      });
    }
    this.editing.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload: Partial<ProductFieldDefinition> = {
      key: v.key ?? '',
      label: v.label ?? '',
      field_type: (v.field_type ?? 'TEXT') as FieldType,
      is_required: v.is_required ?? false,
      show_in_form: v.show_in_form ?? true,
      show_in_list: v.show_in_list ?? false,
      is_active: v.is_active ?? true,
    };
    const op = v.id ? this.crud.update(v.id, payload) : this.crud.create(payload);
    op.subscribe({
      next: () => {
        this.editing.set(false);
        this.reload();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 2500,
        }),
    });
  }

  remove(d: ProductFieldDefinition): void {
    this.confirmDialog.confirmDelete(d.key).then((ok) => {
      if (!ok) return;
      this.crud.remove(d.id).subscribe(() => this.reload());
    });
  }
}
