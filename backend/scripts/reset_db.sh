#!/usr/bin/env bash
# Fresh PostgreSQL schema + Django migrations + demo seed.
# Requires: DB empty or dropped (see below).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python manage.py migrate --noinput
python manage.py seed_demo
echo "Done: migrate + seed_demo"
