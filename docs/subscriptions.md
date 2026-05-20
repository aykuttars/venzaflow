# Tenant subscriptions and user limits

## Overview

Each tenant has:

- **`max_users`** — maximum active staff accounts (default **5**).
- **Module subscriptions** — rows in `tenant_module_subscription` controlling which modules the tenant may use.

Platform admins manage both at `/admin/tenants`. Tenants cannot change their own limits.

## User limit

- Counts **active** users (`is_active=True`) on the tenant.
- Enforced when creating employees (`POST /api/v1/employees/`) and when reactivating a user.
- Platform admin can raise `max_users` in the tenant edit dialog (cannot set below current active count).

Login and `/auth/me` return:

```json
"subscription": {
  "max_users": 5,
  "active_users": 3,
  "subscribed_modules": ["products", "dashboard"]
}
```

The employees UI shows `3/5` and disables **New employee** when the limit is reached.

## Module subscriptions

- Each subscribed module is stored as `TenantModuleSubscription` (`module_slug`, `is_active`, `is_extra`, `activated_at`, `expires_at`).
- Active subscriptions are synced to `Tenant.enabled_modules` for backward compatibility with RBAC and the tenant app.
- **`is_extra`** marks modules granted beyond a base package (visible in platform admin).
- **`expires_at`** is reserved for future billing; when null, the subscription does not expire.

API access uses `HasModule`, which checks active subscriptions (and falls back to `enabled_modules` during migration).

## Platform admin workflow

1. Sign in at `/admin/login`.
2. Create or edit a tenant.
3. Set **Max users** (default 5 for new tenants).
4. Enable modules and optionally mark **Extra module** per slug.
5. Save — subscriptions and `enabled_modules` update together.

## Platform subscription billing

Platform admins bill tenants for module subscriptions (prices per user/month, taxes, FX, PDF invoices). Managed at `/admin/billing` and per-tenant **Invoices**. See [platform-billing.md](platform-billing.md).

Not in scope yet:

- Payment gateway (Stripe, etc.)
- Self-service upgrades by tenants
- GİB e-arşiv / e-fatura XML submission

Hook points: `TenantModuleSubscription.expires_at`, `is_extra`, and platform-only writes to `max_users`.
