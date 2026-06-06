#!/usr/bin/env bash
# Launches cage + Electron on the primary display (called by systemd or autologin).
set -euo pipefail

KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"
DISPLAY_SCRIPT="${KIOSK_ROOT}/deploy/pi-os-lite/start-kiosk-display.sh"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}"

if ! command -v cage >/dev/null 2>&1; then
  echo "[kiosk-wayland] cage is not installed."
  exit 1
fi

exec cage -- "${DISPLAY_SCRIPT}"
