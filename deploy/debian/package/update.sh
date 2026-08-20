#!/usr/bin/env bash
#
# In-place upgrade for an existing Event Kiosk install.
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"

log() { echo "[update] $*"; }
die() { echo "[update] ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash update.sh"
has_existing_install || die "No existing install found. Run install.sh first."

log "Updating Event Kiosk at ${INSTALL_DIR}..."
log "Data directory ${KIOSK_DATA_DIR} will not be modified."

ensure_data_dir
ensure_session_secret
warn_if_default_admin_password

log "Installing updated application files..."
rsync -a --delete \
  --exclude prisma-tools/ \
  --exclude shell/node_modules/ \
  "${SCRIPT_DIR}/" "${INSTALL_DIR}/"

chmod +x "${INSTALL_DIR}/bin/"*.sh \
  "${INSTALL_DIR}/install.sh" \
  "${INSTALL_DIR}/update.sh" \
  "${INSTALL_DIR}/uninstall.sh" \
  "${INSTALL_DIR}/diagnose.sh" \
  "${INSTALL_DIR}/setup-db.sh" \
  "${INSTALL_DIR}/fix-prisma.sh" \
  "${INSTALL_DIR}/fix-sharp.sh" \
  "${INSTALL_DIR}/fix-permissions.sh" 2>/dev/null || true

log "Applying database schema updates..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}"

log "Checking Electron shell..."
kiosk_install_electron "${INSTALL_DIR}"
if ! kiosk_electron_bin "${INSTALL_DIR}" >/dev/null; then
  die "Electron install failed — bundled binary missing at ${INSTALL_DIR}/shell/node_modules.
Run: sudo -u kiosk bash -lc 'cd ${INSTALL_DIR}/shell && npm install --omit=dev'"
fi

chown -R kiosk:kiosk "${INSTALL_DIR}"

log "Updating systemd services..."
cp "${INSTALL_DIR}/systemd/kiosk-web.service" /etc/systemd/system/
if systemctl is-enabled --quiet kiosk-display.service 2>/dev/null; then
  cp "${INSTALL_DIR}/systemd/kiosk-display.service" /etc/systemd/system/
elif systemctl is-enabled --quiet kiosk-shell.service 2>/dev/null; then
  cp "${INSTALL_DIR}/systemd/kiosk-shell.service" /etc/systemd/system/
fi

systemctl daemon-reload
systemctl restart kiosk-web.service
if systemctl is-enabled --quiet kiosk-display.service 2>/dev/null; then
  systemctl restart kiosk-display.service
elif systemctl is-enabled --quiet kiosk-shell.service 2>/dev/null; then
  systemctl restart kiosk-shell.service
fi

IP="$(hostname -I | awk '{print $1}')"
log ""
log "Update complete."
log "  Admin: http://${IP}:3000/admin"
