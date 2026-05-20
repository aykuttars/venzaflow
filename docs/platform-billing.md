# Platform subscription billing

Platform admins bill tenants for module subscriptions (separate from tenant-side customer invoicing in `apps.billing`).

## Pricing

1. For each **active** `TenantModuleSubscription`, charge per-user monthly TRY:
   - **Tenant override:** `TenantModuleSubscription.price_per_user_monthly` when set.
   - **Else global:** `ModulePrice.price_per_user_monthly` for that `module_slug`.
2. **Monthly** contract: sum for one month; discount from `Tenant.monthly_discount_percent` or `PlatformBillingSettings.default_monthly_discount_percent` (default 0%).
3. **Yearly** contract: monthly sum × 12; discount from `Tenant.yearly_discount_percent` or `PlatformBillingSettings.yearly_discount_percent` (default 15%).
4. Discount applies when percent &gt; 0 (snapshot on invoice: `subtotal_before_discount`, `discount_percent`, `discount_amount`).
5. Convert TRY subtotal to `Tenant.payment_currency` using the latest `ExchangeRate.rate_to_try` (1 unit = X TRY).
6. Apply active `TaxRate` rows (v1: each rate on full subtotal; tax summary stored in `tax_lines` JSON).

**Platform admin:** set global module prices and default discounts at `/admin/billing`. Per-tenant overrides and discounts are on the tenant edit dialog (`module_prices`, `monthly_discount_percent`, `yearly_discount_percent`).

## Billing period (invoice dates)

`period_start` / `period_end` are **not** calendar month/year. They are anchored to the tenant’s **registration date** (`Tenant.created_at`, local date):

- **Monthly:** from anniversary day through +1 month −1 day (e.g. registered 15 Jan → 15 Jan–14 Feb).
- **Yearly:** from anniversary through +1 year −1 day (e.g. 15 Mar 2026–14 Mar 2027).

Optional `period_start` / `period_end` on generate API override this window.

## Invoice PDF

- **Tarih:** `issued_at`, else `paid_at`, else `created_at` (with time).
- **Lines:** list unit price, discount %, net line total (KDV hariç).
- **Totals:** subtotal before discount, discount amount (% snapshot), subtotal after discount, tax table, grand total.
- Yearly discount % and amounts are **snapshotted** on the invoice at generation time.

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

Generate: `POST /api/v1/platform/tenants/{id}/subscription-invoices/` (blocked if an invoice already exists for the current billing period)  
Can generate: `GET /api/v1/platform/tenants/{id}/subscription-invoices/can-generate/`  
Mark paid: `POST .../subscription-invoices/{id}/mark-paid/`  
PDF: `GET .../subscription-invoices/{id}/pdf/`

**Billing period** is anchored to the tenant’s registration date (`created_at`): monthly = registration anniversary +1 month; yearly = +1 year (not calendar month/year).

**Automatic generation:** Celery task `platform_billing.generate_subscription_invoices` runs daily at **03:00** (`TIME_ZONE`, default `Europe/Istanbul`) via django-celery-beat (`platform-billing-generate-invoices` on `{env}_billing` queue). Creates issued invoices for active tenants that have a payment currency and no invoice yet for the current period.

## API (platform admin JWT)

- `GET/POST/PATCH /api/v1/platform/billing/currencies/`
- `GET /api/v1/platform/billing/exchange-rates/latest/`
- `POST /api/v1/platform/billing/exchange-rates/manual/`
- CRUD `/api/v1/platform/billing/tax-types/`, `/tax-rates/`, `/module-prices/`
- `GET/PATCH /api/v1/platform/billing/settings/`
- Tenant invoices under `/api/v1/platform/tenants/{id}/subscription-invoices/`

## Seed

`python manage.py seed_demo` creates TRY/EUR/GBP/USD, KDV 20%, module prices, hourly TCMB periodic task, and sets demo tenants to monthly TRY billing.
