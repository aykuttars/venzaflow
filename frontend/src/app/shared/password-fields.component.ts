import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-password-fields',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <ng-container [formGroup]="group">
      <mat-form-field appearance="outline">
        <mat-label>Şifre</mat-label>
        <input
          matInput
          type="password"
          formControlName="password"
          [placeholder]="editMode ? 'Değiştirmek için yazın' : ''"
        />
        @if (group.get('password')?.hasError('passwordPolicy')) {
        <mat-error>{{ group.get('password')?.getError('passwordPolicy') }}</mat-error>
        }
        @if (group.get('password')?.hasError('required')) {
        <mat-error>Şifre gerekli</mat-error>
        }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Şifre doğrulama</mat-label>
        <input matInput type="password" formControlName="password_confirm" />
        @if (group.hasError('passwordMismatch')) {
        <mat-error>Şifreler eşleşmiyor</mat-error>
        }
        @if (group.get('password_confirm')?.hasError('required')) {
        <mat-error>Şifre doğrulama gerekli</mat-error>
        }
      </mat-form-field>
    </ng-container>
  `,
})
export class PasswordFieldsComponent {
  @Input({ required: true }) group!: FormGroup;
  @Input() editMode = false;
}
