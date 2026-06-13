#!/usr/bin/env bash
set -uo pipefail

INSTALL_DIR="/opt/kiosk"
COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${COMMON_DIR}/kiosk-paths.sh" 2>/dev/null || source "${INSTALL_DIR}/kiosk-paths.sh" 2>/dev/null || {
  KIOSK_DATA_DIR="/var/lib/kiosk"
  kiosk_env_file() { echo "${KIOSK_DATA_DIR}/.env"; }
  kiosk_db_file() { echo "${KIOSK_DATA_DIR}/kiosk.db"; }
  kiosk_uploads_dir() { echo "${KIOSK_DATA_DIR}/uploads"; }
  kiosk_display_env() { echo "${KIOSK_DATA_DIR}/display.env"; }
}

detect_init() {
  if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
    echo systemd
  elif command -v rc-service >/dev/null 2>&1; then
    echo openrc
  else
    echo unknown
  fi
}

service_status() {
  local svc="$1"
  local init
  init="$(detect_init)"
  case "${init}" in
    systemd)
      if systemctl is-active --quiet "${svc}" 2>/dev/null; then
        echo "  ${svc}: running"
      elif systemctl is-enabled --quiet "${svc}" 2>/dev/null; then
        echo "  ${svc}: enabled but not running"
      else
        echo "  ${svc}: not enabled"
      fi
      ;;
    openrc)
      if rc-service "${svc}" status 2>/dev/null | grep -qi started; then
        echo "  ${svc}: running"
      elif rc-update show -v 2>/dev/null | grep -q "${svc} |.*default"; then
        echo "  ${svc}: enabled but not running"
      else
        echo "  ${svc}: not enabled"
      fi
      ;;
    *)
      echo "  ${svc}: unknown (no systemd or OpenRC)"
      ;;
  esac
}

echo "=== Event Kiosk Diagnostics ==="
echo ""
echo "-- Init: $(detect_init) --"
echo ""

echo "-- Services --"
for svc in kiosk-web kiosk-display kiosk-shell seatd; do
  service_status "${svc}"
done
if [[ "$(detect_init)" == "systemd" ]]; then
  service_status "getty@tty1"
fi
echo ""

echo "-- Web --"
curl -sf http://localhost:3000/kiosk >/dev/null 2>&1 && echo "  /kiosk: OK" || echo "  /kiosk: FAILED"
echo ""

echo "-- Data (${KIOSK_DATA_DIR}) --"
if [[ -f "$(kiosk_db_file)" ]]; then
  echo "  database: $(kiosk_db_file) ($(stat -c%s "$(kiosk_db_file)" 2>/dev/null || stat -f%z "$(kiosk_db_file)" 2>/dev/null) bytes)"
else
  echo "  database: missing ($(kiosk_db_file))"
fi
if [[ -d "$(kiosk_uploads_dir)" ]]; then
  UPLOAD_COUNT="$(find "$(kiosk_uploads_dir)" -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "  uploads:  $(kiosk_uploads_dir) (${UPLOAD_COUNT} files)"
else
  echo "  uploads:  missing ($(kiosk_uploads_dir))"
fi
echo ""

ENV_FILE="$(kiosk_env_file)"
if [[ -f "${ENV_FILE}" ]]; then
  echo "-- .env --"
  grep -q '^ADMIN_PASSWORD=.\+' "${ENV_FILE}" && echo "  ADMIN_PASSWORD: set" || echo "  ADMIN_PASSWORD: missing"
  grep -q '^SESSION_SECRET=.\+' "${ENV_FILE}" && echo "  SESSION_SECRET: set" || echo "  SESSION_SECRET: missing"
  grep -q '^COOKIE_SECURE=true' "${ENV_FILE}" && echo "  COOKIE_SECURE=true (needs HTTPS)" || echo "  COOKIE_SECURE: false/unset (OK for HTTP)"
  echo ""
fi

DISPLAY_ENV="$(kiosk_display_env)"
if [[ -f "${DISPLAY_ENV}" ]]; then
  echo "-- Display --"
  # shellcheck disable=SC1090
  source "${DISPLAY_ENV}"
  echo "  KIOSK_DISPLAY_ROTATION: ${KIOSK_DISPLAY_ROTATION:-normal}"
  command -v wlr-randr >/dev/null && echo "  wlr-randr: installed" || echo "  wlr-randr: not installed"
  command -v electron >/dev/null && echo "  electron: $(command -v electron)" || echo "  electron: not in PATH"
  if [[ -f /etc/udev/rules.d/99-kiosk-touch-rotation.rules ]]; then
    echo "  touch udev rule: present"
  else
    echo "  touch udev rule: none (normal orientation)"
  fi
  echo ""
fi

echo "-- Logs (last 10 lines) --"
INIT="$(detect_init)"
for svc in kiosk-web kiosk-display kiosk-shell; do
  echo ">> ${svc}"
  if [[ "${INIT}" == "systemd" ]]; then
    journalctl -u "${svc}" -n 10 --no-pager 2>/dev/null || true
  else
    rc-service "${svc}" status 2>/dev/null || true
  fi
  echo ""
done

echo "Recovery: sudo bash ${INSTALL_DIR}/uninstall.sh"
echo "          or Ctrl+Alt+F2 for normal login on tty2"
