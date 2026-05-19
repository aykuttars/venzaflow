import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../auth.service';
import { ModuleLabelService } from '../module-label.service';

interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
  /** Module slug for hasModule() / RBAC. */
  module: string;
  /** When set, nav title uses this instead of module (e.g. departments → settings module). */
  labelSlug?: string;
  permission: string;
}

const NAV: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', module: 'dashboard', permission: 'dashboard.read' },
  { path: '/products', labelKey: 'nav.products', icon: 'inventory_2', module: 'products', permission: 'products.read' },
  { path: '/inventory', labelKey: 'nav.inventory', icon: 'warehouse', module: 'inventory', permission: 'inventory.read' },
  { path: '/employees', labelKey: 'nav.employees', icon: 'badge', module: 'employees', permission: 'employees.read' },
  { path: '/customers', labelKey: 'nav.customers', icon: 'people', module: 'customers', permission: 'customers.read' },
  { path: '/appointments', labelKey: 'nav.appointments', icon: 'event', module: 'appointments', permission: 'appointments.read' },
  { path: '/billing', labelKey: 'nav.billing', icon: 'receipt_long', module: 'billing', permission: 'billing.read' },
  { path: '/accounting', labelKey: 'nav.accounting', icon: 'savings', module: 'accounting', permission: 'accounting.read' },
  { path: '/audit-logs', labelKey: 'nav.auditLogs', icon: 'history', module: 'audit', permission: 'audit.read' },
  {
    path: '/departments',
    labelKey: 'nav.departments',
    labelSlug: 'departments',
    icon: 'admin_panel_settings',
    module: 'settings',
    permission: 'settings.read',
  },
  { path: '/settings', labelKey: 'nav.settings', icon: 'settings', module: 'settings', permission: 'settings.read' },
];

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    TranslateModule,
  ],
  template: `
    <mat-sidenav-container style="height:100vh">
      <mat-sidenav mode="side" opened style="width:240px">
        <div style="padding:16px; display:flex; align-items:center; gap:8px">
          <mat-icon>business</mat-icon>
          <strong>{{ 'app.title' | translate }}</strong>
        </div>
        <mat-divider></mat-divider>
        <mat-nav-list>
          @for (item of visibleNav; track item.path) {
          <a mat-list-item [routerLink]="item.path" routerLinkActive="active-link">
            <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ navLabel(item) }}</span>
          </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <span>{{ 'app.businessManagement' | translate }}</span>
          <span class="spacer"></span>
          <span style="font-size:13px; margin-right:12px">
            {{ auth.me()?.user?.tenant_name || ('app.title' | translate) }}
            ({{ auth.me()?.user?.tenant_code }}) —
            {{ auth.me()?.user?.department?.name }}
          </span>
          <button mat-icon-button [matMenuTriggerFor]="userMenu">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu>
            <button mat-menu-item disabled>{{ auth.me()?.user?.email }}</button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>{{ 'auth.logout' | translate }}</span>
            </button>
          </mat-menu>
        </mat-toolbar>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [` .active-link { background: rgba(63, 81, 181, 0.08); } `],
})
export class MainLayoutComponent {
  protected auth = inject(AuthService);
  private moduleLabels = inject(ModuleLabelService);
  private translate = inject(TranslateService);

  protected navLabel(item: NavItem): string {
    const displaySlug = item.labelSlug ?? item.module;
    if (displaySlug !== item.module) {
      const custom = this.auth.me()?.module_labels?.[displaySlug]?.trim();
      if (custom) return custom;
      const t = this.translate.instant(item.labelKey);
      return t !== item.labelKey ? t : displaySlug;
    }
    return this.moduleLabels.label(item.module);
  }

  protected get visibleNav(): NavItem[] {
    return NAV.filter(
      (n) => this.auth.hasModule(n.module) && this.auth.hasPermission(n.permission)
    );
  }

  protected logout(): void {
    this.auth.logout();
  }
}
