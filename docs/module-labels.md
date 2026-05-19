# Tenant module display names

Module **slugs** (`products`, `customers`, `dashboard`, …) are fixed for RBAC and `enabled_modules`. Tenants can override only the **display name** shown in the UI.

## Storage

- Field: `Tenant.module_labels` — JSON object, e.g. `{"customers": "Hastalar"}`.
- Keys must be in `ALL_MODULES` (`backend/apps/common/permission_codes.py`).
- Values: non-empty strings, max 64 characters.

## API

| Endpoint | `module_labels` |
|----------|-----------------|
| `POST /auth/login/` | Included in response |
| `GET /auth/me/` | Included in response |
| `GET/PATCH /tenant/` | Read/write (PATCH: tenant admin or `settings.write`) |

Invalid slug → `400` with field errors.

## Frontend

- `ModuleLabelService.label(slug)` — tenant override, then `nav.*` / `modules.*` i18n, then slug.
- Sidebar, page headers (`moduleSlug` on `app-page-header`), permission picker groups use this service.
- **Settings → Modül adları** (admin): edit names per enabled module; **Varsayılana dön** clears one slug.

After PATCH, call `auth.refreshMe()` so the current session sees new labels immediately.

## i18n

Default labels come from `nav.*` and `modules.*` in `tr.json` / `en.json`. Custom names are not translated; they are stored as entered by the admin.

See also [i18n.md](./i18n.md).
