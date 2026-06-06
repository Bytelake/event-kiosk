#!/usr/bin/env bash
# Quick diagnostics for Pi OS Lite kiosk installs.
set -uo pipefail

echo "=== Event Kiosk Diagnostics ==="
echo ""

echo "-- Services --"
for svc in kiosk-web kiosk-display seatd; do
  if systemctl is-active --quiet "${svc}" 2>/dev/null; then
    echo "  ${svc}: running"
  elif systemctl is-enabled --quiet "${svc}" 2>/dev/null; then
    echo "  ${svc}: enabled but NOT running"
  else
    echo "  ${svc}: not enabled"
  fi
done
echo ""

echo "-- Web app --"
if curl -sf http://localhost:3000/kiosk >/dev/null 2>&1; then
  echo "  http://localhost:3000/kiosk : OK"
else
  echo "  http://localhost:3000/kiosk : FAILED (is kiosk-web running?)"
fi
echo ""

echo "-- Environment (/opt/kiosk/apps/web/.env) --"
ENV_FILE="/opt/kiosk/apps/web/.env"
if [[ -f "${ENV_FILE}" ]]; then
  grep -q '^ADMIN_PASSWORD=.\+' "${ENV_FILE}" && echo "  ADMIN_PASSWORD: set" || echo "  ADMIN_PASSWORD: MISSING"
  grep -q '^SESSION_SECRET=.\+' "${ENV_FILE}" && echo "  SESSION_SECRET: set" || echo "  SESSION_SECRET: MISSING"
  if grep -q '^COOKIE_SECURE=true' "${ENV_FILE}" 2>/dev/null; then
    echo "  COOKIE_SECURE=true — admin login requires HTTPS"
  else
    echo "  COOKIE_SECURE: not true (OK for HTTP admin access)"
  fi
else
  echo "  .env file not found at ${ENV_FILE}"
fi
echo ""

echo "-- Display stack --"
command -v cage >/dev/null && echo "  cage: installed" || echo "  cage: NOT installed"
command -v openvt >/dev/null && echo "  openvt: installed" || echo "  openvt: NOT installed (install kbd package)"
getent group seat >/dev/null && id kiosk 2>/dev/null | grep -q seat && echo "  kiosk in seat group: yes" || echo "  kiosk in seat group: check manually"
echo ""

echo "-- Recent logs (last 15 lines each) --"
for svc in kiosk-web kiosk-display; do
  echo ">> ${svc}"
  journalctl -u "${svc}" -n 15 --no-pager 2>/dev/null || echo "  (no logs)"
  echo ""
done

echo "=== End ==="
