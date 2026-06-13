#!/usr/bin/env bash
set -euo pipefail

uid="$(id -u)"
if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
  if [[ -d "/run/user/${uid}" && -w "/run/user/${uid}" ]]; then
    export XDG_RUNTIME_DIR="/run/user/${uid}"
  else
    export XDG_RUNTIME_DIR="/run/kiosk-wayland"
  fi
fi
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}" 2>/dev/null || true

if ! command -v cage >/dev/null 2>&1; then
  echo "[kiosk-wayland] cage is not installed (install cage via apk or apt)." >&2
  exit 1
fi

CAGE_ARGS=(-- /opt/kiosk/bin/start-kiosk-display.sh)
if cage --help 2>&1 | grep -q '\-m'; then
  exec cage -m hide "${CAGE_ARGS[@]}"
fi
exec cage "${CAGE_ARGS[@]}"
