import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { API_BASE } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface TenantProfile {
  id: number;
  customer_code: string;
  name: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Ayarlar" icon="settings"></app-page-header>

      <mat-card style="margin-bottom:16px">
        <mat-card-header><mat-card-title>Kiracı bilgisi</mat-card-title></mat-card-header>
        <mat-card-content>
          <p><strong>Kod:</strong> {{ tenant?.customer_code || auth.me()?.user?.tenant_code }}</p>
          @if (canEditTenant()) {
          <form [formGroup]="tenantForm" (ngSubmit)="saveTenant()" style="display:flex;flex-direction:column;gap:12px;max-width:400px;margin-top:12px">
            <mat-form-field appearance="outline">
              <mat-label>Tenant adı</mat-label>
              <input matInput formControlName="name" required />
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="tenantForm.invalid">Adı kaydet</button>
          </form>
          } @else {
          <p><strong>Ad:</strong> {{ tenant?.name || auth.me()?.user?.tenant_name }}</p>
          }
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header><mat-card-title>Hesabım</mat-card-title></mat-card-header>
        <mat-card-content>
          <p><strong>E-posta:</strong> {{ auth.me()?.user?.email }}</p>
          <p><strong>Rol:</strong> {{ auth.me()?.user?.department?.name }}</p>
          <h3>Modüller</h3>
          <mat-chip-set>
            @for (m of auth.me()?.enabled_modules || []; track m) {
            <mat-chip>{{ m }}</mat-chip>
            }
          </mat-chip-set>
          <h3>Yetkiler</h3>
          <mat-chip-set>
            @for (p of auth.me()?.permissions || []; track p) {
            <mat-chip>{{ p }}</mat-chip>
            }
          </mat-chip-set>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  auth = inject(AuthService);
  tenant: TenantProfile | null = null;

  tenantForm = this.fb.group({ name: ['', Validators.required] });

  ngOnInit(): void {
    this.http.get<TenantProfile>(`${API_BASE}/tenant/`).subscribe({
      next: (t) => {
        this.tenant = t;
        this.tenantForm.patchValue({ name: t.name });
      },
    });
  }

  canEditTenant(): boolean {
    return (
      this.auth.hasPermission('settings.write') ||
      this.auth.me()?.user?.department?.key === 'admin'
    );
  }

  saveTenant(): void {
    if (this.tenantForm.invalid) return;
    this.http
      .patch<TenantProfile>(`${API_BASE}/tenant/`, this.tenantForm.getRawValue())
      .subscribe({
        next: (t) => {
          this.tenant = t;
          this.snack.open('Tenant adı güncellendi', 'Tamam', { duration: 2000 });
          this.auth.refreshMe().subscribe();
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || 'Güncellenemedi', 'Tamam', { duration: 3000 }),
      });
  }
}
