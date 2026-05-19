import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

import { AuthService } from '../../core/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header title="Settings" icon="settings"></app-page-header>
      <mat-card>
        <mat-card-header><mat-card-title>Tenant</mat-card-title></mat-card-header>
        <mat-card-content>
          <p><strong>Code:</strong> {{ auth.me()?.user?.tenant_code }}</p>
          <p><strong>Email:</strong> {{ auth.me()?.user?.email }}</p>
          <p><strong>Role:</strong> {{ auth.me()?.user?.department?.name }}</p>
          <h3>Enabled modules</h3>
          <mat-chip-set>
            @for (m of auth.me()?.enabled_modules || []; track m) {
              <mat-chip>{{ m }}</mat-chip>
            }
          </mat-chip-set>
          <h3>Permissions</h3>
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
export class SettingsComponent {
  auth = inject(AuthService);
}
