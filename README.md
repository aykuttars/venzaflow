# Business Management System (Modular SaaS)

Monorepo with **Django + DRF** backend and **Angular + Material** frontend. Multi-tenant row-level isolation via `tenant_id`, JWT auth (customer code + email + password), and RBAC.

## Structure

- `backend/` – Django 5, DRF, PostgreSQL, OpenAPI
- `frontend/` – Angular 18+, Material, NgRx
- `docker/` – Compose, Nginx, production-oriented setup
- `docs/` – Architecture, SRS, RBAC matrix, API notes

## Quick start (Docker)

```bash
cd docker && docker compose up --build
```

- API: `http://localhost/api/v1/` (Swagger: `http://localhost/api/docs/`)
- App: `http://localhost/`

Configure environment from `.env.example` in the repo root.

## Demo login

After `seed_demo` runs (automatically in compose or manually):

| Customer code | Email | Password | Role |
|---------------|-------|----------|------|
| 1000 | test@example.com | daeqwe3rt4yasd | Admin |
| 3000 | 123@example.com | das123 | Admin |

See `docs/seed-users.md` for the full list.

## Development (local)

**Backend (uvicorn):**
```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=config.settings.dev
python manage.py migrate
python manage.py seed_demo
cp uvicorn_dev.conf.py uvicorn.conf.py
python run_uvicorn.py --config uvicorn.conf.py
```

**Frontend:**
```bash
cd frontend && npm install && npm start
```

## License

Proprietary / internal use unless specified otherwise.
