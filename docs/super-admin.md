# Super Admin (Platform) Panel

Platform administrators manage **tenants** and which **modules** each tenant can use. They do not use tenant-scoped business data (products, customers, etc.).

## URLs

| UI | API |
|----|-----|
| `/admin/login` | `POST /api/v1/platform/auth/login/` |
| `/admin/tenants` | `GET/POST /api/v1/platform/tenants/` |
| | `PATCH/DELETE /api/v1/platform/tenants/{id}/` |

Tenant users continue to sign in at `/login` with **customer code + email + password**.

## First platform admin

After migrations:

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py create_platform_admin \
  --email admin@platform.local \
  --password 'YourSecurePass1!'
```

Or run demo seed (includes `aykutt.ars@gmail.com` with the same password as demo tenant users):

```bash
python manage.py seed_demo
```

## Creating a tenant

1. Sign in at `/admin/login`.
2. Open **Tenants** → **New tenant**.
3. Fill customer code, name, language, active flag.
4. Select **module access** checkboxes.
5. Optionally set custom module display names.
6. Provide **initial admin** email and password (creates tenant `admin` department with full permissions and one staff user).

The initial admin can then sign in at `/login` with the new customer code.

## Security model

- Platform users: `is_superuser=True`, `tenant=NULL`.
- JWT includes `is_platform: true` and no `tenant_id`.
- `/api/v1/platform/*` requires a platform token.
- Tenant APIs require a tenant-scoped token; platform tokens are rejected by module/permission checks.

## Module slugs

Allowed values match [`ALL_MODULES`](../backend/apps/common/permission_codes.py):  
`settings`, `employees`, `products`, `inventory`, `customers`, `patients`, `appointments`, `billing`, `accounting`, `dashboard`, `audit`.
