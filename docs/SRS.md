# Software Requirements Specification — Venzaflow

## 1. Purpose

A modular business management SaaS for SMBs (dental clinics, retail, polyclinics, small companies with 20–40 employees). Each tenant owns isolated data and a per-tenant set of enabled modules.

## 2. Scope

- Authentication, RBAC, multi-tenant isolation
- Departments / role-based permissions
- Employees, Products, Inventory, Customers/Patients, Appointments
- Invoicing & Payments, Accounting (expenses, transactions, chart of accounts)
- Audit log
- Dashboard widgets
- REST API + OpenAPI/Swagger
- Angular web client

## 3. Stakeholders

- Tenant administrators (create users, configure roles)
- Cashier / Accounting / Doctor / Technician / Security / Admin roles per spec
- Internal operator (creates tenants, manages billing)

## 4. Functional requirements

| ID | Description |
|----|-------------|
| FR-01 | Users authenticate with `customer_code + email + password`. |
| FR-02 | API uses JWT (access + refresh, blacklist on logout). |
| FR-03 | Every API request is filtered by the caller's tenant; forged `tenant` payloads are ignored. |
| FR-04 | RBAC: each `Department` carries a permission-codename set; viewsets gate operations by codename. |
| FR-05 | Tenants have an `enabled_modules` list; modules outside this list are inaccessible. |
| FR-06 | Audit log records create/update/delete on all business models. |
| FR-07 | API supports filtering, ordering, search, and pagination on list endpoints. |

## 5. Non-functional requirements

- PostgreSQL 16+, Python 3.11+, Django 5, DRF, JWT.
- Stateless API behind nginx + gunicorn.
- HTTPS in production via reverse proxy.
- Horizontal scalability for backend and worker tiers; DB is the durability boundary.
- Backups via `pg_dump` on a daily schedule (operator owned).

## 6. Out of scope (V1)

- SSO/OAuth, full mobile app, multi-language UI, payment gateway integration, advanced BI.

## 7. Acceptance criteria

- `seed_demo` creates tenants `1000` and `3000` with the example users.
- Cross-tenant isolation tests pass: a tenant cannot read/update/delete another's data.
- `/api/docs/` renders Swagger UI.
- Angular client signs in with the demo credentials and renders the dashboard.
