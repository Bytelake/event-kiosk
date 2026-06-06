#!/usr/bin/env bash
set -euo pipefail
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}"

CAGE_ARGS=(-- /opt/kiosk/bin/start-kiosk-display.sh)
if cage --help 2>&1 | grep -q '\-m'; then
  exec cage -m hide "${CAGE_ARGS[@]}"
fi
exec cage "${CAGE_ARGS[@]}"
