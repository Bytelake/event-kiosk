#!/usr/bin/env bash
#
# Install Event Kiosk from a pre-built release package (Debian/Ubuntu).
#
# Usage:
#   tar -xzf event-kiosk-debian-*.tar.gz
#   cd event-kiosk-debian-*
#   sudo bash install.sh
#
# Options:
#   --web-only              Backend only (no fullscreen display)
#   --display=wayland|x11   Display mode (default: wayland)
#   --rotation VALUE        normal | left | right | inverted
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
WITH_DISPLAY=true
DISPLAY_MODE="wayland"
DISPLAY_ROTATION="normal"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"
# shellcheck source=lib/helpers.sh
source "${SCRIPT_DIR}/lib/helpers.sh"

log() { echo "[install] $*"; }
die() { echo "[install] ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-only) WITH_DISPLAY=false; shift ;;
    --with-display) WITH_DISPLAY=true; shift ;;
    --display=*)
      DISPLAY_MODE="${1#*=}"
      shift
      ;;
    --display)
      [[ $# -ge 2 ]] || die "--display requires wayland or x11"
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

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash install.sh"
debian_check_os || die "Unsupported operating system"

if has_existing_install; then
  die "Existing installation detected. Use update.sh to upgrade:
  sudo bash update.sh"
fi

log "Installing Event Kiosk to ${INSTALL_DIR}..."
log "Persistent data will be stored in ${KIOSK_DATA_DIR}"

debian_install_packages false
debian_install_node
debian_setup_kiosk_user

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
  "${INSTALL_DIR}/diagnose.sh" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}/fix-prisma.sh" "${INSTALL_DIR}/fix-permissions.sh" 2>/dev/null || true
chown -R kiosk:kiosk "${INSTALL_DIR}"

ensure_data_dir
write_env_if_missing "${INSTALL_DIR}/web/.env.example"
write_display_env_if_missing "${INSTALL_DIR}/display.env.example"

if [[ "${DISPLAY_ROTATION}" != "normal" ]]; then
  log "Setting display rotation to ${DISPLAY_ROTATION}..."
  KIOSK_DATA_DIR="${KIOSK_DATA_DIR}" bash "${INSTALL_DIR}/bin/set-display-rotation.sh" --set "${DISPLAY_ROTATION}"
fi

log "Initializing database..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}"

log "Installing Electron shell..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${INSTALL_DIR}/shell'
  npm install --omit=dev
"

chown -R kiosk:kiosk "${INSTALL_DIR}" "${KIOSK_DATA_DIR}"

log "Installing systemd services..."
debian_install_systemd "${DISPLAY_MODE}" "${WITH_DISPLAY}" "${INSTALL_DIR}"
debian_apply_pi_boot_tweaks

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
log "  Diagnostics:    sudo bash ${INSTALL_DIR}/diagnose.sh"
log "  Uninstall:      sudo bash ${INSTALL_DIR}/uninstall.sh"
