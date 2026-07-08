#!/bin/bash
set -euo pipefail

WRAPPER="/usr/bin/venzaflow-eimza"
BRAND_DIR="/opt/Venzaflow"
INSTALL_DIR="${BRAND_DIR}/eimza"
PACKAGE_DIR="/opt/eimza"
LEGACY_DIR="/opt/Venzaflow-e-imza"

if [[ -d "$LEGACY_DIR" && ! -d "$PACKAGE_DIR" ]]; then
  mv "$LEGACY_DIR" "$PACKAGE_DIR"
fi

mkdir -p "$BRAND_DIR"
ln -sfn "$PACKAGE_DIR" "$INSTALL_DIR"

cat > "$WRAPPER" << 'EOF'
#!/bin/sh
# Inherit DISPLAY from the active GNOME session when launched without a terminal.
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

APP="/opt/Venzaflow/eimza/eimza"
ARGS="--ozone-platform=x11 --disable-gpu --no-sandbox"

# Launched from a terminal: detach so closing the terminal does not kill the GUI.
if [ -t 0 ] || [ -t 1 ]; then
  nohup "$APP" $ARGS "$@" >/dev/null 2>&1 &
  exit 0
fi

exec "$APP" $ARGS "$@"
EOF
chmod 755 "$WRAPPER"

for desktop in /usr/share/applications/eimza.desktop /usr/share/applications/venzaflow-e-imza.desktop; do
  if [[ -f "$desktop" ]]; then
    sed -i 's|^Exec=.*|Exec=/usr/bin/venzaflow-eimza %U|' "$desktop"
    sed -i 's|^Name=.*|Name=Venzaflow e-imza|' "$desktop"
    grep -q '^Terminal=' "$desktop" || echo 'Terminal=false' >> "$desktop"
    sed -i 's|^Terminal=.*|Terminal=false|' "$desktop"
  fi
done

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database >/dev/null 2>&1 || true
fi

exit 0
