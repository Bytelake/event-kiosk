#!/usr/bin/env bash
#
# Raspberry Pi OS Lite — kiosk installer
#
# Installs system packages, Node.js 20, copies the app to /opt/kiosk, builds it,
# enables the web backend via systemd, and configures tty1 autologin + cage.
#
# Usage (on the Pi, from the project directory):
#   sudo bash deploy/pi-os-lite/install.sh
#
# Or if the project is already at /opt/kiosk:
#   sudo bash /opt/kiosk/deploy/pi-os-lite/install.sh
#
set -euo pipefail

KIOSK_INSTALL_DIR="/opt/kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

log() { echo "[pi-os-lite] $*"; }
die() { echo "[pi-os-lite] ERROR: $*" >&2; exit 1; }

if [[ $EUID -ne 0 ]]; then
  die "Run as root: sudo bash deploy/pi-os-lite/install.sh"
fi

if ! grep -qi "raspbian\|debian" /etc/os-release 2>/dev/null; then
  log "Warning: this script is intended for Raspberry Pi OS / Debian. Continuing anyway."
fi

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
log "Updating package lists..."
apt-get update

log "Installing system packages (cage, seatd, Electron dependencies)..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl \
  ca-certificates \
  gnupg \
  git \
  rsync \
  build-essential \
  cage \
  seatd \
  wlr-randr \
  libseat1 \
  libgtk-3-0 \
  libnotify4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libgbm1 \
  libasound2 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libgdk-pixbuf-2.0-0 \
  fonts-liberation \
  xdg-utils \
  unclutter \
  kbd

# ---------------------------------------------------------------------------
# 2. Node.js 20
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p "process.versions.node.split('.')[0]")" -lt 20 ]]; then
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

NODE_VERSION="$(node -v)"
log "Node.js version: ${NODE_VERSION}"

# ---------------------------------------------------------------------------
# 3. kiosk user
# ---------------------------------------------------------------------------
log "Creating kiosk user..."
if ! id kiosk &>/dev/null; then
  useradd -m -s /bin/bash kiosk
fi

usermod -aG video,input kiosk
for group in render seat; do
  if getent group "${group}" >/dev/null 2>&1; then
    usermod -aG "${group}" kiosk
  fi
done

# Persistent runtime dir for Wayland
loginctl enable-linger kiosk 2>/dev/null || true

# ---------------------------------------------------------------------------
# 4. Copy application to /opt/kiosk
# ---------------------------------------------------------------------------
if [[ "${SOURCE_DIR}" != "${KIOSK_INSTALL_DIR}" ]]; then
  log "Copying application to ${KIOSK_INSTALL_DIR}..."
  mkdir -p "${KIOSK_INSTALL_DIR}"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude apps/web/prisma/dev.db \
    --exclude apps/web/prisma/dev.db-journal \
    --exclude .git \
    "${SOURCE_DIR}/" "${KIOSK_INSTALL_DIR}/"
fi

chown -R kiosk:kiosk "${KIOSK_INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 5. Configure environment
# ---------------------------------------------------------------------------
ENV_FILE="${KIOSK_INSTALL_DIR}/apps/web/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  log "Creating ${ENV_FILE} from example — edit before production use."
  cp "${KIOSK_INSTALL_DIR}/apps/web/.env.example" "${ENV_FILE}"
  chown kiosk:kiosk "${ENV_FILE}"
fi

# ---------------------------------------------------------------------------
# 6. Build application (as kiosk user)
# ---------------------------------------------------------------------------
log "Installing npm dependencies and building (this may take several minutes on a Pi)..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${KIOSK_INSTALL_DIR}'
  npm install --legacy-peer-deps
  npm run db:push --workspace=web
  npm run db:seed --workspace=web
  npm run build --workspace=web
  npm run build --workspace=shell
"

# Uploads directory for event images
mkdir -p "${KIOSK_INSTALL_DIR}/apps/web/public/uploads"
chown -R kiosk:kiosk "${KIOSK_INSTALL_DIR}/apps/web/public/uploads"

# ---------------------------------------------------------------------------
# 7. Executable helper scripts
# ---------------------------------------------------------------------------
chmod +x "${KIOSK_INSTALL_DIR}/deploy/pi-os-lite/start-kiosk-display.sh"
chmod +x "${KIOSK_INSTALL_DIR}/deploy/pi-os-lite/start-kiosk-wayland.sh"
chmod +x "${KIOSK_INSTALL_DIR}/deploy/pi-os-lite/kiosk-wayland-session.sh"
chmod +x "${KIOSK_INSTALL_DIR}/deploy/pi-os-lite/set-display-rotation.sh"
if [[ ! -f "${KIOSK_INSTALL_DIR}/display.env" ]]; then
  cp "${KIOSK_INSTALL_DIR}/deploy/pi-os-lite/display.env.example" "${KIOSK_INSTALL_DIR}/display.env"
  chown kiosk:kiosk "${KIOSK_INSTALL_DIR}/display.env"
fi

# ---------------------------------------------------------------------------
# 8. systemd — web backend + display
# ---------------------------------------------------------------------------
log "Installing systemd services..."
cp "${KIOSK_INSTALL_DIR}/deploy/pi-os-lite/kiosk-web.service" /etc/systemd/system/kiosk-web.service
cp "${KIOSK_INSTALL_DIR}/deploy/pi-os-lite/kiosk-display.service" /etc/systemd/system/kiosk-display.service

# Disable generic X11 shell service if previously installed
systemctl disable kiosk-shell.service 2>/dev/null || true
systemctl stop kiosk-shell.service 2>/dev/null || true

# Free tty1 for the kiosk display (getty login prompt conflicts with cage)
log "Disabling getty on tty1 so the display service can use the screen..."
systemctl stop getty@tty1.service 2>/dev/null || true
systemctl disable getty@tty1.service 2>/dev/null || true
rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf

systemctl daemon-reload
systemctl enable kiosk-web.service kiosk-display.service

# ---------------------------------------------------------------------------
# 9. seatd (required by cage on Pi OS Lite)
# ---------------------------------------------------------------------------
log "Enabling seatd..."
systemctl enable seatd.service
systemctl start seatd.service

# ---------------------------------------------------------------------------
# 10. Power / screen blanking lockdown
# ---------------------------------------------------------------------------
log "Disabling suspend and screen blanking..."
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true

# Pi firmware cmdline — prevent console blanking
CMDLINE=""
for candidate in /boot/firmware/cmdline.txt /boot/cmdline.txt; do
  if [[ -f "${candidate}" ]]; then
    CMDLINE="${candidate}"
    break
  fi
done

if [[ -n "${CMDLINE}" ]] && ! grep -q "consoleblank=0" "${CMDLINE}"; then
  log "Adding consoleblank=0 to ${CMDLINE}"
  sed -i 's/$/ consoleblank=0/' "${CMDLINE}"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
log ""
log "Installation complete."
log ""
log "Next steps:"
log "  1. Edit secrets:  sudo nano ${ENV_FILE}"
log "     Set ADMIN_PASSWORD, SESSION_SECRET, and Breeze credentials."
log "  2. Start services: sudo systemctl start kiosk-web kiosk-display"
log "  3. Reboot:         sudo reboot"
log ""
log "After reboot, kiosk-display.service launches cage + Electron on the screen."
log "Admin panel (from another device): http://<pi-ip-address>:3000/admin"
log ""
log "Useful commands:"
log "  sudo systemctl status kiosk-web kiosk-display"
log "  sudo journalctl -u kiosk-display -f"
log "  curl http://localhost:3000/kiosk"
