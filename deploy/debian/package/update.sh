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

migrate_to_data_dir "${INSTALL_DIR}"

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
  "${INSTALL_DIR}/fix-permissions.sh" 2>/dev/null || true

chown -R kiosk:kiosk "${INSTALL_DIR}"

log "Regenerating Prisma client..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}" --generate-only

log "Checking Electron shell..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${INSTALL_DIR}/shell'
  npm install --omit=dev
"

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
