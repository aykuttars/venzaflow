#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

has_display() {
  if [[ -n "${DISPLAY:-}" ]]; then
    return 0
  fi
  if command -v xvfb-run >/dev/null 2>&1 && [[ "${EBARCODE_FORCE_ELECTRON:-}" == "1" ]]; then
    return 0
  fi
  return 1
}

if has_display; then
  exec npx electron-vite dev
fi

echo ""
echo "⚠️  Electron GUI için ekran yok (Missing X server / \$DISPLAY)."
echo "    API remote'a gider; tarayıcıda UI testi için dev:web başlatılıyor…"
echo "    → http://localhost:5173"
echo "    Tam yazıcı testi: Mac/Windows'ta npm run dev veya kurulu .app"
echo ""

exec npx vite --config vite.web.config.ts
