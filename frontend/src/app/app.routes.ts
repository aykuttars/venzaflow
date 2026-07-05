import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { platformAuthGuard, platformGuestGuard } from './core/platform-auth.guard';
import { roleGuard } from './core/role.guard';

export const APP_ROUTES: Routes = [
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/platform/platform-login.component').then(
        (m) => m.PlatformLoginComponent
      ),
    canActivate: [platformGuestGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/platform/platform-layout.component').then(
        (m) => m.PlatformLayoutComponent
      ),
    canActivate: [platformAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tenants' },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/platform/platform-tenants.component').then(
            (m) => m.PlatformTenantsComponent
          ),
      },
      {
        path: 'tenants/:id/invoices',
        loadComponent: () =>
          import('./features/platform/platform-tenant-invoices.component').then(
            (m) => m.PlatformTenantInvoicesComponent
          ),
      },
      {
        path: 'tenants/:tenantId/integration',
        loadComponent: () =>
          import('./features/signing/signing-integration.component').then(
            (m) => m.SigningIntegrationComponent
          ),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./features/platform/platform-billing.component').then(
            (m) => m.PlatformBillingComponent
          ),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'eimza',
    loadComponent: () =>
      import('./features/signing/eimza-download-page.component').then(
        (m) => m.EimzaDownloadPageComponent
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'dashboard', permission: 'dashboard.read' },
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products.component').then(
            (m) => m.ProductsComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'products', permission: 'products.read' },
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory-shell.component').then(
            (m) => m.InventoryShellComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'inventory', permission: 'inventory.read' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/inventory/inventory.component').then(
                (m) => m.InventoryComponent
              ),
          },
          {
            path: 'barcode',
            loadComponent: () =>
              import('./features/barcode/barcode.component').then(
                (m) => m.BarcodeComponent
              ),
            canActivate: [roleGuard],
            data: { module: 'barcode', permission: 'barcode.scan', embedded: true },
          },
        ],
      },
      {
        path: 'barcode',
        loadComponent: () =>
          import('./features/barcode/barcode.component').then(
            (m) => m.BarcodeComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'barcode', permission: 'barcode.scan' },
      },
      {
        path: 'service',
        loadComponent: () =>
          import('./features/service/service.component').then(
            (m) => m.ServiceComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'service', permission: 'service.read' },
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./features/employees/employees.component').then(
            (m) => m.EmployeesComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'employees', permission: 'employees.read' },
      },
      {
        path: 'departments',
        loadComponent: () =>
          import('./features/departments/departments.component').then(
            (m) => m.DepartmentsComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'settings', permission: 'settings.read' },
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customers-shell.component').then(
            (m) => m.CustomersShellComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'customers', permission: 'customers.read' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/customers/customers.component').then(
                (m) => m.CustomersComponent
              ),
          },
          {
            path: 'patients',
            loadComponent: () =>
              import('./features/patients/patients.component').then(
                (m) => m.PatientsComponent
              ),
            canActivate: [roleGuard],
            data: { module: 'patients', permission: 'patients.read', embedded: true },
          },
        ],
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./features/patients/patients-shell.component').then(
            (m) => m.PatientsShellComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'patients', permission: 'patients.read' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/patients/patients.component').then(
                (m) => m.PatientsComponent
              ),
            data: { embedded: true },
          },
          {
            path: ':patientId/oral',
            loadComponent: () =>
              import('./features/oral/oral-chart.component').then(
                (m) => m.OralChartComponent
              ),
            canActivate: [roleGuard],
            data: { module: 'oral', permission: 'oral.read', embedded: true },
          },
        ],
      },
      {
        path: 'oral',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/oral/oral-page.component').then((m) => m.OralPageComponent),
            canActivate: [roleGuard],
            data: { module: 'oral', permission: 'oral.read' },
          },
          {
            path: ':patientId',
            loadComponent: () =>
              import('./features/oral/oral-page.component').then((m) => m.OralPageComponent),
            canActivate: [roleGuard],
            data: { module: 'oral', permission: 'oral.read' },
          },
        ],
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./features/appointments/appointments.component').then(
            (m) => m.AppointmentsComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'appointments', permission: 'appointments.read' },
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./features/billing/billing.component').then(
            (m) => m.BillingComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'billing', permission: 'billing.read' },
      },
      {
        path: 'accounting',
        loadComponent: () =>
          import('./features/accounting/accounting.component').then(
            (m) => m.AccountingComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'accounting', permission: 'accounting.read' },
      },
      {
        path: 'signing/integration',
        loadComponent: () =>
          import('./features/signing/signing-integration.component').then(
            (m) => m.SigningIntegrationComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'signing', permission: 'signing.read' },
      },
      {
        path: 'signing',
        loadComponent: () =>
          import('./features/signing/signing.component').then(
            (m) => m.SigningComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'signing', permission: 'signing.read' },
      },
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('./features/audit/audit.component').then(
            (m) => m.AuditComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'audit', permission: 'audit.read' },
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./features/sessions/sessions.component').then(
            (m) => m.SessionsComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'settings', permission: 'settings.read' },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'settings', permission: 'settings.read' },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
