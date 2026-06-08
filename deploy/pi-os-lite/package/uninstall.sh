#!/usr/bin/env bash
#
# Remove Event Kiosk and restore normal console login on tty1.
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
KIOSK_DATA_DIR="/var/lib/kiosk"

log() { echo "[uninstall] $*"; }

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo bash uninstall.sh"; exit 1; }

log "Stopping kiosk services..."
systemctl stop kiosk-display.service 2>/dev/null || true
systemctl stop kiosk-web.service 2>/dev/null || true
systemctl disable kiosk-display.service 2>/dev/null || true
systemctl disable kiosk-web.service 2>/dev/null || true

log "Restoring login prompt on tty1..."
systemctl enable getty@tty1.service 2>/dev/null || true
systemctl start getty@tty1.service 2>/dev/null || true

log "Removing systemd units..."
rm -f /etc/systemd/system/kiosk-web.service
rm -f /etc/systemd/system/kiosk-display.service
systemctl daemon-reload

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
