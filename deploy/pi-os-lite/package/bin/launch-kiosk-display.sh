#!/usr/bin/env bash
# Runs as root from systemd — openvt needs console access, then drops to kiosk for cage.
set -euo pipefail

KIOSK_URL="${KIOSK_URL:-http://localhost:3000/kiosk}"
KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"

exec openvt -f -s -w -c 1 -- \
  runuser -u kiosk -- \
    env HOME=/home/kiosk \
        KIOSK_ROOT="${KIOSK_ROOT}" \
        KIOSK_URL="${KIOSK_URL}" \
        /opt/kiosk/bin/start-kiosk-wayland.sh
