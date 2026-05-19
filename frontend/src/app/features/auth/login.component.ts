import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { AppLanguage, LanguageService } from '../../core/language.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    TranslateModule,
  ],
  template: `
    <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; background:linear-gradient(135deg,#3949ab 0%,#5c6bc0 60%,#9fa8da 100%)">
      <mat-card style="width: 380px; padding: 8px">
        <mat-card-header>
          <mat-card-title style="display:flex; align-items:center; gap:8px">
            <mat-icon>business</mat-icon>
            <span>{{ 'app.title' | translate }}</span>
          </mat-card-title>
          <mat-card-subtitle>{{ 'auth.signIn' | translate }}</mat-card-subtitle>
        </mat-card-header>
        @if (loading()) { <mat-progress-bar mode="indeterminate"></mat-progress-bar> }
        <mat-card-content>
          <mat-button-toggle-group
            [value]="language.currentLang()"
            (change)="onPreviewLang($event.value)"
            style="margin-bottom:12px"
            [attr.aria-label]="'common.language' | translate"
          >
            <mat-button-toggle value="tr">TR</mat-button-toggle>
            <mat-button-toggle value="en">EN</mat-button-toggle>
          </mat-button-toggle-group>
          <form [formGroup]="form" (ngSubmit)="submit()" class="full-width">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'auth.customerCode' | translate }}</mat-label>
              <input matInput formControlName="customer_code" autocomplete="organization" required />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'auth.email' | translate }}</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" required />
              @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
              <mat-error>{{ 'validation.emailInvalid' | translate }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'auth.password' | translate }}</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" required />
            </mat-form-field>
            @if (error()) {
            <p style="color:#b00020; margin: 0 0 12px">{{ error() }}</p>
            }
            <button mat-flat-button color="primary" class="full-width" [disabled]="form.invalid || loading()" type="submit">
              {{ 'auth.signInButton' | translate }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  protected language = inject(LanguageService);

  ngOnInit(): void {
    this.language.restoreLoginPreviewLanguage();
  }

  protected onPreviewLang(lang: AppLanguage): void {
    if (lang) this.language.setLoginPreviewLanguage(lang);
  }

  protected form = this.fb.nonNullable.group({
    customer_code: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail || this.translate.instant('auth.signIn'));
      },
    });
  }
}
