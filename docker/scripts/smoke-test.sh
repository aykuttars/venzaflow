#!/usr/bin/env bash
set -euo pipefail
API="${SMOKE_API:-http://localhost:8001}"
WEB="${SMOKE_WEB:-http://localhost:8081}"
echo "Smoke: API $API/api/v1/health/ ..."
curl -sf "$API/api/v1/health/" | grep -q healthy || { echo "API health failed"; exit 1; }
echo "Smoke: WEB $WEB/ ..."
curl -sf -o /dev/null "$WEB/" || { echo "Web index failed"; exit 1; }
echo "Smoke: WEB $WEB/runtime-config.js ..."
curl -sf "$WEB/runtime-config.js" | grep -q apiBase || { echo "runtime-config missing"; exit 1; }
echo OK
