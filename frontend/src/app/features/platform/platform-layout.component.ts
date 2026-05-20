import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslateModule } from '@ngx-translate/core';

import { PlatformAuthService } from '../../core/platform-auth.service';

@Component({
  selector: 'app-platform-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
  ],
  template: `
    <mat-sidenav-container class="platform-shell">
      <mat-sidenav mode="side" opened class="platform-shell__nav">
        <div class="platform-shell__brand">
          <mat-icon>admin_panel_settings</mat-icon>
          <span>{{ 'platform.title' | translate }}</span>
        </div>
        <mat-nav-list>
          <a mat-list-item routerLink="/admin/tenants" routerLinkActive="active">
            <mat-icon matListItemIcon>business</mat-icon>
            <span matListItemTitle>{{ 'platform.tenants' | translate }}</span>
          </a>
          <a mat-list-item routerLink="/admin/billing" routerLinkActive="active">
            <mat-icon matListItemIcon>payments</mat-icon>
            <span matListItemTitle>{{ 'platform.billing.title' | translate }}</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar color="primary" class="platform-shell__toolbar">
          <span>{{ 'platform.console' | translate }}</span>
          <span class="spacer"></span>
          <span class="platform-shell__email">{{ auth.me()?.user?.email }}</span>
          <button mat-button (click)="auth.logout()">
            <mat-icon>logout</mat-icon>
            {{ 'auth.logout' | translate }}
          </button>
        </mat-toolbar>
        <main class="platform-shell__main">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .platform-shell {
        height: 100vh;
      }
      .platform-shell__nav {
        width: 240px;
      }
      .platform-shell__brand {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 20px 16px 12px;
        font-weight: 600;
        font-size: 15px;
      }
      .platform-shell__toolbar .spacer {
        flex: 1;
      }
      .platform-shell__email {
        margin-right: 12px;
        font-size: 14px;
        opacity: 0.9;
      }
      .platform-shell__main {
        padding: 24px;
      }
      a.active {
        background: rgba(0, 0, 0, 0.06);
      }
    `,
  ],
})
export class PlatformLayoutComponent {
  protected auth = inject(PlatformAuthService);
}
