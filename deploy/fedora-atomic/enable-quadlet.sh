#!/usr/bin/env bash
# Enable a Podman Quadlet unit on Fedora Atomic (generated units are not normal units).
set -euo pipefail

UNIT="${1:-kiosk-web.service}"
CONTAINER_FILE="${2:-/etc/containers/systemd/kiosk-web.container}"

log() { echo "[quadlet] $*"; }

systemctl daemon-reload

if systemctl enable "${UNIT}" 2>/dev/null; then
  log "Enabled ${UNIT}"
  exit 0
fi

if [[ -f "${CONTAINER_FILE}" ]] && systemctl enable "${CONTAINER_FILE}" 2>/dev/null; then
  log "Enabled ${CONTAINER_FILE}"
  exit 0
fi

systemctl add-wants multi-user.target "${UNIT}" 2>/dev/null || true
log "Registered ${UNIT} with multi-user.target (quadlet generated unit)."
