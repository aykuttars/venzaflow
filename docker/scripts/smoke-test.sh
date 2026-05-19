#!/usr/bin/env bash
set -euo pipefail
BASE="${SMOKE_BASE:-http://localhost}"
echo "Smoke: GET $BASE/health ..."
curl -sf "$BASE/health" | grep -q ok || { echo "proxy health failed"; exit 1; }
echo "Smoke: GET $BASE/api/v1/health/ ..."
curl -sf "$BASE/api/v1/health/" | grep -q healthy || { echo "API health failed"; exit 1; }
echo "OK"
