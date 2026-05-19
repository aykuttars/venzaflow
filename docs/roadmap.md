# Sprint roadmap

- **Sprint 1 — Foundation:** monorepo, Docker, Postgres 16, Django bootstrap with shared schema, `Tenant` + `TenantOwnedModel` + tenant context middleware, Angular + Material bootstrap, CI, OpenAPI skeleton. (done)
- **Sprint 2 — Auth & RBAC:** tenant-scoped `User`, `Department`, `Permission`, login `(customer_code, email, password)`, JWT with tenant claims, refresh, logout (blacklist), interceptor, guards, role-aware sidebar, `seed_demo`, cross-tenant isolation tests. (done)
- **Sprint 3 — Employees + Departments admin UI.** (done — basic list views)
- **Sprint 4 — Products + Inventory + low-stock + product/inventory UI.** (done — full CRUD for Products)
- **Sprint 5 — Customers/Patients + Appointments + scheduling UI.** (done — list views)
- **Sprint 6 — Billing (invoices, payments).** (done — backend + list UI)
- **Sprint 7 — Accounting (expenses, transactions, basic reports).** (done — backend + list UI)
- **Sprint 8 — Audit log + dashboard widgets + search/filter polish.** (done)
- **Sprint 9 — Swagger polish, production compose, gunicorn+nginx, backup notes, README, smoke tests.** (done)

## Follow-up work (V2)

- Full CRUD modals + form validation for every feature (currently parity is highest for Products).
- Charts: revenue over time, AR aging, stock turnover.
- Per-tenant module purchase / billing.
- SSO (OIDC/SAML), MFA, password reset flow.
- Mobile-responsive enhancements (current layout already adapts to medium widths).
