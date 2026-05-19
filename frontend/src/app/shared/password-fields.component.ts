import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-password-fields',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
  ],
  template: `
    <div class="password-fields" [formGroup]="group">
      @if (editMode) {
      <p class="password-fields__hint">{{ 'password.changeHint' | translate }}</p>
      }
      <div class="password-fields__grid">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
          <mat-label>{{ 'password.password' | translate }}</mat-label>
          <input
            matInput
            [type]="showPassword ? 'text' : 'password'"
            formControlName="password"
            autocomplete="new-password"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="showPassword = !showPassword"
            [attr.aria-label]="'password.toggleVisibility' | translate"
          >
            <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (group.get('password')?.hasError('passwordPolicy')) {
          <mat-error>{{ group.get('password')?.getError('passwordPolicy') | translate }}</mat-error>
          }
          @if (group.get('password')?.hasError('required')) {
          <mat-error>{{ 'password.required' | translate }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
          <mat-label>{{ 'password.passwordConfirm' | translate }}</mat-label>
          <input
            matInput
            [type]="showConfirm ? 'text' : 'password'"
            formControlName="password_confirm"
            autocomplete="new-password"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="showConfirm = !showConfirm"
            [attr.aria-label]="'password.toggleVisibility' | translate"
          >
            <mat-icon>{{ showConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (group.hasError('passwordMismatch')) {
          <mat-error>{{ 'password.mismatch' | translate }}</mat-error>
          }
          @if (group.get('password_confirm')?.hasError('required')) {
          <mat-error>{{ 'password.confirmRequired' | translate }}</mat-error>
          }
        </mat-form-field>
      </div>
    </div>
  `,
  styles: [
    `
      .password-fields__hint {
        margin: 0 0 12px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
        line-height: 1.4;
      }
      .password-fields__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 520px) {
        .password-fields__grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class PasswordFieldsComponent {
  @Input({ required: true }) group!: FormGroup;
  @Input() editMode = false;

  showPassword = false;
  showConfirm = false;
}
