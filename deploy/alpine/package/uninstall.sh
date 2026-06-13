#!/usr/bin/env bash
#
# Remove Event Kiosk and restore normal console login on tty1.
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
KIOSK_DATA_DIR="/var/lib/kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/helpers.sh
source "${SCRIPT_DIR}/lib/helpers.sh"

log() { echo "[uninstall] $*"; }

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo bash uninstall.sh"; exit 1; }

log "Stopping kiosk services..."
alpine_stop_services

read -r -p "Remove application files in ${INSTALL_DIR}? [y/N] " REPLY
if [[ "${REPLY}" =~ ^[Yy]$ ]]; then
  rm -rf "${INSTALL_DIR}"
  log "Removed ${INSTALL_DIR}"
else
  log "Left ${INSTALL_DIR} in place."
fi

read -r -p "Remove persistent data in ${KIOSK_DATA_DIR} (database, uploads, config)? [y/N] " REPLY
if [[ "${REPLY}" =~ ^[Yy]$ ]]; then
  rm -rf "${KIOSK_DATA_DIR}"
  log "Removed ${KIOSK_DATA_DIR}"
else
  log "Left ${KIOSK_DATA_DIR} in place."
fi

log "Done. Reboot recommended: sudo reboot"
