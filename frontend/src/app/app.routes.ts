import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';

export const APP_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
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
          import('./features/inventory/inventory.component').then(
            (m) => m.InventoryComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'inventory', permission: 'inventory.read' },
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
          import('./features/customers/customers.component').then(
            (m) => m.CustomersComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'customers', permission: 'customers.read' },
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
        path: 'audit-logs',
        loadComponent: () =>
          import('./features/audit/audit.component').then(
            (m) => m.AuditComponent
          ),
        canActivate: [roleGuard],
        data: { module: 'audit', permission: 'audit.read' },
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
