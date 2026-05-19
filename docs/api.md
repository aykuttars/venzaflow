# API catalogue (v1)

All endpoints are prefixed with `/api/v1/` and require `Authorization: Bearer <access-jwt>` unless noted.

## Auth (unauthenticated except `/me`)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/login/` | `{ customer_code, email, password }` | Tenant code + email (no separate username). Returns `access`, `refresh`, `user`, `permissions`, `enabled_modules`, `default_language`. |
| POST | `/auth/refresh/` | `{ refresh }` | Returns a fresh `access` with tenant claims re-applied. |
| POST | `/auth/logout/` | `{ refresh }` | Blacklists the refresh token. |
| GET | `/auth/me/` |  | Current user + permissions + enabled modules. |

## Core CRUD endpoints

All support `?search=`, `?ordering=` (`-field` for desc), and `?limit=&offset=` pagination.

| Resource | Path |
|----------|------|
| Departments | `/departments/` |
| Employees | `/employees/` |
| Categories | `/products/categories/` |
| Products | `/products/` |
| Warehouses | `/inventory/warehouses/` |
| Stock | `/inventory/stock/` |
| Stock movements | `/inventory/movements/` |
| Customers (and patients) | `/customers/` (filter `?kind=customer\|patient`) |
| Medical records | `/medical-records/` |
| Appointments | `/appointments/` |
| Schedules | `/schedules/` |
| Invoices | `/billing/invoices/` |
| Payments | `/billing/payments/` |
| Accounts (chart of) | `/accounting/accounts/` |
| Expenses | `/accounting/expenses/` |
| Transactions | `/accounting/transactions/` |

## Dashboard

| GET | `/dashboard/summary/` | Aggregated metrics for the current tenant. |

## Audit

| GET | `/audit/` | Recent audit log entries (Admin/Security only). |

## OpenAPI

- Schema: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`
