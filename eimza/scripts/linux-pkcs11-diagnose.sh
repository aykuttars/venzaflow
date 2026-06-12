#!/usr/bin/env bash
# Quick PKCS#11 / AKİS diagnostics on Ubuntu/Debian Linux.
set -euo pipefail

echo "== PC/SC daemon =="
systemctl is-active pcscd 2>/dev/null || echo "pcscd: inactive"
groups "${SUDO_USER:-$USER}" 2>/dev/null | grep -q scard && echo "user in scard group: yes" || echo "user in scard group: NO (run: sudo usermod -aG scard $USER)"

echo ""
echo "== AKİS library =="
found=0
for p in \
  /opt/Akia/libakisp11.so \
  /usr/lib/libakisp11.so \
  /usr/local/lib/libakisp11.so \
  /usr/lib/x86_64-linux-gnu/libakisp11.so \
  /usr/lib64/libakisp11.so; do
  if [[ -f "$p" ]]; then
    echo "  OK  $p"
    found=1
  fi
done
if [[ "$found" -eq 0 ]]; then
  echo "  MISSING — install libakisp11.so from TÜBİTAK AKİS package"
fi

echo ""
echo "== OpenSC (fallback, AKİS kartını okumaz) =="
ls -l /usr/lib/x86_64-linux-gnu/opensc-pkcs11.so 2>/dev/null || echo "  not installed"

echo ""
echo "== Smart card reader =="
if command -v pcsc_scan >/dev/null; then
  timeout 5 pcsc_scan 2>/dev/null || echo "  (no card detected in 5s — token takılı mı?)"
else
  echo "  install pcsc-tools: sudo apt install pcsc-tools"
fi

echo ""
echo "== pkcs11-tool test (AKİS) =="
AKIS=/opt/Akia/libakisp11.so
[[ -f "$AKIS" ]] || AKIS=/usr/lib/libakisp11.so
if [[ -f "$AKIS" ]] && command -v pkcs11-tool >/dev/null; then
  pkcs11-tool --module "$AKIS" --list-slots 2>&1 || true
  echo "--- certificates ---"
  pkcs11-tool --module "$AKIS" --list-objects --type cert 2>&1 || true
else
  echo "  skip (libakisp11.so or pkcs11-tool missing)"
fi
