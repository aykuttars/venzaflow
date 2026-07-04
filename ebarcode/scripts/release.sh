#!/usr/bin/env bash
# Build all release artifacts sequentially (one arch at a time).
#
# Usage:
#   ./scripts/release.sh           # platform defaults
#   ./scripts/release.sh --clean   # wipe release/ before building
#
# See .github/workflows/ebarcode-build.yml for all CI targets.
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

  macOS:    venzaflow-ebarcode-*-mac-arm64.dmg, venzaflow-ebarcode-*-mac-x64.dmg
  Windows:  venzaflow-ebarcode-*-setup-x64.exe, venzaflow-ebarcode-*-setup-arm64.exe
  Linux:    venzaflow-ebarcode-*-linux-x64.AppImage, venzaflow-ebarcode-*-linux-arm64.AppImage

Cross-platform builds require matching hardware or GitHub Actions CI.
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
    TARGETS+=("mac:arm64" "mac:x64")
    SKIPPED+=("win:x64 (build on Windows or CI)")
    SKIPPED+=("win:arm64 (build on Windows or CI)")
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

log "Typecheck and bundle"
npm run build

VERSION="$(node -p "require('./package.json').version")"
log "Packaging ebarcode v${VERSION} on ${OS} — ${#TARGETS[@]} target(s)"

FAILED=()
for target in "${TARGETS[@]}"; do
  platform="${target%%:*}"
  arch="${target##*:}"
  log "electron-builder --${platform} --${arch}"
  if ! npx electron-builder "--${platform}" "--${arch}"; then
    FAILED+=("${platform}-${arch}")
    echo "FAILED: ${platform} ${arch}" >&2
    continue
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
