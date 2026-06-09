#!/usr/bin/env bash
set -euo pipefail

KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/kiosk}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-120}"
ROTATION_SCRIPT="${KIOSK_ROOT}/bin/set-display-rotation.sh"

export ELECTRON_OZONE_PLATFORM_HINT=wayland
export KIOSK_URL

if [[ -x "${ROTATION_SCRIPT}" ]]; then
  "${ROTATION_SCRIPT}" --apply-wayland || true
fi

cd "${KIOSK_ROOT}/shell"

echo "[kiosk] Waiting for ${KIOSK_URL}..."
elapsed=0
until curl -sf "${KIOSK_URL}" >/dev/null 2>&1; do
  if (( elapsed >= MAX_WAIT_SECONDS )); then
    echo "[kiosk] Web app not ready. Check: sudo systemctl status kiosk-web"
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

echo "[kiosk] Starting Electron..."
exec npm run start
