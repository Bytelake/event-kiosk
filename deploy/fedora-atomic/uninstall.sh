#!/usr/bin/env bash
#
# Remove Event Kiosk from Fedora Atomic.
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
KIOSK_DATA_DIR="/var/lib/kiosk"

log() { echo "[uninstall] $*"; }

[[ $EUID -eq 0 ]] || { echo "Run as root"; exit 1; }

systemctl stop kiosk-display.service kiosk-shell.service kiosk-web.service 2>/dev/null || true
systemctl disable kiosk-display.service kiosk-shell.service kiosk-web.service 2>/dev/null || true

rm -f /etc/containers/systemd/kiosk-web.container
rm -f /etc/systemd/system/kiosk-display.service
rm -f /etc/systemd/system/kiosk-shell.service

systemctl enable getty@tty1.service 2>/dev/null || true
systemctl daemon-reload

read -r -p "Remove ${INSTALL_DIR}? [y/N] " REPLY
[[ "${REPLY}" =~ ^[Yy]$ ]] && rm -rf "${INSTALL_DIR}" && log "Removed ${INSTALL_DIR}"

read -r -p "Remove ${KIOSK_DATA_DIR}? [y/N] " REPLY
[[ "${REPLY}" =~ ^[Yy]$ ]] && rm -rf "${KIOSK_DATA_DIR}" && log "Removed ${KIOSK_DATA_DIR}"

log "Done. Reboot recommended."
