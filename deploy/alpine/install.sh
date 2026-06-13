#!/usr/bin/env bash
#
# Install Event Kiosk from source on Alpine Linux.
#
# Usage:
#   sudo bash deploy/alpine/install.sh [--web-only] [--display=wayland|x11] [--rotation left]
#
set -euo pipefail

KIOSK_INSTALL_DIR="/opt/kiosk"
WITH_DISPLAY=true
DISPLAY_MODE="wayland"
DISPLAY_ROTATION="normal"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=../common/kiosk-paths.sh
source "${REPO_ROOT}/deploy/common/kiosk-paths.sh"
# shellcheck source=lib/helpers.sh
source "${SCRIPT_DIR}/lib/helpers.sh"

log() { echo "[alpine] $*"; }
die() { echo "[alpine] ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-only) WITH_DISPLAY=false; shift ;;
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

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash deploy/alpine/install.sh"
alpine_check_os || die "Unsupported operating system"

if has_existing_install; then
  die "Existing installation detected at ${KIOSK_INSTALL_DIR}. Use update from a release package."
fi

log "Installing Event Kiosk from source to ${KIOSK_INSTALL_DIR}..."

alpine_install_packages true "${WITH_DISPLAY}" "${DISPLAY_MODE}"
alpine_install_node
alpine_setup_kiosk_user

log "Building application (this may take several minutes)..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  export ELECTRON_SKIP_BINARY_DOWNLOAD=1
  cd '${REPO_ROOT}'
  npm install --legacy-peer-deps
  npm run build --workspace=web
  npm run build --workspace=shell
"

log "Staging files to ${KIOSK_INSTALL_DIR}..."
mkdir -p "${KIOSK_INSTALL_DIR}/web" "${KIOSK_INSTALL_DIR}/shell/dist"
STANDALONE="${REPO_ROOT}/apps/web/.next/standalone"
cp -R "${STANDALONE}/." "${KIOSK_INSTALL_DIR}/web/"
rm -rf "${KIOSK_INSTALL_DIR}/web/node_modules/@prisma" "${KIOSK_INSTALL_DIR}/web/node_modules/.prisma" 2>/dev/null || true
mkdir -p "${KIOSK_INSTALL_DIR}/web/apps/web/.next"
cp -R "${REPO_ROOT}/apps/web/.next/static" "${KIOSK_INSTALL_DIR}/web/apps/web/.next/static"
mkdir -p "${KIOSK_INSTALL_DIR}/web/prisma"
rsync -a --exclude dev.db --exclude dev.db-journal \
  "${REPO_ROOT}/apps/web/prisma/" "${KIOSK_INSTALL_DIR}/web/prisma/"
cp "${REPO_ROOT}/apps/web/.env.example" "${KIOSK_INSTALL_DIR}/web/.env.example"

cp -R "${REPO_ROOT}/apps/shell/dist/." "${KIOSK_INSTALL_DIR}/shell/dist/"
cp "${REPO_ROOT}/apps/shell/package.json" "${KIOSK_INSTALL_DIR}/shell/package.json"
cp "${REPO_ROOT}/apps/shell/src/registration-chrome.html" "${KIOSK_INSTALL_DIR}/shell/dist/registration-chrome.html"
cp "${REPO_ROOT}/apps/shell/src/registration-keyboard.html" "${KIOSK_INSTALL_DIR}/shell/dist/registration-keyboard.html"

alpine_stage_common_files "${REPO_ROOT}" "${KIOSK_INSTALL_DIR}"

chown -R kiosk:kiosk "${KIOSK_INSTALL_DIR}"

ensure_data_dir
write_env_if_missing "${KIOSK_INSTALL_DIR}/web/.env.example"
write_display_env_if_missing "${KIOSK_INSTALL_DIR}/display.env.example"

if [[ "${DISPLAY_ROTATION}" != "normal" ]]; then
  KIOSK_DATA_DIR="${KIOSK_DATA_DIR}" bash "${KIOSK_INSTALL_DIR}/bin/set-display-rotation.sh" --set "${DISPLAY_ROTATION}"
fi

bash "${KIOSK_INSTALL_DIR}/setup-db.sh" "${KIOSK_INSTALL_DIR}"

if [[ "${WITH_DISPLAY}" == "true" ]]; then
  alpine_install_shell_npm "${KIOSK_INSTALL_DIR}"
fi

chown -R kiosk:kiosk "${KIOSK_INSTALL_DIR}" "${KIOSK_DATA_DIR}"

alpine_install_services "${DISPLAY_MODE}" "${WITH_DISPLAY}" "${KIOSK_INSTALL_DIR}"

IP="$(alpine_primary_ip)"
RESTART_HINT="$(alpine_service_restart_hint)"
log ""
log "Installation complete."
log "  Admin: http://${IP}:3000/admin"
log "  Config: sudo nano $(kiosk_env_file)"
log "  Restart: ${RESTART_HINT}"
