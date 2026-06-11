#!/usr/bin/env bash
# Verify pkcs11.node matches the target platform after electron-builder packaging.
# Prevents shipping macOS Mach-O binaries inside Windows installers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

platform="${1:?usage: verify-pkcs11-binary.sh <mac|win|linux> [arch]}"
arch="${2:-}"

find_pkcs11_node() {
  local pattern="$1"
  find release -path "$pattern" -name 'pkcs11.node' 2>/dev/null | head -1
}

case "$platform" in
  mac)
    node_path="$(find_pkcs11_node "*/mac*/eimza.app/*")"
    expected='Mach-O'
    ;;
  win)
    node_path="$(find_pkcs11_node "*/win-unpacked/*")"
    if [[ -z "$node_path" ]]; then
      node_path="$(find_pkcs11_node "*/win-*/resources/*")"
    fi
    expected='PE32'
    ;;
  linux)
    node_path="$(find_pkcs11_node "*/linux-unpacked/*")"
    expected='ELF'
    ;;
  *)
    echo "Unknown platform: $platform" >&2
    exit 1
    ;;
esac

if [[ -z "$node_path" || ! -f "$node_path" ]]; then
  echo "verify-pkcs11-binary: pkcs11.node not found for ${platform}" >&2
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
