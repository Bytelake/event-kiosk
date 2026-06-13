#!/usr/bin/env bash
set -euo pipefail

KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/kiosk}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-120}"
ROTATION_SCRIPT="${KIOSK_ROOT}/bin/set-display-rotation.sh"

export ELECTRON_OZONE_PLATFORM_HINT=wayland
export ELECTRON_DISABLE_SANDBOX=1
export KIOSK_URL

if [[ -x "${ROTATION_SCRIPT}" ]]; then
  "${ROTATION_SCRIPT}" --apply-wayland || true
fi

cd "${KIOSK_ROOT}/shell"

echo "[kiosk] Waiting for ${KIOSK_URL}..."
elapsed=0
until curl -sf "${KIOSK_URL}" >/dev/null 2>&1; do
  if (( elapsed >= MAX_WAIT_SECONDS )); then
    echo "[kiosk] Web app not ready. Check kiosk-web service status." >&2
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

echo "[kiosk] Starting Electron..."
if [[ -n "${KIOSK_ELECTRON:-}" && -x "${KIOSK_ELECTRON}" ]]; then
  exec "${KIOSK_ELECTRON}" .
fi
if command -v electron >/dev/null 2>&1; then
  exec electron .
fi
if [[ -x node_modules/.bin/electron ]]; then
  exec npm run start
fi
echo "[kiosk] No Electron found. Install electron (apk on Alpine, npm on Debian)." >&2
exit 1
