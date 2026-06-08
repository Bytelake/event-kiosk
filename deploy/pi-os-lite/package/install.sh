#!/usr/bin/env bash
#
# Install Event Kiosk from a pre-built release package.
# Safe by design: SSH stays enabled, getty@tty1 is restored if the display stops,
# and uninstall.sh removes everything.
#
# Usage:
#   tar -xzf event-kiosk-pi-*.tar.gz
#   cd event-kiosk-pi-*
#   sudo bash install.sh
#
# Options:
#   --web-only     Install backend only (no fullscreen display) — safest for testing
#   --with-display Install backend + touchscreen display (default)
#   --rotation     Display rotation: normal | left | right | inverted (default: normal)
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
WITH_DISPLAY=true
DISPLAY_ROTATION="normal"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"

log() { echo "[install] $*"; }
die() { echo "[install] ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-only) WITH_DISPLAY=false; shift ;;
    --with-display) WITH_DISPLAY=true; shift ;;
    --rotation=*)
      DISPLAY_ROTATION="${1#*=}"
      shift
      ;;
    --rotation)
      [[ $# -ge 2 ]] || die "--rotation requires a value (normal, left, right, inverted)"
      DISPLAY_ROTATION="$2"
      shift 2
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash install.sh"

if [[ -d "${INSTALL_DIR}/web" ]] || [[ -f "$(kiosk_db_file)" ]]; then
  die "Existing installation detected. Use update.sh to upgrade without losing data:
  sudo bash update.sh"
fi

log "Installing Event Kiosk to ${INSTALL_DIR}..."
log "Persistent data will be stored in ${KIOSK_DATA_DIR}"

# ---------------------------------------------------------------------------
# 1. System packages (no build-essential — nothing is compiled on the Pi)
# ---------------------------------------------------------------------------
log "Installing system packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl ca-certificates gnupg rsync \
  cage seatd libseat1 kbd wlr-randr \
  libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 \
  libatk1.0-0 libatk-bridge2.0-0 libdrm2 libgbm1 libasound2 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
  libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
  fonts-liberation xdg-utils

# Node.js 20
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p "process.versions.node.split('.')[0]")" -lt 20 ]]; then
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
log "Node $(node -v)"

# ---------------------------------------------------------------------------
# 2. kiosk user
# ---------------------------------------------------------------------------
if ! id kiosk &>/dev/null; then
  useradd -m -s /bin/bash kiosk
fi
usermod -aG video,input kiosk
for g in render seat tty; do
  getent group "${g}" >/dev/null && usermod -aG "${g}" kiosk || true
done
loginctl enable-linger kiosk 2>/dev/null || true

# ---------------------------------------------------------------------------
# 3. Copy application files
# ---------------------------------------------------------------------------
log "Copying application to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
rsync -a --delete \
  --exclude prisma-tools/ \
  --exclude shell/node_modules/ \
  "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
chmod +x "${INSTALL_DIR}/bin/"*.sh \
  "${INSTALL_DIR}/install.sh" \
  "${INSTALL_DIR}/update.sh" \
  "${INSTALL_DIR}/uninstall.sh" \
  "${INSTALL_DIR}/diagnose.sh"
chmod +x "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}/fix-prisma.sh" "${INSTALL_DIR}/fix-permissions.sh" 2>/dev/null || true
chown -R kiosk:kiosk "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 4. Persistent data directory (outside /opt/kiosk)
# ---------------------------------------------------------------------------
migrate_to_data_dir "${INSTALL_DIR}"
write_env_if_missing "${INSTALL_DIR}/web/.env.example"
write_display_env_if_missing "${INSTALL_DIR}/display.env.example"

if [[ "${DISPLAY_ROTATION}" != "normal" ]]; then
  log "Setting display rotation to ${DISPLAY_ROTATION}..."
  KIOSK_DATA_DIR="${KIOSK_DATA_DIR}" bash "${INSTALL_DIR}/bin/set-display-rotation.sh" --set "${DISPLAY_ROTATION}"
fi

# ---------------------------------------------------------------------------
# 5. Database init (isolated Prisma install — never npm install in web/node_modules)
# ---------------------------------------------------------------------------
log "Initializing database..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 6. Electron shell (downloads Linux ARM Electron binary only)
# ---------------------------------------------------------------------------
log "Installing Electron for Pi (one-time download)..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${INSTALL_DIR}/shell'
  npm install --omit=dev
"

chown -R kiosk:kiosk "${INSTALL_DIR}" "${KIOSK_DATA_DIR}"

# ---------------------------------------------------------------------------
# 7. systemd services
# ---------------------------------------------------------------------------
log "Installing systemd services..."
cp "${INSTALL_DIR}/systemd/kiosk-web.service" /etc/systemd/system/
cp "${INSTALL_DIR}/systemd/kiosk-display.service" /etc/systemd/system/

# Free tty1 for the kiosk display (login prompt conflicts with cage)
if [[ "${WITH_DISPLAY}" == true ]]; then
  log "Disabling getty on tty1 for kiosk display..."
  systemctl stop getty@tty1.service 2>/dev/null || true
  systemctl disable getty@tty1.service 2>/dev/null || true
fi

systemctl daemon-reload
systemctl enable kiosk-web.service

if [[ "${WITH_DISPLAY}" == true ]]; then
  systemctl enable kiosk-display.service
  log "Display service enabled (touchscreen kiosk on boot)."
else
  systemctl disable kiosk-display.service 2>/dev/null || true
  systemctl stop kiosk-display.service 2>/dev/null || true
  log "Web-only mode — open http://<pi-ip>:3000/kiosk in a browser to test."
fi

systemctl enable seatd.service
systemctl start seatd.service
systemctl restart kiosk-web.service
[[ "${WITH_DISPLAY}" == true ]] && systemctl restart kiosk-display.service || true

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
IP="$(hostname -I | awk '{print $1}')"
log ""
log "Installation complete."
log ""
log "  Admin:  http://${IP}:3000/admin"
log "  Kiosk:  http://${IP}:3000/kiosk"
log ""
log "  Edit password:  sudo nano $(kiosk_env_file)"
log "  Then restart:   sudo systemctl restart kiosk-web"
log ""
log "  Portrait display: sudo nano $(kiosk_display_env)"
log "                      sudo ${INSTALL_DIR}/bin/set-display-rotation.sh --set left"
log "                      sudo systemctl restart kiosk-display"
log ""
log "  Diagnostics:    sudo bash ${INSTALL_DIR}/diagnose.sh"
log "  Uninstall:      sudo bash ${INSTALL_DIR}/uninstall.sh"
log ""
log "Recovery: SSH always works. If the screen is blank, press Ctrl+Alt+F2"
log "          for a normal login, or run: sudo bash ${INSTALL_DIR}/uninstall.sh"
