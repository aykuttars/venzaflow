#!/usr/bin/env bash
# Build all release artifacts sequentially (one arch at a time).
#
# pkcs11js is a native module — it cannot be cross-compiled (e.g. win-arm64 on macOS).
#   macOS host:  mac arm64 + mac x64 + win x64
#   Windows host: win x64 + win arm64
#   Linux host:  linux x64 + arm64
#
# Usage:
#   ./scripts/release.sh           # platform defaults
#   ./scripts/release.sh --clean   # wipe release/ before building
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=true ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/release.sh [--clean]

Builds release installers for the current host OS (native arch targets only).

  macOS:    eimza-*-mac-arm64.dmg, eimza-*-mac-x64.dmg, eimza-*-setup-x64.exe
  Windows:  eimza-*-setup-x64.exe, eimza-*-setup-arm64.exe
  Linux:    eimza-*-linux-x64.AppImage, eimza-*-linux-arm64.AppImage

Windows ARM64 cannot be built on macOS (pkcs11js native module).
Build win-arm64 on a Windows machine or use CI (see .github/workflows/build.yml).
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

log() { printf '\n==> %s\n' "$*"; }
skip() { printf '    [skip] %s\n' "$*"; }

OS="$(uname -s)"
TARGETS=()
SKIPPED=()

case "$OS" in
  Darwin)
    TARGETS+=("mac:arm64" "mac:x64" "win:x64")
    SKIPPED+=("win:arm64 (native module — build on Windows or CI)")
    ;;
  MINGW* | MSYS* | CYGWIN* | Windows_NT)
    TARGETS+=("win:x64" "win:arm64")
    ;;
  Linux)
    TARGETS+=("linux:x64" "linux:arm64")
    ;;
  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

if [[ "$CLEAN" == true ]]; then
  log "Cleaning release/"
  rm -rf release
  mkdir -p release
fi

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  log "Skipped targets on ${OS}:"
  for s in "${SKIPPED[@]}"; do skip "$s"; done
fi

log "Installing dependencies"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "Typecheck + bundle (electron-vite)"
npm run build

VERSION="$(node -p "require('./package.json').version")"
log "Packaging eimza v${VERSION} on ${OS} — ${#TARGETS[@]} target(s)"

FAILED=()
for target in "${TARGETS[@]}"; do
  platform="${target%%:*}"
  arch="${target##*:}"
  log "electron-builder --${platform} --${arch}"
  if ! npx electron-builder "--${platform}" "--${arch}"; then
    FAILED+=("${platform}-${arch}")
    echo "FAILED: ${platform} ${arch}" >&2
  fi
done

log "Release artifacts in ${ROOT}/release/"
ls -lh release/*.{dmg,exe,AppImage} 2>/dev/null || ls -lh release/ 2>/dev/null || true

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "" >&2
  echo "Some targets failed: ${FAILED[*]}" >&2
  exit 1
fi

log "Done."
