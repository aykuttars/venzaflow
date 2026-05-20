import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslateModule } from '@ngx-translate/core';

import { PlatformAuthService } from '../../core/platform-auth.service';

@Component({
  selector: 'app-platform-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TranslateModule,
  ],
  template: `
    <div class="platform-login">
      <mat-card class="platform-login__card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>admin_panel_settings</mat-icon>
            {{ 'platform.title' | translate }}
          </mat-card-title>
          <mat-card-subtitle>{{ 'platform.signIn' | translate }}</mat-card-subtitle>
        </mat-card-header>
        @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'auth.email' | translate }}</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" required />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'auth.password' | translate }}</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" required />
            </mat-form-field>
            @if (error()) {
            <p class="platform-login__error">{{ error() }}</p>
            }
            <button mat-flat-button color="primary" class="full-width" type="submit" [disabled]="form.invalid || loading()">
              {{ 'auth.signInButton' | translate }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .platform-login {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #5c6bc0 100%);
      }
      .platform-login__card {
        width: 380px;
        padding: 8px;
      }
      .platform-login__card mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      .platform-login__error {
        color: #b00020;
        margin: 0 0 12px;
      }
    `,
  ],
})
export class PlatformLoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(PlatformAuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    this.auth.login(v).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/tenants']);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.detail || 'Error');
      },
    });
  }
}
