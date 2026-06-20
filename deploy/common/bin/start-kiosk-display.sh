#!/usr/bin/env bash
set -euo pipefail

KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/kiosk}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-120}"
ROTATION_SCRIPT="${KIOSK_ROOT}/bin/set-display-rotation.sh"

# shellcheck source=../kiosk-paths.sh
source "${KIOSK_ROOT}/kiosk-paths.sh"

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
if bin="$(kiosk_electron_bin "${KIOSK_ROOT}")"; then
  exec "${bin}" .
fi
if [[ -n "${KIOSK_ELECTRON:-}" && -x "${KIOSK_ELECTRON}" ]]; then
  echo "[kiosk] WARNING: bundled Electron missing; using KIOSK_ELECTRON=${KIOSK_ELECTRON}" >&2
  exec "${KIOSK_ELECTRON}" .
fi
echo "[kiosk] Bundled Electron missing at ${KIOSK_ROOT}/shell/node_modules." >&2
echo "[kiosk] Fix: sudo -u kiosk bash -lc 'cd ${KIOSK_ROOT}/shell && npm install --omit=dev'" >&2
exit 1
