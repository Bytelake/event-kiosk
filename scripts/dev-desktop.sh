#!/usr/bin/env bash
# Start Next.js dev server and Electron shell in desktop mode (9:16 window).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/kiosk}"
export KIOSK_DESKTOP_MODE=true

cleanup() {
  if [[ -n "${WEB_PID:-}" ]] && kill -0 "${WEB_PID}" 2>/dev/null; then
    kill "${WEB_PID}" 2>/dev/null || true
    wait "${WEB_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "${ROOT}"
npm run dev --workspace=web &
WEB_PID=$!

echo "[dev:desktop] Waiting for ${KIOSK_URL}..."
until curl -sf "${KIOSK_URL}" >/dev/null 2>&1; do
  if ! kill -0 "${WEB_PID}" 2>/dev/null; then
    echo "[dev:desktop] Web server exited before becoming ready." >&2
    exit 1
  fi
  sleep 1
done

echo "[dev:desktop] Starting Electron shell..."
npm run dev --workspace=shell
