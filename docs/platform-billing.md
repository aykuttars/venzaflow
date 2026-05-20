# Platform subscription billing

Platform admins bill tenants for module subscriptions (separate from tenant-side customer invoicing in `apps.billing`).

## Pricing

1. For each **active** `TenantModuleSubscription`, charge `ModulePrice.price_per_user_monthly` (TRY) × `tenant.active_user_count()`.
2. **Monthly** contract: sum for one month.
3. **Yearly** contract: monthly sum × 12 × `(1 - discount/100)`. Discount is `Tenant.yearly_discount_percent` or `PlatformBillingSettings.yearly_discount_percent` (default 15%).
4. Convert TRY subtotal to `Tenant.payment_currency` using the latest `ExchangeRate.rate_to_try` (1 unit = X TRY).
5. Apply active `TaxRate` rows (v1: each rate on full subtotal; tax summary stored in `tax_lines` JSON).

## Exchange rates

- **TCMB:** Celery task `platform_billing.fetch_tcmb_exchange_rates` runs **at the start of every hour** (`crontab` minute `0`, timezone `TIME_ZONE`, default `Europe/Istanbul`) via **django-celery-beat** (`PeriodicTask` in DB; seeded by `seed_demo`). Parses `https://www.tcmb.gov.tr/kurlar/today.xml` for currencies with `Currency.tcmb_code` (USD, EUR, GBP). Edit schedule in Django admin under *Periodic tasks*.
- **Manual:** `POST /api/v1/platform/billing/exchange-rates/manual/` only when you need to override a rate (e.g. fallback).
- **TRY:** rate 1.

## Invoice lifecycle

| Status | Meaning |
|--------|---------|
| draft | Created, not issued |
| issued | Sent to tenant |
| paid | Payment recorded |
| overdue | (reserved) |
| cancelled | Void |

Generate: `POST /api/v1/platform/tenants/{id}/subscription-invoices/`  
Mark paid: `POST .../subscription-invoices/{id}/mark-paid/`  
PDF: `GET .../subscription-invoices/{id}/pdf/`

## API (platform admin JWT)

- `GET/POST/PATCH /api/v1/platform/billing/currencies/`
- `GET /api/v1/platform/billing/exchange-rates/latest/`
- `POST /api/v1/platform/billing/exchange-rates/manual/`
- CRUD `/api/v1/platform/billing/tax-types/`, `/tax-rates/`, `/module-prices/`
- `GET/PATCH /api/v1/platform/billing/settings/`
- Tenant invoices under `/api/v1/platform/tenants/{id}/subscription-invoices/`

## Seed

`python manage.py seed_demo` creates TRY/EUR/GBP/USD, KDV 20%, module prices, hourly TCMB periodic task, and sets demo tenants to monthly TRY billing.
