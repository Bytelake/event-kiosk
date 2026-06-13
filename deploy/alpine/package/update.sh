#!/usr/bin/env bash
#
# In-place upgrade for an existing Event Kiosk install (Alpine Linux).
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"
# shellcheck source=lib/helpers.sh
source "${SCRIPT_DIR}/lib/helpers.sh"

log() { echo "[update] $*"; }
die() { echo "[update] ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash update.sh"
has_existing_install || die "No existing install found. Run install.sh first."

log "Updating Event Kiosk at ${INSTALL_DIR}..."
log "Data directory ${KIOSK_DATA_DIR} will not be modified."

ensure_data_dir

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
chmod +x "${INSTALL_DIR}/openrc/"* 2>/dev/null || true

chown -R kiosk:kiosk "${INSTALL_DIR}"

log "Regenerating Prisma client..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}" --generate-only

if rc-update show -v 2>/dev/null | grep -qE 'kiosk-(display|shell) \|.*default' \
  || systemctl is-enabled --quiet kiosk-display.service 2>/dev/null \
  || systemctl is-enabled --quiet kiosk-shell.service 2>/dev/null; then
  log "Checking Electron shell..."
  alpine_install_shell_npm "${INSTALL_DIR}"
fi

chown -R kiosk:kiosk "${INSTALL_DIR}"

log "Updating services..."
alpine_refresh_services "${INSTALL_DIR}"

IP="$(alpine_primary_ip)"
log ""
log "Update complete."
log "  Admin: http://${IP}:3000/admin"
