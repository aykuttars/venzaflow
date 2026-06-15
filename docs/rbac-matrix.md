# RBAC matrix

Permission codenames are global. Each tenant's `Department` is granted a subset.

## Permission codenames

| Codename | Description |
|----------|-------------|
| `settings.read` / `settings.write` | View / manage departments & tenant settings |
| `employees.read` / `employees.write` | View / manage employees |
| `products.read` / `products.write` | View / manage products & categories |
| `inventory.read` / `inventory.write` | View / manage warehouses, stock, movements |
| `customers.read` / `customers.write` | View / manage customers |
| `patients.read` / `patients.write` | View / manage medical records |
| `prescriptions.read` / `prescriptions.write` | View / manage SGK prescriptions (patients module) |
| `oral.read` / `oral.write` | View / manage oral chart, treatments & procedure catalog |
| `appointments.read` / `appointments.write` | View / manage appointments |
| `billing.read` / `billing.write` | View / manage invoices & payments |
| `accounting.read` / `accounting.write` | View / manage expenses & transactions |
| `dashboard.read` | View dashboard widgets |
| `audit.read` | View audit log |
| `signing.read` / `signing.write` | View / manage e-signature tasks & integration |

## Default departments

| Department | Codenames |
|-----------|-----------|
| Admin | all of the above |
| Technician | `products.{read,write}`, `inventory.{read,write}`, `dashboard.read` |
| Cashier | `billing.{read,write}`, `customers.read`, `dashboard.read` |
| Clinic Cashier | `billing.{read,write}`, `patients.read`, `oral.read`, `prescriptions.read`, `signing.read`, `dashboard.read` |
| Accounting | `accounting.{read,write}`, `billing.read`, `dashboard.read` |
| Security | `audit.read`, `dashboard.read`, `settings.read` |
| Doctor | `patients.{read,write}`, `prescriptions.{read,write}`, `oral.{read,write}`, `appointments.{read,write}`, `customers.read`, `dashboard.read` |
| Dentist | `patients.{read,write}`, `prescriptions.{read,write}`, `oral.{read,write}`, `appointments.{read,write}`, `dashboard.read` |

`apps/accounts/management/commands/seed_demo.py` provisions tenants `1000`/`3000`, departments per the spec, and the example users with the matching passwords.
