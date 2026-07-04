#!/usr/bin/env bash
# .env içindeki REGISTRY_USER / REGISTRY_PASSWORD → auth/htpasswd
#
#   cd /home/management/DockerFiles/artifacts-registry
#   ./scripts/setup-htpasswd.sh
#
# İlk kurulumda ve şifre değişince bir kez çalıştır; stack'te ayrı container gerekmez.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
AUTH_DIR="${ROOT}/auth"
HTPASSWD="${AUTH_DIR}/htpasswd"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Eksik: ${ENV_FILE} (.env.example'dan kopyala)" >&2
  exit 1
fi

REGISTRY_USER="$(grep '^REGISTRY_USER=' "$ENV_FILE" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")"
REGISTRY_PASSWORD="$(grep '^REGISTRY_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")"

if [[ -z "$REGISTRY_USER" || -z "$REGISTRY_PASSWORD" ]]; then
  echo "REGISTRY_USER ve REGISTRY_PASSWORD .env içinde tanımlı olmalı" >&2
  exit 1
fi

mkdir -p "$AUTH_DIR"

docker run --rm httpd:2-alpine \
  htpasswd -Bbn "$REGISTRY_USER" "$REGISTRY_PASSWORD" > "${HTPASSWD}.tmp"
mv "${HTPASSWD}.tmp" "$HTPASSWD"
chmod 644 "$HTPASSWD"

echo "OK: ${HTPASSWD}"
