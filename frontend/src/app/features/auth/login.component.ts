import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div
      style="display:flex; align-items:center; justify-content:center; min-height:100vh; background:linear-gradient(135deg,#3949ab 0%,#5c6bc0 60%,#9fa8da 100%)"
    >
      <mat-card style="width: 380px; padding: 8px">
        <mat-card-header>
          <mat-card-title style="display:flex; align-items:center; gap:8px">
            <mat-icon>business</mat-icon>
            <span>Tenancysoft</span>
          </mat-card-title>
          <mat-card-subtitle>Sign in to your tenant</mat-card-subtitle>
        </mat-card-header>
        @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()" class="full-width">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Customer code</mat-label>
              <input
                matInput
                formControlName="customer_code"
                autocomplete="organization"
                required
              />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                autocomplete="username"
                required
              />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input
                matInput
                type="password"
                formControlName="password"
                autocomplete="current-password"
                required
              />
            </mat-form-field>

            @if (error()) {
            <p style="color:#b00020; margin: 0 0 12px">{{ error() }}</p>
            }

            <button
              mat-flat-button
              color="primary"
              class="full-width"
              [disabled]="form.invalid || loading()"
              type="submit"
            >
              Sign in
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected form = this.fb.nonNullable.group({
    customer_code: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail || 'Invalid credentials');
      },
    });
  }
}
