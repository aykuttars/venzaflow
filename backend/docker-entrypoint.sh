#!/usr/bin/env bash
set -euo pipefail

# Only the API container should migrate. Worker sets SKIP_MIGRATE=true to avoid
# concurrent migrate races (django_migrations / sequence conflicts).
if [ "${SKIP_MIGRATE:-false}" != "true" ]; then
  python manage.py migrate --noinput
fi

if [ "${SKIP_MIGRATE:-false}" != "true" ]; then
  python manage.py collectstatic --noinput 2>/dev/null || true
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  python manage.py seed_demo
fi

# Pick uvicorn config by environment.
ENV_MODE="${ENVIRONMENT:-prod}"
if [ "$ENV_MODE" = "dev" ]; then
  cp /app/uvicorn_dev.conf.py /app/uvicorn.conf.py
else
  cp /app/uvicorn_prod.conf.py /app/uvicorn.conf.py
fi

# If a command is provided (e.g. celery worker), exec it; otherwise launch uvicorn.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec python run_uvicorn.py --config /app/uvicorn.conf.py
