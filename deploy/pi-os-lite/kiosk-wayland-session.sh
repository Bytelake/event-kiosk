#!/usr/bin/env bash
# Autologin fallback for tty1 — primary display is kiosk-display.service via systemd.
set -euo pipefail

if [[ "$(tty)" != "/dev/tty1" ]]; then
  return 0 2>/dev/null || exit 0
fi

echo "Event Kiosk: display service should start automatically."
echo "If the touchscreen is blank, run: sudo systemctl status kiosk-display"
echo "Starting shell in 5 seconds (Ctrl+C to interrupt)..."
sleep 5
