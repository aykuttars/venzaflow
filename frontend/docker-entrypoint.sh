#!/bin/sh
set -eu

# Inject API_BASE into the runtime config served by nginx.
# Loaded by nginx:alpine's /docker-entrypoint.sh which iterates *.sh files.
API_BASE="${API_BASE:-/api/v1}"
TARGET=/usr/share/nginx/html/runtime-config.js

cat > "$TARGET" <<EOF
window.__APP_CONFIG__ = { apiBase: "${API_BASE}" };
EOF

echo "[runtime-config] apiBase=${API_BASE}"
