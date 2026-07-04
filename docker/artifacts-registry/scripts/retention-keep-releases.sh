#!/usr/bin/env bash
# Keep the last N release prefixes per repo (default: 2).
# Loads credentials from the server .env when run on MAN.
#
# Usage (local / CI):
#   ARTIFACT_REGISTRY_URL=https://artifacts.aykut.io \
#   ARTIFACT_REGISTRY_USER=... ARTIFACT_REGISTRY_PASSWORD=... \
#   ./retention-keep-releases.sh
#
# Dry run:
#   ... ./retention-keep-releases.sh --dry-run
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${REGISTRY_ENV_FILE:-/home/management/DockerFiles/artifacts-registry/.env}"

if [[ -f "$ENV_FILE" ]]; then
  REGISTRY_USER="${REGISTRY_USER:-$(grep '^REGISTRY_USER=' "$ENV_FILE" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")}"
  REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-$(grep '^REGISTRY_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//")}"
fi

export ARTIFACT_REGISTRY_URL="${ARTIFACT_REGISTRY_URL:-http://127.0.0.1:5099}"
export ARTIFACT_REGISTRY_USER="${ARTIFACT_REGISTRY_USER:-${REGISTRY_USER:-}}"
export ARTIFACT_REGISTRY_PASSWORD="${ARTIFACT_REGISTRY_PASSWORD:-${REGISTRY_PASSWORD:-}}"
export KEEP_RELEASES="${KEEP_RELEASES:-1}"
export RETENTION_MODE="${RETENTION_MODE:-per-platform}"

exec python3 "$SCRIPT_DIR/retention-keep-releases.py" \
  --repo venzaflow/eimza \
  --mode "$RETENTION_MODE" \
  --keep "$KEEP_RELEASES" \
  "$@"
