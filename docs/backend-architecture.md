# Backend architecture

```
backend/
  config/                    Django project (settings, urls, wsgi)
    settings/base.py         shared settings (REST framework, JWT, DB, CORS)
    settings/dev.py          DEBUG=True
    settings/prod.py         secure cookies, env-driven hosts
    api_urls.py              v1 router + auth/dashboard/audit/docs
  apps/
    tenants/                 Tenant, TenantOwnedModel, TenantScopedManager, middleware
    accounts/                User, Department, Permission, login/me/refresh/logout
    common/                  TenantScopedViewSet, permission_codes
    employees/               Employee
    products/                Category, Product, PriceHistory
    inventory/               Warehouse, Stock, StockMovement (signal updates qty)
    customers/               Customer (kind=customer|patient), MedicalRecord
    appointments/            Schedule, Appointment
    billing/                 Invoice (+lines), Payment
    accounting/              Account, Expense, Transaction
    audit/                   django-auditlog registration + list endpoint
    dashboard/               aggregation endpoint
```

## Runtime

- ASGI app exposed at `config.asgi:application`.
- Served by **uvicorn** (`backend/run_uvicorn.py` loads `uvicorn.conf.py` which is copied from `uvicorn_prod.conf.py` or `uvicorn_dev.conf.py` based on `ENVIRONMENT`). Multi-worker in prod, single-worker autoreload in dev.
- Celery (3 processes, famlotto-style): **api** (HTTP), **celery** (worker), **celery-beat** (scheduler). Broker: RabbitMQ (`RABBITMQ_*`). Results + beat schedules: Postgres via **django-celery-results** / **django-celery-beat**. Queue prefix from `ENVIRONMENT` (`prod_default`, `prod_billing`; `platform_billing.*` routes to `${ENV}_billing`). Periodic tasks in Django admin; `seed_demo` registers hourly TCMB on the billing queue.
- WebSocket: **Django Channels** wired into the same uvicorn ASGI app. `config/routing.py` holds `websocket_urlpatterns` (empty for now). Redis-backed channel layer via `REDIS_*` env vars; ready for real-time features (invoice notifications, dashboard pushes) without further infra changes.

## Layers

- **Models** inherit `TenantOwnedModel` (FK to `Tenant`, default manager filters by current tenant).
- **Managers** — `TenantScopedManager` reads thread-local set by middleware; `AllTenantsManager` exposed as `<Model>.all_tenants`.
- **Serializers** — DRF `ModelSerializer`s; sensitive write fields like `tenant` are stamped server-side.
- **ViewSets** extend `TenantScopedViewSet`, declare `required_module` (slug) and `action_permission_map` (action → codename). Authorization uses DRF permission classes `HasModule` + `HasViewPermission`.
- **Authentication** — `TenantJWTAuthentication` extends SimpleJWT and verifies the JWT `tenant_id` claim matches the user's row.
- **Middleware** — `TenantContextMiddleware` runs after auth, binds current tenant to thread-local for managers.
- **Audit** — `django-auditlog` registered for all business + accounts models; entries scoped per tenant via `actor.tenant_id` join.
- **OpenAPI** — `drf-spectacular` at `/api/schema/` and `/api/docs/`.
