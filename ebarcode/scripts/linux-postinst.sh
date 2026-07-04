#!/bin/bash
set -euo pipefail

WRAPPER="/usr/bin/venzaflow-ebarcode"
INSTALL_DIR="/opt/Venzaflow-e-barcode"

cat > "$WRAPPER" << 'EOF'
#!/bin/sh
if [ -z "${DISPLAY:-}" ]; then
  for pid in $(pgrep -u "$(id -u)" -x gnome-shell 2>/dev/null) $(pgrep -u "$(id -u)" gnome-session 2>/dev/null); do
    found=$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | sed -n 's/^DISPLAY=//p' | head -1)
    if [ -n "$found" ]; then
      export DISPLAY="$found"
      break
    fi
  done
fi
export GDK_BACKEND=x11

APP="/opt/Venzaflow-e-barcode/ebarcode"
ARGS="--ozone-platform=x11 --disable-gpu --no-sandbox"

if [ -t 0 ] || [ -t 1 ]; then
  nohup "$APP" $ARGS "$@" >/dev/null 2>&1 &
  exit 0
fi

exec "$APP" $ARGS "$@"
EOF
chmod 755 "$WRAPPER"

for desktop in /usr/share/applications/ebarcode.desktop /usr/share/applications/venzaflow-ebarcode.desktop; do
  if [[ -f "$desktop" ]]; then
    sed -i 's|^Exec=.*|Exec=/usr/bin/venzaflow-ebarcode %U|' "$desktop"
    sed -i 's|^Name=.*|Name=Venzaflow e-barcode|' "$desktop"
    grep -q '^Terminal=' "$desktop" || echo 'Terminal=false' >> "$desktop"
    sed -i 's|^Terminal=.*|Terminal=false|' "$desktop"
  fi
done

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database >/dev/null 2>&1 || true
fi

exit 0
