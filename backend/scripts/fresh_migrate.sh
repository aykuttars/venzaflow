#!/usr/bin/env bash
# Apply migrations on an empty database (API container).
# For migrate + seed: ./scripts/reset_db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
python manage.py migrate --noinput
echo "Migrations applied. Run: python manage.py seed_demo (or ./scripts/reset_db.sh)"
