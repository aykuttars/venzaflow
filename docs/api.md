# API catalogue (v1)

All endpoints are prefixed with `/api/v1/` and require `Authorization: Bearer <access-jwt>` unless noted.

## Auth (unauthenticated except `/me`)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/login/` | `{ customer_code, email, password }` | Returns `access`, `refresh`, `user`, `permissions`, `enabled_modules`, `default_language`, `subscription` (`max_users`, `active_users`, `subscribed_modules`). |
| POST | `/auth/refresh/` | `{ refresh }` | Returns a fresh `access` with tenant claims re-applied. |
| POST | `/auth/logout/` | `{ refresh }` | Blacklists the refresh token. |
| GET | `/auth/me/` |  | Current user + permissions + enabled modules. |

## Platform admin (`/platform/`)

Requires a platform JWT (`is_platform` claim). Sign in at UI `/admin/login`.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/platform/auth/login/` | `{ email, password }` | Platform super admin only (`tenant` null). |
| POST | `/platform/auth/refresh/` | `{ refresh }` | Refresh platform access token. |
| POST | `/platform/auth/logout/` | `{ refresh }` | Blacklist refresh token. |
| GET | `/platform/auth/me/` |  | Platform user profile. |
| GET/POST | `/platform/tenants/` | create: `customer_code`, `name`, `max_users` (default 5), `default_language`, `is_active`, `subscribed_modules`, `extra_modules`, `module_labels`, `initial_admin_email`, `initial_admin_password` | Tenant CRUD; module subscriptions + user limit. |
| GET/PATCH/DELETE | `/platform/tenants/{id}/` |  | Update `max_users`, subscriptions, labels, `billing_period`, `payment_currency`, `monthly_discount_percent`, `yearly_discount_percent`, `module_prices` (per-slug TRY override or `null` for global). Response includes `active_user_count`, `module_subscriptions[].price_per_user_monthly`. |
| GET | `/platform/tenants/{id}/subscription-invoices/can-generate/` |  | `can_generate`, current `period_start` / `period_end`, existing invoice if any. |
| GET/POST | `/platform/tenants/{id}/subscription-invoices/` | POST: optional `period_start`, `period_end`, `issue` | List invoices; generate (400 if current period already invoiced). |
| GET | `/platform/tenants/{id}/subscription-invoices/{invoice_id}/` |  | Invoice detail + lines + tax summary. |
| POST | `/platform/tenants/{id}/subscription-invoices/{invoice_id}/mark-paid/` | `{ method?, reference? }` | Mark invoice paid. |
| GET | `/platform/tenants/{id}/subscription-invoices/{invoice_id}/pdf/` |  | PDF download (e-arşiv-style). |
| GET/POST/PATCH | `/platform/billing/currencies/` |  | TRY, EUR, GBP, USD. |
| GET | `/platform/billing/exchange-rates/latest/` |  | Latest rate per active currency. |
| POST | `/platform/billing/exchange-rates/manual/` | `{ currency_code, rate_to_try }` | Manual rate override (e.g. USD). |
| CRUD | `/platform/billing/tax-types/`, `/tax-rates/`, `/module-prices/` |  | Master data. |
| GET/PATCH | `/platform/billing/settings/` |  | `default_monthly_discount_percent`, `yearly_discount_percent`, invoice prefix, company info. |

See [super-admin.md](super-admin.md), [subscriptions.md](subscriptions.md), and [platform-billing.md](platform-billing.md).

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
