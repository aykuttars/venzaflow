#!/usr/bin/env bash
# Verify pkcs11.node matches the target platform after electron-builder packaging.
# Prevents shipping macOS Mach-O binaries inside Windows installers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

platform="${1:?usage: verify-pkcs11-binary.sh <mac|win|linux> [arch]}"
arch="${2:-}"

case "$platform" in
  mac) expected='Mach-O' ;;
  win) expected='PE32' ;;
  linux) expected='ELF' ;;
  *)
    echo "Unknown platform: $platform" >&2
    exit 1
    ;;
esac

find_in_tree() {
  local root="$1"
  find "$root" -name 'pkcs11.node' 2>/dev/null | head -1
}

extract_linux_appimage() {
  local appimage="$1"
  local extract_root="$ROOT/.appimage-extract-$$"
  rm -rf "$extract_root"
  mkdir -p "$extract_root"
  chmod +x "$appimage"
  (cd "$extract_root" && "$appimage" --appimage-extract >/dev/null)
  find_in_tree "$extract_root/squashfs-root"
}

discover_pkcs11_node() {
  local node_path=""

  node_path="$(find_in_tree release)"
  if [[ -n "$node_path" ]]; then
    echo "$node_path"
    return 0
  fi

  if [[ "$platform" == "linux" ]]; then
    local appimage
    appimage="$(find release -maxdepth 1 -name '*.AppImage' -type f 2>/dev/null | head -1)"
    if [[ -n "$appimage" ]]; then
      node_path="$(extract_linux_appimage "$appimage")"
      rm -rf "$ROOT/.appimage-extract-"* 2>/dev/null || true
      if [[ -n "$node_path" ]]; then
        echo "$node_path"
        return 0
      fi
    fi
  fi

  return 1
}

if ! node_path="$(discover_pkcs11_node)"; then
  echo "verify-pkcs11-binary: pkcs11.node not found for ${platform}" >&2
  echo "release/ tree:" >&2
  find release -maxdepth 4 \( -type d -o -name 'pkcs11.node' -o -name '*.AppImage' \) 2>/dev/null | head -60 >&2 || true
  exit 1
fi

kind="$(file -b "$node_path")"
echo "pkcs11.node: $node_path"
echo "  format: $kind"

if ! echo "$kind" | grep -qi "$expected"; then
  echo "" >&2
  echo "ERROR: pkcs11.node is not a valid ${platform} native binary." >&2
  echo "Expected format containing '${expected}', got: ${kind}" >&2
  echo "" >&2
  echo "Native modules cannot be cross-compiled. Build ${platform} installers on ${platform}." >&2
  exit 1
fi

if [[ -n "$arch" ]]; then
  case "$arch" in
    arm64)
      if ! echo "$kind" | grep -qiE 'arm64|aarch64|ARM64'; then
        echo "ERROR: expected arm64 binary, got: ${kind}" >&2
        exit 1
      fi
      ;;
    x64)
      if ! echo "$kind" | grep -qiE 'x86_64|x86-64|x64|Intel 80386|AMD64'; then
        echo "ERROR: expected x64 binary, got: ${kind}" >&2
        exit 1
      fi
      ;;
  esac
fi

echo "  OK"
