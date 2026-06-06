#!/usr/bin/env bash
set -uo pipefail

INSTALL_DIR="/opt/kiosk"

echo "=== Event Kiosk Diagnostics ==="
echo ""

echo "-- Services --"
for svc in kiosk-web kiosk-display seatd getty@tty1; do
  if systemctl is-active --quiet "${svc}" 2>/dev/null; then
    echo "  ${svc}: running"
  elif systemctl is-enabled --quiet "${svc}" 2>/dev/null; then
    echo "  ${svc}: enabled but not running"
  else
    echo "  ${svc}: not enabled"
  fi
done
echo ""

echo "-- Web --"
curl -sf http://localhost:3000/kiosk >/dev/null 2>&1 && echo "  /kiosk: OK" || echo "  /kiosk: FAILED"
echo ""

ENV_FILE="${INSTALL_DIR}/web/.env"
if [[ -f "${ENV_FILE}" ]]; then
  echo "-- .env --"
  grep -q '^ADMIN_PASSWORD=.\+' "${ENV_FILE}" && echo "  ADMIN_PASSWORD: set" || echo "  ADMIN_PASSWORD: missing"
  grep -q '^SESSION_SECRET=.\+' "${ENV_FILE}" && echo "  SESSION_SECRET: set" || echo "  SESSION_SECRET: missing"
  grep -q '^COOKIE_SECURE=true' "${ENV_FILE}" && echo "  COOKIE_SECURE=true (needs HTTPS)" || echo "  COOKIE_SECURE: false/unset (OK for HTTP)"
  echo ""
fi

DISPLAY_ENV="${INSTALL_DIR}/display.env"
if [[ -f "${DISPLAY_ENV}" ]]; then
  echo "-- Display --"
  # shellcheck disable=SC1090
  source "${DISPLAY_ENV}"
  echo "  KIOSK_DISPLAY_ROTATION: ${KIOSK_DISPLAY_ROTATION:-normal}"
  command -v wlr-randr >/dev/null && echo "  wlr-randr: installed" || echo "  wlr-randr: NOT installed (required for Pi rotation)"
  if [[ -f /etc/udev/rules.d/99-kiosk-touch-rotation.rules ]]; then
    echo "  touch udev rule: present"
  else
    echo "  touch udev rule: none (normal orientation)"
  fi
  echo ""
fi

echo "-- Logs (last 10 lines) --"
for svc in kiosk-web kiosk-display; do
  echo ">> ${svc}"
  journalctl -u "${svc}" -n 10 --no-pager 2>/dev/null || true
  echo ""
done

echo "Recovery: sudo bash ${INSTALL_DIR}/uninstall.sh"
echo "          or Ctrl+Alt+F2 for normal login on tty2"
