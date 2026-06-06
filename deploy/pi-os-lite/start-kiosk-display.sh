#!/usr/bin/env bash
# Runs inside cage on tty1 — waits for the web app, then starts Electron fullscreen.
set -euo pipefail

KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/kiosk}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-120}"

export DISPLAY=
export WAYLAND_DISPLAY=
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export ELECTRON_OZONE_PLATFORM_HINT=wayland
export KIOSK_URL

cd "${KIOSK_ROOT}/apps/shell"

echo "[kiosk-display] Waiting for web app at ${KIOSK_URL}..."

elapsed=0
until curl -sf "${KIOSK_URL}" >/dev/null 2>&1; do
  if (( elapsed >= MAX_WAIT_SECONDS )); then
    echo "[kiosk-display] Timed out waiting for web app. Is kiosk-web.service running?"
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

echo "[kiosk-display] Starting Electron kiosk shell..."
exec npm run start
