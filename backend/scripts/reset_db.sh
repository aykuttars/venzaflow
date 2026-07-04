#!/usr/bin/env bash
# Fresh PostgreSQL schema + Django migrations + demo seed.
# Requires: DB reachable; drops ALL data in public schema.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec "$ROOT/scripts/recreate_db.sh"
