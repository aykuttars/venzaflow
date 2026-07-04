#!/usr/bin/env bash
# Drop all tables in public schema and rebuild from squashed migrations + demo seed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Dropping all public tables…"
python manage.py shell <<'PY'
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    )
    tables = [row[0] for row in cursor.fetchall()]
    if tables:
        joined = ", ".join(f'"{t}"' for t in tables)
        cursor.execute(f"DROP TABLE IF EXISTS {joined} CASCADE")
print(f"Dropped {len(tables)} tables.")
PY

echo "==> Applying migrations…"
python manage.py migrate --noinput

echo "==> Loading provinces…"
python manage.py load_turkish_provinces

echo "==> Seeding demo data (4500, 1000, …)…"
python manage.py seed_demo

echo "Done: fresh schema + seed_demo"
