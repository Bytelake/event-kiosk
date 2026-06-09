#!/usr/bin/env bash
#
# Install Event Kiosk on Fedora Atomic (Desktop or IoT).
#
# Usage:
#   sudo bash deploy/fedora-atomic/install.sh [--web-only] [--display=wayland|session] [--rotation left]
#
# Environment:
#   KIOSK_WEB_IMAGE  Container image for the web backend (default: ghcr.io/bytelake/event-kiosk-web:latest)
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
WITH_DISPLAY=true
DISPLAY_MODE=""
DISPLAY_ROTATION="normal"
WEB_IMAGE="${KIOSK_WEB_IMAGE:-ghcr.io/bytelake/event-kiosk-web:latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=../common/kiosk-paths.sh
source "${REPO_ROOT}/deploy/common/kiosk-paths.sh"

log() { echo "[fedora-atomic] $*"; }
die() { echo "[fedora-atomic] ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-only) WITH_DISPLAY=false; shift ;;
    --display=*)
      DISPLAY_MODE="${1#*=}"
      shift
      ;;
    --display)
      [[ $# -ge 2 ]] || die "--display requires wayland or session"
      DISPLAY_MODE="$2"
      shift 2
      ;;
    --rotation=*)
      DISPLAY_ROTATION="${1#*=}"
      shift
      ;;
    --rotation)
      [[ $# -ge 2 ]] || die "--rotation requires a value"
      DISPLAY_ROTATION="$2"
      shift 2
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash deploy/fedora-atomic/install.sh"

if [[ ! -f /run/ostree-booted ]]; then
  die "Not an ostree/Atomic system (/run/ostree-booted missing)"
fi

# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID}" == "fedora" ]] || die "Expected Fedora Atomic (ID=fedora, got ${ID})"

VARIANT="${VARIANT_ID:-desktop}"
if [[ -z "${DISPLAY_MODE}" ]]; then
  if [[ "${VARIANT}" == "iot" ]]; then
    DISPLAY_MODE="wayland"
  else
    DISPLAY_MODE="session"
  fi
fi

log "Fedora Atomic variant: ${VARIANT}, display mode: ${DISPLAY_MODE}"

if has_existing_install; then
  die "Existing installation detected. Remove /opt/kiosk and /var/lib/kiosk first, or run uninstall.sh."
fi

LAYER_OUT="$(bash "${SCRIPT_DIR}/layer-packages.sh" "${DISPLAY_MODE}" "${VARIANT}" || true)"
if echo "${LAYER_OUT}" | grep -q "REBOOT_REQUIRED=1"; then
  log ""
  log "New packages were layered. Reboot, then re-run this installer:"
  log "  sudo systemctl reboot"
  log "  sudo bash deploy/fedora-atomic/install.sh"
  exit 0
fi

if ! id kiosk &>/dev/null; then
  useradd -m -s /bin/bash kiosk
fi
usermod -aG video,input kiosk
for g in render seat; do
  getent group "${g}" >/dev/null && usermod -aG "${g}" kiosk || true
done
loginctl enable-linger kiosk 2>/dev/null || true

log "Building Electron shell from source..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${REPO_ROOT}'
  npm install --legacy-peer-deps
  npm run build --workspace=shell
"

log "Staging host files to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}/shell/dist" "${INSTALL_DIR}/bin" "${INSTALL_DIR}/systemd" "${INSTALL_DIR}/web/prisma"
cp -R "${REPO_ROOT}/apps/shell/dist/." "${INSTALL_DIR}/shell/dist/"
cp "${REPO_ROOT}/apps/shell/package.json" "${INSTALL_DIR}/shell/package.json"
cp "${REPO_ROOT}/apps/shell/src/registration-chrome.html" "${INSTALL_DIR}/shell/dist/registration-chrome.html"
cp "${REPO_ROOT}/apps/shell/src/registration-keyboard.html" "${INSTALL_DIR}/shell/dist/registration-keyboard.html"
rsync -a --exclude dev.db --exclude dev.db-journal \
  "${REPO_ROOT}/apps/web/prisma/" "${INSTALL_DIR}/web/prisma/"
cp "${REPO_ROOT}/apps/web/.env.example" "${INSTALL_DIR}/web/.env.example"
cp "${REPO_ROOT}/deploy/common/bin/"*.sh "${INSTALL_DIR}/bin/"
cp "${REPO_ROOT}/deploy/common/systemd/kiosk-display.service" "${INSTALL_DIR}/systemd/"
cp "${REPO_ROOT}/deploy/common/systemd/kiosk-shell.service" "${INSTALL_DIR}/systemd/"
cp "${REPO_ROOT}/deploy/common/kiosk-paths.sh" "${INSTALL_DIR}/kiosk-paths.sh"
cp "${REPO_ROOT}/deploy/common/setup-db.sh" "${INSTALL_DIR}/setup-db.sh"
cp "${REPO_ROOT}/deploy/common/diagnose.sh" "${INSTALL_DIR}/diagnose.sh"
cp "${REPO_ROOT}/deploy/common/display.env.example" "${INSTALL_DIR}/display.env.example"
chmod +x "${INSTALL_DIR}/bin/"*.sh "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}/diagnose.sh"

chown -R kiosk:kiosk "${INSTALL_DIR}"
migrate_to_data_dir "${INSTALL_DIR}"
write_env_if_missing "${INSTALL_DIR}/web/.env.example"
write_display_env_if_missing "${INSTALL_DIR}/display.env.example"

if [[ "${DISPLAY_ROTATION}" != "normal" ]]; then
  KIOSK_DATA_DIR="${KIOSK_DATA_DIR}" bash "${INSTALL_DIR}/bin/set-display-rotation.sh" --set "${DISPLAY_ROTATION}"
fi

bash "${SCRIPT_DIR}/selinux-contexts.sh" "${INSTALL_DIR}" "${KIOSK_DATA_DIR}"

log "Initializing database on host..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}"

log "Installing Electron on host..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${INSTALL_DIR}/shell'
  npm install --omit=dev
"

chown -R kiosk:kiosk "${INSTALL_DIR}" "${KIOSK_DATA_DIR}"

log "Installing Podman Quadlet for web backend..."
mkdir -p /etc/containers/systemd
sed "s|ghcr.io/bytelake/event-kiosk-web:latest|${WEB_IMAGE}|g" \
  "${SCRIPT_DIR}/quadlet/kiosk-web.container" > /etc/containers/systemd/kiosk-web.container

systemctl disable kiosk-web.service 2>/dev/null || true
rm -f /etc/systemd/system/kiosk-web.service

systemctl daemon-reload
systemctl enable kiosk-web.service

if [[ "${WITH_DISPLAY}" == "true" ]]; then
  if [[ "${DISPLAY_MODE}" == "wayland" ]]; then
    cp "${INSTALL_DIR}/systemd/kiosk-display.service" /etc/systemd/system/
    systemctl disable kiosk-shell.service 2>/dev/null || true
    systemctl stop getty@tty1.service 2>/dev/null || true
    systemctl disable getty@tty1.service 2>/dev/null || true
    systemctl enable seatd.service 2>/dev/null || true
    systemctl start seatd.service 2>/dev/null || true
    systemctl enable kiosk-display.service
  else
    cp "${INSTALL_DIR}/systemd/kiosk-shell.service" /etc/systemd/system/
    systemctl disable kiosk-display.service 2>/dev/null || true
    systemctl enable kiosk-shell.service
  fi
fi

systemctl start kiosk-web.service || log "Web container starting (pull may take a minute)..."
if [[ "${WITH_DISPLAY}" == "true" ]]; then
  if [[ "${DISPLAY_MODE}" == "wayland" ]]; then
    systemctl restart kiosk-display.service || true
  else
    systemctl restart kiosk-shell.service || true
  fi
fi

IP="$(hostname -I | awk '{print $1}')"
log ""
log "Installation complete."
log "  Web image: ${WEB_IMAGE}"
log "  Admin:     http://${IP}:3000/admin"
log "  Config:    sudo nano $(kiosk_env_file)"
log "  Pull web:  sudo podman pull ${WEB_IMAGE}"
