#!/usr/bin/env bash
# Autologin entry point for the kiosk user on tty1 (Pi OS Lite).
set -euo pipefail

KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"
START_SCRIPT="${KIOSK_ROOT}/deploy/pi-os-lite/start-kiosk-display.sh"

# Only take over the main console — leave SSH sessions alone.
if [[ "$(tty)" != "/dev/tty1" ]]; then
  exec bash -l
fi

# Prevent console blanking on the touchscreen display.
if command -v setterm >/dev/null 2>&1; then
  setterm -blank 0 -powerdown 0 -powersave off </dev/tty1 >/dev/tty1 2>&1 || true
fi

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}"

if ! command -v cage >/dev/null 2>&1; then
  echo "cage is not installed. Run: sudo bash ${KIOSK_ROOT}/deploy/pi-os-lite/install.sh"
  exec bash -l
fi

# cage runs one fullscreen Wayland client — Electron fills the display.
exec cage -- "${START_SCRIPT}"
