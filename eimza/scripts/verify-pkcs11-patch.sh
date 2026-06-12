#!/usr/bin/env bash
# Ensure the AKİS C_Initialize(NULL) patch is applied before rebuilding pkcs11js.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/node_modules/pkcs11js/src/pkcs11.cpp"

if [[ ! -f "$SRC" ]]; then
  echo "verify-pkcs11-patch: pkcs11js source not found (run npm ci first)" >&2
  exit 1
fi

if grep -q 'PATCH (eimza)' "$SRC"; then
  echo "verify-pkcs11-patch: AKİS C_Initialize patch present"
  exit 0
fi

if grep -q 'if (pInitArgs == nullptr)' "$SRC"; then
  echo "verify-pkcs11-patch: unpatched pkcs11js — run: npx patch-package" >&2
  exit 1
fi

echo "verify-pkcs11-patch: cannot verify pkcs11js patch state" >&2
exit 1
