#!/usr/bin/env bash
# Apply migrations on a clean database (API container only).
set -euo pipefail
cd "$(dirname "$0")/.."
python manage.py migrate --noinput
echo "Migrations applied. Run: python manage.py seed_demo"
